import express from 'express';
import crypto from 'node:crypto';
import db from '../database/db.js';
import { authenticateOwner } from '../middleware/auth.js';
import { logActivity } from '../services/activityLogger.js';

const router = express.Router();

// Helper to hash 6-digit PIN with SHA-256
export function hashPin(pinCode) {
  return crypto.createHash('sha256').update(pinCode.trim()).digest('hex');
}

// POST /api/access/generate-pin
router.post('/generate-pin', authenticateOwner, (req, res) => {
  try {
    const durationMinutes = parseInt(req.body.durationMinutes, 10) || 15;

    // Generate cryptographically secure 6-digit PIN (100000 - 999999)
    const rawPin = crypto.randomInt(100000, 1000000).toString();
    const pinHash = hashPin(rawPin);

    // Calculate expiry
    const insertStmt = db.prepare(`
      INSERT INTO access_pins (
        pin_hash, created_by_owner_id, duration_minutes, created_at,
        expires_at, status
      ) VALUES (
        ?, ?, ?, datetime('now', 'localtime'),
        datetime('now', 'localtime', '+' || ? || ' minutes'), 'active'
      )
    `);

    const result = insertStmt.run(pinHash, req.owner.id, durationMinutes, durationMinutes);

    const createdPin = db.prepare(`
      SELECT id, duration_minutes, created_at, expires_at, status
      FROM access_pins WHERE id = ?
    `).get(result.lastInsertRowid);

    logActivity(
      'pin',
      'PIN Generated',
      `Owner generated temporary 6-digit delivery PIN #${createdPin.id} (Valid for ${durationMinutes} mins)`,
      'success'
    );

    // Return the raw 6-digit PIN to the owner ONCE
    return res.json({
      success: true,
      message: 'Temporary PIN generated successfully.',
      pin: {
        id: createdPin.id,
        rawPin, // Revealed ONLY here to the owner
        durationMinutes: createdPin.duration_minutes,
        createdAt: createdPin.created_at,
        expiresAt: createdPin.expires_at,
        status: createdPin.status
      }
    });
  } catch (err) {
    console.error('[AccessPin] Generate error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate access PIN.' });
  }
});

// GET /api/access/pins
router.get('/pins', authenticateOwner, (req, res) => {
  try {
    // Automatically transition expired active pins to 'expired'
    db.prepare(`
      UPDATE access_pins
      SET status = 'expired'
      WHERE status = 'active' AND datetime('now', 'localtime') > expires_at
    `).run();

    const pins = db.prepare(`
      SELECT 
        id, 
        duration_minutes, 
        created_at, 
        expires_at, 
        status, 
        used_at, 
        used_ip,
        attempts_count
      FROM access_pins
      ORDER BY id DESC
      LIMIT 100
    `).all();

    return res.json({
      success: true,
      pins
    });
  } catch (err) {
    console.error('[AccessPin] Fetch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve PIN list.' });
  }
});

// POST /api/access/revoke-pin
router.post('/revoke-pin', authenticateOwner, (req, res) => {
  try {
    const { pinId } = req.body;
    if (!pinId) {
      return res.status(400).json({ success: false, message: 'PIN ID is required.' });
    }

    const pin = db.prepare('SELECT id, status FROM access_pins WHERE id = ?').get(pinId);
    if (!pin) {
      return res.status(404).json({ success: false, message: 'PIN record not found.' });
    }

    if (pin.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Cannot revoke PIN with status '${pin.status}'.`
      });
    }

    db.prepare("UPDATE access_pins SET status = 'revoked' WHERE id = ?").run(pinId);

    logActivity('pin', 'PIN Revoked', `Owner revoked temporary PIN #${pinId}`, 'warning');

    return res.json({
      success: true,
      message: `PIN #${pinId} revoked successfully.`
    });
  } catch (err) {
    console.error('[AccessPin] Revoke error:', err);
    return res.status(500).json({ success: false, message: 'Failed to revoke PIN.' });
  }
});

export default router;
