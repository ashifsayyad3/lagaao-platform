import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { slugify } from './utils/slugify';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async findAll(includeInactive = false) {
    const categories = await this.prisma.category.findMany({
      where: includeInactive ? undefined : { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
        isActive: true,
        parentId: true,
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: { where: { isActive: true } } } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Build nested tree for root categories
    return this.buildTree(categories);
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          where: { isActive: true },
          select: { id: true, name: true, slug: true, imageUrl: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });

    if (!category) throw new NotFoundException(`Category "${slug}" not found`);
    return category;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug ?? slugify(dto.name);

    const exists = await this.prisma.category.findUnique({ where: { slug } });
    if (exists) throw new ConflictException(`A category with slug "${slug}" already exists`);

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException(`Parent category "${dto.parentId}" not found`);
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        metaTitle: dto.metaTitle,
        metaDesc: dto.metaDesc,
      },
    });

    this.logger.log(`Category created: ${category.slug}`);
    return category;
  }

  // ── Seed ──────────────────────────────────────────────────────────────────

  async seed() {
    const plants = [
      {
        name: 'Money Plants',
        slug: 'money-plants',
        description: 'Bring good fortune home with our range of money plants.',
        sortOrder: 1,
      },
      {
        name: 'Bonsai',
        slug: 'bonsai',
        description: 'Hand-crafted miniature trees for a serene living space.',
        sortOrder: 2,
      },
      {
        name: 'Indoor Plants',
        slug: 'indoor-plants',
        description: 'Air-purifying plants perfect for home and office.',
        sortOrder: 3,
      },
      {
        name: 'Gifting Plants',
        slug: 'gifting-plants',
        description: 'Beautifully packaged plants for every occasion.',
        sortOrder: 4,
      },
      {
        name: 'Succulents',
        slug: 'succulents',
        description: 'Low-maintenance succulents in decorative pots.',
        sortOrder: 5,
      },
    ];

    const results = await Promise.all(
      plants.map((p) =>
        this.prisma.category.upsert({
          where: { slug: p.slug },
          create: { ...p, isActive: true },
          update: { name: p.name, description: p.description, sortOrder: p.sortOrder },
        }),
      ),
    );

    this.logger.log(`Seeded ${results.length} plant categories`);
    return { seeded: results.length, categories: results.map((c) => c.slug) };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildTree<T extends { parentId: string | null; children?: T[] }>(items: T[]): T[] {
    const roots = items.filter((i) => !i.parentId);
    return roots;
  }
}
