import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = { title: "WAEC/JAMB Maths Learning Path" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-NG">
      <body>{children}</body>
    </html>
  );
}
