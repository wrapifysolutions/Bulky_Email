import type { Metadata } from "next";
import { Space_Grotesk, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bulkyy",
  description: "Bulk email outreach platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      {/* Extensions (e.g. ColorZilla) inject attrs like cz-shortcut-listen on body */}
      <body suppressHydrationWarning>
        <div className="app-shell">
          <Sidebar />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
