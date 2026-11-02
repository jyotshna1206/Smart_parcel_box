import React from 'react';
import { useLocker } from '../../context/LockerContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const { toasts, removeToast } = useLocker();

  if (!toasts || toasts.length === 0) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-blue-500 shrink-0" />;
    }
  };

  const getBorderColor = (type) => {
    switch (type) {
      case 'success':
        return 'border-l-4 border-l-emerald-500';
      case 'warning':
        return 'border-l-4 border-l-amber-500';
      case 'error':
        return 'border-l-4 border-l-rose-500';
      default:
        return 'border-l-4 border-l-blue-500';
    }
  };

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto bg-white/95 backdrop-blur-md text-slate-800 shadow-xl rounded-xl p-4 border border-slate-200/80 ${getBorderColor(
            toast.type
          )} flex items-start justify-between gap-3 transform transition-all duration-300 animate-in fade-in slide-in-from-top-4`}
        >
          <div className="flex items-start gap-3">
            {getIcon(toast.type)}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                {toast.title}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {toast.message}
              </p>
              {toast.time && (
                <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                  {toast.time}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-700 transition p-1 -mr-1 -mt-1 rounded-md"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
