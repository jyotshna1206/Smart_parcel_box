import express from 'express';
import db from '../database/db.js';
import { authenticateOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/history
router.get('/', authenticateOwner, (req, res) => {
  try {
    const { eventType, search, startDate, endDate, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (eventType && eventType !== 'all') {
      conditions.push('event_type = ?');
      params.push(eventType);
    }

    if (search && search.trim()) {
      conditions.push('(event_title LIKE ? OR description LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (startDate) {
      conditions.push('date(created_at) >= date(?)');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('date(created_at) <= date(?)');
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM activity_logs ${whereClause}`;
    const total = db.prepare(countQuery).get(...params).total;

    const query = `
      SELECT id, event_type, event_title, description, status, created_at
      FROM activity_logs
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;

    const logs = db.prepare(query).all(...params, limitNum, offset);

    return res.json({
      success: true,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (err) {
    console.error('[History] Fetch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve activity history.' });
  }
});

export default router;
