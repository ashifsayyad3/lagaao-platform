import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { PrismaService } from './prisma/prisma.service';
import { RAZORPAY_CLIENT } from './razorpay/razorpay.provider';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;       // paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
}

interface RazorpayWebhookBody {
  event: string;
  payload: {
    payment?: {
      entity: RazorpayPaymentEntity;
    };
  };
}

interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  error_code?: string;
  error_description?: string;
}

// ── Shared select shape ───────────────────────────────────────────────────────

const PAYMENT_SELECT = {
  id: true,
  orderId: true,
  rzpOrderId: true,
  rzpPaymentId: true,
  method: true,
  status: true,
  amount: true,
  currency: true,
  amountRefunded: true,
  failureCode: true,
  failureMessage: true,
  paidAt: true,
  refundedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentSelect;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(RAZORPAY_CLIENT) private readonly razorpay: Razorpay,
  ) {}

  // ── Create Razorpay order ──────────────────────────────────────────────────

  async createOrder(userId: string, dto: CreatePaymentDto) {
    // 1. Load the lagaao order and confirm ownership
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        payment: { select: { id: true, status: true, rzpOrderId: true } },
        user: { select: { email: true, firstName: true, phone: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot initiate payment for a cancelled order');
    }

    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('This order has already been fulfilled');
    }

    // 2. Idempotency — return existing Razorpay order if payment is still pending
    if (order.payment) {
      if (order.payment.status === PaymentStatus.CAPTURED) {
        throw new ConflictException('Payment for this order has already been completed');
      }
      // Resend the existing rzp order id so the frontend can retry checkout
      if (order.payment.status === PaymentStatus.PENDING && order.payment.rzpOrderId) {
        this.logger.log(`Returning existing Razorpay order for lagaao order ${order.orderNumber}`);
        return this.buildCheckoutResponse(order.payment.rzpOrderId, order, dto.method);
      }
    }

    // 3. Create Razorpay order (amount in paise)
    const amountPaise = new Decimal(order.total).mul(100).toNumber();

    let rzpOrder: RazorpayOrder;
    try {
      rzpOrder = (await this.razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: order.orderNumber,
        notes: { lagaaoOrderId: order.id, userId },
      })) as RazorpayOrder;
    } catch (err) {
      this.logger.error('Razorpay order creation failed', err);
      throw new InternalServerErrorException(
        'Payment gateway is unavailable. Please try again in a moment.',
      );
    }

    // 4. Persist the payment record (PENDING)
    await this.prisma.payment.upsert({
      where: { orderId: dto.orderId },
      create: {
        orderId: dto.orderId,
        rzpOrderId: rzpOrder.id,
        method: dto.method ?? PaymentMethod.RAZORPAY_UPI,
        status: PaymentStatus.PENDING,
        amount: order.total,
        currency: 'INR',
      },
      update: {
        rzpOrderId: rzpOrder.id,
        status: PaymentStatus.PENDING,
        failureCode: null,
        failureMessage: null,
      },
    });

    this.logger.log(
      `Razorpay order ${rzpOrder.id} created for lagaao order ${order.orderNumber}`,
    );

    return this.buildCheckoutResponse(rzpOrder.id, order, dto.method);
  }

  // ── Verify signature (frontend callback) ──────────────────────────────────

  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = dto;

    // 1. Load payment record by Razorpay order id
    const payment = await this.prisma.payment.findUnique({
      where: { rzpOrderId: razorpayOrderId },
      select: {
        id: true,
        orderId: true,
        status: true,
        amount: true,
        order: { select: { userId: true, orderNumber: true, status: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found for this Razorpay order');
    }

    // 2. Confirm the payment belongs to the requesting user
    if (payment.order.userId !== userId) {
      throw new UnauthorizedException('You do not own this payment');
    }

    if (payment.status === PaymentStatus.CAPTURED) {
      throw new ConflictException('This payment has already been verified');
    }

    // 3. Cryptographic signature verification
    this.assertSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    // 4. Atomically: mark payment CAPTURED + advance order to CONFIRMED
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          rzpPaymentId: razorpayPaymentId,
          rzpSignature: razorpaySignature,
          status: PaymentStatus.CAPTURED,
          paidAt: new Date(),
        },
        select: PAYMENT_SELECT,
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          statusHistory: {
            create: {
              status:    OrderStatus.CONFIRMED,
              note:      `Payment captured — Razorpay ID: ${razorpayPaymentId}`,
              changedBy: 'payment-service',
            },
          },
        },
      });

      return updatedPayment;
    });

    this.logger.log(
      `Payment verified — order ${payment.order.orderNumber}, ` +
      `Razorpay payment ${razorpayPaymentId}`,
    );

    return {
      message: 'Payment verified successfully. Your order is confirmed.',
      payment: updated,
    };
  }

  // ── Razorpay webhook ───────────────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string) {
    // 1. Verify webhook authenticity with the webhook secret
    this.assertWebhookSignature(rawBody, signature);

    const event = JSON.parse(rawBody.toString()) as RazorpayWebhookBody;
    this.logger.log(`Razorpay webhook received: ${event.event}`);

    switch (event.event) {
      case 'payment.captured':
        await this.onPaymentCaptured(event.payload.payment!.entity);
        break;

      case 'payment.failed':
        await this.onPaymentFailed(event.payload.payment!.entity);
        break;

      case 'refund.processed':
        // Handled by a separate refund flow — log and ack
        this.logger.log('Refund processed webhook received — no action required');
        break;

      default:
        this.logger.warn(`Unhandled Razorpay webhook event: ${event.event}`);
    }

    return { received: true };
  }

  // ── Get payment status ─────────────────────────────────────────────────────

  async getPaymentStatus(userId: string, orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      select: {
        ...PAYMENT_SELECT,
        order: { select: { userId: true, orderNumber: true, status: true } },
      },
    });

    if (!payment) throw new NotFoundException('No payment record found for this order');

    if (payment.order.userId !== userId) {
      // Don't reveal whether the resource exists for another user
      throw new NotFoundException('No payment record found for this order');
    }

    const { order, ...paymentData } = payment;
    return {
      ...paymentData,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
    };
  }

  // ── Admin: list all payments ───────────────────────────────────────────────

  async findAll(page = 1, limit = 20, status?: PaymentStatus) {
    const where: Prisma.PaymentWhereInput = status ? { status } : {};
    const skip = (page - 1) * limit;

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        select: {
          ...PAYMENT_SELECT,
          order: {
            select: {
              orderNumber: true,
              status: true,
              user: { select: { email: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: payments,
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages },
    };
  }

  // ── Webhook handlers ───────────────────────────────────────────────────────

  private async onPaymentCaptured(entity: RazorpayPaymentEntity) {
    const payment = await this.prisma.payment.findUnique({
      where: { rzpOrderId: entity.order_id },
      select: { id: true, orderId: true, status: true, order: { select: { orderNumber: true } } },
    });

    if (!payment) {
      this.logger.warn(`Webhook: no payment found for Razorpay order ${entity.order_id}`);
      return;
    }

    // Idempotency — skip if already captured (frontend verify may have arrived first)
    if (payment.status === PaymentStatus.CAPTURED) {
      this.logger.log(`Webhook: payment ${entity.id} already captured — skipping`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          rzpPaymentId:  entity.id,
          status:        PaymentStatus.CAPTURED,
          paidAt:        new Date(),
          gatewayResponse: entity as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          statusHistory: {
            create: {
              status:    OrderStatus.CONFIRMED,
              note:      `Payment captured via webhook — Razorpay ID: ${entity.id}`,
              changedBy: 'razorpay-webhook',
            },
          },
        },
      });
    });

    this.logger.log(
      `Webhook: payment captured — order ${payment.order.orderNumber}, pay ID ${entity.id}`,
    );
  }

  private async onPaymentFailed(entity: RazorpayPaymentEntity) {
    const payment = await this.prisma.payment.findUnique({
      where: { rzpOrderId: entity.order_id },
      select: { id: true, status: true, order: { select: { orderNumber: true } } },
    });

    if (!payment) {
      this.logger.warn(`Webhook: no payment found for Razorpay order ${entity.order_id}`);
      return;
    }

    if (payment.status === PaymentStatus.CAPTURED) {
      this.logger.warn(`Webhook: ignoring failure event — payment already captured`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        rzpPaymentId:    entity.id,
        status:          PaymentStatus.FAILED,
        failureCode:     entity.error_code ?? 'UNKNOWN',
        failureMessage:  entity.error_description ?? 'Payment failed',
        gatewayResponse: entity as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.warn(
      `Webhook: payment failed — order ${payment.order.orderNumber}, ` +
      `code: ${entity.error_code ?? 'UNKNOWN'}`,
    );
  }

  // ── Signature helpers ──────────────────────────────────────────────────────

  private assertSignature(
    rzpOrderId: string,
    rzpPaymentId: string,
    signature: string,
  ): void {
    const secret = this.config.getOrThrow<string>('RAZORPAY_KEY_SECRET');
    const body   = `${rzpOrderId}|${rzpPaymentId}`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Use timingSafeEqual to prevent timing attacks
    const sigBuf  = Buffer.from(signature, 'hex');
    const expBuf  = Buffer.from(expected, 'hex');

    const valid =
      sigBuf.length === expBuf.length &&
      crypto.timingSafeEqual(sigBuf, expBuf);

    if (!valid) {
      this.logger.warn(`Invalid payment signature for Razorpay order ${rzpOrderId}`);
      throw new UnauthorizedException('Payment signature verification failed');
    }
  }

  private assertWebhookSignature(rawBody: Buffer, signature: string): void {
    const secret   = this.config.getOrThrow<string>('RAZORPAY_WEBHOOK_SECRET');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');

    const valid =
      sigBuf.length === expBuf.length &&
      crypto.timingSafeEqual(sigBuf, expBuf);

    if (!valid) {
      this.logger.warn('Invalid Razorpay webhook signature');
      throw new UnauthorizedException('Webhook signature verification failed');
    }
  }

  // ── Response builder ───────────────────────────────────────────────────────

  private buildCheckoutResponse(
    rzpOrderId: string,
    order: {
      id: string;
      orderNumber: string;
      total: Decimal;
      user: { email: string; firstName: string; phone: string | null };
    },
    method?: PaymentMethod,
  ) {
    return {
      rzpOrderId,
      amount: new Decimal(order.total).mul(100).toNumber(),   // paise for Razorpay JS SDK
      currency: 'INR',
      lagaaoOrderId: order.id,
      orderNumber: order.orderNumber,
      method: method ?? PaymentMethod.RAZORPAY_UPI,
      prefill: {
        name:    order.user.firstName,
        email:   order.user.email,
        contact: order.user.phone ?? '',
      },
      keyId: this.config.getOrThrow<string>('RAZORPAY_KEY_ID'),
    };
  }
}
