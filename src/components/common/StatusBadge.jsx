import React from 'react';

export default function StatusBadge({ status, variant, size = 'sm', pulse = false }) {
  const getColors = () => {
    switch (variant || status?.toLowerCase()) {
      case 'online':
      case 'locked':
      case 'normal':
      case 'success':
      case 'authorized':
      case 'completed':
      case 'collected':
      case 'green':
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20';
      case 'unlocked':
      case 'delivered':
      case 'active':
      case 'warning':
      case 'pending':
      case 'orange':
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20';
      case 'offline':
      case 'tampering':
      case 'tampering detected':
      case 'danger':
      case 'critical':
      case 'denied':
      case 'rejected':
      case 'expired':
      case 'overdue':
      case 'red':
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20';
      case 'blue':
      case 'indigo':
        return 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20';
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200 ring-purple-500/20';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 ring-slate-500/20';
    }
  };

  const getDotColor = () => {
    switch (variant || status?.toLowerCase()) {
      case 'online':
      case 'locked':
      case 'normal':
      case 'success':
      case 'authorized':
      case 'completed':
      case 'collected':
      case 'green':
      case 'emerald':
        return 'bg-emerald-500';
      case 'unlocked':
      case 'delivered':
      case 'active':
      case 'warning':
      case 'pending':
      case 'orange':
      case 'amber':
        return 'bg-amber-500';
      case 'offline':
      case 'tampering':
      case 'tampering detected':
      case 'danger':
      case 'critical':
      case 'denied':
      case 'rejected':
      case 'expired':
      case 'overdue':
      case 'red':
      case 'rose':
        return 'bg-rose-500';
      case 'blue':
      case 'indigo':
        return 'bg-blue-500';
      case 'purple':
        return 'bg-purple-500';
      default:
        return 'bg-slate-400';
    }
  };

  const sizeClasses = size === 'xs' 
    ? 'text-[10px] px-2 py-0.5' 
    : size === 'lg' 
    ? 'text-sm px-3.5 py-1.5' 
    : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border shadow-xs tracking-tight ${sizeClasses} ${getColors()}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${getDotColor()} ${pulse ? 'animate-ping' : ''}`} />
      <span>{status}</span>
    </span>
  );
}
