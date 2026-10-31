import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: {
    positive?: boolean;
    text: string;
  };
  highlight?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  subtext,
  icon,
  trend,
  highlight = false,
}) => {
  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 transition-all ${
        highlight
          ? 'bg-blue-50/60 border-blue-200'
          : 'bg-white border-slate-200/90 shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {value !== null && value !== undefined ? value : '—'}
        </span>
        {unit && <span className="text-sm font-medium text-slate-500">{unit}</span>}
      </div>

      {(subtext || trend) && (
        <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
          {subtext && <span>{subtext}</span>}
          {trend && (
            <span
              className={`font-medium ${
                trend.positive ? 'text-emerald-600' : 'text-slate-600'
              }`}
            >
              {trend.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
