'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Mail,
  Users,
  Calendar,
  Download,
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { formatCurrency } from '@/lib/utils';

interface Stats {
  emailsSent: number;
  emailsSentPrev: number;
  emailsByType: { lead_type: string; count: number }[];
  pipelineByStage: { stage: string; count: number; total_value: number }[];
  totalDeals: number;
  dailyEmails: { day: string; count: number }[];
  topSubjects: { subject: string; send_count: number }[];
  recentActivity: any[];
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('7d');
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/stats?range=${dateRange}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
    setIsLoading(false);
  };

  const exportCSV = () => {
    if (!stats) return;

    const rows = [
      ['Metric', 'Value'],
      ['Emails Sent', stats.emailsSent.toString()],
      ['Previous Period', stats.emailsSentPrev.toString()],
      ['Total Deals', stats.totalDeals.toString()],
      [''],
      ['Pipeline Stage', 'Count', 'Value'],
      ...stats.pipelineByStage.map(s => [s.stage, s.count.toString(), s.total_value.toString()]),
      [''],
      ['Top Subjects', 'Send Count'],
      ...stats.topSubjects.map(s => [s.subject, s.send_count.toString()]),
    ];

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `locust-report-${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Computed values
  const emailsSent = stats?.emailsSent ?? 0;
  const emailsSentPrev = stats?.emailsSentPrev ?? 0;
  const emailChange = emailsSent - emailsSentPrev;
  const responseCount = stats?.pipelineByStage.reduce((s, p) => s + (p.stage !== 'lead' ? p.count : 0), 0) ?? 0;
  const responseRate = emailsSent > 0 ? ((responseCount / emailsSent) * 100).toFixed(1) : '0';
  const meetingsBooked = stats?.pipelineByStage.find(s => s.stage === 'qualified')?.count ?? 0;

  const pipelineBreakdown = stats?.pipelineByStage.length
    ? stats.pipelineByStage
    : [
        { stage: 'Lead', count: 0, total_value: 0 },
        { stage: 'Contacted', count: 0, total_value: 0 },
        { stage: 'Qualified', count: 0, total_value: 0 },
        { stage: 'Proposal', count: 0, total_value: 0 },
        { stage: 'Negotiation', count: 0, total_value: 0 },
        { stage: 'Closed', count: 0, total_value: 0 },
      ];

  const maxPipelineCount = Math.max(...pipelineBreakdown.map(s => s.count), 1);

  // Build weekly chart from daily data
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyData = dayNames.map(name => {
    const dayEntries = stats?.dailyEmails.filter(d => {
      const date = new Date(d.day);
      return dayNames[date.getDay()] === name;
    }) || [];
    const total = dayEntries.reduce((s, d) => s + d.count, 0);
    return { day: name, sent: total };
  });
  const maxSent = Math.max(...weeklyData.map(d => d.sent), 1);

  if (isLoading && !stats) {
    return <LoadingState message="Loading reports..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-green-600" />
            Reports
          </h1>
          <p className="text-gray-500">Analytics and performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={exportCSV}
            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Emails Sent"
          value={emailsSent.toString()}
          change={emailChange}
          trend={emailChange >= 0 ? 'up' : 'down'}
          icon={<Mail className="w-5 h-5 text-blue-600" />}
        />
        <MetricCard
          label="Responses"
          value={responseCount.toString()}
          change={0}
          trend="up"
          icon={<Users className="w-5 h-5 text-green-600" />}
        />
        <MetricCard
          label="Response Rate"
          value={`${responseRate}%`}
          change={0}
          trend="up"
          icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
        />
        <MetricCard
          label="Meetings Booked"
          value={meetingsBooked.toString()}
          change={0}
          trend="up"
          icon={<Calendar className="w-5 h-5 text-orange-600" />}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Weekly Activity</h3>
          {emailsSent === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              No email activity yet. Send emails to see data here.
            </div>
          ) : (
            <div className="space-y-3">
              {weeklyData.map((day) => (
                <div key={day.day} className="flex items-center gap-4">
                  <span className="w-8 text-sm text-gray-500">{day.day}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{ width: `${(day.sent / maxSent) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-8">{day.sent}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="text-sm text-gray-600">Emails Sent</span>
            </div>
          </div>
        </div>

        {/* Top Performing Subjects */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Top Performing Subject Lines</h3>
          {stats?.topSubjects.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              No subject line data yet.
            </div>
          ) : (
            <div className="space-y-3">
              {(stats?.topSubjects || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <p className="text-sm text-gray-700 truncate flex-1 mr-4">{item.subject}</p>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{item.send_count}x</p>
                    <p className="text-xs text-gray-500">Sent</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Pipeline Breakdown</h3>
          <div className="grid grid-cols-6 gap-4">
            {pipelineBreakdown.map((stage) => (
              <div key={stage.stage} className="text-center">
                <div className="h-32 bg-gray-100 rounded-lg flex items-end justify-center p-2 mb-2">
                  <div
                    className="w-full bg-green-500 rounded transition-all"
                    style={{ height: `${Math.max((stage.count / maxPipelineCount) * 100, stage.count > 0 ? 10 : 0)}%` }}
                  />
                </div>
                <p className="text-sm font-medium text-gray-900 capitalize">{stage.stage}</p>
                <p className="text-lg font-bold text-gray-900">{stage.count}</p>
                {stage.total_value > 0 && (
                  <p className="text-xs text-gray-500">{formatCurrency(stage.total_value)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  trend,
  icon,
}: {
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down';
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        {change !== 0 && (
          <div className={`flex items-center gap-1 text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {change > 0 ? '+' : ''}{change}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
