import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CouponType, OrderStatus, Prisma, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from './prisma/prisma.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtPayload } from './common/jwt.strategy';

// ── Constants ─────────────────────────────────────────────────────────────────

const FREE_SHIPPING_THRESHOLD = 499;
const FLAT_SHIPPING_CHARGE    = 49;
const GST_RATE                = 0.00;   // 0% — adjust per product category as needed

// Statuses from which a customer is allowed to cancel
const CUSTOMER_CANCELLABLE: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
];

// Valid forward transitions enforced on the admin status machine
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]:          [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]:        [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]:       [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]:          [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]:        [OrderStatus.RETURN_REQUESTED],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED],
  [OrderStatus.RETURNED]:         [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]:        [],
  [OrderStatus.REFUNDED]:         [],
};

// ── Shared Prisma select shapes ───────────────────────────────────────────────

const ORDER_SUMMARY_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  subtotal: true,
  shippingCharge: true,
  taxAmount: true,
  discountAmount: true,
  total: true,
  notes: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
  address: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      line1: true,
      line2: true,
      landmark: true,
      city: true,
      state: true,
      pincode: true,
      country: true,
    },
  },
  coupon: { select: { id: true, code: true, type: true, value: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

const ORDER_DETAIL_SELECT = {
  ...ORDER_SUMMARY_SELECT,
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      productSku: true,
      productImage: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
    },
  },
  payment: {
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      rzpOrderId: true,
      rzpPaymentId: true,
      paidAt: true,
    },
  },
  statusHistory: {
    select: {
      id: true,
      status: true,
      note: true,
      changedBy: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.OrderSelect;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create order from cart ─────────────────────────────────────────────────

  async createOrder(userId: string, dto: CreateOrderDto) {
    // 1. Load cart with live product data
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                stock: true,
                isActive: true,
                images: {
                  where: { isPrimary: true },
                  select: { url: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty. Add items before placing an order.');
    }

    // 2. Validate address belongs to the user
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
    });
    if (!address) {
      throw new NotFoundException('Delivery address not found. Please add a valid address.');
    }

    // 3. Validate every cart item — collect all errors before throwing
    const stockErrors: string[] = [];
    for (const item of cart.items) {
      if (!item.product.isActive) {
        stockErrors.push(`"${item.product.name}" is no longer available`);
      } else if (item.product.stock < item.quantity) {
        stockErrors.push(
          `"${item.product.name}": only ${item.product.stock} unit(s) available (you need ${item.quantity})`,
        );
      }
    }
    if (stockErrors.length) {
      throw new UnprocessableEntityException({
        message: 'Some items in your cart cannot be fulfilled',
        errors: stockErrors,
      });
    }

    // 4. Calculate pricing
    let subtotal = new Decimal(0);
    for (const item of cart.items) {
      subtotal = subtotal.add(new Decimal(item.product.price).mul(item.quantity));
    }

    const shippingCharge = subtotal.gte(FREE_SHIPPING_THRESHOLD)
      ? new Decimal(0)
      : new Decimal(FLAT_SHIPPING_CHARGE);

    const taxAmount = subtotal.mul(GST_RATE).toDecimalPlaces(2);

    // 5. Apply coupon (if provided)
    let discountAmount = new Decimal(0);
    let validatedCouponId: string | undefined;

    if (dto.couponId) {
      const couponResult = await this.applyCoupon(dto.couponId, userId, subtotal);
      discountAmount     = couponResult.discount;
      validatedCouponId  = couponResult.couponId;
    }

    const total = subtotal.add(shippingCharge).add(taxAmount).sub(discountAmount);
    if (total.lte(0)) {
      throw new BadRequestException('Order total cannot be zero or negative');
    }

    // 6. Generate human-readable order number: LG-YYYYMMDD-XXXX
    const orderNumber = await this.generateOrderNumber();

    // 7. Run everything in a single transaction:
    //    create order + items + history entry + decrement stock + clear cart
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId,
          addressId: dto.addressId,
          status: OrderStatus.PENDING,
          subtotal,
          shippingCharge,
          taxAmount,
          discountAmount,
          total,
          couponId: validatedCouponId,
          notes: dto.notes,
          items: {
            create: cart.items.map((item) => ({
              productId:    item.product.id,
              productName:  item.product.name,
              productSku:   item.product.sku ?? null,
              productImage: item.product.images[0]?.url ?? null,
              quantity:     item.quantity,
              unitPrice:    item.product.price,
              totalPrice:   new Decimal(item.product.price).mul(item.quantity),
            })),
          },
          statusHistory: {
            create: {
              status:    OrderStatus.PENDING,
              note:      'Order placed',
              changedBy: userId,
            },
          },
        },
        select: ORDER_DETAIL_SELECT,
      });

      // Decrement stock for each product atomically
      await Promise.all(
        cart.items.map((item) =>
          tx.product.update({
            where: { id: item.product.id },
            data: { stock: { decrement: item.quantity } },
          }),
        ),
      );

      // Record coupon usage
      if (validatedCouponId) {
        await tx.couponUsage.create({
          data: {
            couponId: validatedCouponId,
            userId,
            orderId:  created.id,
          },
        });
        // Increment usage counter on the coupon itself
        await tx.coupon.update({
          where: { id: validatedCouponId },
          data: { usageCount: { increment: 1 } },
        });
      }

      // Clear the cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { updatedAt: new Date() },
      });

      return created;
    });

    this.logger.log(`Order created: ${order.orderNumber} for user ${userId}`);
    return order;
  }

  // ── User: list own orders ──────────────────────────────────────────────────

  async findUserOrders(userId: string, query: QueryOrdersDto) {
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: ORDER_SUMMARY_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return this.paginatedResponse(orders, total, query);
  }

  // ── User: single order detail ──────────────────────────────────────────────

  async findUserOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: ORDER_DETAIL_SELECT,
    });

    if (!order) throw new NotFoundException(`Order not found`);
    return order;
  }

  // ── User: cancel order ─────────────────────────────────────────────────────

  async cancelOrder(userId: string, orderId: string, dto: CancelOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true, orderNumber: true, items: { select: { productId: true, quantity: true } } },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel an order that is already "${order.status}". Contact support for assistance.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: dto.reason ?? 'Cancelled by customer',
          statusHistory: {
            create: {
              status:    OrderStatus.CANCELLED,
              note:      dto.reason ?? 'Cancelled by customer',
              changedBy: userId,
            },
          },
        },
        select: ORDER_DETAIL_SELECT,
      });

      // Restore stock for each item
      await Promise.all(
        order.items.map((item) =>
          tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          }),
        ),
      );

      return result;
    });

    this.logger.log(`Order cancelled: ${order.orderNumber} by user ${userId}`);
    return updated;
  }

  // ── Admin: list all orders ─────────────────────────────────────────────────

  async findAllOrders(query: QueryOrdersDto) {
    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.userId && { userId: query.userId }),
      ...(query.search && {
        OR: [
          { orderNumber: { contains: query.search } },
          { user: { email: { contains: query.search } } },
        ],
      }),
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: {
          ...ORDER_SUMMARY_SELECT,
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return this.paginatedResponse(orders, total, query);
  }

  // ── Admin: get single order ────────────────────────────────────────────────

  async findOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        ...ORDER_DETAIL_SELECT,
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (!order) throw new NotFoundException(`Order "${orderId}" not found`);
    return order;
  }

  // ── Admin: update order status ─────────────────────────────────────────────

  async updateOrderStatus(
    adminUser: JwtPayload,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (!order) throw new NotFoundException(`Order "${orderId}" not found`);

    // Enforce the state machine
    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition order from "${order.status}" to "${dto.status}". ` +
        `Allowed: ${allowed.length ? allowed.join(', ') : 'none'}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.update({
        where: { id: orderId },
        data: {
          status: dto.status,
          ...(dto.status === OrderStatus.CANCELLED && {
            cancelReason: dto.note ?? `Cancelled by ${adminUser.role}`,
          }),
          statusHistory: {
            create: {
              status:    dto.status,
              note:      dto.note,
              changedBy: adminUser.sub,
            },
          },
        },
        select: ORDER_DETAIL_SELECT,
      });

      // If admin cancels, restore stock
      if (dto.status === OrderStatus.CANCELLED) {
        await Promise.all(
          order.items.map((item) =>
            tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            }),
          ),
        );
      }

      return result;
    });

    this.logger.log(
      `Order ${order.orderNumber}: ${order.status} → ${dto.status} by ${adminUser.email}`,
    );
    return updated;
  }

  // ── Coupon application ────────────────────────────────────────────────────

  private async applyCoupon(
    couponId: string,
    userId: string,
    subtotal: Decimal,
  ): Promise<{ discount: Decimal; couponId: string }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        _count: { select: { usages: { where: { userId } } } },
      },
    });

    if (!coupon) throw new NotFoundException('Coupon not found');
    if (!coupon.isActive) throw new BadRequestException('This coupon is no longer active');

    const now = new Date();
    if (coupon.startsAt > now) throw new BadRequestException('This coupon is not yet valid');
    if (coupon.expiresAt && coupon.expiresAt < now) throw new BadRequestException('This coupon has expired');

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    if (coupon._count.usages >= coupon.perUserLimit) {
      throw new BadRequestException(`You have already used this coupon ${coupon.perUserLimit} time(s)`);
    }

    if (subtotal.lt(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `Minimum order value for this coupon is ₹${coupon.minOrderAmount.toFixed(0)}`,
      );
    }

    let discount = new Decimal(0);

    switch (coupon.type) {
      case CouponType.PERCENTAGE:
        discount = subtotal.mul(new Decimal(coupon.value).div(100)).toDecimalPlaces(2);
        if (coupon.maxDiscount && discount.gt(coupon.maxDiscount)) {
          discount = new Decimal(coupon.maxDiscount);
        }
        break;

      case CouponType.FLAT:
        discount = new Decimal(coupon.value);
        if (discount.gt(subtotal)) discount = subtotal;
        break;

      case CouponType.FREE_SHIPPING:
        // Discount equals the shipping charge that would have been applied
        discount = subtotal.gte(FREE_SHIPPING_THRESHOLD)
          ? new Decimal(0)
          : new Decimal(FLAT_SHIPPING_CHARGE);
        break;
    }

    return { discount, couponId: coupon.id };
  }

  // ── Order number generator ─────────────────────────────────────────────────

  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, ''); // "20240601"

    // Count orders placed today to produce a zero-padded 4-digit sequence
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const count      = await this.prisma.order.count({
      where: { createdAt: { gte: startOfDay } },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `LG-${datePart}-${sequence}`;
  }

  // ── Pagination helper ──────────────────────────────────────────────────────

  private paginatedResponse<T>(data: T[], total: number, query: QueryOrdersDto) {
    const totalPages = Math.ceil(total / query.limit);
    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    };
  }
}
