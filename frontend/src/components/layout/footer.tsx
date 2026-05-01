import Link from 'next/link';
import { Leaf, Instagram, Twitter, Facebook, Mail, Phone, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-forest-950 text-forest-200">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-600">
                <Leaf className="h-4 w-4 text-white" />
              </div>
              <span className="font-display text-xl font-bold text-white">lagaao.com</span>
            </div>
            <p className="text-sm text-forest-400 leading-relaxed">
              Bringing nature into every home. Premium plants, lovingly packed and delivered fresh.
            </p>
            <div className="flex gap-3">
              {[Instagram, Twitter, Facebook].map((Icon, i) => (
                <a key={i} href="#" className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-800 text-forest-400 hover:bg-forest-600 hover:text-white transition-colors">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-forest-400">Shop</h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: '/products?categorySlug=indoor-plants',  label: 'Indoor Plants' },
                { href: '/products?categorySlug=bonsai',         label: 'Bonsai' },
                { href: '/products?categorySlug=money-plants',   label: 'Money Plants' },
                { href: '/products?categorySlug=succulents',     label: 'Succulents' },
                { href: '/products?categorySlug=gifting-plants', label: 'Gifting Plants' },
                { href: '/products?isFeatured=true',             label: 'Featured' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-forest-300 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-forest-400">Help</h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: '/orders', label: 'Track Order' },
                { href: '/profile', label: 'My Account' },
                { href: '/cart', label: 'Shopping Cart' },
                { href: '#', label: 'Return Policy' },
                { href: '#', label: 'Plant Care Guide' },
                { href: '#', label: 'FAQ' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-forest-300 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-forest-400">Contact</h3>
            <ul className="space-y-3 text-sm text-forest-300">
              <li className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 text-forest-500 shrink-0" />
                <a href="mailto:hello@lagaao.com" className="hover:text-white transition-colors">hello@lagaao.com</a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 text-forest-500 shrink-0" />
                <a href="tel:+918000000000" className="hover:text-white transition-colors">+91 80000 00000</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-forest-500 shrink-0" />
                <span>Mumbai, Maharashtra, India</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-forest-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-forest-500">
          <p>© {new Date().getFullYear()} lagaao.com · All rights reserved</p>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
