'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, CircleCheck, KeyRound, LoaderCircle, TriangleAlert } from 'lucide-react';
import { AuthPasswordField, AuthShell } from '@/components/auth/AuthShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup } from '@/components/ui/field';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [minPasswordLength, setMinPasswordLength] = useState(8);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || '';
    setToken(t);
    void fetch('/api/org', { cache: 'no-store' })
      .then((response) => response.json())
      .then((org: { passwordMinLength?: number }) => {
        if (Number.isInteger(org.passwordMinLength) && Number(org.passwordMinLength) >= 8) {
          setMinPasswordLength(Number(org.passwordMinLength));
        }
      })
      .catch(() => undefined);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const lengthError = `Password must be at least ${minPasswordLength} characters`;
    if (password.length < minPasswordLength) return setError(lengthError);
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    const res = await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push('/login'), 1500);
    } else {
      setError(json.error || 'Could not reset password');
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      description="Choose a new password for your StateStreet account."
      icon={KeyRound}
    >
      {done ? (
        <Alert className="border-primary/20 bg-accent/45">
          <CircleCheck className="text-primary" aria-hidden="true" />
          <AlertDescription>Password updated. Redirecting to sign in…</AlertDescription>
        </Alert>
      ) : !token ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Reset link unavailable</AlertTitle>
          <AlertDescription>
            Missing reset token. Please use the link from your email, or{' '}
            <Link href="/forgot-password">request a new one</Link>.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-4">
            {error && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <AuthPasswordField
              id="password"
              label="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={`At least ${minPasswordLength} characters`}
              autoComplete="new-password"
              aria-invalid={error === `Password must be at least ${minPasswordLength} characters` || error === 'Passwords do not match'}
              disabled={loading}
              required
            />
            <AuthPasswordField
              id="confirm-password"
              label="Confirm password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
              aria-invalid={error === 'Passwords do not match'}
              disabled={loading}
              required
            />
            <Field className="pt-1">
              <Button type="submit" size="lg" className="h-11 w-full" disabled={loading} aria-busy={loading}>
                {loading && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" />}
                {loading ? 'Updating...' : 'Update password'}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      )}
    </AuthShell>
  );
}
