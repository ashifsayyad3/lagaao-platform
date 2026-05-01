'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_BASE } from './api';

const COOKIE_NAME    = 'lagaao_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface AuthUser {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  role: string;
  avatarUrl?: string;
  isVerified: boolean;
}

// ── Cookie helpers ─────────────────────────────────────────────────────────────

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

// ── Server actions ─────────────────────────────────────────────────────────────

export async function loginAction(payload: { email: string; password: string }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.message ?? 'Login failed';
    return { error: Array.isArray(msg) ? msg.join(', ') : msg };
  }

  await setAuthCookie(data.accessToken);
  return { success: true, token: data.accessToken as string, user: data.user as AuthUser };
}

export async function registerAction(payload: {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  password: string;
}) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.message ?? 'Registration failed';
    return { error: Array.isArray(msg) ? msg.join(', ') : msg };
  }

  await setAuthCookie(data.accessToken);
  return { success: true, token: data.accessToken as string, user: data.user as AuthUser };
}

export async function logoutAction() {
  await clearAuthCookie();
  redirect('/');
}

