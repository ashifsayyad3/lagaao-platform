'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingCart, User, Leaf, Menu, X, Search, LogOut, Package } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/hooks/use-auth';
import { useTokenStore } from '@/store/token-store';
import { logoutAction } from '@/lib/auth';

const NAV_LINKS = [
  { href: '/products',                label: 'All Plants' },
  { href: '/products?categorySlug=indoor-plants',  label: 'Indoor Plants' },
  { href: '/products?categorySlug=bonsai',         label: 'Bonsai' },
  { href: '/products?categorySlug=succulents',     label: 'Succulents' },
  { href: '/products?categorySlug=gifting-plants', label: 'Gifting' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();
  const { itemCount } = useCart();
  const { user, isAuthenticated } = useAuth();
  const clearToken = useTokenStore((s) => s.clear);

  async function handleLogout() {
    clearToken();
    await logoutAction();
    toast.success('Signed out');
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-forest-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-600">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-xl font-bold text-forest-800">lagaao</span>
            <span className="text-xs text-forest-500 font-medium hidden sm:block">.com</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  pathname === l.href
                    ? 'bg-forest-50 text-forest-700'
                    : 'text-gray-600 hover:text-forest-700 hover:bg-forest-50',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <Link
              href="/products"
              className="p-2 text-gray-500 hover:text-forest-700 transition-colors rounded-md hover:bg-forest-50"
              aria-label="Search plants"
            >
              <Search className="h-5 w-5" />
            </Link>

            {/* Cart */}
            <Link
              href="/cart"
              className="relative p-2 text-gray-500 hover:text-forest-700 transition-colors rounded-md hover:bg-forest-50"
              aria-label={`Cart ${itemCount > 0 ? `(${itemCount} items)` : ''}`}
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-forest-600 text-[10px] font-bold text-white">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>

            {/* Auth */}
            {isAuthenticated ? (
              <div className="relative group hidden md:block">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-forest-50 transition-colors">
                  <User className="h-4 w-4 text-forest-600" />
                  <span className="max-w-[80px] truncate">{user?.firstName}</span>
                </button>
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-forest-100 bg-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 py-1">
                  <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-forest-50">
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <Link href="/orders" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-forest-50">
                    <Package className="h-4 w-4" /> My Orders
                  </Link>
                  <hr className="my-1 border-forest-100" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login" className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-forest-700 transition-colors">
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-1.5 rounded-full bg-forest-600 text-sm font-medium text-white hover:bg-forest-700 transition-colors"
                >
                  Get started
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden p-2 text-gray-500 hover:text-forest-700 transition-colors rounded-md"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-forest-100 bg-white px-4 py-3 space-y-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-forest-50"
            >
              {l.label}
            </Link>
          ))}
          <hr className="my-2 border-forest-100" />
          {isAuthenticated ? (
            <>
              <Link href="/profile" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-forest-50 rounded-md">Profile</Link>
              <Link href="/orders" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-forest-50 rounded-md">My Orders</Link>
              <button onClick={handleLogout} className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-forest-50 rounded-md">Sign in</Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm font-medium text-forest-700 hover:bg-forest-50 rounded-md">Get started</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
