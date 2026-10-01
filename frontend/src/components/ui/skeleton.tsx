import { cn } from '../../lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-purple-950/30 border border-purple-500/10', className)}
      {...props}
    />
  );
}

export { Skeleton };
