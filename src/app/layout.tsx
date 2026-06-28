import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import OrgProvider from "@/components/providers/OrgProvider";
import ImpersonationBanner from "@/components/layout/ImpersonationBanner";
import { getOrgSettings } from "@/lib/org-server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StateStreet Retail Group - Operations Command Center",
  description: "Operational dashboard system for StateStreet Retail Group",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Use the uploaded company logo as the browser-tab favicon (falls back to the
  // bundled favicon.ico when none is set). Non-critical — never break the app over it.
  let logo = "";
  try { logo = (await getOrgSettings()).logo || ""; } catch {}
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {logo ? <link rel="icon" href={logo} /> : null}
        {/* Apply saved theme before paint to avoid a flash. Defaults to dark. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <OrgProvider>
          <ImpersonationBanner />
          {children}
        </OrgProvider>
      </body>
    </html>
  );
}
