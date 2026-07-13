'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, CircleCheck, KeyRound, LoaderCircle, Mail } from 'lucide-react';
import { AuthShell, AuthTextField } from '@/components/auth/AuthShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup } from '@/components/ui/field';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your work email to receive a reset link."
      icon={KeyRound}
    >
      {sent ? (
        <div className="flex flex-col gap-5">
          <Alert className="border-primary/20 bg-accent/45">
            <CircleCheck className="text-primary" aria-hidden="true" />
            <AlertTitle>Check your inbox</AlertTitle>
            <AlertDescription>
              If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset link has
              been sent. The link expires in 1 hour.
            </AlertDescription>
          </Alert>
          <Button asChild variant="outline" size="lg" className="h-11 w-full">
            <Link href="/login">
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Back to sign in
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-4">
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
            <Field className="gap-3 pt-1">
              <Button type="submit" size="lg" className="h-11 w-full" disabled={loading} aria-busy={loading}>
                {loading && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" />}
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
              <Button asChild variant="link" size="sm" className="h-auto self-center p-0 text-xs">
                <Link href="/login">
                  <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                  Back to sign in
                </Link>
              </Button>
            </Field>
          </FieldGroup>
        </form>
      )}
    </AuthShell>
  );
}
