'use client';

import { useState, useEffect } from 'react';
import {
  Search, Radar, Building2, MapPin, Clock, DollarSign,
  Download, RefreshCw, User, Building, Filter,
  ChevronDown, AlertTriangle, CheckCircle2, Loader2,
  Plus, X, Globe,
} from 'lucide-react';

interface Listing {
  id: number;
  rentcast_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  listed_price: number;
  days_on_market: number;
  listed_date: string;
  owner_name: string | null;
  owner_type: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  estimated_vacancy_cost: number;
  imported_to_contacts: number;
  contact_id: number | null;
}

interface Stats {
  total: number;
  avg_dom: number;
  total_vacancy_cost: number;
  individual_count: number;
  corporate_count: number;
  imported_count: number;
}

interface CityEntry {
  city: string;
  state: string;
  vacancy: string;
  label: string;
  custom?: boolean;
}

const DEFAULT_CITIES: CityEntry[] = [
  { city: 'Austin', state: 'TX', vacancy: '9.7%', label: 'Austin, TX' },
  { city: 'Chicago', state: 'IL', vacancy: '5.1%', label: 'Chicago, IL' },
  { city: 'Boston', state: 'MA', vacancy: '1.1%', label: 'Boston, MA' },
  { city: 'New York', state: 'NY', vacancy: '1.9%', label: 'New York, NY' },
  { city: 'San Francisco', state: 'CA', vacancy: '3.4%', label: 'San Francisco, CA' },
];

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

const PROPERTY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'Apartment', label: 'Apartment' },
  { value: 'Single Family', label: 'Single Family' },
  { value: 'Condo', label: 'Condo' },
  { value: 'Townhouse', label: 'Townhouse' },
  { value: 'Multi-Family', label: 'Multi-Family' },
];

function domColor(dom: number): string {
  if (dom >= 90) return 'text-red-600 bg-red-50';
  if (dom >= 60) return 'text-orange-600 bg-orange-50';
  if (dom >= 30) return 'text-yellow-600 bg-yellow-50';
  return 'text-slate-600 bg-slate-50';
}

function domBadge(dom: number): string {
  if (dom >= 90) return 'Critical';
  if (dom >= 60) return 'High';
  if (dom >= 30) return 'Moderate';
  return 'Low';
}

export default function ScraperPage() {
  const [cities, setCities] = useState<CityEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('scraper_cities');
        if (saved) {
          const parsed = JSON.parse(saved) as CityEntry[];
          if (parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_CITIES;
  });
  const [selectedCity, setSelectedCity] = useState(cities[0]);
  const [propertyType, setPropertyType] = useState('');
  const [minDays, setMinDays] = useState(30);
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddCity, setShowAddCity] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [newCityState, setNewCityState] = useState('');

  // Persist cities to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('scraper_cities', JSON.stringify(cities));
    } catch {}
  }, [cities]);

  function addCity() {
    const name = newCityName.trim();
    const state = newCityState.trim().toUpperCase();
    if (!name || !state || !US_STATES[state]) return;

    // Prevent duplicates
    if (cities.some(c => c.city.toLowerCase() === name.toLowerCase() && c.state === state)) {
      setMessage({ type: 'error', text: `${name}, ${state} is already in your list.` });
      return;
    }

    const entry: CityEntry = {
      city: name,
      state,
      vacancy: '—',
      label: `${name}, ${state}`,
      custom: true,
    };

    setCities(prev => [...prev, entry]);
    setSelectedCity(entry);
    setNewCityName('');
    setNewCityState('');
    setShowAddCity(false);
    setMessage({ type: 'success', text: `Added ${entry.label} to your target cities.` });
  }

  function removeCity(cityToRemove: CityEntry) {
    setCities(prev => {
      const next = prev.filter(c => !(c.city === cityToRemove.city && c.state === cityToRemove.state));
      if (next.length === 0) return DEFAULT_CITIES;
      return next;
    });
    if (selectedCity.city === cityToRemove.city && selectedCity.state === cityToRemove.state) {
      const remaining = cities.filter(c => !(c.city === cityToRemove.city && c.state === cityToRemove.state));
      setSelectedCity(remaining[0] || DEFAULT_CITIES[0]);
    }
  }

  // Load existing listings for selected city on mount
  useEffect(() => {
    loadListings();
  }, [selectedCity]);

  async function loadListings() {
    try {
      const res = await fetch(`/api/scraper/search?city=${selectedCity.city}&state=${selectedCity.state}&minDays=${minDays}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
        setStats(data.stats || null);
      }
    } catch {}
  }

  async function handleSearch() {
    setSearching(true);
    setMessage(null);
    try {
      const res = await fetch('/api/scraper/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: selectedCity.city,
          state: selectedCity.state,
          minDaysOnMarket: minDays,
          propertyType: propertyType || undefined,
          maxResults: 50,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setListings(data.listings || []);
      setMessage({
        type: 'success',
        text: `Found ${data.apiResults} listings from RentCast. ${data.saved} new, ${data.skipped} updated.`,
      });

      // Reload stats
      loadListings();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Search failed' });
    } finally {
      setSearching(false);
    }
  }

  async function handleEnrich() {
    if (selected.size === 0) return;
    setEnriching(true);
    setMessage(null);
    try {
      const res = await fetch('/api/scraper/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: `Enriched ${data.enriched} listings with owner data.` });
      setSelected(new Set());
      loadListings();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Enrichment failed' });
    } finally {
      setEnriching(false);
    }
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/scraper/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({
        type: 'success',
        text: `Imported ${data.imported} landlord contacts. ${data.skipped} skipped.`,
      });
      setSelected(new Set());
      loadListings();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Import failed' });
    } finally {
      setImporting(false);
    }
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === listings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(listings.map(l => l.id)));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Radar className="w-5 h-5 text-primary" />
            Listing Scraper
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Find stale rental listings and convert landlords into outreach targets
          </p>
        </div>
      </div>

      {/* City Cards */}
      <div className="flex flex-wrap gap-3">
        {cities.map(c => (
          <button
            key={`${c.city}-${c.state}`}
            onClick={() => setSelectedCity(c)}
            className={`relative group p-3 rounded-lg border text-left transition-all min-w-[160px] ${
              selectedCity.city === c.city && selectedCity.state === c.state
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            {c.custom && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); removeCity(c); }}
                className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </span>
            )}
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm font-semibold text-slate-900">{c.label}</span>
            </div>
            <div className="text-xs text-slate-500">
              {c.vacancy !== '—' ? (
                <>Vacancy: <span className="font-medium text-slate-700">{c.vacancy}</span></>
              ) : (
                <span className="text-slate-400 flex items-center gap-1"><Globe className="w-3 h-3" /> Custom city</span>
              )}
            </div>
          </button>
        ))}

        {/* Add City Button / Form */}
        {!showAddCity ? (
          <button
            onClick={() => setShowAddCity(true)}
            className="flex items-center justify-center p-3 rounded-lg border-2 border-dashed border-slate-200 hover:border-primary hover:bg-primary/5 text-slate-400 hover:text-primary transition-all min-w-[160px] min-h-[72px]"
          >
            <Plus className="w-5 h-5 mr-1.5" />
            <span className="text-sm font-medium">Add City</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg border-2 border-primary bg-primary/5 min-w-[320px]">
            <input
              type="text"
              value={newCityName}
              onChange={e => setNewCityName(e.target.value)}
              placeholder="City name"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') addCity(); if (e.key === 'Escape') setShowAddCity(false); }}
              className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-white"
            />
            <select
              value={newCityState}
              onChange={e => setNewCityState(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-primary focus:border-primary bg-white"
            >
              <option value="">State</option>
              {Object.entries(US_STATES).sort((a, b) => a[0].localeCompare(b[0])).map(([abbr]) => (
                <option key={abbr} value={abbr}>{abbr}</option>
              ))}
            </select>
            <button
              onClick={addCity}
              disabled={!newCityName.trim() || !newCityState}
              className="p-1.5 rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowAddCity(false); setNewCityName(''); setNewCityState(''); }}
              className="p-1.5 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Search Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Property Type</label>
            <select
              value={propertyType}
              onChange={e => setPropertyType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-primary"
            >
              {PROPERTY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Min Days on Market: <span className="text-primary font-bold">{minDays}</span>
            </label>
            <input
              type="range"
              min={7}
              max={180}
              value={minDays}
              onChange={e => setMinDays(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>7d</span><span>30d</span><span>60d</span><span>90d</span><span>180d</span>
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searching ? 'Searching...' : 'Search RentCast'}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Stats Bar */}
      {stats && Number(stats.total) > 0 && (
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: 'Total Listings', value: stats.total, icon: Building2 },
            { label: 'Avg DOM', value: `${Math.round(Number(stats.avg_dom) || 0)}d`, icon: Clock },
            { label: 'Total Vacancy Cost', value: `$${Math.round(Number(stats.total_vacancy_cost) || 0).toLocaleString()}`, icon: DollarSign },
            { label: 'Individual Owners', value: stats.individual_count || 0, icon: User },
            { label: 'Corporate Owners', value: stats.corporate_count || 0, icon: Building },
            { label: 'Imported', value: stats.imported_count || 0, icon: Download },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-500">{s.label}</span>
              </div>
              <span className="text-lg font-bold text-slate-900">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action Bar */}
      {listings.length > 0 && (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3">
          <div className="text-sm text-slate-600">
            {selected.size > 0 ? (
              <span className="font-medium">{selected.size} selected</span>
            ) : (
              <span>{listings.length} listings found</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEnrich}
              disabled={selected.size === 0 || enriching}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-40 transition-colors"
            >
              {enriching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Enrich Selected
            </button>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Import to Contacts
            </button>
          </div>
        </div>
      )}

      {/* Results Table */}
      {listings.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === listings.length && listings.length > 0}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Address</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Price</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Beds/Bath</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">DOM</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Vacancy Cost</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Owner</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listings.map(l => (
                <tr
                  key={l.id}
                  className={`hover:bg-slate-50 transition-colors ${selected.has(l.id) ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() => toggleSelect(l.id)}
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-900 truncate max-w-[240px]">{l.address}</div>
                    <div className="text-[11px] text-slate-400">{l.zip_code} · {l.property_type || 'Rental'}</div>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {l.listed_price ? `$${l.listed_price.toLocaleString()}/mo` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {l.bedrooms || '?'}bd / {l.bathrooms || '?'}ba
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${domColor(l.days_on_market)}`}>
                      {l.days_on_market}d
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-red-600">
                    {l.estimated_vacancy_cost ? `$${Math.round(l.estimated_vacancy_cost).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {l.owner_name ? (
                      <div>
                        <div className="text-slate-900 truncate max-w-[160px]">{l.owner_name}</div>
                        {l.owner_email && <div className="text-[11px] text-slate-400">{l.owner_email}</div>}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">Not enriched</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {l.owner_type === 'individual' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                        <User className="w-3 h-3" /> Individual
                      </span>
                    )}
                    {l.owner_type === 'corporate' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        <Building className="w-3 h-3" /> Corporate
                      </span>
                    )}
                    {!l.owner_type && <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {l.imported_to_contacts === 1 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        <CheckCircle2 className="w-3 h-3" /> Imported
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">New</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !searching ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <Radar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700 mb-1">No listings yet</h3>
          <p className="text-xs text-slate-500">
            Select a city and click "Search RentCast" to find stale rental listings
          </p>
        </div>
      ) : null}
    </div>
  );
}
