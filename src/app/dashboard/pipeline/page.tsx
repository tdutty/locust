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
  Plus,
  X,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

interface Deal {
  id: number;
  name: string;
  company?: string;
  type: 'landlord' | 'employer';
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
  { id: 'lead', label: 'Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'closed', label: 'Closed Won' },
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
    name: '', company: '', type: 'landlord' as 'landlord' | 'employer', stage: 'lead' as Deal['stage'],
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

  if (isLoading) {
    return <LoadingState message="Loading pipeline..." />;
  }

  const currentStageIndex = selectedDeal ? STAGES.findIndex(s => s.id === selectedDeal.stage) : -1;
  const nextStage = currentStageIndex >= 0 && currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Sales Pipeline"
        description="Track deals from lead to close"
        icon={<BarChart3 className="w-7 h-7" />}
        badge={dataSource === 'sample' ? (
          <span className="ml-2 px-2 py-0.5 border-2 border-black bg-white text-black text-xs font-medium uppercase tracking-wider">Sample Data</span>
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
          subtext={`${landlordDeals} landlords, ${employerDeals} employers`}
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
              <div className="border-2 border-black border-t-[3px] bg-white">
                <div className="p-3 border-b-2 border-black">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-black uppercase tracking-wider text-sm">{stage.label}</h3>
                    <span className="px-2 py-0.5 border-2 border-black bg-white text-black text-xs font-medium">
                      {stageDeals.length}
                    </span>
                  </div>
                </div>
                {/* Column body */}
                <div className="p-2 min-h-[400px] bg-beige">
                  {stageDeals.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-black/40 text-sm uppercase tracking-wider">
                      No deals
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          onClick={() => setSelectedDeal(deal)}
                          className={`p-3 bg-white border-2 border-black cursor-pointer hover:bg-black hover:text-white transition-all duration-200 group ${
                            selectedDeal?.id === deal.id ? 'border-[3px] border-black' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {deal.type === 'landlord' ? (
                                <Home className="w-4 h-4 text-black group-hover:text-white transition-colors duration-200" />
                              ) : (
                                <Building2 className="w-4 h-4 text-black group-hover:text-white transition-colors duration-200" />
                              )}
                              <span className="font-medium text-sm">
                                {deal.company || deal.name}
                              </span>
                            </div>
                          </div>
                          {deal.type === 'landlord' && deal.value > 0 && (
                            <p className="text-sm text-black/50 group-hover:text-white/60 mt-1 transition-colors duration-200">
                              {formatCurrency(deal.value)} potential
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-black/50 group-hover:text-white/50 transition-colors duration-200">
                              {deal.updated_at ? formatRelativeTime(deal.updated_at) : ''}
                            </span>
                            <span className="text-xs font-medium text-black group-hover:text-white transition-colors duration-200">{deal.probability}%</span>
                          </div>
                          {deal.next_action && (
                            <div className="mt-2 pt-2 border-t-2 border-black/10 group-hover:border-white/20 transition-colors duration-200">
                              <p className="text-xs text-black/60 group-hover:text-white/70 flex items-center gap-1 transition-colors duration-200">
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
        <div className="fixed inset-y-0 right-0 w-96 bg-white border-l-2 border-black p-6 overflow-y-auto z-50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-black uppercase tracking-wider">Deal Details</h3>
            <button
              onClick={() => setSelectedDeal(null)}
              className="p-1 text-black/40 hover:text-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {selectedDeal.type === 'landlord' ? (
                <div className="w-12 h-12 border-2 border-black bg-white flex items-center justify-center">
                  <Home className="w-6 h-6 text-black" />
                </div>
              ) : (
                <div className="w-12 h-12 border-2 border-black bg-black flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <p className="font-medium text-black">{selectedDeal.company || selectedDeal.name}</p>
                <p className="text-sm text-black/50 uppercase tracking-wider text-xs">{selectedDeal.type}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-black p-3">
                <p className="text-xs text-black/50 uppercase tracking-wider">Stage</p>
                <p className="font-medium text-black capitalize">{selectedDeal.stage}</p>
              </div>
              <div className="border-2 border-black p-3">
                <p className="text-xs text-black/50 uppercase tracking-wider">Probability</p>
                <p className="font-medium text-black">{selectedDeal.probability}%</p>
              </div>
              {selectedDeal.type === 'landlord' && (
                <div className="border-2 border-black p-3">
                  <p className="text-xs text-black/50 uppercase tracking-wider">Deal Value</p>
                  <p className="font-medium text-black">{formatCurrency(selectedDeal.value)}</p>
                </div>
              )}
              <div className="border-2 border-black p-3">
                <p className="text-xs text-black/50 uppercase tracking-wider">Days in Stage</p>
                <p className="font-medium text-black">{selectedDeal.days_in_stage || 0} days</p>
              </div>
            </div>

            {selectedDeal.next_action && (
              <div>
                <p className="text-sm font-medium text-black mb-2 uppercase tracking-wider text-xs">Next Action</p>
                <div className="border-2 border-black p-3">
                  <p className="text-sm text-black">{selectedDeal.next_action}</p>
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

            <div className="pt-4 border-t-2 border-black space-y-2">
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
              <div className="pt-4 border-t-2 border-black">
                <p className="text-xs font-medium text-black uppercase tracking-wider mb-3">Activity</p>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-2 h-2 mt-2 bg-black" />
                    <div>
                      <p className="text-sm text-black">Deal created</p>
                      <p className="text-xs text-black/50">{formatRelativeTime(selectedDeal.created_at)}</p>
                    </div>
                  </div>
                  {selectedDeal.stage !== 'lead' && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 mt-2 bg-black" />
                      <div>
                        <p className="text-sm text-black">Moved to {selectedDeal.stage}</p>
                        <p className="text-xs text-black/50">{formatRelativeTime(selectedDeal.updated_at)}</p>
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
          <div className="bg-white border-2 border-black w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-black uppercase tracking-wider">Create Deal</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-black/40 hover:text-black transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1">Name</label>
                <input
                  type="text"
                  value={newDeal.name}
                  onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                  className="input-base"
                  placeholder="Contact or company name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1">Company (optional)</label>
                <input
                  type="text"
                  value={newDeal.company}
                  onChange={(e) => setNewDeal({ ...newDeal, company: e.target.value })}
                  className="input-base"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1">Type</label>
                  <select
                    value={newDeal.type}
                    onChange={(e) => setNewDeal({ ...newDeal, type: e.target.value as 'landlord' | 'employer' })}
                    className="input-base"
                  >
                    <option value="landlord">Landlord</option>
                    <option value="employer">Employer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1">Stage</label>
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
                  <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1">Value ($)</label>
                  <input
                    type="number"
                    value={newDeal.value}
                    onChange={(e) => setNewDeal({ ...newDeal, value: Number(e.target.value) })}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1">Probability (%)</label>
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
                <label className="block text-xs font-medium text-black uppercase tracking-wider mb-1">Next Action</label>
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
