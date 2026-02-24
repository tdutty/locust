'use client';

import { useEffect, useState } from 'react';
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

type MeetingState = 'loading' | 'waiting' | 'joining' | 'active' | 'error' | 'ended' | 'not_found' | 'cancelled';

export default function MeetingPage() {
  const params = useParams();
  const id = params.id as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [state, setState] = useState<MeetingState>('loading');
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  // Fetch booking details
  useEffect(() => {
    if (!id) return;

    fetch(`/api/meeting/${id}`)
      .then(res => {
        if (res.status === 404) {
          setState('not_found');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setBooking(data);

        if (data.status === 'cancelled') {
          setState('cancelled');
        } else if (data.tavus_conversation_url) {
          setConversationUrl(data.tavus_conversation_url);
          setState('active');
        } else {
          setState('waiting');
        }
      })
      .catch(() => {
        setState('error');
        setError('Failed to load meeting details.');
      });
  }, [id]);

  // Join meeting -- create Tavus conversation
  const joinMeeting = async () => {
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
  };

  const eventTypeLabel: Record<string, string> = {
    landlord: 'Landlord Partnership',
    employer: 'Employer Housing Program',
    university: 'University Partnership',
    residency: 'Residency Program Partnership',
    'benefits-platform': 'Benefits Platform Partnership',
  };

  return (
    <div style={{ margin: 0, padding: 0, minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Active meeting -- full screen iframe */}
      {state === 'active' && conversationUrl && (
        <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 50 }}>
          <iframe
            src={conversationUrl}
            allow="camera; microphone; autoplay; display-capture"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      )}

      {/* Non-active states */}
      {state !== 'active' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '16px' }}>
          <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
            {/* Logo */}
            <div style={{ marginBottom: '32px' }}>
              <span style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                <span style={{ color: '#EA580C' }}>SWEET</span>
                <span style={{ color: '#1a1a1a' }}>LEASE</span>
              </span>
            </div>

            {/* Loading */}
            {state === 'loading' && (
              <div>
                <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#EA580C', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                <p style={{ color: '#64748b', fontSize: '15px' }}>Loading meeting details...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* Waiting room */}
            {state === 'waiting' && booking && (
              <div>
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px' }}>
                    🎥
                  </div>
                  <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px' }}>
                    Welcome, {booking.attendee_name.split(' ')[0]}
                  </h1>
                  <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 4px' }}>
                    {eventTypeLabel[booking.event_type] || 'SweetLease Meeting'}
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 24px' }}>
                    {new Date(booking.scheduled_at).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                    })}
                  </p>
                  <p style={{ color: '#475569', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px' }}>
                    You will be meeting with <strong>Robert Gilbert</strong>, Account Executive at SweetLease.
                    Please ensure your camera and microphone are enabled.
                  </p>
                  <button
                    onClick={joinMeeting}
                    style={{
                      backgroundColor: '#EA580C', color: '#fff', border: 'none', borderRadius: '8px',
                      padding: '14px 32px', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                      width: '100%', transition: 'background-color 0.2s',
                    }}
                    onMouseOver={e => (e.currentTarget.style.backgroundColor = '#c2410c')}
                    onMouseOut={e => (e.currentTarget.style.backgroundColor = '#EA580C')}
                  >
                    Join Meeting
                  </button>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '12px' }}>
                  Powered by SweetLease  ·  sweetlease.io
                </p>
              </div>
            )}

            {/* Joining */}
            {state === 'joining' && (
              <div>
                <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#EA580C', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                <p style={{ color: '#1a1a1a', fontSize: '16px', fontWeight: 600 }}>Connecting you with Robert...</p>
                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px' }}>This will take a few seconds.</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* Error */}
            {state === 'error' && (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                  ⚠️
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 8px' }}>Connection Issue</h2>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px' }}>{error}</p>
                <button
                  onClick={() => { setState('waiting'); setError(''); }}
                  style={{
                    backgroundColor: '#EA580C', color: '#fff', border: 'none', borderRadius: '8px',
                    padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Not found */}
            {state === 'not_found' && (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 8px' }}>Meeting Not Found</h2>
                <p style={{ color: '#64748b', fontSize: '14px' }}>
                  This meeting link is invalid or has expired. Please check your email for the correct link, or book a new meeting at{' '}
                  <a href="https://calendly.com/sweetlease" style={{ color: '#EA580C', textDecoration: 'none' }}>calendly.com/sweetlease</a>.
                </p>
              </div>
            )}

            {/* Cancelled */}
            {state === 'cancelled' && (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 8px' }}>Meeting Cancelled</h2>
                <p style={{ color: '#64748b', fontSize: '14px' }}>
                  This meeting has been cancelled. To reschedule, visit{' '}
                  <a href="https://calendly.com/sweetlease" style={{ color: '#EA580C', textDecoration: 'none' }}>calendly.com/sweetlease</a>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
