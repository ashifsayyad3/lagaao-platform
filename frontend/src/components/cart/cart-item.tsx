'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/use-cart';
import { formatPrice } from '@/lib/utils';
import type { CartItem as CartItemType } from '@/types';

interface CartItemProps {
  item: CartItemType;
}

export function CartItem({ item }: CartItemProps) {
  const { updateItem, removeItem, isUpdatingItem, isRemovingItem } = useCart();
  const image = item.product.images?.[0]?.url;

  return (
    <div className="flex gap-4 py-4">
      <Link href={`/products/${item.product.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-forest-50">
        {image ? (
          <Image src={image} alt={item.product.name} fill className="object-cover" sizes="80px" />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl">🌿</div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <Link href={`/products/${item.product.slug}`} className="text-sm font-semibold text-gray-800 hover:text-forest-700 line-clamp-2">
          {item.product.name}
        </Link>
        <p className="text-sm font-bold text-forest-700">{formatPrice(Number(item.product.price))}</p>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 rounded-full"
              disabled={isUpdatingItem || item.quantity <= 1}
              onClick={() => updateItem({ cartItemId: item.id, quantity: item.quantity - 1 })}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 rounded-full"
              disabled={isUpdatingItem || item.quantity >= item.product.stock}
              onClick={() => updateItem({ cartItemId: item.id, quantity: item.quantity + 1 })}
              aria-label="Increase quantity"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">
              {formatPrice(Number(item.product.price) * item.quantity)}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
              disabled={isRemovingItem}
              onClick={() => removeItem(item.id)}
              aria-label="Remove item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
