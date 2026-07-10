import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useOffline } from "./offlineContext";
import { deriveMasterKey } from "./crypto";
import {
  saveMasterKey,
  loadMasterKey,
  clearMasterKey,
  markSessionActive,
  clearSessionActive,
} from "./keyStore";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  masterKey: CryptoKey | null;
  login: (passphrase: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function AuthProviderInner({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const { isOffline, setBackendDown } = useOffline();

  const checkAuth = useCallback(async () => {
    // Don't hit the network if offline
    if (!navigator.onLine) {
      const mk = await loadMasterKey();
      setMasterKey(mk);
      setIsAuthenticated(!!mk);
      setIsLoading(false);
      return;
    }

    try {
      const { authenticated } = await api.auth.check();
      setIsAuthenticated(authenticated);
      setBackendDown(false); // API responded — backend is up

      // If authenticated, try to restore the master key
      if (authenticated) {
        const mk = await loadMasterKey();
        setMasterKey(mk);
      } else {
        localStorage.removeItem("e2ee_salt");
        clearSessionActive();
        clearMasterKey().catch(() => {});
        import("./offlineCache").then((m) => m.clearOfflineCache());
      }
    } catch {
      const mk = await loadMasterKey();
      setMasterKey(mk);
      setIsAuthenticated(!!mk);
      if (navigator.onLine) {
        setBackendDown(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [setBackendDown]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Re-check auth when coming back online
  useEffect(() => {
    if (!isOffline) {
      checkAuth();
    }
  }, [isOffline, checkAuth]);

  const login = async (passphrase: string) => {
    let salt = "";

    if (navigator.onLine) {
      await api.auth.login(passphrase);
      try {
        const res = await api.auth.getSalt();
        salt = res.salt;
        localStorage.setItem("e2ee_salt", salt);
      } catch (err) {
        console.error("[e2ee] Failed to get salt:", err);
      }
    } else {
      salt = localStorage.getItem("e2ee_salt") || "";
      if (!salt) {
        throw new Error("Cannot login offline: no cached credentials");
      }
    }

    if (salt) {
      try {
        const mk = await deriveMasterKey(passphrase, salt);
        setMasterKey(mk);
        await saveMasterKey(mk);
        markSessionActive();
      } catch (err) {
        console.error("[e2ee] Failed to derive master key:", err);
        if (!navigator.onLine) throw new Error("Invalid offline credentials");
      }
    }

    setIsAuthenticated(true);
    setBackendDown(!navigator.onLine);
  };

  const logout = async () => {
    // If offline, just clear local state
    if (!navigator.onLine) {
      setIsAuthenticated(false);
      setMasterKey(null);
      clearSessionActive();
      clearMasterKey().catch(() => {});
      localStorage.removeItem("e2ee_salt");
      import("./offlineCache").then((m) => m.clearOfflineCache());
      return;
    }
    try {
      await api.auth.logout();
    } catch {
      // Logout failed — still clear local state
    }
    setIsAuthenticated(false);
    setMasterKey(null);
    clearSessionActive();
    clearMasterKey().catch(() => {});
    localStorage.removeItem("e2ee_salt");
    import("./offlineCache").then((m) => m.clearOfflineCache());
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        masterKey,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * AuthProvider must be rendered inside OfflineProvider so it can access
 * setBackendDown. This wrapper just re-exports under the old name.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthProviderInner>{children}</AuthProviderInner>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
