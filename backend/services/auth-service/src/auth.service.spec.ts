import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma/prisma.service';

const mockUser = {
  id: 'uuid-1',
  firstName: 'Rahul',
  lastName: 'Sharma',
  email: 'rahul@example.com',
  phone: '9876543210',
  role: UserRole.CUSTOMER,
  isVerified: false,
  isActive: true,
  passwordHash: bcrypt.hashSync('Test@1234', 10),
  lastLoginAt: null,
};

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwt = { sign: jest.fn().mockReturnValue('mock.jwt.token') };
const mockConfig = { getOrThrow: jest.fn().mockReturnValue('test-secret'), get: jest.fn().mockReturnValue('7d') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates a user and returns a token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'uuid-1',
        firstName: 'Rahul',
        lastName: 'Sharma',
        email: 'rahul@example.com',
        phone: '9876543210',
        role: UserRole.CUSTOMER,
        isVerified: false,
        createdAt: new Date(),
      });

      const result = await service.register({
        firstName: 'Rahul',
        lastName: 'Sharma',
        email: 'rahul@example.com',
        phone: '9876543210',
        password: 'Test@1234',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user.email).toBe('rahul@example.com');
    });

    it('throws ConflictException when email is taken', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ email: 'rahul@example.com', phone: null });

      await expect(
        service.register({
          firstName: 'Rahul',
          email: 'rahul@example.com',
          password: 'Test@1234',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns a token on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.login({
        email: 'rahul@example.com',
        password: 'Test@1234',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('throws UnauthorizedException on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'rahul@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'Test@1234' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when account is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        service.login({ email: 'rahul@example.com', password: 'Test@1234' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
