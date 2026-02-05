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
      'card p-5 group hover:bg-black hover:text-white transition-all duration-200',
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-black/60 group-hover:text-white/60 mb-2">{label}</p>
          <p className="text-3xl font-light tracking-tight">{value}</p>
          {subtext && <p className="text-xs text-black/50 group-hover:text-white/50 mt-1">{subtext}</p>}
        </div>
        {icon && (
          <div className="w-10 h-10 border-2 border-black group-hover:border-white flex items-center justify-center transition-colors duration-200">
            <span className="text-black group-hover:text-white transition-colors duration-200">{icon}</span>
          </div>
        )}
      </div>
    </div>
  );
}
