import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { getTierByProductId, type TierKey } from "@/lib/subscriptionTiers";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  subscriptionTier: TierKey;
  subscriptionEnd: string | null;
  isSubscribed: boolean;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  subscriptionTier: "free",
  subscriptionEnd: null,
  isSubscribed: false,
  refreshSubscription: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<TierKey>("free");
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  const refreshSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("check-subscription error:", error);
        return;
      }
      if (data?.subscribed) {
        setSubscriptionTier(getTierByProductId(data.product_id));
        setSubscriptionEnd(data.subscription_end);
      } else {
        setSubscriptionTier("free");
        setSubscriptionEnd(null);
      }
    } catch (err) {
      console.error("Failed to check subscription:", err);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) {
          setTimeout(() => refreshSubscription(), 0);
        } else {
          setSubscriptionTier("free");
          setSubscriptionEnd(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        refreshSubscription();
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshSubscription]);

  // Periodic refresh every 60s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refreshSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, refreshSubscription]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isSubscribed = subscriptionTier !== "free";

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, subscriptionTier, subscriptionEnd, isSubscribed, refreshSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}
