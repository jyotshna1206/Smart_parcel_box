import db from '../database/db.js';
import { logActivity } from './activityLogger.js';

let reminderInterval = null;

export function startReminderService(checkIntervalMs = 15000) {
  if (reminderInterval) return;

  reminderInterval = setInterval(() => {
    try {
      // Find pending reminders whose target_time has elapsed
      const overdueReminders = db.prepare(`
        SELECT r.id, r.parcel_event_id, r.target_time, p.detected_at
        FROM reminders r
        LEFT JOIN parcel_events p ON r.parcel_event_id = p.id
        WHERE r.status = 'pending'
          AND datetime('now', 'localtime') >= r.target_time
      `).all();

      for (const reminder of overdueReminders) {
        // Double check if parcel is still present
        const sensors = db.prepare('SELECT parcel_present FROM sensors_status WHERE id = 1').get();
        if (sensors && sensors.parcel_present === 1) {
          // Mark reminder as alerted
          db.prepare(`
            UPDATE reminders
            SET status = 'alerted', notified_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(reminder.id);

          // Create a security alert notification for the owner
          db.prepare(`
            INSERT INTO security_alerts (alert_type, description, created_at, acknowledged)
            VALUES (?, ?, datetime('now', 'localtime'), 0)
          `).run('uncollected_parcel', 'Pickup Reminder: Parcel has been in locker for over 2 hours without collection.');

          logActivity(
            'reminder',
            'Pickup Reminder Overdue',
            'Parcel delivered earlier has remained uncollected for 2+ hours.',
            'warning'
          );
        } else {
          // Parcel is no longer present, mark collected
          db.prepare(`
            UPDATE reminders
            SET status = 'collected', cancelled_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(reminder.id);
        }
      }
    } catch (err) {
      console.error('[ReminderService] Error checking overdue reminders:', err.message);
    }
  }, checkIntervalMs);
}

export function stopReminderService() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
