'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  RefreshCw,
  Database,
} from 'lucide-react';
import { FilterPanel, FilterSection } from '@/components/ui/filter-panel';
import { MetricsBar, MetricsTab } from '@/components/ui/metrics-bar';
import { SortableTable, Column } from '@/components/ui/sortable-table';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingState } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/layout/page-header';
import { formatCurrency } from '@/lib/utils';

interface Landlord {
  id: string;
  name: string;
  email: string;
  phone: string;
  propertyCount: number;
  city: string;
  state: string;
  score: number;
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'closed' | 'lost';
  lastContact?: string;
  source: string;
  avgRent?: number;
  totalUnits?: number;
}

interface ApiLandlord {
  id: string;
  name: string;
  email: string;
  phone: string;
  property_count: number;
  city: string;
  state: string;
  score: number;
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'closed' | 'lost';
  avg_rent: number;
  total_units: number;
  source: string;
}

interface ApiResponse {
  landlords: ApiLandlord[];
  total: number;
}

const PAGE_LIMIT = 50;

const SAMPLE_LANDLORDS: Landlord[] = [
  { id: 'l1', name: 'Alexander Phillips', email: 'a.phillips@realestate.com', phone: '(512) 555-0101', propertyCount: 58, city: 'Austin', state: 'TX', score: 92, status: 'new', source: 'Sample Data', avgRent: 2200, totalUnits: 145 },
  { id: 'l2', name: 'Kevin Lee', email: 'kevin.lee@properties.com', phone: '(843) 555-0102', propertyCount: 56, city: 'Charleston', state: 'SC', score: 88, status: 'new', source: 'Sample Data', avgRent: 1800, totalUnits: 112 },
  { id: 'l3', name: 'William Johnson', email: 'wjohnson@landlord.com', phone: '(864) 555-0103', propertyCount: 55, city: 'Greenville', state: 'SC', score: 85, status: 'contacted', lastContact: '2 days ago', source: 'Sample Data', avgRent: 1600, totalUnits: 98 },
  { id: 'l4', name: 'Maria Garcia', email: 'maria@garciaproperties.com', phone: '(704) 555-0104', propertyCount: 42, city: 'Charlotte', state: 'NC', score: 78, status: 'new', source: 'Sample Data', avgRent: 1900, totalUnits: 84 },
  { id: 'l5', name: 'Robert Chen', email: 'rchen@rentals.com', phone: '(919) 555-0105', propertyCount: 38, city: 'Raleigh', state: 'NC', score: 75, status: 'responded', lastContact: '1 day ago', source: 'Sample Data', avgRent: 1750, totalUnits: 76 },
  { id: 'l6', name: 'Sarah Williams', email: 's.williams@atl-homes.com', phone: '(404) 555-0106', propertyCount: 35, city: 'Atlanta', state: 'GA', score: 72, status: 'qualified', lastContact: '3 days ago', source: 'Sample Data', avgRent: 2100, totalUnits: 70 },
  { id: 'l7', name: 'James Brown', email: 'jbrown@property-mgmt.com', phone: '(512) 555-0107', propertyCount: 32, city: 'Austin', state: 'TX', score: 70, status: 'new', source: 'Sample Data', avgRent: 2300, totalUnits: 64 },
  { id: 'l8', name: 'Jennifer Martinez', email: 'jmartinez@rentco.com', phone: '(843) 555-0108', propertyCount: 28, city: 'Charleston', state: 'SC', score: 68, status: 'contacted', lastContact: '5 days ago', source: 'Sample Data', avgRent: 1850, totalUnits: 56 },
];

function mapApiLandlord(api: ApiLandlord): Landlord {
  return {
    id: api.id,
    name: api.name,
    email: api.email,
    phone: api.phone,
    propertyCount: api.property_count,
    city: api.city,
    state: api.state,
    score: api.score,
    status: api.status,
    source: api.source || 'Grasshopper',
    avgRent: api.avg_rent,
    totalUnits: api.total_units,
  };
}

export default function LandlordsPage() {
  const router = useRouter();
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [cityFilters, setCityFilters] = useState<string[]>([]);
  const [stateFilters, setStateFilters] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [dataSource, setDataSource] = useState<'Grasshopper' | 'Sample Data'>('Grasshopper');
  const [sortKey, setSortKey] = useState<string>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [activeMetricTab, setActiveMetricTab] = useState('total');

  const fetchLandlords = useCallback(async (currentOffset: number, append: boolean = false) => {
    try {
      const res = await fetch(`/api/crm/landlords?limit=${PAGE_LIMIT}&offset=${currentOffset}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: ApiResponse = await res.json();
      const mapped = data.landlords.map(mapApiLandlord);

      if (append) {
        setLandlords(prev => [...prev, ...mapped]);
      } else {
        setLandlords(mapped);
      }
      setTotal(data.total);
      setOffset(currentOffset + mapped.length);
      setDataSource('Grasshopper');
    } catch {
      // Fall back to sample data on API failure
      if (!append) {
        setLandlords(SAMPLE_LANDLORDS);
        setTotal(SAMPLE_LANDLORDS.length);
        setOffset(SAMPLE_LANDLORDS.length);
        setDataSource('Sample Data');
      }
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchLandlords(0);
      setIsLoading(false);
    };
    load();
  }, [fetchLandlords]);

  // Extract unique cities and states from all landlords
  const cities = useMemo(() => {
    return [...new Set(landlords.map(l => l.city))].sort();
  }, [landlords]);

  const states = useMemo(() => {
    return [...new Set(landlords.map(l => l.state))].sort();
  }, [landlords]);

  // Apply all filters including sort
  const filteredAndSortedLandlords = useMemo(() => {
    let filtered = landlords.filter(landlord => {
      const matchesSearch = !searchQuery ||
        landlord.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        landlord.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        landlord.city.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(landlord.status);
      const matchesCity = cityFilters.length === 0 || cityFilters.includes(landlord.city);
      const matchesState = stateFilters.length === 0 || stateFilters.includes(landlord.state);
      return matchesSearch && matchesStatus && matchesCity && matchesState;
    });

    // Apply metric tab filter
    if (activeMetricTab !== 'total') {
      switch (activeMetricTab) {
        case 'new':
          filtered = filtered.filter(l => l.status === 'new');
          break;
        case 'contacted':
          filtered = filtered.filter(l => l.status === 'contacted');
          break;
        case 'qualified':
          filtered = filtered.filter(l => l.status === 'qualified');
          break;
      }
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any = a[sortKey as keyof Landlord];
      let bVal: any = b[sortKey as keyof Landlord];

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [landlords, searchQuery, statusFilters, cityFilters, stateFilters, activeMetricTab, sortKey, sortDirection]);

  // Calculate metrics for all landlords
  const metrics = useMemo(() => {
    const newCount = landlords.filter(l => l.status === 'new').length;
    const contactedCount = landlords.filter(l => l.status === 'contacted').length;
    const qualifiedCount = landlords.filter(l => l.status === 'qualified').length;

    return {
      total: landlords.length,
      new: newCount,
      contacted: contactedCount,
      qualified: qualifiedCount,
    };
  }, [landlords]);

  const handleSync = async () => {
    setIsSyncing(true);
    setOffset(0);
    await fetchLandlords(0);
    setIsSyncing(false);
  };

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    await fetchLandlords(offset, true);
    setIsLoadingMore(false);
  };

  const hasMore = offset < total;

  const handleEmailClick = (landlordId: string) => {
    router.push(`/dashboard?lead=${landlordId}&type=landlord`);
  };

  const handleSort = (columnKey: string) => {
    if (sortKey === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(columnKey);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setStatusFilters([]);
    setCityFilters([]);
    setStateFilters([]);
    setPage(1);
  };

  const activeFilterCount = searchQuery.length + statusFilters.length + cityFilters.length + stateFilters.length;

  // Filter panel sections
  const filterSections: FilterSection[] = [
    {
      id: 'status',
      title: 'Status',
      type: 'checkbox',
      options: [
        { label: 'New', value: 'new', count: metrics.new },
        { label: 'Contacted', value: 'contacted', count: metrics.contacted },
        { label: 'Responded', value: 'responded', count: landlords.filter(l => l.status === 'responded').length },
        { label: 'Qualified', value: 'qualified', count: metrics.qualified },
        { label: 'Closed', value: 'closed', count: landlords.filter(l => l.status === 'closed').length },
      ],
      activeValues: statusFilters,
      onChange: (values) => {
        setStatusFilters(values);
        setPage(1);
      },
    },
    {
      id: 'state',
      title: 'State',
      type: 'checkbox',
      options: states.map(state => ({
        label: state,
        value: state,
        count: landlords.filter(l => l.state === state).length,
      })),
      activeValues: stateFilters,
      onChange: (values) => {
        setStateFilters(values);
        setPage(1);
      },
    },
    {
      id: 'city',
      title: 'City',
      type: 'checkbox',
      options: cities.map(city => ({
        label: city,
        value: city,
        count: landlords.filter(l => l.city === city).length,
      })),
      activeValues: cityFilters,
      onChange: (values) => {
        setCityFilters(values);
        setPage(1);
      },
    },
  ];

  // Metrics tabs
  const metricsTabs: MetricsTab[] = [
    { id: 'total', label: 'Total', count: metrics.total },
    { id: 'new', label: 'New', count: metrics.new },
    { id: 'contacted', label: 'Contacted', count: metrics.contacted },
    { id: 'qualified', label: 'Qualified', count: metrics.qualified },
  ];

  // Table columns
  const columns: Column<Landlord>[] = [
    {
      key: 'name',
      label: 'Landlord',
      sortable: true,
      render: (landlord) => (
        <div className="flex items-center gap-3">
          <AvatarCircle name={landlord.name} size="md" />
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{landlord.name}</p>
            <p className="text-sm text-slate-500 truncate">{landlord.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      render: (landlord) => (
        <div className="flex items-center gap-2 text-slate-600">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span>{landlord.city}, {landlord.state}</span>
        </div>
      ),
    },
    {
      key: 'propertyCount',
      label: 'Properties',
      sortable: true,
      render: (landlord) => (
        <div>
          <p className="font-semibold text-slate-900">{landlord.propertyCount}</p>
          <p className="text-xs text-slate-500">({landlord.totalUnits} units)</p>
        </div>
      ),
    },
    {
      key: 'avgRent',
      label: 'Avg Rent',
      sortable: true,
      render: (landlord) => (
        <span className="text-slate-900">
          {landlord.avgRent ? `${formatCurrency(landlord.avgRent)}/mo` : '--'}
        </span>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      sortable: true,
      render: (landlord) => (
        <span className="font-semibold text-slate-900">{landlord.score}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (landlord) => (
        <div>
          <StatusBadge status={landlord.status} />
          {landlord.lastContact && (
            <p className="text-xs text-slate-400 mt-1">{landlord.lastContact}</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (landlord) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEmailClick(landlord.id)}
            className="border border-slate-200 p-1.5 hover:bg-slate-100 rounded-md text-slate-600 transition-all duration-200"
            title="Send Email"
          >
            <Mail className="w-4 h-4" />
          </button>
          <a
            href={`tel:${landlord.phone}`}
            className="border border-slate-200 p-1.5 hover:bg-slate-100 rounded-md text-slate-600 transition-all duration-200"
            title="Call"
          >
            <Phone className="w-4 h-4" />
          </a>
          <button
            className="border border-slate-200 p-1.5 hover:bg-slate-100 rounded-md text-slate-600 transition-all duration-200"
            title="View in Grasshopper"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <LoadingState message="Loading landlords..." />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <PageHeader
          title="Landlords"
          description="Manage landlord leads from Grasshopper CRM"
          icon={<Home className="w-7 h-7" />}
          badge={
            <span className="border border-slate-200 rounded-lg px-2 py-0.5 text-xs inline-flex items-center gap-1.5">
              <Database className="w-3 h-3" />
              {dataSource}
            </span>
          }
          actions={
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="btn-secondary"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync from Grasshopper
            </button>
          }
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/* Left: Filter Panel */}
        <FilterPanel
          sections={filterSections}
          onClearAll={handleClearAllFilters}
          activeFilterCount={activeFilterCount}
          isOpen={true}
        />

        {/* Right: Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {/* Metrics Bar */}
          <MetricsBar
            tabs={metricsTabs}
            activeTab={activeMetricTab}
            onTabChange={setActiveMetricTab}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search landlords..."
            actions={
              hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="btn-secondary"
                >
                  {isLoadingMore ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More
                      <span className="text-slate-600 text-xs">
                        ({landlords.length} of {total})
                      </span>
                    </>
                  )}
                </button>
              )
            }
          />

          {/* Table */}
          <div className="flex-1 overflow-auto p-4 min-w-0">
            <SortableTable
              columns={columns}
              data={filteredAndSortedLandlords}
              keyExtractor={(landlord) => landlord.id}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              page={page}
              pageSize={20}
              totalItems={filteredAndSortedLandlords.length}
              onPageChange={setPage}
              emptyMessage="No landlords found matching your criteria."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
