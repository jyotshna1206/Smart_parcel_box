import express from 'express';
import db from '../database/db.js';
import { authenticateOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/reminders
router.get('/', authenticateOwner, (req, res) => {
  try {
    const reminders = db.prepare(`
      SELECT 
        r.id, 
        r.parcel_event_id, 
        r.target_time, 
        r.status, 
        r.created_at, 
        r.notified_at, 
        r.cancelled_at,
        p.detected_at as parcel_detected_at,
        round((strftime('%s', r.target_time) - strftime('%s', datetime('now', 'localtime'))) / 60.0) as remaining_minutes
      FROM reminders r
      LEFT JOIN parcel_events p ON r.parcel_event_id = p.id
      ORDER BY r.id DESC
      LIMIT 50
    `).all();

    const sensors = db.prepare('SELECT parcel_present FROM sensors_status WHERE id = 1').get();

    return res.json({
      success: true,
      parcelPresent: sensors ? Boolean(sensors.parcel_present) : false,
      reminders
    });
  } catch (err) {
    console.error('[Reminders] Fetch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve reminders.' });
  }
});

export default router;
