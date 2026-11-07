import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/states";
import { SettingsView } from "@/components/views/settings-view";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsView />
    </Suspense>
  );
}
