import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  subtext?: string;
  className?: string;
}

export function StatCard({ label, value, icon, subtext, className }: StatCardProps) {
  return (
    <div className={cn(
      'card p-5 hover:shadow-md transition-all duration-200',
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">{label}</p>
          <p className="text-3xl font-light tracking-tight text-slate-900">{value}</p>
          {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
        </div>
        {icon && (
          <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center">
            <span>{icon}</span>
          </div>
        )}
      </div>
    </div>
  );
}
