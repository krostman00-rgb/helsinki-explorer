"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const signInAnonymously = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("Anonymous sign-in failed:", error.message);
    } else if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const settle = () => {
      if (!settled) {
        settled = true;
        setIsLoading(false);
      }
    };

    // Hard timeout: never stay in loading state more than 6 seconds
    const timeout = setTimeout(settle, 6000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        settle();
      } else {
        signInAnonymously().finally(settle);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [signInAnonymously]);

  return (
    <AuthContext.Provider value={{ user, session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
