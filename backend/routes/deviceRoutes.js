import express from 'express';
import db from '../database/db.js';
import { authenticateDevice } from '../middleware/deviceAuth.js';
import { logActivity } from '../services/activityLogger.js';

const router = express.Router();

// Apply device authentication token to all device endpoints
router.use(authenticateDevice);

// POST /api/device/heartbeat
// ESP32 sends periodic keepalive
router.post('/heartbeat', (req, res) => {
  try {
    const { firmware = 'v1.0.0', rssi = 0, ip } = req.body;
    const clientIp = ip || req.ip || req.connection.remoteAddress || 'unknown';

    const currentDevice = db.prepare('SELECT status FROM device_status WHERE id = 1').get();
    const wasOffline = !currentDevice || currentDevice.status === 'offline';

    db.prepare(`
      UPDATE device_status
      SET status = 'online',
          last_heartbeat = datetime('now', 'localtime'),
          ip_address = ?,
          firmware_version = ?,
          wifi_rssi = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(clientIp, firmware, parseInt(rssi, 10) || 0);

    if (wasOffline) {
      logActivity('device', 'ESP32 Connected', `ESP32 DevKit V1 came online from IP ${clientIp} (RSSI: ${rssi} dBm)`, 'success');
    }

    const sensors = db.prepare('SELECT ir_polarity, vibration_enabled FROM sensors_status WHERE id = 1').get() || { ir_polarity: 'active_low', vibration_enabled: 1 };

    return res.json({
      success: true,
      status: 'online',
      config: {
        irPolarity: sensors.ir_polarity || 'active_low',
        vibrationEnabled: sensors.vibration_enabled !== 0
      },
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('[DeviceAPI] Heartbeat error:', err);
    return res.status(500).json({ success: false, error: 'Database error on heartbeat' });
  }
});

// POST /api/device/sensor-update
// ESP32 reports real sensor readings
router.post('/sensor-update', (req, res) => {
  try {
    const { ir_raw, vibration, vibration_raw } = req.body;

    if (ir_raw === undefined && vibration === undefined) {
      return res.status(400).json({ success: false, error: 'Missing sensor values' });
    }

    const current = db.prepare(`
      SELECT 
        parcel_present, 
        parcel_source,
        ir_raw, 
        ir_polarity, 
        vibration_enabled,
        vibration_detected,
        vibration_raw,
        vibration_last_detected_at,
        total_deliveries, 
        total_collections
      FROM sensors_status 
      WHERE id = 1
    `).get() || {
      parcel_present: 0,
      parcel_source: 'IR SENSOR',
      ir_raw: 1,
      ir_polarity: 'active_low',
      vibration_enabled: 1,
      vibration_detected: 0,
      vibration_raw: 0,
      total_deliveries: 0,
      total_collections: 0
    };

    const rawIr = ir_raw !== undefined ? parseInt(ir_raw, 10) : current.ir_raw;
    const polarity = current.ir_polarity || 'active_low';
    const isVibrationEnabled = current.vibration_enabled !== 0;

    // Check if the physical IR beam transitioned
    const irStateChanged = (ir_raw !== undefined && parseInt(ir_raw, 10) !== current.ir_raw);
    const computedFromSensor = polarity === 'active_low' ? (rawIr === 0 ? 1 : 0) : (rawIr === 1 ? 1 : 0);

    let newParcelPresent = current.parcel_present;
    let newSource = current.parcel_source || 'IR SENSOR';

    if (irStateChanged) {
      // Physical sensor state transition has occurred
      newParcelPresent = computedFromSensor;
      newSource = 'IR SENSOR';
    } else if (current.parcel_source !== 'MANUAL') {
      newParcelPresent = computedFromSensor;
    }

    const prevParcelPresent = current.parcel_present;
    let totalDeliveries = current.total_deliveries || 0;
    let totalCollections = current.total_collections || 0;

    // --- State Transition: Empty -> Parcel Detected (via IR sensor) ---
    if (irStateChanged && prevParcelPresent === 0 && newParcelPresent === 1) {
      totalDeliveries += 1;

      // Record delivery event
      const eventResult = db.prepare(`
        INSERT INTO parcel_events (event_type, detected_at, details)
        VALUES ('delivery', datetime('now', 'localtime'), 'IR sensor detected package placed in locker')
      `).run();

      // Start 2-hour pickup reminder
      const reminderMinutes = parseInt(process.env.PICKUP_REMINDER_MINUTES, 10) || 120;
      db.prepare(`
        INSERT INTO reminders (parcel_event_id, target_time, status, created_at)
        VALUES (?, datetime('now', 'localtime', '+' || ? || ' minutes'), 'pending', datetime('now', 'localtime'))
      `).run(eventResult.lastInsertRowid, reminderMinutes);

      // Trigger 2-second delivery confirmation buzzer on ESP32
      db.prepare(`
        INSERT INTO commands (command, parameters, status, created_by, created_at)
        VALUES ('BUZZER', ?, 'pending', 'hardware_delivery', datetime('now', 'localtime'))
      `).run(JSON.stringify({ durationMs: 2000 }));

      db.prepare(`
        UPDATE sensors_status
        SET buzzer_active = 1,
            buzzer_until = datetime('now', 'localtime', '+2 seconds')
        WHERE id = 1
      `).run();

      logActivity('parcel', 'Parcel Delivered', 'IR sensor confirmed parcel drop. 2-hour pickup reminder started.', 'success');
      logActivity('buzzer', 'Delivery Chime Triggered', 'Buzzer active for 2.0s delivery confirmation', 'info');
    }

    // --- State Transition: Parcel -> Empty (via IR sensor) ---
    if (irStateChanged && prevParcelPresent === 1 && newParcelPresent === 0) {
      totalCollections += 1;

      db.prepare(`
        INSERT INTO parcel_events (event_type, detected_at, details)
        VALUES ('collection', datetime('now', 'localtime'), 'IR sensor confirmed parcel collected by owner')
      `).run();

      // Cancel pending pickup reminder
      db.prepare(`
        UPDATE reminders
        SET status = 'collected', cancelled_at = datetime('now', 'localtime')
        WHERE status = 'pending'
      `).run();

      logActivity('parcel', 'Parcel Collected', 'IR sensor cleared: Compartment empty. Pickup reminder resolved.', 'info');
    }

    // --- Vibration / Tamper detection ---
    let newVibration = 0;
    const rawVib = vibration_raw !== undefined ? parseInt(vibration_raw, 10) : (vibration ? 1 : 0);

    if (isVibrationEnabled && (vibration === 1 || vibration === true)) {
      // Cooldown debounce check (15 seconds)
      const cooldownCheck = db.prepare(`
        SELECT (strftime('%s', datetime('now', 'localtime')) - strftime('%s', vibration_last_detected_at)) as diff_sec
        FROM sensors_status WHERE id = 1
      `).get();

      const canTriggerAlert = !cooldownCheck || cooldownCheck.diff_sec === null || cooldownCheck.diff_sec > 15;

      if (canTriggerAlert) {
        newVibration = 1;

        db.prepare(`
          INSERT INTO security_alerts (alert_type, description, created_at, acknowledged)
          VALUES ('tampering', 'Vibration sensor triggered on compartment - potential tampering detected', datetime('now', 'localtime'), 0)
        `).run();

        // Trigger buzzer alarm for 12 seconds
        db.prepare(`
          INSERT INTO commands (command, parameters, status, created_by, created_at)
          VALUES ('BUZZER', ?, 'pending', 'hardware_tampering', datetime('now', 'localtime'))
        `).run(JSON.stringify({ durationMs: 12000 }));

        db.prepare(`
          UPDATE sensors_status
          SET buzzer_active = 1,
              buzzer_until = datetime('now', 'localtime', '+12 seconds')
          WHERE id = 1
        `).run();

        logActivity('security', 'Tampering Detected', 'SW-420 vibration sensor triggered on locker enclosure!', 'danger');
        logActivity('buzzer', 'Tamper Alarm Active', 'Buzzer sounding for 12.0s tamper deterrent', 'warning');
      } else {
        newVibration = 1; // within cooldown
      }
    }

    // Update sensors_status row
    db.prepare(`
      UPDATE sensors_status
      SET parcel_present = ?,
          parcel_source = ?,
          ir_raw = ?,
          vibration_detected = ?,
          vibration_raw = ?,
          vibration_last_detected_at = CASE WHEN ? = 1 THEN datetime('now', 'localtime') ELSE vibration_last_detected_at END,
          last_delivery_at = CASE WHEN ? = 1 AND ? = 0 THEN datetime('now', 'localtime') ELSE last_delivery_at END,
          last_collection_at = CASE WHEN ? = 0 AND ? = 1 THEN datetime('now', 'localtime') ELSE last_collection_at END,
          total_deliveries = ?,
          total_collections = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(
      newParcelPresent,
      newSource,
      rawIr,
      newVibration,
      rawVib,
      newVibration,
      newParcelPresent,
      prevParcelPresent,
      newParcelPresent,
      prevParcelPresent,
      totalDeliveries,
      totalCollections
    );

    return res.json({
      success: true,
      parcelPresent: Boolean(newParcelPresent),
      parcelSource: newSource,
      vibrationDetected: Boolean(newVibration),
      config: {
        irPolarity: polarity,
        vibrationEnabled: isVibrationEnabled
      }
    });
  } catch (err) {
    console.error('[DeviceAPI] Sensor update error:', err);
    return res.status(500).json({ success: false, error: 'Database error processing sensor update' });
  }
});

// GET /api/device/commands
// ESP32 polls for queued actuator/buzzer commands
router.get('/commands', (req, res) => {
  try {
    const pending = db.prepare(`
      SELECT id, command, parameters, created_by, created_at
      FROM commands
      WHERE status = 'pending'
      ORDER BY id ASC
      LIMIT 10
    `).all();

    const formatted = pending.map(cmd => {
      let params = {};
      try {
        params = cmd.parameters ? JSON.parse(cmd.parameters) : {};
      } catch (e) {
        params = {};
      }
      return {
        id: cmd.id,
        command: cmd.command,
        parameters: params,
        createdBy: cmd.created_by,
        createdAt: cmd.created_at
      };
    });

    const sensors = db.prepare('SELECT ir_polarity, vibration_enabled FROM sensors_status WHERE id = 1').get() || { ir_polarity: 'active_low', vibration_enabled: 1 };

    return res.json({
      success: true,
      commands: formatted,
      config: {
        irPolarity: sensors.ir_polarity || 'active_low',
        vibrationEnabled: sensors.vibration_enabled !== 0
      }
    });
  } catch (err) {
    console.error('[DeviceAPI] Get commands error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve commands' });
  }
});

// POST /api/device/auto-lock
// ESP32 reports that the 180s unlock window completed and returned to 0 deg
router.post('/auto-lock', (req, res) => {
  try {
    db.prepare(`
      UPDATE locker_status
      SET state = 'locked',
          last_action_by = 'auto_lock',
          last_action_at = datetime('now', 'localtime'),
          servo_angle = 0,
          updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run();

    logActivity('locker', 'Auto-Lock Engaged', 'Locker servo automatically returned to 0° (LOCKED) after 180 seconds', 'info');

    return res.json({ success: true, status: 'locked' });
  } catch (err) {
    console.error('[DeviceAPI] Auto-lock error:', err);
    return res.status(500).json({ success: false, error: 'Database error recording auto-lock' });
  }
});

// POST /api/device/command-result
// ESP32 reports execution confirmation
router.post('/command-result', (req, res) => {
  try {
    const { commandId, status, error, angle } = req.body;

    if (!commandId || !status) {
      return res.status(400).json({ success: false, error: 'commandId and status are required' });
    }

    // Special handling for ESP32 auto-lock notification
    if (commandId === 'auto_lock') {
      db.prepare(`
        UPDATE locker_status
        SET state = 'locked',
            last_action_by = 'auto_lock',
            last_action_at = datetime('now', 'localtime'),
            servo_angle = 0,
            updated_at = datetime('now', 'localtime')
      WHERE id = 1
      `).run();

      logActivity('locker', 'Auto-Lock Engaged', 'Locker servo automatically returned to 0° (LOCKED) after 180 seconds', 'info');

      return res.json({ success: true, commandId, status: 'locked' });
    }

    const cmd = db.prepare('SELECT id, command, created_by FROM commands WHERE id = ?').get(commandId);
    if (!cmd) {
      return res.status(404).json({ success: false, error: 'Command not found' });
    }

    // Normalize status: accept 'executed', 'success', 'SUCCESS'
    const rawStatus = (status || '').toLowerCase();
    const normalizedStatus = (rawStatus === 'success' || rawStatus === 'executed') ? 'executed' : (rawStatus === 'failed' ? 'failed' : rawStatus);

    // Update command record
    db.prepare(`
      UPDATE commands
      SET status = ?,
          executed_at = datetime('now', 'localtime'),
          error_message = ?
      WHERE id = ?
    `).run(normalizedStatus, error || null, commandId);

    // Update physical actuator state ONLY upon confirmed execution!
    if (normalizedStatus === 'executed') {
      if (cmd.command === 'LOCK') {
        db.prepare(`
          UPDATE locker_status
          SET state = 'locked',
              last_action_by = ?,
              last_action_at = datetime('now', 'localtime'),
              servo_angle = ?,
              updated_at = datetime('now', 'localtime')
          WHERE id = 1
        `).run(cmd.created_by, angle !== undefined ? angle : 0);

        logActivity('locker', 'Locker Locked', `Actuator confirmed LOCKED (0°) by ${cmd.created_by}`, 'success');
      } else if (cmd.command === 'UNLOCK') {
        db.prepare(`
          UPDATE locker_status
          SET state = 'unlocked',
              last_action_by = ?,
              last_action_at = datetime('now', 'localtime'),
              servo_angle = ?,
              updated_at = datetime('now', 'localtime')
          WHERE id = 1
        `).run(cmd.created_by, angle !== undefined ? angle : 90);

        logActivity('locker', 'Locker Unlocked', `Actuator confirmed UNLOCKED (90°) by ${cmd.created_by}`, 'success');
      } else if (cmd.command === 'BUZZER') {
        logActivity('buzzer', 'Buzzer Executed', `ESP32 completed buzzer sequence`, 'info');
      } else if (cmd.command === 'CONFIG') {
        logActivity('device', 'Config Applied', 'ESP32 applied hardware configuration settings', 'info');
      }
    } else if (normalizedStatus === 'failed') {
      logActivity('locker', 'Actuator Command Failed', `Command #${commandId} (${cmd.command}) execution failed on ESP32: ${error || 'Unknown error'}`, 'danger');
    }

    return res.json({
      success: true,
      commandId,
      status: normalizedStatus
    });
  } catch (err) {
    console.error('[DeviceAPI] Command result error:', err);
    return res.status(500).json({ success: false, error: 'Database error recording command result' });
  }
});

export default router;
