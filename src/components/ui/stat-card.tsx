import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  subtext?: string;
  change?: number;
  trend?: 'up' | 'down';
  className?: string;
}

export function StatCard({ label, value, icon, subtext, change, trend, className }: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
          {change !== undefined && trend && (
            <p className={cn('text-xs mt-1 font-medium', trend === 'up' ? 'text-green-600' : 'text-red-600')}>
              {change > 0 ? '+' : ''}{change} vs prev period
            </p>
          )}
        </div>
        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}
