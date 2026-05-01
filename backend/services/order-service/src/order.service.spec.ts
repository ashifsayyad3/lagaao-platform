import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, UserRole } from '@prisma/client';
import { OrderService } from './order.service';
import { PrismaService } from './prisma/prisma.service';
import { JwtPayload } from './common/jwt.strategy';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const userId    = 'user-uuid-1';
const orderId   = 'order-uuid-1';
const productId = 'prod-uuid-1';
const addressId = 'addr-uuid-1';
const cartId    = 'cart-uuid-1';

const adminUser: JwtPayload = { sub: 'admin-uuid', email: 'admin@lagaao.com', role: UserRole.ADMIN };

const mockAddress = {
  id: addressId, userId,
  fullName: 'Rahul Sharma', phone: '9876543210',
  line1: '123 Main St', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India',
};

const mockCartItem = {
  product: {
    id: productId, name: 'Pothos Plant', sku: 'PLT-001',
    price: '299.00', stock: 10, isActive: true,
    images: [{ url: 'https://cdn.lagaao.com/pothos.jpg' }],
  },
  quantity: 2,
};

const mockCart = { id: cartId, items: [mockCartItem] };

const mockOrder = {
  id: orderId,
  orderNumber: 'LG-20240601-0001',
  userId,
  status: OrderStatus.PENDING,
  subtotal: '598.00',
  shippingCharge: '0.00',
  taxAmount: '0.00',
  discountAmount: '0.00',
  total: '598.00',
  items: [{ productId, quantity: 2 }],
  statusHistory: [],
  payment: null,
  address: mockAddress,
  coupon: null,
  _count: { items: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockPrisma = {
  cart: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  order: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  address: { findFirst: jest.fn() },
  product: { update: jest.fn() },
  coupon: { findUnique: jest.fn(), update: jest.fn() },
  couponUsage: { create: jest.fn() },
  cartItem: { deleteMany: jest.fn() },
  $transaction: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    jest.clearAllMocks();
  });

  // ── createOrder ────────────────────────────────────────────────────────────

  describe('createOrder', () => {
    it('creates an order and clears the cart', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(mockCart);
      mockPrisma.address.findFirst.mockResolvedValue(mockAddress);
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
        fn(mockPrisma),
      );
      mockPrisma.order.create.mockResolvedValue(mockOrder);
      mockPrisma.product.update.mockResolvedValue({});
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.cart.update.mockResolvedValue({});

      const result = await service.createOrder(userId, { addressId });

      expect(result.orderNumber).toMatch(/^LG-\d{8}-\d{4}$/);
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId } });
    });

    it('throws when cart is empty', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue({ id: cartId, items: [] });

      await expect(
        service.createOrder(userId, { addressId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when cart does not exist', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder(userId, { addressId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when address does not belong to user', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(mockCart);
      mockPrisma.address.findFirst.mockResolvedValue(null);

      await expect(
        service.createOrder(userId, { addressId: 'wrong-addr' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws with aggregated errors when items are out of stock', async () => {
      const oosCart = {
        id: cartId,
        items: [{ ...mockCartItem, product: { ...mockCartItem.product, stock: 0 } }],
      };
      mockPrisma.cart.findUnique.mockResolvedValue(oosCart);
      mockPrisma.address.findFirst.mockResolvedValue(mockAddress);

      await expect(
        service.createOrder(userId, { addressId }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ── findUserOrders ─────────────────────────────────────────────────────────

  describe('findUserOrders', () => {
    it('returns paginated orders', async () => {
      mockPrisma.$transaction.mockResolvedValue([[mockOrder], 1]);

      const result = await service.findUserOrders(userId, { page: 1, limit: 10, skip: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  // ── cancelOrder ────────────────────────────────────────────────────────────

  describe('cancelOrder', () => {
    it('cancels a PENDING order and restores stock', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
        fn(mockPrisma),
      );
      mockPrisma.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.CANCELLED });
      mockPrisma.product.update.mockResolvedValue({});

      const result = await service.cancelOrder(userId, orderId, { reason: 'Changed my mind' });

      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stock: { increment: 2 } } }),
      );
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('throws when order is already SHIPPED', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ ...mockOrder, status: OrderStatus.SHIPPED });

      await expect(
        service.cancelOrder(userId, orderId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when order does not belong to user', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelOrder(userId, 'other-order', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateOrderStatus (admin) ──────────────────────────────────────────────

  describe('updateOrderStatus', () => {
    it('transitions PENDING → CONFIRMED', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
        fn(mockPrisma),
      );
      mockPrisma.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.CONFIRMED });

      const result = await service.updateOrderStatus(adminUser, orderId, {
        status: OrderStatus.CONFIRMED,
        note: 'Payment verified',
      });

      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });

    it('rejects invalid transition PENDING → DELIVERED', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.updateOrderStatus(adminUser, orderId, { status: OrderStatus.DELIVERED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus(adminUser, 'bad-id', { status: OrderStatus.CONFIRMED }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
