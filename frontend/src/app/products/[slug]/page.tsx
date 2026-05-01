'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ShoppingCart, ArrowLeft, Star, Minus, Plus, Truck, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/use-cart';
import { useTokenStore } from '@/store/token-store';
import { createClientApi } from '@/lib/api';
import { formatPrice, discountPercent } from '@/lib/utils';
import type { Product } from '@/types';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const token = useTokenStore((s) => s.token);
  const { addItem, isAddingItem } = useCart();
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const { data: product, isLoading, isError } = useQuery<Product>({
    queryKey: ['product', slug],
    queryFn: async () => {
      const api = createClientApi(token ?? undefined);
      return api<Product>(`/products/${slug}`);
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-forest-100 rounded w-64 mx-auto" />
          <div className="h-96 bg-forest-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <p className="text-gray-500 mb-4">Plant not found.</p>
        <Button asChild variant="outline"><Link href="/products">Back to shop</Link></Button>
      </div>
    );
  }

  const discount = product.comparePrice
    ? discountPercent(Number(product.comparePrice), Number(product.price))
    : 0;
  const images = product.images ?? [];
  const primaryImage = images[activeImage]?.url;

  function handleAddToCart() {
    if (!token) { router.push('/login'); return; }
    addItem({ productId: product!.id, quantity: qty });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link href="/products"><ArrowLeft className="h-4 w-4" /> Back to shop</Link>
      </Button>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:gap-16">
        {/* Images */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-forest-50">
            {primaryImage ? (
              <Image src={primaryImage} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl">🌿</div>
            )}
            {discount > 0 && (
              <Badge variant="destructive" className="absolute top-3 left-3">-{discount}%</Badge>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${i === activeImage ? 'border-forest-600' : 'border-transparent'}`}
                >
                  <Image src={img.url} alt={`${product.name} ${i + 1}`} fill className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-5">
          {product.category && (
            <Link href={`/products?categorySlug=${product.category.slug}`} className="text-xs font-semibold uppercase tracking-wider text-forest-600 hover:text-forest-700">
              {product.category.name}
            </Link>
          )}
          <h1 className="font-display text-3xl font-bold text-forest-900 leading-tight">{product.name}</h1>

          {product.averageRating > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`h-4 w-4 ${s <= Math.round(product.averageRating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                ))}
              </div>
              <span className="text-sm text-gray-500">{product.averageRating.toFixed(1)} ({product.reviewCount} reviews)</span>
            </div>
          )}

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-forest-700">{formatPrice(Number(product.price))}</span>
            {product.comparePrice && (
              <span className="text-lg text-gray-400 line-through">{formatPrice(Number(product.comparePrice))}</span>
            )}
          </div>

          {product.description && (
            <p className="text-gray-600 leading-relaxed text-sm">{product.description}</p>
          )}

          {/* Qty + Add to cart */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-8 text-center font-semibold">{qty}</span>
              <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => setQty(q => Math.min(product.stock, q + 1))} disabled={qty >= product.stock}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-gray-400">{product.stock} in stock</span>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={product.stock === 0 || isAddingItem}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-4 w-4" />
              {product.stock === 0 ? 'Out of stock' : 'Add to cart'}
            </Button>
          </div>

          {/* Assurances */}
          <div className="rounded-xl border border-forest-100 bg-forest-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-forest-700">
              <Truck className="h-4 w-4 shrink-0" /> Free delivery on orders above ₹499
            </div>
            <div className="flex items-center gap-2 text-sm text-forest-700">
              <Shield className="h-4 w-4 shrink-0" /> 7-day healthy plant guarantee
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
