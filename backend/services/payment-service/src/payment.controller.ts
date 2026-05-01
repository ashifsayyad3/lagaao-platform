import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { PaymentStatus } from '@prisma/client';
import { CurrentUser } from './common/current-user.decorator';
import { JwtAuthGuard, Public } from './common/jwt-auth.guard';
import { JwtPayload } from './common/jwt.strategy';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentService } from './payment.service';

// ── Customer & common routes ──────────────────────────────────────────────────

@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * POST /payment/create-order
   * Protected — creates a Razorpay order for an existing lagaao order.
   * Returns all data required to initialise Razorpay Checkout JS.
   *
   * Body: { orderId: uuid, method?: PaymentMethod }
   *
   * Razorpay Checkout JS usage on the frontend:
   *   const rzp = new Razorpay({
   *     key: response.keyId,
   *     order_id: response.rzpOrderId,
   *     amount: response.amount,
   *     currency: response.currency,
   *     prefill: response.prefill,
   *   });
   *   rzp.open();
   */
  @Post('create-order')
  @HttpCode(HttpStatus.CREATED)
  createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentService.createOrder(user.sub, dto);
  }

  /**
   * POST /payment/verify
   * Protected — verifies the Razorpay HMAC-SHA256 signature returned by
   * Razorpay Checkout JS after the user completes payment.
   * On success, marks payment CAPTURED and order CONFIRMED atomically.
   *
   * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verifyPayment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentService.verifyPayment(user.sub, dto);
  }

  /**
   * POST /payment/webhook
   * PUBLIC — Razorpay webhook endpoint.
   * Must be excluded from JWT auth; authenticated via X-Razorpay-Signature header.
   *
   * The route receives the raw request body (Buffer) so the HMAC can be
   * recomputed exactly — JSON.parse would mutate key ordering and break the hash.
   *
   * Register in Razorpay Dashboard:
   *   URL: https://api.lagaao.com/payment/webhook
   *   Events: payment.captured, payment.failed, refund.processed
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (!req.rawBody) {
      return { received: false };
    }
    return this.paymentService.handleWebhook(req.rawBody, signature);
  }

  /**
   * GET /payment/:orderId
   * Protected — returns the payment status for a lagaao order.
   * Returns 404 if the order belongs to a different user.
   */
  @Get(':orderId')
  getPaymentStatus(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.paymentService.getPaymentStatus(user.sub, orderId);
  }
}

// ── Admin routes ──────────────────────────────────────────────────────────────

@Controller('admin/payments')
@UseGuards(JwtAuthGuard)
export class AdminPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * GET /admin/payments
   * Admin only — paginated list of all payments.
   * ?page=1&limit=20&status=CAPTURED
   */
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }
}
