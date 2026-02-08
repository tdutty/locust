'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Calendar,
  Mail,
  Phone,
  Building2,
  Home,
  GraduationCap,
  Plus,
  X,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

interface Deal {
  id: number;
  name: string;
  company?: string;
  type: 'landlord' | 'employer' | 'university';
  stage: 'lead' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed';
  value: number;
  probability: number;
  notes?: string;
  next_action?: string;
  created_at: string;
  updated_at: string;
  days_in_stage?: number;
}

interface Activity {
  id: number;
  deal_id: number;
  activity_type: string;
  description: string;
  created_at: string;
}

const STAGES = [
  { id: 'lead', label: 'Lead', color: 'bg-slate-400' },
  { id: 'contacted', label: 'Contacted', color: 'bg-sky-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-indigo-500' },
  { id: 'proposal', label: 'Proposal', color: 'bg-blue-500' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-amber-500' },
  { id: 'closed', label: 'Closed Won', color: 'bg-emerald-500' },
];

const SAMPLE_DEALS: Deal[] = [
  { id: 1, name: 'Alexander Phillips', type: 'landlord', stage: 'qualified', value: 3200, probability: 60, next_action: 'Send proposal', created_at: new Date().toISOString(), updated_at: new Date(Date.now() - 2 * 3600000).toISOString(), days_in_stage: 3 },
  { id: 2, name: 'Tesla', company: 'Tesla', type: 'employer', stage: 'proposal', value: 0, probability: 75, next_action: 'Follow up call', created_at: new Date().toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), days_in_stage: 5 },
  { id: 3, name: 'Robert Chen', type: 'landlord', stage: 'contacted', value: 1800, probability: 30, next_action: 'Send case study', created_at: new Date().toISOString(), updated_at: new Date(Date.now() - 3 * 3600000).toISOString(), days_in_stage: 2 },
  { id: 4, name: 'Bank of America', company: 'Bank of America', type: 'employer', stage: 'negotiation', value: 0, probability: 85, next_action: 'Send contract', created_at: new Date().toISOString(), updated_at: new Date(Date.now() - 3 * 3600000).toISOString(), days_in_stage: 7 },
  { id: 5, name: 'Kevin Lee', type: 'landlord', stage: 'lead', value: 2800, probability: 10, next_action: 'Initial outreach', created_at: new Date().toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), days_in_stage: 1 },
  { id: 6, name: 'Boeing Defense', company: 'Boeing Defense', type: 'employer', stage: 'qualified', value: 0, probability: 50, next_action: 'Demo meeting', created_at: new Date().toISOString(), updated_at: new Date(Date.now() - 2 * 86400000).toISOString(), days_in_stage: 4 },
];

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dataSource, setDataSource] = useState<'database' | 'sample'>('sample');

  // Create form
  const [newDeal, setNewDeal] = useState({
    name: '', company: '', type: 'landlord' as 'landlord' | 'employer' | 'university', stage: 'lead' as Deal['stage'],
    value: 0, probability: 10, notes: '', next_action: '',
  });

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    try {
      const res = await fetch('/api/pipeline');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (data.deals && data.deals.length > 0) {
        setDeals(data.deals);
        setDataSource('database');
      } else {
        setDeals(SAMPLE_DEALS);
        setDataSource('sample');
      }
    } catch {
      setDeals(SAMPLE_DEALS);
      setDataSource('sample');
    }
    setIsLoading(false);
  };

  const createDeal = async () => {
    if (!newDeal.name) return;
    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDeal),
      });
      if (res.ok) {
        const data = await res.json();
        setDeals(prev => [data.deal, ...prev]);
        setDataSource('database');
        setShowCreateModal(false);
        setNewDeal({ name: '', company: '', type: 'landlord', stage: 'lead', value: 0, probability: 10, notes: '', next_action: '' });
      }
    } catch (err) {
      console.error('Failed to create deal:', err);
    }
  };

  const moveDeal = async (dealId: number, newStage: string) => {
    try {
      const res = await fetch('/api/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dealId, stage: newStage }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeals(prev => prev.map(d => d.id === dealId ? data.deal : d));
        if (selectedDeal?.id === dealId) setSelectedDeal(data.deal);
      }
    } catch (err) {
      // Optimistic update for sample data
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage as Deal['stage'] } : d));
    }
  };

  const getDealsByStage = (stage: string) => deals.filter(d => d.stage === stage);

  const totalValue = deals
    .filter(d => d.type === 'landlord')
    .reduce((sum, d) => sum + (d.value * d.probability / 100), 0);

  const landlordDeals = deals.filter(d => d.type === 'landlord').length;
  const employerDeals = deals.filter(d => d.type === 'employer').length;
  const universityDeals = deals.filter(d => d.type === 'university').length;

  if (isLoading) {
    return <LoadingState message="Loading pipeline..." />;
  }

  const currentStageIndex = selectedDeal ? STAGES.findIndex(s => s.id === selectedDeal.stage) : -1;
  const nextStage = currentStageIndex >= 0 && currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1] : null;

  const getStageColor = (stageId: string) => {
    return STAGES.find(s => s.id === stageId)?.color ?? 'bg-slate-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Sales Pipeline"
        description="Track deals from lead to close"
        icon={<BarChart3 className="w-7 h-7" />}
        badge={dataSource === 'sample' ? (
          <span className="ml-2 px-2 py-0.5 border border-slate-200 rounded-md bg-white text-slate-600 text-xs font-medium">Sample Data</span>
        ) : undefined}
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Create Deal
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Deals"
          value={deals.length.toString()}
          icon={<Users className="w-5 h-5" />}
          subtext={`${landlordDeals} landlords, ${employerDeals} employers, ${universityDeals} universities`}
        />
        <StatCard
          label="Weighted Pipeline"
          value={formatCurrency(totalValue)}
          icon={<DollarSign className="w-5 h-5" />}
          subtext="Expected revenue"
        />
        <StatCard
          label="Avg Deal Size"
          value={landlordDeals > 0 ? formatCurrency(Math.round(totalValue / landlordDeals)) : '$0'}
          icon={<TrendingUp className="w-5 h-5" />}
          subtext="Landlord fees"
        />
        <StatCard
          label="Conversion Rate"
          value={deals.length > 0 ? `${Math.round((deals.filter(d => d.stage === 'closed').length / deals.length) * 100)}%` : '0%'}
          icon={<BarChart3 className="w-5 h-5" />}
          subtext="Lead to closed"
        />
      </div>

      {/* Pipeline Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageDeals = getDealsByStage(stage.id);
          return (
            <div key={stage.id} className="flex-shrink-0 w-72">
              {/* Column header */}
              <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                <div className={`h-0.5 ${stage.color}`} />
                <div className="p-3 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                      <h3 className="font-medium text-slate-900 text-sm">{stage.label}</h3>
                    </div>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                      {stageDeals.length}
                    </span>
                  </div>
                </div>
                {/* Column body */}
                <div className="p-2 min-h-[400px] bg-slate-50/50">
                  {stageDeals.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-slate-400 text-sm">
                      No deals
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          onClick={() => setSelectedDeal(deal)}
                          className={`p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:shadow-md transition-all duration-200 ${
                            selectedDeal?.id === deal.id ? 'ring-2 ring-primary border-primary' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <AvatarCircle name={deal.company || deal.name} size="sm" />
                              <span className="font-medium text-sm text-slate-900">
                                {deal.company || deal.name}
                              </span>
                            </div>
                          </div>
                          {deal.type === 'landlord' && deal.value > 0 && (
                            <p className="text-sm text-slate-500 mt-1">
                              {formatCurrency(deal.value)} potential
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-slate-500">
                              {deal.updated_at ? formatRelativeTime(deal.updated_at) : ''}
                            </span>
                            <span className="text-xs font-medium text-slate-900">{deal.probability}%</span>
                          </div>
                          {deal.next_action && (
                            <div className="mt-2 pt-2 border-t border-slate-100">
                              <p className="text-xs text-slate-600 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" />
                                {deal.next_action}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal Detail Panel */}
      {selectedDeal && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-xl p-6 overflow-y-auto z-50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-slate-900">Deal Details</h3>
            <button
              onClick={() => setSelectedDeal(null)}
              className="p-1 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {selectedDeal.type === 'landlord' ? (
                <div className="w-12 h-12 border border-slate-200 rounded-lg bg-white flex items-center justify-center">
                  <Home className="w-6 h-6 text-slate-600" />
                </div>
              ) : selectedDeal.type === 'university' ? (
                <div className="w-12 h-12 border border-slate-200 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
              ) : (
                <div className="w-12 h-12 border border-slate-200 rounded-lg bg-primary flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <p className="font-medium text-slate-900">{selectedDeal.company || selectedDeal.name}</p>
                <p className="text-sm text-slate-500 text-xs">{selectedDeal.type}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500">Stage</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${getStageColor(selectedDeal.stage)}`} />
                  <p className="font-medium text-slate-900 capitalize">{selectedDeal.stage}</p>
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500">Probability</p>
                <p className="font-medium text-slate-900">{selectedDeal.probability}%</p>
              </div>
              {selectedDeal.type === 'landlord' && (
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Deal Value</p>
                  <p className="font-medium text-slate-900">{formatCurrency(selectedDeal.value)}</p>
                </div>
              )}
              <div className="border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500">Days in Stage</p>
                <p className="font-medium text-slate-900">{selectedDeal.days_in_stage || 0} days</p>
              </div>
            </div>

            {selectedDeal.next_action && (
              <div>
                <p className="text-sm font-medium text-slate-900 mb-2 text-xs">Next Action</p>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-sm text-slate-900">{selectedDeal.next_action}</p>
                </div>
              </div>
            )}

            {/* Move to next stage */}
            {nextStage && (
              <button
                onClick={() => moveDeal(selectedDeal.id, nextStage.id)}
                className="btn-secondary w-full justify-center"
              >
                <ChevronRight className="w-4 h-4" />
                Move to {nextStage.label}
              </button>
            )}

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <button className="btn-primary w-full">
                <Mail className="w-4 h-4" />
                Send Email
              </button>
              <button className="btn-secondary w-full">
                <Phone className="w-4 h-4" />
                Log Call
              </button>
              <button className="btn-secondary w-full">
                <Calendar className="w-4 h-4" />
                Schedule Meeting
              </button>
            </div>

            {/* Activity Timeline */}
            {selectedDeal.created_at && (
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-900 mb-3">Activity</p>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm text-slate-900">Deal created</p>
                      <p className="text-xs text-slate-500">{formatRelativeTime(selectedDeal.created_at)}</p>
                    </div>
                  </div>
                  {selectedDeal.stage !== 'lead' && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm text-slate-900">Moved to {selectedDeal.stage}</p>
                        <p className="text-xs text-slate-500">{formatRelativeTime(selectedDeal.updated_at)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Deal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-900">Create Deal</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newDeal.name}
                  onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                  className="input-base"
                  placeholder="Contact or company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company (optional)</label>
                <input
                  type="text"
                  value={newDeal.company}
                  onChange={(e) => setNewDeal({ ...newDeal, company: e.target.value })}
                  className="input-base"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={newDeal.type}
                    onChange={(e) => setNewDeal({ ...newDeal, type: e.target.value as 'landlord' | 'employer' | 'university' })}
                    className="input-base"
                  >
                    <option value="landlord">Landlord</option>
                    <option value="employer">Employer</option>
                    <option value="university">University</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
                  <select
                    value={newDeal.stage}
                    onChange={(e) => setNewDeal({ ...newDeal, stage: e.target.value as Deal['stage'] })}
                    className="input-base"
                  >
                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Value ($)</label>
                  <input
                    type="number"
                    value={newDeal.value}
                    onChange={(e) => setNewDeal({ ...newDeal, value: Number(e.target.value) })}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Probability (%)</label>
                  <input
                    type="number"
                    value={newDeal.probability}
                    onChange={(e) => setNewDeal({ ...newDeal, probability: Number(e.target.value) })}
                    className="input-base"
                    min={0} max={100}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Next Action</label>
                <input
                  type="text"
                  value={newDeal.next_action}
                  onChange={(e) => setNewDeal({ ...newDeal, next_action: e.target.value })}
                  className="input-base"
                  placeholder="e.g., Send intro email"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={createDeal}
                  disabled={!newDeal.name}
                  className="btn-primary flex-1"
                >
                  Create Deal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
