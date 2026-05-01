import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CategoryService } from './category.service';
import { JwtAuthGuard, Public } from './common/jwt-auth.guard';
import { Roles, RolesGuard } from './common/roles.guard';
import { CreateCategoryDto } from './dto/create-category.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * GET /categories
   * Public — returns the active category tree.
   * Admins can pass ?all=true to include inactive categories.
   */
  @Public()
  @Get()
  findAll(@Query('all') all?: string) {
    return this.categoryService.findAll(all === 'true');
  }

  /**
   * GET /categories/:slug
   * Public — returns one category with its children and product count.
   */
  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categoryService.findBySlug(slug);
  }

  /**
   * POST /categories
   * Admin only — creates a new category.
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  /**
   * POST /categories/seed
   * Admin only — idempotent seed of the 5 default plant categories.
   */
  @Post('seed')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  seed() {
    return this.categoryService.seed();
  }
}
