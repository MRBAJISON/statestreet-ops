import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import OrgProvider from '@/components/providers/OrgProvider';
import ImpersonationBanner from '@/components/layout/ImpersonationBanner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import ThemeProvider from '@/components/providers/ThemeProvider';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'StateStreet', template: '%s | StateStreet' },
  description: 'Retail operations and performance intelligence for StateStreet.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#eef5f1',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider>
          <OrgProvider>
            <TooltipProvider delayDuration={250}>
              <ImpersonationBanner />
              {children}
              <Toaster position="top-right" richColors closeButton />
            </TooltipProvider>
          </OrgProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
