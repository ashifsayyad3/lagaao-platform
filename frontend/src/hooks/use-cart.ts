'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTokenStore } from '@/store/token-store';
import { createClientApi } from '@/lib/api';
import type { Cart } from '@/types';

const CART_KEY = ['cart'];

export function useCart() {
  const token = useTokenStore((s) => s.token);
  const api   = createClientApi(token ?? undefined);
  const qc    = useQueryClient();

  const { data: cart, isLoading } = useQuery<Cart>({
    queryKey: CART_KEY,
    queryFn: () => api.get<Cart>('/cart'),
    enabled: !!token,
    staleTime: 30_000,
  });

  const addItemMutation = useMutation({
    mutationFn: (vars: { productId: string; quantity?: number }) =>
      api.post<Cart>('/cart/items', { productId: vars.productId, quantity: vars.quantity ?? 1 }),
    onSuccess: (data) => {
      qc.setQueryData(CART_KEY, data);
      toast.success('Added to cart');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateItemMutation = useMutation({
    mutationFn: (vars: { cartItemId: string; quantity: number }) =>
      api.put<Cart>(`/cart/items/${vars.cartItemId}`, { quantity: vars.quantity }),
    onSuccess: (data) => qc.setQueryData(CART_KEY, data),
    onError: (err: Error) => toast.error(err.message),
  });

  const removeItemMutation = useMutation({
    mutationFn: (cartItemId: string) => api.delete<Cart>(`/cart/items/${cartItemId}`),
    onSuccess: (data) => {
      qc.setQueryData(CART_KEY, data);
      toast.success('Item removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearCartMutation = useMutation({
    mutationFn: () => api.delete<{ message: string }>('/cart'),
    onSuccess: () => {
      qc.setQueryData(CART_KEY, null);
      toast.success('Cart cleared');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    cart,
    isLoading,
    itemCount: cart?.summary?.itemCount ?? 0,
    addItem: addItemMutation.mutate,
    isAddingItem: addItemMutation.isPending,
    updateItem: updateItemMutation.mutate,
    isUpdatingItem: updateItemMutation.isPending,
    removeItem: removeItemMutation.mutate,
    isRemovingItem: removeItemMutation.isPending,
    clearCart: clearCartMutation.mutate,
  };
}
