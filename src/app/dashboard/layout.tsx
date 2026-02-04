'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bug,
  Send,
  Inbox,
  BarChart3,
  Settings,
  LogOut,
  Users,
  Building2,
  Home,
  ChevronDown,
  Bell,
} from 'lucide-react';

interface User {
  name: string;
  email: string;
  role: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check auth
    const token = localStorage.getItem('locust_token');
    if (!token) {
      router.push('/');
      return;
    }

    // Decode token to get user info
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({
        name: payload.name,
        email: payload.email,
        role: payload.role,
      });
    } catch {
      router.push('/');
      return;
    }

    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('locust_token');
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Bug className="w-8 h-8 text-green-600 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Bug className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Locust</h1>
              <p className="text-xs text-gray-500">AI Account Executive</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3">
            Outreach
          </p>
          <NavLink href="/dashboard" icon={<Send className="w-5 h-5" />} label="Send Emails" />
          <NavLink href="/dashboard/inbox" icon={<Inbox className="w-5 h-5" />} label="Inbox" badge={2} />

          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3 mt-6">
            Leads
          </p>
          <NavLink href="/dashboard/landlords" icon={<Home className="w-5 h-5" />} label="Landlords" />
          <NavLink href="/dashboard/employers" icon={<Building2 className="w-5 h-5" />} label="Employers" />

          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3 mt-6">
            Analytics
          </p>
          <NavLink href="/dashboard/pipeline" icon={<BarChart3 className="w-5 h-5" />} label="Pipeline" />
          <NavLink href="/dashboard/reports" icon={<Users className="w-5 h-5" />} label="Reports" />

          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3 mt-6">
            Settings
          </p>
          <NavLink href="/dashboard/settings" icon={<Settings className="w-5 h-5" />} label="Settings" />
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-700 font-medium">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  // Simple active check
  const isActive = typeof window !== 'undefined' && window.location.pathname === href;

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-green-50 text-green-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <span className={isActive ? 'text-green-600' : 'text-gray-400'}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
          {badge}
        </span>
      )}
    </Link>
  );
}
