import React, { useState, useEffect } from 'react';
import {
  Box,
  KeyRound,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import api from '../services/api';

export default function DeliveryAccess() {
  const [pinCode, setPinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifyingStatus, setVerifyingStatus] = useState(null); // 'verifying', 'actuating', 'unlocked', 'error'
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [activeCommandId, setActiveCommandId] = useState(null);
  const [lockoutMinutes, setLockoutMinutes] = useState(null);

  // Poll for actuator execution if pending
  useEffect(() => {
    if (!activeCommandId || verifyingStatus === 'unlocked') return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await api.getCommandStatus(activeCommandId);
        if (res.status === 'executed') {
          setVerifyingStatus('unlocked');
          setFeedbackMessage('Locker Unlocked! Please deposit the package and close the door securely.');
          clearInterval(interval);
        } else if (res.status === 'failed') {
          setVerifyingStatus('error');
          setFeedbackMessage('Actuator failed to open. Please contact the locker owner.');
          clearInterval(interval);
        } else if (attempts > 12) {
          // Timeout
          setVerifyingStatus('error');
          setFeedbackMessage('Hardware timed out. Please try again or verify locker is powered on.');
          clearInterval(interval);
        }
      } catch (e) {
        // Poll retry
      }
    }, 800);

    return () => clearInterval(interval);
  }, [activeCommandId, verifyingStatus]);

  const handlePinChange = (e) => {
    // Only accept numbers, max 6 digits
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPinCode(cleaned);
    if (verifyingStatus === 'error') {
      setVerifyingStatus(null);
      setFeedbackMessage('');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();

    if (pinCode.length !== 6) {
      setVerifyingStatus('error');
      setFeedbackMessage('Please enter a complete 6-digit numeric PIN.');
      return;
    }

    setSubmitting(true);
    setVerifyingStatus('verifying');
    setFeedbackMessage('Verifying delivery PIN with locker controller...');
    setLockoutMinutes(null);

    try {
      const res = await api.verifyDeliveryPin(pinCode);

      if (res.success) {
        if (res.status === 'executed') {
          setVerifyingStatus('unlocked');
          setFeedbackMessage(res.message || 'Locker Unlocked! Please deposit the package and close the door.');
        } else {
          // Awaiting ESP32 servo motion
          setVerifyingStatus('actuating');
          setFeedbackMessage('PIN Verified! Actuator is unlocking locker door...');
          setActiveCommandId(res.commandId);
        }
      } else {
        setVerifyingStatus('error');
        setFeedbackMessage(res.error || 'Invalid PIN code. Please verify with the owner.');
      }
    } catch (err) {
      setVerifyingStatus('error');
      if (err.data && err.data.lockedOut) {
        setLockoutMinutes(err.data.remainingMinutes || 15);
      }
      setFeedbackMessage(err.message || 'Verification failed. Please check your PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setPinCode('');
    setVerifyingStatus(null);
    setFeedbackMessage('');
    setActiveCommandId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Header Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center pt-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/20 mb-3">
          <Box className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Smart Package Locker
        </h1>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Contactless Courier Delivery Access Portal
        </p>
      </div>

      {/* Main Delivery PIN Card (Clean White with Navy Blue Accents) */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-8">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xl rounded-3xl border border-slate-200">
          {/* Instructions Header */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Enter Delivery Access PIN
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter the 6-digit access code provided by the package owner to unlock the locker.
            </p>
          </div>

          {/* SUCCESS STATE: UNLOCKED */}
          {verifyingStatus === 'unlocked' ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
                <Unlock className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-emerald-700">
                  Locker Door Unlocked!
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-xs mx-auto">
                  {feedbackMessage}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
                >
                  Deliver Another Package
                </button>
              </div>
            </div>
          ) : verifyingStatus === 'actuating' ? (
            /* ACTUATING STATE */
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Opening Compartment Door...
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Actuator is moving to unlock position (90°). Please stand by.
                </p>
              </div>
            </div>
          ) : (
            /* PIN ENTRY FORM */
            <form onSubmit={handleVerify} className="space-y-6">
              {/* Error Banner */}
              {verifyingStatus === 'error' && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="font-medium leading-relaxed">{feedbackMessage}</div>
                </div>
              )}

              {/* Rate Limit Lockout Banner */}
              {lockoutMinutes && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-bold block">Security Lockout Active</span>
                    <span>
                      Too many invalid attempts. Try again in {lockoutMinutes} minutes.
                    </span>
                  </div>
                </div>
              )}

              {/* Large PIN Input */}
              <div>
                <label className="block text-center text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 font-mono">
                  6-Digit Access Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    autoFocus
                    value={pinCode}
                    onChange={handlePinChange}
                    placeholder="••••••"
                    disabled={submitting}
                    className="block w-full py-4 text-center text-3xl sm:text-4xl font-extrabold tracking-[0.4em] font-mono bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition"
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 px-1">
                  <span>Numeric digits only</span>
                  <span className="font-mono">{pinCode.length} / 6</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || pinCode.length !== 6}
                className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Verify & Unlock Locker</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Simple Courier Step Helper */}
          <div className="mt-8 pt-5 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500 font-medium">
            <div className="p-2 bg-slate-50 rounded-xl">
              <span className="font-bold text-blue-600 block">Step 1</span>
              <span>Enter PIN</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <span className="font-bold text-blue-600 block">Step 2</span>
              <span>Deposit Parcel</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <span className="font-bold text-blue-600 block">Step 3</span>
              <span>Close Door</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="text-center pb-4 text-[11px] text-slate-400">
        <p>Smart Package Locker IoT Security Platform</p>
        <p className="mt-0.5">Physical hardware verified by ESP32 microcontroller.</p>
      </div>
    </div>
  );
}
