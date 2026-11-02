import express from 'express';
import db from '../database/db.js';
import { authenticateOwner } from '../middleware/auth.js';
import { logActivity } from '../services/activityLogger.js';

const router = express.Router();

// GET /api/parcels/status
router.get('/status', authenticateOwner, (req, res) => {
  try {
    const sensors = db.prepare(`
      SELECT 
        parcel_present, 
        parcel_source,
        ir_raw, 
        ir_polarity, 
        last_delivery_at, 
        last_collection_at, 
        total_deliveries, 
        total_collections,
        updated_at
      FROM sensors_status 
      WHERE id = 1
    `).get() || {
      parcel_present: 0,
      parcel_source: 'IR SENSOR',
      ir_raw: 1,
      ir_polarity: 'active_low',
      total_deliveries: 0,
      total_collections: 0
    };

    const isBeamBroken = sensors.ir_polarity === 'active_low' ? sensors.ir_raw === 0 : sensors.ir_raw === 1;

    return res.json({
      success: true,
      parcel: {
        present: Boolean(sensors.parcel_present),
        statusText: sensors.parcel_present === 1 ? 'Parcel Inside' : 'Locker Empty',
        source: sensors.parcel_source || 'IR SENSOR',
        beamBroken: isBeamBroken,
        rawReading: sensors.ir_raw,
        polarity: sensors.ir_polarity,
        lastDeliveryAt: sensors.last_delivery_at,
        lastCollectionAt: sensors.last_collection_at,
        totalDeliveries: sensors.total_deliveries,
        totalCollections: sensors.total_collections,
        updatedAt: sensors.updated_at
      }
    });
  } catch (err) {
    console.error('[Parcel] Status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve parcel status.' });
  }
});

// PUT /api/parcels/settings (configure IR sensor active polarity)
router.put('/settings', authenticateOwner, (req, res) => {
  try {
    const { irPolarity } = req.body;
    if (irPolarity !== 'active_low' && irPolarity !== 'active_high') {
      return res.status(400).json({
        success: false,
        message: 'Invalid IR polarity. Must be either "active_low" or "active_high".'
      });
    }

    db.prepare(`
      UPDATE sensors_status
      SET ir_polarity = ?, updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(irPolarity);

    // Queue CONFIG command for ESP32
    db.prepare(`
      INSERT INTO commands (command, parameters, status, created_by, created_at)
      VALUES ('CONFIG', ?, 'pending', 'owner_settings', datetime('now', 'localtime'))
    `).run(JSON.stringify({ irPolarity }));

    logActivity('parcel', 'IR Polarity Configured', `IR sensor logic polarity set to ${irPolarity === 'active_low' ? 'Active LOW' : 'Active HIGH'}`, 'info');

    return res.json({
      success: true,
      irPolarity,
      message: `IR sensor polarity updated to ${irPolarity === 'active_low' ? 'Active LOW' : 'Active HIGH'}.`
    });
  } catch (err) {
    console.error('[Parcel] Settings update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update parcel sensor settings.' });
  }
});

// POST /api/parcels/manual-in (Owner manually marks parcel stored)
router.post('/manual-in', authenticateOwner, (req, res) => {
  try {
    const current = db.prepare('SELECT parcel_present, total_deliveries FROM sensors_status WHERE id = 1').get() || { parcel_present: 0, total_deliveries: 0 };

    if (current.parcel_present === 1) {
      return res.status(400).json({
        success: false,
        message: 'Parcel is already recorded as INSIDE the locker.'
      });
    }

    const newDeliveries = (current.total_deliveries || 0) + 1;

    // Record delivery event in database
    const eventResult = db.prepare(`
      INSERT INTO parcel_events (event_type, detected_at, details)
      VALUES ('delivery', datetime('now', 'localtime'), 'Parcel marked IN manually by Owner')
    `).run();

    // Start 2-hour pickup reminder
    const reminderMinutes = parseInt(process.env.PICKUP_REMINDER_MINUTES, 10) || 120;
    db.prepare(`UPDATE reminders SET status = 'cancelled', cancelled_at = datetime('now', 'localtime') WHERE status = 'pending'`).run();
    db.prepare(`
      INSERT INTO reminders (parcel_event_id, target_time, status, created_at)
      VALUES (?, datetime('now', 'localtime', '+' || ? || ' minutes'), 'pending', datetime('now', 'localtime'))
    `).run(eventResult.lastInsertRowid, reminderMinutes);

    // Update sensors_status row
    db.prepare(`
      UPDATE sensors_status
      SET parcel_present = 1,
          parcel_source = 'MANUAL',
          last_delivery_at = datetime('now', 'localtime'),
          last_manual_update_at = datetime('now', 'localtime'),
          total_deliveries = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(newDeliveries);

    logActivity('parcel', 'Parcel IN (Manual)', `Owner '${req.owner.username}' manually recorded Parcel IN. 2-hour pickup reminder active.`, 'success');

    return res.json({
      success: true,
      message: 'Parcel status updated to "Parcel Inside" (Manual).',
      parcel: {
        present: true,
        source: 'MANUAL',
        statusText: 'Parcel Inside',
        totalDeliveries: newDeliveries
      }
    });
  } catch (err) {
    console.error('[Parcel] Manual IN error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record manual Parcel IN.' });
  }
});

// POST /api/parcels/manual-out (Owner manually marks parcel collected)
router.post('/manual-out', authenticateOwner, (req, res) => {
  try {
    const current = db.prepare('SELECT parcel_present, total_collections FROM sensors_status WHERE id = 1').get() || { parcel_present: 0, total_collections: 0 };

    if (current.parcel_present === 0) {
      return res.status(400).json({
        success: false,
        message: 'Locker is already recorded as EMPTY.'
      });
    }

    const newCollections = (current.total_collections || 0) + 1;

    // Record collection event in database
    db.prepare(`
      INSERT INTO parcel_events (event_type, detected_at, details)
      VALUES ('collection', datetime('now', 'localtime'), 'Parcel marked OUT manually by Owner')
    `).run();

    // Cancel pending pickup reminders
    db.prepare(`
      UPDATE reminders
      SET status = 'collected', cancelled_at = datetime('now', 'localtime')
      WHERE status = 'pending'
    `).run();

    // Update sensors_status row
    db.prepare(`
      UPDATE sensors_status
      SET parcel_present = 0,
          parcel_source = 'MANUAL',
          last_collection_at = datetime('now', 'localtime'),
          last_manual_update_at = datetime('now', 'localtime'),
          total_collections = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(newCollections);

    logActivity('parcel', 'Parcel OUT (Manual)', `Owner '${req.owner.username}' manually recorded Parcel OUT. Pickup reminder cleared.`, 'info');

    return res.json({
      success: true,
      message: 'Parcel status updated to "Locker Empty" (Manual).',
      parcel: {
        present: false,
        source: 'MANUAL',
        statusText: 'Locker Empty',
        totalCollections: newCollections
      }
    });
  } catch (err) {
    console.error('[Parcel] Manual OUT error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record manual Parcel OUT.' });
  }
});

// GET /api/parcels/history
router.get('/history', authenticateOwner, (req, res) => {
  try {
    const events = db.prepare(`
      SELECT id, event_type, detected_at, details
      FROM parcel_events
      ORDER BY id DESC
      LIMIT 100
    `).all();

    return res.json({
      success: true,
      events
    });
  } catch (err) {
    console.error('[Parcel] History error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve parcel history.' });
  }
});

export default router;
