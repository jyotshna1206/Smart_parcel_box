import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Shield,
  KeyRound,
  Lock,
  Package,
  Radio,
  Volume2
} from 'lucide-react';
import api from '../services/api';

export default function ActivityHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        ...(eventType !== 'all' ? { eventType } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {})
      };

      const res = await api.getActivityHistory(params);
      if (res.success) {
        setLogs(res.logs || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, eventType, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearch('');
    setEventType('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getEventBadge = (type, status) => {
    switch (type) {
      case 'auth':
        return { icon: Shield, color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'locker':
        return { icon: Lock, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'pin':
        return { icon: KeyRound, color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'parcel':
        return { icon: Package, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'security':
        return { icon: Shield, color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'buzzer':
        return { icon: Volume2, color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'device':
        return { icon: Radio, color: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'reminder':
        return { icon: Clock, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
      default:
        return { icon: History, color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const formatDateTime = (ts) => {
    if (!ts) return { date: '—', time: '—' };
    try {
      const d = new Date(ts);
      return {
        date: d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
    } catch (e) {
      return { date: ts, time: '' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Audited System Activity History
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Immutable SQLite transaction logs for hardware events, courier access, lock commands, and owner authentications.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search activity description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
            />
          </div>

          {/* Event Category Filter */}
          <div>
            <select
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            >
              <option value="all">All Event Categories</option>
              <option value="auth">Owner Auth & Sessions</option>
              <option value="locker">Locker Actuator</option>
              <option value="pin">Delivery PINs</option>
              <option value="parcel">Parcel Drop & Pickup</option>
              <option value="security">Tamper & Security</option>
              <option value="buzzer">Buzzer Activations</option>
              <option value="device">ESP32 Connect / Disconnect</option>
              <option value="reminder">2-Hour Pickup Reminders</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          {/* Date Range End */}
          <div className="flex gap-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Activity Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Recorded Activity Audit Records
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-xs">
            No activity records matched your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Event Ref</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Event Description</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const badge = getEventBadge(log.event_type, log.status);
                  const Icon = badge.icon;
                  const dt = formatDateTime(log.created_at);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{log.id}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${badge.color}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{log.event_type}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">{log.event_title}</span>
                        <span className="text-slate-500 text-[11px] leading-relaxed">{log.description}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {dt.date}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {dt.time}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            log.status === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : log.status === 'danger'
                              ? 'bg-rose-50 text-rose-700'
                              : log.status === 'warning'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white transition disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs font-mono text-slate-600">
              Page {pagination.page} / {pagination.totalPages}
            </span>

            <button
              onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
              disabled={page >= pagination.totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white transition disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
