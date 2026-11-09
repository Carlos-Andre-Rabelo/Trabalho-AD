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
  highlight = false,
}) => {
  return (
    <div
      className={`rounded-lg border p-3.5 ${
        highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
      }`}
    >
      <div className="text-xs font-medium text-slate-500 mb-1">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-slate-900">
          {value !== null && value !== undefined ? value : '—'}
        </span>
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
    </div>
  );
};
