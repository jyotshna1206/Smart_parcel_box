export function authenticateDevice(req, res, next) {
  const token = req.headers['x-device-token'] || req.query.token;
  const expectedToken = process.env.DEVICE_AUTH_TOKEN || 'esp32_smart_locker_secure_token_982341';

  if (!token || token !== expectedToken) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized device. Invalid or missing X-Device-Token header.'
    });
  }

  next();
}
