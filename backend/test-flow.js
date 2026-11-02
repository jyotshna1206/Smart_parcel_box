import http from 'node:http';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 5000;
const DEVICE_TOKEN = process.env.DEVICE_AUTH_TOKEN || 'esp32_smart_locker_secure_token_982341';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE SMART LOCKER INTEGRATION TESTS ---');

  // 1. Health check
  console.log('\n[TEST 1] GET /api/health');
  const health = await request('GET', '/api/health');
  console.log('Result:', health.status, health.data);
  if (health.status !== 200) throw new Error('Health check failed');

  // 2. Owner Login
  console.log('\n[TEST 2] POST /api/auth/login');
  const login = await request('POST', '/api/auth/login', {
    usernameOrEmail: process.env.INITIAL_OWNER_USERNAME || 'Jyotshna',
    password: process.env.INITIAL_OWNER_PASSWORD || 'Jyotshna@12'
  });
  console.log('Result:', login.status, 'Token acquired:', Boolean(login.data.token));
  if (login.status !== 200 || !login.data.token) throw new Error('Owner login failed');
  const ownerToken = login.data.token;

  // 3. Authenticated Dashboard Telemetry
  console.log('\n[TEST 3] GET /api/dashboard');
  const dash = await request('GET', '/api/dashboard', null, { Authorization: `Bearer ${ownerToken}` });
  console.log('Result:', dash.status, 'Device Status:', dash.data.data.device.status, 'Locker:', dash.data.data.locker.state);
  if (dash.status !== 200) throw new Error('Dashboard fetch failed');

  // 4. ESP32 Heartbeat
  console.log('\n[TEST 4] POST /api/device/heartbeat');
  const hb = await request('POST', '/api/device/heartbeat', {
    firmware: 'v2.0.0-test',
    rssi: -55,
    ip: '192.168.1.105'
  }, { 'X-Device-Token': DEVICE_TOKEN });
  console.log('Result:', hb.status, hb.data);
  if (hb.status !== 200) throw new Error('ESP32 Heartbeat failed');

  // Verify dashboard now reports ONLINE
  const dash2 = await request('GET', '/api/dashboard', null, { Authorization: `Bearer ${ownerToken}` });
  console.log('Post-heartbeat device status:', dash2.data.data.device.status);
  if (dash2.data.data.device.status !== 'online') throw new Error('Device should be reported online');

  // 5. Generate Access PIN
  console.log('\n[TEST 5] POST /api/access/generate-pin');
  const genPin = await request('POST', '/api/access/generate-pin', { durationMinutes: 30 }, { Authorization: `Bearer ${ownerToken}` });
  console.log('Result:', genPin.status, 'PIN created:', genPin.data.pin?.id, 'Raw PIN revealed once:', genPin.data.pin?.rawPin);
  if (genPin.status !== 200 || !genPin.data.pin?.rawPin) throw new Error('PIN generation failed');
  const rawPin = genPin.data.pin.rawPin;

  // 6. Public Courier Verify PIN (without login credentials)
  console.log('\n[TEST 6] POST /api/public/verify-pin');
  // First test invalid PIN
  const invalidPinRes = await request('POST', '/api/public/verify-pin', { pinCode: '000000' });
  console.log('Invalid PIN response:', invalidPinRes.status, invalidPinRes.data);
  if (invalidPinRes.status !== 400) throw new Error('Invalid PIN should return 400');

  // Now test valid PIN
  const validPinRes = await request('POST', '/api/public/verify-pin', { pinCode: rawPin });
  console.log('Valid PIN response:', validPinRes.status, validPinRes.data);
  if (validPinRes.status !== 200) throw new Error('Valid PIN verification failed');
  const commandId = validPinRes.data.commandId;

  // 7. Re-use same PIN (should be rejected as single-use)
  console.log('\n[TEST 7] Single-use Rejection Check:');
  const reusePinRes = await request('POST', '/api/public/verify-pin', { pinCode: rawPin });
  console.log('Reuse PIN response:', reusePinRes.status, reusePinRes.data);
  if (reusePinRes.status !== 400 || !reusePinRes.data.error.includes('already been used')) {
    throw new Error('PIN re-use was not blocked!');
  }
  console.log('Atomic single-use protection verified successfully.');

  // 8. ESP32 Polls for queued commands
  console.log('\n[TEST 8] GET /api/device/commands (ESP32 Poll)');
  const cmds = await request('GET', '/api/device/commands', null, { 'X-Device-Token': DEVICE_TOKEN });
  console.log('Result:', cmds.status, 'Pending commands count:', cmds.data.commands?.length);
  const unlockCmd = cmds.data.commands?.find(c => c.id === commandId);
  console.log('Found queued unlock command:', unlockCmd);
  if (!unlockCmd) throw new Error('Queued unlock command not found in device poll');

  // 9. ESP32 reports execution result
  console.log('\n[TEST 9] POST /api/device/command-result');
  const report = await request('POST', '/api/device/command-result', {
    commandId,
    status: 'executed',
    angle: 90
  }, { 'X-Device-Token': DEVICE_TOKEN });
  console.log('Result:', report.status, report.data);

  // Verify locker state is now UNLOCKED
  const lockerStatusRes = await request('GET', '/api/locker/status', null, { Authorization: `Bearer ${ownerToken}` });
  console.log('Confirmed physical locker state:', lockerStatusRes.data.locker.state);
  if (lockerStatusRes.data.locker.state !== 'unlocked') throw new Error('Locker state was not updated after ESP32 confirmation');

  // 10. ESP32 reports IR Sensor: Parcel Placement
  console.log('\n[TEST 10] POST /api/device/sensor-update (Parcel Placement: IR 0)');
  const sensorUpdate = await request('POST', '/api/device/sensor-update', {
    ir_raw: 0, // 0 = parcel present (active low)
    vibration: 0
  }, { 'X-Device-Token': DEVICE_TOKEN });
  console.log('Sensor update response:', sensorUpdate.status, sensorUpdate.data);

  // Check that 2-hour reminder and parcel status are active
  const parcelStatus = await request('GET', '/api/parcels/status', null, { Authorization: `Bearer ${ownerToken}` });
  console.log('Parcel status:', parcelStatus.data.parcel.present, 'Deliveries:', parcelStatus.data.parcel.totalDeliveries);
  if (!parcelStatus.data.parcel.present) throw new Error('Parcel should be detected present');

  // 11. ESP32 reports Vibration Sensor: Tampering Alert
  console.log('\n[TEST 11] POST /api/device/sensor-update (Vibration Tamper: 1)');
  const vibUpdate = await request('POST', '/api/device/sensor-update', {
    ir_raw: 0,
    vibration: 1
  }, { 'X-Device-Token': DEVICE_TOKEN });
  console.log('Vibration update response:', vibUpdate.status, vibUpdate.data);

  // Check alert list
  const alertsRes = await request('GET', '/api/alerts', null, { Authorization: `Bearer ${ownerToken}` });
  console.log('Alerts count:', alertsRes.data.alerts.length, 'Latest alert:', alertsRes.data.alerts[0]?.alert_type);
  if (alertsRes.data.alerts.length === 0) throw new Error('Security alert was not logged');

  // 12. Owner Acknowledges Security Alert
  const latestAlertId = alertsRes.data.alerts[0].id;
  console.log('\n[TEST 12] POST /api/alerts/' + latestAlertId + '/acknowledge');
  const ackRes = await request('POST', `/api/alerts/${latestAlertId}/acknowledge`, {}, { Authorization: `Bearer ${ownerToken}` });
  console.log('Ack response:', ackRes.status, ackRes.data);
  if (ackRes.status !== 200) throw new Error('Alert acknowledgement failed');

  // 13. Audited Activity History check
  console.log('\n[TEST 13] GET /api/history');
  const historyRes = await request('GET', '/api/history', null, { Authorization: `Bearer ${ownerToken}` });
  console.log('History entries count:', historyRes.data.logs.length);
  if (historyRes.data.logs.length < 5) throw new Error('Activity history log count too low');

  console.log('\n======================================================');
  console.log('  ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!     ');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\nIntegration test failed:', err);
  process.exit(1);
});
