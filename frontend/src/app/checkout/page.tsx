'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/hooks/use-cart';
import { useTokenStore } from '@/store/token-store';
import { createClientApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Address, Order, RazorpayCheckoutData } from '@/types';

declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const token = useTokenStore((s) => s.token);
  const api = createClientApi(token ?? undefined);
  const { cart } = useCart();
  const summary = cart?.summary;

  const [form, setForm] = useState({
    label: 'HOME',
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
  });
  const [couponCode, setCouponCode] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const { data: addresses } = useQuery<Address[]>({
    queryKey: ['addresses'],
    queryFn: () => api('/auth/profile').then((u: { addresses: Address[] }) => u.addresses),
    enabled: !!token,
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const orderPayload: Record<string, unknown> = { couponCode: couponCode || undefined };

      if (selectedAddressId) {
        orderPayload.shippingAddressId = selectedAddressId;
      } else {
        orderPayload.shippingAddress = form;
      }

      const order = await api<Order>('/orders', { method: 'POST', body: JSON.stringify(orderPayload) });

      const checkout = await api<RazorpayCheckoutData>('/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id }),
      });

      return { order, checkout };
    },
    onSuccess: ({ order, checkout }) => {
      openRazorpay(checkout, order.id);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create order');
    },
  });

  function openRazorpay(checkout: RazorpayCheckoutData, orderId: string) {
    if (!window.Razorpay) {
      toast.error('Payment gateway not loaded. Please refresh.');
      return;
    }
    const rzp = new window.Razorpay({
      key: checkout.key,
      amount: checkout.amount,
      currency: checkout.currency,
      order_id: checkout.rzpOrderId,
      name: 'lagaao.com',
      description: `Order #${checkout.orderNumber}`,
      prefill: { name: form.fullName, contact: form.phone },
      theme: { color: '#16a34a' },
      handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        try {
          await api('/payments/verify', {
            method: 'POST',
            body: JSON.stringify({
              orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          toast.success('Payment successful!');
          router.push(`/orders/${orderId}`);
        } catch {
          toast.error('Payment verification failed. Contact support.');
        }
      },
    });
    rzp.open();
  }

  if (!cart || (cart.items?.length ?? 0) === 0) {
    router.replace('/cart');
    return null;
  }

  return (
    <>
      {/* Razorpay SDK */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div className="container mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-forest-900 mb-6">Checkout</h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* Saved addresses */}
            {addresses && addresses.length > 0 && (
              <div className="rounded-2xl border border-forest-100 bg-white p-5 space-y-3">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><MapPin className="h-4 w-4 text-forest-600" /> Saved addresses</h2>
                <div className="grid gap-2">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${selectedAddressId === addr.id ? 'border-forest-600 bg-forest-50' : 'border-forest-100 hover:border-forest-300'}`}
                    >
                      <input
                        type="radio"
                        name="address"
                        className="mt-0.5"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                      />
                      <div className="text-sm text-gray-700 leading-relaxed">
                        <p className="font-medium">{addr.fullName} · {addr.phone}</p>
                        <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                        <p>{addr.city}, {addr.state} – {addr.pincode}</p>
                      </div>
                    </label>
                  ))}
                  <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${!selectedAddressId ? 'border-forest-600 bg-forest-50' : 'border-forest-100 hover:border-forest-300'}`}>
                    <input type="radio" name="address" checked={!selectedAddressId} onChange={() => setSelectedAddressId(null)} />
                    <span className="text-sm font-medium text-gray-700">Use a new address</span>
                  </label>
                </div>
              </div>
            )}

            {/* New address form */}
            {!selectedAddressId && (
              <div className="rounded-2xl border border-forest-100 bg-white p-5 space-y-4">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><MapPin className="h-4 w-4 text-forest-600" /> Delivery address</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Full name" value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} className="col-span-2 sm:col-span-1" />
                  <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="col-span-2 sm:col-span-1" />
                  <Input placeholder="Address line 1" value={form.line1} onChange={(e) => setForm(f => ({ ...f, line1: e.target.value }))} className="col-span-2" />
                  <Input placeholder="Address line 2 (optional)" value={form.line2} onChange={(e) => setForm(f => ({ ...f, line2: e.target.value }))} className="col-span-2" />
                  <Input placeholder="City" value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} />
                  <Input placeholder="State" value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} />
                  <Input placeholder="Pincode" value={form.pincode} onChange={(e) => setForm(f => ({ ...f, pincode: e.target.value }))} />
                </div>
              </div>
            )}

            {/* Coupon */}
            <div className="rounded-2xl border border-forest-100 bg-white p-5 space-y-3">
              <h2 className="font-semibold text-gray-800">Coupon code</h2>
              <div className="flex gap-2">
                <Input placeholder="Enter coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} />
              </div>
            </div>
          </div>

          {/* Order summary */}
          {summary && (
            <div className="h-fit rounded-2xl border border-forest-100 bg-white p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">Order summary</h2>
              <div className="space-y-2 text-sm">
                {cart.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-gray-600">
                    <span className="truncate max-w-[160px]">{item.product.name} × {item.quantity}</span>
                    <span>{formatPrice(Number(item.product.price) * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t border-forest-100 pt-2 space-y-1.5">
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span>{summary.shipping === 0 ? 'Free' : formatPrice(summary.shipping)}</span>
                  </div>
                </div>
                <div className="border-t border-forest-100 pt-2 flex justify-between font-bold text-gray-900 text-base">
                  <span>Total</span>
                  <span>{formatPrice(summary.total)}</span>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                disabled={createOrderMutation.isPending}
                onClick={() => createOrderMutation.mutate()}
              >
                <CreditCard className="h-4 w-4" />
                {createOrderMutation.isPending ? 'Processing...' : `Pay ${formatPrice(summary.total)}`}
              </Button>
              <p className="text-xs text-center text-gray-400">Secured by Razorpay</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
