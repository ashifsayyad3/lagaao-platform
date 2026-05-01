import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const { firstName, lastName, email, phone, password } = dto;

    // Check for duplicate email / phone in a single query
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] },
      select: { email: true, phone: true },
    });

    if (existing) {
      const field = existing.email === email ? 'email' : 'phone number';
      throw new ConflictException(`An account with this ${field} already exists`);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: { firstName, lastName, email, phone, passwordHash, role: UserRole.CUSTOMER },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isVerified: true,
          createdAt: true,
        },
      });

      const token = this.signToken({ sub: user.id, email: user.email, role: user.role });

      this.logger.log(`New user registered: ${user.email}`);

      return { user, accessToken: token };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Account already exists');
      }
      this.logger.error('Registration failed', err);
      throw new InternalServerErrorException('Registration failed. Please try again.');
    }
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const { email, password } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isActive: true,
        passwordHash: true,
      },
    });

    if (!user) {
      // Use the same message as wrong password to avoid user enumeration
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been suspended. Please contact support.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('This account uses social login. Please sign in with Google.');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login timestamp (fire-and-forget — non-blocking)
    void this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { passwordHash: _, ...safeUser } = user;
    const token = this.signToken({ sub: user.id, email: user.email, role: user.role });

    this.logger.log(`User logged in: ${user.email}`);

    return { user: safeUser, accessToken: token };
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        addresses: {
          select: {
            id: true,
            type: true,
            fullName: true,
            line1: true,
            line2: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            country: true,
            isDefault: true,
          },
          orderBy: { isDefault: 'desc' },
        },
      },
    });

    if (!user) throw new UnauthorizedException('User not found');

    return user;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private signToken(payload: JwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '7d'),
    });
  }
}
