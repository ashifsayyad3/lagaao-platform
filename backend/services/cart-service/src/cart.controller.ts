import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CurrentUser } from './common/current-user.decorator';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { JwtPayload } from './common/jwt.strategy';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)    // every route in this controller requires a valid JWT
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * GET /cart
   * Returns the authenticated user's cart with line-level details and summary totals.
   * Creates an empty cart automatically if the user has none yet.
   */
  @Get()
  getCart(@CurrentUser() user: JwtPayload) {
    return this.cartService.getCart(user.sub);
  }

  /**
   * POST /cart/add
   * Adds a product to the cart.
   * If the product is already in the cart the quantities are merged.
   * Body: { productId: uuid, quantity: 1..99 }
   */
  @Post('add')
  @HttpCode(HttpStatus.OK)
  addItem(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addItem(user.sub, dto);
  }

  /**
   * PUT /cart/update/:itemId
   * Replaces the quantity of an existing cart item.
   * Body: { quantity: 1..99 }
   */
  @Put('update/:itemId')
  updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartDto,
  ) {
    return this.cartService.updateItem(user.sub, itemId, dto);
  }

  /**
   * DELETE /cart/remove/:itemId
   * Removes a single item from the cart.
   */
  @Delete('remove/:itemId')
  @HttpCode(HttpStatus.OK)
  removeItem(
    @CurrentUser() user: JwtPayload,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.cartService.removeItem(user.sub, itemId);
  }

  /**
   * DELETE /cart/clear
   * Removes all items from the cart (keeps the cart record itself).
   */
  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  clearCart(@CurrentUser() user: JwtPayload) {
    return this.cartService.clearCart(user.sub);
  }
}
