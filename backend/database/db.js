import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'smart_locker.db');

export const db = new DatabaseSync(DB_PATH);

// Initialize database schema and default records
export function initDatabase() {
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS device_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      device_name TEXT DEFAULT 'ESP32 DevKit V1',
      status TEXT DEFAULT 'offline',
      last_heartbeat DATETIME,
      ip_address TEXT,
      firmware_version TEXT DEFAULT 'v1.0.0',
      wifi_rssi INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS locker_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state TEXT DEFAULT 'unknown',
      last_action_by TEXT DEFAULT 'none',
      last_action_at DATETIME,
      servo_angle INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sensors_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      parcel_present INTEGER DEFAULT 0,
      parcel_source TEXT DEFAULT 'IR SENSOR',
      ir_raw INTEGER DEFAULT 1,
      ir_polarity TEXT DEFAULT 'active_low',
      vibration_enabled INTEGER DEFAULT 1,
      vibration_detected INTEGER DEFAULT 0,
      vibration_raw INTEGER DEFAULT 0,
      vibration_last_detected_at DATETIME,
      buzzer_active INTEGER DEFAULT 0,
      buzzer_until DATETIME,
      last_delivery_at DATETIME,
      last_collection_at DATETIME,
      last_manual_update_at DATETIME,
      total_deliveries INTEGER DEFAULT 0,
      total_collections INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS access_pins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pin_hash TEXT NOT NULL UNIQUE,
      created_by_owner_id INTEGER REFERENCES owners(id),
      duration_minutes INTEGER NOT NULL DEFAULT 15,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      status TEXT DEFAULT 'active',
      used_at DATETIME,
      used_ip TEXT,
      attempts_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      parameters TEXT,
      status TEXT DEFAULT 'pending',
      created_by TEXT DEFAULT 'owner',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      executed_at DATETIME,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS parcel_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS security_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      acknowledged INTEGER DEFAULT 0,
      acknowledged_at DATETIME,
      acknowledged_by TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      event_title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'info',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parcel_event_id INTEGER REFERENCES parcel_events(id),
      target_time DATETIME NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notified_at DATETIME,
      cancelled_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_access_pins_status ON access_pins(status, expires_at);
    CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);
    CREATE INDEX IF NOT EXISTS idx_security_alerts_ack ON security_alerts(acknowledged, created_at DESC);
  `);

  // Initialize single-row status tables if not present
  const checkDevice = db.prepare('SELECT id FROM device_status WHERE id = 1').get();
  if (!checkDevice) {
    db.prepare(`
      INSERT INTO device_status (id, device_name, status, last_heartbeat, firmware_version, wifi_rssi)
      VALUES (1, 'ESP32 DevKit V1', 'offline', NULL, 'v1.0.0', 0)
    `).run();
  }

  const checkLocker = db.prepare('SELECT id FROM locker_status WHERE id = 1').get();
  if (!checkLocker) {
    db.prepare(`
      INSERT INTO locker_status (id, state, last_action_by, last_action_at, servo_angle)
      VALUES (1, 'unknown', 'none', NULL, 0)
    `).run();
  }

  const checkSensors = db.prepare('SELECT id FROM sensors_status WHERE id = 1').get();
  if (!checkSensors) {
    db.prepare(`
      INSERT INTO sensors_status (
        id, parcel_present, parcel_source, ir_raw, ir_polarity, vibration_enabled,
        vibration_detected, vibration_raw, buzzer_active, total_deliveries, total_collections
      ) VALUES (1, 0, 'IR SENSOR', 1, 'active_low', 1, 0, 0, 0, 0, 0)
    `).run();
  }

  // Safe schema migrations for existing database columns
  try { db.exec("ALTER TABLE sensors_status ADD COLUMN parcel_source TEXT DEFAULT 'IR SENSOR';"); } catch (e) {}
  try { db.exec("ALTER TABLE sensors_status ADD COLUMN vibration_enabled INTEGER DEFAULT 1;"); } catch (e) {}
  try { db.exec("ALTER TABLE sensors_status ADD COLUMN vibration_raw INTEGER DEFAULT 0;"); } catch (e) {}
  try { db.exec("ALTER TABLE sensors_status ADD COLUMN last_manual_update_at DATETIME;"); } catch (e) {}
}

// Auto initialize on import
initDatabase();

export default db;
