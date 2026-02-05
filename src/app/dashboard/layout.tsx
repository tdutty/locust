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
  Home,
  Building2,
  Users,
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
        // Silently fail
      }
    }

    if (!isLoading) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continue with redirect
    }
    router.push('/');
  }, [router]);

  const pageTitle = PAGE_TITLES[pathname] || 'Dashboard';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                <Bug className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-slate-900 tracking-tight">Locust</h1>
                <p className="text-xs text-slate-400 uppercase tracking-wider">AI Account Executive</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.15em] mb-2 px-6">
            Outreach
          </p>
          <NavLink href="/dashboard" icon={<Send className="w-4 h-4" />} label="Send Emails" pathname={pathname} />
          <NavLink href="/dashboard/inbox" icon={<Inbox className="w-4 h-4" />} label="Inbox" pathname={pathname} badge={unreadCount > 0 ? unreadCount : undefined} />

          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.15em] mb-2 px-6 mt-6">
            Leads
          </p>
          <NavLink href="/dashboard/landlords" icon={<Home className="w-4 h-4" />} label="Landlords" pathname={pathname} />
          <NavLink href="/dashboard/employers" icon={<Building2 className="w-4 h-4" />} label="Employers" pathname={pathname} />

          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.15em] mb-2 px-6 mt-6">
            Analytics
          </p>
          <NavLink href="/dashboard/pipeline" icon={<BarChart3 className="w-4 h-4" />} label="Pipeline" pathname={pathname} />
          <NavLink href="/dashboard/reports" icon={<Users className="w-4 h-4" />} label="Reports" pathname={pathname} />

          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.15em] mb-2 px-6 mt-6">
            System
          </p>
          <NavLink href="/dashboard/settings" icon={<Settings className="w-4 h-4" />} label="Settings" pathname={pathname} />
        </nav>

        {/* User */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-md hover:bg-slate-100"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-md hover:bg-slate-100 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-medium uppercase tracking-wider text-slate-900">{pageTitle}</h2>
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
      className={`flex items-center gap-3 mx-3 px-3 py-2.5 text-sm rounded-md transition-all duration-200 ${
        isActive
          ? 'bg-primary-50 text-primary-700 font-medium'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <span>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="px-1.5 py-0.5 bg-primary rounded-full text-white text-[10px] font-medium min-w-[20px] text-center">
          {badge}
        </span>
      )}
    </Link>
  );
}
