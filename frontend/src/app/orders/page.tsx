'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Package, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTokenStore } from '@/store/token-store';
import { createClientApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { PaginatedResponse, Order } from '@/types';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  PENDING: 'warning',
  CONFIRMED: 'default',
  PROCESSING: 'default',
  PACKED: 'secondary',
  SHIPPED: 'secondary',
  OUT_FOR_DELIVERY: 'secondary',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  REFUND_INITIATED: 'warning',
  REFUNDED: 'success',
};

export default function OrdersPage() {
  const token = useTokenStore((s) => s.token);
  const api = createClientApi(token ?? undefined);

  const { data, isLoading } = useQuery<PaginatedResponse<Order>>({
    queryKey: ['orders'],
    queryFn: () => api('/orders'),
    enabled: !!token,
  });

  const orders = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="animate-pulse space-y-4 max-w-2xl mx-auto">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-forest-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <Package className="mx-auto h-16 w-16 text-forest-200 mb-6" />
        <h1 className="font-display text-2xl font-bold text-forest-900 mb-2">No orders yet</h1>
        <p className="text-gray-500 mb-8">Your order history will appear here.</p>
        <Button asChild size="lg"><Link href="/products">Start shopping</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-forest-900 mb-6">My orders</h1>
      <div className="max-w-2xl space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/orders/${order.id}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-forest-100 bg-white p-4 hover:border-forest-300 hover:shadow-sm transition-all group"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-gray-800">{order.orderNumber}</span>
                <Badge variant={STATUS_VARIANT[order.status] ?? 'secondary'} className="text-[10px]">
                  {order.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <p className="text-xs text-gray-500">{order.items?.length ?? 0} item(s)</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-forest-700">{formatPrice(Number(order.total))}</span>
              <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-forest-600 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
