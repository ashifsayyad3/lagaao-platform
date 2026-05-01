import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import { PaymentService } from './payment.service';
import { PrismaService } from './prisma/prisma.service';
import { RAZORPAY_CLIENT } from './razorpay/razorpay.provider';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const userId    = 'user-uuid-1';
const orderId   = 'order-uuid-1';
const paymentId = 'pay-uuid-1';

const RZP_KEY_SECRET  = 'test_razorpay_secret';
const RZP_KEY_ID      = 'rzp_test_key_id';
const RZP_ORDER_ID    = 'order_abc123';
const RZP_PAYMENT_ID  = 'pay_xyz789';

const validSignature = crypto
  .createHmac('sha256', RZP_KEY_SECRET)
  .update(`${RZP_ORDER_ID}|${RZP_PAYMENT_ID}`)
  .digest('hex');

const mockOrder = {
  id: orderId,
  orderNumber: 'LG-20240601-0001',
  status: OrderStatus.PENDING,
  total: '598.00',
  payment: null,
  user: { email: 'rahul@example.com', firstName: 'Rahul', phone: '9876543210' },
};

const mockPaymentRecord = {
  id: paymentId,
  orderId,
  status: PaymentStatus.PENDING,
  amount: '598.00',
  rzpOrderId: RZP_ORDER_ID,
  order: { userId, orderNumber: 'LG-20240601-0001', status: OrderStatus.PENDING },
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  order: { findFirst: jest.fn(), update: jest.fn() },
  payment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockRazorpay = {
  orders: { create: jest.fn() },
};

const mockConfig = {
  getOrThrow: jest.fn((key: string) => {
    const map: Record<string, string> = {
      RAZORPAY_KEY_SECRET:  RZP_KEY_SECRET,
      RAZORPAY_KEY_ID:      RZP_KEY_ID,
      RAZORPAY_WEBHOOK_SECRET: 'webhook_secret',
    };
    return map[key] ?? '';
  }),
  get: jest.fn((key: string, fallback: unknown) => fallback),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RAZORPAY_CLIENT, useValue: mockRazorpay },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    jest.clearAllMocks();
  });

  // ── createOrder ────────────────────────────────────────────────────────────

  describe('createOrder', () => {
    it('creates a Razorpay order and persists payment record', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockRazorpay.orders.create.mockResolvedValue({
        id: RZP_ORDER_ID,
        amount: 59800,
        currency: 'INR',
        receipt: 'LG-20240601-0001',
      });
      mockPrisma.payment.upsert.mockResolvedValue({});

      const result = await service.createOrder(userId, {
        orderId,
        method: PaymentMethod.RAZORPAY_UPI,
      });

      expect(mockRazorpay.orders.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 59800, currency: 'INR' }),
      );
      expect(result.rzpOrderId).toBe(RZP_ORDER_ID);
      expect(result.amount).toBe(59800);
      expect(result.keyId).toBe(RZP_KEY_ID);
      expect(result.prefill.email).toBe('rahul@example.com');
    });

    it('returns existing rzpOrderId when payment is already PENDING (retry)', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...mockOrder,
        payment: {
          id: paymentId,
          status: PaymentStatus.PENDING,
          rzpOrderId: RZP_ORDER_ID,
        },
      });

      const result = await service.createOrder(userId, { orderId });

      expect(mockRazorpay.orders.create).not.toHaveBeenCalled();
      expect(result.rzpOrderId).toBe(RZP_ORDER_ID);
    });

    it('throws ConflictException when payment is already CAPTURED', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
        payment: { id: paymentId, status: PaymentStatus.CAPTURED, rzpOrderId: RZP_ORDER_ID },
      });

      await expect(
        service.createOrder(userId, { orderId }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.createOrder(userId, { orderId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for CANCELLED order', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      await expect(
        service.createOrder(userId, { orderId }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── verifyPayment ──────────────────────────────────────────────────────────

  describe('verifyPayment', () => {
    it('verifies a valid signature and captures the payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPaymentRecord);
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPaymentRecord,
        status: PaymentStatus.CAPTURED,
        rzpPaymentId: RZP_PAYMENT_ID,
      });
      mockPrisma.order.update.mockResolvedValue({});

      const result = await service.verifyPayment(userId, {
        razorpayOrderId:   RZP_ORDER_ID,
        razorpayPaymentId: RZP_PAYMENT_ID,
        razorpaySignature: validSignature,
      });

      expect(result.message).toMatch(/verified/i);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.CAPTURED }),
        }),
      );
    });

    it('throws UnauthorizedException for invalid signature', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPaymentRecord);

      await expect(
        service.verifyPayment(userId, {
          razorpayOrderId:   RZP_ORDER_ID,
          razorpayPaymentId: RZP_PAYMENT_ID,
          razorpaySignature: 'bad_signature_000',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws NotFoundException when payment record missing', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyPayment(userId, {
          razorpayOrderId:   'order_unknown',
          razorpayPaymentId: RZP_PAYMENT_ID,
          razorpaySignature: validSignature,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when payment belongs to another user', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockPaymentRecord,
        order: { ...mockPaymentRecord.order, userId: 'other-user' },
      });

      await expect(
        service.verifyPayment(userId, {
          razorpayOrderId:   RZP_ORDER_ID,
          razorpayPaymentId: RZP_PAYMENT_ID,
          razorpaySignature: validSignature,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ConflictException when already captured', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockPaymentRecord,
        status: PaymentStatus.CAPTURED,
      });

      await expect(
        service.verifyPayment(userId, {
          razorpayOrderId:   RZP_ORDER_ID,
          razorpayPaymentId: RZP_PAYMENT_ID,
          razorpaySignature: validSignature,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── getPaymentStatus ───────────────────────────────────────────────────────

  describe('getPaymentStatus', () => {
    it('returns payment status for the owner', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockPaymentRecord,
        amountRefunded: '0.00',
        currency: 'INR',
        failureCode: null,
        failureMessage: null,
        paidAt: null,
        refundedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        rzpPaymentId: null,
        method: PaymentMethod.RAZORPAY_UPI,
      });

      const result = await service.getPaymentStatus(userId, orderId);
      expect(result.orderNumber).toBe('LG-20240601-0001');
    });

    it('throws NotFoundException for another user', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockPaymentRecord,
        order: { ...mockPaymentRecord.order, userId: 'other-user' },
      });

      await expect(
        service.getPaymentStatus(userId, orderId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
