import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  BarChart3,
  Cpu,
  Network,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Datasets', href: '/datasets', icon: Database },
  { name: 'Analysis / EDA', href: '/eda', icon: BarChart3, badge: 'Phase 3' },
  { name: 'ML Models', href: '/models', icon: Cpu, badge: 'Phase 4' },
  { name: 'Clustering', href: '/clustering', icon: Network, badge: 'Phase 5' },
  { name: 'Forecasting', href: '/forecasting', icon: TrendingUp, badge: 'Phase 6' },
  { name: 'Anomaly Detection', href: '/anomalies', icon: ShieldAlert, badge: 'Phase 7' },
  { name: 'Insights', href: '/insights', icon: Sparkles, badge: 'Phase 8' },
  { name: 'History', href: '/history', icon: History },
  { name: 'Profile / Settings', href: '/settings', icon: Settings },
];

export const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const currentNav = navItems.find((item) => location.pathname.startsWith(item.href)) || navItems[0];

  return (
    <div className="flex min-h-screen bg-[#06040c] text-slate-200">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:w-64 flex-col fixed inset-y-0 z-40 border-r border-white/[0.08] bg-[#090613]/90 backdrop-blur-xl">
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-white/[0.08]">
          <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-violet-400 flex items-center justify-center shadow-lg shadow-purple-600/30 group-hover:scale-105 transition-transform">
              <span className="text-white font-bold text-base">IL</span>
            </div>
            <span className="font-sergena text-2xl tracking-wider text-white group-hover:text-purple-300 transition-colors">
              INFOLOOM
            </span>
          </NavLink>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Platform Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive: matchActive }) => `
                  group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${matchActive || isActive
                    ? 'bg-purple-600/15 text-purple-200 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-purple-400' : 'text-slate-400 group-hover:text-purple-300'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <Badge variant="purple" className="text-[10px] px-1.5 py-0">
                    {item.badge}
                  </Badge>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Footer User Info */}
        <div className="p-4 border-t border-white/[0.08] bg-black/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-purple-950 border border-purple-500/40 flex items-center justify-center text-xs font-semibold text-purple-300 flex-shrink-0">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-slate-200 truncate">{user?.name || 'Data Architect'}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email || 'authenticated'}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400">
              <ShieldCheck className="w-3 h-3 mr-1 text-emerald-400" />
              {user?.role || 'User'}
            </Badge>
          </div>

          <div className="flex gap-2">
            <NavLink to="/" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-slate-400 justify-start gap-1.5">
                <ExternalLink className="w-3 h-3" />
                Landing
              </Button>
            </NavLink>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs h-8 text-rose-300 hover:text-rose-200 hover:bg-rose-950/30 border-rose-900/40"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/80 backdrop-blur-md flex">
          <div className="w-72 bg-[#090613] border-r border-white/10 flex flex-col h-full p-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <span className="font-sergena text-2xl tracking-wider text-white">INFOLOOM</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => `
                      flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium
                      ${isActive ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-white/5'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && <Badge variant="outline">{item.badge}</Badge>}
                  </NavLink>
                );
              })}
            </div>
            <div className="pt-4 border-t border-white/10">
              <Button variant="destructive" size="sm" onClick={handleLogout} className="w-full text-xs">
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 border-b border-white/[0.08] bg-[#07040e]/80 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-slate-300 hover:text-white p-1"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>InfoLoom</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="font-semibold text-slate-100">{currentNav.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="purple" className="text-xs hidden sm:inline-flex">
              FastAPI v1 Engine Active
            </Badge>
            <NavLink to="/datasets">
              <Button size="sm" variant="default" className="text-xs h-8">
                + Upload Data
              </Button>
            </NavLink>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
