import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Database & Services
import { ensureOwnerAccount } from './database/init-db.js';
import { startDeviceMonitor } from './services/deviceMonitor.js';
import { startReminderService } from './services/reminderService.js';

// Route Handlers
import authRoutes from './routes/authRoutes.js';
import ownerRoutes from './routes/ownerRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import lockerRoutes from './routes/lockerRoutes.js';
import accessRoutes from './routes/accessRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import parcelRoutes from './routes/parcelRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow frontend and ESP32
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Token']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for rate limiting behind reverse proxies / LAN routers
app.set('trust proxy', 1);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/locker', lockerRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/parcels', parcelRoutes);
app.use('/api/alerts', securityRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/device', deviceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Initialize database & start server (reloaded)
async function startServer() {
  try {
    await ensureOwnerAccount();
    startDeviceMonitor(5000); // Check ESP32 heartbeat every 5s
    startReminderService(10000); // Check 2-hour reminders every 10s

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n======================================================`);
      console.log(`  SMART PACKAGE LOCKER - BACKEND SERVER RUNNING`);
      console.log(`  Local:            http://localhost:${PORT}`);
      console.log(`  Network (0.0.0.0): Available to ESP32 on port ${PORT}`);
      console.log(`  Owner Portal API: http://localhost:${PORT}/api/auth`);
      console.log(`  Device API:       http://localhost:${PORT}/api/device`);
      console.log(`  Public Delivery:  http://localhost:${PORT}/api/public`);
      console.log(`======================================================\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
