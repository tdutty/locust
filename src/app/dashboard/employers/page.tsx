'use client';

import { useState } from 'react';
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
  Globe,
} from 'lucide-react';

interface Employer {
  id: string;
  company: string;
  contactName: string;
  contactTitle: string;
  email: string;
  phone: string;
  relocationCount: number;
  city: string;
  state: string;
  industry: string;
  employees: number;
  score: number;
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'closed' | 'lost';
  lastContact?: string;
}

// Sample data - in production, fetch from Cricket API
const SAMPLE_EMPLOYERS: Employer[] = [
  { id: 'e1', company: 'Tesla', contactName: 'Sarah Chen', contactTitle: 'VP of HR', email: 's.chen@tesla.com', phone: '(512) 555-0201', relocationCount: 850, city: 'Austin', state: 'TX', industry: 'Automotive/Tech', employees: 127000, score: 95, status: 'new' },
  { id: 'e2', company: 'Delta Air Lines', contactName: 'Michael Torres', contactTitle: 'Relocation Manager', email: 'm.torres@delta.com', phone: '(404) 555-0202', relocationCount: 650, city: 'Atlanta', state: 'GA', industry: 'Airlines', employees: 95000, score: 90, status: 'new' },
  { id: 'e3', company: 'Apple', contactName: 'Jennifer Wu', contactTitle: 'HR Operations', email: 'j.wu@apple.com', phone: '(512) 555-0203', relocationCount: 520, city: 'Austin', state: 'TX', industry: 'Technology', employees: 164000, score: 88, status: 'contacted', lastContact: '1 day ago' },
  { id: 'e4', company: 'Bank of America', contactName: 'David Kim', contactTitle: 'Relocation Director', email: 'd.kim@bofa.com', phone: '(704) 555-0204', relocationCount: 450, city: 'Charlotte', state: 'NC', industry: 'Finance', employees: 213000, score: 85, status: 'responded', lastContact: '3 hours ago' },
  { id: 'e5', company: 'Boeing Defense', contactName: 'Patricia Adams', contactTitle: 'HR Manager', email: 'p.adams@boeing.com', phone: '(843) 555-0205', relocationCount: 250, city: 'Charleston', state: 'SC', industry: 'Aerospace', employees: 142000, score: 82, status: 'qualified', lastContact: '2 days ago' },
  { id: 'e6', company: 'Oracle', contactName: 'Robert Martinez', contactTitle: 'People Ops', email: 'r.martinez@oracle.com', phone: '(512) 555-0206', relocationCount: 380, city: 'Austin', state: 'TX', industry: 'Technology', employees: 143000, score: 80, status: 'new' },
  { id: 'e7', company: 'Samsung', contactName: 'Lisa Park', contactTitle: 'HR Director', email: 'l.park@samsung.com', phone: '(512) 555-0207', relocationCount: 320, city: 'Austin', state: 'TX', industry: 'Electronics', employees: 267000, score: 78, status: 'contacted', lastContact: '4 days ago' },
  { id: 'e8', company: 'BMW Manufacturing', contactName: 'Hans Mueller', contactTitle: 'Relocation Coordinator', email: 'h.mueller@bmw.com', phone: '(864) 555-0208', relocationCount: 180, city: 'Greenville', state: 'SC', industry: 'Automotive', employees: 118000, score: 75, status: 'new' },
];

export default function EmployersPage() {
  const [employers, setEmployers] = useState<Employer[]>(SAMPLE_EMPLOYERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const industries = [...new Set(employers.map(e => e.industry))];

  const filteredEmployers = employers.filter(employer => {
    const matchesSearch = !searchQuery ||
      employer.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employer.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employer.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIndustry = industryFilter === 'all' || employer.industry === industryFilter;
    const matchesStatus = statusFilter === 'all' || employer.status === statusFilter;
    return matchesSearch && matchesIndustry && matchesStatus;
  });

  const totalRelocations = employers.reduce((sum, e) => sum + e.relocationCount, 0);

  const handleRefresh = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-700',
      contacted: 'bg-yellow-100 text-yellow-700',
      responded: 'bg-green-100 text-green-700',
      qualified: 'bg-purple-100 text-purple-700',
      closed: 'bg-emerald-100 text-emerald-700',
      lost: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-green-600" />
            Employers
          </h1>
          <p className="text-gray-500">Manage employer leads from Cricket CRM</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Sync from Cricket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Employers" value={employers.length.toString()} icon={<Building2 className="w-5 h-5 text-blue-600" />} />
        <StatCard label="Annual Relocations" value={totalRelocations.toLocaleString()} icon={<Users className="w-5 h-5 text-green-600" />} />
        <StatCard label="Industries" value={industries.length.toString()} icon={<Briefcase className="w-5 h-5 text-purple-600" />} />
        <StatCard label="Avg Score" value={(employers.reduce((sum, e) => sum + e.score, 0) / employers.length).toFixed(0)} icon={<TrendingUp className="w-5 h-5 text-orange-600" />} />
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
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                    <p className="text-gray-900">{employer.contactName}</p>
                    <p className="text-sm text-gray-500">{employer.contactTitle}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    {employer.city}, {employer.state}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{employer.relocationCount.toLocaleString()}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-green-600">{employer.score}</span>
                </td>
                <td className="px-4 py-3">
                  {getStatusBadge(employer.status)}
                  {employer.lastContact && (
                    <p className="text-xs text-gray-500 mt-1">{employer.lastContact}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="Send Email">
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}
