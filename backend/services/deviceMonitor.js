import db from '../database/db.js';
import { logActivity } from './activityLogger.js';

let monitorInterval = null;

export function startDeviceMonitor(checkIntervalMs = 5000) {
  if (monitorInterval) return;

  const timeoutSeconds = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS, 10) || 30;

  monitorInterval = setInterval(() => {
    try {
      const device = db.prepare('SELECT status, last_heartbeat FROM device_status WHERE id = 1').get();
      if (!device) return;

      if (device.status === 'online') {
        if (!device.last_heartbeat) {
          db.prepare("UPDATE device_status SET status = 'offline', updated_at = datetime('now', 'localtime') WHERE id = 1").run();
          logActivity('device', 'ESP32 Offline', 'Device status switched to offline (no heartbeat)', 'danger');
          return;
        }

        // Check difference in seconds
        const check = db.prepare(`
          SELECT (strftime('%s', datetime('now', 'localtime')) - strftime('%s', last_heartbeat)) as diff_sec
          FROM device_status WHERE id = 1
        `).get();

        if (check && check.diff_sec > timeoutSeconds) {
          db.prepare("UPDATE device_status SET status = 'offline', updated_at = datetime('now', 'localtime') WHERE id = 1").run();
          logActivity('device', 'ESP32 Offline', `ESP32 connection lost (No heartbeat for ${check.diff_sec}s)`, 'danger');
        }
      }
    } catch (err) {
      console.error('[DeviceMonitor] Error checking device heartbeat:', err.message);
    }
  }, checkIntervalMs);
}

export function stopDeviceMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
