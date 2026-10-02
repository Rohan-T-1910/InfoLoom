import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AlertCircle, Lock, Mail, User as UserIcon, Loader2 } from 'lucide-react';
import { getErrorMessage } from '../lib/errorUtils';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your full name.');
      return;
    }

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
      setError('Please enter a password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password.length > 72) {
      setError('Password cannot exceed 72 characters.');
      return;
    }

    setLoading(true);

    try {
      await register({
        name: trimmedName,
        email: trimmedEmail.toLowerCase(),
        password,
      });
      // Immediately navigate to the authenticated dashboard
      navigate('/dashboard');
    } catch (err: any) {
      setError(
        getErrorMessage(
          err,
          'Registration failed. Please check your information and try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05030a] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
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
            <CardTitle className="text-lg font-semibold text-white">Create Account</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Join InfoLoom to upload datasets and run automated EDA pipelines
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
                <label className="text-xs text-slate-300 block mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <Input
                    type="text"
                    required
                    disabled={loading}
                    placeholder="Alex Mercer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 h-10 text-xs disabled:opacity-50"
                  />
                </div>
              </div>

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
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Must be between 6 and 72 characters
                </span>
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
                    Creating Account...
                  </span>
                ) : (
                  'Get Started'
                )}
              </Button>
            </form>

            <div className="text-center pt-2 text-xs text-slate-400">
              Already registered?{' '}
              <Link to="/login" className="text-purple-400 hover:underline">
                Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
