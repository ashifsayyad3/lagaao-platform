'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTokenStore } from '@/store/token-store';
import { loginAction } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const setToken = useTokenStore((s) => s.setToken);
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await loginAction({ email, password });
      if (result?.error) {
        toast.error(result.error);
      } else if (result?.token) {
        setToken(result.token);
        toast.success('Welcome back!');
        router.push('/');
        router.refresh();
      }
    });
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-forest-50/50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-forest-600 mb-4">
            <Leaf className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-forest-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your lagaao account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-forest-100 p-6 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="email">Email</label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="password">Password</label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-forest-600 hover:text-forest-700">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
