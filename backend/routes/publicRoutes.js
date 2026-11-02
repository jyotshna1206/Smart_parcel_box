import express from 'express';
import db from '../database/db.js';
import { hashPin } from './accessRoutes.js';
import { pinVerificationLimiter } from '../middleware/rateLimiter.js';
import { logActivity } from '../services/activityLogger.js';

const router = express.Router();

// POST /api/public/verify-pin
// Public endpoint for courier parcel drop access
router.post('/verify-pin', pinVerificationLimiter, async (req, res) => {
  try {
    const { pinCode } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    if (!pinCode || !/^\d{6}$/.test(pinCode.trim())) {
      if (req.rateLimit) req.rateLimit.recordFailure();
      return res.status(400).json({
        success: false,
        error: 'Invalid PIN format. Please enter a 6-digit numeric PIN.'
      });
    }

    const trimmedPin = pinCode.trim();
    const pinHash = hashPin(trimmedPin);

    // Find pin record by hash
    const pin = db.prepare(`
      SELECT id, status, expires_at, datetime('now', 'localtime') as current_time
      FROM access_pins
      WHERE pin_hash = ?
      LIMIT 1
    `).get(pinHash);

    if (!pin) {
      if (req.rateLimit) req.rateLimit.recordFailure();
      logActivity('pin', 'Invalid PIN Attempt', `Unrecognized delivery PIN attempted from IP ${clientIp}`, 'warning');
      return res.status(400).json({
        success: false,
        error: 'Invalid PIN code. Please verify with the owner.'
      });
    }

    // Check PIN status
    if (pin.status === 'revoked') {
      if (req.rateLimit) req.rateLimit.recordFailure();
      logActivity('pin', 'Revoked PIN Denied', `Attempted use of revoked PIN #${pin.id}`, 'warning');
      return res.status(403).json({
        success: false,
        error: 'This PIN has been revoked. Access denied.'
      });
    }

    if (pin.status === 'used') {
      if (req.rateLimit) req.rateLimit.recordFailure();
      logActivity('pin', 'Reused PIN Denied', `Attempted re-use of already consumed PIN #${pin.id}`, 'warning');
      return res.status(400).json({
        success: false,
        error: 'This PIN has already been used. Access denied.'
      });
    }

    if (pin.status === 'expired' || pin.current_time > pin.expires_at) {
      // Ensure status is marked expired
      db.prepare("UPDATE access_pins SET status = 'expired' WHERE id = ?").run(pin.id);
      if (req.rateLimit) req.rateLimit.recordFailure();
      logActivity('pin', 'Expired PIN Attempt', `Attempted use of expired PIN #${pin.id}`, 'warning');
      return res.status(400).json({
        success: false,
        error: 'This PIN has expired. Please request a new PIN from the owner.'
      });
    }

    // Check if ESP32 device is currently online
    const timeoutSeconds = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS, 10) || 30;
    const device = db.prepare(`
      SELECT (strftime('%s', datetime('now', 'localtime')) - strftime('%s', last_heartbeat)) as diff_sec
      FROM device_status WHERE id = 1
    `).get();

    const isOnline = device && device.diff_sec !== null && device.diff_sec <= timeoutSeconds;
    if (!isOnline) {
      return res.status(503).json({
        success: false,
        error: 'Locker hardware is currently unavailable (offline). Please try again in a few moments or contact the owner.'
      });
    }

    // ATOMIC TRANSACTION: Mark PIN as used and queue UNLOCK command
    let commandId;
    try {
      db.exec('BEGIN TRANSACTION');

      // Update PIN to used
      db.prepare(`
        UPDATE access_pins
        SET status = 'used',
            used_at = datetime('now', 'localtime'),
            used_ip = ?
        WHERE id = ?
      `).run(clientIp, pin.id);

      // Queue unlock command for ESP32
      const cmdResult = db.prepare(`
        INSERT INTO commands (command, parameters, status, created_by, created_at)
        VALUES (?, ?, 'pending', 'delivery_pin', datetime('now', 'localtime'))
      `).run('UNLOCK', JSON.stringify({ targetAngle: 90, pinId: pin.id }));

      commandId = cmdResult.lastInsertRowid;

      db.exec('COMMIT');
    } catch (txErr) {
      db.exec('ROLLBACK');
      console.error('[PublicAccess] Transaction error consuming PIN:', txErr);
      return res.status(500).json({ success: false, error: 'Database transaction failed.' });
    }

    // Reset rate limiter on success
    if (req.rateLimit) req.rateLimit.recordSuccess();

    logActivity('pin', 'Delivery PIN Accepted', `PIN #${pin.id} verified. Unlock command #${commandId} queued for courier`, 'success');

    // Wait up to 4.5 seconds for ESP32 to execute the command, with non-blocking polling
    const pollStart = Date.now();
    let finalStatus = 'pending';

    while (Date.now() - pollStart < 4500) {
      const checkCmd = db.prepare('SELECT status, error_message FROM commands WHERE id = ?').get(commandId);
      if (checkCmd && checkCmd.status !== 'pending') {
        const s = (checkCmd.status || '').toLowerCase();
        finalStatus = (s === 'success' || s === 'executed') ? 'executed' : s;
        break;
      }
      // Brief sleep in loop
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return res.json({
      success: true,
      commandId,
      status: finalStatus, // 'executed', 'pending', or 'failed'
      message: finalStatus === 'executed'
        ? 'Locker unlocked! Please deposit the package and close the door securely.'
        : 'PIN verified. Actuator is opening locker door...'
    });
  } catch (err) {
    console.error('[PublicAccess] Verify PIN error:', err);
    return res.status(500).json({ success: false, error: 'Failed to verify PIN.' });
  }
});

// GET /api/public/command-status/:commandId
router.get('/command-status/:commandId', (req, res) => {
  try {
    const { commandId } = req.params;
    const cmd = db.prepare(`
      SELECT id, command, status, created_at, executed_at, error_message
      FROM commands
      WHERE id = ?
    `).get(commandId);

    if (!cmd) {
      return res.status(404).json({ success: false, error: 'Command not found.' });
    }

    const rawStatus = (cmd.status || '').toLowerCase();
    const normalizedStatus = (rawStatus === 'success' || rawStatus === 'executed') ? 'executed' : (rawStatus === 'failed' ? 'failed' : rawStatus);

    return res.json({
      success: true,
      commandId: cmd.id,
      status: normalizedStatus, // 'pending', 'executed', 'failed'
      executedAt: cmd.executed_at,
      errorMessage: cmd.error_message
    });
  } catch (err) {
    console.error('[PublicAccess] Command status check error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve command status.' });
  }
});

export default router;
