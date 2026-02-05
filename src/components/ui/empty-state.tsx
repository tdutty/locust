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
      <div className="w-16 h-16 border-2 border-black/20 flex items-center justify-center mb-4 text-black/30">
        {resolvedIcon || <Inbox className="w-8 h-8" />}
      </div>
      <h3 className="text-sm font-medium uppercase tracking-wider text-black/60">{title}</h3>
      {description && <p className="text-sm text-black/40 mt-2 max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
