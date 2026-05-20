import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] px-6 gap-6 text-center">
      <WifiOff size={48} strokeWidth={1} className="text-muted-foreground" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Et ole yhteydessä</h1>
        <p className="text-muted-foreground">
          Tarkista internet-yhteytesi. Aiemmin katsellut tiedot ovat
          saatavilla offline-tilassa.
        </p>
      </div>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Yritä uudelleen
      </Link>
    </div>
  );
}
