import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  noBorder?: boolean;
}

export function PageHeader({ title, description, icon, actions, badge, className, noBorder }: PageHeaderProps) {
  return (
    <div className={cn(
      'flex items-start justify-between',
      !noBorder && 'pb-4 border-b border-slate-200',
      className
    )}>
      <div>
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-slate-400">{icon}</span>}
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
          {badge}
        </div>
        {description && <p className="text-sm text-slate-500 mt-0.5 ml-0">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
