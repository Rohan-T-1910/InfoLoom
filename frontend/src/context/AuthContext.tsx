import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string } | FormData) => Promise<void>;
  register: (payload: { email: string; password: string; name: string }) => Promise<void>;
  logout: () => void;
  guestLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      if (api.hasToken()) {
        try {
          const me = await api.getCurrentUser();
          setUser(me);
        } catch {
          // If token expired, clear it
          api.logout();
          setUser(null);
        }
      }
      setIsLoading(false);
    }
    initAuth();

    const handleUnauthorized = () => {
      api.logout();
      setUser(null);
    };
    window.addEventListener('infoloom:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('infoloom:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (credentials: { email: string; password: string } | FormData) => {
    await api.login(credentials);
    const me = await api.getCurrentUser();
    setUser(me);
  };

  const register = async (payload: { email: string; password: string; name: string }) => {
    const registeredUser = await api.register(payload);
    if (registeredUser.access_token) {
      setUser(registeredUser);
    } else {
      await login({ email: payload.email, password: payload.password });
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  const guestLogin = async () => {
    try {
      await api.demoLogin();
      const me = await api.getCurrentUser();
      setUser(me);
    } catch (err) {
      console.warn('Backend guest auth failed, falling back to local demo user:', err);
      const demoUser: User = {
        id: 1,
        email: 'demo@infoloom.ai',
        name: 'Demo Architect',
        role: 'User',
      };
      setUser(demoUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        guestLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
