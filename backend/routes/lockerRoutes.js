import express from 'express';
import db from '../database/db.js';
import { authenticateOwner } from '../middleware/auth.js';
import { logActivity } from '../services/activityLogger.js';

const router = express.Router();

// GET /api/locker/status
router.get('/status', authenticateOwner, (req, res) => {
  const locker = db.prepare('SELECT state, last_action_by, last_action_at, servo_angle FROM locker_status WHERE id = 1').get() || { state: 'locked', servo_angle: 0 };
  const latestCommand = db.prepare(`
    SELECT id, command, status, created_by, created_at, executed_at, error_message
    FROM commands
    ORDER BY id DESC
    LIMIT 1
  `).get();

  const pendingUnlock = db.prepare(`
    SELECT id FROM commands
    WHERE command = 'UNLOCK' AND status = 'pending'
    ORDER BY id DESC LIMIT 1
  `).get();

  const servoStatus = pendingUnlock ? 'UNLOCKING' : (locker.state === 'unlocked' ? 'UNLOCKED' : 'LOCKED');

  const device = db.prepare(`
    SELECT (strftime('%s', datetime('now', 'localtime')) - strftime('%s', last_heartbeat)) as diff_sec
    FROM device_status WHERE id = 1
  `).get();

  const timeoutSeconds = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS, 10) || 30;
  const isOnline = device && device.diff_sec !== null && device.diff_sec <= timeoutSeconds;

  return res.json({
    success: true,
    locker: {
      ...locker,
      servoStatus
    },
    latestCommand: latestCommand || null,
    deviceOnline: isOnline
  });
});

// POST /api/locker/lock
router.post('/lock', authenticateOwner, (req, res) => {
  try {
    // Check device online status
    const device = db.prepare(`
      SELECT (strftime('%s', datetime('now', 'localtime')) - strftime('%s', last_heartbeat)) as diff_sec
      FROM device_status WHERE id = 1
    `).get();

    const timeoutSeconds = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS, 10) || 30;
    const isOnline = device && device.diff_sec !== null && device.diff_sec <= timeoutSeconds;

    // Queue LOCK command for ESP32
    const result = db.prepare(`
      INSERT INTO commands (command, parameters, status, created_by, created_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    `).run('LOCK', JSON.stringify({ targetAngle: 0 }), 'pending', 'owner');

    logActivity('locker', 'Lock Command Sent', 'Owner initiated LOCK command (Awaiting ESP32 execution confirmation)', 'info');

    return res.json({
      success: true,
      message: isOnline
        ? 'Lock command queued for ESP32. Awaiting actuator confirmation.'
        : 'Lock command queued. ESP32 is currently OFFLINE; command will execute when device connects.',
      commandId: result.lastInsertRowid,
      deviceOnline: isOnline,
      status: 'pending'
    });
  } catch (err) {
    console.error('[Locker] Lock error:', err);
    return res.status(500).json({ success: false, message: 'Failed to dispatch lock command.' });
  }
});

// POST /api/locker/unlock
router.post('/unlock', authenticateOwner, (req, res) => {
  try {
    const device = db.prepare(`
      SELECT (strftime('%s', datetime('now', 'localtime')) - strftime('%s', last_heartbeat)) as diff_sec
      FROM device_status WHERE id = 1
    `).get();

    const timeoutSeconds = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS, 10) || 30;
    const isOnline = device && device.diff_sec !== null && device.diff_sec <= timeoutSeconds;

    // Queue UNLOCK command for ESP32
    const result = db.prepare(`
      INSERT INTO commands (command, parameters, status, created_by, created_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    `).run('UNLOCK', JSON.stringify({ targetAngle: 90 }), 'pending', 'owner');

    logActivity('locker', 'Unlock Command Sent', 'Owner initiated UNLOCK command (Awaiting ESP32 execution confirmation)', 'info');

    return res.json({
      success: true,
      message: isOnline
        ? 'Unlock command queued for ESP32. Awaiting actuator confirmation.'
        : 'Unlock command queued. ESP32 is currently OFFLINE; command will execute when device connects.',
      commandId: result.lastInsertRowid,
      deviceOnline: isOnline,
      status: 'pending'
    });
  } catch (err) {
    console.error('[Locker] Unlock error:', err);
    return res.status(500).json({ success: false, message: 'Failed to dispatch unlock command.' });
  }
});

export default router;
