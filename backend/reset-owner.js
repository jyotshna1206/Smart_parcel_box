import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import db from './database/db.js';
import { logActivity } from './services/activityLogger.js';

// Interactive prompt helper (plain text)
function askQuestion(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Secure masked password prompt helper (masks characters with '*')
function askHidden(query) {
  return new Promise((resolve) => {
    // If standard interactive TTY terminal is available
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      process.stdout.write(query);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      let password = '';
      const onData = (ch) => {
        // Enter / Return
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
        } else if (ch === '\u0003') {
          // Ctrl+C
          process.stdout.write('\nOperation cancelled by user.\n');
          try { db.close(); } catch (e) {}
          process.exit(1);
        } else if (ch === '\u0008' || ch === '\x7f') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          password += ch;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    } else {
      // Non-TTY / Piped input fallback: mute output to prevent password leakage
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const originalWrite = process.stdout.write.bind(process.stdout);
      originalWrite(query);

      // Mute stdout while user types
      process.stdout.write = (chunk, encoding, callback) => {
        if (typeof callback === 'function') callback();
        return true;
      };

      rl.question('', (answer) => {
        process.stdout.write = originalWrite;
        process.stdout.write('\n');
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function resetOwner() {
  console.log('\n======================================================');
  console.log('  SMART PACKAGE LOCKER — OWNER CREDENTIALS RESET TOOL');
  console.log('======================================================\n');

  try {
    // 1. Fetch existing owner record
    const existingOwner = db.prepare('SELECT id, full_name, username, email FROM owners ORDER BY id ASC LIMIT 1').get();

    if (!existingOwner) {
      console.error('[Error] No owner account found in database to update.');
      console.log('Run "npm run init-db" first to initialize the database and seed the initial owner.');
      try { db.close(); } catch (e) {}
      process.exit(1);
    }

    console.log(`Current Owner Account (ID: ${existingOwner.id}):`);
    console.log(`  Full Name: ${existingOwner.full_name}`);
    console.log(`  Username:  ${existingOwner.username}`);
    console.log(`  Email:     ${existingOwner.email}\n`);
    console.log('Please enter the new credentials below:\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // 2. Prompt for new username
    const usernamePrompt = `New Username [Press Enter to keep '${existingOwner.username}']: `;
    const inputUsername = await askQuestion(rl, usernamePrompt);
    const newUsername = inputUsername || existingOwner.username;

    // 3. Prompt for new email
    const emailPrompt = `New Email [Press Enter to keep '${existingOwner.email}']: `;
    const inputEmail = await askQuestion(rl, emailPrompt);
    const newEmail = inputEmail || existingOwner.email;

    // Validate email format basic check
    if (!newEmail.includes('@') || !newEmail.includes('.')) {
      console.error('\n[Error] Invalid email format. Operation aborted.');
      rl.close();
      try { db.close(); } catch (e) {}
      process.exit(1);
    }

    // Close line interface before asking hidden password
    rl.close();

    // 4. Prompt for new password (masked/hidden)
    const newPassword = await askHidden('New Password (min 8 characters): ');

    if (!newPassword || newPassword.length < 8) {
      console.error('\n[Error] Password must be at least 8 characters long. Operation aborted.');
      try { db.close(); } catch (e) {}
      process.exit(1);
    }

    // 5. Confirm new password (masked/hidden)
    const confirmPassword = await askHidden('Confirm New Password: ');

    if (newPassword !== confirmPassword) {
      console.error('\n[Error] Passwords do not match. Operation aborted.');
      try { db.close(); } catch (e) {}
      process.exit(1);
    }

    // 6. Check for duplicate username/email conflicts with other accounts if any
    const conflictCheck = db.prepare(`
      SELECT id FROM owners
      WHERE (username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE) AND id != ?
      LIMIT 1
    `).get(newUsername, newEmail, existingOwner.id);

    if (conflictCheck) {
      console.error(`\n[Error] Username '${newUsername}' or Email '${newEmail}' is already assigned to another account.`);
      try { db.close(); } catch (e) {}
      process.exit(1);
    }

    console.log('\nHashing password securely with bcrypt (10 salt rounds)...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 7. Update existing owner record in SQLite database
    const updateStmt = db.prepare(`
      UPDATE owners
      SET username = ?,
          email = ?,
          password_hash = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);

    const updateResult = updateStmt.run(newUsername, newEmail, passwordHash, existingOwner.id);

    if (updateResult.changes === 0) {
      console.error('\n[Error] Database update failed. No rows were modified.');
      try { db.close(); } catch (e) {}
      process.exit(1);
    }

    // 8. Re-fetch and verify the update
    const verifiedOwner = db.prepare('SELECT id, username, email, password_hash, updated_at FROM owners WHERE id = ?').get(existingOwner.id);

    if (!verifiedOwner) {
      console.error('\n[Error] Failed to re-fetch updated owner record.');
      try { db.close(); } catch (e) {}
      process.exit(1);
    }

    const isMatch = await bcrypt.compare(newPassword, verifiedOwner.password_hash);

    if (!isMatch) {
      console.error('\n[Critical Error] Password verification failed after database update!');
      try { db.close(); } catch (e) {}
      process.exit(1);
    }

    // 9. Record to activity log
    logActivity(
      'auth',
      'Owner Credentials Reset via CLI',
      `Owner account credentials (ID: ${existingOwner.id}, username: '${newUsername}') were reset via CLI reset-owner utility`,
      'warning'
    );

    console.log('\n======================================================');
    console.log('  CREDENTIALS RESET SUCCESSFULLY & VERIFIED!          ');
    console.log('======================================================');
    console.log(`  Account ID:    ${verifiedOwner.id}`);
    console.log(`  New Username:  ${verifiedOwner.username}`);
    console.log(`  New Email:     ${verifiedOwner.email}`);
    console.log(`  Password:      [Secured with Bcrypt Hash: Verified ✓]`);
    console.log(`  Updated At:    ${verifiedOwner.updated_at}`);
    console.log('======================================================');
    console.log('\nYou can now log in to the web dashboard at:');
    console.log('  http://localhost:5173/login');
    console.log(`  Username or Email: ${verifiedOwner.username} (or ${verifiedOwner.email})`);
    console.log('  Password:          [the password you just configured]\n');

  } catch (err) {
    console.error('\n[Fatal Error] An unexpected error occurred during credentials reset:', err.message);
    process.exit(1);
  } finally {
    // 10. Close SQLite database connection
    try {
      db.close();
    } catch (e) {
      // Ignore if already closed
    }
  }
}

resetOwner();
