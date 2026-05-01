'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/use-cart';
import { formatPrice, discountPercent } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem, isAddingItem } = useCart();

  const primaryImage = product.images?.[0]?.url;
  const discount = product.comparePrice
    ? discountPercent(Number(product.comparePrice), Number(product.price))
    : 0;

  return (
    <div className="group relative flex flex-col rounded-2xl border border-forest-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Image */}
      <Link href={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-forest-50">
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-forest-300">
            <span className="text-5xl">🌿</span>
          </div>
        )}
        {discount > 0 && (
          <Badge variant="destructive" className="absolute top-2 left-2">
            -{discount}%
          </Badge>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-500">Out of stock</span>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        {product.category && (
          <span className="text-[11px] font-medium uppercase tracking-wider text-forest-500">
            {product.category.name}
          </span>
        )}
        <Link href={`/products/${product.slug}`} className="text-sm font-semibold text-gray-800 leading-snug hover:text-forest-700 line-clamp-2">
          {product.name}
        </Link>

        {product.averageRating > 0 && (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs text-gray-500">{product.averageRating.toFixed(1)} ({product.reviewCount})</span>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div>
            <span className="text-base font-bold text-forest-700">{formatPrice(Number(product.price))}</span>
            {product.comparePrice && (
              <span className="ml-1.5 text-xs text-gray-400 line-through">{formatPrice(Number(product.comparePrice))}</span>
            )}
          </div>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0 rounded-full"
            disabled={product.stock === 0 || isAddingItem}
            onClick={() => addItem({ productId: product.id, quantity: 1 })}
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
