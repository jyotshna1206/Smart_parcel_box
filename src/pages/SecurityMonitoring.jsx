import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
  Radio,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Bell,
  Cpu,
  Power,
  Lock,
  Unlock
} from 'lucide-react';
import api from '../services/api';
import { useLocker } from '../context/LockerContext';

export default function SecurityMonitoring() {
  const { dashboardData, refreshDashboard } = useLocker();

  const [alerts, setAlerts] = useState([]);
  const [sensorState, setSensorState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [togglingVibration, setTogglingVibration] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);

  const fetchAlerts = async () => {
    try {
      const res = await api.getSecurityAlerts();
      if (res.success) {
        setAlerts(res.alerts || []);
        setSensorState(res.currentSensorState || null);
      }
    } catch (err) {
      console.error('Failed to fetch security alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (alertId) => {
    setAcknowledgingId(alertId);
    try {
      await api.acknowledgeAlert(alertId);
      await fetchAlerts();
      await refreshDashboard();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleToggleVibration = async (targetState) => {
    setTogglingVibration(true);
    setStatusFeedback(null);
    try {
      const res = await api.setVibrationControl(targetState);
      if (res.success) {
        setStatusFeedback({
          type: 'success',
          text: res.message || `Vibration detection successfully switched ${targetState ? 'ON' : 'OFF'}.`
        });
        await fetchAlerts();
        await refreshDashboard();
      }
    } catch (err) {
      setStatusFeedback({
        type: 'error',
        text: err.message || 'Failed to update vibration detection setting.'
      });
    } finally {
      setTogglingVibration(false);
    }
  };

  const isVibrationEnabled = sensorState?.vibrationEnabled !== false;
  const isVibrating = sensorState?.vibrationDetected && isVibrationEnabled;
  const rawVib = sensorState?.vibrationRaw ?? 0;
  const isBuzzerActive = sensorState?.buzzerActive;
  const unackCount = alerts.filter(a => !a.acknowledged).length;

  const device = dashboardData?.device;
  const isOnline = device?.status === 'online';
  const servoStatus = dashboardData?.locker?.servoStatus || (dashboardData?.locker?.state === 'unlocked' ? 'UNLOCKED' : 'LOCKED');

  const formatTime = (ts) => {
    if (!ts) return 'Not Available';
    try {
      return new Date(ts).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return ts;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Security & Tamper Monitoring
            </h2>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              servoStatus === 'UNLOCKED'
                ? 'bg-amber-100 text-amber-800'
                : servoStatus === 'UNLOCKING'
                ? 'bg-amber-100 text-amber-800 animate-pulse'
                : 'bg-blue-100 text-blue-800'
            }`}>
              Servo: {servoStatus}
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              isOnline
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              Device: {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real SW-420 vibration sensor telemetry (GPIO 21), physical buzzer alerts (GPIO 22), and tamper protection controls.
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Feedback Banner */}
      {statusFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{statusFeedback.text}</span>
          <button onClick={() => setStatusFeedback(null)} className="font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Main Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Vibration Tamper State */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-500 font-semibold">
              Vibration Sensor (SW-420)
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                !isVibrationEnabled
                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                  : isVibrating
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {!isVibrationEnabled ? 'DISABLED' : isVibrating ? 'TAMPERING' : 'CALM / SECURE'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                !isVibrationEnabled
                  ? 'bg-slate-100 text-slate-500'
                  : isVibrating
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              {isVibrating ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">
                {!isVibrationEnabled
                  ? 'Monitoring OFF'
                  : isVibrating
                  ? 'Vibration Detected!'
                  : 'No Tampering'}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Pin: GPIO 21 &bull; Raw Reading: {rawVib}
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Physical Hardware Buzzer State */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-500 font-semibold">
              Physical Hardware Buzzer
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isBuzzerActive
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {isBuzzerActive ? 'SOUNDING' : 'IDLE'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                isBuzzerActive ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isBuzzerActive ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">
                {isBuzzerActive ? 'Alarm Sounding' : 'Buzzer Silenced'}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Pin: GPIO 22 &bull; Hardware Controlled
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Unacknowledged Security Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-500 font-semibold">
              Pending Alerts
            </span>
            <Bell className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-sans">
            {unackCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {unackCount > 0 ? 'Requires owner acknowledgement below' : 'All security events acknowledged'}
          </p>
        </div>
      </div>

      {/* Section: Vibration Detection ON/OFF Control Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Power className={`w-5 h-5 ${isVibrationEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
            <h3 className="text-sm font-bold text-slate-900">Vibration Detection Sensor Switch</h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              isVibrationEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {isVibrationEnabled ? 'SWITCH: ON' : 'SWITCH: OFF'}
            </span>
          </div>
          <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
            When <strong>OFF</strong>, vibration readings are ignored and neither buzzer alarms nor tamper records will trigger. When <strong>ON</strong>, the SW-420 sensor actively monitors GPIO 21 and sounds the 12-second tamper buzzer alarm upon shock detection. Setting synchronizes immediately with the ESP32.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleToggleVibration(true)}
            disabled={togglingVibration || isVibrationEnabled}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              isVibrationEnabled
                ? 'bg-emerald-600 text-white shadow-xs cursor-default'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Turn ON</span>
          </button>

          <button
            onClick={() => handleToggleVibration(false)}
            disabled={togglingVibration || !isVibrationEnabled}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              !isVibrationEnabled
                ? 'bg-rose-600 text-white shadow-xs cursor-default'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>Turn OFF</span>
          </button>
        </div>
      </div>

      {/* Hardware Telemetry Bar */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-4 flex-wrap font-mono text-[11px]">
          <span>Hardware: <strong className="text-slate-800">ESP32 DevKit V1</strong></span>
          <span>&bull;</span>
          <span>Last Comm: <strong className="text-slate-800">{formatTime(device?.lastHeartbeat)}</strong></span>
          <span>&bull;</span>
          <span>Raw SW-420 Pin: <strong className="text-slate-800">{rawVib}</strong></span>
        </div>
        <span className="text-[11px] text-slate-500 font-sans">
          Persisted in backend database & synchronized via HTTP keepalive.
        </span>
      </div>

      {/* Security Alerts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Audited Security Alert Records</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {alerts.length} Incidents
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No security incidents or tamper alerts recorded.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition ${
                  alert.acknowledged ? 'bg-white' : 'bg-rose-50/60'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        alert.alert_type === 'tampering'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {alert.alert_type}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Incident #{alert.id} &bull; {formatTime(alert.created_at)}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    {alert.description}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {alert.acknowledged
                      ? `Acknowledged by ${alert.acknowledged_by || 'owner'} at ${formatTime(alert.acknowledged_at)}`
                      : 'Unacknowledged security alert — requires review'}
                  </p>
                </div>

                {!alert.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledgingId === alert.id}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{acknowledgingId === alert.id ? 'Saving...' : 'Acknowledge'}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
