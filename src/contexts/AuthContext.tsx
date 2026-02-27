import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Team {
  id: string;
  name: string;
  coach_name: string;
  access_code: string;
  logo_url: string | null;
  points: number;
  is_suspended: boolean;
}

interface AuthContextType {
  team: Team | null;
  isAdmin: boolean;
  login: (code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedCode = sessionStorage.getItem('pes2090_code');
    if (savedCode) {
      loginWithCode(savedCode).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const loginWithCode = async (code: string) => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('access_code', code)
      .maybeSingle();

    if (error || !data) return { success: false, error: 'رمز الدخول غير صحيح' };

    setTeam(data as Team);
    sessionStorage.setItem('pes2090_code', code);
    return { success: true };
  };

  const login = async (code: string) => {
    setLoading(true);
    const result = await loginWithCode(code);
    setLoading(false);
    return result;
  };

  const logout = () => {
    setTeam(null);
    sessionStorage.removeItem('pes2090_code');
  };

  const isAdmin = team?.access_code === 'KAS2026';

  return (
    <AuthContext.Provider value={{ team, isAdmin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
