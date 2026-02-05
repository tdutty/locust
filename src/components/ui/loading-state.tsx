import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16', className)}>
      <div className="w-8 h-8 border-2 border-black border-t-transparent animate-spin mb-4" />
      <p className="text-sm text-black/60 uppercase tracking-wider">{message}</p>
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="h-10 w-10 bg-black/10 border border-black/20" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-black/10 w-3/4" />
            <div className="h-3 bg-black/10 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
