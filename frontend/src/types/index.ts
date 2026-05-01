// ── Common ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CUSTOMER';

export interface User {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  isVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  addresses: Address[];
}

// ── Address ───────────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

// ── Category ──────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
  parentId?: string;
  parent?: Pick<Category, 'id' | 'name' | 'slug'>;
  children?: Pick<Category, 'id' | 'name' | 'slug' | 'imageUrl' | 'sortOrder'>[];
  _count?: { products: number };
}

// ── Product ───────────────────────────────────────────────────────────────────

export interface ProductImage {
  id: string;
  url: string;
  altText?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  shortDesc?: string;
  description?: string;
  sku?: string;
  price: string | number;
  comparePrice?: string | number;
  stock: number;
  isActive: boolean;
  isFeatured: boolean;
  tags?: string;
  category?: Pick<Category, 'id' | 'name' | 'slug'>;
  images?: ProductImage[];
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt?: string;
}

// ── Review ────────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  rating: number;
  title?: string;
  body?: string;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  user: { firstName: string; lastName?: string; avatarUrl?: string };
}

// ── Cart ──────────────────────────────────────────────────────────────────────

export interface CartItemProduct {
  id: string;
  name: string;
  slug: string;
  price: string | number;
  comparePrice?: string | number;
  stock: number;
  isActive: boolean;
  images?: ProductImage[];
  category?: Pick<Category, 'id' | 'name' | 'slug'>;
}

export interface CartItem {
  id: string;
  quantity: number;
  product: CartItemProduct;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  summary: CartSummary;
  updatedAt: string;
}

// ── Order ─────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'PACKED'
  | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED'
  | 'CANCELLED' | 'REFUND_INITIATED' | 'REFUNDED';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku?: string;
  productImage?: string;
  quantity: number;
  price: string | number;
}

export interface OrderStatusHistory {
  id: string;
  status: OrderStatus;
  note?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: string | number;
  shippingCost: string | number;
  discount: string | number;
  total: string | number;
  notes?: string;
  couponCode?: string;
  shippingAddress?: Address;
  items?: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

// ── Payment ───────────────────────────────────────────────────────────────────

export interface RazorpayCheckoutData {
  rzpOrderId: string;
  amount: number;
  currency: string;
  key: string;
  orderNumber: string;
}
