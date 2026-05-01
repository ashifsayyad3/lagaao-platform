import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PrismaService } from './prisma/prisma.service';
import { ProductSortBy } from './dto/query-product.dto';

const mockCategory = { id: 'cat-uuid-1', name: 'Indoor Plants', slug: 'indoor-plants', isActive: true };

const mockProduct = {
  id: 'prod-uuid-1',
  name: 'Pothos Plant',
  slug: 'pothos-plant',
  price: 299,
  mrp: 399,
  stock: 20,
  isActive: true,
  isFeatured: false,
  sku: 'PLT-001',
};

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    fields: { lowStockAt: 'lowStockAt' },
  },
  category: {
    findUnique: jest.fn(),
  },
  review: {
    aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 10 } }),
  },
  $transaction: jest.fn(),
};

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated products', async () => {
      const products = [mockProduct];
      mockPrisma.$transaction.mockResolvedValue([products, 1]);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        sortBy: ProductSortBy.NEWEST,
        skip: 0,
      });

      expect(result.data).toEqual(products);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('resolves categorySlug to categoryId', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-uuid-1' });
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 20,
        categorySlug: 'indoor-plants',
        sortBy: ProductSortBy.NEWEST,
        skip: 0,
      });

      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'indoor-plants' } }),
      );
    });

    it('throws when categorySlug does not exist', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll({ page: 1, limit: 20, categorySlug: 'unknown', sortBy: ProductSortBy.NEWEST, skip: 0 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a product', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);
      mockPrisma.product.findFirst.mockResolvedValue(null); // slug available
      mockPrisma.product.findUnique.mockResolvedValue(null); // sku available
      mockPrisma.product.create.mockResolvedValue(mockProduct);

      const result = await service.create({
        name: 'Pothos Plant',
        price: 299,
        mrp: 399,
        categoryId: 'cat-uuid-1',
        sku: 'PLT-001',
      });

      expect(result).toEqual(mockProduct);
    });

    it('throws when price exceeds MRP', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);

      await expect(
        service.create({ name: 'Test', price: 500, mrp: 400, categoryId: 'cat-uuid-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('soft deletes a product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, isActive: false });

      const result = await service.remove('prod-uuid-1');
      expect(result.id).toBe('prod-uuid-1');
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('throws when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
