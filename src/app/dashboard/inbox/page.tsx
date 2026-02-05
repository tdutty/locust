'use client';

import { useState, useEffect, useCallback } from 'react';
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
  CheckCheck,
  Send,
  Server,
  Database,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { formatRelativeTime } from '@/lib/utils';

interface Email {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  classification: 'interested' | 'objection' | 'not_interested' | 'question' | 'spam' | 'system';
  priority: 'high' | 'medium' | 'low';
  isRead: boolean;
  isStarred: boolean;
  hasReplied?: boolean;
}

interface InboxResponse {
  emails: Email[];
  total: number;
  source: 'imap' | 'sample';
}

interface GenerateReplyResponse {
  to: string;
  subject: string;
  body: string;
  source: string;
  suggestedAction: string;
}

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [generatedReply, setGeneratedReply] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [dataSource, setDataSource] = useState<'imap' | 'sample' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const fetchEmails = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const res = await fetch('/api/inbox');
      if (!res.ok) {
        throw new Error(`Failed to fetch emails: ${res.status} ${res.statusText}`);
      }
      const data: InboxResponse = await res.json();
      setEmails(data.emails);
      setDataSource(data.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEmails(false);
  }, [fetchEmails]);

  const filteredEmails = emails
    .filter((email) => {
      if (filter === 'unread') return !email.isRead;
      if (filter === 'starred') return email.isStarred;
      if (filter === 'high') return email.priority === 'high';
      if (filter !== 'all') return email.classification === filter;
      return true;
    })
    .filter((email) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        email.from.toLowerCase().includes(q) ||
        email.fromEmail.toLowerCase().includes(q) ||
        email.subject.toLowerCase().includes(q) ||
        email.preview.toLowerCase().includes(q)
      );
    });

  const unreadCount = emails.filter((e) => !e.isRead).length;
  const highPriorityCount = emails.filter((e) => e.priority === 'high' && !e.isRead).length;

  const handleRefresh = () => {
    fetchEmails(true);
  };

  const handleMarkAllAsRead = () => {
    setEmails((prev) => prev.map((e) => ({ ...e, isRead: true })));
  };

  const handleMarkAsRead = (emailId: string) => {
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, isRead: true } : e)));
  };

  const handleToggleStar = (emailId: string) => {
    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, isStarred: !e.isStarred } : e))
    );
  };

  const handleGenerateReply = async () => {
    if (!selectedEmail) return;
    setIsGeneratingReply(true);
    setSendSuccess(false);

    try {
      const res = await fetch('/api/email/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalEmail: {
            from: selectedEmail.from,
            fromEmail: selectedEmail.fromEmail,
            subject: selectedEmail.subject,
            body: selectedEmail.body,
            classification: selectedEmail.classification,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate reply: ${res.status} ${res.statusText}`);
      }

      const data: GenerateReplyResponse = await res.json();
      setGeneratedReply(data.body);
      setReplySubject(data.subject);
      setReplyTo(data.to);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate reply');
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyTo || !generatedReply) return;
    setIsSending(true);
    setSendSuccess(false);

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: replyTo,
          subject: replySubject,
          body: generatedReply,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to send reply: ${res.status} ${res.statusText}`);
      }

      setSendSuccess(true);
      setGeneratedReply('');
      setReplySubject('');
      setReplyTo('');

      // Mark the email as replied in local state
      if (selectedEmail) {
        setEmails((prev) =>
          prev.map((e) => (e.id === selectedEmail.id ? { ...e, hasReplied: true } : e))
        );
        setSelectedEmail((prev) => (prev ? { ...prev, hasReplied: true } : prev));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  const getClassificationBadge = (classification: string) => {
    const styles: Record<string, string> = {
      interested: 'bg-black text-white border-2 border-black',
      objection: 'bg-white text-black border-2 border-black',
      not_interested: 'bg-white text-black/50 border-2 border-black',
      question: 'bg-white text-black border-2 border-black',
      spam: 'bg-transparent text-black/40 border-2 border-black/40 line-through',
      system: 'bg-white text-black/50 border-2 border-black/50',
    };
    return (
      <span
        className={`inline-block px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${styles[classification] || 'bg-white text-black border-2 border-black'}`}
      >
        {classification.replace('_', ' ')}
      </span>
    );
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'high') return <AlertCircle className="w-4 h-4 text-[#dc2626]" />;
    if (priority === 'medium') return <Clock className="w-4 h-4 text-black/60" />;
    return null;
  };

  const getSourceIndicator = () => {
    if (!dataSource) return null;
    const isImap = dataSource === 'imap';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium uppercase tracking-wider border-2 border-black ${
          isImap ? 'bg-black text-white' : 'bg-white text-black'
        }`}
      >
        {isImap ? <Server className="w-3 h-3" /> : <Database className="w-3 h-3" />}
        {isImap ? 'IMAP' : 'Sample'}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Inbox"
          description="Loading emails..."
          icon={<Inbox className="w-7 h-7 text-black" />}
        />
        <LoadingState message="Fetching your inbox..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Inbox"
        description={`${unreadCount} unread ${unreadCount !== 1 ? 'messages' : 'message'} \u2022 ${highPriorityCount} high priority`}
        icon={<Inbox className="w-7 h-7 text-black" />}
        badge={getSourceIndicator()}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
              className="btn-secondary disabled:cursor-not-allowed"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-secondary"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-white border-2 border-[#dc2626] p-3 flex items-center justify-between">
          <p className="text-sm text-[#dc2626] font-medium">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs font-medium uppercase tracking-widest text-black/60 hover:text-black transition-all duration-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Send Success Banner */}
      {sendSuccess && (
        <div className="bg-black text-white border-2 border-black p-3 flex items-center justify-between">
          <p className="text-sm font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Reply sent successfully!
          </p>
          <button
            onClick={() => setSendSuccess(false)}
            className="text-xs font-medium uppercase tracking-widest text-white/60 hover:text-white transition-all duration-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base pl-10"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'unread', 'starred', 'interested', 'objection', 'high'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider border-2 border-black transition-all duration-200 ${
                filter === f
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-black hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Email List & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email List */}
        <div className="card overflow-hidden">
          {emails.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="No emails yet"
              description="Your inbox is empty. Emails will appear here when you receive responses."
            />
          ) : filteredEmails.length === 0 ? (
            <EmptyState
              icon="search"
              title="No matching emails"
              description="Try adjusting your search or filter criteria."
            />
          ) : (
            <div className="max-h-[600px] overflow-y-auto divide-y divide-black/10">
              {filteredEmails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => {
                    setSelectedEmail(email);
                    handleMarkAsRead(email.id);
                    setGeneratedReply('');
                    setReplySubject('');
                    setReplyTo('');
                    setSendSuccess(false);
                  }}
                  className={`p-4 cursor-pointer transition-all duration-200 ${
                    selectedEmail?.id === email.id
                      ? 'bg-black text-white'
                      : email.isRead
                        ? 'bg-white hover:bg-[#FAF9F6]'
                        : 'bg-white border-l-[3px] border-l-black hover:bg-[#FAF9F6]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStar(email.id);
                      }}
                      className="mt-1 transition-all duration-200"
                    >
                      {email.isStarred ? (
                        <Star className={`w-4 h-4 ${selectedEmail?.id === email.id ? 'text-white fill-white' : 'text-black fill-black'}`} />
                      ) : (
                        <StarOff className={`w-4 h-4 ${selectedEmail?.id === email.id ? 'text-white/40 hover:text-white' : 'text-black/30 hover:text-black'}`} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-medium truncate ${
                            selectedEmail?.id === email.id
                              ? 'text-white'
                              : !email.isRead
                                ? 'text-black'
                                : 'text-black/60'
                          }`}
                        >
                          {email.from}
                        </span>
                        <span className={`text-xs whitespace-nowrap ${
                          selectedEmail?.id === email.id ? 'text-white/60' : 'text-black/40'
                        }`}>
                          {formatRelativeTime(email.date)}
                        </span>
                      </div>
                      <p
                        className={`text-sm truncate ${
                          selectedEmail?.id === email.id
                            ? 'text-white/80'
                            : !email.isRead
                              ? 'font-medium text-black'
                              : 'text-black/60'
                        }`}
                      >
                        {email.subject}
                      </p>
                      <p className={`text-sm truncate ${
                        selectedEmail?.id === email.id ? 'text-white/50' : 'text-black/40'
                      }`}>
                        {email.preview}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {getPriorityIcon(email.priority)}
                        {selectedEmail?.id === email.id ? (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium uppercase tracking-wider border border-white/40 text-white/80">
                            {email.classification.replace('_', ' ')}
                          </span>
                        ) : (
                          getClassificationBadge(email.classification)
                        )}
                        {email.hasReplied && (
                          <span className={`text-xs flex items-center gap-1 ${
                            selectedEmail?.id === email.id ? 'text-white/60' : 'text-black/60'
                          }`}>
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
          )}
        </div>

        {/* Email Preview */}
        <div className="card overflow-hidden">
          {!selectedEmail ? (
            <div className="h-[600px] flex items-center justify-center text-black/30">
              <div className="text-center">
                <Mail className="w-12 h-12 mx-auto mb-3" />
                <p className="text-sm uppercase tracking-wider">Select an email to view</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-[600px]">
              {/* Email Header */}
              <div className="p-4 border-b-2 border-black">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-black">{selectedEmail.subject}</h3>
                    <p className="text-sm text-black/60 mt-1">
                      From: {selectedEmail.from} &lt;{selectedEmail.fromEmail}&gt;
                    </p>
                    <p className="text-sm text-black/40">
                      {formatRelativeTime(selectedEmail.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getClassificationBadge(selectedEmail.classification)}
                  </div>
                </div>
              </div>

              {/* Email Body */}
              <div className="flex-1 p-4 overflow-y-auto bg-[#FAF9F6]">
                <div className="max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-black/80">
                    {selectedEmail.body}
                  </pre>
                </div>
              </div>

              {/* Reply Section */}
              {selectedEmail.classification !== 'system' &&
                selectedEmail.classification !== 'spam' && (
                  <div className="p-4 border-t-2 border-black bg-white">
                    {!generatedReply ? (
                      <button
                        onClick={handleGenerateReply}
                        disabled={isGeneratingReply}
                        className="btn-primary w-full"
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
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium uppercase tracking-widest text-black/60">
                            To: {replyTo}
                          </span>
                          <span className="text-xs font-medium uppercase tracking-widest text-black/60">
                            Subject: {replySubject}
                          </span>
                        </div>
                        <textarea
                          value={generatedReply}
                          onChange={(e) => setGeneratedReply(e.target.value)}
                          rows={8}
                          className="input-base text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSendReply}
                            disabled={isSending}
                            className="btn-primary flex-1"
                          >
                            {isSending ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                Send Reply
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleGenerateReply}
                            disabled={isGeneratingReply}
                            className="btn-secondary disabled:opacity-40"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Regenerate
                          </button>
                          <button
                            onClick={() => {
                              setGeneratedReply('');
                              setReplySubject('');
                              setReplyTo('');
                            }}
                            className="btn-secondary"
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
