'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  RefreshCw,
  Database,
} from 'lucide-react';
import { FilterPanel, FilterSection } from '@/components/ui/filter-panel';
import { MetricsBar } from '@/components/ui/metrics-bar';
import { SortableTable, Column } from '@/components/ui/sortable-table';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import { StatusBadge } from '@/components/ui/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { formatCurrency } from '@/lib/utils';

interface Employer {
  id: string;
  company: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  phone: string;
  relocation_count: number;
  city: string;
  state: string;
  industry: string;
  employees: number;
  score: number;
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'closed' | 'lost';
  source?: string;
}

const PAGE_LIMIT = 50;

export default function EmployersPage() {
  const router = useRouter();
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [dataSource, setDataSource] = useState<'Cricket' | 'Sample Data'>('Sample Data');

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [industryFilter, setIndustryFilter] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string[]>([]);

  // Sorting state
  const [sortKey, setSortKey] = useState<string>('company');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string>('total');

  const fetchEmployers = useCallback(async (currentOffset: number, append: boolean = false) => {
    try {
      const res = await fetch(`/api/crm/employers?limit=${PAGE_LIMIT}&offset=${currentOffset}`);
      if (!res.ok) throw new Error(`API responded with ${res.status}`);
      const data = await res.json();

      if (!data.employers || !Array.isArray(data.employers) || data.employers.length === 0) {
        throw new Error('No employer data returned');
      }

      const mapped: Employer[] = data.employers.map((e: Employer) => ({
        id: e.id,
        company: e.company,
        contact_name: e.contact_name,
        contact_title: e.contact_title,
        contact_email: e.contact_email,
        phone: e.phone,
        relocation_count: e.relocation_count,
        city: e.city,
        state: e.state,
        industry: e.industry,
        employees: e.employees,
        score: e.score,
        status: e.status,
        source: e.source || 'Cricket',
      }));

      if (append) {
        setEmployers(prev => [...prev, ...mapped]);
      } else {
        setEmployers(mapped);
      }
      setTotalCount(data.total ?? mapped.length);
      setDataSource('Cricket');
    } catch {
      if (!append) {
        setEmployers([]);
        setTotalCount(0);
        setDataSource('Sample Data');
      }
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchEmployers(0);
      setIsLoading(false);
    };
    load();
  }, [fetchEmployers]);

  // Extract unique values for filters
  const industries = useMemo(() => [...new Set(employers.map(e => e.industry))].sort(), [employers]);
  const states = useMemo(() => [...new Set(employers.map(e => e.state))].sort(), [employers]);
  const statuses = ['new', 'contacted', 'responded', 'qualified', 'closed'];

  // Apply filters
  const filteredEmployers = useMemo(() => {
    return employers.filter(employer => {
      const statusMatch = statusFilter.length === 0 || statusFilter.includes(employer.status);
      const industryMatch = industryFilter.length === 0 || industryFilter.includes(employer.industry);
      const stateMatch = stateFilter.length === 0 || stateFilter.includes(employer.state);
      return statusMatch && industryMatch && stateMatch;
    });
  }, [employers, statusFilter, industryFilter, stateFilter]);

  // Tab filtering
  const getFilteredByTab = () => {
    switch (activeTab) {
      case 'new':
        return filteredEmployers.filter(e => e.status === 'new');
      case 'contacted':
        return filteredEmployers.filter(e => e.status === 'contacted');
      case 'qualified':
        return filteredEmployers.filter(e => e.status === 'qualified');
      default:
        return filteredEmployers;
    }
  };

  const tabFiltered = getFilteredByTab();

  // Apply sorting
  const sortedEmployers = useMemo(() => {
    const sorted = [...tabFiltered].sort((a, b) => {
      let aVal: any = a[sortKey as keyof Employer];
      let bVal: any = b[sortKey as keyof Employer];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sorted;
  }, [tabFiltered, sortKey, sortDirection]);

  // Pagination
  const itemsPerPage = 20;
  const paginatedEmployers = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return sortedEmployers.slice(start, start + itemsPerPage);
  }, [sortedEmployers, page]);

  const totalPages = Math.ceil(sortedEmployers.length / itemsPerPage);

  // Calculate counts for tabs
  const newCount = filteredEmployers.filter(e => e.status === 'new').length;
  const contactedCount = filteredEmployers.filter(e => e.status === 'contacted').length;
  const qualifiedCount = filteredEmployers.filter(e => e.status === 'qualified').length;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setOffset(0);
    await fetchEmployers(0);
    setIsSyncing(false);
  };

  const handleLoadMore = async () => {
    const nextOffset = offset + PAGE_LIMIT;
    setIsLoadingMore(true);
    setOffset(nextOffset);
    await fetchEmployers(nextOffset, true);
    setIsLoadingMore(false);
  };

  const handleEmailClick = (employerId: string) => {
    router.push(`/dashboard?lead=${employerId}&type=employer`);
  };

  const activeFilterCount = statusFilter.length + industryFilter.length + stateFilter.length;

  const handleClearAllFilters = () => {
    setStatusFilter([]);
    setIndustryFilter([]);
    setStateFilter([]);
    setPage(1);
  };

  const filterSections: FilterSection[] = [
    {
      id: 'status',
      title: 'Status',
      type: 'checkbox',
      options: statuses.map(status => ({
        label: status.charAt(0).toUpperCase() + status.slice(1),
        value: status,
        count: filteredEmployers.filter(e => e.status === status).length,
      })),
      activeValues: statusFilter,
      onChange: setStatusFilter,
    },
    {
      id: 'industry',
      title: 'Industry',
      type: 'checkbox',
      options: industries.map(industry => ({
        label: industry,
        value: industry,
        count: filteredEmployers.filter(e => e.industry === industry).length,
      })),
      activeValues: industryFilter,
      onChange: setIndustryFilter,
    },
    {
      id: 'state',
      title: 'State',
      type: 'checkbox',
      options: states.map(state => ({
        label: state,
        value: state,
        count: filteredEmployers.filter(e => e.state === state).length,
      })),
      activeValues: stateFilter,
      onChange: setStateFilter,
    },
  ];

  const tableColumns: Column<Employer>[] = [
    {
      key: 'company',
      label: 'Company',
      sortable: true,
      render: (employer) => (
        <div className="flex items-center gap-3">
          <AvatarCircle name={employer.company} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{employer.company}</p>
            <p className="text-xs text-slate-500 truncate">{employer.industry}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact_name',
      label: 'Contact',
      render: (employer) => (
        <div className="min-w-0">
          <p className="text-slate-900">{employer.contact_name}</p>
          <p className="text-xs text-slate-500">{employer.contact_title}</p>
        </div>
      ),
    },
    {
      key: 'city',
      label: 'Location',
      render: (employer) => (
        <div className="flex items-center gap-1.5 text-slate-600">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{employer.city}, {employer.state}</span>
        </div>
      ),
    },
    {
      key: 'relocation_count',
      label: 'Relocations/yr',
      sortable: true,
      render: (employer) => (
        <p className="font-semibold text-slate-900">{employer.relocation_count.toLocaleString()}</p>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      sortable: true,
      render: (employer) => (
        <p className="font-semibold text-slate-900">{employer.score}</p>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (employer) => (
        <StatusBadge status={employer.status} />
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (employer) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleEmailClick(employer.id)}
            className="p-1.5 hover:bg-blue-50 rounded-md text-slate-600 hover:text-blue-600 transition-all duration-200"
            title="Send Email"
          >
            <Mail className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 hover:bg-blue-50 rounded-md text-slate-600 hover:text-blue-600 transition-all duration-200"
            title="Call"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 hover:bg-blue-50 rounded-md text-slate-600 hover:text-blue-600 transition-all duration-200"
            title="View in Cricket"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Employers"
          description="Manage employer leads from Cricket CRM"
          icon={<Building2 className="w-7 h-7" />}
        />
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-slate-200 rounded-lg" />
          <div className="h-96 bg-slate-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-48px)] bg-slate-50">
      {/* Left Sidebar - Filters */}
      <FilterPanel
        sections={filterSections}
        onClearAll={handleClearAllFilters}
        activeFilterCount={activeFilterCount}
        isOpen={true}
      />

      {/* Right Content - Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white">
          <PageHeader
            title="Employers"
            description="Manage employer leads from Cricket CRM"
            icon={<Building2 className="w-7 h-7" />}
          />
        </div>

        {/* Metrics Bar */}
        <MetricsBar
          tabs={[
            { id: 'total', label: 'Total', count: filteredEmployers.length },
            { id: 'new', label: 'New', count: newCount },
            { id: 'contacted', label: 'Contacted', count: contactedCount },
            { id: 'qualified', label: 'Qualified', count: qualifiedCount },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Table Container */}
        <div className="flex-1 overflow-auto p-4">
          <SortableTable
            columns={tableColumns}
            data={sortedEmployers}
            keyExtractor={(employer: Employer) => employer.id}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            page={page}
            pageSize={20}
            totalItems={sortedEmployers.length}
            onPageChange={setPage}
            emptyMessage="No employers match your filters."
          />
        </div>
      </div>
    </div>
  );
}
