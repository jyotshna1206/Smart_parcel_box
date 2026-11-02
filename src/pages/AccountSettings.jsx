import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  Cpu,
  Power,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Radio,
  CheckCircle2,
  Clock
} from 'lucide-react';
import api from '../services/api';
import { useLocker } from '../context/LockerContext';

export default function AccountSettings() {
  const { owner, updateOwner, dashboardData, refreshDashboard } = useLocker();

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);

  // Hardware token display
  const [showToken, setShowToken] = useState(false);

  // Hardware & Sensor Settings State
  const [selectedPolarity, setSelectedPolarity] = useState('active_low');
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [savingHardware, setSavingHardware] = useState(false);
  const [hardwareMsg, setHardwareMsg] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.getProfile();
        if (res.success && res.owner) {
          setProfileForm({
            fullName: res.owner.fullName || '',
            username: res.owner.username || '',
            email: res.owner.email || '',
            phone: res.owner.phone || '',
          });
        }
      } catch (e) {
        // Fallback to context
        if (owner) {
          setProfileForm({
            fullName: owner.fullName || '',
            username: owner.username || '',
            email: owner.email || '',
            phone: owner.phone || '',
          });
        }
      }
    }
    loadProfile();
  }, [owner]);

  // Synchronize initial hardware sensor values from dashboard context
  useEffect(() => {
    if (dashboardData?.sensors) {
      if (dashboardData.sensors.ir?.polarity) {
        setSelectedPolarity(dashboardData.sensors.ir.polarity);
      }
      if (dashboardData.sensors.vibration?.enabled !== undefined) {
        setVibrationEnabled(dashboardData.sensors.vibration.enabled);
      }
    }
  }, [dashboardData]);

  const handleSaveHardwareSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingHardware(true);
    setHardwareMsg(null);
    try {
      await Promise.all([
        api.updateParcelSettings(selectedPolarity),
        api.setVibrationControl(vibrationEnabled)
      ]);
      setHardwareMsg({
        type: 'success',
        text: 'Hardware settings saved & queued for ESP32 synchronization!'
      });
      await refreshDashboard();
    } catch (err) {
      setHardwareMsg({
        type: 'error',
        text: err.message || 'Failed to update hardware settings.'
      });
    } finally {
      setSavingHardware(false);
    }
  };

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

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      const res = await api.updateProfile(profileForm);
      if (res.success) {
        setProfileMsg({ type: 'success', text: res.message || 'Profile updated successfully.' });
        updateOwner(res.owner);
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMsg(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      setSavingPassword(false);
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters long.' });
      setSavingPassword(false);
      return;
    }

    try {
      const res = await api.changePassword(passwordForm);
      if (res.success) {
        setPasswordMsg({ type: 'success', text: res.message || 'Password changed successfully.' });
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setSavingPassword(false);
    }
  };

  // Password strength checker helper
  const getPasswordStrength = (pw) => {
    if (!pw) return { score: 0, label: 'Empty', color: 'bg-slate-200' };
    let score = 0;
    if (pw.length >= 8) score += 1;
    if (/[A-Z]/.test(pw)) score += 1;
    if (/[0-9]/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;

    switch (score) {
      case 1:
        return { score: 25, label: 'Weak', color: 'bg-rose-500' };
      case 2:
        return { score: 50, label: 'Fair', color: 'bg-amber-500' };
      case 3:
        return { score: 75, label: 'Good', color: 'bg-blue-500' };
      case 4:
        return { score: 100, label: 'Strong', color: 'bg-emerald-500' };
      default:
        return { score: 10, label: 'Too Short', color: 'bg-rose-400' };
    }
  };

  const strength = getPasswordStrength(passwordForm.newPassword);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Owner Account & Security Management
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Manage your owner administrator credentials, change your password securely, and inspect IoT hardware configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* A. Profile Management Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Owner Profile Information</h3>
              <p className="text-[11px] text-slate-500">Update your full name, username, and contact details</p>
            </div>
          </div>

          {profileMsg && (
            <div
              className={`p-3.5 mb-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
                profileMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <span>{profileMsg.text}</span>
              <button onClick={() => setProfileMsg(null)} className="font-bold ml-2">
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+91 98450 12345"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* B. Password Management Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Change Owner Password</h3>
              <p className="text-[11px] text-slate-500">Requires current password verification & bcrypt hashing</p>
            </div>
          </div>

          {passwordMsg && (
            <div
              className={`p-3.5 mb-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
                passwordMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <span>{passwordMsg.text}</span>
              <button onClick={() => setPasswordMsg(null)} className="font-bold ml-2">
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                New Password (Min 8 Characters)
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength Meter Bar */}
              {passwordForm.newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>Password Strength:</span>
                    <span className="font-bold">{strength.label}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{savingPassword ? 'Updating Password...' : 'Change Owner Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* C. Functional ESP32 Hardware & Sensor Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">ESP32 Hardware & Sensor Configuration</h3>
              <p className="text-[11px] text-slate-500">Configure IR optical sensor polarity and SW-420 vibration tamper monitoring</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              dashboardData?.locker?.servoStatus === 'UNLOCKED'
                ? 'bg-amber-100 text-amber-800'
                : dashboardData?.locker?.servoStatus === 'UNLOCKING'
                ? 'bg-amber-100 text-amber-800 animate-pulse'
                : 'bg-blue-100 text-blue-800'
            }`}>
              Servo: {dashboardData?.locker?.servoStatus || (dashboardData?.locker?.state === 'unlocked' ? 'UNLOCKED' : 'LOCKED')}
            </span>

            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              dashboardData?.device?.status === 'online'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              Device: {dashboardData?.device?.status?.toUpperCase() || 'OFFLINE'}
            </span>
          </div>
        </div>

        {hardwareMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
              hardwareMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <span>{hardwareMsg.text}</span>
            <button onClick={() => setHardwareMsg(null)} className="font-bold ml-2">
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSaveHardwareSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. IR Sensor Polarity */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-blue-600" />
                  <span>IR Sensor Polarity (GPIO 19)</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  Raw Pin: {dashboardData?.sensors?.ir?.raw ?? 'N/A'}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                Choose the signal level your IR sensor module outputs when an object breaks the beam:
              </p>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="irPolarity"
                    value="active_low"
                    checked={selectedPolarity === 'active_low'}
                    onChange={() => setSelectedPolarity('active_low')}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span>Active LOW (0 = Detected, standard for LM393)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="irPolarity"
                    value="active_high"
                    checked={selectedPolarity === 'active_high'}
                    onChange={() => setSelectedPolarity('active_high')}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span>Active HIGH (1 = Detected)</span>
                </label>
              </div>

              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Interpreted Status:</span>
                <span className={`font-bold ${dashboardData?.parcel?.present ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {dashboardData?.parcel?.present ? 'Parcel Detected' : 'Not Detected'}
                </span>
              </div>
            </div>

            {/* 2. Vibration Detection Switch */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Power className="w-4 h-4 text-blue-600" />
                  <span>Vibration Sensor Switch (GPIO 21)</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  Raw Pin: {dashboardData?.sensors?.vibration?.raw ?? 0}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                Enable or disable shock & tamper detection from the SW-420 sensor module:
              </p>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setVibrationEnabled(true)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    vibrationEnabled
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Monitoring ON</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVibrationEnabled(false)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    !vibrationEnabled
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Monitoring OFF</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Tamper Alarm Status:</span>
                <span className={`font-bold ${!vibrationEnabled ? 'text-slate-400' : dashboardData?.sensors?.vibration?.detected ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {!vibrationEnabled ? 'Disabled' : dashboardData?.sensors?.vibration?.detected ? 'Shock Detected' : 'Calm / Secure'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <span className="text-[11px] text-slate-500 font-mono">
              Last ESP32 Comm: {formatTime(dashboardData?.device?.lastHeartbeat)}
            </span>

            <button
              type="submit"
              disabled={savingHardware}
              className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingHardware ? 'Saving & Syncing...' : 'Save Hardware Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* D. System & Hardware Security Information */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-blue-600" />
          <span>ESP32 Hardware Security Credentials</span>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          The ESP32 microcontroller authenticates with the Express backend using the dedicated device token configured below. This token must match the <code className="text-blue-600 font-mono">DEVICE_TOKEN</code> defined in <code className="text-blue-600 font-mono">esp32/smart_package_locker.ino</code>:
        </p>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">ESP32 Device Authentication Token</span>
            <span className="text-slate-900 font-bold select-all">
              {showToken ? 'esp32_smart_locker_secure_token_982341' : '••••••••••••••••••••••••••••••••••••'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-white text-xs font-sans font-medium transition shrink-0"
          >
            {showToken ? 'Mask Token' : 'Reveal Token'}
          </button>
        </div>
      </div>
    </div>
  );
}
