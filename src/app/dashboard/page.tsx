'use client';

import { useState } from 'react';
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
} from 'lucide-react';

// Types
interface Lead {
  id: string;
  name: string;
  email: string;
  type: 'landlord' | 'employer';
  company?: string;
  propertyCount?: number;
  relocationCount?: number;
  city: string;
  score: number;
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'closed';
}

interface GeneratedEmail {
  subject: string;
  body: string;
}

// Sample data from Grasshopper/Cricket
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

  const leads = leadType === 'landlord' ? SAMPLE_LANDLORDS : SAMPLE_EMPLOYERS;

  const generateEmail = async () => {
    if (!selectedLead) return;
    setIsGenerating(true);
    setSendStatus('idle');

    // Simulate API call - in production, call /api/email/generate
    await new Promise(resolve => setTimeout(resolve, 1000));

    const firstName = selectedLead.name.split(' ')[0];
    let email: GeneratedEmail;

    if (selectedLead.type === 'landlord') {
      email = {
        subject: `${firstName}, quick question about your ${selectedLead.propertyCount} ${selectedLead.city} properties`,
        body: `Hi ${firstName},

I noticed you manage ${selectedLead.propertyCount} properties in the ${selectedLead.city} area.

Quick question: How do you compete with corporate landlords who have dedicated marketing teams and direct relationships with major employers?

Here's the thing - major employers relocate hundreds of employees to ${selectedLead.city} every year. Right now, most of those tenants go to big property management companies who have the resources to build those pipelines.

We level that playing field.

SweetLease gives independent landlords like you access to the same corporate tenant pipeline that the big guys have. Pre-screened relocations who need housing NOW - sent directly to your properties.

The result? 7-10 days to fill vs. 30-45 days. Zero marketing spend. Tenants with employer-backed lease guarantees.

Worth a 10-minute call to see if this fits your portfolio?

Best,
Terrell Gilbert
SweetLease | Batch Fulfillment for Landlords
https://calendly.com/sweetlease/intro`
      };
    } else {
      email = {
        subject: `${selectedLead.company} relocations - a better way`,
        body: `Hi ${firstName},

I noticed ${selectedLead.company} relocates approximately ${selectedLead.relocationCount} employees to ${selectedLead.city} each year.

Quick question: How much time does your team spend helping new hires find housing?

I ask because we work with similar companies to take housing completely off their plate.

Here's how it works:

1. Employee pays $99.99 (one-time fee)
2. We negotiate lower rents on their behalf ($100-300/month savings)
3. Pre-screened, verified landlords - no scams or bad situations
4. Move-in coordination - we handle everything

Cost to ${selectedLead.company}: $0

Your employees get better housing at lower rates. You get happier new hires who hit the ground running.

Worth 10 minutes to explore?

https://calendly.com/sweetlease/intro

Best,
Terrell Gilbert
SweetLease | Corporate Housing Solutions`
      };
    }

    setGeneratedEmail(email);
    setEditedSubject(email.subject);
    setEditedBody(email.body);
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

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-700',
      contacted: 'bg-yellow-100 text-yellow-700',
      responded: 'bg-green-100 text-green-700',
      qualified: 'bg-purple-100 text-purple-700',
      closed: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-6 h-6 text-blue-600" />} label="Total Leads" value="9" />
        <StatCard icon={<Send className="w-6 h-6 text-green-600" />} label="Emails Sent" value="24" />
        <StatCard icon={<Mail className="w-6 h-6 text-purple-600" />} label="Responses" value="6" />
        <StatCard icon={<TrendingUp className="w-6 h-6 text-orange-600" />} label="Response Rate" value="25%" />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-6">
        {/* Lead Selection */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Select Lead</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setLeadType('landlord')}
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
                onClick={() => setLeadType('employer')}
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
            {leads.map((lead) => (
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
                        ? `${lead.propertyCount} properties in ${lead.city}`
                        : `${lead.company} - ${lead.relocationCount} relocations/yr`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-green-600">{lead.score}</span>
                    {getStatusBadge(lead.status)}
                  </div>
                </div>
              </div>
            ))}
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
                  className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
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
            <h3 className="font-semibold text-gray-900">Email Preview</h3>
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
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}
