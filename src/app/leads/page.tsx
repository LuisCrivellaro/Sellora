import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/states";
import { LeadsView } from "@/components/views/leads-view";

export const metadata: Metadata = { title: "Leads" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeadsView />
    </Suspense>
  );
}
