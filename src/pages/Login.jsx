import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  Box,
  KeyRound,
  ArrowRight,
  Info,
  Server,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { useLocker } from '../context/LockerContext';

export default function Login() {
  const { login, isAuthenticated } = useLocker();
  const navigate = useNavigate();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => api.getBaseUrl());
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await api.testConnection(serverUrl);
      if (res.success) {
        api.setBaseUrl(serverUrl);
        setConnectionStatus({ type: 'success', text: 'Backend connected! (Server healthy)' });
      } else {
        setConnectionStatus({ type: 'error', text: `Cannot reach backend: ${res.error || 'Server offline'}` });
      }
    } catch (err) {
      setConnectionStatus({ type: 'error', text: err.message || 'Connection failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveServerUrl = (e) => {
    e.preventDefault();
    const updated = api.setBaseUrl(serverUrl);
    setServerUrl(updated);
    setConnectionStatus({ type: 'success', text: `Saved: ${updated}` });
  };

  // Auto redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!usernameOrEmail.trim()) {
      setErrorMsg('Please enter your owner username or email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(usernameOrEmail.trim(), password);
      if (result.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setErrorMsg(result.message || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unable to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d1e] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Technology Grid and Geometric Lights */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e3a8a_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />
      
      {/* Ambient Radial Glowing Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-900/60 rounded-full blur-2xl pointer-events-none -z-10" />

      {/* Header Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/25 ring-1 ring-white/20 mb-4">
          <Box className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Smart Package Locker
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400 font-medium">
          IoT Security & Compartment Access Management
        </p>
      </div>

      {/* Login Card (Modern Crisp White) */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-9 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-200">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Owner Sign In
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your authorized owner credentials to access the controller console.
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="Jyotshna or jyotshnachinnu4@gmail.com"
                  autoComplete="username"
                  required
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="block w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-xs text-slate-600 font-medium">Remember this browser</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice Footer */}
          <div className="mt-7 pt-5 border-t border-slate-100 flex items-center justify-between text-slate-500 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>JWT & bcrypt Secured</span>
            </div>
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 hover:text-blue-800 transition"
            >
              <Server className="w-3 h-3" />
              <span>{showServerConfig ? 'Hide API URL' : 'API Endpoint'}</span>
            </button>
          </div>

          {/* Expandable Server Connection Config */}
          {showServerConfig && (
            <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 text-[11px]">Backend Server URL</span>
                <span className="text-[10px] text-slate-400 font-mono">Port 5000</span>
              </div>
              <form onSubmit={handleSaveServerUrl} className="flex gap-2">
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:5000/api"
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition disabled:opacity-50 shrink-0"
                >
                  {testingConnection ? 'Testing...' : 'Test'}
                </button>
              </form>
              {connectionStatus && (
                <div className={`p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                  connectionStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {connectionStatus.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  )}
                  <span>{connectionStatus.text}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Public Courier Access Info Pill */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            Delivery courier depositing a package?{' '}
            <button
              onClick={() => navigate('/delivery-access')}
              className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-4"
            >
              Enter Delivery PIN here
            </button>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <Info className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Owner Password Recovery</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              As a dedicated IoT security system, owner credentials can be updated or reset directly in the backend configuration file (<code className="text-blue-600 font-mono">backend/.env</code>) or by running:
            </p>
            <div className="mt-3 p-2.5 bg-slate-900 text-slate-200 rounded-lg text-[11px] font-mono select-all">
              npm run reset-owner
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Alternatively, log in and use the Account Settings page to change your password.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
