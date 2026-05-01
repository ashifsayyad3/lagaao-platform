'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTokenStore } from '@/store/token-store';
import { createClientApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Order } from '@/types';

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

const CANCELLABLE = ['PENDING', 'CONFIRMED'];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const token = useTokenStore((s) => s.token);
  const api = createClientApi(token ?? undefined);
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ['order', id],
    queryFn: () => api(`/orders/${id}`),
    enabled: !!token && !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api(`/orders/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Order cancelled');
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="animate-pulse space-y-4 max-w-2xl mx-auto">
          <div className="h-8 bg-forest-100 rounded w-48" />
          <div className="h-40 bg-forest-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <p className="text-gray-500 mb-4">Order not found.</p>
        <Button asChild variant="outline"><Link href="/orders">Back to orders</Link></Button>
      </div>
    );
  }

  const addr = order.shippingAddress;

  return (
    <div className="container mx-auto px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link href="/orders"><ArrowLeft className="h-4 w-4" /> My orders</Link>
      </Button>

      <div className="max-w-2xl space-y-5">
        {/* Header */}
        <div className="rounded-2xl border border-forest-100 bg-white p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-display text-xl font-bold text-forest-900">{order.orderNumber}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[order.status] ?? 'secondary'}>
              {order.status.replace(/_/g, ' ')}
            </Badge>
          </div>

          {CANCELLABLE.includes(order.status) && (
            <Button
              variant="destructive"
              size="sm"
              className="mt-4"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              Cancel order
            </Button>
          )}
        </div>

        {/* Items */}
        <div className="rounded-2xl border border-forest-100 bg-white p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Package className="h-4 w-4 text-forest-600" /> Items</h2>
          <div className="divide-y divide-forest-50">
            {order.items?.map((item) => (
              <div key={item.id} className="py-3 flex justify-between items-center gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                  <p className="text-xs text-gray-400">Qty: {item.quantity} × {formatPrice(Number(item.price))}</p>
                </div>
                <span className="text-sm font-semibold text-gray-700 shrink-0">{formatPrice(Number(item.price) * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-forest-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span>{formatPrice(Number(order.subtotal))}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span><span>-{formatPrice(Number(order.discount))}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>{Number(order.shippingCost) === 0 ? 'Free' : formatPrice(Number(order.shippingCost))}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-forest-100">
              <span>Total</span><span>{formatPrice(Number(order.total))}</span>
            </div>
          </div>
        </div>

        {/* Delivery address */}
        {addr && (
          <div className="rounded-2xl border border-forest-100 bg-white p-5 space-y-2">
            <h2 className="font-semibold text-gray-800">Delivery address</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              {addr.fullName}<br />
              {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
              {addr.city}, {addr.state} – {addr.pincode}<br />
              {addr.phone}
            </p>
          </div>
        )}

        {/* Status timeline */}
        {order.statusHistory && order.statusHistory.length > 0 && (
          <div className="rounded-2xl border border-forest-100 bg-white p-5 space-y-3">
            <h2 className="font-semibold text-gray-800">Status history</h2>
            <ol className="relative border-l border-forest-200 space-y-4 ml-2">
              {order.statusHistory.map((h) => (
                <li key={h.id} className="ml-4">
                  <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-forest-600 bg-white" />
                  <p className="text-sm font-medium text-gray-800">{h.status.replace(/_/g, ' ')}</p>
                  {h.note && <p className="text-xs text-gray-500">{h.note}</p>}
                  <p className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleString('en-IN')}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
