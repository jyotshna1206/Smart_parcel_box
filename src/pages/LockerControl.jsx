import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import ConfirmationModal from '../components/common/ConfirmationModal';

export default function LockerControl() {
  const [lockerData, setLockerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeCommandId, setActiveCommandId] = useState(null);
  const [commandStatus, setCommandStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    action: null,
    title: '',
    message: '',
    type: 'primary',
    icon: null
  });

  const fetchStatus = async () => {
    try {
      const res = await api.getLockerStatus();
      if (res.success) {
        setLockerData(res);
        setErrorMsg('');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Poll for specific active command completion if pending
  useEffect(() => {
    if (!activeCommandId) return;

    let pollCount = 0;
    const pollInterval = setInterval(async () => {
      pollCount++;
      try {
        const res = await api.getLockerStatus();
        if (res.latestCommand && res.latestCommand.id === activeCommandId) {
          if (res.latestCommand.status !== 'pending' || pollCount > 15) {
            setCommandStatus(res.latestCommand);
            setActiveCommandId(null);
            clearInterval(pollInterval);
          }
        }
      } catch (e) {
        // Ignore poll error
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [activeCommandId]);

  const handleCommand = async () => {
    const action = confirmModal.action;
    setConfirmModal({ ...confirmModal, isOpen: false });
    setActionLoading(true);
    setCommandStatus(null);
    setErrorMsg('');

    try {
      let res;
      if (action === 'LOCK') {
        res = await api.lockLocker();
      } else {
        res = await api.unlockLocker();
      }

      if (res.commandId) {
        setActiveCommandId(res.commandId);
        setCommandStatus({
          id: res.commandId,
          command: action,
          status: 'pending',
          message: res.message
        });
      }
      await fetchStatus();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to dispatch command.');
    } finally {
      setActionLoading(false);
    }
  };

  const isOnline = lockerData?.deviceOnline;
  const locker = lockerData?.locker || { state: 'unknown' };
  const latestCmd = lockerData?.latestCommand;

  const formatTime = (ts) => {
    if (!ts) return 'Not Available';
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return ts;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Description */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Locker Actuator Controller
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch authenticated PWM servo motor commands. Real physical confirmation is strictly verified before state update.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Offline Hardware Notice */}
      {!isOnline && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <span className="font-bold block">ESP32 Device Offline</span>
            <span>
              The locker microcontroller is currently disconnected. Commands will enter the server queue and execute as soon as the ESP32 reconnects.
            </span>
          </div>
        </div>
      )}

      {/* General Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Actuator Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Actuator Status & Interactive Buttons */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Confirmed Hardware State
              </span>
              <div className="flex items-center gap-3 mt-1">
                <div
                  className={`w-3 h-3 rounded-full ${
                    locker.state === 'locked'
                      ? 'bg-blue-600'
                      : locker.state === 'unlocked'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
                <h3 className="text-2xl font-extrabold text-slate-900 capitalize tracking-tight">
                  {locker.state}
                </h3>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {locker.servoAngle !== undefined ? `${locker.servoAngle}° Angle` : '0° Angle'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Last Executed</span>
              <span className="text-xs font-semibold text-slate-700 font-mono">
                {formatTime(locker.lastActionAt)}
              </span>
            </div>
          </div>

          {/* Actuator Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            {/* UNLOCK BUTTON */}
            <div className="p-5 rounded-2xl border border-amber-200/90 bg-amber-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-900 uppercase font-mono">
                    Open Compartment
                  </span>
                  <Unlock className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-xs text-amber-800 leading-relaxed mb-4">
                  Rotates servo motor to 90° for owner collection or authorized courier placement.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setConfirmModal({
                    isOpen: true,
                    action: 'UNLOCK',
                    title: 'Authorize Locker Unlock',
                    message:
                      'Are you sure you want to command the ESP32 to rotate the servo to 90° (Unlocked)?',
                    type: 'warning',
                    icon: <Unlock className="w-6 h-6 text-amber-600" />
                  })
                }
                disabled={actionLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Unlock className="w-4 h-4" />
                <span>UNLOCK LOCKER</span>
              </button>
            </div>

            {/* LOCK BUTTON */}
            <div className="p-5 rounded-2xl border border-blue-200/90 bg-blue-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-900 uppercase font-mono">
                    Secure Compartment
                  </span>
                  <Lock className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-xs text-blue-800 leading-relaxed mb-4">
                  Rotates servo motor to 0° to firmly latch the locker door against unauthorized entry.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setConfirmModal({
                    isOpen: true,
                    action: 'LOCK',
                    title: 'Authorize Locker Lock',
                    message:
                      'Are you sure you want to command the ESP32 to rotate the servo to 0° (Locked)?',
                    type: 'primary',
                    icon: <Lock className="w-6 h-6 text-blue-600" />
                  })
                }
                disabled={actionLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>LOCK LOCKER</span>
              </button>
            </div>
          </div>

          {/* Verification Protocol Notice */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Zero-Assumption Actuator Policy:</strong> The web interface will never display a fake or premature locker status. The physical state updates only when the ESP32 reports execution via the <code className="text-blue-700 font-mono">/api/device/command-result</code> endpoint.
            </p>
          </div>
        </div>

        {/* Right Col: Active / Latest Command Monitor */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>Actuator Command Pipeline</span>
            </h3>

            {commandStatus || latestCmd ? (
              (() => {
                const cmd = commandStatus || latestCmd;
                const isPending = cmd.status === 'pending';
                const isExecuted = cmd.status === 'executed';
                const isFailed = cmd.status === 'failed';

                return (
                  <div className="space-y-4">
                    <div
                      className={`p-4 rounded-xl border text-xs ${
                        isPending
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : isExecuted
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 font-bold uppercase tracking-wider text-[10px]">
                        <span>Command #{cmd.id}</span>
                        <span className="flex items-center gap-1 font-mono">
                          {isPending && <Clock className="w-3 h-3 animate-spin" />}
                          {isExecuted && <CheckCircle2 className="w-3 h-3" />}
                          {isFailed && <AlertCircle className="w-3 h-3" />}
                          {cmd.status}
                        </span>
                      </div>
                      <p className="font-semibold text-sm">
                        {cmd.command} Actuator Command
                      </p>
                      {cmd.errorMessage && (
                        <p className="text-[11px] text-rose-700 mt-1">
                          Error: {cmd.errorMessage}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Initiated By</span>
                        <span className="font-semibold text-slate-800 capitalize">
                          {cmd.created_by || 'owner'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Created Time</span>
                        <span className="font-mono text-slate-800">
                          {formatTime(cmd.created_at)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-400">Execution Time</span>
                        <span className="font-mono text-slate-800">
                          {formatTime(cmd.executed_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No commands dispatched yet.
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400 font-mono">
              Actuator Pin: GPIO 18 &bull; Pulse: 50Hz PWM
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        icon={confirmModal.icon}
        confirmText="Confirm & Dispatch"
        onConfirm={handleCommand}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
}
