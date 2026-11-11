import type { Metadata } from "next";
import { DemoPreview } from "@/components/demos/demo-preview-router";

export const metadata: Metadata = { title: "Demonstração não oficial", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function DemoPage() { return <DemoPreview />; }
