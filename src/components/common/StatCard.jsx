import React from 'react';

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badgeText,
  badgeVariant,
  trend,
  className = '',
  actionButton = null,
}) {
  return (
    <div className={`bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-200/80">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
          )}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
              {title}
            </h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
                {value}
              </span>
            </div>
          </div>
        </div>

        {badgeText && (
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
              badgeVariant === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : badgeVariant === 'danger'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : badgeVariant === 'warning'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>

      {(subtitle || actionButton) && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>{subtitle}</div>
          {actionButton}
        </div>
      )}
    </div>
  );
}
