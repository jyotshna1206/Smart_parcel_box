import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { authenticateOwner } from '../middleware/auth.js';
import { logActivity } from '../services/activityLogger.js';

const router = express.Router();

// GET /api/owner/profile
router.get('/profile', authenticateOwner, (req, res) => {
  const owner = db.prepare('SELECT id, full_name, username, email, phone, created_at, updated_at FROM owners WHERE id = ?').get(req.owner.id);
  if (!owner) {
    return res.status(404).json({ success: false, message: 'Owner profile not found.' });
  }

  return res.json({
    success: true,
    owner: {
      id: owner.id,
      fullName: owner.full_name,
      username: owner.username,
      email: owner.email,
      phone: owner.phone,
      createdAt: owner.created_at,
      updatedAt: owner.updated_at
    }
  });
});

// PUT /api/owner/profile
router.put('/profile', authenticateOwner, (req, res) => {
  try {
    const { fullName, username, email, phone } = req.body;

    if (!fullName || !username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Full name, username, and email are required.'
      });
    }

    // Check if new username or email is already taken by another owner
    const existing = db.prepare(`
      SELECT id FROM owners
      WHERE (username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE) AND id != ?
      LIMIT 1
    `).get(username.trim(), email.trim(), req.owner.id);

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already in use.'
      });
    }

    db.prepare(`
      UPDATE owners
      SET full_name = ?, username = ?, email = ?, phone = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(fullName.trim(), username.trim(), email.trim(), (phone || '').trim(), req.owner.id);

    logActivity('auth', 'Profile Updated', `Owner profile updated for '${username}'`, 'success');

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      owner: {
        id: req.owner.id,
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        phone: (phone || '').trim()
      }
    });
  } catch (err) {
    console.error('[OwnerProfile] Update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// PUT /api/owner/password
router.put('/password', authenticateOwner, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirmation are required.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match.'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long.'
      });
    }

    // Fetch current owner hash
    const owner = db.prepare('SELECT password_hash FROM owners WHERE id = ?').get(req.owner.id);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, owner.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    db.prepare(`
      UPDATE owners
      SET password_hash = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newHash, req.owner.id);

    logActivity('auth', 'Password Changed', `Owner '${req.owner.username}' changed their account password`, 'success');

    return res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err) {
    console.error('[OwnerPassword] Error changing password:', err);
    return res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

export default router;
