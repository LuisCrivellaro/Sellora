import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";
import { APP_LABEL } from "@/lib/version";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_LABEL, template: `%s · ${APP_LABEL}` },
  description: "Painel interno da Sellora: leads, clientes, projetos, propostas e financeiro.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
