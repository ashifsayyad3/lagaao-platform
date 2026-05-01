'use client';

import Link from 'next/link';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { CartItem } from '@/components/cart/cart-item';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/use-cart';
import { formatPrice } from '@/lib/utils';

export default function CartPage() {
  const { cart, isLoading } = useCart();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="animate-pulse space-y-4 max-w-2xl mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-forest-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const items = cart?.items ?? [];
  const summary = cart?.summary;

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <ShoppingBag className="mx-auto h-16 w-16 text-forest-200 mb-6" />
        <h1 className="font-display text-2xl font-bold text-forest-900 mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-8">Add some lovely plants to get started.</p>
        <Button asChild size="lg">
          <Link href="/products">Browse plants</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-forest-900 mb-6">Your cart</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-forest-100 bg-white divide-y divide-forest-50 px-4">
            {items.map((item) => (
              <CartItem key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div className="h-fit rounded-2xl border border-forest-100 bg-white p-5 space-y-3">
            <h2 className="font-semibold text-gray-800">Order summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(summary.subtotal)}</span>
              </div>
              {summary.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatPrice(summary.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>{summary.shipping === 0 ? <span className="text-emerald-600">Free</span> : formatPrice(summary.shipping)}</span>
              </div>
            </div>

            <div className="border-t border-forest-100 pt-3 flex justify-between font-bold text-gray-900">
              <span>Total</span>
              <span>{formatPrice(summary.total)}</span>
            </div>

            {summary.shipping > 0 && (
              <p className="text-xs text-gray-400">Add ₹{(499 - summary.subtotal).toFixed(0)} more for free delivery</p>
            )}

            <Button asChild size="lg" className="w-full mt-2">
              <Link href="/checkout">Proceed to checkout <ArrowRight className="h-4 w-4" /></Link>
            </Button>

            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/products">Continue shopping</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
