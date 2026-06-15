import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "STUDENT" | "TEACHER" | "SUPERADMIN";
  yearLevel?: number | null;
  programCourse?: string | null;
  qaUnlimited?: boolean;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_STORAGE_KEY = "token";

function readStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

function writeStoredToken(token: string) {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function clearStoredToken() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(readStoredToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api<{ user: User }>("/auth/me", {}, token)
      .then((data) => setUser(data.user))
      .catch(() => {
        clearStoredToken();
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function login(email: string, password: string) {
    const data = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    writeStoredToken(data.token);
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
