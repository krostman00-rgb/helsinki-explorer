"use client";

import { useAuth } from "@/providers/AuthProvider";
import { User, Star, Trophy } from "lucide-react";

export default function ProfilePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-4rem)]">
        <p className="text-muted-foreground">Ladataan...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Profiili</h1>

      {/* Avatar + info */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <User size={24} className="text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">Anonyymi matkailija</p>
          <p className="text-xs text-muted-foreground font-mono">
            {user?.id.slice(0, 12)}...
          </p>
        </div>
      </div>

      {/* Stats placeholders */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card text-center">
          <Star size={20} className="mx-auto text-muted-foreground mb-1" />
          <p className="text-2xl font-bold">0</p>
          <p className="text-xs text-muted-foreground">Pistettä</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card text-center">
          <Trophy size={20} className="mx-auto text-muted-foreground mb-1" />
          <p className="text-2xl font-bold">0</p>
          <p className="text-xs text-muted-foreground">Saavutuksia</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Pelillistämisominaisuudet tulossa pian ✨
      </p>
    </div>
  );
}
