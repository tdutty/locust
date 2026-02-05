'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Home,
  Building2,
  Eye,
  Edit,
  Mail,
  Users,
  TrendingUp,
  Clock,
  Database,
  FileText,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingSkeleton } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/layout/page-header';

// Types
interface Lead {
  id: string;
  name: string;
  email: string;
  type: 'landlord' | 'employer';
  company?: string;
  propertyCount?: number;
  units?: number;
  relocationCount?: number;
  industry?: string;
  city: string;
  state?: string;
  score: number;
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'closed';
}

interface GeneratedEmail {
  subject: string;
  body: string;
}

interface SentEmailLog {
  id: string;
  to: string;
  subject: string;
  leadType: string;
  sentAt: string;
  status: string;
}

type DataSource = 'Grasshopper' | 'Cricket' | 'Sample Data';

// Fallback sample data
const SAMPLE_LANDLORDS: Lead[] = [
  { id: 'l1', name: 'Alexander Phillips', email: 'a.phillips@example.com', type: 'landlord', propertyCount: 58, city: 'Austin', score: 92, status: 'new' },
  { id: 'l2', name: 'Kevin Lee', email: 'k.lee@example.com', type: 'landlord', propertyCount: 56, city: 'Charleston', score: 88, status: 'new' },
  { id: 'l3', name: 'William Johnson', email: 'w.johnson@example.com', type: 'landlord', propertyCount: 55, city: 'Greenville', score: 85, status: 'contacted' },
  { id: 'l4', name: 'Maria Garcia', email: 'm.garcia@example.com', type: 'landlord', propertyCount: 42, city: 'Charlotte', score: 78, status: 'new' },
  { id: 'l5', name: 'Robert Chen', email: 'r.chen@example.com', type: 'landlord', propertyCount: 38, city: 'Raleigh', score: 75, status: 'responded' },
];

const SAMPLE_EMPLOYERS: Lead[] = [
  { id: 'e1', name: 'Sarah Chen', email: 's.chen@tesla.com', type: 'employer', company: 'Tesla', relocationCount: 850, city: 'Austin', score: 95, status: 'new' },
  { id: 'e2', name: 'Michael Torres', email: 'm.torres@delta.com', type: 'employer', company: 'Delta Air Lines', relocationCount: 650, city: 'Atlanta', score: 90, status: 'new' },
  { id: 'e3', name: 'Jennifer Wu', email: 'j.wu@apple.com', type: 'employer', company: 'Apple', relocationCount: 520, city: 'Austin', score: 88, status: 'contacted' },
  { id: 'e4', name: 'David Kim', email: 'd.kim@bofa.com', type: 'employer', company: 'Bank of America', relocationCount: 450, city: 'Charlotte', score: 85, status: 'new' },
];

function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function DashboardPage() {
  const [leadType, setLeadType] = useState<'landlord' | 'employer'>('landlord');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [emailNumber, setEmailNumber] = useState(1);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // API-driven state
  const [landlords, setLandlords] = useState<Lead[]>([]);
  const [employers, setEmployers] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [dataSource, setDataSource] = useState<DataSource>('Sample Data');
  const [recentlySent, setRecentlySent] = useState<SentEmailLog[]>([]);
  const [isLoadingSent, setIsLoadingSent] = useState(false);

  // Fetch leads on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchLeads() {
      setIsLoadingLeads(true);
      let landlordSource: DataSource = 'Sample Data';
      let employerSource: DataSource = 'Sample Data';
      let fetchedLandlords: Lead[] = [];
      let fetchedEmployers: Lead[] = [];

      // Fetch landlords
      try {
        const res = await fetch('/api/crm/landlords');
        if (res.ok) {
          const data = await res.json();
          if (data.landlords && Array.isArray(data.landlords)) {
            fetchedLandlords = data.landlords.map((l: {
              id: string;
              name: string;
              email: string;
              phone?: string;
              property_count?: number;
              city: string;
              state?: string;
              score: number;
              status: string;
            }) => ({
              id: l.id,
              name: l.name,
              email: l.email,
              type: 'landlord' as const,
              propertyCount: l.property_count,
              city: l.city,
              state: l.state,
              score: l.score,
              status: l.status as Lead['status'],
            }));
            landlordSource = data.source === 'cricket' ? 'Cricket' : 'Grasshopper';
          }
        }
      } catch {
        // Fall through to sample data
      }

      // Fetch employers
      try {
        const res = await fetch('/api/crm/employers');
        if (res.ok) {
          const data = await res.json();
          if (data.employers && Array.isArray(data.employers)) {
            fetchedEmployers = data.employers.map((e: {
              id: string;
              company: string;
              contact_name: string;
              contact_email: string;
              phone?: string;
              relocation_count?: number;
              city: string;
              state?: string;
              industry?: string;
              score: number;
              status: string;
            }) => ({
              id: e.id,
              name: e.contact_name,
              email: e.contact_email,
              type: 'employer' as const,
              company: e.company,
              relocationCount: e.relocation_count,
              industry: e.industry,
              city: e.city,
              state: e.state,
              score: e.score,
              status: e.status as Lead['status'],
            }));
            employerSource = data.source === 'cricket' ? 'Cricket' : 'Grasshopper';
          }
        }
      } catch {
        // Fall through to sample data
      }

      if (cancelled) return;

      // Use fetched data or fall back to samples
      if (fetchedLandlords.length > 0) {
        setLandlords(fetchedLandlords);
      } else {
        setLandlords(SAMPLE_LANDLORDS);
        landlordSource = 'Sample Data';
      }

      if (fetchedEmployers.length > 0) {
        setEmployers(fetchedEmployers);
      } else {
        setEmployers(SAMPLE_EMPLOYERS);
        employerSource = 'Sample Data';
      }

      // Set data source based on whichever is currently active, preferring non-sample
      if (landlordSource !== 'Sample Data' || employerSource !== 'Sample Data') {
        setDataSource(landlordSource !== 'Sample Data' ? landlordSource : employerSource);
      } else {
        setDataSource('Sample Data');
      }

      setIsLoadingLeads(false);
    }

    fetchLeads();

    return () => { cancelled = true; };
  }, []);

  // Update data source indicator when lead type changes
  useEffect(() => {
    if (isLoadingLeads) return;
    const isUsingLiveLandlords = landlords.length > 0 && landlords[0]?.id !== 'l1';
    const isUsingLiveEmployers = employers.length > 0 && employers[0]?.id !== 'e1';

    if (leadType === 'landlord') {
      setDataSource(isUsingLiveLandlords ? (dataSource === 'Cricket' ? 'Cricket' : 'Grasshopper') : 'Sample Data');
    } else {
      setDataSource(isUsingLiveEmployers ? (dataSource === 'Cricket' ? 'Cricket' : 'Grasshopper') : 'Sample Data');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadType, isLoadingLeads]);

  // Fetch recently sent emails
  const fetchRecentlySent = useCallback(async () => {
    setIsLoadingSent(true);
    try {
      const res = await fetch('/api/email/log?limit=5');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.emails)) {
          setRecentlySent(data.emails);
        } else if (Array.isArray(data)) {
          setRecentlySent(data);
        }
      }
    } catch {
      // Silently fail - recently sent is not critical
    }
    setIsLoadingSent(false);
  }, []);

  // Fetch recently sent on mount
  useEffect(() => {
    fetchRecentlySent();
  }, [fetchRecentlySent]);

  const leads = leadType === 'landlord' ? landlords : employers;

  const totalLeads = landlords.length + employers.length;

  const generateEmail = async () => {
    if (!selectedLead) return;
    setIsGenerating(true);
    setSendStatus('idle');

    try {
      const response = await fetch('/api/email/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadType: selectedLead.type,
          lead: {
            name: selectedLead.name,
            email: selectedLead.email,
            company: selectedLead.company,
            city: selectedLead.city,
            properties: selectedLead.propertyCount,
            units: selectedLead.units,
            relocationsPerYear: selectedLead.relocationCount,
            industry: selectedLead.industry,
          },
          emailNumber,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const email: GeneratedEmail = {
          subject: data.subject,
          body: data.body,
        };
        setGeneratedEmail(email);
        setEditedSubject(email.subject);
        setEditedBody(email.body);
      } else {
        // API failed - show error state
        setSendStatus('error');
      }
    } catch {
      setSendStatus('error');
    }

    setIsGenerating(false);
  };

  const sendEmail = async () => {
    if (!selectedLead || !generatedEmail) return;
    setIsSending(true);

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedLead.email,
          subject: editMode ? editedSubject : generatedEmail.subject,
          body: editMode ? editedBody : generatedEmail.body,
          leadId: selectedLead.id,
          leadType: selectedLead.type,
        }),
      });

      if (response.ok) {
        setSendStatus('success');
        // Refresh recently sent list
        fetchRecentlySent();
        setTimeout(() => {
          setSendStatus('idle');
          setSelectedLead(null);
          setGeneratedEmail(null);
        }, 3000);
      } else {
        setSendStatus('error');
      }
    } catch {
      setSendStatus('error');
    }

    setIsSending(false);
  };

  const currentSubject = editMode ? editedSubject : generatedEmail?.subject || '';
  const currentBody = editMode ? editedBody : generatedEmail?.body || '';
  const emailWordCount = generatedEmail ? getWordCount(currentSubject + ' ' + currentBody) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Send Emails"
        description="Generate and send personalized outreach emails"
        icon={<Send className="w-7 h-7 text-green-600" />}
        badge={
          <span className={`ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${
            dataSource === 'Sample Data'
              ? 'bg-gray-100 text-gray-600'
              : dataSource === 'Grasshopper'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-blue-100 text-blue-700'
          }`}>
            <Database className="w-3 h-3" />
            {dataSource}
          </span>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-6 h-6 text-blue-600" />} label="Total Leads" value={String(totalLeads)} />
        <StatCard icon={<Send className="w-6 h-6 text-green-600" />} label="Emails Sent" value={String(recentlySent.length > 0 ? recentlySent.length + '+' : '0')} />
        <StatCard icon={<Mail className="w-6 h-6 text-purple-600" />} label="Responses" value="--" subtext="Tracking enabled" />
        <StatCard icon={<TrendingUp className="w-6 h-6 text-orange-600" />} label="Response Rate" value="--" subtext="Tracking enabled" />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Selection */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900">Select Lead</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setLeadType('landlord'); setSelectedLead(null); setGeneratedEmail(null); setSendStatus('idle'); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
                  leadType === 'landlord'
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Home className="w-4 h-4" />
                Landlords
              </button>
              <button
                onClick={() => { setLeadType('employer'); setSelectedLead(null); setGeneratedEmail(null); setSendStatus('idle'); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
                  leadType === 'employer'
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Employers
              </button>
            </div>
          </div>

          <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
            {isLoadingLeads ? (
              <LoadingSkeleton rows={5} />
            ) : leads.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No {leadType}s found</p>
              </div>
            ) : (
              leads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => {
                    setSelectedLead(lead);
                    setGeneratedEmail(null);
                    setSendStatus('idle');
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedLead?.id === lead.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{lead.name}</p>
                      <p className="text-sm text-gray-500">
                        {lead.type === 'landlord'
                          ? `${lead.propertyCount ?? 0} properties in ${lead.city}${lead.state ? `, ${lead.state}` : ''}`
                          : `${lead.company} - ${lead.relocationCount ?? 0} relocations/yr`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-green-600">{lead.score}</span>
                      <StatusBadge status={lead.status} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedLead && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <select
                  value={emailNumber}
                  onChange={(e) => setEmailNumber(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value={1}>Email #1 - Hook</option>
                  <option value={2}>Email #2 - Social Proof</option>
                  <option value={3}>Email #3 - ROI</option>
                  <option value={4}>Email #4 - Urgency</option>
                  <option value={5}>Email #5 - Breakup</option>
                </select>
                <button
                  onClick={generateEmail}
                  disabled={isGenerating}
                  className="flex-1 btn-primary"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Email
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Email Preview */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900">Email Preview</h3>
              {generatedEmail && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
                  <FileText className="w-3 h-3" />
                  {emailWordCount} words
                </span>
              )}
            </div>
            {generatedEmail && (
              <button
                onClick={() => setEditMode(!editMode)}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2"
              >
                {editMode ? (
                  <>
                    <Eye className="w-4 h-4" />
                    Preview
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4" />
                    Edit
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-4">
            {!generatedEmail ? (
              <div className="h-[400px] flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a lead and generate an email</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Headers */}
                <div className="text-sm space-y-1 pb-3 border-b border-gray-100">
                  <p><span className="text-gray-500">From:</span> tgilbert@sweetlease.io</p>
                  <p><span className="text-gray-500">To:</span> {selectedLead?.email}</p>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Subject</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  ) : (
                    <p className="font-medium text-gray-900">{generatedEmail.subject}</p>
                  )}
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Message</label>
                  {editMode ? (
                    <textarea
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap max-h-[250px] overflow-y-auto">
                      {generatedEmail.body}
                    </div>
                  )}
                </div>

                {/* Send Button */}
                <div className="pt-2">
                  {sendStatus === 'success' ? (
                    <button className="w-full py-2.5 px-4 bg-green-600 text-white font-medium rounded-lg flex items-center justify-center gap-2" disabled>
                      <CheckCircle className="w-5 h-5" />
                      Sent Successfully!
                    </button>
                  ) : sendStatus === 'error' ? (
                    <button
                      onClick={sendEmail}
                      className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <AlertCircle className="w-5 h-5" />
                      Failed - Retry
                    </button>
                  ) : (
                    <button
                      onClick={sendEmail}
                      disabled={isSending}
                      className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isSending ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Send Email
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recently Sent Section */}
      {recentlySent.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-900">Recently Sent</h3>
            </div>
            <button
              onClick={fetchRecentlySent}
              disabled={isLoadingSent}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSent ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {recentlySent.map((entry) => (
              <div key={entry.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{entry.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    To: {entry.to} &middot; {entry.leadType}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <span className="text-xs text-gray-400">
                    {new Date(entry.sentAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  <StatusBadge status={entry.status || 'sent'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
