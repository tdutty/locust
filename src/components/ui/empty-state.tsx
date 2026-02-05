import { Inbox, Search, Mail, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ReactNode> = {
  inbox: <Inbox className="w-12 h-12" />,
  search: <Search className="w-12 h-12" />,
  mail: <Mail className="w-12 h-12" />,
  chart: <BarChart3 className="w-12 h-12" />,
};

interface EmptyStateProps {
  icon?: React.ReactNode | string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const resolvedIcon = typeof icon === 'string' ? (ICON_MAP[icon] || <Inbox className="w-12 h-12" />) : icon;

  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mb-4 text-slate-400">
        {resolvedIcon || <Inbox className="w-8 h-8" />}
      </div>
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-2 max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
