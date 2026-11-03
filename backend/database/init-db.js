import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import db, { initDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

export async function ensureOwnerAccount() {
  initDatabase();

  const existingOwner = db.prepare('SELECT id, full_name, username, email, phone, password_hash FROM owners LIMIT 1').get();
  if (existingOwner) {
    console.log(`[DB] Existing owner found: ${existingOwner.username} (${existingOwner.email})`);

    const envPassword = process.env.INITIAL_OWNER_PASSWORD;
    const envUsername = process.env.INITIAL_OWNER_USERNAME;
    const envEmail = process.env.INITIAL_OWNER_EMAIL;
    const envPhone = process.env.INITIAL_OWNER_PHONE;
    const envName = process.env.INITIAL_OWNER_NAME;

    let needsUpdate = false;
    let newHash = existingOwner.password_hash;
    let targetUsername = existingOwner.username;
    let targetEmail = existingOwner.email;
    let targetFullName = existingOwner.full_name;
    let targetPhone = existingOwner.phone;

    if (envPassword) {
      const isMatch = await bcrypt.compare(envPassword, existingOwner.password_hash);
      if (!isMatch) {
        console.log(`[DB] Synchronizing owner password with INITIAL_OWNER_PASSWORD from .env...`);
        const salt = await bcrypt.genSalt(10);
        newHash = await bcrypt.hash(envPassword, salt);
        needsUpdate = true;
      }
    }

    if (envUsername && envUsername.trim().toLowerCase() !== (existingOwner.username || '').toLowerCase()) {
      targetUsername = envUsername.trim();
      needsUpdate = true;
    }

    if (envEmail && envEmail.trim().toLowerCase() !== (existingOwner.email || '').toLowerCase()) {
      targetEmail = envEmail.trim();
      needsUpdate = true;
    }

    if (envName && envName.trim() && envName.trim() !== existingOwner.full_name) {
      targetFullName = envName.trim();
      needsUpdate = true;
    }

    if (envPhone && envPhone.trim() && envPhone.trim() !== existingOwner.phone) {
      targetPhone = envPhone.trim();
      needsUpdate = true;
    }

    if (needsUpdate) {
      db.prepare(`
        UPDATE owners
        SET full_name = ?, username = ?, email = ?, phone = ?, password_hash = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(targetFullName, targetUsername, targetEmail, targetPhone, newHash, existingOwner.id);
      console.log(`[DB] Owner credentials successfully updated in database.`);
    }

    return db.prepare('SELECT id, full_name, username, email, phone FROM owners WHERE id = ?').get(existingOwner.id);
  }

  const username = process.env.INITIAL_OWNER_USERNAME || 'Jyotshna';
  const password = process.env.INITIAL_OWNER_PASSWORD || 'Jyotshna@12';
  const fullName = process.env.INITIAL_OWNER_NAME || 'Jyotshna';
  const email = process.env.INITIAL_OWNER_EMAIL || 'jyotshnachinnu4@gmail.com';
  const phone = process.env.INITIAL_OWNER_PHONE || '+91 80741 68658';

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const insert = db.prepare(`
    INSERT INTO owners (full_name, username, email, phone, password_hash)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = insert.run(fullName, username, email, phone, passwordHash);
  console.log(`[DB] Created initial owner account with ID ${result.lastInsertRowid}:`);
  console.log(`     Username: ${username}`);
  console.log(`     Password: [as configured in .env]`);
  console.log(`     Email:    ${email}`);

  // Log to activity
  db.prepare(`
    INSERT INTO activity_logs (event_type, event_title, description, status)
    VALUES (?, ?, ?, ?)
  `).run('auth', 'Initial Owner Created', `Owner account '${username}' provisioned via system initialization`, 'success');

  return { id: result.lastInsertRowid, username, email };
}

// Allow direct CLI execution: node backend/database/init-db.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ensureOwnerAccount().then(() => {
    console.log('[DB] Database setup and owner check complete.');
    process.exit(0);
  }).catch(err => {
    console.error('[DB] Error during database initialization:', err);
    process.exit(1);
  });
}
