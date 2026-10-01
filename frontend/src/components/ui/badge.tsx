import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'purple' | 'success';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantStyles = {
    default: 'bg-purple-600/20 text-purple-300 border-purple-500/30',
    secondary: 'bg-slate-800 text-slate-300 border-slate-700',
    destructive: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    outline: 'text-slate-300 border-white/10',
    purple: 'bg-purple-500/15 text-purple-300 border-purple-400/40 shadow-[0_0_12px_rgba(168,85,247,0.2)]',
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
