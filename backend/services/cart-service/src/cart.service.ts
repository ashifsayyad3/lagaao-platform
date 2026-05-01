import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from './prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartSummary {
  itemCount: number;         // total number of distinct products
  totalQty: number;          // sum of all quantities
  subtotal: string;          // INR, 2 decimal places
  savings: string;           // MRP total − price total
  savingsPercent: number;    // rounded to 1 dp
  shippingCharge: string;    // FREE above threshold, else flat ₹49
  total: string;
}

interface CartResponse {
  id: string;
  items: CartItemDetail[];
  summary: CartSummary;
  updatedAt: Date;
}

interface CartItemDetail {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: string;
    mrp: string;
    stock: number;
    isActive: boolean;
    image: string | null;
    category: { id: string; name: string; slug: string };
  };
  lineTotal: string;       // price × quantity
  lineSavings: string;     // (mrp − price) × quantity
  isAvailable: boolean;    // false when product is inactive or stock < quantity
  availabilityNote: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FREE_SHIPPING_THRESHOLD = 499;   // INR
const FLAT_SHIPPING_CHARGE     = 49;   // INR
const MAX_CART_ITEMS           = 20;   // distinct products per cart

// Prisma select reused in every cart fetch
const CART_SELECT = {
  id: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      quantity: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          mrp: true,
          stock: true,
          isActive: true,
          images: {
            where: { isPrimary: true },
            select: { url: true },
            take: 1,
          },
          category: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.CartSelect;

type RawCart = Prisma.CartGetPayload<{ select: typeof CART_SELECT }>;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Get cart ───────────────────────────────────────────────────────────────

  async getCart(userId: string): Promise<CartResponse> {
    const cart = await this.findOrCreateCart(userId);
    return this.formatCart(cart);
  }

  // ── Add item ───────────────────────────────────────────────────────────────

  async addItem(userId: string, dto: AddToCartDto): Promise<CartResponse> {
    const product = await this.assertProductAvailable(dto.productId, dto.quantity);

    const cart = await this.findOrCreateCart(userId);

    // Check distinct item cap before adding a new product
    const alreadyInCart = cart.items.some((i) => i.product.id === dto.productId);
    if (!alreadyInCart && cart.items.length >= MAX_CART_ITEMS) {
      throw new UnprocessableEntityException(
        `Cart cannot hold more than ${MAX_CART_ITEMS} different products`,
      );
    }

    // If the product is already in cart, add to the existing quantity
    const existingItem = cart.items.find((i) => i.product.id === dto.productId);
    const newQty = (existingItem?.quantity ?? 0) + dto.quantity;

    if (newQty > product.stock) {
      throw new BadRequestException(
        `Only ${product.stock} unit(s) available. You already have ${existingItem?.quantity ?? 0} in your cart.`,
      );
    }

    if (newQty > 99) {
      throw new BadRequestException('Cannot have more than 99 units of a single item in the cart');
    }

    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
      create: { cartId: cart.id, productId: dto.productId, quantity: newQty },
      update: { quantity: newQty },
    });

    // Touch cart.updatedAt so the frontend can use it as a cache key
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    this.logger.debug(`User ${userId}: added ${dto.quantity}× product ${dto.productId}`);

    const updated = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cart.id },
      select: CART_SELECT,
    });
    return this.formatCart(updated);
  }

  // ── Update item quantity ───────────────────────────────────────────────────

  async updateItem(userId: string, itemId: string, dto: UpdateCartDto): Promise<CartResponse> {
    const item = await this.assertCartItemOwnership(userId, itemId);

    const product = await this.prisma.product.findUnique({
      where: { id: item.productId },
      select: { stock: true, isActive: true, name: true },
    });

    if (!product || !product.isActive) {
      throw new UnprocessableEntityException('This product is no longer available');
    }

    if (dto.quantity > product.stock) {
      throw new BadRequestException(
        `Only ${product.stock} unit(s) of "${product.name}" are available`,
      );
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    await this.prisma.cart.update({
      where: { id: item.cartId },
      data: { updatedAt: new Date() },
    });

    this.logger.debug(`User ${userId}: updated item ${itemId} → qty ${dto.quantity}`);

    const updated = await this.prisma.cart.findUniqueOrThrow({
      where: { id: item.cartId },
      select: CART_SELECT,
    });
    return this.formatCart(updated);
  }

  // ── Remove single item ─────────────────────────────────────────────────────

  async removeItem(userId: string, itemId: string): Promise<CartResponse> {
    const item = await this.assertCartItemOwnership(userId, itemId);

    await this.prisma.cartItem.delete({ where: { id: itemId } });

    await this.prisma.cart.update({
      where: { id: item.cartId },
      data: { updatedAt: new Date() },
    });

    this.logger.debug(`User ${userId}: removed item ${itemId}`);

    const updated = await this.prisma.cart.findUniqueOrThrow({
      where: { id: item.cartId },
      select: CART_SELECT,
    });
    return this.formatCart(updated);
  }

  // ── Clear entire cart ──────────────────────────────────────────────────────

  async clearCart(userId: string): Promise<{ message: string }> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) return { message: 'Cart is already empty' };

    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    this.logger.debug(`User ${userId}: cart cleared`);
    return { message: 'Cart cleared successfully' };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async findOrCreateCart(userId: string): Promise<RawCart> {
    const existing = await this.prisma.cart.findUnique({
      where: { userId },
      select: CART_SELECT,
    });
    if (existing) return existing;

    return this.prisma.cart.create({
      data: { userId },
      select: CART_SELECT,
    });
  }

  private async assertProductAvailable(productId: string, requestedQty: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true, stock: true, isActive: true },
    });

    if (!product) throw new NotFoundException(`Product "${productId}" not found`);
    if (!product.isActive) throw new UnprocessableEntityException(`"${product.name}" is no longer available`);
    if (product.stock === 0) throw new UnprocessableEntityException(`"${product.name}" is out of stock`);
    if (product.stock < requestedQty) {
      throw new BadRequestException(
        `Only ${product.stock} unit(s) of "${product.name}" are available`,
      );
    }

    return product;
  }

  private async assertCartItemOwnership(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      select: { id: true, cartId: true, productId: true, cart: { select: { userId: true } } },
    });

    if (!item) throw new NotFoundException(`Cart item "${itemId}" not found`);

    if (item.cart.userId !== userId) {
      // Return 404 instead of 403 — never confirm a resource belongs to another user
      throw new NotFoundException(`Cart item "${itemId}" not found`);
    }

    return item;
  }

  private formatCart(cart: RawCart): CartResponse {
    const items: CartItemDetail[] = cart.items.map((item) => {
      const price    = new Decimal(item.product.price);
      const mrp      = new Decimal(item.product.mrp);
      const qty      = item.quantity;
      const lineTotal    = price.mul(qty);
      const lineMrpTotal = mrp.mul(qty);
      const lineSavings  = lineMrpTotal.sub(lineTotal);

      const isActive   = item.product.isActive;
      const hasStock   = item.product.stock >= qty;
      const isAvailable = isActive && hasStock;

      let availabilityNote: string | null = null;
      if (!isActive) availabilityNote = 'This product is no longer available';
      else if (item.product.stock === 0) availabilityNote = 'Out of stock';
      else if (!hasStock) availabilityNote = `Only ${item.product.stock} unit(s) left`;

      return {
        id: item.id,
        quantity: qty,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: price.toFixed(2),
          mrp: mrp.toFixed(2),
          stock: item.product.stock,
          isActive: item.product.isActive,
          image: item.product.images[0]?.url ?? null,
          category: item.product.category,
        },
        lineTotal: lineTotal.toFixed(2),
        lineSavings: lineSavings.toFixed(2),
        isAvailable,
        availabilityNote,
      };
    });

    const summary = this.calculateSummary(items);

    return { id: cart.id, items, summary, updatedAt: cart.updatedAt };
  }

  private calculateSummary(items: CartItemDetail[]): CartSummary {
    let subtotal = new Decimal(0);
    let mrpTotal = new Decimal(0);
    let totalQty = 0;

    for (const item of items) {
      // Only count available items toward the payable total
      if (item.isAvailable) {
        subtotal = subtotal.add(new Decimal(item.lineTotal));
        mrpTotal = mrpTotal.add(
          new Decimal(item.product.mrp).mul(item.quantity),
        );
      }
      totalQty += item.quantity;
    }

    const savings        = mrpTotal.sub(subtotal);
    const savingsPercent = mrpTotal.gt(0)
      ? Number(savings.div(mrpTotal).mul(100).toFixed(1))
      : 0;

    const isFreeShipping = subtotal.gte(FREE_SHIPPING_THRESHOLD);
    const shippingCharge = isFreeShipping || subtotal.eq(0)
      ? new Decimal(0)
      : new Decimal(FLAT_SHIPPING_CHARGE);

    const total = subtotal.add(shippingCharge);

    return {
      itemCount: items.length,
      totalQty,
      subtotal: subtotal.toFixed(2),
      savings: savings.toFixed(2),
      savingsPercent,
      shippingCharge: shippingCharge.toFixed(2),
      total: total.toFixed(2),
    };
  }
}
