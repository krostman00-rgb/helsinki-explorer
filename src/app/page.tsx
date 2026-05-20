import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)]">
      {/* Hero image — placeholder until real Helsinki photo is added */}
      <div className="relative flex-1 min-h-[60vh]">
        <Image
          src="https://placehold.co/800x600/0f172a/94a3b8?text=Helsinki"
          alt="Helsinki skyline"
          fill
          className="object-cover"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      {/* Content overlay */}
      <div className="relative px-6 pb-8 -mt-32 flex flex-col gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Tervetuloa
          </p>
          <h1 className="text-4xl font-bold leading-tight">
            Helsinki
            <br />
            Explorer
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Löydä Helsingin parhaat paikat, luo oma matkaohjelmasi ja kerää
            muistoja kaupunkiseikkailustasi.
          </p>
        </div>

        <Link
          href="/onboarding"
          className={cn(buttonVariants({ size: "lg" }), "w-full mt-2")}
        >
          Aloita matkasi →
        </Link>

        <Link
          href="/trips"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}
        >
          Minulla on jo matka
        </Link>
      </div>
    </div>
  );
}
