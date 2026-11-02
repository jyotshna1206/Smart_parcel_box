import express from 'express';
import db from '../database/db.js';
import { authenticateOwner } from '../middleware/auth.js';
import { logActivity } from '../services/activityLogger.js';

const router = express.Router();

// GET /api/alerts
router.get('/', authenticateOwner, (req, res) => {
  try {
    const alerts = db.prepare(`
      SELECT 
        id, 
        alert_type, 
        description, 
        created_at, 
        acknowledged, 
        acknowledged_at, 
        acknowledged_by
      FROM security_alerts
      ORDER BY id DESC
      LIMIT 100
    `).all();

    const sensors = db.prepare(`
      SELECT vibration_enabled, vibration_detected, vibration_raw, vibration_last_detected_at, buzzer_active, buzzer_until
      FROM sensors_status WHERE id = 1
    `).get() || {};

    return res.json({
      success: true,
      alerts,
      currentSensorState: {
        vibrationEnabled: sensors.vibration_enabled !== 0,
        vibrationRaw: sensors.vibration_raw || 0,
        vibrationDetected: Boolean(sensors.vibration_detected),
        lastDetectedAt: sensors.vibration_last_detected_at,
        buzzerActive: Boolean(sensors.buzzer_active),
        buzzerUntil: sensors.buzzer_until
      }
    });
  } catch (err) {
    console.error('[Security] Fetch alerts error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve security alerts.' });
  }
});

// PUT /api/alerts/vibration-control
// Toggle SW-420 vibration sensor detection ON/OFF
router.put('/vibration-control', authenticateOwner, (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Invalid payload. "enabled" must be a boolean.' });
    }

    const val = enabled ? 1 : 0;
    db.prepare(`
      UPDATE sensors_status
      SET vibration_enabled = ?,
          vibration_detected = CASE WHEN ? = 0 THEN 0 ELSE vibration_detected END,
          updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(val, val);

    // Queue CONFIG command for ESP32
    db.prepare(`
      INSERT INTO commands (command, parameters, status, created_by, created_at)
      VALUES ('CONFIG', ?, 'pending', 'owner_settings', datetime('now', 'localtime'))
    `).run(JSON.stringify({ vibrationEnabled: enabled }));

    logActivity('security', 'Vibration Sensor Toggled', `SW-420 vibration monitoring switched ${enabled ? 'ON' : 'OFF'} by owner`, 'info');

    return res.json({
      success: true,
      vibrationEnabled: enabled,
      message: `Vibration detection successfully switched ${enabled ? 'ON' : 'OFF'}.`
    });
  } catch (err) {
    console.error('[Security] Vibration toggle error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update vibration sensor setting.' });
  }
});

// POST /api/alerts/:id/acknowledge
router.post('/:id/acknowledge', authenticateOwner, (req, res) => {
  try {
    const alertId = req.params.id;
    const alert = db.prepare('SELECT id, acknowledged, alert_type FROM security_alerts WHERE id = ?').get(alertId);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Security alert not found.' });
    }

    if (alert.acknowledged === 1) {
      return res.json({ success: true, message: 'Alert was already acknowledged.' });
    }

    db.prepare(`
      UPDATE security_alerts
      SET acknowledged = 1,
          acknowledged_at = datetime('now', 'localtime'),
          acknowledged_by = ?
      WHERE id = ?
    `).run(req.owner.username, alertId);

    logActivity('security', 'Alert Acknowledged', `Owner acknowledged security alert #${alertId} (${alert.alert_type})`, 'info');

    return res.json({
      success: true,
      message: `Alert #${alertId} has been acknowledged.`
    });
  } catch (err) {
    console.error('[Security] Acknowledge error:', err);
    return res.status(500).json({ success: false, message: 'Failed to acknowledge alert.' });
  }
});

export default router;
