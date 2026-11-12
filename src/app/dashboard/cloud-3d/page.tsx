import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/states";
import { Cloud3dView } from "@/components/views/cloud-3d-view";

export const metadata: Metadata = { title: "Cloud 3D" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Cloud3dView />
    </Suspense>
  );
}
