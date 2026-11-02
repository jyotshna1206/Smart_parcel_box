import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Lock,
  PackageCheck,
  KeyRound,
  QrCode,
  ShieldAlert,
  History,
  Settings,
  LogOut,
  Radio,
  Box,
  User,
  ChevronRight
} from 'lucide-react';
import { useLocker } from '../../context/LockerContext';

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const { logout, owner, dashboardData } = useLocker();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    if (setMobileOpen) setMobileOpen(false);
  };

  const isOnline = dashboardData?.device?.status === 'online';
  const parcelPresent = dashboardData?.parcel?.present;
  const unacknowledgedAlerts = dashboardData?.security?.unacknowledgedAlertsCount || 0;

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Locker Control', path: '/locker-control', icon: Lock },
    {
      name: 'Parcel Monitoring',
      path: '/parcel-monitoring',
      icon: PackageCheck,
      badge: parcelPresent ? 'Parcel In' : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
    },
    { name: 'Generate Access PIN', path: '/generate-pin', icon: KeyRound },
    { name: 'Delivery Access QR & Link', path: '/delivery-qr', icon: QrCode },
    {
      name: 'Security Monitoring',
      path: '/security-monitoring',
      icon: ShieldAlert,
      badge: unacknowledgedAlerts > 0 ? `${unacknowledgedAlerts} Alert${unacknowledgedAlerts > 1 ? 's' : ''}` : null,
      badgeColor: 'bg-rose-500 text-white animate-pulse'
    },
    { name: 'Activity History', path: '/activity-history', icon: History },
    { name: 'Account Settings', path: '/account-settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Logo Header */}
        <div className="h-20 px-6 flex items-center gap-3.5 border-b border-slate-800/90 bg-slate-950/40">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-tight">
              Smart Package Locker
            </h1>
            <p className="text-[11px] text-blue-400 font-mono tracking-wider uppercase font-semibold">
              IoT Security Platform
            </p>
          </div>
        </div>

        {/* ESP32 Hardware Status Telemetry Pill */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/25">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-slate-400" />
              ESP32 DevKit V1
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen && setMobileOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Bottom User Profile Section */}
        <div className="p-4 border-t border-slate-800/90 bg-slate-950/40">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                {owner?.fullName ? owner.fullName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate max-w-[130px]">
                  {owner?.fullName || 'Owner Admin'}
                </p>
                <p className="text-[10px] text-slate-400 truncate max-w-[130px] font-mono">
                  {owner?.email || 'owner@smartlocker'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
