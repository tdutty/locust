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
  GraduationCap,
  ChevronDown,
  Search,
  Bell,
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
  '/dashboard/universities': 'Universities',
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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

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

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const pageTitle = PAGE_TITLES[pathname] || 'Dashboard';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[240px] bg-sidebar flex flex-col transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Bug className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-white text-sm tracking-tight">Locust</h1>
                <p className="text-[10px] text-sidebar-text tracking-wider">AI Account Executive</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-sidebar-text hover:text-white transition-colors lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto sidebar-scroll">
          {/* Outreach Section */}
          <SidebarSection
            title="Outreach"
            collapsed={collapsedSections['outreach']}
            onToggle={() => toggleSection('outreach')}
          >
            <NavLink href="/dashboard" icon={<Send className="w-4 h-4" />} label="Send Emails" pathname={pathname} />
            <NavLink href="/dashboard/inbox" icon={<Inbox className="w-4 h-4" />} label="Inbox" pathname={pathname} badge={unreadCount > 0 ? unreadCount : undefined} />
          </SidebarSection>

          {/* Leads Section */}
          <SidebarSection
            title="Leads"
            collapsed={collapsedSections['leads']}
            onToggle={() => toggleSection('leads')}
          >
            <NavLink href="/dashboard/landlords" icon={<Home className="w-4 h-4" />} label="Landlords" pathname={pathname} />
            <NavLink href="/dashboard/employers" icon={<Building2 className="w-4 h-4" />} label="Employers" pathname={pathname} />
            <NavLink href="/dashboard/universities" icon={<GraduationCap className="w-4 h-4" />} label="Universities" pathname={pathname} />
          </SidebarSection>

          {/* Analytics Section */}
          <SidebarSection
            title="Analytics"
            collapsed={collapsedSections['analytics']}
            onToggle={() => toggleSection('analytics')}
          >
            <NavLink href="/dashboard/pipeline" icon={<BarChart3 className="w-4 h-4" />} label="Pipeline" pathname={pathname} />
            <NavLink href="/dashboard/reports" icon={<Users className="w-4 h-4" />} label="Reports" pathname={pathname} />
          </SidebarSection>

          {/* System Section */}
          <SidebarSection
            title="System"
            collapsed={collapsedSections['system']}
            onToggle={() => toggleSection('system')}
          >
            <NavLink href="/dashboard/settings" icon={<Settings className="w-4 h-4" />} label="Settings" pathname={pathname} />
          </SidebarSection>
        </nav>

        {/* User */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary-300 font-medium text-xs">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-[11px] text-sidebar-text truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-sidebar-text hover:text-white transition-colors rounded-md hover:bg-sidebar-hover"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-md hover:bg-slate-100 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-semibold text-slate-900">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-md hover:bg-slate-100">
              <Search className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-md hover:bg-slate-100 relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
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

function SidebarSection({
  title,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  collapsed?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-5 py-2 group"
      >
        <span className="text-[10px] font-semibold text-sidebar-muted uppercase tracking-[0.15em]">
          {title}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-sidebar-muted group-hover:text-sidebar-text transition-all duration-200 ${
            collapsed ? '-rotate-90' : ''
          }`}
        />
      </button>
      {!collapsed && (
        <div className="px-2 space-y-0.5">
          {children}
        </div>
      )}
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
      className={`flex items-center gap-3 px-3 py-2 text-[13px] rounded-md transition-all duration-150 ${
        isActive
          ? 'bg-sidebar-active text-white font-medium border-l-[3px] border-l-primary'
          : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
      }`}
    >
      <span className={isActive ? 'text-primary-400' : ''}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="px-1.5 py-0.5 bg-primary rounded-full text-white text-[10px] font-medium min-w-[18px] text-center leading-tight">
          {badge}
        </span>
      )}
    </Link>
  );
}
