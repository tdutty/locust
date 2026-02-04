'use client';

import { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Mail,
  Users,
  Calendar,
  Download,
  Filter,
} from 'lucide-react';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('7d');

  const stats = {
    emailsSent: { value: 47, change: 12, trend: 'up' },
    responses: { value: 12, change: 3, trend: 'up' },
    responseRate: { value: 25.5, change: -2.1, trend: 'down' },
    meetings: { value: 4, change: 1, trend: 'up' },
  };

  const weeklyData = [
    { day: 'Mon', sent: 8, responses: 2, meetings: 1 },
    { day: 'Tue', sent: 12, responses: 4, meetings: 1 },
    { day: 'Wed', sent: 6, responses: 1, meetings: 0 },
    { day: 'Thu', sent: 10, responses: 3, meetings: 1 },
    { day: 'Fri', sent: 7, responses: 2, meetings: 1 },
    { day: 'Sat', sent: 2, responses: 0, meetings: 0 },
    { day: 'Sun', sent: 2, responses: 0, meetings: 0 },
  ];

  const topPerformingSubjects = [
    { subject: 'How to compete with corporate landlords', openRate: 68, responseRate: 32 },
    { subject: '{{company}} relocations - a better way', openRate: 62, responseRate: 28 },
    { subject: 'Your {{city}} vacancies are costing you $X/day', openRate: 58, responseRate: 24 },
    { subject: 'Should I close your file?', openRate: 72, responseRate: 18 },
    { subject: 'We\'re onboarding 5 {{city}} landlords this month', openRate: 55, responseRate: 22 },
  ];

  const pipelineBreakdown = [
    { stage: 'Lead', count: 15, value: 0 },
    { stage: 'Contacted', count: 8, value: 12800 },
    { stage: 'Qualified', count: 5, value: 8500 },
    { stage: 'Proposal', count: 3, value: 6200 },
    { stage: 'Negotiation', count: 2, value: 4800 },
    { stage: 'Closed', count: 1, value: 2400 },
  ];

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
          <button className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Emails Sent"
          value={stats.emailsSent.value.toString()}
          change={stats.emailsSent.change}
          trend={stats.emailsSent.trend as 'up' | 'down'}
          icon={<Mail className="w-5 h-5 text-blue-600" />}
        />
        <MetricCard
          label="Responses"
          value={stats.responses.value.toString()}
          change={stats.responses.change}
          trend={stats.responses.trend as 'up' | 'down'}
          icon={<Users className="w-5 h-5 text-green-600" />}
        />
        <MetricCard
          label="Response Rate"
          value={`${stats.responseRate.value}%`}
          change={stats.responseRate.change}
          trend={stats.responseRate.trend as 'up' | 'down'}
          icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
        />
        <MetricCard
          label="Meetings Booked"
          value={stats.meetings.value.toString()}
          change={stats.meetings.change}
          trend={stats.meetings.trend as 'up' | 'down'}
          icon={<Calendar className="w-5 h-5 text-orange-600" />}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Weekly Activity</h3>
          <div className="space-y-3">
            {weeklyData.map((day) => (
              <div key={day.day} className="flex items-center gap-4">
                <span className="w-8 text-sm text-gray-500">{day.day}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full"
                      style={{ width: `${(day.sent / 15) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-8">{day.sent}</span>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-green-500 h-full rounded-full"
                      style={{ width: `${(day.responses / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-8">{day.responses}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="text-sm text-gray-600">Emails Sent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm text-gray-600">Responses</span>
            </div>
          </div>
        </div>

        {/* Top Performing Subjects */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Top Performing Subject Lines</h3>
          <div className="space-y-3">
            {topPerformingSubjects.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <p className="text-sm text-gray-700 truncate flex-1 mr-4">{item.subject}</p>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{item.openRate}%</p>
                    <p className="text-xs text-gray-500">Open</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600">{item.responseRate}%</p>
                    <p className="text-xs text-gray-500">Reply</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Pipeline Breakdown</h3>
          <div className="grid grid-cols-6 gap-4">
            {pipelineBreakdown.map((stage) => (
              <div key={stage.stage} className="text-center">
                <div className="h-32 bg-gray-100 rounded-lg flex items-end justify-center p-2 mb-2">
                  <div
                    className="w-full bg-green-500 rounded"
                    style={{ height: `${(stage.count / 15) * 100}%` }}
                  />
                </div>
                <p className="text-sm font-medium text-gray-900">{stage.stage}</p>
                <p className="text-lg font-bold text-gray-900">{stage.count}</p>
                {stage.value > 0 && (
                  <p className="text-xs text-gray-500">${stage.value.toLocaleString()}</p>
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
        <div className={`flex items-center gap-1 text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {change > 0 ? '+' : ''}{change}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
