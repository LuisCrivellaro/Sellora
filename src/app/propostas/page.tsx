import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/states";
import { ProposalsView } from "@/components/views/proposals-view";

export const metadata: Metadata = { title: "Propostas" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProposalsView />
    </Suspense>
  );
}
