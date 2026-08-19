'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Boxes,
  Building2,
  ChevronUp,
  ClipboardCheck,
  Gauge,
  HeartPulse,
  Layers3,
  LogOut,
  Megaphone,
  FileSpreadsheet,
  FileText,
  PackageSearch,
  Settings,
  ShoppingBag,
  Target,
  UserRoundCog,
  WalletCards,
} from 'lucide-react';
import { useOrg } from '@/components/providers/OrgProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import type { Department } from '@/lib/types';

interface SidebarProps {
  userName: string;
  userRole: string;
  departments: Department[];
}

const DEPARTMENT_NAV: Record<Department, { label: string; icon: typeof Gauge; href: string; tone: string }> = {
  executive: { label: 'Executive overview', icon: Gauge, href: '/dashboard/executive', tone: 'text-primary' },
  finance: { label: 'Finance', icon: WalletCards, href: '/dashboard/finance', tone: 'text-chart-1' },
  commercial: { label: 'Commercial', icon: ShoppingBag, href: '/dashboard/commercial', tone: 'text-chart-2' },
  marketing: { label: 'Marketing', icon: Megaphone, href: '/dashboard/marketing', tone: 'text-chart-5' },
  operations: { label: 'Operations', icon: ClipboardCheck, href: '/dashboard/operations', tone: 'text-chart-4' },
  inventory: { label: 'Inventory', icon: Boxes, href: '/dashboard/inventory', tone: 'text-chart-3' },
  brand: { label: 'Brand health', icon: HeartPulse, href: '/dashboard/brand-health', tone: 'text-destructive' },
};
// Roles that may pull a store's formatted daily, weekly or monthly PDF. Kept
// beside the export rather than inside it: the export is a spreadsheet of raw
// data, these are the documents a store actually files.
const STORE_REPORT_READERS = ['owner', 'finance', 'commercial', 'operations', 'store-manager'];

const ROLE_FORM: Record<string, { label: string; href: string; icon: typeof ClipboardCheck } | undefined> = {
  finance: { label: 'Finance workflows', href: '/forms/finance', icon: WalletCards },
  commercial: { label: 'Commercial workflows', href: '/forms/commercial', icon: ShoppingBag },
  marketing: { label: 'Marketing workflows', href: '/forms/marketing', icon: Megaphone },
  operations: { label: 'Operations workflows', href: '/forms/operations', icon: ClipboardCheck },
  inventory: { label: 'Inventory workflows', href: '/forms/inventory', icon: PackageSearch },
  brand: { label: 'Brand workflows', href: '/forms/brand-health', icon: HeartPulse },
  'store-manager': { label: 'Store workflows', href: '/forms/store-manager', icon: Building2 },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function roleLabel(role: string) {
  return role.replace('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AppSidebar({ userName, userRole, departments }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { org, refresh: refreshOrg } = useOrg();
  const ownDepartment = departments.find((department) => department === userRole);
  const orderedDepartments = ownDepartment
    ? [ownDepartment, ...departments.filter((department) => department !== ownDepartment)]
    : departments;
  const form = ROLE_FORM[userRole];

  async function signOut() {
    await fetch('/api/auth', { method: 'DELETE' });
    await refreshOrg();
    router.replace('/login');
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="h-11 hover:bg-transparent data-[active=true]:bg-transparent">
              <Link href={userRole === 'store-manager' ? '/dashboard/store-manager' : '/dashboard'}>
                {org.logo ? (
                  <Image src={org.logo} alt="" width={34} height={34} className="size-8 rounded-md object-contain" unoptimized />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
                    <Layers3 className="size-4" strokeWidth={2.2} />
                  </span>
                )}
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">{org.companyName}</span>
                  <span className="truncate text-xs font-medium text-destructive">{org.tagline}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-1 py-2">
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userRole === 'store-manager' ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/dashboard/store-manager'} tooltip="My store">
                    <Link href="/dashboard/store-manager">
                      <Building2 />
                      <span>My store</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                orderedDepartments.map((department) => {
                  const item = DEPARTMENT_NAV[department];
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={department}>
                      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                        <Link href={item.href}>
                          <Icon className={item.tone} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(form || ['owner', 'finance', 'commercial'].includes(userRole)) ? (
          <SidebarGroup>
            <SidebarGroupLabel>Work</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {form ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === form.href || pathname.startsWith(`${form.href}/`)} tooltip={form.label}>
                      <Link href={form.href}>
                        <form.icon />
                        <span>{form.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
                {['owner', 'finance', 'commercial'].includes(userRole) ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/dashboard/weekly-targets'} tooltip="Targets">
                      <Link href="/dashboard/weekly-targets">
                        <Target />
                        <span>Targets</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userRole === 'owner' ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/dashboard/admin'} tooltip="Users">
                    <Link href="/dashboard/admin">
                      <UserRoundCog />
                      <span>Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {['owner', 'commercial', 'operations', 'inventory'].includes(userRole) ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/catalog/products')} tooltip="Product catalog">
                    <Link href="/catalog/products">
                      <PackageSearch className="text-chart-1" />
                      <span>Product catalog</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/reports')} tooltip="Data export">
                  <Link href="/reports">
                    <FileSpreadsheet />
                    <span>Data export</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {STORE_REPORT_READERS.includes(userRole) ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/store-reports')} tooltip="Store reports">
                    <Link href="/store-reports">
                      <FileText className="text-chart-2" />
                      <span>Store reports</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/settings')} tooltip="Settings">
                  <Link href="/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="h-12 data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-md">
                    <AvatarFallback className="rounded-md bg-primary/12 text-xs font-semibold text-primary">
                      {initials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">{userName}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">{roleLabel(userRole)}</span>
                  </span>
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-60">
                <DropdownMenuLabel>
                  <span className="block truncate text-sm font-medium">{userName}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{roleLabel(userRole)}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut} className="text-destructive focus:text-destructive">
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
