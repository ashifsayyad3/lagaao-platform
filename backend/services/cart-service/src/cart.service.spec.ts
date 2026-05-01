import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { PrismaService } from './prisma/prisma.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const userId = 'user-uuid-1';
const cartId = 'cart-uuid-1';
const itemId = 'item-uuid-1';
const productId = 'prod-uuid-1';

const mockProduct = {
  id: productId,
  name: 'Pothos Plant',
  slug: 'pothos-plant',
  price: '299.00',
  mrp: '399.00',
  stock: 10,
  isActive: true,
  images: [{ url: 'https://cdn.lagaao.com/pothos.jpg' }],
  category: { id: 'cat-1', name: 'Indoor Plants', slug: 'indoor-plants' },
};

const mockCartItem = {
  id: itemId,
  quantity: 2,
  product: mockProduct,
  createdAt: new Date(),
};

const mockRawCart = {
  id: cartId,
  updatedAt: new Date(),
  items: [mockCartItem],
};

const emptyRawCart = { id: cartId, updatedAt: new Date(), items: [] };

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockPrisma = {
  cart: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  cartItem: {
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findUnique: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CartService', () => {
  let service: CartService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    jest.clearAllMocks();
  });

  // ── getCart ────────────────────────────────────────────────────────────────

  describe('getCart', () => {
    it('returns existing cart with correct summary', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(mockRawCart);

      const result = await service.getCart(userId);

      expect(result.id).toBe(cartId);
      expect(result.items).toHaveLength(1);
      // price 299 × qty 2 = 598.00
      expect(result.summary.subtotal).toBe('598.00');
      // mrp 399 × 2 − 598 = 200.00 savings
      expect(result.summary.savings).toBe('200.00');
      // subtotal 598 ≥ 499 → free shipping
      expect(result.summary.shippingCharge).toBe('0.00');
      expect(result.summary.total).toBe('598.00');
    });

    it('creates a new cart when user has none', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);
      mockPrisma.cart.create.mockResolvedValue(emptyRawCart);

      const result = await service.getCart(userId);

      expect(mockPrisma.cart.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId } }),
      );
      expect(result.items).toHaveLength(0);
      expect(result.summary.total).toBe('0.00');
    });
  });

  // ── addItem ────────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('adds a new product to the cart', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, stock: 10 });
      mockPrisma.cart.findUnique.mockResolvedValue(emptyRawCart);
      mockPrisma.cartItem.upsert.mockResolvedValue({});
      mockPrisma.cart.update.mockResolvedValue({});
      mockPrisma.cart.findUniqueOrThrow.mockResolvedValue(mockRawCart);

      const result = await service.addItem(userId, { productId, quantity: 2 });

      expect(mockPrisma.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ quantity: 2 }),
          update: expect.objectContaining({ quantity: 2 }),
        }),
      );
      expect(result.items).toHaveLength(1);
    });

    it('merges quantities when product is already in cart', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, stock: 10 });
      // Cart already has qty 2
      mockPrisma.cart.findUnique.mockResolvedValue(mockRawCart);
      mockPrisma.cartItem.upsert.mockResolvedValue({});
      mockPrisma.cart.update.mockResolvedValue({});
      mockPrisma.cart.findUniqueOrThrow.mockResolvedValue(mockRawCart);

      await service.addItem(userId, { productId, quantity: 3 });

      // Should upsert with qty 2 (existing) + 3 (new) = 5
      expect(mockPrisma.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ quantity: 5 }),
        }),
      );
    });

    it('throws when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.addItem(userId, { productId, quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when product is out of stock', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, stock: 0 });

      await expect(
        service.addItem(userId, { productId, quantity: 1 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws when requested quantity exceeds available stock', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, stock: 3 });

      await expect(
        service.addItem(userId, { productId, quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── updateItem ─────────────────────────────────────────────────────────────

  describe('updateItem', () => {
    it('updates the item quantity', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        id: itemId,
        cartId,
        productId,
        cart: { userId },
      });
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, stock: 10 });
      mockPrisma.cartItem.update.mockResolvedValue({});
      mockPrisma.cart.update.mockResolvedValue({});
      mockPrisma.cart.findUniqueOrThrow.mockResolvedValue(mockRawCart);

      const result = await service.updateItem(userId, itemId, { quantity: 4 });

      expect(mockPrisma.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: 4 } }),
      );
      expect(result).toBeDefined();
    });

    it('throws when item belongs to a different user', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        id: itemId,
        cartId,
        productId,
        cart: { userId: 'other-user' },
      });

      await expect(
        service.updateItem(userId, itemId, { quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── removeItem ─────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('removes the item and returns updated cart', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        id: itemId,
        cartId,
        productId,
        cart: { userId },
      });
      mockPrisma.cartItem.delete.mockResolvedValue({});
      mockPrisma.cart.update.mockResolvedValue({});
      mockPrisma.cart.findUniqueOrThrow.mockResolvedValue(emptyRawCart);

      const result = await service.removeItem(userId, itemId);

      expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: itemId } });
      expect(result.items).toHaveLength(0);
    });
  });

  // ── clearCart ──────────────────────────────────────────────────────────────

  describe('clearCart', () => {
    it('deletes all items', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({ id: cartId });
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.cart.update.mockResolvedValue({});

      const result = await service.clearCart(userId);

      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId } });
      expect(result.message).toMatch(/cleared/i);
    });

    it('returns gracefully when cart does not exist', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);

      const result = await service.clearCart(userId);
      expect(result.message).toMatch(/already empty/i);
      expect(mockPrisma.cartItem.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ── Summary calculation ────────────────────────────────────────────────────

  describe('summary totals', () => {
    it('applies flat shipping when subtotal is below ₹499', async () => {
      const cheapCart = {
        ...emptyRawCart,
        items: [{
          id: itemId,
          quantity: 1,
          product: { ...mockProduct, price: '199.00', mrp: '250.00' },
          createdAt: new Date(),
        }],
      };
      mockPrisma.cart.findUnique.mockResolvedValue(cheapCart);

      const result = await service.getCart(userId);

      // subtotal 199 < 499 → ₹49 shipping
      expect(result.summary.shippingCharge).toBe('49.00');
      expect(result.summary.total).toBe('248.00');
    });

    it('gives free shipping at exactly ₹499', async () => {
      const borderCart = {
        ...emptyRawCart,
        items: [{
          id: itemId,
          quantity: 1,
          product: { ...mockProduct, price: '499.00', mrp: '599.00' },
          createdAt: new Date(),
        }],
      };
      mockPrisma.cart.findUnique.mockResolvedValue(borderCart);

      const result = await service.getCart(userId);

      expect(result.summary.shippingCharge).toBe('0.00');
      expect(result.summary.total).toBe('499.00');
    });

    it('calculates correct savings percentage', async () => {
      // mrp=500, price=400, savings=100, 20%
      const cart = {
        ...emptyRawCart,
        items: [{
          id: itemId,
          quantity: 1,
          product: { ...mockProduct, price: '400.00', mrp: '500.00' },
          createdAt: new Date(),
        }],
      };
      mockPrisma.cart.findUnique.mockResolvedValue(cart);

      const result = await service.getCart(userId);

      expect(result.summary.savings).toBe('100.00');
      expect(result.summary.savingsPercent).toBe(20);
    });
  });
});
