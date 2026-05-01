import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from './common/current-user.decorator';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { JwtPayload } from './common/jwt.strategy';
import { Roles, RolesGuard } from './common/roles.guard';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderService } from './order.service';

// ── Customer routes (/orders) ─────────────────────────────────────────────────

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * POST /orders
   * Creates a new order from the authenticated user's cart.
   * Validates stock, applies coupon, decrements stock, clears cart — all atomically.
   * Body: { addressId, couponId?, notes? }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
  ) {
    return this.orderService.createOrder(user.sub, dto);
  }

  /**
   * GET /orders
   * Returns the authenticated user's order history (paginated).
   * ?page=1&limit=10&status=DELIVERED
   */
  @Get()
  findMyOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryOrdersDto,
  ) {
    return this.orderService.findUserOrders(user.sub, query);
  }

  /**
   * GET /orders/:id
   * Full order detail — items, payment, status history.
   * Returns 404 if the order belongs to a different user.
   */
  @Get(':id')
  findMyOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orderService.findUserOrder(user.sub, id);
  }

  /**
   * PUT /orders/:id/cancel
   * Customer self-cancellation — only allowed for PENDING and CONFIRMED orders.
   * Restores product stock automatically.
   * Body: { reason? }
   */
  @Put(':id/cancel')
  cancelOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orderService.cancelOrder(user.sub, id, dto);
  }
}

// ── Admin routes (/admin/orders) ──────────────────────────────────────────────

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * GET /admin/orders
   * Paginated list of all orders with optional filters.
   * ?page=1&limit=10&status=PENDING&search=LG-2024&userId=<uuid>
   */
  @Get()
  findAll(@Query() query: QueryOrdersDto) {
    return this.orderService.findAllOrders(query);
  }

  /**
   * GET /admin/orders/:id
   * Full order detail including the customer's profile info.
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.findOrderById(id);
  }

  /**
   * PUT /admin/orders/:id/status
   * Advances the order through the status machine.
   * Invalid transitions (e.g. DELIVERED → PENDING) are rejected with 400.
   * Body: { status: OrderStatus, note? }
   */
  @Put(':id/status')
  updateStatus(
    @CurrentUser() admin: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(admin, id, dto);
  }
}
