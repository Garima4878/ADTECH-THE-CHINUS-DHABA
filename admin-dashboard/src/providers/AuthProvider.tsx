import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TOKEN_STORAGE_KEY, UNAUTHORIZED_EVENT, USER_STORAGE_KEY } from "@/config";
import { http, unwrap } from "@/lib/api";
import type { Role, User } from "@/types";

interface AuthContextValue {
  user: User | null;
  /** Logs in against the backend (POST /api/auth/login). Rejects with the server's message on failure. */
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Backend roles are admin / manager / staff; the dashboard calls staff "employee". */
const ROLE_FROM_BACKEND: Record<string, Role> = { admin: "admin", manager: "manager", staff: "employee" };

interface LoginResponse {
  token: string;
  user: { id: string; name: string; username?: string; email?: string; role: string };
}

function readStoredUser(): User | null {
  if (!localStorage.getItem(TOKEN_STORAGE_KEY)) return null;
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);

  const signOut = useCallback(() => {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const payload = await http.post<unknown>("/auth/login", { username, password });
    const { token, user: account } = unwrap<LoginResponse>(payload);
    const role = ROLE_FROM_BACKEND[account.role];
    if (!token || !role) {
      throw new Error("This account cannot use the restaurant dashboard.");
    }
    const next: User = {
      id: String(account.id),
      name: account.name,
      username: account.username || account.email || username,
      email: account.email,
      role,
      isActive: true,
    };
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  // Expired, deactivated or removed accounts are signed out as soon as the backend rejects them.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, signIn, signOut }),
    [user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
