import React, { useState, useEffect } from 'react';
import { Menu, Bell, Clock, Radio, Shield, User, ExternalLink } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLocker } from '../../context/LockerContext';

export default function TopNavbar({ setMobileOpen }) {
  const { dashboardData, owner } = useLocker();
  const location = useLocation();

  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isOnline = dashboardData?.device?.status === 'online';
  const unacknowledgedAlerts = dashboardData?.security?.unacknowledgedAlertsCount || 0;
  const reminder = dashboardData?.reminder;

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return 'System Telemetry Dashboard';
      case '/locker-control':
        return 'Physical Actuator Control';
      case '/parcel-monitoring':
        return 'IR Parcel Presence Monitoring';
      case '/generate-pin':
        return 'Temporary Access PIN Management';
      case '/delivery-qr':
        return 'Delivery Access QR Code & Shareable Link';
      case '/security-monitoring':
        return 'Security & Tamper Monitoring';
      case '/activity-history':
        return 'Audited Activity History';
      case '/account-settings':
        return 'Owner Account Settings';
      default:
        return 'Smart Package Locker';
    }
  };

  return (
    <header className="sticky top-0 z-30 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-8 flex items-center justify-between">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
            {getPageTitle()}
          </h2>
          <p className="text-xs text-slate-500 hidden sm:block">
            Commercial IoT Locker Control Unit &bull; Real-time Hardware Telemetry
          </p>
        </div>
      </div>

      {/* Right: Telemetry & Status Badges */}
      <div className="flex items-center gap-3">
        {/* Live pickup reminder banner if active */}
        {reminder && (
          <Link
            to="/parcel-monitoring"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-medium hover:bg-amber-100 transition"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>Pickup Window: {reminder.remainingMinutes}m remaining</span>
          </Link>
        )}

        {/* ESP32 Status Pill */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            isOnline
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
              : 'bg-rose-50 text-rose-700 border-rose-200/80'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="hidden sm:inline">ESP32:</span>
          <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        {/* Security Alerts indicator */}
        <Link
          to="/security-monitoring"
          className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          title="Security Alerts"
        >
          <Bell className="w-5 h-5" />
          {unacknowledgedAlerts > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
              {unacknowledgedAlerts}
            </span>
          )}
        </Link>

        {/* Direct Link to Public Delivery Access page for quick testing */}
        <Link
          to="/delivery-access"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 text-xs font-medium transition"
          title="Preview courier delivery PIN access page"
        >
          <span>Delivery Portal</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>

        {/* Live Clock */}
        <div className="hidden xl:flex items-center gap-2 pl-3 border-l border-slate-200 text-xs font-mono text-slate-500">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
    </header>
  );
}
