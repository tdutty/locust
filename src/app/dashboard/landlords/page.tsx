'use client';

import { useState, useEffect } from 'react';
import {
  Home,
  Search,
  Filter,
  MapPin,
  Building2,
  Phone,
  Mail,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Users,
  ArrowUpRight,
} from 'lucide-react';

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

// Sample data - in production, fetch from Grasshopper API
const SAMPLE_LANDLORDS: Landlord[] = [
  { id: 'l1', name: 'Alexander Phillips', email: 'a.phillips@realestate.com', phone: '(512) 555-0101', propertyCount: 58, city: 'Austin', state: 'TX', score: 92, status: 'new', source: 'Grasshopper', avgRent: 2200, totalUnits: 145 },
  { id: 'l2', name: 'Kevin Lee', email: 'kevin.lee@properties.com', phone: '(843) 555-0102', propertyCount: 56, city: 'Charleston', state: 'SC', score: 88, status: 'new', source: 'Grasshopper', avgRent: 1800, totalUnits: 112 },
  { id: 'l3', name: 'William Johnson', email: 'wjohnson@landlord.com', phone: '(864) 555-0103', propertyCount: 55, city: 'Greenville', state: 'SC', score: 85, status: 'contacted', lastContact: '2 days ago', source: 'Grasshopper', avgRent: 1600, totalUnits: 98 },
  { id: 'l4', name: 'Maria Garcia', email: 'maria@garciaproperties.com', phone: '(704) 555-0104', propertyCount: 42, city: 'Charlotte', state: 'NC', score: 78, status: 'new', source: 'Grasshopper', avgRent: 1900, totalUnits: 84 },
  { id: 'l5', name: 'Robert Chen', email: 'rchen@rentals.com', phone: '(919) 555-0105', propertyCount: 38, city: 'Raleigh', state: 'NC', score: 75, status: 'responded', lastContact: '1 day ago', source: 'Grasshopper', avgRent: 1750, totalUnits: 76 },
  { id: 'l6', name: 'Sarah Williams', email: 's.williams@atl-homes.com', phone: '(404) 555-0106', propertyCount: 35, city: 'Atlanta', state: 'GA', score: 72, status: 'qualified', lastContact: '3 days ago', source: 'Grasshopper', avgRent: 2100, totalUnits: 70 },
  { id: 'l7', name: 'James Brown', email: 'jbrown@property-mgmt.com', phone: '(512) 555-0107', propertyCount: 32, city: 'Austin', state: 'TX', score: 70, status: 'new', source: 'Grasshopper', avgRent: 2300, totalUnits: 64 },
  { id: 'l8', name: 'Jennifer Martinez', email: 'jmartinez@rentco.com', phone: '(843) 555-0108', propertyCount: 28, city: 'Charleston', state: 'SC', score: 68, status: 'contacted', lastContact: '5 days ago', source: 'Grasshopper', avgRent: 1850, totalUnits: 56 },
];

export default function LandlordsPage() {
  const [landlords, setLandlords] = useState<Landlord[]>(SAMPLE_LANDLORDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const cities = [...new Set(landlords.map(l => l.city))];

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

  const handleRefresh = async () => {
    setIsLoading(true);
    // In production: fetch from Grasshopper API
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
            <Home className="w-7 h-7 text-green-600" />
            Landlords
          </h1>
          <p className="text-gray-500">Manage landlord leads from Grasshopper CRM</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Sync from Grasshopper
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Landlords" value={landlords.length.toString()} icon={<Users className="w-5 h-5 text-blue-600" />} />
        <StatCard label="Properties" value={totalProperties.toString()} icon={<Home className="w-5 h-5 text-green-600" />} />
        <StatCard label="Total Units" value={totalUnits.toLocaleString()} icon={<Building2 className="w-5 h-5 text-purple-600" />} />
        <StatCard label="Avg Score" value={(landlords.reduce((sum, l) => sum + l.score, 0) / landlords.length).toFixed(0)} icon={<TrendingUp className="w-5 h-5 text-orange-600" />} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search landlords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
        >
          <option value="all">All Cities</option>
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Landlord</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Properties</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Rent</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredLandlords.map((landlord) => (
              <tr key={landlord.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{landlord.name}</p>
                    <p className="text-sm text-gray-500">{landlord.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    {landlord.city}, {landlord.state}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{landlord.propertyCount}</span>
                  <span className="text-gray-500 text-sm ml-1">({landlord.totalUnits} units)</span>
                </td>
                <td className="px-4 py-3 text-gray-900">
                  ${landlord.avgRent?.toLocaleString()}/mo
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-green-600">{landlord.score}</span>
                </td>
                <td className="px-4 py-3">
                  {getStatusBadge(landlord.status)}
                  {landlord.lastContact && (
                    <p className="text-xs text-gray-500 mt-1">{landlord.lastContact}</p>
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
                    <button className="p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="View in Grasshopper">
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
