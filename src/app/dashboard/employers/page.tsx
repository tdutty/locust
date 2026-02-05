'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Search,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Users,
  Briefcase,
  Database,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingState } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/layout/page-header';

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

const SAMPLE_EMPLOYERS: Employer[] = [
  { id: 'e1', company: 'Tesla', contact_name: 'Sarah Chen', contact_title: 'VP of HR', contact_email: 's.chen@tesla.com', phone: '(512) 555-0201', relocation_count: 850, city: 'Austin', state: 'TX', industry: 'Automotive/Tech', employees: 127000, score: 95, status: 'new', source: 'sample' },
  { id: 'e2', company: 'Delta Air Lines', contact_name: 'Michael Torres', contact_title: 'Relocation Manager', contact_email: 'm.torres@delta.com', phone: '(404) 555-0202', relocation_count: 650, city: 'Atlanta', state: 'GA', industry: 'Airlines', employees: 95000, score: 90, status: 'new', source: 'sample' },
  { id: 'e3', company: 'Apple', contact_name: 'Jennifer Wu', contact_title: 'HR Operations', contact_email: 'j.wu@apple.com', phone: '(512) 555-0203', relocation_count: 520, city: 'Austin', state: 'TX', industry: 'Technology', employees: 164000, score: 88, status: 'contacted', source: 'sample' },
  { id: 'e4', company: 'Bank of America', contact_name: 'David Kim', contact_title: 'Relocation Director', contact_email: 'd.kim@bofa.com', phone: '(704) 555-0204', relocation_count: 450, city: 'Charlotte', state: 'NC', industry: 'Finance', employees: 213000, score: 85, status: 'responded', source: 'sample' },
  { id: 'e5', company: 'Boeing Defense', contact_name: 'Patricia Adams', contact_title: 'HR Manager', contact_email: 'p.adams@boeing.com', phone: '(843) 555-0205', relocation_count: 250, city: 'Charleston', state: 'SC', industry: 'Aerospace', employees: 142000, score: 82, status: 'qualified', source: 'sample' },
  { id: 'e6', company: 'Oracle', contact_name: 'Robert Martinez', contact_title: 'People Ops', contact_email: 'r.martinez@oracle.com', phone: '(512) 555-0206', relocation_count: 380, city: 'Austin', state: 'TX', industry: 'Technology', employees: 143000, score: 80, status: 'new', source: 'sample' },
  { id: 'e7', company: 'Samsung', contact_name: 'Lisa Park', contact_title: 'HR Director', contact_email: 'l.park@samsung.com', phone: '(512) 555-0207', relocation_count: 320, city: 'Austin', state: 'TX', industry: 'Electronics', employees: 267000, score: 78, status: 'contacted', source: 'sample' },
  { id: 'e8', company: 'BMW Manufacturing', contact_name: 'Hans Mueller', contact_title: 'Relocation Coordinator', contact_email: 'h.mueller@bmw.com', phone: '(864) 555-0208', relocation_count: 180, city: 'Greenville', state: 'SC', industry: 'Automotive', employees: 118000, score: 75, status: 'new', source: 'sample' },
];

const PAGE_LIMIT = 50;

export default function EmployersPage() {
  const router = useRouter();
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [dataSource, setDataSource] = useState<'Cricket' | 'Sample Data'>('Sample Data');

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
        setEmployers(SAMPLE_EMPLOYERS);
        setTotalCount(SAMPLE_EMPLOYERS.length);
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

  const industries = [...new Set(employers.map(e => e.industry))];

  const filteredEmployers = employers.filter(employer => {
    const matchesSearch = !searchQuery ||
      employer.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employer.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employer.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIndustry = industryFilter === 'all' || employer.industry === industryFilter;
    const matchesStatus = statusFilter === 'all' || employer.status === statusFilter;
    return matchesSearch && matchesIndustry && matchesStatus;
  });

  const totalRelocations = employers.reduce((sum, e) => sum + e.relocation_count, 0);
  const avgScore = employers.length > 0
    ? (employers.reduce((sum, e) => sum + e.score, 0) / employers.length).toFixed(0)
    : '0';

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

  const hasMore = employers.length < totalCount;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Employers"
          description="Manage employer leads from Cricket CRM"
          icon={<Building2 className="w-7 h-7 text-green-600" />}
        />
        {/* Stat card skeletons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-7 bg-gray-200 rounded w-16" />
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
        {/* Filter skeleton */}
        <div className="flex items-center gap-4 animate-pulse">
          <div className="h-10 bg-gray-200 rounded-lg flex-1 max-w-md" />
          <div className="h-10 bg-gray-200 rounded-lg w-40" />
          <div className="h-10 bg-gray-200 rounded-lg w-36" />
        </div>
        {/* Table skeleton */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
            <div className="flex gap-16 animate-pulse">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-3 bg-gray-200 rounded w-20" />
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-8 animate-pulse">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-200 rounded w-20" />
                </div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-28" />
                  <div className="h-3 bg-gray-200 rounded w-24" />
                </div>
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-4 bg-gray-200 rounded w-12" />
                <div className="h-4 bg-gray-200 rounded w-10" />
                <div className="h-5 bg-gray-200 rounded-full w-16" />
                <div className="flex gap-2">
                  <div className="h-7 w-7 bg-gray-200 rounded" />
                  <div className="h-7 w-7 bg-gray-200 rounded" />
                  <div className="h-7 w-7 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Employers"
        description="Manage employer leads from Cricket CRM"
        icon={<Building2 className="w-7 h-7 text-green-600" />}
        badge={
          <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
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
            Sync from Cricket
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Employers" value={employers.length.toString()} icon={<Building2 className="w-5 h-5 text-blue-600" />} />
        <StatCard label="Annual Relocations" value={totalRelocations.toLocaleString()} icon={<Users className="w-5 h-5 text-green-600" />} />
        <StatCard label="Industries" value={industries.length.toString()} icon={<Briefcase className="w-5 h-5 text-purple-600" />} />
        <StatCard label="Avg Score" value={avgScore} icon={<TrendingUp className="w-5 h-5 text-orange-600" />} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base pl-10"
          />
        </div>
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option value="all">All Industries</option>
          {industries.map(industry => (
            <option key={industry} value={industry}>{industry}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Relocations/yr</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredEmployers.map((employer) => (
              <tr key={employer.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{employer.company}</p>
                    <p className="text-sm text-gray-500">{employer.industry}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-gray-900">{employer.contact_name}</p>
                    <p className="text-sm text-gray-500">{employer.contact_title}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    {employer.city}, {employer.state}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{employer.relocation_count.toLocaleString()}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-green-600">{employer.score}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={employer.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEmailClick(employer.id)}
                      className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                      title="Send Email"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="Call">
                      <Phone className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="View in Cricket">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredEmployers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No employers match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Load More
                <span className="text-gray-400">
                  ({employers.length} of {totalCount})
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
