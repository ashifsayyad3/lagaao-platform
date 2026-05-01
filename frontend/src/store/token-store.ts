'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface TokenState {
  token: string | null;
  setToken: (token: string | null) => void;
  clear: () => void;
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      clear: () => set({ token: null }),
    }),
    {
      name: 'lagaao-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
