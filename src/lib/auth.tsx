import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
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
  // Keep a ref in sync so checkAuth can read the current key without
  // needing it as a dependency (avoids stale-closure / re-trigger issues).
  const masterKeyRef = useRef<CryptoKey | null>(null);
  const { isOffline, setBackendDown } = useOffline();

  // Mirror state into ref on every render.
  masterKeyRef.current = masterKey;

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

      // If authenticated, try to restore the master key.
      // Guard: if a key is already held in memory (e.g. we just finished
      // login() and saveMasterKey hasn't flushed to IndexedDB yet), keep it
      // rather than overwriting with a potentially-null value from the DB.
      if (authenticated) {
        if (!masterKeyRef.current) {
          const mk = await loadMasterKey();
          setMasterKey(mk);
          // Re-arm the session marker that was cleared when sessionStorage was
          // wiped on browser restart. Without this, offline cache writes remain
          // gated and silently skip after every page reload.
          if (mk) markSessionActive();
        }
      } else {
        localStorage.removeItem("e2ee_salt");
        clearSessionActive();
        clearMasterKey().catch(() => {});
        import("./offlineCache").then((m) => m.clearOfflineCache());
      }
    } catch {
      if (!masterKeyRef.current) {
        const mk = await loadMasterKey();
        setMasterKey(mk);
        setIsAuthenticated(!!mk);
      } else {
        setIsAuthenticated(true);
      }
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
        // We cannot derive a master key without the salt, so the session
        // would be unusable. Throw to prevent setIsAuthenticated(true)
        // from being called with a null key.
        throw new Error("Login succeeded but encryption key could not be set up. Please try again.");
      }
    } else {
      salt = localStorage.getItem("e2ee_salt") || "";
      if (!salt) {
        throw new Error("Cannot login offline: no cached credentials");
      }
    }

    // At this point salt is guaranteed to be non-empty.
    try {
      const mk = await deriveMasterKey(passphrase, salt);
      setMasterKey(mk);
      await saveMasterKey(mk);
      markSessionActive();
    } catch (err) {
      console.error("[e2ee] Failed to derive master key:", err);
      if (!navigator.onLine) throw new Error("Invalid offline credentials");
      throw new Error("Failed to derive encryption key. Please try again.");
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
