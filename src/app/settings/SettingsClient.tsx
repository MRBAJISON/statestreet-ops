'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Sun,
  Upload,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrg } from '@/components/providers/OrgProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface UserInfo {
  name: string;
  email: string;
  role: string;
  store: string;
}

type Message = { ok: boolean; text: string } | null;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function titleCase(value: string) {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusMessage({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <div
      role={message.ok ? 'status' : 'alert'}
      className={message.ok ? 'flex items-center gap-2 text-sm font-medium text-primary' : 'text-sm font-medium text-destructive'}
    >
      {message.ok ? <Check className="size-4" /> : null}
      {message.text}
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="h-10 pr-10"
        required
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-1.5 top-1.5 text-muted-foreground"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}

export default function SettingsClient({ user, isOwner }: { user: UserInfo; isOwner: boolean }) {
  const router = useRouter();
  const { org, refresh: refreshOrg } = useOrg();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<Message>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);

  const [workspace, setWorkspace] = useState({
    companyName: org.companyName,
    tagline: org.tagline,
    currency: org.currency,
    logo: org.logo,
    weekStart: org.weekStart,
    security: { ...org.security },
  });
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState<Message>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setWorkspace({
      companyName: org.companyName,
      tagline: org.tagline,
      currency: org.currency,
      logo: org.logo,
      weekStart: org.weekStart,
      security: { ...org.security },
    });
  }, [org]);

  const availableTabs = useMemo(() => (isOwner ? ['account', 'workspace', 'appearance'] : ['account', 'appearance']), [isOwner]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingName(true);
    setNameMessage(null);
    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not update profile');
      setNameMessage({ ok: true, text: 'Profile updated' });
      toast.success('Profile updated');
      router.refresh();
    } catch (error) {
      setNameMessage({ ok: false, text: (error as Error).message });
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ ok: false, text: 'New passwords do not match' });
      return;
    }
    setSavingPassword(true);
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not update password');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ ok: true, text: 'Password updated' });
      toast.success('Password updated');
    } catch (error) {
      setPasswordMessage({ ok: false, text: (error as Error).message });
    } finally {
      setSavingPassword(false);
    }
  }

  function selectLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 200_000) {
      setWorkspaceMessage({ ok: false, text: 'Logo must be smaller than 200 KB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setWorkspace((current) => ({ ...current, logo: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function saveWorkspace(event: React.FormEvent) {
    event.preventDefault();
    setSavingWorkspace(true);
    setWorkspaceMessage(null);
    try {
      const response = await fetch('/api/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workspace),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not update workspace');
      await refreshOrg();
      setWorkspaceMessage({ ok: true, text: 'Workspace updated' });
      toast.success('Workspace updated');
      router.refresh();
    } catch (error) {
      setWorkspaceMessage({ ok: false, text: (error as Error).message });
    } finally {
      setSavingWorkspace(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="mb-7 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary/12 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <Tabs defaultValue={availableTabs[0]} className="gap-6">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b pb-3">
          <TabsTrigger value="account" className="flex-none px-3">
            <UserRound /> Account
          </TabsTrigger>
          {isOwner ? (
            <TabsTrigger value="workspace" className="flex-none px-3">
              <Building2 /> Workspace
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="appearance" className="flex-none px-3">
            <Palette /> Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="shadow-[var(--shadow-surface)]">
              <CardHeader className="border-b">
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveProfile}>
                  <FieldGroup>
                    <div className="flex items-center gap-3">
                      <Avatar size="lg" className="size-12">
                        <AvatarFallback className="bg-chart-1/12 font-semibold text-chart-1">{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{name || 'StateStreet user'}</p>
                        <p className="truncate text-xs text-muted-foreground">{titleCase(user.role)}</p>
                      </div>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="display-name">Display name</FieldLabel>
                      <Input id="display-name" value={name} onChange={(event) => setName(event.target.value)} className="h-10" required />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="account-email">Email</FieldLabel>
                        <Input id="account-email" value={user.email} className="h-10" readOnly />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="account-store">Store</FieldLabel>
                        <Input id="account-store" value={user.store || 'All stores'} className="h-10" readOnly />
                      </Field>
                    </div>
                    <StatusMessage message={nameMessage} />
                    <div>
                      <Button type="submit" size="lg" disabled={savingName || !name.trim()}>
                        {savingName ? <LoaderCircle className="animate-spin" /> : <Save />}
                        Save profile
                      </Button>
                    </div>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-surface)]">
              <CardHeader className="border-b">
                <CardTitle>Password</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={changePassword}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="current-password">Current password</FieldLabel>
                      <PasswordInput id="current-password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="new-password">New password</FieldLabel>
                      <PasswordInput id="new-password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
                      <FieldDescription>At least {org.security.minPasswordLen} characters.</FieldDescription>
                    </Field>
                    <Field data-invalid={Boolean(confirmPassword && confirmPassword !== newPassword)}>
                      <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
                      <PasswordInput id="confirm-password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
                      {confirmPassword && confirmPassword !== newPassword ? <FieldError>Passwords do not match.</FieldError> : null}
                    </Field>
                    <StatusMessage message={passwordMessage} />
                    <div>
                      <Button
                        type="submit"
                        size="lg"
                        disabled={savingPassword || !currentPassword || newPassword.length < org.security.minPasswordLen || newPassword !== confirmPassword}
                      >
                        {savingPassword ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />}
                        Update password
                      </Button>
                    </div>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isOwner ? (
          <TabsContent value="workspace">
            <form onSubmit={saveWorkspace} className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <Card className="shadow-[var(--shadow-surface)]">
                <CardHeader className="border-b">
                  <CardTitle>Workspace identity</CardTitle>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <div className="flex flex-wrap items-center gap-4">
                      {workspace.logo ? (
                        <Image src={workspace.logo} alt="Workspace logo" width={64} height={64} className="size-16 rounded-md border bg-background object-contain p-1" unoptimized />
                      ) : (
                        <span className="flex size-16 items-center justify-center rounded-md bg-primary/12 text-primary">
                          <Building2 className="size-7" />
                        </span>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" asChild>
                          <label>
                            <Upload /> Upload logo
                            <input className="sr-only" type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={selectLogo} />
                          </label>
                        </Button>
                        {workspace.logo ? (
                          <Button type="button" variant="ghost" onClick={() => setWorkspace((current) => ({ ...current, logo: '' }))}>
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="company-name">Company name</FieldLabel>
                        <Input id="company-name" value={workspace.companyName} onChange={(event) => setWorkspace((current) => ({ ...current, companyName: event.target.value }))} className="h-10" required />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="tagline">Tagline</FieldLabel>
                        <Input id="tagline" value={workspace.tagline} onChange={(event) => setWorkspace((current) => ({ ...current, tagline: event.target.value }))} className="h-10" />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="currency">Currency</FieldLabel>
                        <Input id="currency" value={workspace.currency} onChange={(event) => setWorkspace((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} className="h-10 uppercase" maxLength={8} required />
                      </Field>
                      <Field>
                        <FieldLabel>Week starts on</FieldLabel>
                        <Select value={workspace.weekStart} onValueChange={(value) => setWorkspace((current) => ({ ...current, weekStart: value === 'sunday' ? 'sunday' : 'monday' }))}>
                          <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="monday">Monday</SelectItem>
                              <SelectItem value="sunday">Sunday</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card className="shadow-[var(--shadow-surface)]">
                <CardHeader className="border-b">
                  <CardTitle>Security policy</CardTitle>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="password-length">Minimum password length</FieldLabel>
                      <Input id="password-length" type="number" min={8} max={128} value={workspace.security.minPasswordLen} onChange={(event) => setWorkspace((current) => ({ ...current, security: { ...current.security, minPasswordLen: Number(event.target.value) || 8 } }))} className="h-10" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="session-days">Session length</FieldLabel>
                      <div className="relative">
                        <Input id="session-days" type="number" min={1} max={90} value={workspace.security.sessionDays} onChange={(event) => setWorkspace((current) => ({ ...current, security: { ...current.security, sessionDays: Number(event.target.value) || 1 } }))} className="h-10 pr-14" />
                        <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-muted-foreground">days</span>
                      </div>
                    </Field>
                    <StatusMessage message={workspaceMessage} />
                    <div>
                      <Button type="submit" size="lg" disabled={savingWorkspace || !workspace.companyName.trim()}>
                        {savingWorkspace ? <LoaderCircle className="animate-spin" /> : <Save />}
                        Save workspace
                      </Button>
                    </div>
                  </FieldGroup>
                </CardContent>
              </Card>
            </form>
          </TabsContent>
        ) : null}

        <TabsContent value="appearance">
          <Card className="max-w-3xl shadow-[var(--shadow-surface)]">
            <CardHeader className="border-b">
              <CardTitle>Color mode</CardTitle>
            </CardHeader>
            <CardContent>
              {mounted ? (
                <ToggleGroup
                  type="single"
                  value={theme ?? 'light'}
                  onValueChange={(value) => value && setTheme(value)}
                  variant="outline"
                  spacing={2}
                  className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3"
                >
                  <ToggleGroupItem value="light" className="h-auto justify-start gap-3 border px-4 py-4 data-[state=on]:border-primary data-[state=on]:bg-primary/8">
                    <span className="flex size-9 items-center justify-center rounded-md bg-chart-2/18 text-amber-700"><Sun /></span>
                    <span className="text-left"><span className="block font-medium">Light</span><span className="block text-xs text-muted-foreground">Bright workspace</span></span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="dark" className="h-auto justify-start gap-3 border px-4 py-4 data-[state=on]:border-primary data-[state=on]:bg-primary/8">
                    <span className="flex size-9 items-center justify-center rounded-md bg-chart-1/14 text-chart-1"><Moon /></span>
                    <span className="text-left"><span className="block font-medium">Dark</span><span className="block text-xs text-muted-foreground">Low-light workspace</span></span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="system" className="h-auto justify-start gap-3 border px-4 py-4 data-[state=on]:border-primary data-[state=on]:bg-primary/8">
                    <span className="flex size-9 items-center justify-center rounded-md bg-chart-4/14 text-chart-4"><Laptop /></span>
                    <span className="text-left"><span className="block font-medium">System</span><span className="block text-xs text-muted-foreground">Match this device</span></span>
                  </ToggleGroupItem>
                </ToggleGroup>
              ) : (
                <div className="h-[74px] rounded-md bg-muted" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
