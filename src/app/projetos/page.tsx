import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/states";
import { ProjectsView } from "@/components/views/projects-view";

export const metadata: Metadata = { title: "Projetos" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProjectsView />
    </Suspense>
  );
}
