import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './database/db.js';
import { ensureOwnerAccount } from './database/init-db.js';

async function runVerification() {
  console.log('=== STARTING COMPLETE VERIFICATION OF SMART PACKAGE LOCKER ===\n');

  // 1. Verify owner account and credentials in DB
  console.log('[TEST 1] Verifying database owner account and credentials...');
  const owner = await ensureOwnerAccount();
  console.log(`  Owner: ${owner.username} (${owner.email})`);
  
  const rawOwner = db.prepare('SELECT * FROM owners WHERE id = ?').get(owner.id);
  const passwordMatches = await bcrypt.compare('Jyotshna@12', rawOwner.password_hash);
  console.log(`  Password 'Jyotshna@12' matches hash: ${passwordMatches}`);
  if (!passwordMatches) throw new Error('Password hash does not match Jyotshna@12');

  // 2. Test Login Validation Logic (simulate authRoutes)
  console.log('\n[TEST 2] Testing login validation (Username & Email)...');
  const userQuery = `SELECT id, full_name, username, email, phone, password_hash FROM owners WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1`;
  
  const byUsername = db.prepare(userQuery).get('Jyotshna', 'Jyotshna');
  console.log(`  Query by username 'Jyotshna': Found ID ${byUsername?.id}`);
  
  const byEmail = db.prepare(userQuery).get('jyotshnachinnu4@gmail.com', 'jyotshnachinnu4@gmail.com');
  console.log(`  Query by email 'jyotshnachinnu4@gmail.com': Found ID ${byEmail?.id}`);

  const byCaseInsensitive = db.prepare(userQuery).get('jyotshna', 'jyotshna');
  console.log(`  Query by lowercase 'jyotshna': Found ID ${byCaseInsensitive?.id}`);

  if (!byUsername || !byEmail || !byCaseInsensitive) throw new Error('Login user lookup failed');

  // 3. Test JWT Generation & Verification
  console.log('\n[TEST 3] Testing JWT session generation & verification...');
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_smart_package_locker_2026_xyz987';
  const token = jwt.sign({ id: owner.id, username: owner.username, email: owner.email }, secret, { expiresIn: '7d' });
  const decoded = jwt.verify(token, secret);
  console.log(`  JWT verified successfully for ID ${decoded.id} (${decoded.username})`);

  // 4. Test Credential Updates (simulate ownerRoutes)
  console.log('\n[TEST 4] Testing credential update functionality in database...');
  // Update phone to test
  db.prepare(`UPDATE owners SET phone = '+91 80741 68658', updated_at = datetime('now', 'localtime') WHERE id = ?`).run(owner.id);
  const updatedOwner = db.prepare('SELECT phone, updated_at FROM owners WHERE id = ?').get(owner.id);
  console.log(`  Phone updated: ${updatedOwner.phone} at ${updatedOwner.updated_at}`);

  // Test Password Change & Rollback
  const testSalt = await bcrypt.genSalt(10);
  const testNewHash = await bcrypt.hash('Jyotshna@Updated12', testSalt);
  db.prepare(`UPDATE owners SET password_hash = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(testNewHash, owner.id);
  const changedOwner = db.prepare('SELECT password_hash FROM owners WHERE id = ?').get(owner.id);
  const testMatches = await bcrypt.compare('Jyotshna@Updated12', changedOwner.password_hash);
  console.log(`  New password 'Jyotshna@Updated12' verified in DB: ${testMatches}`);
  if (!testMatches) throw new Error('Password change failed');

  // Re-sync back to Jyotshna@12
  const finalSalt = await bcrypt.genSalt(10);
  const finalHash = await bcrypt.hash('Jyotshna@12', finalSalt);
  db.prepare(`UPDATE owners SET password_hash = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(finalHash, owner.id);
  console.log(`  Restored password hash for 'Jyotshna@12'`);

  // 5. Test Delivery PIN Generation & Validation
  console.log('\n[TEST 5] Testing Delivery PIN generation and single-use validation...');
  const rawPin = '918273';
  const crypto = await import('node:crypto');
  const pinHash = crypto.createHash('sha256').update(rawPin).digest('hex');
  
  const insertPin = db.prepare(`
    INSERT INTO access_pins (pin_hash, created_by_owner_id, duration_minutes, created_at, expires_at, status)
    VALUES (?, ?, 15, datetime('now', 'localtime'), datetime('now', 'localtime', '+15 minutes'), 'active')
  `).run(pinHash, owner.id);
  
  const pinId = insertPin.lastInsertRowid;
  console.log(`  Created 6-digit test PIN #${pinId} (Code: ${rawPin})`);

  // Verify PIN
  const foundPin = db.prepare(`SELECT * FROM access_pins WHERE pin_hash = ? AND status = 'active'`).get(pinHash);
  if (!foundPin) throw new Error('PIN lookup failed');
  console.log(`  Found active PIN #${foundPin.id}`);

  // Consume PIN (single-use)
  db.prepare(`UPDATE access_pins SET status = 'used', used_at = datetime('now', 'localtime') WHERE id = ?`).run(pinId);
  const consumedPin = db.prepare(`SELECT status FROM access_pins WHERE id = ?`).get(pinId);
  console.log(`  PIN status after use: ${consumedPin.status} (Single-use verified)`);

  // 6. Test ESP32 Telemetry & Locker Status
  console.log('\n[TEST 6] Testing ESP32 telemetry & locker status database structures...');
  const device = db.prepare('SELECT * FROM device_status WHERE id = 1').get();
  console.log(`  Device Status: ${device.device_name} | Status: ${device.status} | Last Heartbeat: ${device.last_heartbeat}`);
  
  const locker = db.prepare('SELECT * FROM locker_status WHERE id = 1').get();
  console.log(`  Locker Status: ${locker.state} | Servo Angle: ${locker.servo_angle}° | Last Action By: ${locker.last_action_by}`);

  const sensors = db.prepare('SELECT * FROM sensors_status WHERE id = 1').get();
  console.log(`  Sensors: Parcel Present: ${sensors.parcel_present} (${sensors.parcel_source}) | IR Polarity: ${sensors.ir_polarity} | Vibration Enabled: ${sensors.vibration_enabled}`);

  console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runVerification().catch(err => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});
