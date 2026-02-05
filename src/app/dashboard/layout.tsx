'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  Bell,
  Menu,
  X,
} from 'lucide-react';

interface User {
  name: string;
  email: string;
  role: string;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Send Emails',
  '/dashboard/inbox': 'Inbox',
  '/dashboard/landlords': 'Landlords',
  '/dashboard/employers': 'Employers',
  '/dashboard/pipeline': 'Pipeline',
  '/dashboard/reports': 'Reports',
  '/dashboard/settings': 'Settings',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/');
          return;
        }
        const data = await res.json();
        setUser({
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
        });
        setIsLoading(false);
      } catch {
        router.push('/');
      }
    }

    fetchUser();
  }, [router]);

  useEffect(() => {
    async function fetchUnreadCount() {
      try {
        const res = await fetch('/api/inbox');
        if (res.ok) {
          const data = await res.json();
          const count = Array.isArray(data.emails)
            ? data.emails.filter((msg: { isRead?: boolean }) => !msg.isRead).length
            : 0;
          setUnreadCount(count);
        }
      } catch {
        // Silently fail - badge will show 0
      }
    }

    if (!isLoading) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  // Close sidebar when navigating on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continue with redirect even if the request fails
    }
    router.push('/');
  }, [router]);

  const pageTitle = PAGE_TITLES[pathname] || 'Dashboard';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Bug className="w-8 h-8 text-green-600 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-lg lg:shadow-none flex flex-col transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                <Bug className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900">Locust</h1>
                <p className="text-xs text-gray-500">AI Account Executive</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3">
            Outreach
          </p>
          <NavLink
            href="/dashboard"
            icon={<Send className="w-5 h-5" />}
            label="Send Emails"
            pathname={pathname}
          />
          <NavLink
            href="/dashboard/inbox"
            icon={<Inbox className="w-5 h-5" />}
            label="Inbox"
            pathname={pathname}
            badge={unreadCount > 0 ? unreadCount : undefined}
          />

          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3 mt-6">
            Leads
          </p>
          <NavLink
            href="/dashboard/landlords"
            icon={<Home className="w-5 h-5" />}
            label="Landlords"
            pathname={pathname}
          />
          <NavLink
            href="/dashboard/employers"
            icon={<Building2 className="w-5 h-5" />}
            label="Employers"
            pathname={pathname}
          />

          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3 mt-6">
            Analytics
          </p>
          <NavLink
            href="/dashboard/pipeline"
            icon={<BarChart3 className="w-5 h-5" />}
            label="Pipeline"
            pathname={pathname}
          />
          <NavLink
            href="/dashboard/reports"
            icon={<Users className="w-5 h-5" />}
            label="Reports"
            pathname={pathname}
          />

          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-3 mt-6">
            Settings
          </p>
          <NavLink
            href="/dashboard/settings"
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            pathname={pathname}
          />
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
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
  pathname,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  pathname: string;
  badge?: number;
}) {
  const isActive = pathname === href;

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
