import React, { useState } from 'react';
import {
  Radio,
  Lock,
  Unlock,
  Package,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Activity,
  RefreshCw,
  Cpu,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocker } from '../context/LockerContext';
import api from '../services/api';
import ConfirmationModal from '../components/common/ConfirmationModal';

export default function Dashboard() {
  const { dashboardData, refreshDashboard } = useLocker();

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    action: null,
    title: '',
    message: '',
    type: 'primary',
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);

  const device = dashboardData?.device;
  const locker = dashboardData?.locker;
  const parcel = dashboardData?.parcel;
  const sensors = dashboardData?.sensors;
  const security = dashboardData?.security;
  const reminder = dashboardData?.reminder;
  const recentActivities = dashboardData?.recentActivities || [];
  const recentAlerts = security?.recentAlerts || [];

  const isOnline = device?.status === 'online';

  // Format timestamp helper
  const formatTime = (ts) => {
    if (!ts) return 'Not Available';
    try {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? ts : d.toLocaleString([], {
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

  // Handle Quick Actuator Lock/Unlock & Manual Parcel IN/OUT
  const handleActuatorConfirm = async () => {
    const action = confirmModal.action;
    setConfirmModal({ ...confirmModal, isOpen: false });
    setActionLoading(true);
    setActionStatus(null);

    try {
      if (action === 'LOCK') {
        const res = await api.lockLocker();
        setActionStatus({ success: true, message: res.message });
      } else if (action === 'UNLOCK') {
        const res = await api.unlockLocker();
        setActionStatus({ success: true, message: res.message });
      } else if (action === 'PARCEL_IN') {
        const res = await api.setParcelIn();
        setActionStatus({ success: true, message: res.message });
      } else if (action === 'PARCEL_OUT') {
        const res = await api.setParcelOut();
        setActionStatus({ success: true, message: res.message });
      }
      await refreshDashboard();
    } catch (err) {
      setActionStatus({ success: false, message: err.message || 'Operation failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Acknowledge an alert directly
  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await api.acknowledgeAlert(alertId);
      await refreshDashboard();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Device Connection Alert if Offline */}
      {!isOnline && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start sm:items-center justify-between gap-4 text-rose-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-xl text-rose-600">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold">ESP32 Hardware Disconnected (OFFLINE)</h4>
              <p className="text-xs text-rose-700 mt-0.5">
                The smart locker microcontroller is currently offline. Actuator commands will queue on the server until the ESP32 reconnects over Wi-Fi.
              </p>
            </div>
          </div>
          <button
            onClick={refreshDashboard}
            className="shrink-0 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-xl transition"
          >
            Check Status
          </button>
        </div>
      )}

      {/* Top Banner: Active 2-Hour Pickup Reminder */}
      {reminder && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start sm:items-center justify-between gap-4 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
              <Clock className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold">Active Parcel Pickup Window</h4>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-200 text-amber-800">
                  {reminder.remainingMinutes}m remaining
                </span>
              </div>
              <p className="text-xs text-amber-700 mt-0.5">
                A parcel was delivered and is waiting in the locker compartment. Target pickup window ends at {formatTime(reminder.targetTime)}.
              </p>
            </div>
          </div>
          <Link
            to="/parcel-monitoring"
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <span>View Parcel</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Action Status Feedback */}
      {actionStatus && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
            actionStatus.success
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{actionStatus.message}</span>
          <button
            onClick={() => setActionStatus(null)}
            className="text-slate-400 hover:text-slate-600 ml-4 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Section 1: Main Status Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ESP32 Hardware Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Microcontroller
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className={`p-3 rounded-xl ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">
                {isOnline ? 'Connected' : 'Offline'}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                {isOnline ? `RSSI: ${device?.wifiRssi || 0} dBm` : 'No heartbeat signal'}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Last Heartbeat</span>
            <span className="font-mono font-medium text-slate-700">
              {formatTime(device?.lastHeartbeat)}
            </span>
          </div>
        </div>

        {/* Card 2: Physical Locker State */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Servo Actuator
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                locker?.servoStatus === 'UNLOCKING'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                  : locker?.servoStatus === 'UNLOCKED' || locker?.state === 'unlocked'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {locker?.servoStatus || (locker?.state === 'unlocked' ? 'UNLOCKED' : 'LOCKED')}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                locker?.servoStatus === 'UNLOCKING'
                  ? 'bg-amber-100 text-amber-700'
                  : locker?.state === 'unlocked'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-blue-50 text-blue-600'
              }`}
            >
              {locker?.state === 'locked' && locker?.servoStatus !== 'UNLOCKING' ? (
                <Lock className="w-6 h-6" />
              ) : (
                <Unlock className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900 capitalize">
                {locker?.servoStatus === 'UNLOCKING' ? 'Unlocking...' : (locker?.state || 'Locked')}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Servo: {locker?.servoAngle !== undefined ? `${locker.servoAngle}°` : '0°'}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Action By</span>
            <span className="font-mono font-medium text-slate-700 capitalize">
              {locker?.lastActionBy || 'None'}
            </span>
          </div>
        </div>

        {/* Card 3: Parcel Presence (IR Sensor & Manual) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Compartment
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                {parcel?.source || 'IR SENSOR'}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  parcel?.present
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {parcel?.present ? 'PARCEL IN' : 'EMPTY'}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                parcel?.present ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {parcel?.present ? <PackageCheck className="w-6 h-6" /> : <Package className="w-6 h-6" />}
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">
                {parcel?.statusText || (parcel?.present ? 'Parcel Inside' : 'Locker Empty')}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                IR Beam: {sensors?.ir?.beamBroken ? 'Interrupted' : 'Clear'} (Raw: {sensors?.ir?.raw ?? 1})
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Total Deliveries</span>
            <span className="font-mono font-bold text-slate-900">
              {parcel?.totalDeliveries || 0}
            </span>
          </div>
        </div>

        {/* Card 4: Security Status (Vibration Sensor) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Security
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                security?.unacknowledgedAlertsCount > 0
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {security?.unacknowledgedAlertsCount > 0 ? 'ALERT' : 'SECURE'}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                security?.unacknowledgedAlertsCount > 0
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              {security?.unacknowledgedAlertsCount > 0 ? (
                <ShieldAlert className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">
                {security?.unacknowledgedAlertsCount > 0
                  ? `${security.unacknowledgedAlertsCount} Unread Alert${security.unacknowledgedAlertsCount > 1 ? 's' : ''}`
                  : 'Normal'}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Vibration: {sensors?.vibration?.enabled ? (sensors?.vibration?.detected ? 'DETECTED' : 'Calm') : 'Disabled'} (Raw: {sensors?.vibration?.raw ?? 0})
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Detection Switch</span>
            <span className={`font-mono font-bold text-[11px] ${sensors?.vibration?.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
              {sensors?.vibration?.enabled ? 'ENABLED (ON)' : 'DISABLED (OFF)'}
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: Actuator & Manual Parcel Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel A: Quick Actuator Actions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <span>Physical Locker Servo</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">GPIO 18</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Send authenticated lock/unlock commands directly to ESP32. Display reflects confirmed hardware execution.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() =>
                setConfirmModal({
                  isOpen: true,
                  action: 'UNLOCK',
                  title: 'Unlock Smart Locker',
                  message: 'Are you sure you want to command the ESP32 servo motor to rotate to 90° (Unlocked)?',
                  type: 'warning',
                  icon: <Unlock className="w-6 h-6 text-amber-600" />
                })
              }
              disabled={actionLoading || locker?.servoStatus === 'UNLOCKING'}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold text-xs transition active:scale-98 disabled:opacity-50"
            >
              <Unlock className="w-4 h-4 text-amber-600" />
              <span>{locker?.servoStatus === 'UNLOCKING' ? 'UNLOCKING...' : 'UNLOCK'}</span>
            </button>

            <button
              onClick={() =>
                setConfirmModal({
                  isOpen: true,
                  action: 'LOCK',
                  title: 'Lock Smart Locker',
                  message: 'Are you sure you want to command the ESP32 servo motor to engage to 0° (Securely Latched)?',
                  type: 'primary',
                  icon: <Lock className="w-6 h-6 text-blue-600" />
                })
              }
              disabled={actionLoading}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-600/25 transition active:scale-98 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>LOCK</span>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <Link
              to="/locker-control"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              <span>Advanced Locker Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Panel B: Manual Parcel IN / OUT Controls */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>Manual Parcel Controls</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                Source: {parcel?.source || 'IR SENSOR'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Manually mark a parcel as stored or collected. Updates pickup reminders and history without moving the physical servo.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() =>
                setConfirmModal({
                  isOpen: true,
                  action: 'PARCEL_IN',
                  title: 'Confirm Manual Parcel IN',
                  message: 'Are you sure you want to manually mark a parcel as STORED inside the locker compartment? This will start the 2-hour pickup reminder.',
                  type: 'primary',
                  icon: <PackageCheck className="w-6 h-6 text-emerald-600" />
                })
              }
              disabled={actionLoading || parcel?.present}
              title={parcel?.present ? 'Parcel is already marked as INSIDE' : 'Mark parcel as inside'}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs transition active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>PARCEL IN</span>
            </button>

            <button
              onClick={() =>
                setConfirmModal({
                  isOpen: true,
                  action: 'PARCEL_OUT',
                  title: 'Confirm Manual Parcel OUT',
                  message: 'Are you sure you want to manually mark the parcel as COLLECTED (Locker Empty)? This will clear the active pickup reminder.',
                  type: 'primary',
                  icon: <Package className="w-6 h-6 text-slate-600" />
                })
              }
              disabled={actionLoading || !parcel?.present}
              title={!parcel?.present ? 'Locker is already marked as EMPTY' : 'Mark parcel as collected'}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold text-xs transition active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Package className="w-4 h-4 text-slate-600" />
              <span>PARCEL OUT</span>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <Link
              to="/parcel-monitoring"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 inline-flex items-center gap-1"
            >
              <span>View Parcel Monitoring Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Panel C: Hardware & Network Info Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600" />
                <span>Hardware & Sensor Settings</span>
              </h3>
              <button
                onClick={refreshDashboard}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-mono uppercase text-slate-400">IR Polarity</span>
                <p className="text-xs font-bold text-slate-900 mt-1 capitalize">
                  {sensors?.ir?.polarity === 'active_high' ? 'Active HIGH' : 'Active LOW'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">GPIO 19</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-mono uppercase text-slate-400">Vibration SW</span>
                <p className="text-xs font-bold text-slate-900 mt-1">
                  {sensors?.vibration?.enabled ? 'Detection ON' : 'Detection OFF'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">GPIO 21 (SW-420)</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-mono uppercase text-slate-400">Controller</span>
                <p className="text-xs font-bold text-slate-900 mt-1">ESP32 DevKit V1</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{device?.firmwareVersion || 'v2.5.0'}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-mono uppercase text-slate-400">Device Link</span>
                <p className="text-xs font-bold text-slate-900 mt-1 font-mono">
                  {isOnline ? 'Online' : 'Offline'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {isOnline ? `RSSI: ${device?.wifiRssi || 0} dBm` : 'No Signal'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Last Comm</span>
            <span className="font-mono font-medium text-slate-700">
              {formatTime(device?.lastHeartbeat)}
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Recent Activity & Security Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Table */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Recent Activity Feed</span>
            </h3>
            <Link
              to="/activity-history"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View All Logs
            </Link>
          </div>

          {recentActivities.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No recent activity recorded.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.map((act) => (
                <div key={act.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{act.event_title}</div>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                      {act.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono text-slate-400">
                    {formatTime(act.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Alerts Feed */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Security Tamper Alerts</span>
            </h3>
            <Link
              to="/security-monitoring"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Manage Alerts
            </Link>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
              <span>No active security tampering alerts recorded.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                    alert.acknowledged
                      ? 'bg-slate-50 border-slate-200 text-slate-600'
                      : 'bg-rose-50 border-rose-200 text-rose-900 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-900">
                        {alert.alert_type}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatTime(alert.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 leading-relaxed text-xs">{alert.description}</p>
                  </div>

                  {!alert.acknowledged ? (
                    <button
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      className="shrink-0 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold rounded-lg shadow-xs transition"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <span className="shrink-0 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Acknowledged</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        icon={confirmModal.icon}
        confirmText="Confirm Execution"
        onConfirm={handleActuatorConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
}
