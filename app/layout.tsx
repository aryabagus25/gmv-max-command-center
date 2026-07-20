import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GMV Max Command Center",
  description: "Dashboard TikTok GMV Max untuk creative video per campaign dan livestream performance.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
