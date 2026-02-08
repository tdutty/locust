import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  subtext?: string;
  className?: string;
  accent?: 'primary' | 'emerald' | 'amber' | 'red';
}

export function StatCard({ label, value, icon, subtext, className, accent }: StatCardProps) {
  const accentColors = {
    primary: 'border-l-primary',
    emerald: 'border-l-emerald-500',
    amber: 'border-l-amber-500',
    red: 'border-l-red-500',
  };

  return (
    <div className={cn(
      'card p-4 hover:shadow-md transition-all duration-200',
      accent && `border-l-[3px] ${accentColors[accent]}`,
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}
        </div>
        {icon && (
          <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center">
            <span>{icon}</span>
          </div>
        )}
      </div>
    </div>
  );
}
