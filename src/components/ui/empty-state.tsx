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
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="w-12 h-12 text-gray-300 mb-3">
        {resolvedIcon || <Inbox className="w-12 h-12" />}
      </div>
      <h3 className="text-gray-600 font-medium">{title}</h3>
      {description && <p className="text-gray-400 text-sm mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
