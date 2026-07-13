'use client';

import { usePathname } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import AppSidebar from './Sidebar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import type { Department } from '@/lib/types';

interface AppShellProps {
  userName: string;
  userRole: string;
  departments: Department[];
  children: React.ReactNode;
}

const LABELS: Record<string, string> = {
  dashboard: 'Overview',
  forms: 'Workflows',
  executive: 'Executive',
  finance: 'Finance',
  commercial: 'Commercial',
  marketing: 'Marketing',
  operations: 'Operations',
  inventory: 'Inventory',
  'brand-health': 'Brand health',
  'store-manager': 'My store',
  admin: 'Users',
  settings: 'Settings',
  catalog: 'Catalog',
  products: 'Products',
  reports: 'Data export',
  import: 'Import',
  'daily-reports': 'Daily report review',
  'daily-report': 'Daily report',
  'weekly-review': 'Weekly review',
  'goods-receipt': 'Goods receipt',
  'stock-transfer': 'Stock transfer',
  'stock-count': 'Stock count',
  replenishment: 'Replenishment',
  'weekly-targets': 'Targets',
};

function formatDate() {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

export default function AppShell({ userName, userRole, departments, children }: AppShellProps) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments.at(-1) ?? 'dashboard';
  const parentSegment = segments.length > 2 ? segments.at(-2) ?? segments[0] : segments[0];
  const section = LABELS[parentSegment ?? 'dashboard'] ?? 'Workspace';
  const page = LABELS[lastSegment] ?? section;

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar userName={userName} userRole={userRole} departments={departments} />
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 shadow-sm md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
              {page !== section ? (
                <>
                  <BreadcrumbItem className="hidden sm:flex">{section}</BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:flex" />
                </>
              ) : null}
              <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{page}</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <CalendarDays className="size-3.5" />
            <span>{formatDate()}</span>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
