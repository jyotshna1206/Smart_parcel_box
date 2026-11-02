import React, { useState, useEffect } from 'react';
import {
  Package,
  PackageCheck,
  Clock,
  RefreshCw,
  Settings,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine
} from 'lucide-react';
import api from '../services/api';
import { useLocker } from '../context/LockerContext';
import ConfirmationModal from '../components/common/ConfirmationModal';

export default function ParcelMonitoring() {
  const { dashboardData, refreshDashboard } = useLocker();

  const [parcelData, setParcelData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedPolarity, setSelectedPolarity] = useState('active_low');
  const [statusMessage, setStatusMessage] = useState(null);
  const [manualActionLoading, setManualActionLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    action: null,
    title: '',
    message: '',
    type: 'primary',
    icon: null
  });

  const fetchParcelDetails = async () => {
    try {
      const [statusRes, historyRes] = await Promise.all([
        api.getParcelStatus(),
        api.getParcelHistory()
      ]);

      if (statusRes.success && statusRes.parcel) {
        setParcelData(statusRes.parcel);
        setSelectedPolarity(statusRes.parcel.polarity || 'active_low');
      }
      if (historyRes.success) {
        setHistory(historyRes.events || []);
      }
    } catch (err) {
      console.error('Failed to load parcel monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParcelDetails();
    const interval = setInterval(fetchParcelDetails, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSavePolarity = async () => {
    setSavingSettings(true);
    setStatusMessage(null);
    try {
      const res = await api.updateParcelSettings(selectedPolarity);
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
        await fetchParcelDetails();
        await refreshDashboard();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update polarity.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleManualAction = async () => {
    const action = confirmModal.action;
    setConfirmModal({ ...confirmModal, isOpen: false });
    setManualActionLoading(true);
    setStatusMessage(null);
    try {
      if (action === 'PARCEL_IN') {
        const res = await api.setParcelIn();
        setStatusMessage({ type: 'success', text: res.message });
      } else if (action === 'PARCEL_OUT') {
        const res = await api.setParcelOut();
        setStatusMessage({ type: 'success', text: res.message });
      }
      await fetchParcelDetails();
      await refreshDashboard();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Action failed.' });
    } finally {
      setManualActionLoading(false);
    }
  };

  const reminder = dashboardData?.reminder;
  const isPresent = parcelData?.present;
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
              IR Sensor & Parcel Monitoring
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
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time optical infrared beam detection (GPIO 19) and manual parcel storage management.
          </p>
        </div>

        <button
          onClick={fetchParcelDetails}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Feedback */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Main Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Compartment State */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-500 font-semibold">
              Presence Status
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                {parcelData?.source || 'IR SENSOR'}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isPresent
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {isPresent ? 'PARCEL IN' : 'EMPTY'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                isPresent ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isPresent ? <PackageCheck className="w-6 h-6" /> : <Package className="w-6 h-6" />}
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">
                {parcelData?.statusText || (isPresent ? 'Parcel Inside' : 'Locker Empty')}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Beam: {parcelData?.beamBroken ? 'Interrupted' : 'Clear'} (Raw: {parcelData?.rawReading ?? 1})
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Two-Hour Pickup Reminder Window */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-500 font-semibold">
              Pickup Reminder
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                reminder
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {reminder ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                reminder ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">
                {reminder ? `${reminder.remainingMinutes}m Remaining` : 'No Active Parcel'}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Window: 120 minutes standard
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Deliveries Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-500 font-semibold">
              Total Deliveries
            </span>
            <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-sans">
            {parcelData?.totalDeliveries || 0}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            Last: {formatTime(parcelData?.lastDeliveryAt)}
          </p>
        </div>

        {/* Card 4: Collections Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase text-slate-500 font-semibold">
              Total Collections
            </span>
            <ArrowUpFromLine className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-sans">
            {parcelData?.totalCollections || 0}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            Last: {formatTime(parcelData?.lastCollectionAt)}
          </p>
        </div>
      </div>

      {/* Manual Parcel IN / OUT Action Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Package className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Manual Parcel Storage Controls</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
              Current Source: {parcelData?.source || 'IR SENSOR'}
            </span>
          </div>
          <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
            Record parcel placement or collection manually without activating the physical servo. Persists in database and updates 2-hour pickup reminders and activity audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() =>
              setConfirmModal({
                isOpen: true,
                action: 'PARCEL_IN',
                title: 'Confirm Manual Parcel IN',
                message: 'Mark a parcel as STORED inside the locker compartment? This will initiate the 2-hour pickup reminder.',
                type: 'primary',
                icon: <PackageCheck className="w-6 h-6 text-emerald-600" />
              })
            }
            disabled={manualActionLoading || isPresent}
            title={isPresent ? 'Parcel is already recorded as inside' : 'Mark parcel as inside'}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            <span>Mark Parcel IN</span>
          </button>

          <button
            onClick={() =>
              setConfirmModal({
                isOpen: true,
                action: 'PARCEL_OUT',
                title: 'Confirm Manual Parcel OUT',
                message: 'Mark the locker compartment as EMPTY (Collected)? This will resolve and clear the active pickup reminder.',
                type: 'primary',
                icon: <Package className="w-6 h-6 text-slate-600" />
              })
            }
            disabled={manualActionLoading || !isPresent}
            title={!isPresent ? 'Locker is already recorded as empty' : 'Mark parcel as collected'}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Package className="w-4 h-4 text-slate-600" />
            <span>Mark Parcel OUT</span>
          </button>
        </div>
      </div>

      {/* Section: IR Sensor Configuration & Hardware Protocol */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-blue-600" />
          <span>IR Sensor Hardware Polarity Logic</span>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
          Infrared sensor modules (e.g. TCRT5000, LM393 comparator) output differing logic levels depending on circuit design. Configure your module's active logic below:
        </p>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="polarity"
                value="active_low"
                checked={selectedPolarity === 'active_low'}
                onChange={() => setSelectedPolarity('active_low')}
                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span>Active LOW (0 = Parcel Present / Beam Broken, default)</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="polarity"
                value="active_high"
                checked={selectedPolarity === 'active_high'}
                onChange={() => setSelectedPolarity('active_high')}
                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span>Active HIGH (1 = Parcel Present / Beam Broken)</span>
            </label>
          </div>

          <button
            onClick={handleSavePolarity}
            disabled={savingSettings || selectedPolarity === parcelData?.polarity}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            {savingSettings ? 'Saving...' : 'Apply Polarity'}
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Current Pin: GPIO 19</span>
          <span>Raw ESP32 Pin Reading: {parcelData?.rawReading ?? 'N/A'} (Interpreted: {isPresent ? 'Parcel Present' : 'Empty'})</span>
        </div>
      </div>

      {/* Section: Parcel Delivery & Collection History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Parcel Event Log (State Transitions)</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {history.length} Transition Events
          </span>
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No parcel events recorded yet. Once the ESP32 IR sensor or owner triggers a drop/collection, it will be audited here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Detected Timestamp</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((ev) => {
                  const isDelivery = ev.event_type === 'delivery';
                  return (
                    <tr key={ev.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{ev.id}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            isDelivery
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {isDelivery ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                          <span>{ev.event_type}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {formatTime(ev.detected_at)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {ev.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={handleManualAction}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        icon={confirmModal.icon}
        confirmText="Confirm Status Update"
      />
    </div>
  );
}
