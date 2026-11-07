import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/states";
import { FinanceView } from "@/components/views/finance-view";

export const metadata: Metadata = { title: "Financeiro" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FinanceView />
    </Suspense>
  );
}
