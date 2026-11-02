// In-memory sliding window rate limiter
const attemptsStore = new Map();

/**
 * Creates an IP-based rate limiter middleware
 * @param {object} options
 * @param {number} options.maxAttempts - Maximum allowed failed attempts
 * @param {number} options.windowMs - Time window in milliseconds (e.g. 10 mins)
 * @param {number} options.lockoutMs - Lockout duration in milliseconds (e.g. 15 mins)
 * @param {string} options.message - Error message shown when locked out
 */
export function createRateLimiter({
  maxAttempts = 5,
  windowMs = 10 * 60 * 1000,
  lockoutMs = 15 * 60 * 1000,
  message = 'Too many failed attempts. Temporary lockout in effect. Please try again later.'
} = {}) {
  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown-ip';
    const now = Date.now();
    const record = attemptsStore.get(ip);

    if (record) {
      // Check if currently locked out
      if (record.lockedUntil && now < record.lockedUntil) {
        const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
        return res.status(429).json({
          success: false,
          error: `${message} (${remainingMinutes} min remaining)`,
          lockedOut: true,
          remainingMinutes
        });
      }

      // Reset if window has expired
      if (now - record.firstAttemptAt > windowMs) {
        attemptsStore.set(ip, { count: 0, firstAttemptAt: now, lockedUntil: 0 });
      }
    } else {
      attemptsStore.set(ip, { count: 0, firstAttemptAt: now, lockedUntil: 0 });
    }

    // Attach tracker functions to request
    req.rateLimit = {
      recordFailure: () => {
        const current = attemptsStore.get(ip) || { count: 0, firstAttemptAt: now, lockedUntil: 0 };
        current.count += 1;
        if (current.count >= maxAttempts) {
          current.lockedUntil = now + lockoutMs;
        }
        attemptsStore.set(ip, current);
      },
      recordSuccess: () => {
        attemptsStore.delete(ip);
      }
    };

    next();
  };
}

// Pre-configured rate limiters
export const pinVerificationLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 10 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
  message: 'Security lockout: Too many incorrect PIN attempts from this network.'
});

export const loginLimiter = createRateLimiter({
  maxAttempts: 6,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
  message: 'Security lockout: Too many failed login attempts.'
});
