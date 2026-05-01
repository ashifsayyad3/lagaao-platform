import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard } from '@/components/products/product-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { serverApi } from '@/lib/api';
import type { PaginatedResponse, Product, Category } from '@/types';

interface SearchParams {
  categorySlug?: string;
  isFeatured?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: string;
  search?: string;
}

async function getProducts(params: SearchParams): Promise<PaginatedResponse<Product>> {
  const qs = new URLSearchParams();
  if (params.categorySlug) qs.set('categorySlug', params.categorySlug);
  if (params.isFeatured) qs.set('isFeatured', params.isFeatured);
  if (params.minPrice) qs.set('minPrice', params.minPrice);
  if (params.maxPrice) qs.set('maxPrice', params.maxPrice);
  if (params.page) qs.set('page', params.page);
  if (params.search) qs.set('search', params.search);
  qs.set('limit', '12');
  try {
    return await serverApi<PaginatedResponse<Product>>(`/products?${qs}`);
  } catch {
    return { data: [], total: 0, page: 1, limit: 12, totalPages: 0 };
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

const PRICE_RANGES = [
  { label: 'Under ₹299', min: '0', max: '299' },
  { label: '₹299 – ₹599', min: '299', max: '599' },
  { label: '₹599 – ₹999', min: '599', max: '999' },
  { label: 'Above ₹999', min: '999', max: '' },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [productsRes, categories] = await Promise.all([getProducts(params), getCategories()]);
  const { data: products, total, totalPages, page } = productsRes;
  const currentPage = Number(params.page ?? 1);

  function buildHref(overrides: Partial<SearchParams>) {
    const merged = { ...params, ...overrides };
    const qs = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => { if (v) qs.set(k, v); });
    return `/products?${qs}`;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">

        {/* Sidebar filters */}
        <aside className="w-full md:w-56 shrink-0 space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Category</h3>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/products"
                  className={`block text-sm px-2 py-1 rounded-md transition-colors ${!params.categorySlug ? 'bg-forest-50 text-forest-700 font-medium' : 'text-gray-600 hover:bg-forest-50'}`}
                >
                  All Plants
                </Link>
              </li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={buildHref({ categorySlug: cat.slug, page: '1' })}
                    className={`block text-sm px-2 py-1 rounded-md transition-colors ${params.categorySlug === cat.slug ? 'bg-forest-50 text-forest-700 font-medium' : 'text-gray-600 hover:bg-forest-50'}`}
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Price</h3>
            <ul className="space-y-1">
              {PRICE_RANGES.map((r) => {
                const active = params.minPrice === r.min && params.maxPrice === r.max;
                return (
                  <li key={r.label}>
                    <Link
                      href={buildHref({ minPrice: r.min, maxPrice: r.max, page: '1' })}
                      className={`block text-sm px-2 py-1 rounded-md transition-colors ${active ? 'bg-forest-50 text-forest-700 font-medium' : 'text-gray-600 hover:bg-forest-50'}`}
                    >
                      {r.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {(params.categorySlug || params.isFeatured || params.minPrice) && (
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/products">Clear filters</Link>
            </Button>
          )}
        </aside>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-forest-900">
                {params.categorySlug
                  ? categories.find((c) => c.slug === params.categorySlug)?.name ?? 'Plants'
                  : params.isFeatured
                  ? 'Featured Plants'
                  : 'All Plants'}
              </h1>
              <Badge variant="secondary">{total}</Badge>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <span className="text-5xl mb-4">🌱</span>
              <p className="text-gray-500">No plants found for these filters.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/products">Clear filters</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {currentPage > 1 && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={buildHref({ page: String(currentPage - 1) })}>
                        <ChevronLeft className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      asChild
                      variant={p === currentPage ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8"
                    >
                      <Link href={buildHref({ page: String(p) })}>{p}</Link>
                    </Button>
                  ))}
                  {currentPage < totalPages && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={buildHref({ page: String(currentPage + 1) })}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
