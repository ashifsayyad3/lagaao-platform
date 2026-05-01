'use client';

import { useQuery } from '@tanstack/react-query';
import { useTokenStore } from '@/store/token-store';
import { createClientApi } from '@/lib/api';
import type { User } from '@/types';

export function useAuth() {
  const token = useTokenStore((s) => s.token);

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ['auth', 'profile', token],
    queryFn: () => createClientApi(token!).get<User>('/auth/profile'),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    user,
    isLoading: !!token && isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
  };
}
