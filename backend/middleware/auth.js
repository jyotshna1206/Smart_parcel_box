import jwt from 'jsonwebtoken';
import db from '../database/db.js';

export function authenticateOwner(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. No token provided.'
    });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'fallback_secret_key_locker';

  try {
    const decoded = jwt.verify(token, secret);
    const owner = db.prepare('SELECT id, full_name, username, email, phone FROM owners WHERE id = ?').get(decoded.id);

    if (!owner) {
      return res.status(401).json({
        success: false,
        message: 'Owner account not found or has been deactivated.'
      });
    }

    req.owner = owner;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session token. Please log in again.'
    });
  }
}
