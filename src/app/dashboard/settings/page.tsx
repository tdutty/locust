'use client';

import { useState } from 'react';
import {
  Settings,
  Mail,
  User,
  Bell,
  Shield,
  Database,
  Save,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
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
    smtpUser: 'tgilbert@sweetlease.io',
    signature: `Best,
Terrell Gilbert
SweetLease | Batch Fulfillment for Landlords
https://calendly.com/sweetlease/intro`,
  });

  const [notifications, setNotifications] = useState({
    emailResponses: true,
    highPriority: true,
    dailyDigest: true,
    weeklyReport: false,
  });

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'integrations', label: 'Integrations', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-green-600" />
          Settings
        </h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

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
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={profile.title}
                    onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calendly Link</label>
                  <input
                    type="url"
                    value={profile.calendlyLink}
                    onChange={(e) => setProfile({ ...profile, calendlyLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Email Settings</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                  <input
                    type="text"
                    value={emailSettings.smtpHost}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                  <input
                    type="text"
                    value={emailSettings.smtpPort}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">SMTP User</label>
                  <input
                    type="email"
                    value={emailSettings.smtpUser}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Signature</label>
                  <textarea
                    value={emailSettings.signature}
                    onChange={(e) => setEmailSettings({ ...emailSettings, signature: e.target.value })}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>

              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900">Email Responses</p>
                    <p className="text-sm text-gray-500">Get notified when leads reply to your emails</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.emailResponses}
                    onChange={(e) => setNotifications({ ...notifications, emailResponses: e.target.checked })}
                    className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900">High Priority Alerts</p>
                    <p className="text-sm text-gray-500">Immediate notification for hot leads</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.highPriority}
                    onChange={(e) => setNotifications({ ...notifications, highPriority: e.target.checked })}
                    className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900">Daily Digest</p>
                    <p className="text-sm text-gray-500">Summary of daily outreach activity</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.dailyDigest}
                    onChange={(e) => setNotifications({ ...notifications, dailyDigest: e.target.checked })}
                    className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900">Weekly Report</p>
                    <p className="text-sm text-gray-500">Pipeline and performance summary</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.weeklyReport}
                    onChange={(e) => setNotifications({ ...notifications, weeklyReport: e.target.checked })}
                    className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🦗</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Grasshopper CRM</p>
                      <p className="text-sm text-gray-500">Landlord database</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Connected</span>
                    <a href="http://198.199.78.62:8080" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-gray-600">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🦗</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Cricket CRM</p>
                      <p className="text-sm text-gray-500">Employer database</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Connected</span>
                    <a href="http://198.199.78.62:8081" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-gray-600">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Porkbun Email</p>
                      <p className="text-sm text-gray-500">SMTP & IMAP</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Connected</span>
                </div>

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
