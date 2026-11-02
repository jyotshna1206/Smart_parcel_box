import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  AlertCircle,
  Ban,
  RefreshCw,
  Share2,
  Calendar,
  Lock,
  ArrowRight
} from 'lucide-react';
import api from '../services/api';

export default function GeneratePIN() {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [newlyCreatedPin, setNewlyCreatedPin] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchPins = async () => {
    try {
      const res = await api.getPins();
      if (res.success) {
        setPins(res.pins || []);
      }
    } catch (err) {
      setErrorMsg('Failed to load PIN list from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPins();
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setErrorMsg('');
    setSuccessMsg('');
    setNewlyCreatedPin(null);
    setCopied(false);

    try {
      const res = await api.generatePin(durationMinutes);
      if (res.success && res.pin) {
        setNewlyCreatedPin(res.pin);
        setSuccessMsg(`Temporary 6-digit PIN successfully generated.`);
        await fetchPins();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate PIN.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (pinId) => {
    try {
      const res = await api.revokePin(pinId);
      if (res.success) {
        setSuccessMsg(`PIN #${pinId} revoked.`);
        await fetchPins();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to revoke PIN.');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Temporary Six-Digit Access PINs
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Generate single-use, cryptographically secure PINs for couriers. PIN hashes are stored in SQLite and expire automatically.
          </p>
        </div>

        <button
          onClick={fetchPins}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-xs">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Newly Created PIN Reveal Modal / Alert Card */}
      {newlyCreatedPin && (
        <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl text-white shadow-xl border border-blue-700/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-blue-300 uppercase tracking-wider block">
                Single-Use Delivery Code (Revealed to Owner Once)
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-widest font-mono text-white select-all">
                  {newlyCreatedPin.rawPin}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-800/80 text-blue-200 font-semibold border border-blue-600">
                  Valid for {newlyCreatedPin.durationMinutes} mins
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-2">
                Expires at: <strong className="text-white">{formatTime(newlyCreatedPin.expiresAt)}</strong>. Share this code with your courier via message or delivery notes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => copyToClipboard(newlyCreatedPin.rawPin)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-100 text-blue-900 font-bold text-xs shadow-md transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy 6-Digit PIN'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section: Generate PIN Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-blue-600" />
          <span>Generate New Courier PIN</span>
        </h3>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select PIN Validity Window
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: '15 mins', value: 15 },
                { label: '30 mins', value: 30 },
                { label: '1 hour', value: 60 },
                { label: '2 hours', value: 120 },
                { label: '24 hours', value: 1440 },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setDurationMinutes(opt.value)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition ${
                    durationMinutes === opt.value
                      ? 'bg-blue-50 border-blue-600 text-blue-700 ring-1 ring-blue-600'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={generating}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {generating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating PIN...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Generate Temporary PIN</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-slate-500 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>
            Strict Security: The raw PIN is never stored in plaintext or exposed in API responses. Verification runs against SHA-256 hashes.
          </span>
        </div>
      </div>

      {/* Section: PIN Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            PIN History & Active Codes
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {pins.length} Total Records
          </span>
        </div>

        {pins.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No temporary PINs generated yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Ref ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Validity</th>
                  <th className="py-3 px-4">Created Time</th>
                  <th className="py-3 px-4">Expires At</th>
                  <th className="py-3 px-4">Consumed At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pins.map((pin) => {
                  const isActive = pin.status === 'active';
                  const isUsed = pin.status === 'used';
                  const isExpired = pin.status === 'expired';
                  const isRevoked = pin.status === 'revoked';

                  return (
                    <tr key={pin.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        PIN #{pin.id}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isUsed
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : isRevoked
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1 h-1 rounded-full ${
                              isActive
                                ? 'bg-emerald-500'
                                : isUsed
                                ? 'bg-blue-500'
                                : isRevoked
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          {pin.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {pin.duration_minutes} mins
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {formatTime(pin.created_at)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {formatTime(pin.expires_at)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {pin.used_at ? formatTime(pin.used_at) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isActive && (
                          <button
                            onClick={() => handleRevoke(pin.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[11px] font-semibold transition"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Revoke</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
