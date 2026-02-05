import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, actions, badge, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between pb-6 border-b border-slate-200', className)}>
      <div>
        <div className="flex items-center gap-3">
          {icon && <span className="text-slate-900">{icon}</span>}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {badge}
        </div>
        {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
