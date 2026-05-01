import Link from 'next/link';
import { ArrowRight, Leaf, Truck, Shield, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/products/product-card';
import { CategoryCard } from '@/components/products/category-card';
import { serverApi } from '@/lib/api';
import type { PaginatedResponse, Product, Category } from '@/types';

async function getFeaturedProducts(): Promise<Product[]> {
  try {
    const res = await serverApi<PaginatedResponse<Product>>('/products?isFeatured=true&limit=8');
    return res.data;
  } catch {
    return [];
  }
}

async function getCategories(): Promise<Category[]> {
  try {
    const res = await serverApi<{ data: Category[] }>('/categories');
    return res.data;
  } catch {
    return [];
  }
}

const PERKS = [
  { icon: Truck, title: 'Free Delivery', desc: 'On orders above ₹499' },
  { icon: Leaf, title: 'Healthy Plants', desc: 'Expert-curated, fresh stock' },
  { icon: Shield, title: 'Quality Assured', desc: '7-day plant guarantee' },
  { icon: RefreshCw, title: 'Easy Returns', desc: 'Hassle-free replacements' },
];

export default async function HomePage() {
  const [products, categories] = await Promise.all([getFeaturedProducts(), getCategories()]);

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-forest-50 via-cream-50 to-sage-50 py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-3 py-1 text-xs font-semibold text-forest-700 mb-6">
            <Leaf className="h-3.5 w-3.5" /> Premium plants, delivered fresh
          </span>
          <h1 className="font-display text-4xl font-bold text-forest-900 sm:text-5xl md:text-6xl leading-tight mb-6">
            Bring nature<br className="hidden sm:block" /> into your home
          </h1>
          <p className="mx-auto max-w-xl text-lg text-gray-600 mb-8">
            Discover hand-picked indoor plants, bonsai, succulents and more — lovingly packed and delivered right to your doorstep.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg">
              <Link href="/products">Shop all plants <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/products?isFeatured=true">Featured picks</Link>
            </Button>
          </div>
        </div>

        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-forest-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-sage-200/30 blur-3xl" />
      </section>

      {/* Perks */}
      <section className="border-y border-forest-100 bg-white py-8">
        <div className="container mx-auto px-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {PERKS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-50">
                <Icon className="h-5 w-5 text-forest-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{title}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="py-14">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-2xl font-bold text-forest-900 mb-6">Shop by category</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {categories.map((cat) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured products */}
      {products.length > 0 && (
        <section className="py-14 bg-forest-50/50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl font-bold text-forest-900">Featured plants</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/products?isFeatured=true">View all <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 bg-forest-900 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold mb-3">Not sure where to start?</h2>
          <p className="text-forest-300 mb-8 max-w-md mx-auto">Browse our full collection of indoor and outdoor plants — filtered by care level, size, and price.</p>
          <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-forest-900">
            <Link href="/products">Explore all plants</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
