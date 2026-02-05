import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  new: 'border-black bg-white text-black',
  contacted: 'border-black bg-black text-white',
  responded: 'border-black bg-black text-white',
  qualified: 'border-black bg-black text-white',
  closed: 'border-black bg-black text-white',
  lost: 'border-black bg-white text-black/50',
  sent: 'border-black bg-black text-white',
  // Classification types
  interested: 'border-black bg-black text-white',
  objection: 'border-black bg-white text-black',
  not_interested: 'border-black bg-white text-black/50',
  question: 'border-black bg-white text-black',
  spam: 'border-black bg-white text-black/30',
  system: 'border-black bg-white text-black/50',
  // Pipeline stages
  lead: 'border-black bg-white text-black',
  proposal: 'border-black bg-black text-white',
  negotiation: 'border-black bg-black text-white',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-block px-2 py-0.5 text-xs font-medium uppercase tracking-wider border',
      STATUS_STYLES[status] || 'border-black bg-white text-black',
      className
    )}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
