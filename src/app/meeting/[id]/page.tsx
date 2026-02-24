'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

interface Booking {
  id: number;
  attendee_name: string;
  attendee_email: string;
  event_type: string;
  scheduled_at: string;
  status: string;
  tavus_conversation_url: string | null;
}

type MeetingState = 'loading' | 'permission_check' | 'waiting' | 'joining' | 'active' | 'ended' | 'error' | 'not_found' | 'cancelled';

interface MediaStatus {
  camera: 'checking' | 'granted' | 'denied' | 'unavailable';
  microphone: 'checking' | 'granted' | 'denied' | 'unavailable';
}

// ─── Icons (inline SVG to avoid extra dependency) ─────────────────────────

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

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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

// ─── Hooks ────────────────────────────────────────────────────────────────

function useMediaPermissions() {
  const [media, setMedia] = useState<MediaStatus>({ camera: 'checking', microphone: 'checking' });

  useEffect(() => {
    async function check() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setMedia({ camera: 'granted', microphone: 'granted' });
        stream.getTracks().forEach(t => t.stop());
      } catch (err: any) {
        // Camera failed — try audio-only
        if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setMedia({ camera: err.name === 'NotFoundError' ? 'unavailable' : 'denied', microphone: 'granted' });
            audioStream.getTracks().forEach(t => t.stop());
          } catch {
            setMedia({ camera: 'denied', microphone: 'denied' });
          }
        } else {
          setMedia({ camera: 'unavailable', microphone: 'unavailable' });
        }
      }
    }
    check();
  }, []);

  return media;
}

function useWebRTCSupport() {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const ok = typeof RTCPeerConnection !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia;
    setSupported(ok);
  }, []);
  return supported;
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="mb-8">
      <span className="text-[28px] font-bold tracking-tight">
        <span className="text-[#EA580C]">SWEET</span>
        <span className="text-[#1a1a1a]">LEASE</span>
      </span>
    </div>
  );
}

function AvatarCircle({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-5">
      <span className="text-2xl font-bold text-[#EA580C]">{initials}</span>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-[#EA580C]">
      {label}
    </span>
  );
}

function DeviceCheckItem({ label, status }: { label: string; status: 'checking' | 'granted' | 'denied' | 'unavailable' }) {
  const icon = label === 'Camera' ? <VideoIcon className="w-4 h-4" /> :
    label === 'Microphone' ? <MicIcon className="w-4 h-4" /> :
    <GlobeIcon className="w-4 h-4" />;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5 text-sm text-slate-700">
        {icon}
        {label}
      </div>
      {status === 'checking' && (
        <div className="w-4 h-4 border-2 border-slate-200 border-t-[#EA580C] rounded-full animate-spin" />
      )}
      {status === 'granted' && <CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
      {(status === 'denied' || status === 'unavailable') && (
        <div className="flex items-center gap-1.5">
          <AlertCircleIcon className="w-5 h-5 text-red-400" />
          <span className="text-xs text-red-400">{status === 'denied' ? 'Blocked' : 'Not found'}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

const EVENT_TYPE_LABEL: Record<string, string> = {
  landlord: 'Landlord Partnership',
  employer: 'Employer Housing Program',
  university: 'University Partnership',
  residency: 'Residency Program Partnership',
  'benefits-platform': 'Benefits Platform Partnership',
};

export default function MeetingPage() {
  const params = useParams();
  const id = params.id as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [state, setState] = useState<MeetingState>('loading');
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const media = useMediaPermissions();
  const webrtcSupported = useWebRTCSupport();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const micReady = media.microphone === 'granted';

  // Fetch booking details
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
        if (data.status === 'cancelled') {
          setState('cancelled');
        } else if (data.status === 'completed') {
          setState('ended');
        } else if (data.tavus_conversation_url) {
          setConversationUrl(data.tavus_conversation_url);
          setState('active');
        } else {
          setState('permission_check');
        }
      })
      .catch(() => { setState('error'); setError('Failed to load meeting details.'); });
  }, [id]);

  // Transition from permission_check → waiting once media check completes
  useEffect(() => {
    if (state !== 'permission_check') return;
    if (media.camera !== 'checking' && media.microphone !== 'checking') {
      setState('waiting');
    }
  }, [state, media]);

  // Listen for conversation end events (Tavus / Daily)
  useEffect(() => {
    if (state !== 'active') return;

    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data) return;

      // Tavus sends conversation_ended or Daily sends left-meeting
      if (
        data.type === 'conversation_ended' ||
        data.type === 'left-meeting' ||
        data.action === 'conversation-ended' ||
        data.action === 'left-meeting'
      ) {
        setState('ended');
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [state]);

  // Join meeting
  const joinMeeting = useCallback(async () => {
    setState('joining');
    try {
      const res = await fetch('/api/meeting/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: parseInt(id) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start meeting');
      }
      const data = await res.json();
      setConversationUrl(data.conversation_url);
      setState('active');
    } catch (err: any) {
      setState('error');
      setError(err.message || 'Failed to connect to the meeting.');
    }
  }, [id]);

  const firstName = booking?.attendee_name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Active meeting: full-screen iframe ─────────────── */}
      {state === 'active' && conversationUrl && (
        <div className="fixed inset-0 z-50 bg-black">
          <iframe
            ref={iframeRef}
            src={conversationUrl}
            allow="camera; microphone; autoplay; display-capture"
            className="w-full h-full border-none"
          />
          {/* Floating connection indicator */}
          <div className="absolute top-4 right-4 z-[60] flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Connected
          </div>
        </div>
      )}

      {/* ── Non-active states ─────────────────────────────── */}
      {state !== 'active' && (
        <div className="flex items-center justify-center min-h-screen px-4 py-8">
          <div className="max-w-[calc(100vw-2rem)] sm:max-w-md w-full text-center">
            <Logo />

            {/* Loading */}
            {state === 'loading' && (
              <div className="animate-fade-in">
                <div className="w-10 h-10 border-[3px] border-slate-200 border-t-[#EA580C] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500 text-[15px]">Loading meeting details...</p>
              </div>
            )}

            {/* Permission check */}
            {state === 'permission_check' && (
              <div className="animate-fade-in">
                <div className="w-10 h-10 border-[3px] border-slate-200 border-t-[#EA580C] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-700 text-base font-semibold">Checking your devices...</p>
                <p className="text-slate-500 text-sm mt-2">Please allow camera and microphone access when prompted.</p>
              </div>
            )}

            {/* Waiting room */}
            {state === 'waiting' && booking && (
              <div className="animate-fade-in-up">
                <div className="card p-8 mb-6">
                  <AvatarCircle name={booking.attendee_name} />

                  <h1 className="text-[22px] font-bold text-slate-900 mb-2">
                    Welcome, {firstName}
                  </h1>

                  <div className="mb-1">
                    <StatusBadge label={EVENT_TYPE_LABEL[booking.event_type] || 'SweetLease Meeting'} />
                  </div>

                  <p className="text-slate-400 text-[13px] mb-6">
                    {new Date(booking.scheduled_at).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                    })}
                  </p>

                  <p className="text-slate-600 text-[15px] leading-relaxed mb-6">
                    You will be meeting with <strong>Robert Gilbert</strong>, Account Executive at SweetLease.
                  </p>

                  {/* Pre-call checklist */}
                  <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pre-call check</p>
                    <DeviceCheckItem label="Camera" status={media.camera} />
                    <DeviceCheckItem label="Microphone" status={media.microphone} />
                    <DeviceCheckItem label="Browser" status={webrtcSupported ? 'granted' : 'denied'} />
                  </div>

                  {!webrtcSupported && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800 text-left">
                      Your browser may not support video calls. Please use Chrome, Edge, or Safari for the best experience.
                    </div>
                  )}

                  <button
                    onClick={joinMeeting}
                    disabled={!micReady}
                    className="w-full bg-[#EA580C] hover:bg-[#c2410c] disabled:bg-slate-300 disabled:cursor-not-allowed
                               text-white font-semibold text-base py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    {micReady ? 'Join Meeting' : 'Waiting for microphone...'}
                  </button>
                </div>

                <p className="text-slate-400 text-xs">
                  Powered by SweetLease &middot; sweetlease.io
                </p>
              </div>
            )}

            {/* Joining */}
            {state === 'joining' && (
              <div className="animate-fade-in">
                <div className="w-10 h-10 border-[3px] border-slate-200 border-t-[#EA580C] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-900 text-base font-semibold">Connecting you with Robert...</p>
                <p className="text-slate-500 text-sm mt-2 mb-6">This will take a few seconds.</p>
                <div className="space-y-3 max-w-xs mx-auto">
                  <div className="shimmer h-3 w-full rounded" />
                  <div className="shimmer h-3 w-3/4 rounded" />
                  <div className="shimmer h-3 w-1/2 rounded" />
                </div>
              </div>
            )}

            {/* Ended */}
            {state === 'ended' && booking && (
              <div className="animate-fade-in-up">
                <div className="card p-8 mb-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
                    <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
                  </div>

                  <h1 className="text-[22px] font-bold text-slate-900 mb-2">
                    Thank you, {firstName}!
                  </h1>
                  <p className="text-slate-500 text-[15px] leading-relaxed mb-6">
                    Great connecting with you. Robert will review the conversation and follow up shortly.
                  </p>

                  {/* What happens next */}
                  <div className="bg-slate-50 rounded-lg p-5 text-left">
                    <p className="text-sm font-semibold text-slate-900 mb-3">What happens next</p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <MailIcon className="w-4 h-4 text-[#EA580C] mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-slate-600">
                          <strong>Follow-up email</strong> within the hour with a summary of what we discussed.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <FileTextIcon className="w-4 h-4 text-[#EA580C] mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-slate-600">
                          <strong>Relevant materials</strong> attached based on your needs.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <UserIcon className="w-4 h-4 text-[#EA580C] mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-slate-600">
                          <strong>Robert will review</strong> the conversation and reach out with next steps.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-slate-400 text-xs">
                  Powered by SweetLease &middot; sweetlease.io
                </p>
              </div>
            )}

            {/* Error */}
            {state === 'error' && (
              <div className="animate-fade-in">
                <div className="card p-8">
                  <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <AlertCircleIcon className="w-7 h-7 text-red-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-2">Connection Issue</h2>
                  <p className="text-slate-500 text-sm mb-5">{error || 'Something went wrong. Please try again.'}</p>
                  <button
                    onClick={() => { setState('waiting'); setError(''); }}
                    className="bg-[#EA580C] hover:bg-[#c2410c] text-white font-semibold text-sm py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Not found */}
            {state === 'not_found' && (
              <div className="animate-fade-in">
                <div className="card p-8">
                  <h2 className="text-lg font-semibold text-slate-900 mb-2">Meeting Not Found</h2>
                  <p className="text-slate-500 text-sm">
                    This meeting link is invalid or has expired. Please check your email for the correct link, or book a new meeting at{' '}
                    <a href="https://calendly.com/sweetlease" className="text-[#EA580C] hover:underline">calendly.com/sweetlease</a>.
                  </p>
                </div>
              </div>
            )}

            {/* Cancelled */}
            {state === 'cancelled' && (
              <div className="animate-fade-in">
                <div className="card p-8">
                  <h2 className="text-lg font-semibold text-slate-900 mb-2">Meeting Cancelled</h2>
                  <p className="text-slate-500 text-sm">
                    This meeting has been cancelled. To reschedule, visit{' '}
                    <a href="https://calendly.com/sweetlease" className="text-[#EA580C] hover:underline">calendly.com/sweetlease</a>.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
