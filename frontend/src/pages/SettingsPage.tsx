import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Settings, Shield, User, Sliders, LogOut, Moon, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Profile &amp; Account Settings</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Manage your personal account information and workspace preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Account Details */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 shadow-xl">
          <CardHeader className="pb-3 border-b border-white/[0.06]">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              <span>Personal Profile</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Your registered user account credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Full Name</label>
              <div className="font-semibold text-sm text-white">{user?.name || 'User'}</div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email Address</label>
              <div className="font-mono text-xs text-slate-300">{user?.email || 'user@example.com'}</div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Account Role</label>
              <Badge variant="purple" className="text-xs">
                {user?.role || 'Analyst'}
              </Badge>
            </div>
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
              <span>Account Status</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active &amp; Verified
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Workspace Display Preferences */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 shadow-xl">
          <CardHeader className="pb-3 border-b border-white/[0.06]">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Workspace Preferences</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Visual theme and analysis defaults
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div>
                <span className="text-white font-medium block">Color Theme</span>
                <span className="text-slate-400 text-[11px]">Dark Theme interface</span>
              </div>
              <Badge variant="outline" className="border-white/10 text-slate-300 flex items-center gap-1">
                <Moon className="w-3 h-3 text-purple-400" />
                Dark Mode (Default)
              </Badge>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div>
                <span className="text-white font-medium block">Number Formatting</span>
                <span className="text-slate-400 text-[11px]">Standard localized decimals</span>
              </div>
              <Badge variant="outline" className="border-white/10 text-slate-300">
                1,234.56
              </Badge>
            </div>

            <div className="pt-2">
              <span className="text-slate-400 block mb-3">Session Management</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="w-full text-xs text-rose-300 border-rose-500/30 hover:bg-rose-950/40"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Sign Out of InfoLoom
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
