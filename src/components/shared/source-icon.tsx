import { Camera, MapPin, Search, Shapes, UserRoundCheck } from "lucide-react";
import type { LeadSource } from "@/lib/types";

/** Ícones genéricos por origem (sem logotipos de terceiros). */
export function SourceIcon({ source, className }: { source: LeadSource; className?: string }) {
  const props = { className, strokeWidth: 1.8, "aria-hidden": true } as const;
  switch (source) {
    case "google_maps":
      return <MapPin {...props} />;
    case "instagram":
      return <Camera {...props} />;
    case "indicacao":
      return <UserRoundCheck {...props} />;
    case "manual":
      return <Search {...props} />;
    default:
      return <Shapes {...props} />;
  }
}
