'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, LoaderCircle, LogIn, Mail } from 'lucide-react';
import { AuthPasswordField, AuthShell, AuthTextField } from '@/components/auth/AuthShell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup } from '@/components/ui/field';
import { useOrg } from '@/components/providers/OrgProvider';

export default function LoginPage() {
  const router = useRouter();
  const { refresh: refreshOrg } = useOrg();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const data = await res.json();
      await refreshOrg();
      if (data.user.role === 'owner') {
        router.push('/dashboard/executive');
      } else if (data.user.role === 'store-manager') {
        router.push('/forms/store-manager');
      } else {
        const seg = data.user.department === 'brand' ? 'brand-health' : data.user.department;
        router.push(`/dashboard/${seg}`);
      }
    } else {
      setError('Invalid email or password');
    }
    setLoading(false);
  }

  return (
    <AuthShell title="Sign in" description="Use your StateStreet account to continue." icon={LogIn}>
      <form onSubmit={handleLogin}>
        <FieldGroup className="gap-4">
          {error && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <AuthTextField
            id="email"
            label="Email"
            icon={Mail}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="your@email.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            disabled={loading}
            required
          />

          <AuthPasswordField
            id="password"
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            disabled={loading}
            required
          />

          <Field className="gap-3 pt-1">
            <Button type="submit" size="lg" className="h-11 w-full" disabled={loading} aria-busy={loading}>
              {loading && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <Button asChild variant="link" size="sm" className="h-auto self-center p-0 text-xs">
              <Link href="/forgot-password">Forgot password?</Link>
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
