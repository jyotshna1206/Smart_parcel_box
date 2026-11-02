import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database/db.js';
import { authenticateOwner } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { logActivity } from '../services/activityLogger.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/email and password are required.'
      });
    }

    const query = `
      SELECT id, full_name, username, email, phone, password_hash
      FROM owners
      WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
      LIMIT 1
    `;
    const owner = db.prepare(query).get(usernameOrEmail.trim(), usernameOrEmail.trim());

    if (!owner) {
      if (req.rateLimit) req.rateLimit.recordFailure();
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, owner.password_hash);
    if (!isMatch) {
      if (req.rateLimit) req.rateLimit.recordFailure();
      logActivity('auth', 'Failed Login Attempt', `Unsuccessful login attempt for user '${owner.username}'`, 'warning');
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password.'
      });
    }

    // Success - reset rate limiter
    if (req.rateLimit) req.rateLimit.recordSuccess();

    const secret = process.env.JWT_SECRET || 'fallback_secret_key_locker';
    const token = jwt.sign(
      { id: owner.id, username: owner.username, email: owner.email },
      secret,
      { expiresIn: '7d' }
    );

    logActivity('auth', 'Owner Login', `Owner '${owner.username}' logged into web dashboard`, 'success');

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      owner: {
        id: owner.id,
        fullName: owner.full_name,
        username: owner.username,
        email: owner.email,
        phone: owner.phone
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateOwner, (req, res) => {
  logActivity('auth', 'Owner Logout', `Owner '${req.owner.username}' logged out`, 'info');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', authenticateOwner, (req, res) => {
  return res.json({
    success: true,
    owner: {
      id: req.owner.id,
      fullName: req.owner.full_name,
      username: req.owner.username,
      email: req.owner.email,
      phone: req.owner.phone
    }
  });
});

export default router;
