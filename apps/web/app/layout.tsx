import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "../src/features/navigation/app-shell";

import "./styles.css";

export const metadata: Metadata = {
  title: "Cortex",
  description: "Motorsport analysis prototype"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
