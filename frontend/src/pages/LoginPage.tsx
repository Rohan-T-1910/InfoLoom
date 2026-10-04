import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AlertCircle, Lock, Mail, Sparkles, Loader2 } from 'lucide-react';
import { getErrorMessage } from '../lib/errorUtils';

export const LoginPage: React.FC = () => {
  const { login, guestLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      await login({ email: trimmedEmail.toLowerCase(), password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(getErrorMessage(err, 'The email or password is incorrect.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    try {
      await guestLogin();
      navigate('/dashboard');
    } catch {
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05030a] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center">
          <Link to="/" className="inline-block group">
            <h1 className="font-sergena text-4xl font-bold tracking-wider text-white group-hover:text-purple-300 transition-colors">
              INFOLOOM
            </h1>
          </Link>
          <p className="text-xs text-slate-400 mt-1">Autonomous AI Data Intelligence & EDA Platform</p>
        </div>

        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-2 shadow-2xl backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-white">Sign In</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Enter your credentials to access your data pipelines and EDA dashboards
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <Input
                    type="email"
                    required
                    disabled={loading}
                    placeholder="architect@infoloom.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10 text-xs disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <Input
                    type="password"
                    required
                    disabled={loading}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-10 text-xs disabled:opacity-50"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="glow"
                size="default"
                className="w-full mt-2"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.08]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-[#0c0818] px-2 text-slate-500">Or instant access</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="default"
              disabled={loading}
              className="w-full text-xs text-purple-200 border-purple-500/30 hover:bg-purple-950/40"
              onClick={handleGuest}
            >
              <Sparkles className="w-3.5 h-3.5 mr-2 text-purple-400" />
              Continue as Guest / Demo Mode
            </Button>

            <div className="text-center pt-2 text-xs text-slate-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-purple-400 hover:underline">
                Create one
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
