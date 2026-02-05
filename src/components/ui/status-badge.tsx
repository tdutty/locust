import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  responded: 'bg-green-100 text-green-700',
  qualified: 'bg-purple-100 text-purple-700',
  closed: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-gray-100 text-gray-700',
  // Classification types
  interested: 'bg-green-100 text-green-700',
  objection: 'bg-yellow-100 text-yellow-700',
  not_interested: 'bg-red-100 text-red-700',
  question: 'bg-blue-100 text-blue-700',
  spam: 'bg-gray-100 text-gray-700',
  system: 'bg-purple-100 text-purple-700',
  // Pipeline stages
  lead: 'bg-gray-100 text-gray-700',
  proposal: 'bg-purple-100 text-purple-700',
  negotiation: 'bg-orange-100 text-orange-700',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      'px-2 py-0.5 text-xs font-medium rounded-full',
      STATUS_STYLES[status] || 'bg-gray-100 text-gray-700',
      className
    )}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
