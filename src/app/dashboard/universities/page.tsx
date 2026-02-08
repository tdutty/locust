'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  Mail,
  MapPin,
  RefreshCw,
  Database,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { FilterPanel, FilterSection } from '@/components/ui/filter-panel';
import { MetricsBar } from '@/components/ui/metrics-bar';
import { SortableTable, Column } from '@/components/ui/sortable-table';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingState } from '@/components/ui/loading-state';

interface University {
  id: string;
  university: string;
  city: string;
  state: string;
  tier: 1 | 2 | 3;
  enrollment: string;
  offCampusPercent: string;
  avgRent: string;
  contactRole: string;
  contactName: string;
  contactEmail: string;
  contactDepartment: string;
  score: number;
  status: string;
  partnershipType: string;
  notes: string;
  source: string;
}

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Tier 1 — Launch', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  2: { label: 'Tier 2 — Volume', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  3: { label: 'Tier 3 — Prestige', color: 'bg-purple-100 text-purple-800 border-purple-200' },
};

const TYPE_LABELS: Record<string, string> = {
  housing_office: 'Housing Office',
  international_office: 'International Office',
  grad_association: 'Grad Association',
  career_services: 'Career Services',
  dean_of_students: 'Dean of Students',
};

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  contacted: 'Contacted',
  meeting_scheduled: 'Meeting Scheduled',
  terms_proposed: 'Terms Proposed',
  active: 'Active',
  renewed: 'Renewed',
};

type SortField = 'university' | 'enrollment' | 'score';
type SortOrder = 'asc' | 'desc';

export default function UniversitiesPage() {
  const router = useRouter();
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filters
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [activeMetricTab, setActiveMetricTab] = useState<string>('all');

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>('university');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContact, setSelectedContact] = useState<University | null>(null);

  const fetchUniversities = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTiers.length > 0) {
        selectedTiers.forEach(t => params.append('tier', t));
      }
      if (selectedStates.length > 0) {
        selectedStates.forEach(s => params.append('state', s));
      }
      if (selectedTypes.length > 0) {
        selectedTypes.forEach(t => params.append('type', t));
      }
      if (selectedStatuses.length > 0) {
        selectedStatuses.forEach(s => params.append('status', s));
      }

      const res = await fetch(`/api/crm/universities?${params.toString()}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setUniversities(data.universities || []);
      setCurrentPage(1);
    } catch {
      setUniversities([]);
    }
  }, [selectedTiers, selectedStates, selectedTypes, selectedStatuses]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchUniversities();
      setIsLoading(false);
    };
    load();
  }, [fetchUniversities]);

  const handleSync = async () => {
    setIsSyncing(true);
    await fetchUniversities();
    setIsSyncing(false);
  };

  // Get unique filter options
  const states = useMemo(() => {
    return [...new Set(universities.map(u => u.state))].sort();
  }, [universities]);

  // Calculate metrics
  const tier1Count = useMemo(() => universities.filter(u => u.tier === 1).length, [universities]);
  const tier2Count = useMemo(() => universities.filter(u => u.tier === 2).length, [universities]);
  const tier3Count = useMemo(() => universities.filter(u => u.tier === 3).length, [universities]);

  // Apply metric tab filter
  const metricFilteredUniversities = useMemo(() => {
    if (activeMetricTab === 'all') return universities;
    if (activeMetricTab === 'tier1') return universities.filter(u => u.tier === 1);
    if (activeMetricTab === 'tier2') return universities.filter(u => u.tier === 2);
    if (activeMetricTab === 'tier3') return universities.filter(u => u.tier === 3);
    return universities;
  }, [universities, activeMetricTab]);

  // Apply filters (tier, state, type, status)
  const filteredUniversities = useMemo(() => {
    return metricFilteredUniversities.filter(u => {
      if (selectedTiers.length > 0 && !selectedTiers.includes(u.tier.toString())) return false;
      if (selectedStates.length > 0 && !selectedStates.includes(u.state)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(u.partnershipType)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(u.status)) return false;
      return true;
    });
  }, [metricFilteredUniversities, selectedTiers, selectedStates, selectedTypes, selectedStatuses]);

  // Apply sorting
  const sortedUniversities = useMemo(() => {
    const sorted = [...filteredUniversities];
    sorted.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      if (sortField === 'university') {
        aVal = a.university;
        bVal = b.university;
      } else if (sortField === 'enrollment') {
        aVal = parseInt(a.enrollment.replace(/,/g, '')) || 0;
        bVal = parseInt(b.enrollment.replace(/,/g, '')) || 0;
      } else if (sortField === 'score') {
        aVal = a.score;
        bVal = b.score;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      } else {
        return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      }
    });
    return sorted;
  }, [filteredUniversities, sortField, sortOrder]);

  // Pagination
  const itemsPerPage = 20;
  const paginatedUniversities = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedUniversities.slice(start, start + itemsPerPage);
  }, [sortedUniversities, currentPage]);

  const totalPages = Math.ceil(sortedUniversities.length / itemsPerPage);

  const handleEmailClick = (uniId: string) => {
    router.push(`/dashboard?lead=${uniId}&type=university`);
  };

  const handleSort = (key: string) => {
    const field = key as SortField;
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const activeFilterCount = selectedTiers.length + selectedStates.length + selectedTypes.length + selectedStatuses.length;

  const handleClearAllFilters = () => {
    setSelectedTiers([]);
    setSelectedStates([]);
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setCurrentPage(1);
  };

  // Build filter sections
  const filterSections: FilterSection[] = [
    {
      id: 'tier',
      title: 'Tier',
      type: 'checkbox',
      options: [
        { value: '1', label: 'Tier 1 — Launch', count: tier1Count },
        { value: '2', label: 'Tier 2 — Volume', count: tier2Count },
        { value: '3', label: 'Tier 3 — Prestige', count: tier3Count },
      ],
      activeValues: selectedTiers,
      onChange: setSelectedTiers,
    },
    {
      id: 'state',
      title: 'State',
      type: 'checkbox',
      options: states.map(state => ({
        value: state,
        label: state,
        count: universities.filter(u => u.state === state).length,
      })),
      activeValues: selectedStates,
      onChange: setSelectedStates,
    },
    {
      id: 'type',
      title: 'Contact Type',
      type: 'checkbox',
      options: [
        { value: 'housing_office', label: 'Housing Office', count: universities.filter(u => u.partnershipType === 'housing_office').length },
        { value: 'international_office', label: 'International Office', count: universities.filter(u => u.partnershipType === 'international_office').length },
        { value: 'grad_association', label: 'Grad Association', count: universities.filter(u => u.partnershipType === 'grad_association').length },
        { value: 'career_services', label: 'Career Services', count: universities.filter(u => u.partnershipType === 'career_services').length },
        { value: 'dean_of_students', label: 'Dean of Students', count: universities.filter(u => u.partnershipType === 'dean_of_students').length },
      ],
      activeValues: selectedTypes,
      onChange: setSelectedTypes,
    },
    {
      id: 'status',
      title: 'Status',
      type: 'checkbox',
      options: [
        { value: 'prospect', label: 'Prospect', count: universities.filter(u => u.status === 'prospect').length },
        { value: 'contacted', label: 'Contacted', count: universities.filter(u => u.status === 'contacted').length },
        { value: 'meeting_scheduled', label: 'Meeting Scheduled', count: universities.filter(u => u.status === 'meeting_scheduled').length },
        { value: 'terms_proposed', label: 'Terms Proposed', count: universities.filter(u => u.status === 'terms_proposed').length },
        { value: 'active', label: 'Active', count: universities.filter(u => u.status === 'active').length },
        { value: 'renewed', label: 'Renewed', count: universities.filter(u => u.status === 'renewed').length },
      ],
      activeValues: selectedStatuses,
      onChange: setSelectedStatuses,
    },
  ];

  const metricTabs = [
    { id: 'all', label: 'Total', count: universities.length },
    { id: 'tier1', label: 'Tier 1', count: tier1Count },
    { id: 'tier2', label: 'Tier 2', count: tier2Count },
    { id: 'tier3', label: 'Tier 3', count: tier3Count },
  ];

  const columns: Column<University>[] = [
    {
      key: 'university',
      label: 'University',
      sortable: true,
      render: (uni: University) => (
        <div className="flex items-center gap-3">
          <AvatarCircle name={uni.university} />
          <div>
            <div className="text-sm font-medium text-slate-900">{uni.university}</div>
            <div className="text-xs text-slate-400">{TYPE_LABELS[uni.partnershipType] || uni.partnershipType}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (uni: University) => (
        <div>
          <div className="text-sm text-slate-900">{uni.contactName}</div>
          <div className="text-xs text-slate-400">{uni.contactRole}</div>
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      render: (uni: University) => (
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <MapPin className="w-3.5 h-3.5" />
          {uni.city}, {uni.state}
        </div>
      ),
    },
    {
      key: 'tier',
      label: 'Tier',
      render: (uni: University) => (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${TIER_LABELS[uni.tier].color}`}>
          {TIER_LABELS[uni.tier].label}
        </span>
      ),
    },
    {
      key: 'enrollment',
      label: 'Enrollment',
      sortable: true,
      render: (uni: University) => (
        <div>
          <div className="text-sm font-medium text-slate-900">{uni.enrollment}</div>
          <div className="text-xs text-slate-400">{uni.offCampusPercent} off-campus</div>
        </div>
      ),
    },
    {
      key: 'avgRent',
      label: 'Avg Rent',
      render: (uni: University) => (
        <div className="text-sm text-slate-900">{uni.avgRent}</div>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      sortable: true,
      render: (uni: University) => (
        <div className="text-sm font-semibold text-slate-900">{uni.score}</div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (uni: University) => (
        <StatusBadge status={uni.status} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (uni: University) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleEmailClick(uni.id); }}
          className="border border-slate-200 p-1.5 hover:bg-slate-100 rounded-md text-slate-600 transition-all duration-200"
          title="Send Outreach Email"
        >
          <Mail className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="flex h-[calc(100vh-48px)]">
      {/* Filter Panel */}
      <FilterPanel
        sections={filterSections}
        onClearAll={handleClearAllFilters}
        activeFilterCount={activeFilterCount}
        isOpen={true}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Metrics Bar */}
        <MetricsBar
          tabs={metricTabs}
          activeTab={activeMetricTab}
          onTabChange={setActiveMetricTab}
        />

        {/* Critical Timing Window Callout */}
        <div className="px-4 pt-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">Critical Timing Window</p>
              <p className="text-sm text-amber-700 mt-1">
                Start outreach by <strong>September</strong> to sign partnerships by November. February housing fairs are the highest-conversion events.
              </p>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <LoadingState message="Loading university contacts..." />
          ) : (
            <div className="bg-white rounded-lg border border-slate-200">
              <SortableTable
                columns={columns}
                data={sortedUniversities}
                keyExtractor={(uni: University) => uni.id}
                sortKey={sortField}
                sortDirection={sortOrder}
                onSort={handleSort}
                onRowClick={(uni: University) => setSelectedContact(selectedContact?.id === uni.id ? null : uni)}
                page={currentPage}
                pageSize={20}
                totalItems={sortedUniversities.length}
                onPageChange={setCurrentPage}
                emptyMessage="No university contacts found matching your criteria."
              />
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedContact && (
          <div className="border-t border-slate-200 p-4 bg-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedContact.university}</h3>
                <p className="text-sm text-slate-500">{selectedContact.contactRole} — {selectedContact.contactDepartment}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${TIER_LABELS[selectedContact.tier].color}`}>
                {TIER_LABELS[selectedContact.tier].label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Enrollment</p>
                <p className="text-sm font-medium text-slate-900">{selectedContact.enrollment}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Off-Campus %</p>
                <p className="text-sm font-medium text-slate-900">{selectedContact.offCampusPercent}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Avg Rent</p>
                <p className="text-sm font-medium text-slate-900">{selectedContact.avgRent}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Lead Score</p>
                <p className="text-sm font-medium text-slate-900">{selectedContact.score}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 mb-4">
              <p className="text-xs text-slate-400 mb-2">Notes</p>
              <p className="text-sm text-slate-700">{selectedContact.notes}</p>
            </div>

            <button
              onClick={() => handleEmailClick(selectedContact.id)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Mail className="w-4 h-4" />
              Send Outreach Email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
