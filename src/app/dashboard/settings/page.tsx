'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Mail,
  User,
  Bell,
  Database,
  Save,
  CheckCircle,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/layout/page-header';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, 'checking' | 'connected' | 'disconnected'>>({
    grasshopper: 'checking',
    cricket: 'checking',
    smtp: 'checking',
  });

  // Settings state
  const [profile, setProfile] = useState({
    name: 'Terrell Gilbert',
    email: 'tgilbert@sweetlease.io',
    phone: '(512) 555-0100',
    title: 'Account Executive',
    calendlyLink: 'https://calendly.com/sweetlease/intro',
  });

  const [emailSettings, setEmailSettings] = useState({
    smtpHost: 'smtp.porkbun.com',
    smtpPort: '587',
    smtpUser: '',
    smtpConfigured: false,
    imapConfigured: false,
    anthropicConfigured: false,
    signature: `Best,\nTerrell Gilbert\nSweetLease | Batch Fulfillment for Landlords\nhttps://calendly.com/sweetlease/intro`,
  });

  const [notifications, setNotifications] = useState({
    emailResponses: true,
    highPriority: true,
    dailyDigest: true,
    weeklyReport: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings;

        // Merge with state
        if (s.profile_name) setProfile(prev => ({ ...prev, name: s.profile_name }));
        if (s.profile_email) setProfile(prev => ({ ...prev, email: s.profile_email }));
        if (s.profile_phone) setProfile(prev => ({ ...prev, phone: s.profile_phone }));
        if (s.profile_title) setProfile(prev => ({ ...prev, title: s.profile_title }));
        if (s.profile_calendly) setProfile(prev => ({ ...prev, calendlyLink: s.profile_calendly }));
        if (s.email_signature) setEmailSettings(prev => ({ ...prev, signature: s.email_signature }));
        if (s.notify_responses) setNotifications(prev => ({ ...prev, emailResponses: s.notify_responses === 'true' }));
        if (s.notify_priority) setNotifications(prev => ({ ...prev, highPriority: s.notify_priority === 'true' }));
        if (s.notify_digest) setNotifications(prev => ({ ...prev, dailyDigest: s.notify_digest === 'true' }));
        if (s.notify_weekly) setNotifications(prev => ({ ...prev, weeklyReport: s.notify_weekly === 'true' }));

        // Env var status
        setEmailSettings(prev => ({
          ...prev,
          smtpConfigured: s._smtp_configured === 'true',
          imapConfigured: s._imap_configured === 'true',
          anthropicConfigured: s._anthropic_configured === 'true',
          smtpUser: s._smtp_user || '',
        }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            profile_name: profile.name,
            profile_email: profile.email,
            profile_phone: profile.phone,
            profile_title: profile.title,
            profile_calendly: profile.calendlyLink,
            email_signature: emailSettings.signature,
            notify_responses: notifications.emailResponses.toString(),
            notify_priority: notifications.highPriority.toString(),
            notify_digest: notifications.dailyDigest.toString(),
            notify_weekly: notifications.weeklyReport.toString(),
          },
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
    setIsSaving(false);
  };

  const testConnection = async (service: string) => {
    setConnectionStatuses(prev => ({ ...prev, [service]: 'checking' }));
    try {
      let url = '';
      if (service === 'grasshopper') url = '/api/crm/landlords?limit=1';
      else if (service === 'cricket') url = '/api/crm/employers?limit=1';
      else if (service === 'smtp') url = '/api/inbox?limit=1';

      const res = await fetch(url);
      setConnectionStatuses(prev => ({
        ...prev,
        [service]: res.ok ? 'connected' : 'disconnected',
      }));
    } catch {
      setConnectionStatuses(prev => ({ ...prev, [service]: 'disconnected' }));
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'integrations', label: 'Integrations', icon: <Database className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return <LoadingState message="Loading settings..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Settings"
        description="Manage your account and preferences"
        icon={<Settings className="w-7 h-7 text-green-600" />}
      />

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full px-3 py-2 text-left rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calendly Link</label>
                  <input type="url" value={profile.calendlyLink} onChange={(e) => setProfile({ ...profile, calendlyLink: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Email Settings</h2>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">SMTP/IMAP Configuration</h3>
                <p className="text-sm text-gray-500 mb-3">Email credentials are managed via environment variables for security.</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">SMTP</span>
                    {emailSettings.smtpConfigured ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm"><Wifi className="w-4 h-4" />Configured ({emailSettings.smtpUser})</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm"><WifiOff className="w-4 h-4" />Not configured</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">IMAP</span>
                    {emailSettings.imapConfigured ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm"><Wifi className="w-4 h-4" />Configured</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm"><WifiOff className="w-4 h-4" />Not configured</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Claude AI</span>
                    {emailSettings.anthropicConfigured ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm"><Wifi className="w-4 h-4" />Configured</span>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-600 text-sm"><AlertCircle className="w-4 h-4" />Not set (using templates)</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Signature</label>
                <textarea
                  value={emailSettings.signature}
                  onChange={(e) => setEmailSettings({ ...emailSettings, signature: e.target.value })}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                />
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
              <div className="space-y-4">
                {[
                  { key: 'emailResponses', label: 'Email Responses', desc: 'Get notified when leads reply to your emails' },
                  { key: 'highPriority', label: 'High Priority Alerts', desc: 'Immediate notification for hot leads' },
                  { key: 'dailyDigest', label: 'Daily Digest', desc: 'Summary of daily outreach activity' },
                  { key: 'weeklyReport', label: 'Weekly Report', desc: 'Pipeline and performance summary' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications[item.key as keyof typeof notifications]}
                      onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                      className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
              <div className="space-y-4">
                {[
                  { key: 'grasshopper', name: 'Grasshopper CRM', desc: 'Landlord database', icon: '🦗', color: 'bg-green-100', url: 'http://198.199.78.62:8080' },
                  { key: 'cricket', name: 'Cricket CRM', desc: 'Employer database', icon: '🦗', color: 'bg-blue-100', url: 'http://198.199.78.62:8081' },
                  { key: 'smtp', name: 'Porkbun Email', desc: 'SMTP & IMAP', iconEl: <Mail className="w-5 h-5 text-purple-600" />, color: 'bg-purple-100' },
                ].map((integration) => (
                  <div key={integration.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${integration.color} rounded-lg flex items-center justify-center`}>
                        {integration.iconEl || <span className="text-xl">{integration.icon}</span>}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{integration.name}</p>
                        <p className="text-sm text-gray-500">{integration.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {connectionStatuses[integration.key] === 'checking' ? (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">Unknown</span>
                      ) : connectionStatuses[integration.key] === 'connected' ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Connected</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">Disconnected</span>
                      )}
                      <button
                        onClick={() => testConnection(integration.key)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                        title="Test Connection"
                      >
                        <RefreshCw className={`w-4 h-4 ${connectionStatuses[integration.key] === 'checking' ? '' : ''}`} />
                      </button>
                      {integration.url && (
                        <a href={integration.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-gray-600">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🏠</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">SweetLease</p>
                      <p className="text-sm text-gray-500">Main platform</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Connected</span>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-end gap-3">
            {saveSuccess && (
              <span className="text-green-600 flex items-center gap-1 text-sm">
                <CheckCircle className="w-4 h-4" />
                Settings saved!
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
