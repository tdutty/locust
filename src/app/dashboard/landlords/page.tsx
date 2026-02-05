'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home,
  Search,
  MapPin,
  Building2,
  Phone,
  Mail,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Users,
  Database,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
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
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [dataSource, setDataSource] = useState<'Grasshopper' | 'Sample Data'>('Grasshopper');

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

  const cities = [...new Set(landlords.map(l => l.city))].sort();

  const filteredLandlords = landlords.filter(landlord => {
    const matchesSearch = !searchQuery ||
      landlord.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      landlord.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      landlord.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = cityFilter === 'all' || landlord.city === cityFilter;
    const matchesStatus = statusFilter === 'all' || landlord.status === statusFilter;
    return matchesSearch && matchesCity && matchesStatus;
  });

  const totalProperties = landlords.reduce((sum, l) => sum + l.propertyCount, 0);
  const totalUnits = landlords.reduce((sum, l) => sum + (l.totalUnits || 0), 0);
  const avgScore = landlords.length > 0
    ? (landlords.reduce((sum, l) => sum + l.score, 0) / landlords.length).toFixed(0)
    : '0';

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Landlords"
        description="Manage landlord leads from Grasshopper CRM"
        icon={<Home className="w-7 h-7" />}
        badge={
          <span className="border border-black px-2 py-0.5 text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Landlords"
          value={landlords.length.toString()}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="Properties"
          value={totalProperties.toString()}
          icon={<Home className="w-5 h-5" />}
        />
        <StatCard
          label="Total Units"
          value={totalUnits.toLocaleString()}
          icon={<Building2 className="w-5 h-5" />}
        />
        <StatCard
          label="Avg Score"
          value={avgScore}
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
          <input
            type="text"
            placeholder="Search landlords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base pl-10"
          />
        </div>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="input-base"
        >
          <option value="all">All Cities</option>
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-base"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="responded">Responded</option>
          <option value="qualified">Qualified</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading landlords..." />
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Landlord</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Properties</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Avg Rent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {filteredLandlords.map((landlord) => (
                  <tr key={landlord.id} className="group hover:bg-black hover:text-white transition-all duration-200">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{landlord.name}</p>
                        <p className="text-sm text-black/50 group-hover:text-white/50">{landlord.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {landlord.city}, {landlord.state}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{landlord.propertyCount}</span>
                      <span className="text-black/50 group-hover:text-white/50 text-sm ml-1">({landlord.totalUnits} units)</span>
                    </td>
                    <td className="px-4 py-3">
                      {landlord.avgRent ? `${formatCurrency(landlord.avgRent)}/mo` : '--'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{landlord.score}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={landlord.status} />
                      {landlord.lastContact && (
                        <p className="text-xs text-black/50 group-hover:text-white/50 mt-1">{landlord.lastContact}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEmailClick(landlord.id)}
                          className="border border-black group-hover:border-white p-1.5 hover:bg-black hover:text-white group-hover:hover:bg-white group-hover:hover:text-black transition-all duration-200"
                          title="Send Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <a
                          href={`tel:${landlord.phone}`}
                          className="border border-black group-hover:border-white p-1.5 hover:bg-black hover:text-white group-hover:hover:bg-white group-hover:hover:text-black transition-all duration-200"
                          title="Call"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        <button
                          className="border border-black group-hover:border-white p-1.5 hover:bg-black hover:text-white group-hover:hover:bg-white group-hover:hover:text-black transition-all duration-200"
                          title="View in Grasshopper"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredLandlords.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-black/50">
                      No landlords found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Load More */}
            {hasMore && (
              <div className="px-4 py-4 border-t-2 border-black flex items-center justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="btn-primary flex items-center gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More
                      <span className="text-white/60 text-xs">
                        ({landlords.length} of {total})
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
