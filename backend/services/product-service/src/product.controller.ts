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
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard, Public } from './common/jwt-auth.guard';
import { Roles, RolesGuard } from './common/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './product.service';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * GET /products
   * Public — paginated list with optional filters:
   *   ?page=1&limit=20&search=pothos&categorySlug=indoor-plants
   *   &minPrice=100&maxPrice=500&sortBy=price_asc&isFeatured=true&inStock=true
   */
  @Public()
  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.productService.findAll(query);
  }

  /**
   * GET /products/featured
   * Public — up to 8 featured products for the homepage.
   */
  @Public()
  @Get('featured')
  findFeatured(@Query('limit') limit?: string) {
    return this.productService.findFeatured(limit ? parseInt(limit, 10) : 8);
  }

  /**
   * GET /products/low-stock
   * Admin only — products at or below their lowStockAt threshold.
   */
  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findLowStock() {
    return this.productService.findLowStock();
  }

  /**
   * GET /products/:slug
   * Public — full product detail including approved reviews.
   */
  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  /**
   * POST /products
   * Admin only — creates a new product (with optional images array).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  /**
   * PUT /products/:id
   * Admin only — partial update; only provided fields are changed.
   */
  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(id, dto);
  }

  /**
   * DELETE /products/:id
   * Admin only — soft delete (sets isActive = false, retains all data).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productService.remove(id);
  }
}
