import express from 'express';
import db from '../database/db.js';
import { authenticateOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/dashboard
router.get('/', authenticateOwner, (req, res) => {
  try {
    const timeoutSeconds = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS, 10) || 30;

    // Check device status
    const device = db.prepare(`
      SELECT 
        status, 
        last_heartbeat, 
        ip_address, 
        firmware_version, 
        wifi_rssi,
        (strftime('%s', datetime('now', 'localtime')) - strftime('%s', last_heartbeat)) as diff_sec
      FROM device_status 
      WHERE id = 1
    `).get() || { status: 'offline', diff_sec: 999 };

    const isDeviceOnline = device.diff_sec !== null && device.diff_sec <= timeoutSeconds;
    const computedDeviceStatus = isDeviceOnline ? 'online' : 'offline';

    // Locker status
    const locker = db.prepare('SELECT state, last_action_by, last_action_at, servo_angle FROM locker_status WHERE id = 1').get() || {
      state: 'unknown',
      last_action_by: 'none',
      last_action_at: null,
      servo_angle: 0
    };

    // Check if there is an active pending UNLOCK command
    const pendingUnlock = db.prepare(`
      SELECT id FROM commands
      WHERE command = 'UNLOCK' AND status = 'pending'
      ORDER BY id DESC LIMIT 1
    `).get();

    const servoStatus = pendingUnlock
      ? 'UNLOCKING'
      : (locker.state === 'unlocked' ? 'UNLOCKED' : 'LOCKED');

    // Sensor status
    const sensors = db.prepare(`
      SELECT 
        parcel_present, 
        parcel_source,
        ir_raw, 
        ir_polarity, 
        vibration_enabled,
        vibration_detected, 
        vibration_raw,
        vibration_last_detected_at,
        buzzer_active, 
        buzzer_until,
        last_delivery_at, 
        last_collection_at, 
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
      buzzer_active: 0,
      total_deliveries: 0,
      total_collections: 0
    };

    // Check buzzer active window
    let isBuzzerActive = sensors.buzzer_active === 1;
    if (sensors.buzzer_until) {
      const checkBuzzer = db.prepare(`
        SELECT datetime('now', 'localtime') < ? as is_active
      `).get(sensors.buzzer_until);
      isBuzzerActive = checkBuzzer ? Boolean(checkBuzzer.is_active) : false;
    }

    // Unacknowledged security alerts count
    const unacknowledgedAlertsCount = db.prepare(`
      SELECT COUNT(*) as count FROM security_alerts WHERE acknowledged = 0
    `).get().count;

    // Active 2-hour pickup reminder
    const activeReminder = db.prepare(`
      SELECT 
        id, 
        target_time, 
        status, 
        created_at,
        round((strftime('%s', target_time) - strftime('%s', datetime('now', 'localtime'))) / 60.0) as remaining_minutes
      FROM reminders 
      WHERE status = 'pending'
      ORDER BY id DESC 
      LIMIT 1
    `).get();

    // Recent 6 activities
    const recentActivities = db.prepare(`
      SELECT id, event_type, event_title, description, status, created_at
      FROM activity_logs
      ORDER BY id DESC
      LIMIT 6
    `).all();

    // Recent 4 security alerts
    const recentAlerts = db.prepare(`
      SELECT id, alert_type, description, created_at, acknowledged, acknowledged_at
      FROM security_alerts
      ORDER BY id DESC
      LIMIT 4
    `).all();

    return res.json({
      success: true,
      data: {
        device: {
          status: computedDeviceStatus,
          name: 'ESP32 DevKit V1',
          lastHeartbeat: device.last_heartbeat,
          secondsSinceHeartbeat: device.diff_sec,
          ipAddress: device.ip_address,
          firmwareVersion: device.firmware_version,
          wifiRssi: device.wifi_rssi
        },
        locker: {
          state: locker.state, // 'locked', 'unlocked', 'unknown'
          servoStatus, // 'LOCKED', 'UNLOCKING', 'UNLOCKED'
          lastActionBy: locker.last_action_by,
          lastActionAt: locker.last_action_at,
          servoAngle: locker.servo_angle
        },
        parcel: {
          present: Boolean(sensors.parcel_present),
          statusText: sensors.parcel_present === 1 ? 'Parcel Inside' : 'Locker Empty',
          source: sensors.parcel_source || 'IR SENSOR',
          lastDeliveryAt: sensors.last_delivery_at,
          lastCollectionAt: sensors.last_collection_at,
          totalDeliveries: sensors.total_deliveries,
          totalCollections: sensors.total_collections
        },
        sensors: {
          ir: {
            beamBroken: sensors.ir_polarity === 'active_low' ? sensors.ir_raw === 0 : sensors.ir_raw === 1,
            raw: sensors.ir_raw,
            polarity: sensors.ir_polarity
          },
          vibration: {
            enabled: sensors.vibration_enabled !== 0,
            detected: Boolean(sensors.vibration_detected),
            raw: sensors.vibration_raw || 0,
            lastDetectedAt: sensors.vibration_last_detected_at
          },
          buzzer: {
            active: isBuzzerActive,
            until: sensors.buzzer_until
          }
        },
        security: {
          unacknowledgedAlertsCount,
          recentAlerts
        },
        reminder: activeReminder ? {
          id: activeReminder.id,
          targetTime: activeReminder.target_time,
          status: activeReminder.status,
          remainingMinutes: Math.max(0, Math.round(activeReminder.remaining_minutes || 0))
        } : null,
        recentActivities
      }
    });
  } catch (err) {
    console.error('[Dashboard] Error fetching telemetry:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve dashboard data.' });
  }
});

export default router;
