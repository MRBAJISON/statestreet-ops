'use client';

import Image from 'next/image';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  Eye,
  EyeOff,
  Layers3,
  LockKeyhole,
  type LucideIcon,
} from 'lucide-react';
import { useOrg } from '@/components/providers/OrgProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

interface AuthShellProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}

interface AuthTextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  id: string;
  label: string;
  icon: LucideIcon;
}

type AuthPasswordFieldProps = Omit<AuthTextFieldProps, 'icon' | 'type'>;

function BrandLockup({ compact = false }: { compact?: boolean }) {
  const { org } = useOrg();

  return (
    <div className="flex min-w-0 items-center gap-3">
      {org.logo ? (
        <Image
          src={org.logo}
          alt=""
          width={compact ? 36 : 40}
          height={compact ? 36 : 40}
          className={cn(
            'rounded-lg object-contain',
            compact ? 'size-9' : 'size-10',
          )}
          unoptimized
        />
      ) : (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm',
            compact ? 'size-9' : 'size-10',
          )}
          aria-hidden="true"
        >
          <Layers3 className={compact ? 'size-4' : 'size-[1.125rem]'} strokeWidth={2.2} />
        </span>
      )}
      <span className="grid min-w-0 leading-tight">
        <span className="truncate text-sm font-semibold text-foreground">{org.companyName}</span>
        <span className="truncate text-xs text-muted-foreground">{org.tagline}</span>
      </span>
    </div>
  );
}

function AnalyticsMotif() {
  return (
    <div className="relative h-64 w-full" aria-hidden="true">
      <span className="absolute inset-x-0 top-0 border-t border-sidebar-border" />
      <span className="absolute inset-x-0 top-1/3 border-t border-sidebar-border/80" />
      <span className="absolute inset-x-0 top-2/3 border-t border-sidebar-border/80" />
      <span className="absolute inset-x-0 bottom-0 border-t border-sidebar-border" />
      <div className="absolute inset-x-0 bottom-px flex h-full items-end gap-3 px-3">
        <span className="h-[28%] flex-1 rounded-t-sm bg-chart-1/35" />
        <span className="h-[43%] flex-1 rounded-t-sm bg-primary/55" />
        <span className="h-[38%] flex-1 rounded-t-sm bg-chart-2/60" />
        <span className="h-[61%] flex-1 rounded-t-sm bg-chart-1/75" />
        <span className="h-[54%] flex-1 rounded-t-sm bg-chart-4/65" />
        <span className="h-[76%] flex-1 rounded-t-sm bg-primary/80" />
        <span className="h-[68%] flex-1 rounded-t-sm bg-chart-2/75" />
        <span className="h-[88%] flex-1 rounded-t-sm bg-chart-1" />
      </div>
    </div>
  );
}

export function AuthShell({ title, description, icon: Icon, children }: AuthShellProps) {
  const { org } = useOrg();

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]">
      <aside className="relative hidden min-h-svh overflow-hidden border-r border-sidebar-border bg-sidebar p-8 lg:flex lg:flex-col xl:p-10">
        <BrandLockup />

        <div className="flex flex-1 items-center py-14">
          <div className="w-full max-w-xl">
            <p className="text-xs font-medium text-sidebar-foreground/60">Operations</p>
            <AnalyticsMotif />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-sidebar-border pt-4 text-xs text-sidebar-foreground/60">
          <span>{org.tagline}</span>
          <span>Authorized access</span>
        </div>
      </aside>

      <section
        className="relative flex min-h-svh items-center justify-center px-5 py-10 sm:px-8 lg:px-14"
        aria-labelledby="auth-title"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-primary lg:hidden" aria-hidden="true" />
        <div className="w-full max-w-[440px]">
          <div className="mb-10 lg:hidden">
            <BrandLockup compact />
          </div>

          <header className="mb-7">
            <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="size-[1.125rem]" aria-hidden="true" />
            </span>
            <h1 id="auth-title" className="text-2xl font-semibold leading-8 text-foreground">
              {title}
            </h1>
            <p className="mt-2 max-w-[48ch] text-sm leading-6 text-muted-foreground">{description}</p>
          </header>

          <Card className="gap-0 rounded-lg border border-border/80 py-0 shadow-[var(--shadow-surface)] ring-0">
            <CardContent className="p-5 sm:p-6">{children}</CardContent>
          </Card>

          <p className="mt-5 text-center text-xs text-muted-foreground">Authorized personnel only.</p>
        </div>
      </section>
    </main>
  );
}

export function AuthTextField({
  id,
  label,
  icon: Icon,
  className,
  ...props
}: AuthTextFieldProps) {
  return (
    <Field data-invalid={props['aria-invalid'] || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup className="h-11 bg-background shadow-[0_1px_0_oklch(0.3_0.02_165/0.02)]">
        <InputGroupInput id={id} className={cn('h-10 text-sm', className)} {...props} />
        <InputGroupAddon align="inline-start">
          <Icon aria-hidden="true" />
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}

export function AuthPasswordField({
  id,
  label,
  className,
  ...props
}: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Field data-invalid={props['aria-invalid'] || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup className="h-11 bg-background shadow-[0_1px_0_oklch(0.3_0.02_165/0.02)]">
        <InputGroupInput
          id={id}
          type={visible ? 'text' : 'password'}
          className={cn('h-10 text-sm', className)}
          {...props}
        />
        <InputGroupAddon align="inline-start">
          <LockKeyhole aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            disabled={props.disabled}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}
