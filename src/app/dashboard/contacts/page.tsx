'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  Building2,
  MapPin,
  Users,
  Stethoscope,
  GraduationCap,
  Briefcase,
  Gift,
  X,
  Loader2,
  AlertCircle,
  Save,
  Database,
  CheckCircle2,
  Trash2,
  Send,
  Sparkles,
  Edit,
  Eye,
  RefreshCw,
} from 'lucide-react';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  email: string | null;
  emailStatus: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  organization: {
    id: string;
    name: string;
    website: string | null;
    industry: string | null;
    employeeCount: number | null;
    city: string | null;
    state: string | null;
  };
}

interface SavedContact {
  id: number;
  apollo_id: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string;
  title: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  org_name: string | null;
  org_website: string | null;
  org_industry: string | null;
  org_employee_count: number | null;
  org_city: string | null;
  org_state: string | null;
  source_template: string | null;
  contact_type: string | null;
  tags: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  perPage: number;
  totalEntries: number;
  totalPages: number;
}

interface Template {
  id: string;
  name: string;
  titleCount: number;
  titles: string[];
}

const TEMPLATE_META: Record<string, { icon: any; color: string; description: string }> = {
  'residency-coordinators': {
    icon: Stethoscope,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    description: 'GME coordinators, residency directors, and program administrators at teaching hospitals',
  },
  'graduate-housing': {
    icon: GraduationCap,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    description: 'Housing directors and residential life coordinators at universities',
  },
  'benefits-platforms': {
    icon: Gift,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    description: 'Partnership and BD leads at employee benefits platforms (Forma, Benepass, Compt, etc.)',
  },
  'employer-relocation': {
    icon: Briefcase,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    description: 'HR, People Ops, and relocation managers at mid-to-large companies',
  },
  'landlord-contacts': {
    icon: Building2,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    description: 'Property managers, leasing directors, and asset managers at multifamily firms',
  },
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700',
  contacted: 'bg-blue-100 text-blue-700',
  replied: 'bg-green-100 text-green-700',
  qualified: 'bg-purple-100 text-purple-700',
  disqualified: 'bg-red-100 text-red-700',
};

type ViewMode = 'templates' | 'search' | 'saved';

export default function ContactsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('templates');

  // Apollo search state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, perPage: 25, totalEntries: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [searchKeyword, setSearchKeyword] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  // Saved contacts state
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>([]);
  const [savedPagination, setSavedPagination] = useState<Pagination>({ page: 1, perPage: 50, totalEntries: 0, totalPages: 0 });
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedSearch, setSavedSearch] = useState('');
  const [savedStatusFilter, setSavedStatusFilter] = useState('');
  const [savedStateFilter, setSavedStateFilter] = useState('');
  const [savedTypeFilter, setSavedTypeFilter] = useState('');
  const [selectedSaved, setSelectedSaved] = useState<Set<number>>(new Set());

  // Save feedback
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load templates on mount
  useEffect(() => {
    fetch('/api/apollo')
      .then(r => r.json())
      .then(data => {
        setTemplates(data.templates || []);
        setHasApiKey(data.hasApiKey);
      })
      .catch(() => {});
  }, []);

  // Load saved contacts count on mount
  const [savedCount, setSavedCount] = useState(0);
  useEffect(() => {
    fetch('/api/contacts?perPage=1')
      .then(r => r.json())
      .then(data => setSavedCount(data.pagination?.totalEntries || 0))
      .catch(() => {});
  }, []);

  const searchContacts = useCallback(async (template: string, page = 1) => {
    setLoading(true);
    setError(null);

    try {
      const payload: any = { template, page, perPage: 25 };
      const customFilters: any = {};
      if (searchKeyword) customFilters.keywords = searchKeyword;
      if (locationFilter) customFilters.locations = [locationFilter];
      if (Object.keys(customFilters).length > 0) payload.customFilters = customFilters;

      const res = await fetch('/api/apollo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Search failed');
        return;
      }

      setContacts(data.contacts || []);
      setPagination(data.pagination || { page: 1, perPage: 25, totalEntries: 0, totalPages: 0 });
      setSelectedContacts(new Set());
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [searchKeyword, locationFilter]);

  const loadSavedContacts = useCallback(async (page = 1) => {
    setSavedLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: '50' });
      if (savedSearch) params.set('search', savedSearch);
      if (savedStatusFilter) params.set('status', savedStatusFilter);
      if (savedStateFilter) params.set('state', savedStateFilter);
      if (savedTypeFilter) params.set('contact_type', savedTypeFilter);

      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      setSavedContacts(data.contacts || []);
      setSavedPagination(data.pagination || { page: 1, perPage: 50, totalEntries: 0, totalPages: 0 });
      setSavedCount(data.pagination?.totalEntries || 0);
      setSelectedSaved(new Set());
    } catch {
      // silently fail
    } finally {
      setSavedLoading(false);
    }
  }, [savedSearch, savedStatusFilter, savedStateFilter, savedTypeFilter]);

  const handleTemplateClick = (templateId: string) => {
    setActiveTemplate(templateId);
    setViewMode('search');
    searchContacts(templateId, 1);
  };

  const handlePageChange = (newPage: number) => {
    if (activeTemplate) searchContacts(activeTemplate, newPage);
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)));
    }
  };

  const toggleSaved = (id: number) => {
    setSelectedSaved(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSaved = () => {
    if (selectedSaved.size === savedContacts.length) {
      setSelectedSaved(new Set());
    } else {
      setSelectedSaved(new Set(savedContacts.map(c => c.id)));
    }
  };

  // Save selected contacts to database
  const saveSelectedContacts = async () => {
    const toSave = contacts.filter(c => selectedContacts.has(c.id));
    if (toSave.length === 0) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: toSave.map(c => ({ ...c, sourceTemplate: activeTemplate, contactType: (c as any).contactType || null })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(`Error: ${data.error}`);
      } else {
        setSaveMessage(data.message);
        setSavedCount(prev => prev + data.saved);
        // Clear selection after save
        setSelectedContacts(new Set());
      }
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  // Save ALL current page contacts
  const saveAllContacts = async () => {
    if (contacts.length === 0) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: contacts.map(c => ({ ...c, sourceTemplate: activeTemplate, contactType: (c as any).contactType || null })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(`Error: ${data.error}`);
      } else {
        setSaveMessage(data.message);
        setSavedCount(prev => prev + data.saved);
      }
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  // Update saved contact status
  const updateContactStatus = async (id: number, status: string) => {
    try {
      await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      setSavedContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    } catch {
      // silently fail
    }
  };

  // Delete saved contacts
  const deleteSelectedSaved = async () => {
    if (selectedSaved.size === 0) return;
    try {
      await fetch('/api/contacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedSaved) }),
      });
      setSavedContacts(prev => prev.filter(c => !selectedSaved.has(c.id)));
      setSavedCount(prev => prev - selectedSaved.size);
      setSelectedSaved(new Set());
    } catch {
      // silently fail
    }
  };

  // ── Email Composer State ──
  const [emailContact, setEmailContact] = useState<SavedContact | null>(null);
  const [emailNumber, setEmailNumber] = useState(1);
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailEditMode, setEmailEditMode] = useState(false);
  const [emailSendStatus, setEmailSendStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const TEMPLATE_TO_LEAD_TYPE: Record<string, string> = {
    'residency-coordinators': 'residency',
    'graduate-housing': 'graduate-housing',
    'benefits-platforms': 'benefits-platform',
    'employer-relocation': 'employer',
    'landlord-contacts': 'landlord',
  };

  const getLeadType = (contact: SavedContact) => {
    if (contact.source_template && TEMPLATE_TO_LEAD_TYPE[contact.source_template]) {
      return TEMPLATE_TO_LEAD_TYPE[contact.source_template];
    }
    if (contact.org_industry?.toLowerCase().includes('hospital') || contact.org_industry?.toLowerCase().includes('health')) return 'residency';
    if (contact.org_industry?.toLowerCase().includes('education') || contact.org_industry?.toLowerCase().includes('university')) return 'graduate-housing';
    return 'employer';
  };

  const getSequenceLabels = (lt: string) => {
    if (lt === 'residency') return ['Program Introduction', 'Follow-Up with Value', 'Case Study + Breakup'];
    if (lt === 'benefits-platform') return ['Partnership Intro', 'Data + Model', 'Final Window'];
    if (lt === 'graduate-housing') return ['Housing Office Intro', 'Market Data Follow-Up', 'Breakup'];
    return ['Hook', 'Social Proof', 'ROI'];
  };

  const openEmailComposer = (contact: SavedContact) => {
    setEmailContact(contact);
    setEmailNumber(1);
    setGeneratedSubject('');
    setGeneratedBody('');
    setEmailEditMode(false);
    setEmailSendStatus('idle');
  };

  const generateEmail = async () => {
    if (!emailContact) return;
    setIsGenerating(true);
    setEmailSendStatus('idle');

    try {
      const lt = getLeadType(emailContact);
      const res = await fetch('/api/email/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadType: lt,
          lead: {
            name: emailContact.name,
            email: emailContact.email,
            city: emailContact.city || emailContact.org_city,
            state: emailContact.state || emailContact.org_state,
            title: emailContact.title,
            orgName: emailContact.org_name,
            orgEmployeeCount: emailContact.org_employee_count,
            industry: emailContact.org_industry,
            company: emailContact.org_name,
          },
          emailNumber,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedSubject(data.subject);
        setGeneratedBody(data.body);
      } else {
        setEmailSendStatus('error');
      }
    } catch {
      setEmailSendStatus('error');
    }
    setIsGenerating(false);
  };

  const sendEmail = async () => {
    if (!emailContact || !generatedBody) return;
    setIsSending(true);

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailContact.email,
          subject: generatedSubject,
          body: generatedBody,
          leadId: String(emailContact.id),
          leadType: getLeadType(emailContact),
        }),
      });

      if (res.ok) {
        setEmailSendStatus('success');
        // Update contact status to "contacted"
        updateContactStatus(emailContact.id, 'contacted');
        setTimeout(() => {
          setEmailContact(null);
          setEmailSendStatus('idle');
        }, 2000);
      } else {
        setEmailSendStatus('error');
      }
    } catch {
      setEmailSendStatus('error');
    }
    setIsSending(false);
  };

  const exportCSV = () => {
    const toExport = contacts.filter(c => selectedContacts.size === 0 || selectedContacts.has(c.id));
    if (toExport.length === 0) return;

    const headers = ['Name', 'Title', 'Email', 'Phone', 'Organization', 'Industry', 'City', 'State', 'LinkedIn'];
    const rows = toExport.map(c => [
      c.name, c.title || '', c.email || '', c.phone || '',
      c.organization?.name || '', c.organization?.industry || '',
      c.city || c.organization?.city || '', c.state || c.organization?.state || '',
      c.linkedinUrl || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `locust-${activeTemplate || 'contacts'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasApiKey) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Apollo API Key Required</h2>
          <p className="text-sm text-slate-500">
            Add your Apollo.io API key to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">.env.local</code> as <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">APOLLO_API_KEY</code> and restart the server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save Toast */}
      {saveMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all ${
          saveMessage.startsWith('Error') ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'
        }`}>
          {saveMessage.startsWith('Error') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {saveMessage}
        </div>
      )}

      {/* Tab Navigation */}
      {viewMode === 'templates' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Contact Search</h2>
              <p className="text-sm text-slate-500">Search Apollo.io for leads using pre-built templates or custom filters</p>
            </div>
            <button
              onClick={() => { setViewMode('saved'); loadSavedContacts(1); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Database className="w-4 h-4" />
              Saved Contacts
              {savedCount > 0 && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                  {savedCount}
                </span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(template => {
              const meta = TEMPLATE_META[template.id] || { icon: Users, color: 'text-slate-600 bg-slate-50 border-slate-200', description: '' };
              const Icon = meta.icon;
              return (
                <button
                  key={template.id}
                  onClick={() => handleTemplateClick(template.id)}
                  className={`border rounded-lg p-5 text-left hover:shadow-md transition-all group ${meta.color}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-white/60">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm group-hover:text-primary transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{meta.description}</p>
                      <p className="text-xs text-slate-400 mt-2">{template.titleCount} job titles targeted</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Active Search View */}
      {viewMode === 'search' && activeTemplate && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setViewMode('templates'); setActiveTemplate(null); setContacts([]); setError(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {TEMPLATE_META[activeTemplate]?.description?.split(' at ')[0] || activeTemplate}
                </h2>
                <p className="text-xs text-slate-500">
                  {pagination.totalEntries.toLocaleString()} contacts found
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {contacts.length > 0 && (
                <>
                  <button
                    onClick={selectedContacts.size > 0 ? saveSelectedContacts : saveAllContacts}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {saving ? 'Saving...' : selectedContacts.size > 0 ? `Save ${selectedContacts.size} selected` : 'Save all to DB'}
                  </button>
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                </>
              )}
              <button
                onClick={() => { setViewMode('saved'); loadSavedContacts(1); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                <Database className="w-3.5 h-3.5" />
                Saved ({savedCount})
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-2.5">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Keyword search..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && activeTemplate) searchContacts(activeTemplate, 1); }}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
            />
            <div className="w-px h-5 bg-slate-200" />
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Location (e.g. New York)"
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && activeTemplate) searchContacts(activeTemplate, 1); }}
              className="w-48 text-sm bg-transparent outline-none placeholder:text-slate-400"
            />
            <button
              onClick={() => activeTemplate && searchContacts(activeTemplate, 1)}
              className="px-3 py-1 bg-primary text-white text-xs font-medium rounded-md hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
            {(searchKeyword || locationFilter) && (
              <button
                onClick={() => { setSearchKeyword(''); setLocationFilter(''); if (activeTemplate) searchContacts(activeTemplate, 1); }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">{error}</p>
                {error.includes('403') ? (
                  <p className="text-xs text-red-600 mt-1">Apollo API requires a paid plan. Upgrade at <a href="https://app.apollo.io/" target="_blank" rel="noopener noreferrer" className="underline font-medium">app.apollo.io</a></p>
                ) : (
                  <p className="text-xs text-red-600 mt-1">Check your Apollo API key and try again.</p>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="ml-3 text-sm text-slate-500">Searching Apollo...</span>
            </div>
          )}

          {/* Results Table */}
          {!loading && contacts.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-10 px-3 py-2.5">
                      <input type="checkbox" checked={selectedContacts.size === contacts.length && contacts.length > 0} onChange={toggleAll} className="rounded border-slate-300" />
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Organization</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="w-20 px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(contact => (
                    <tr key={contact.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedContacts.has(contact.id) ? 'bg-primary/5' : ''}`}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedContacts.has(contact.id)} onChange={() => toggleContact(contact.id)} className="rounded border-slate-300" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium text-xs flex-shrink-0">
                            {contact.firstName?.charAt(0)}{contact.lastName?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{contact.name}</p>
                            {contact.linkedinUrl && (
                              <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-600">LinkedIn</a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><p className="text-slate-700 truncate max-w-[200px]">{contact.title || '—'}</p></td>
                      <td className="px-3 py-3">
                        <div className="min-w-0">
                          <p className="text-slate-900 font-medium truncate">{contact.organization?.name || '—'}</p>
                          {contact.organization?.industry && <p className="text-xs text-slate-400 truncate">{contact.organization.industry}</p>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-slate-600 text-xs">{[contact.city || contact.organization?.city, contact.state || contact.organization?.state].filter(Boolean).join(', ') || '—'}</p>
                      </td>
                      <td className="px-3 py-3">
                        {contact.email ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-700 truncate max-w-[160px]">{contact.email}</span>
                            {contact.emailStatus === 'verified' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" title="Verified" />}
                          </div>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="p-1 text-slate-400 hover:text-primary rounded transition-colors" title="Send email">
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {contact.linkedinUrl && (
                            <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-blue-500 rounded transition-colors" title="View LinkedIn">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-500">
                  Showing {((pagination.page - 1) * pagination.perPage) + 1}–{Math.min(pagination.page * pagination.perPage, pagination.totalEntries)} of {pagination.totalEntries.toLocaleString()}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1} className="p-1.5 text-slate-400 hover:text-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-slate-600 px-2">Page {pagination.page} of {pagination.totalPages}</span>
                  <button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-1.5 text-slate-400 hover:text-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && contacts.length === 0 && (
            <div className="text-center py-16">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Click Search to find contacts, or add keyword/location filters</p>
            </div>
          )}
        </>
      )}

      {/* Saved Contacts View */}
      {viewMode === 'saved' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('templates')}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Saved Contacts</h2>
                <p className="text-xs text-slate-500">{savedPagination.totalEntries} contacts in database</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedSaved.size > 0 && (
                <button
                  onClick={deleteSelectedSaved}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete {selectedSaved.size}
                </button>
              )}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search saved contacts..."
                value={savedSearch}
                onChange={e => setSavedSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadSavedContacts(1); }}
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
              />
            </div>
            <select
              value={savedStatusFilter}
              onChange={e => { setSavedStatusFilter(e.target.value); }}
              className="text-sm px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 cursor-pointer hover:border-slate-300 transition-colors"
            >
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="replied">Replied</option>
              <option value="qualified">Qualified</option>
              <option value="disqualified">Disqualified</option>
            </select>
            <select
              value={savedStateFilter}
              onChange={e => { setSavedStateFilter(e.target.value); }}
              className="text-sm px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 cursor-pointer hover:border-slate-300 transition-colors"
            >
              <option value="">All states</option>
              <option value="Illinois">Illinois</option>
              <option value="Massachusetts">Massachusetts</option>
              <option value="Texas">Texas</option>
            </select>
            <select
              value={savedTypeFilter}
              onChange={e => { setSavedTypeFilter(e.target.value); }}
              className="text-sm px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 cursor-pointer hover:border-slate-300 transition-colors"
            >
              <option value="">All types</option>
              <option value="landlord">Landlord</option>
              <option value="employer">Employer</option>
              <option value="residency">Residency</option>
              <option value="university">University</option>
            </select>
            <button
              onClick={() => loadSavedContacts(1)}
              className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:bg-primary/90 transition-colors"
            >
              Filter
            </button>
          </div>

          {savedLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="ml-3 text-sm text-slate-500">Loading saved contacts...</span>
            </div>
          )}

          {!savedLoading && savedContacts.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-10 px-3 py-2.5">
                      <input type="checkbox" checked={selectedSaved.size === savedContacts.length && savedContacts.length > 0} onChange={toggleAllSaved} className="rounded border-slate-300" />
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Organization</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="w-20 px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedContacts.map(contact => (
                    <tr key={contact.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedSaved.has(contact.id) ? 'bg-primary/5' : ''}`}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedSaved.has(contact.id)} onChange={() => toggleSaved(contact.id)} className="rounded border-slate-300" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium text-xs flex-shrink-0">
                            {contact.first_name?.charAt(0) || ''}{contact.last_name?.charAt(0) || ''}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{contact.name}</p>
                            {contact.source_template && (
                              <p className="text-[10px] text-slate-400">{contact.source_template.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><p className="text-slate-700 truncate max-w-[180px]">{contact.title || '—'}</p></td>
                      <td className="px-3 py-3">
                        <div className="min-w-0">
                          <p className="text-slate-900 font-medium truncate">{contact.org_name || '—'}</p>
                          {contact.org_industry && <p className="text-xs text-slate-400 truncate">{contact.org_industry}</p>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {contact.email ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-700 truncate max-w-[140px]">{contact.email}</span>
                            {contact.email_status === 'verified' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" title="Verified" />}
                          </div>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={contact.status}
                          onChange={e => updateContactStatus(contact.id, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[contact.status] || 'bg-slate-100 text-slate-700'}`}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="replied">Replied</option>
                          <option value="qualified">Qualified</option>
                          <option value="disqualified">Disqualified</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {contact.email && (
                            <button
                              onClick={() => openEmailComposer(contact)}
                              className="p-1 text-slate-400 hover:text-primary rounded transition-colors"
                              title="Compose AI email"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors" title="Open in mail client">
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {contact.linkedin_url && (
                            <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-blue-500 rounded transition-colors" title="View LinkedIn">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-500">
                  Showing {((savedPagination.page - 1) * savedPagination.perPage) + 1}–{Math.min(savedPagination.page * savedPagination.perPage, savedPagination.totalEntries)} of {savedPagination.totalEntries}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => loadSavedContacts(savedPagination.page - 1)} disabled={savedPagination.page <= 1} className="p-1.5 text-slate-400 hover:text-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-slate-600 px-2">Page {savedPagination.page} of {savedPagination.totalPages}</span>
                  <button onClick={() => loadSavedContacts(savedPagination.page + 1)} disabled={savedPagination.page >= savedPagination.totalPages} className="p-1.5 text-slate-400 hover:text-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {!savedLoading && savedContacts.length === 0 && (
            <div className="text-center py-16">
              <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-3">No saved contacts yet</p>
              <button
                onClick={() => setViewMode('templates')}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                Search Apollo for contacts
              </button>
            </div>
          )}
        </>
      )}

      {/* Email Composer Drawer */}
      {emailContact && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => { setEmailContact(null); setEmailSendStatus('idle'); }}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                  {emailContact.first_name?.charAt(0) || ''}{emailContact.last_name?.charAt(0) || ''}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{emailContact.name}</p>
                  <p className="text-xs text-slate-500 truncate">{emailContact.email}</p>
                </div>
              </div>
              <button
                onClick={() => { setEmailContact(null); setEmailSendStatus('idle'); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contact Info Bar */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 space-y-1">
              <div className="flex items-center gap-4 text-xs text-slate-500">
                {emailContact.title && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {emailContact.title}
                  </span>
                )}
                {emailContact.org_name && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {emailContact.org_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[emailContact.status] || 'bg-slate-100 text-slate-700'}`}>
                  {emailContact.status}
                </span>
                {emailContact.source_template && (
                  <span className="text-slate-400">
                    via {emailContact.source_template.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                )}
              </div>
            </div>

            {/* Sequence Selector */}
            <div className="px-5 py-3 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email Sequence</p>
              <div className="flex gap-1.5">
                {getSequenceLabels(getLeadType(emailContact)).map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setEmailNumber(idx + 1); setGeneratedSubject(''); setGeneratedBody(''); setEmailSendStatus('idle'); }}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      emailNumber === idx + 1
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    #{idx + 1}: {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Generate Button */}
              {!generatedBody && !isGenerating && (
                <button
                  onClick={generateEmail}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-white font-medium rounded-lg hover:from-primary/90 hover:to-primary/70 transition-all shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Email with AI
                </button>
              )}

              {/* Generating Indicator */}
              {isGenerating && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Generating personalized email...</p>
                    <p className="text-xs text-slate-400 mt-1">Using AI to craft the perfect outreach</p>
                  </div>
                </div>
              )}

              {/* Email Preview / Editor */}
              {generatedBody && !isGenerating && (
                <div className="space-y-3">
                  {/* Subject */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</label>
                      <button
                        onClick={() => setEmailEditMode(!emailEditMode)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-primary transition-colors"
                      >
                        {emailEditMode ? <Eye className="w-3 h-3" /> : <Edit className="w-3 h-3" />}
                        {emailEditMode ? 'Preview' : 'Edit'}
                      </button>
                    </div>
                    {emailEditMode ? (
                      <input
                        type="text"
                        value={generatedSubject}
                        onChange={e => setGeneratedSubject(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    ) : (
                      <p className="text-sm font-medium text-slate-900 px-3 py-2 bg-slate-50 rounded-lg">{generatedSubject}</p>
                    )}
                  </div>

                  {/* Body */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Body</label>
                    {emailEditMode ? (
                      <textarea
                        value={generatedBody}
                        onChange={e => setGeneratedBody(e.target.value)}
                        rows={12}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none font-mono"
                      />
                    ) : (
                      <div className="text-sm text-slate-700 px-3 py-2 bg-slate-50 rounded-lg whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                        {generatedBody}
                      </div>
                    )}
                  </div>

                  {/* Regenerate */}
                  <button
                    onClick={generateEmail}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </button>
                </div>
              )}

              {/* Send Status Messages */}
              {emailSendStatus === 'success' && (
                <div className="flex items-center gap-2 px-4 py-3 bg-green-50 text-green-800 border border-green-200 rounded-lg text-sm">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Email sent successfully! Contact marked as contacted.
                </div>
              )}
              {emailSendStatus === 'error' && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Failed to send. Check SMTP settings in .env.local.
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {generatedBody && !isGenerating && emailSendStatus !== 'success' && (
              <div className="px-5 py-4 border-t border-slate-200 bg-white">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setEmailContact(null); setEmailSendStatus('idle'); }}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendEmail}
                    disabled={isSending || !emailContact.email}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
