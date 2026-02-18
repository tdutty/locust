'use client';

import { useState } from 'react';
import {
  Scale,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
} from 'lucide-react';

interface ClauseResult {
  clauseName: string;
  classification: 'GREEN' | 'YELLOW' | 'RED';
  playbookPosition: string;
  issue: string | null;
  recommendation: string | null;
  priority: string | null;
}

interface ReviewResult {
  reviewDate: string;
  state: string;
  clauses: ClauseResult[];
  greenCount: number;
  yellowCount: number;
  redCount: number;
  overallRating: 'GREEN' | 'YELLOW' | 'RED';
  missingClauses: string[];
  stateRequirements: string[];
  recommendations: string[];
}

const STATES = [
  { code: 'SC', name: 'South Carolina' },
  { code: 'TX', name: 'Texas' },
  { code: 'CA', name: 'California' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'GA', name: 'Georgia' },
];

export default function LegalReviewPage() {
  const [leaseText, setLeaseText] = useState('');
  const [state, setState] = useState('SC');
  const [isReviewing, setIsReviewing] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [expandedClauses, setExpandedClauses] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'review' | 'compliance' | 'playbook'>('review');

  const handleReview = async () => {
    if (!leaseText.trim()) return;
    setIsReviewing(true);
    setResult(null);

    try {
      const res = await fetch('/api/legal/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', leaseText, state }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error('Review failed:', err);
    } finally {
      setIsReviewing(false);
    }
  };

  const toggleClause = (index: number) => {
    setExpandedClauses((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const ratingColor = (rating: string) => {
    switch (rating) {
      case 'GREEN':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'YELLOW':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'RED':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const ratingIcon = (rating: string) => {
    switch (rating) {
      case 'GREEN':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'YELLOW':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'RED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Scale className="w-7 h-7 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lease Review</h1>
            <p className="text-sm text-gray-500">
              Review lease agreements against SweetLease legal playbook
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['review', 'compliance', 'playbook'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'review' ? 'Review Lease' : tab === 'compliance' ? 'Compliance' : 'Playbook'}
          </button>
        ))}
      </div>

      {activeTab === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">Lease Content</h2>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <MapPin className="w-4 h-4" /> State:
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={leaseText}
              onChange={(e) => setLeaseText(e.target.value)}
              placeholder="Paste the full lease agreement text here..."
              className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {leaseText.length.toLocaleString()} characters
              </p>
              <button
                onClick={handleReview}
                disabled={!leaseText.trim() || isReviewing}
                className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {isReviewing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Reviewing...
                  </>
                ) : (
                  <>
                    <Scale className="w-4 h-4" /> Review Lease
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="space-y-4">
            {!result && !isReviewing && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Scale className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-sm">
                  Paste a lease agreement and click &quot;Review Lease&quot; to analyze it against the
                  SweetLease legal playbook.
                </p>
              </div>
            )}

            {isReviewing && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Analyzing lease...</p>
                <p className="text-gray-400 text-sm mt-1">
                  Checking clauses against playbook positions
                </p>
              </div>
            )}

            {result && (
              <>
                {/* Overall Rating */}
                <div
                  className={`rounded-xl border p-5 ${ratingColor(result.overallRating)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {ratingIcon(result.overallRating)}
                      <div>
                        <p className="font-bold text-lg">
                          Overall: {result.overallRating}
                        </p>
                        <p className="text-sm opacity-80">
                          {result.overallRating === 'GREEN'
                            ? 'Lease meets playbook standards'
                            : result.overallRating === 'YELLOW'
                            ? 'Lease needs negotiation on some clauses'
                            : 'Lease has critical issues requiring escalation'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 mt-4 pt-4 border-t border-current/10">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">{result.greenCount} Green</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium">{result.yellowCount} Yellow</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium">{result.redCount} Red</span>
                    </div>
                  </div>
                </div>

                {/* Clause-by-Clause */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Clause Analysis</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {result.clauses.map((clause, idx) => (
                      <div key={idx}>
                        <button
                          onClick={() => toggleClause(idx)}
                          className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {ratingIcon(clause.classification)}
                            <span className="text-sm font-medium text-gray-900">
                              {clause.clauseName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${ratingColor(
                                clause.classification
                              )}`}
                            >
                              {clause.classification}
                            </span>
                            {expandedClauses.has(idx) ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </button>
                        {expandedClauses.has(idx) && (
                          <div className="px-5 pb-4 ml-8 space-y-2">
                            <p className="text-xs text-gray-500">
                              <span className="font-medium">Playbook Position:</span>{' '}
                              {clause.playbookPosition}
                            </p>
                            {clause.issue && (
                              <p className="text-xs text-red-600">
                                <span className="font-medium">Issue:</span> {clause.issue}
                              </p>
                            )}
                            {clause.recommendation && (
                              <p className="text-xs text-blue-600">
                                <span className="font-medium">Recommendation:</span>{' '}
                                {clause.recommendation}
                              </p>
                            )}
                            {clause.priority && (
                              <p className="text-xs text-gray-500">
                                <span className="font-medium">Priority:</span> {clause.priority}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Missing Clauses */}
                {result.missingClauses.length > 0 && (
                  <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                    <h3 className="font-semibold text-red-800 mb-3">Missing Clauses</h3>
                    <ul className="space-y-1">
                      {result.missingClauses.map((clause, idx) => (
                        <li key={idx} className="text-sm text-red-700 flex items-center gap-2">
                          <XCircle className="w-3.5 h-3.5 flex-shrink-0" /> {clause}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* State Requirements */}
                {result.stateRequirements.length > 0 && (
                  <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                    <h3 className="font-semibold text-blue-800 mb-3">
                      {result.state} State Requirements
                    </h3>
                    <ul className="space-y-1">
                      {result.stateRequirements.map((req, idx) => (
                        <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">&#8226;</span> {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'compliance' && <ComplianceTab />}
      {activeTab === 'playbook' && <PlaybookTab />}
    </div>
  );
}

function ComplianceTab() {
  const [state, setState] = useState('SC');
  const [requirements, setRequirements] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadCompliance = async () => {
    const res = await fetch('/api/legal/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'compliance', state }),
    });
    const data = await res.json();
    setRequirements(data.requirements);
    setLoaded(true);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">State Compliance Checklist</h2>
      <div className="flex items-center gap-3">
        <select
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setLoaded(false);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
        <button
          onClick={loadCompliance}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          Load Requirements
        </button>
      </div>
      {loaded && (
        <ul className="space-y-2 mt-4">
          {requirements.map((req, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5 rounded border-gray-300" />
              {req}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlaybookTab() {
  const [playbook, setPlaybook] = useState<Record<string, any> | null>(null);

  const loadPlaybook = async () => {
    const res = await fetch('/api/legal/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'playbook' }),
    });
    const data = await res.json();
    setPlaybook(data.playbook);
  };

  if (!playbook) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl text-center">
        <Scale className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-sm mb-4">View the SweetLease legal playbook positions</p>
        <button
          onClick={loadPlaybook}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          Load Playbook
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-3xl">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">SweetLease Legal Playbook</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {Object.entries(playbook).map(([key, pos]: [string, any]) => (
          <div key={key} className="px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900 capitalize mb-2">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </h3>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="font-medium text-green-700 mb-1">Standard</p>
                <p className="text-gray-600">{pos.standard}</p>
              </div>
              <div>
                <p className="font-medium text-yellow-700 mb-1">Acceptable</p>
                <p className="text-gray-600">{pos.acceptable}</p>
              </div>
              <div>
                <p className="font-medium text-red-700 mb-1">Escalation</p>
                <p className="text-gray-600">{pos.escalation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
