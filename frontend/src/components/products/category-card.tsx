import Link from 'next/link';
import type { Category } from '@/types';

const CATEGORY_EMOJI: Record<string, string> = {
  'indoor-plants': '🌿',
  'bonsai': '🌳',
  'money-plants': '🍀',
  'succulents': '🌵',
  'gifting-plants': '🎁',
};

const CATEGORY_BG: Record<string, string> = {
  'indoor-plants': 'from-forest-100 to-forest-200',
  'bonsai': 'from-sage-100 to-sage-200',
  'money-plants': 'from-emerald-100 to-emerald-200',
  'succulents': 'from-amber-100 to-amber-200',
  'gifting-plants': 'from-rose-100 to-rose-200',
};

interface CategoryCardProps {
  category: Category;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const emoji = CATEGORY_EMOJI[category.slug] ?? '🌱';
  const bg = CATEGORY_BG[category.slug] ?? 'from-forest-100 to-forest-200';

  return (
    <Link
      href={`/products?categorySlug=${category.slug}`}
      className={`group flex flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br ${bg} p-6 text-center transition-transform hover:-translate-y-1 hover:shadow-md`}
    >
      <span className="text-4xl transition-transform duration-300 group-hover:scale-110">{emoji}</span>
      <div>
        <p className="font-semibold text-gray-800">{category.name}</p>
        {category._count?.products !== undefined && (
          <p className="text-xs text-gray-500 mt-0.5">{category._count.products} plants</p>
        )}
      </div>
    </Link>
  );
}
