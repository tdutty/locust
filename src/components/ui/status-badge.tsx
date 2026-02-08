import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  // Active / positive states
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  sent: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  replied: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  contacted: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  responded: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  qualified: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  interested: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  closed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  renewed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  // Pending / warning states
  new: 'bg-amber-50 text-amber-700 border border-amber-200',
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  draft: 'bg-amber-50 text-amber-700 border border-amber-200',
  scheduled: 'bg-amber-50 text-amber-700 border border-amber-200',
  lead: 'bg-amber-50 text-amber-700 border border-amber-200',
  question: 'bg-amber-50 text-amber-700 border border-amber-200',
  objection: 'bg-amber-50 text-amber-700 border border-amber-200',
  prospect: 'bg-amber-50 text-amber-700 border border-amber-200',
  // In-progress / informational states
  processing: 'bg-blue-50 text-blue-700 border border-blue-200',
  in_progress: 'bg-blue-50 text-blue-700 border border-blue-200',
  proposal: 'bg-blue-50 text-blue-700 border border-blue-200',
  negotiation: 'bg-blue-50 text-blue-700 border border-blue-200',
  meeting_scheduled: 'bg-blue-50 text-blue-700 border border-blue-200',
  terms_proposed: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  // Error / negative states
  failed: 'bg-red-50 text-red-700 border border-red-200',
  error: 'bg-red-50 text-red-700 border border-red-200',
  bounced: 'bg-red-50 text-red-700 border border-red-200',
  lost: 'bg-red-50 text-red-700 border border-red-200',
  not_interested: 'bg-red-50 text-red-700 border border-red-200',
  spam: 'bg-red-50 text-red-700 border border-red-200',
  // Neutral
  system: 'bg-slate-50 text-slate-700 border border-slate-200',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-block px-2.5 py-0.5 text-xs font-medium rounded-full',
      STATUS_STYLES[status] || 'bg-slate-50 text-slate-700 border border-slate-200',
      className
    )}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
