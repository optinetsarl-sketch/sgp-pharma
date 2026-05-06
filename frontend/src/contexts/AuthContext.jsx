import React, { createContext, useContext, useEffect, useState } from "react";
import api, { setToken, getToken } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadPharmacy = async (u) => {
    if (!u || !u.pharmacy_id) {
      setPharmacy(null);
      return;
    }
    try {
      const { data } = await api.get(`/pharmacies/${u.pharmacy_id}`);
      setPharmacy(data);
    } catch { setPharmacy(null); }
  };

  useEffect(() => {
    let mounted = true;
    if (!getToken()) { setUser(false); setLoading(false); return; }
    api.get("/auth/me", { _silent: true })
      .then(async (r) => {
        if (!mounted) return;
        setUser(r.data);
        await loadPharmacy(r.data);
      })
      .catch(() => { setToken(null); if (mounted) setUser(false); })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setToken(data.access_token);
    setUser(data.user);
    await loadPharmacy(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setToken(null);
    setUser(false);
    setPharmacy(null);
  };

  const hasRole = (...roles) => user && user.role && roles.includes(user.role);
  const isSuperAdmin = () => user?.role === "super_admin";

  return (
    <AuthContext.Provider value={{ user, pharmacy, loading, login, logout, hasRole, isSuperAdmin, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
