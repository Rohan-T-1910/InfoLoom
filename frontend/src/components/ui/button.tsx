import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'glow';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    const variantStyles = {
      default:
        'bg-purple-600 text-white shadow-lg shadow-purple-600/25 hover:bg-purple-500 hover:shadow-purple-500/40 active:scale-[0.98]',
      destructive:
        'bg-rose-600 text-white shadow-sm hover:bg-rose-500 active:scale-[0.98]',
      outline:
        'border border-purple-500/20 bg-purple-950/20 hover:bg-purple-900/30 hover:border-purple-500/40 text-purple-200',
      secondary:
        'bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 border border-slate-700/50',
      ghost:
        'text-slate-300 hover:bg-purple-950/40 hover:text-purple-200',
      link:
        'text-purple-400 underline-offset-4 hover:underline',
      glow:
        'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:shadow-[0_0_35px_rgba(168,85,247,0.6)] hover:brightness-110 active:scale-[0.98]',
    };

    const sizeStyles = {
      default: 'h-10 px-4 py-2 text-sm',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-12 rounded-lg px-8 text-base font-medium',
      icon: 'h-10 w-10 p-0',
    };

    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
