"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Kirjautuminen epäonnistui. Tarkista sähköposti ja salasana.");
      setLoading(false);
      return;
    }

    // Verify admin status via RPC (security definer bypasses RLS)
    const { data: isAdmin } = await supabase.rpc("is_admin_user");

    if (!isAdmin) {
      await supabase.auth.signOut();
      setError("Sinulla ei ole admin-oikeuksia.");
      setLoading(false);
      return;
    }

    router.push("/admin/places");
    router.refresh();
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-linen-100 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.25" />
              <circle cx="7" cy="7" r="2" fill="currentColor" />
            </svg>
            <span className="text-xs font-semibold tracking-widest uppercase text-ink-900">
              hello<span className="opacity-50">·</span>hel
            </span>
          </div>
          <p className="text-muted-foreground text-sm">Admin-paneeli</p>
        </div>

        {/* Card */}
        <div className="bg-background rounded-2xl border border-border p-6 shadow-sm">
          <h1 className="text-base font-medium text-ink-900 mb-5">Kirjaudu sisään</h1>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sähköposti
              </label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Salasana
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-10"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="h-10 mt-1">
              {loading ? (
                <><Loader2 className="size-4 animate-spin" /> Kirjaudutaan…</>
              ) : (
                "Kirjaudu"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
