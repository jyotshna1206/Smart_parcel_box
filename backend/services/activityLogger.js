import db from '../database/db.js';

/**
 * Centrally log events into SQLite activity_logs table
 * @param {'auth'|'pin'|'locker'|'parcel'|'security'|'buzzer'|'device'|'reminder'} eventType
 * @param {string} eventTitle
 * @param {string} description
 * @param {'success'|'warning'|'danger'|'info'} status
 */
export function logActivity(eventType, eventTitle, description, status = 'info') {
  try {
    const stmt = db.prepare(`
      INSERT INTO activity_logs (event_type, event_title, description, status, created_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    stmt.run(eventType, eventTitle, description, status);
  } catch (err) {
    console.error('[ActivityLog] Failed to log activity:', err.message);
  }
}
