import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/states";
import { ClientsView } from "@/components/views/clients-view";

export const metadata: Metadata = { title: "Clientes" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientsView />
    </Suspense>
  );
}
