'use client';

import { useState } from 'react';
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
} from 'lucide-react';

interface Deal {
  id: string;
  name: string;
  company?: string;
  type: 'landlord' | 'employer';
  stage: 'lead' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed';
  value: number;
  probability: number;
  lastActivity: string;
  nextAction?: string;
  daysInStage: number;
}

const SAMPLE_DEALS: Deal[] = [
  { id: '1', name: 'Alexander Phillips', type: 'landlord', stage: 'qualified', value: 3200, probability: 60, lastActivity: '2 hours ago', nextAction: 'Send proposal', daysInStage: 3 },
  { id: '2', name: 'Tesla', company: 'Tesla', type: 'employer', stage: 'proposal', value: 0, probability: 75, lastActivity: '1 day ago', nextAction: 'Follow up call', daysInStage: 5 },
  { id: '3', name: 'Robert Chen', type: 'landlord', stage: 'contacted', value: 1800, probability: 30, lastActivity: '3 hours ago', nextAction: 'Send case study', daysInStage: 2 },
  { id: '4', name: 'Bank of America', company: 'Bank of America', type: 'employer', stage: 'negotiation', value: 0, probability: 85, lastActivity: '3 hours ago', nextAction: 'Send contract', daysInStage: 7 },
  { id: '5', name: 'Kevin Lee', type: 'landlord', stage: 'lead', value: 2800, probability: 10, lastActivity: '1 day ago', nextAction: 'Initial outreach', daysInStage: 1 },
  { id: '6', name: 'Boeing Defense', company: 'Boeing Defense', type: 'employer', stage: 'qualified', value: 0, probability: 50, lastActivity: '2 days ago', nextAction: 'Demo meeting', daysInStage: 4 },
  { id: '7', name: 'Maria Garcia', type: 'landlord', stage: 'contacted', value: 2100, probability: 25, lastActivity: '4 days ago', nextAction: 'Follow up email', daysInStage: 6 },
  { id: '8', name: 'Apple', company: 'Apple', type: 'employer', stage: 'lead', value: 0, probability: 15, lastActivity: '1 day ago', nextAction: 'Initial outreach', daysInStage: 1 },
];

const STAGES = [
  { id: 'lead', label: 'Lead', color: 'bg-gray-100 border-gray-300' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-50 border-blue-300' },
  { id: 'qualified', label: 'Qualified', color: 'bg-yellow-50 border-yellow-300' },
  { id: 'proposal', label: 'Proposal', color: 'bg-purple-50 border-purple-300' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-50 border-orange-300' },
  { id: 'closed', label: 'Closed Won', color: 'bg-green-50 border-green-300' },
];

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>(SAMPLE_DEALS);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const getDealsByStage = (stage: string) => deals.filter(d => d.stage === stage);

  const totalValue = deals
    .filter(d => d.type === 'landlord')
    .reduce((sum, d) => sum + (d.value * d.probability / 100), 0);

  const landlordDeals = deals.filter(d => d.type === 'landlord').length;
  const employerDeals = deals.filter(d => d.type === 'employer').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-green-600" />
            Sales Pipeline
          </h1>
          <p className="text-gray-500">Track deals from lead to close</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Deals"
          value={deals.length.toString()}
          icon={<Users className="w-5 h-5 text-blue-600" />}
          subtext={`${landlordDeals} landlords, ${employerDeals} employers`}
        />
        <StatCard
          label="Weighted Pipeline"
          value={`$${totalValue.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5 text-green-600" />}
          subtext="Expected revenue"
        />
        <StatCard
          label="Avg Deal Size"
          value={`$${Math.round(totalValue / landlordDeals).toLocaleString()}`}
          icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
          subtext="Landlord fees"
        />
        <StatCard
          label="Conversion Rate"
          value="25%"
          icon={<BarChart3 className="w-5 h-5 text-orange-600" />}
          subtext="Lead to closed"
        />
      </div>

      {/* Pipeline Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageDeals = getDealsByStage(stage.id);
          return (
            <div key={stage.id} className="flex-shrink-0 w-72">
              <div className={`rounded-t-xl border-t-4 ${stage.color.split(' ')[1]} bg-white`}>
                <div className="p-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{stage.label}</h3>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                      {stageDeals.length}
                    </span>
                  </div>
                </div>
                <div className={`p-2 min-h-[400px] ${stage.color.split(' ')[0]} rounded-b-xl`}>
                  <div className="space-y-2">
                    {stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        onClick={() => setSelectedDeal(deal)}
                        className={`p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-shadow ${
                          selectedDeal?.id === deal.id ? 'ring-2 ring-green-500' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {deal.type === 'landlord' ? (
                              <Home className="w-4 h-4 text-green-600" />
                            ) : (
                              <Building2 className="w-4 h-4 text-blue-600" />
                            )}
                            <span className="font-medium text-gray-900 text-sm">
                              {deal.company || deal.name}
                            </span>
                          </div>
                        </div>
                        {deal.type === 'landlord' && (
                          <p className="text-sm text-gray-500 mt-1">
                            ${deal.value.toLocaleString()} potential
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">{deal.lastActivity}</span>
                          <span className="text-xs font-medium text-green-600">{deal.probability}%</span>
                        </div>
                        {deal.nextAction && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              <ArrowRight className="w-3 h-3" />
                              {deal.nextAction}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal Detail Panel */}
      {selectedDeal && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Deal Details</h3>
            <button
              onClick={() => setSelectedDeal(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {selectedDeal.type === 'landlord' ? (
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Home className="w-6 h-6 text-green-600" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">{selectedDeal.company || selectedDeal.name}</p>
                <p className="text-sm text-gray-500 capitalize">{selectedDeal.type}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Stage</p>
                <p className="font-medium text-gray-900 capitalize">{selectedDeal.stage}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Probability</p>
                <p className="font-medium text-green-600">{selectedDeal.probability}%</p>
              </div>
              {selectedDeal.type === 'landlord' && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Deal Value</p>
                  <p className="font-medium text-gray-900">${selectedDeal.value.toLocaleString()}</p>
                </div>
              )}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Days in Stage</p>
                <p className="font-medium text-gray-900">{selectedDeal.daysInStage} days</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Next Action</p>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">{selectedDeal.nextAction}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 space-y-2">
              <button className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors">
                <Mail className="w-4 h-4" />
                Send Email
              </button>
              <button className="w-full py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                <Phone className="w-4 h-4" />
                Log Call
              </button>
              <button className="w-full py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                <Calendar className="w-4 h-4" />
                Schedule Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, subtext }: { label: string; value: string; icon: React.ReactNode; subtext?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}
