import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints';
import { tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const user = tokenStore.getUser();
    return user ? { user, profile: null, system: null } : null;
  });
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));
  const [error, setError] = useState(null);

  const loadSession = useCallback(async () => {
    if (!tokenStore.get()) {
      setSession(null);
      setLoading(false);
      return null;
    }
    try {
      const payload = await authApi.me();
      const next = {
        user: payload.data.user,
        profile: payload.data.profile,
        student: payload.data.student,
        teacher: payload.data.teacher,
        system: payload.data.system,
      };
      setSession(next);
      tokenStore.setUser(payload.data.user);
      return next;
    } catch (requestError) {
      tokenStore.clear();
      setSession(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(async (credentials) => {
    setError(null);
    try {
      const payload = await authApi.login(credentials);
      tokenStore.set(payload.data.token);
      tokenStore.setUser(payload.data.user);
      const next = { user: payload.data.user, profile: payload.data.profile };
      setSession(next);
      // fetch the full session (student/teacher profiles + system info)
      loadSession();
      return next;
    } catch (loginError) {
      setError(loginError.message);
      throw loginError;
    }
  }, [loadSession]);

  const register = useCallback(async (payload) => {
    setError(null);
    const result = await authApi.register(payload);
    tokenStore.set(result.data.token);
    tokenStore.setUser(result.data.user);
    setSession({ user: result.data.user, profile: result.data.profile });
    loadSession();
    return result;
  }, [loadSession]);

  const logout = useCallback(() => {
    tokenStore.clear();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user || null,
      profile: session?.profile || null,
      student: session?.student || null,
      teacher: session?.teacher || null,
      system: session?.system || null,
      role: session?.user?.role || null,
      isAuthenticated: Boolean(session?.user),
      loading,
      error,
      login,
      register,
      logout,
      refresh: loadSession,
      setSession,
    }),
    [session, loading, error, login, register, logout, loadSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};
