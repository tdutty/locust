'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  DEMO_CONTENT,
  TIMELINE_OPTIONS,
  calculateEstimate,
  type AudienceType,
  type QuestionOption,
  type SlideContent,
  type ValueProp,
} from '@/lib/demo-content';

interface Booking {
  id: number;
  attendee_name: string;
  attendee_email: string;
  event_type: string;
  scheduled_at: string;
  status: string;
  tavus_conversation_url: string | null;
  qualification_data: Record<string, any> | null;
  demo_completed_at: string | null;
  contact_id: number | null;
}

type DemoState = 'loading' | 'step_qualify' | 'step_platform' | 'step_confirm' | 'completed' | 'error' | 'not_found' | 'cancelled';

// ─── Icons ───────────────────────────────────────────────────────────────

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <line x1="8" y1="6" x2="8" y2="6" />
      <line x1="16" y1="6" x2="16" y2="6" />
      <line x1="12" y1="6" x2="12" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10" />
      <line x1="16" y1="10" x2="16" y2="10" />
      <line x1="12" y1="10" x2="12" y2="10" />
      <line x1="8" y1="14" x2="8" y2="14" />
      <line x1="16" y1="14" x2="16" y2="14" />
      <line x1="12" y1="14" x2="12" y2="14" />
    </svg>
  );
}

const VALUE_PROP_ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  dollar: DollarIcon,
  clock: ClockIcon,
  shield: ShieldIcon,
  users: UsersIcon,
  chart: ChartIcon,
  building: BuildingIcon,
};

// ─── Sub-components ──────────────────────────────────────────────────────

const STEP_LABELS = ['Qualify', 'Platform Tour', 'Your Estimate'];

function Logo() {
  return (
    <div className="mb-10">
      <span className="text-[32px] font-extrabold tracking-tight">
        <span className="text-[#EA580C]">SWEET</span>
        <span className="text-slate-900">LEASE</span>
      </span>
    </div>
  );
}

function AvatarCircle({ name }: { name: string }) {
  const initials = (name || '').split(' ').map(n => n?.[0] || '').join('').toUpperCase().slice(0, 2) || '?';
  return (
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center mx-auto mb-4 ring-4 ring-orange-50">
      <span className="text-xl font-bold text-[#EA580C]">{initials}</span>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-[#EA580C] border border-orange-100">
      {label}
    </span>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              i < current
                ? 'bg-[#EA580C] text-white'
                : i === current
                ? 'bg-[#EA580C] text-white ring-4 ring-[#EA580C]/20'
                : 'bg-slate-200 text-slate-500'
            }`}>
              {i < current ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${
              i <= current ? 'text-slate-900' : 'text-slate-400'
            }`}>{label}</span>
          </div>
        ))}
      </div>
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#EA580C] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${((current) / (total - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

function PillSelector({
  options,
  selected,
  onSelect,
  multiSelect = false,
}: {
  options: QuestionOption[];
  selected: string | string[];
  onSelect: (value: string | string[]) => void;
  multiSelect?: boolean;
}) {
  const selectedArr = Array.isArray(selected) ? selected : selected ? [selected] : [];

  function handleClick(value: string) {
    if (multiSelect) {
      const newSelected = selectedArr.includes(value)
        ? selectedArr.filter(v => v !== value)
        : [...selectedArr, value];
      onSelect(newSelected);
    } else {
      onSelect(value);
    }
  }

  return (
    <div className="flex flex-wrap gap-2.5 justify-center">
      {options.map(opt => {
        const isSelected = selectedArr.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => handleClick(opt.value)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border-2 ${
              isSelected
                ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-md shadow-orange-200/50'
                : 'bg-white text-slate-600 border-slate-200 hover:border-[#EA580C]/40 hover:text-slate-900 hover:shadow-sm'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PlatformSlideshow({
  slides,
  onComplete,
}: {
  slides: SlideContent[];
  onComplete: () => void;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [highestViewed, setHighestViewed] = useState(0);

  function goTo(index: number) {
    setCurrentSlide(index);
    const newHighest = Math.max(highestViewed, index);
    setHighestViewed(newHighest);
    if (newHighest >= slides.length - 1) {
      onComplete();
    }
  }

  function next() {
    if (currentSlide < slides.length - 1) {
      goTo(currentSlide + 1);
    } else {
      onComplete();
    }
  }

  function prev() {
    if (currentSlide > 0) {
      goTo(currentSlide - 1);
    }
  }

  const slide = slides[currentSlide];

  return (
    <div>
      {/* Browser mockup frame */}
      <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200/80 bg-white mb-5">
        {/* Browser chrome */}
        <div className="bg-slate-50 px-4 py-3 flex items-center gap-3 border-b border-slate-200/80">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 bg-white rounded-md px-4 py-1.5 text-xs text-slate-400 text-center font-mono border border-slate-100">
            <LockIcon className="w-3 h-3 inline-block mr-1.5 -mt-0.5 text-green-500" />
            sweetlease.io
          </div>
          <div className="w-[52px]" />
        </div>
        {/* Screenshot */}
        <img
          src={slide.image}
          alt={slide.title}
          className="w-full h-auto block"
        />
      </div>

      {/* Title + Highlight + Caption */}
      <div className="mb-5 text-left">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-[#EA580C] uppercase tracking-wider">{currentSlide + 1}/{slides.length}</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">{slide.title}</h3>
        <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-100 mb-2">
          <span className="text-xs font-bold text-emerald-700">{slide.highlight}</span>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">{slide.caption}</p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prev}
          disabled={currentSlide === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                     text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all
                     disabled:opacity-0 disabled:pointer-events-none"
        >
          <ChevronLeftIcon className="w-4 h-4" /> Back
        </button>

        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentSlide ? 'w-8 bg-[#EA580C]' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                     text-[#EA580C] hover:bg-orange-50 transition-all"
        >
          {currentSlide < slides.length - 1 ? 'Next' : 'Done'} <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ValuePropCards({ valueProps }: { valueProps: ValueProp[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
      {valueProps.map((vp, i) => {
        const IconComponent = VALUE_PROP_ICONS[vp.icon] || DollarIcon;
        return (
          <div key={i} className="text-left bg-slate-50/80 border border-slate-100 rounded-xl p-5">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center mb-3">
              <IconComponent className="w-5 h-5 text-[#EA580C]" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">{vp.title}</h4>
            <p className="text-xs text-slate-500 leading-relaxed">{vp.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function EstimateDisplay({ value, label }: { value: number; label: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<number>();

  useEffect(() => {
    const duration = 1500;
    const startTime = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) animationRef.current = requestAnimationFrame(animate);
    }

    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [value]);

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(displayValue);

  return (
    <div className="text-center py-8 bg-gradient-to-b from-orange-50/80 to-transparent rounded-2xl mb-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{label}</p>
      <p className="text-6xl font-extrabold text-[#EA580C] tabular-nums tracking-tight">{formatted}</p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────

export default function MeetingPage() {
  const params = useParams();
  const id = params.id as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [state, setState] = useState<DemoState>('loading');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [painPoint, setPainPoint] = useState('');
  const [timeline, setTimeline] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [editableEmail, setEditableEmail] = useState('');
  const [slideshowDone, setSlideshowDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/meeting/${id}`)
      .then(res => {
        if (res.status === 404) { setState('not_found'); return null; }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setBooking(data);
        setEditableEmail(data.attendee_email);
        if (data.status === 'cancelled') setState('cancelled');
        else if (data.demo_completed_at) setState('completed');
        else setState('step_qualify');
      })
      .catch(() => { setState('error'); setError('Failed to load details.'); });
  }, [id]);

  const firstName = booking?.attendee_name?.split(' ')[0] || 'there';
  const audienceType = (booking?.event_type || 'employer') as AudienceType;
  const content = DEMO_CONTENT[audienceType] || DEMO_CONTENT.employer;

  const stepIndex = { step_qualify: 0, step_platform: 1, step_confirm: 2 }[state as string] ?? -1;

  const qualifyComplete = content.questions.every(q => {
    const val = answers[q.id];
    if (q.multiSelect) return Array.isArray(val) && val.length > 0;
    return !!val;
  });

  const estimateValue = calculateEstimate(audienceType, answers);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const qualificationData: Record<string, any> = {
        ...answers, pain_point: painPoint, timeline, audience_type: audienceType,
      };
      if (additionalNotes.trim()) qualificationData.additional_notes = additionalNotes.trim();

      const res = await fetch(`/api/meeting/${id}/complete-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualificationData, email: editableEmail }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to submit'); }
      setState('completed');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setState('error');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, answers, painPoint, timeline, audienceType, additionalNotes, editableEmail, id]);

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-sans antialiased">
      <div className="flex items-start justify-center min-h-screen px-4 py-12">
        <div className="max-w-[calc(100vw-2rem)] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl w-full text-center">
          <Logo />

          {/* Loading */}
          {state === 'loading' && (
            <div className="animate-fade-in py-20">
              <div className="w-10 h-10 border-[3px] border-slate-200 border-t-[#EA580C] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Loading your walkthrough...</p>
            </div>
          )}

          {/* Step 1: Qualify */}
          {state === 'step_qualify' && booking && (
            <div key="step_qualify" className="animate-fade-in-up">
              <ProgressBar current={0} total={3} />

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 sm:p-10 mb-6">
                <AvatarCircle name={booking.attendee_name} />

                <h1 className="text-2xl sm:text-[28px] font-extrabold text-slate-900 mb-2 leading-tight">
                  Hi {firstName}, let&apos;s see how SweetLease<br className="hidden sm:inline" /> can work for you.
                </h1>

                <div className="mb-8">
                  <StatusBadge label={content.badge} />
                </div>

                {/* Pain stat — prominent */}
                <div className="bg-red-50/80 border border-red-100 rounded-xl p-6 mb-8">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1.5">The problem</p>
                  <p className="text-lg font-bold text-slate-900 mb-1">{content.painHeadline}</p>
                  <p className="text-sm text-red-600/80">{content.painStat}</p>
                </div>

                {/* Qualifying questions */}
                <div className="space-y-8 mb-8">
                  {content.questions.map(q => (
                    <div key={q.id}>
                      <label className="block text-sm font-semibold text-slate-700 mb-3">{q.label}</label>
                      <PillSelector
                        options={q.options}
                        selected={answers[q.id] || (q.multiSelect ? [] : '')}
                        onSelect={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                        multiSelect={q.multiSelect}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setState('step_platform')}
                  disabled={!qualifyComplete}
                  className="w-full bg-[#EA580C] hover:bg-[#c2410c] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed
                             text-white font-semibold text-base py-3.5 px-6 rounded-xl transition-all duration-200
                             shadow-lg shadow-orange-200/30 hover:shadow-orange-300/40 disabled:shadow-none"
                >
                  See the Solution
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                <LockIcon className="w-3.5 h-3.5" />
                <span>Takes about 2 minutes &middot; Your data is secure</span>
              </div>
            </div>
          )}

          {/* Step 2: Platform Walkthrough + Value Props */}
          {state === 'step_platform' && booking && (
            <div key="step_platform" className="animate-fade-in-up">
              <ProgressBar current={1} total={3} />

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-10 mb-6">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1">{content.solutionHeadline}</h2>
                <p className="text-sm text-slate-400 mb-8">Click through to see the platform in action.</p>

                {/* Pain point question */}
                <div className="mb-8 pb-8 border-b border-slate-100">
                  <label className="block text-sm font-semibold text-slate-700 mb-3">{content.painPointQuestion}</label>
                  <PillSelector
                    options={content.painPointOptions}
                    selected={painPoint}
                    onSelect={(val) => setPainPoint(val as string)}
                  />
                </div>

                <PlatformSlideshow
                  slides={content.slides}
                  onComplete={() => setSlideshowDone(true)}
                />

                {/* Value Propositions — the core pitch */}
                <ValuePropCards valueProps={content.valueProps} />

                <button
                  onClick={() => setState('step_confirm')}
                  disabled={!painPoint}
                  className="w-full mt-8 bg-[#EA580C] hover:bg-[#c2410c] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed
                             text-white font-semibold text-base py-3.5 px-6 rounded-xl transition-all duration-200
                             shadow-lg shadow-orange-200/30 hover:shadow-orange-300/40 disabled:shadow-none"
                >
                  See Your Savings
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Estimate + Confirm */}
          {state === 'step_confirm' && booking && (
            <div key="step_confirm" className="animate-fade-in-up">
              <ProgressBar current={2} total={3} />

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 sm:p-10 mb-6">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1">Your personalized estimate</h2>
                <p className="text-sm text-slate-400 mb-6">Based on what you shared with us.</p>

                <EstimateDisplay value={estimateValue} label={content.estimateLabel} />
                <p className="text-xs text-slate-400 mb-2">{content.estimateDescription}</p>
                <p className="text-xs font-semibold text-emerald-600 mb-8">{content.estimateComparison}</p>

                {/* Timeline */}
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-slate-700 mb-3">When are you looking to get started?</label>
                  <PillSelector
                    options={TIMELINE_OPTIONS}
                    selected={timeline}
                    onSelect={(val) => setTimeline(val as string)}
                  />
                </div>

                {/* Email + Notes */}
                <div className="bg-slate-50/80 rounded-xl p-6 mb-8 text-left space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Your email</label>
                    <input
                      type="email"
                      value={editableEmail}
                      onChange={e => setEditableEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900
                                 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Anything else Robert should know? <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <textarea
                      value={additionalNotes}
                      onChange={e => setAdditionalNotes(e.target.value)}
                      rows={3}
                      placeholder="E.g., specific locations, timeline details, questions..."
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900
                                 placeholder:text-slate-300 resize-none
                                 focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] transition-all"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !editableEmail || !timeline}
                  className="w-full bg-[#EA580C] hover:bg-[#c2410c] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed
                             text-white font-semibold text-base py-3.5 px-6 rounded-xl transition-all duration-200
                             shadow-lg shadow-orange-200/30 hover:shadow-orange-300/40 disabled:shadow-none
                             flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Complete Walkthrough'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Completed */}
          {state === 'completed' && booking && (
            <div key="completed" className="animate-fade-in-up">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 sm:p-10 mb-6">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5 ring-4 ring-emerald-50">
                  <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
                </div>

                <h1 className="text-2xl sm:text-[28px] font-extrabold text-slate-900 mb-2">
                  Thank you, {firstName}!
                </h1>
                <p className="text-slate-400 text-[15px] leading-relaxed mb-8">
                  Robert will reach out within 24 hours with a custom proposal tailored to your needs.
                </p>

                <div className="bg-slate-50/80 rounded-xl p-6 text-left">
                  <p className="text-sm font-bold text-slate-900 mb-4">What happens next</p>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <MailIcon className="w-4 h-4 text-[#EA580C]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Personalized follow-up email</p>
                        <p className="text-xs text-slate-400">Within the hour summarizing your walkthrough and next steps.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <FileTextIcon className="w-4 h-4 text-[#EA580C]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Custom proposal</p>
                        <p className="text-xs text-slate-400">Tailored to your specific situation, portfolio size, and timeline.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-4 h-4 text-[#EA580C]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Direct line to Robert</p>
                        <p className="text-xs text-slate-400">He&apos;ll personally review your details and reach out to discuss.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-slate-300 text-xs">
                Powered by SweetLease &middot; sweetlease.io
              </p>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="animate-fade-in">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 sm:p-10">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <AlertCircleIcon className="w-7 h-7 text-red-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Something went wrong</h2>
                <p className="text-slate-400 text-sm mb-6">{error || 'Please try again.'}</p>
                <button
                  onClick={() => { setState('step_qualify'); setError(''); }}
                  className="bg-[#EA580C] hover:bg-[#c2410c] text-white font-semibold text-sm py-3 px-8 rounded-xl transition-all"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Not found */}
          {state === 'not_found' && (
            <div className="animate-fade-in">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 sm:p-10">
                <h2 className="text-lg font-bold text-slate-900 mb-2">Walkthrough Not Found</h2>
                <p className="text-slate-400 text-sm">
                  This link is invalid or has expired. Please check your email for the correct link.
                </p>
              </div>
            </div>
          )}

          {/* Cancelled */}
          {state === 'cancelled' && (
            <div className="animate-fade-in">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 sm:p-10">
                <h2 className="text-lg font-bold text-slate-900 mb-2">Session Cancelled</h2>
                <p className="text-slate-400 text-sm">
                  This session has been cancelled. Please check your email for an updated link.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
