import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Settings, Shield, Server, CheckCircle2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">System & Profile Settings</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Manage identity parameters, backend API connections, and storage quotas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Identity */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90">
          <CardHeader className="pb-3 border-b border-white/[0.06]">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>User Profile</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Full Name</label>
              <div className="font-semibold text-sm text-white">{user?.name || 'Rohan Tripathi'}</div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email Address</label>
              <div className="font-mono text-xs text-slate-300">{user?.email || 'user@example.com'}</div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Role Privileges</label>
              <Badge variant="purple" className="text-xs">
                {user?.role || 'User'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Engine Connectivity */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90">
          <CardHeader className="pb-3 border-b border-white/[0.06]">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Backend Engine Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-slate-400">API Gateway</span>
              <span className="font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                FastAPI v1 Connected
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-slate-400">Database Layer</span>
              <span className="font-mono text-purple-300">PostgreSQL + Alembic</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-slate-400">Phase 3 EDA Service</span>
              <span className="font-mono text-emerald-400">Enabled with Cache</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Streaming Limit</span>
              <span className="font-mono text-slate-300">100 MB Direct Stream</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
