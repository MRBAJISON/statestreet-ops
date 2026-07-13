'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CircleCheck,
  CirclePause,
  KeyRound,
  LoaderCircle,
  LogIn,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  UserCheck,
  UsersRound,
  UserX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { UserRole } from '@/lib/types';

interface UserAccount {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  store: string;
  active: boolean;
  updatedAt: string;
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  store: string;
}

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; user: UserAccount };

type AccountStatusFilter = 'all' | 'active' | 'inactive';

interface StoreOption {
  label: string;
  value: string;
}

interface UserAdminProps {
  currentUserId: number;
  passwordMinLength: number;
  stores: StoreOption[];
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'finance', label: 'Finance' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'operations', label: 'Operations' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'brand', label: 'Brand' },
  { value: 'store-manager', label: 'Store manager' },
];

const ROLE_LABELS = Object.fromEntries(
  ROLE_OPTIONS.map((role) => [role.value, role.label])
) as Record<UserRole, string>;

const EMPTY_FORM: UserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'finance',
  store: '',
};

const updatedAtFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SS';
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : updatedAtFormatter.format(date);
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error || 'The request could not be completed');
  }

  return payload as T;
}

function RoleBadge({ role }: { role: UserRole }) {
  const variant = role === 'owner' ? 'default' : role === 'store-manager' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{ROLE_LABELS[role]}</Badge>;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge>
      <CircleCheck />
      Active
    </Badge>
  ) : (
    <Badge variant="outline">
      <CirclePause />
      Inactive
    </Badge>
  );
}

function LoadingRows() {
  return (
    <TableBody>
      {Array.from({ length: 6 }, (_, index) => (
        <TableRow key={index}>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </TableCell>
          <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-3 w-24" /></TableCell>
          <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
          <TableCell className="hidden xl:table-cell"><Skeleton className="h-3 w-20" /></TableCell>
          <TableCell><Skeleton className="ml-auto size-8" /></TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

export default function UserAdmin({ currentUserId, passwordMinLength, stores }: UserAdminProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<UserAccount | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const latestLoadId = useRef(0);

  const minPasswordLength = Math.max(8, passwordMinLength);
  const impersonationPending = pendingAction?.startsWith('impersonate-') ?? false;

  const loadUsers = useCallback(async (quiet = false) => {
    const loadId = ++latestLoadId.current;
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const payload = await requestJson<{ users: UserAccount[] }>('/api/users', { cache: 'no-store' });
      if (!Array.isArray(payload.users)) throw new Error('User accounts could not be loaded');
      if (loadId !== latestLoadId.current) return;
      setUsers(payload.users);
      setLoadError(null);
    } catch (error) {
      if (loadId !== latestLoadId.current) return;
      setLoadError(messageFrom(error, 'User accounts could not be loaded'));
    } finally {
      if (loadId === latestLoadId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const activeUsers = users.filter((user) => user.active);
  const activeOwnerCount = activeUsers.filter((user) => user.role === 'owner').length;
  const activeStoreManagerCount = activeUsers.filter((user) => user.role === 'store-manager').length;
  const inactiveUserCount = users.length - activeUsers.length;

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesQuery = !normalizedQuery || [
        user.name,
        user.email,
        ROLE_LABELS[user.role],
        user.store,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? user.active : !user.active);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesQuery && matchesStatus && matchesRole;
    });
  }, [query, roleFilter, statusFilter, users]);

  const editorUser = editor?.mode === 'edit' ? editor.user : null;
  const protectedOwner = Boolean(
    editorUser?.active && editorUser.role === 'owner' && activeOwnerCount <= 1
  );

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditorError(null);
    setEditor({ mode: 'create' });
  }

  function openEdit(user: UserAccount) {
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      store: user.store,
    });
    setEditorError(null);
    setEditor({ mode: 'edit', user });
  }

  function closeEditor() {
    setEditor(null);
    setEditorError(null);
    setForm(EMPTY_FORM);
  }

  async function saveEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const store = form.role === 'store-manager' ? form.store : '';

    if (form.role === 'store-manager' && !store) {
      setEditorError('Select an active retail store for this account.');
      return;
    }

    if (editor.mode === 'create' && form.password.length < minPasswordLength) {
      setEditorError(`Password must be at least ${minPasswordLength} characters.`);
      return;
    }

    setEditorError(null);
    setPendingAction('save-user');

    try {
      if (editor.mode === 'create') {
        await requestJson('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            password: form.password,
            role: form.role,
            store: store || null,
          }),
        });
        await loadUsers(true);
        toast.success(`${name} can now access StateStreet.`);
        closeEditor();
        return;
      }

      const original = editor.user;
      const patch: Record<string, unknown> = {};
      const originalStore = original.store || '';
      if (name !== original.name) patch.name = name;
      if (email !== original.email) patch.email = email;
      if (form.role !== original.role) patch.role = form.role;
      if (store !== originalStore) patch.store = store || null;

      if (Object.keys(patch).length === 0) {
        toast.message('No account changes to save.');
        closeEditor();
        return;
      }
      patch.expectedUpdatedAt = original.updatedAt;

      await requestJson(`/api/users/${original.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      const currentUserSecurityChanged = original.id === currentUserId && (
        patch.email !== undefined ||
        patch.role !== undefined ||
        patch.store !== undefined
      );

      if (currentUserSecurityChanged) {
        toast.success('Account updated. Sign in again to continue.');
        window.location.assign('/login');
        return;
      }

      await loadUsers(true);
      toast.success(`${name}'s account was updated.`);
      closeEditor();
    } catch (error) {
      setEditorError(messageFrom(error, 'The account could not be saved'));
    } finally {
      setPendingAction(null);
    }
  }

  function openPasswordReset(user: UserAccount) {
    setNewPassword('');
    setPasswordError(null);
    setPasswordTarget(user);
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordTarget) return;

    if (newPassword.length < minPasswordLength) {
      setPasswordError(`Password must be at least ${minPasswordLength} characters.`);
      return;
    }

    setPasswordError(null);
    setPendingAction('reset-password');

    try {
      await requestJson(`/api/users/${passwordTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword, expectedUpdatedAt: passwordTarget.updatedAt }),
      });

      if (passwordTarget.id === currentUserId) {
        toast.success('Password updated. Sign in again to continue.');
        window.location.assign('/login');
        return;
      }

      await loadUsers(true);
      toast.success(`Password reset for ${passwordTarget.name}.`);
      setPasswordTarget(null);
      setNewPassword('');
    } catch (error) {
      setPasswordError(messageFrom(error, 'The password could not be reset'));
    } finally {
      setPendingAction(null);
    }
  }

  async function changeAccountStatus() {
    if (!statusTarget) return;
    const reactivating = !statusTarget.active;
    setStatusError(null);
    setPendingAction('change-status');

    try {
      if (reactivating) {
        await requestJson(`/api/users/${statusTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: true, expectedUpdatedAt: statusTarget.updatedAt }),
        });
      } else {
        await requestJson(`/api/users/${statusTarget.id}`, { method: 'DELETE' });
      }

      await loadUsers(true);
      toast.success(`${statusTarget.name} was ${reactivating ? 'reactivated' : 'deactivated'}.`);
      setStatusTarget(null);
    } catch (error) {
      setStatusError(messageFrom(error, `The account could not be ${reactivating ? 'reactivated' : 'deactivated'}`));
    } finally {
      setPendingAction(null);
    }
  }

  async function openAccount(user: UserAccount) {
    if (impersonationPending) return;
    setPendingAction(`impersonate-${user.id}`);
    try {
      const payload = await requestJson<{ redirect?: string }>('/api/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      window.location.assign(payload.redirect || '/dashboard');
    } catch (error) {
      toast.error(messageFrom(error, 'The account could not be opened'));
      setPendingAction(null);
    }
  }

  function clearFilters() {
    setQuery('');
    setStatusFilter('all');
    setRoleFilter('all');
  }

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground">User access</h1>
              <p className="text-sm text-muted-foreground">People with access to StateStreet operations.</p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" />
            Add user
          </Button>
        </header>

        <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-y py-4 md:grid-cols-4">
          <div className="flex items-center gap-3">
            <CircleCheck className="size-5 text-primary" />
            <div>
              {loading ? <Skeleton className="h-6 w-8" /> : <p className="text-lg font-semibold text-foreground">{activeUsers.length}</p>}
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-chart-1" />
            <div>
              {loading ? <Skeleton className="h-6 w-8" /> : <p className="text-lg font-semibold text-foreground">{activeOwnerCount}</p>}
              <p className="text-xs text-muted-foreground">Owners</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Store className="size-5 text-chart-4" />
            <div>
              {loading ? <Skeleton className="h-6 w-8" /> : <p className="text-lg font-semibold text-foreground">{activeStoreManagerCount}</p>}
              <p className="text-xs text-muted-foreground">Store managers</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CirclePause className="size-5 text-muted-foreground" />
            <div>
              {loading ? <Skeleton className="h-6 w-8" /> : <p className="text-lg font-semibold text-foreground">{inactiveUserCount}</p>}
              <p className="text-xs text-muted-foreground">Inactive</p>
            </div>
          </div>
        </div>

        {loadError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Users could not be refreshed</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <section className="surface overflow-hidden">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <InputGroup className="w-full lg:max-w-sm">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput
                aria-label="Search user accounts"
                placeholder="Search people, roles or stores"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton onClick={() => setQuery('')} size="icon-xs" aria-label="Clear search">
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-center">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                spacing={0}
                value={statusFilter}
                onValueChange={(value) => {
                  if (value) setStatusFilter(value as AccountStatusFilter);
                }}
                aria-label="Filter accounts by status"
                className="col-span-2 sm:col-auto"
              >
                <ToggleGroupItem value="all">All</ToggleGroupItem>
                <ToggleGroupItem value="active">Active</ToggleGroupItem>
                <ToggleGroupItem value="inactive">Inactive</ToggleGroupItem>
              </ToggleGroup>

              <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as 'all' | UserRole)}>
                <SelectTrigger className="w-full sm:w-44" aria-label="Filter accounts by role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All roles</SelectItem>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => void loadUsers(true)}
                disabled={refreshing}
                aria-label="Refresh users"
                title="Refresh users"
              >
                <RefreshCw data-icon="inline-start" className={refreshing ? 'animate-spin' : undefined} />
              </Button>
            </div>
          </div>

          {filteredUsers.length === 0 && !loading ? (
            <Empty className="min-h-72">
              <EmptyHeader>
                <EmptyMedia variant="icon"><UsersRound /></EmptyMedia>
                <EmptyTitle>No matching accounts</EmptyTitle>
                <EmptyDescription>There are no users in this view.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden sm:table-cell">Role</TableHead>
                  <TableHead className="hidden lg:table-cell">Store</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden xl:table-cell">Updated</TableHead>
                  <TableHead className="w-12 text-right"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              {loading ? (
                <LoadingRows />
              ) : (
                <TableBody>
                  {filteredUsers.map((user) => {
                    const isCurrentUser = user.id === currentUserId;
                    const isLastActiveOwner = user.active && user.role === 'owner' && activeOwnerCount <= 1;
                    const statusActionDisabled = isCurrentUser || isLastActiveOwner;
                    const impersonating = pendingAction === `impersonate-${user.id}`;

                    return (
                      <TableRow key={user.id} className={!user.active ? 'opacity-70' : undefined}>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="size-9 border">
                              <AvatarFallback>{initials(user.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="max-w-48 truncate font-medium text-foreground">{user.name}</p>
                                {isCurrentUser ? <Badge variant="outline">You</Badge> : null}
                              </div>
                              <p className="max-w-48 truncate text-xs text-muted-foreground sm:max-w-64">{user.email}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5 sm:hidden">
                                <RoleBadge role={user.role} />
                                <StatusBadge active={user.active} />
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"><RoleBadge role={user.role} /></TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {user.store ? (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <MapPin className="size-3.5" />
                              {stores.find((store) => store.value === user.store)?.label || user.store}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Not assigned</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"><StatusBadge active={user.active} /></TableCell>
                        <TableCell className="hidden text-muted-foreground xl:table-cell">{formatUpdatedAt(user.updatedAt)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={impersonationPending}
                                aria-label={`Actions for ${user.name}`}
                              >
                                {impersonating ? <LoaderCircle className="animate-spin" /> : <MoreHorizontal />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuGroup>
                                <DropdownMenuItem onSelect={() => openEdit(user)}>
                                  <Pencil />
                                  Edit account
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => openPasswordReset(user)}>
                                  <KeyRound />
                                  Reset password
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!user.active || isCurrentUser || impersonationPending}
                                  onSelect={() => void openAccount(user)}
                                >
                                  <LogIn />
                                  Open account
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                              <DropdownMenuSeparator />
                              <DropdownMenuGroup>
                                {user.active ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    disabled={statusActionDisabled}
                                    onSelect={() => {
                                      setStatusError(null);
                                      setStatusTarget(user);
                                    }}
                                  >
                                    <UserX />
                                    Deactivate
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setStatusError(null);
                                      setStatusTarget(user);
                                    }}
                                  >
                                    <RotateCcw />
                                    Reactivate
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              )}
            </Table>
          )}
        </section>
      </div>

      <Sheet
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open && pendingAction !== 'save-user') closeEditor();
        }}
      >
        <SheetContent className="flex w-full flex-col data-[side=right]:w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editor?.mode === 'edit' ? 'Edit account' : 'Add user'}</SheetTitle>
            <SheetDescription>
              {editor?.mode === 'edit' ? editor.user.email : 'Create an active StateStreet account.'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={saveEditor} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
              <FieldGroup>
                {editorError ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{editorError}</AlertDescription>
                  </Alert>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="user-name">Full name</FieldLabel>
                  <Input
                    id="user-name"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="user-email">Email address</FieldLabel>
                  <Input
                    id="user-email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="user-role">Role</FieldLabel>
                  <Select
                    value={form.role}
                    onValueChange={(value) => setForm((current) => ({
                      ...current,
                      role: value as UserRole,
                      store: value === 'store-manager' ? current.store : '',
                    }))}
                  >
                    <SelectTrigger id="user-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ROLE_OPTIONS.map((role) => (
                          <SelectItem
                            key={role.value}
                            value={role.value}
                            disabled={protectedOwner && role.value !== 'owner'}
                          >
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {protectedOwner ? (
                    <FieldDescription>Add another active owner before changing this role.</FieldDescription>
                  ) : null}
                </Field>

                {form.role === 'store-manager' ? (
                  <Field data-invalid={Boolean(editorError && !form.store)}>
                    <FieldLabel htmlFor="user-store">Retail store</FieldLabel>
                    <Select
                      required
                      value={form.store}
                      onValueChange={(value) => setForm((current) => ({ ...current, store: value }))}
                    >
                      <SelectTrigger id="user-store" className="w-full" aria-invalid={Boolean(editorError && !form.store)}>
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {stores.map((store) => (
                            <SelectItem key={store.value} value={store.value}>{store.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {editorError && !form.store ? <FieldError>Select an active retail store.</FieldError> : null}
                  </Field>
                ) : null}

                {editor?.mode === 'create' ? (
                  <Field data-invalid={Boolean(editorError && form.password.length < minPasswordLength)}>
                    <FieldLabel htmlFor="user-password">Temporary password</FieldLabel>
                    <Input
                      id="user-password"
                      type="password"
                      required
                      minLength={minPasswordLength}
                      maxLength={256}
                      autoComplete="new-password"
                      aria-invalid={Boolean(editorError && form.password.length < minPasswordLength)}
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    />
                    <FieldDescription>Minimum {minPasswordLength} characters.</FieldDescription>
                  </Field>
                ) : null}
              </FieldGroup>
            </div>

            <SheetFooter>
              <Button type="button" variant="outline" onClick={closeEditor} disabled={pendingAction === 'save-user'}>
                Cancel
              </Button>
              <Button type="submit" disabled={pendingAction === 'save-user'}>
                {pendingAction === 'save-user' ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : editor?.mode === 'edit' ? <UserCheck data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                {editor?.mode === 'edit' ? 'Save changes' : 'Create account'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(passwordTarget)}
        onOpenChange={(open) => {
          if (!open && pendingAction !== 'reset-password') {
            setPasswordTarget(null);
            setNewPassword('');
            setPasswordError(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={savePassword} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Reset password</DialogTitle>
              <DialogDescription>{passwordTarget?.name} will be signed out of existing sessions.</DialogDescription>
            </DialogHeader>

            <FieldGroup>
              {passwordError ? <FieldError>{passwordError}</FieldError> : null}
              <Field data-invalid={Boolean(passwordError)}>
                <FieldLabel htmlFor="reset-password">New password</FieldLabel>
                <Input
                  id="reset-password"
                  type="password"
                  autoFocus
                  required
                  minLength={minPasswordLength}
                  maxLength={256}
                  autoComplete="new-password"
                  aria-invalid={Boolean(passwordError)}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <FieldDescription>Minimum {minPasswordLength} characters.</FieldDescription>
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pendingAction === 'reset-password'}
                onClick={() => setPasswordTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pendingAction === 'reset-password'}>
                {pendingAction === 'reset-password' ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <KeyRound data-icon="inline-start" />}
                Reset password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => {
          if (!open && pendingAction !== 'change-status') {
            setStatusTarget(null);
            setStatusError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statusTarget?.active ? 'Deactivate account' : 'Reactivate account'}</DialogTitle>
            <DialogDescription>
              {statusTarget?.active
                ? `${statusTarget.name} will lose access and be signed out. Their reporting and customer history will remain intact.`
                : `${statusTarget?.name} will regain access with their existing role and store assignment.`}
            </DialogDescription>
          </DialogHeader>

          {statusError ? <FieldError>{statusError}</FieldError> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pendingAction === 'change-status'}
              onClick={() => setStatusTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={statusTarget?.active ? 'destructive' : 'default'}
              disabled={pendingAction === 'change-status'}
              onClick={() => void changeAccountStatus()}
            >
              {pendingAction === 'change-status' ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : statusTarget?.active ? (
                <UserX data-icon="inline-start" />
              ) : (
                <UserCheck data-icon="inline-start" />
              )}
              {statusTarget?.active ? 'Deactivate account' : 'Reactivate account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
