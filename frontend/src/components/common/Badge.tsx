import React from 'react';
import { CollectionStatus } from '../../api/collections.js';

interface BadgeProps {
  status?: CollectionStatus | string;
  label?: string;
  variant?: 'draft' | 'in_progress' | 'paused' | 'finished' | 'neutral';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, label, variant, className = '' }) => {
  let effectiveVariant = variant;
  let text = label;

  if (status) {
    switch (status) {
      case 'DRAFT':
        effectiveVariant = 'draft';
        text = text || 'Rascunho';
        break;
      case 'IN_PROGRESS':
        effectiveVariant = 'in_progress';
        text = text || 'Em andamento';
        break;
      case 'PAUSED':
        effectiveVariant = 'paused';
        text = text || 'Pausada';
        break;
      case 'FINISHED':
        effectiveVariant = 'finished';
        text = text || 'Encerrada';
        break;
      default:
        effectiveVariant = 'neutral';
        text = text || status;
    }
  }

  const styles = {
    draft: 'bg-slate-100 text-slate-700 border-slate-300',
    in_progress: 'bg-emerald-50 text-emerald-800 border-emerald-300 animate-pulse',
    paused: 'bg-amber-50 text-amber-800 border-amber-300',
    finished: 'bg-blue-50 text-blue-800 border-blue-300',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        styles[effectiveVariant || 'neutral']
      } ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {text}
    </span>
  );
};
