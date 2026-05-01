import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductSortBy, QueryProductDto } from './dto/query-product.dto';
import { paginate, PaginatedResult } from './common/pagination.dto';
import { slugify, uniqueSlug } from './utils/slugify';

// Shared select shape used in list responses (excludes heavy fields)
const PRODUCT_LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  shortDesc: true,
  price: true,
  mrp: true,
  stock: true,
  isActive: true,
  isFeatured: true,
  tags: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  images: {
    where: { isPrimary: true },
    select: { url: true, altText: true },
    take: 1,
  },
  _count: { select: { reviews: true } },
} satisfies Prisma.ProductSelect;

// Full detail select — used for single product
const PRODUCT_DETAIL_SELECT = {
  ...PRODUCT_LIST_SELECT,
  description: true,
  sku: true,
  costPrice: false,   // never expose cost price to the API
  weight: true,
  lowStockAt: true,
  metaTitle: true,
  metaDesc: true,
  updatedAt: true,
  images: {
    select: { id: true, url: true, altText: true, isPrimary: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  reviews: {
    where: { isApproved: true },
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      isVerifiedPurchase: true,
      helpfulCount: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' as const },
    take: 10,
  },
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List with filters + pagination ────────────────────────────────────────

  async findAll(query: QueryProductDto): Promise<PaginatedResult<unknown>> {
    const {
      search,
      categoryId,
      categorySlug,
      minPrice,
      maxPrice,
      sortBy,
      isFeatured,
      inStock,
    } = query;

    // Resolve categorySlug → categoryId when slug is provided
    let resolvedCategoryId = categoryId;
    if (categorySlug && !categoryId) {
      const cat = await this.prisma.category.findUnique({
        where: { slug: categorySlug },
        select: { id: true },
      });
      if (!cat) throw new NotFoundException(`Category "${categorySlug}" not found`);
      resolvedCategoryId = cat.id;
    }

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(resolvedCategoryId && { categoryId: resolvedCategoryId }),
      ...(isFeatured !== undefined && { isFeatured }),
      ...(inStock && { stock: { gt: 0 } }),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? { price: { ...(minPrice !== undefined && { gte: minPrice }), ...(maxPrice !== undefined && { lte: maxPrice }) } }
        : {}),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { shortDesc: { contains: search } },
          { tags: { contains: search } },
          { sku: { contains: search } },
        ],
      }),
    };

    const orderBy = this.resolveOrderBy(sortBy ?? ProductSortBy.NEWEST);

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_LIST_SELECT,
        orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(products, total, query);
  }

  // ── Single product by slug ────────────────────────────────────────────────

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      select: PRODUCT_DETAIL_SELECT,
    });

    if (!product) throw new NotFoundException(`Product "${slug}" not found`);

    // Compute average rating inline
    const ratingAgg = await this.prisma.review.aggregate({
      where: { productId: (product as { id: string }).id, isApproved: true },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      ...product,
      rating: {
        average: ratingAgg._avg.rating ? Number(ratingAgg._avg.rating.toFixed(1)) : null,
        count: ratingAgg._count.rating,
      },
    };
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateProductDto) {
    await this.assertCategoryExists(dto.categoryId);

    if (dto.mrp < dto.price) {
      throw new BadRequestException('MRP must be greater than or equal to the selling price');
    }

    const slug = await this.resolveUniqueSlug(dto.slug ?? dto.name);

    if (dto.sku) {
      const skuExists = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (skuExists) throw new ConflictException(`SKU "${dto.sku}" is already in use`);
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        shortDesc: dto.shortDesc,
        sku: dto.sku,
        price: dto.price,
        mrp: dto.mrp,
        costPrice: dto.costPrice,
        stock: dto.stock ?? 0,
        lowStockAt: dto.lowStockAt ?? 5,
        weight: dto.weight,
        categoryId: dto.categoryId,
        isActive: dto.isActive ?? true,
        isFeatured: dto.isFeatured ?? false,
        metaTitle: dto.metaTitle,
        metaDesc: dto.metaDesc,
        tags: dto.tags,
        images: dto.images?.length
          ? { create: dto.images.map((img, i) => ({ ...img, sortOrder: img.sortOrder ?? i })) }
          : undefined,
      },
      select: PRODUCT_DETAIL_SELECT,
    });

    this.logger.log(`Product created: ${product.slug}`);
    return product;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.assertProductExists(id);

    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);

    if (dto.mrp !== undefined || dto.price !== undefined) {
      const newPrice = dto.price ?? Number(existing.price);
      const newMrp = dto.mrp ?? Number(existing.mrp);
      if (newMrp < newPrice) {
        throw new BadRequestException('MRP must be greater than or equal to the selling price');
      }
    }

    // Regenerate slug only when explicitly passed (never auto-update from name changes)
    let slug: string | undefined;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = await this.resolveUniqueSlug(dto.slug, id);
    }

    if (dto.sku && dto.sku !== existing.sku) {
      const skuExists = await this.prisma.product.findFirst({
        where: { sku: dto.sku, id: { not: id } },
      });
      if (skuExists) throw new ConflictException(`SKU "${dto.sku}" is already in use`);
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(slug && { slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.shortDesc !== undefined && { shortDesc: dto.shortDesc }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.mrp !== undefined && { mrp: dto.mrp }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.lowStockAt !== undefined && { lowStockAt: dto.lowStockAt }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDesc !== undefined && { metaDesc: dto.metaDesc }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
      },
      select: PRODUCT_DETAIL_SELECT,
    });

    this.logger.log(`Product updated: ${product.slug}`);
    return product;
  }

  // ── Soft delete ───────────────────────────────────────────────────────────

  async remove(id: string) {
    await this.assertProductExists(id);

    // Soft delete — sets isActive = false, keeps all relations intact
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Product soft-deleted: ${id}`);
    return { message: 'Product has been deactivated successfully', id };
  }

  // ── Featured products (homepage widget) ──────────────────────────────────

  async findFeatured(limit = 8) {
    return this.prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      select: PRODUCT_LIST_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  // ── Low-stock alert (admin dashboard) ────────────────────────────────────

  async findLowStock() {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        stock: { lte: this.prisma.product.fields.lowStockAt as unknown as number },
      },
      select: { id: true, name: true, sku: true, stock: true, lowStockAt: true },
      orderBy: { stock: 'asc' },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private resolveOrderBy(sortBy: ProductSortBy): Prisma.ProductOrderByWithRelationInput[] {
    const map: Record<ProductSortBy, Prisma.ProductOrderByWithRelationInput[]> = {
      [ProductSortBy.PRICE_ASC]: [{ price: 'asc' }],
      [ProductSortBy.PRICE_DESC]: [{ price: 'desc' }],
      [ProductSortBy.NEWEST]: [{ createdAt: 'desc' }],
      [ProductSortBy.OLDEST]: [{ createdAt: 'asc' }],
      [ProductSortBy.NAME_ASC]: [{ name: 'asc' }],
      [ProductSortBy.FEATURED]: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    };
    return map[sortBy] ?? [{ createdAt: 'desc' }];
  }

  private async assertCategoryExists(categoryId: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });
    if (!cat) throw new NotFoundException(`Category "${categoryId}" not found`);
    if (!cat.isActive) throw new BadRequestException('Cannot assign product to an inactive category');
  }

  private async assertProductExists(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, slug: true, price: true, mrp: true, sku: true, isActive: true },
    });
    if (!product) throw new NotFoundException(`Product "${id}" not found`);
    return product;
  }

  private async resolveUniqueSlug(base: string, excludeId?: string): Promise<string> {
    const candidate = slugify(base);
    const existing = await this.prisma.product.findFirst({
      where: { slug: candidate, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });
    return existing ? uniqueSlug(base) : candidate;
  }
}
