'use client';

import { useState, useEffect } from 'react';
import {
  Inbox,
  Mail,
  RefreshCw,
  Reply,
  Trash2,
  Star,
  StarOff,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Filter,
  Search,
  Sparkles,
} from 'lucide-react';

interface Email {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;
  body: string;
  receivedAt: string;
  classification: 'interested' | 'objection' | 'not_interested' | 'question' | 'spam' | 'system';
  priority: 'high' | 'medium' | 'low';
  isRead: boolean;
  isStarred: boolean;
  hasReplied: boolean;
  leadType?: 'landlord' | 'employer';
}

// Sample inbox data
const SAMPLE_EMAILS: Email[] = [
  {
    id: '1',
    from: 'robert.chen@gmail.com',
    fromName: 'Robert Chen',
    subject: 'Re: Quick question about your Raleigh properties',
    preview: 'Hi Terrell, this sounds interesting. Can you tell me more about how the tenant screening works?',
    body: `Hi Terrell,

This sounds interesting. Can you tell me more about how the tenant screening works? I've had issues in the past with tenants not paying on time.

Also, what's the typical lease term for these corporate relocations?

Thanks,
Robert`,
    receivedAt: '2 hours ago',
    classification: 'interested',
    priority: 'high',
    isRead: false,
    isStarred: true,
    hasReplied: false,
    leadType: 'landlord',
  },
  {
    id: '2',
    from: 'j.wu@apple.com',
    fromName: 'Jennifer Wu',
    subject: 'Re: Apple relocations - a better way',
    preview: 'Thanks for reaching out. We currently use a different vendor for our relocation housing...',
    body: `Hi Terrell,

Thanks for reaching out. We currently use a different vendor for our relocation housing needs. We signed a 2-year contract with them last year.

However, I'd be open to learning more for when our contract is up for renewal. Can you send over some case studies?

Best,
Jennifer Wu
HR Operations, Apple`,
    receivedAt: '1 day ago',
    classification: 'objection',
    priority: 'medium',
    isRead: true,
    isStarred: false,
    hasReplied: true,
    leadType: 'employer',
  },
  {
    id: '3',
    from: 'maria.garcia@outlook.com',
    fromName: 'Maria Garcia',
    subject: 'Re: Your Charlotte vacancies are costing you money',
    preview: 'Not interested at this time. Please remove me from your list.',
    body: `Not interested at this time. Please remove me from your list.

Maria`,
    receivedAt: '2 days ago',
    classification: 'not_interested',
    priority: 'low',
    isRead: true,
    isStarred: false,
    hasReplied: false,
    leadType: 'landlord',
  },
  {
    id: '4',
    from: 'david.kim@bofa.com',
    fromName: 'David Kim',
    subject: 'Re: Bank of America relocations',
    preview: 'This is exactly what we need! We have 50 relocations coming up in Q2. Can we schedule a call?',
    body: `Terrell,

This is exactly what we need! We have 50 relocations coming up in Q2 for our Charlotte expansion.

Can we schedule a call this week to discuss? I'm available Tuesday or Wednesday afternoon.

David Kim
Relocation Manager
Bank of America`,
    receivedAt: '3 hours ago',
    classification: 'interested',
    priority: 'high',
    isRead: false,
    isStarred: true,
    hasReplied: false,
    leadType: 'employer',
  },
  {
    id: '5',
    from: 'noreply@system.sweetlease.io',
    fromName: 'System Alert',
    subject: 'Daily Email Report - January 30, 2026',
    preview: 'Your daily outreach summary: 5 emails sent, 2 responses received...',
    body: `Daily Outreach Summary

Emails Sent: 5
Responses Received: 2
Open Rate: 60%
Response Rate: 40%

Top Performing Subject Line:
"How to compete with corporate landlords" - 80% open rate`,
    receivedAt: '6 hours ago',
    classification: 'system',
    priority: 'low',
    isRead: true,
    isStarred: false,
    hasReplied: false,
  },
];

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>(SAMPLE_EMAILS);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [generatedReply, setGeneratedReply] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredEmails = emails.filter(email => {
    if (filter === 'unread') return !email.isRead;
    if (filter === 'starred') return email.isStarred;
    if (filter === 'high') return email.priority === 'high';
    if (filter !== 'all') return email.classification === filter;
    return true;
  }).filter(email => {
    if (!searchQuery) return true;
    return (
      email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.preview.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const unreadCount = emails.filter(e => !e.isRead).length;
  const highPriorityCount = emails.filter(e => e.priority === 'high' && !e.isRead).length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call to fetch new emails
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  const handleMarkAsRead = (emailId: string) => {
    setEmails(prev => prev.map(e =>
      e.id === emailId ? { ...e, isRead: true } : e
    ));
  };

  const handleToggleStar = (emailId: string) => {
    setEmails(prev => prev.map(e =>
      e.id === emailId ? { ...e, isStarred: !e.isStarred } : e
    ));
  };

  const handleGenerateReply = async () => {
    if (!selectedEmail) return;
    setIsGeneratingReply(true);

    // Simulate AI generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    let reply = '';
    if (selectedEmail.classification === 'interested') {
      reply = `Hi ${selectedEmail.fromName.split(' ')[0]},

Great to hear from you! I'd be happy to explain more.

${selectedEmail.leadType === 'landlord' ? `Regarding tenant screening - we run comprehensive background checks including:
- Credit verification
- Employment confirmation (verified directly with employer HR)
- Rental history check
- Criminal background screening

The key difference is that 70% of our tenants come with employer-backed lease guarantees. That means if the tenant doesn't pay, their employer is on the hook. It's essentially Fortune 500 credit backing your rent.

Typical lease terms are 12-18 months for corporate relocations. These aren't short-term stays - employees are relocating permanently.` : `Absolutely! Here's what makes us different:

For your ${selectedEmail.fromName.includes('Bank') ? '50 upcoming relocations' : 'team'}:
- Employees pay just $99.99 one-time (not per month)
- We negotiate $100-300/month rent savings for them
- Average time to find housing: 5 days
- Zero scam risk - all landlords pre-verified

Cost to Bank of America: $0`}

Would you have 15 minutes this week for a quick call? I can walk you through exactly how it would work for your situation.

Best,
Terrell Gilbert
SweetLease
https://calendly.com/sweetlease/intro`;
    } else if (selectedEmail.classification === 'objection') {
      reply = `Hi ${selectedEmail.fromName.split(' ')[0]},

Completely understand - timing is everything. I appreciate you being upfront about your current contract.

I'd be happy to send over some case studies so you have them for reference when renewal time comes. A few quick highlights:

- Companies typically see 75% reduction in HR time spent on housing
- Employees find housing in 5 days vs 3-4 weeks
- Zero cost to the employer

I'll follow up closer to your renewal date. In the meantime, feel free to reach out if anything changes.

Best,
Terrell`;
    }

    setGeneratedReply(reply);
    setIsGeneratingReply(false);
  };

  const getClassificationBadge = (classification: string) => {
    const styles: Record<string, string> = {
      interested: 'bg-green-100 text-green-700',
      objection: 'bg-yellow-100 text-yellow-700',
      not_interested: 'bg-red-100 text-red-700',
      question: 'bg-blue-100 text-blue-700',
      spam: 'bg-gray-100 text-gray-700',
      system: 'bg-purple-100 text-purple-700',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[classification]}`}>
        {classification.replace('_', ' ')}
      </span>
    );
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'high') return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (priority === 'medium') return <Clock className="w-4 h-4 text-yellow-500" />;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-500">
            {unreadCount} unread • {highPriorityCount} high priority
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'unread', 'starred', 'interested', 'objection', 'high'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filter === f
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Email List & Preview */}
      <div className="grid grid-cols-2 gap-6">
        {/* Email List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-100">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                onClick={() => {
                  setSelectedEmail(email);
                  handleMarkAsRead(email.id);
                  setGeneratedReply('');
                }}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedEmail?.id === email.id
                    ? 'bg-green-50'
                    : email.isRead
                    ? 'bg-white hover:bg-gray-50'
                    : 'bg-blue-50 hover:bg-blue-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStar(email.id);
                    }}
                    className="mt-1"
                  >
                    {email.isStarred ? (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <StarOff className="w-4 h-4 text-gray-300 hover:text-yellow-500" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-medium truncate ${!email.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                        {email.fromName}
                      </span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{email.receivedAt}</span>
                    </div>
                    <p className={`text-sm truncate ${!email.isRead ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                      {email.subject}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{email.preview}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {getPriorityIcon(email.priority)}
                      {getClassificationBadge(email.classification)}
                      {email.hasReplied && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Replied
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Email Preview */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {!selectedEmail ? (
            <div className="h-[600px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select an email to view</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-[600px]">
              {/* Email Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedEmail.subject}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      From: {selectedEmail.fromName} &lt;{selectedEmail.from}&gt;
                    </p>
                    <p className="text-sm text-gray-500">{selectedEmail.receivedAt}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getClassificationBadge(selectedEmail.classification)}
                  </div>
                </div>
              </div>

              {/* Email Body */}
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-gray-700">{selectedEmail.body}</pre>
                </div>
              </div>

              {/* Reply Section */}
              {selectedEmail.classification !== 'system' && selectedEmail.classification !== 'spam' && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  {!generatedReply ? (
                    <button
                      onClick={handleGenerateReply}
                      disabled={isGeneratingReply}
                      className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingReply ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Generating Reply...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate AI Reply
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={generatedReply}
                        onChange={(e) => setGeneratedReply(e.target.value)}
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      />
                      <div className="flex gap-2">
                        <button className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors">
                          <Reply className="w-4 h-4" />
                          Send Reply
                        </button>
                        <button
                          onClick={() => setGeneratedReply('')}
                          className="py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
