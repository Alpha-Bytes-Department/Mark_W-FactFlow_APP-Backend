import type { TList } from '../query/Query.interface';
import {
  userSearchableFields as searchFields,
  userSelfOmit,
} from './User.constant';
import { EUserRole, Prisma, prisma, User as TUser } from '@/utils/db';
import { TPagination } from '@/utils/server/serveResponse';
import type { TUserEdit } from './User.interface';
import ServerError from '@/errors/ServerError';
import { StatusCodes } from 'http-status-codes';
import { hashPassword } from '../auth/Auth.utils';
import { generateOTP } from '@/utils/crypto/otp';
import { errorLogger } from '@/utils/logger';
import { emailTemplate } from '@/templates/emailTemplate';
import config from '@/config';
import { ZodError } from 'zod';
import { sendEmail } from '@/utils/sendMail';
import { deleteFiles } from '@/middlewares/capture';
import ora from 'ora';
import Stripe from 'stripe';
import { stripe } from '../payment/Payment.utils';
import chalk from 'chalk';

/**
 * User services
 */
export const UserServices = {
  /**
   * Get next user id
   */
  async getNextUserId(
    where:
      | { role: EUserRole; is_admin?: never }
      | { role?: never; is_admin: true },
  ): Promise<string> {
    const prefix = where.role ? where.role.toLowerCase().slice(0, 2) : 'su';

    const user = await prisma.user.findFirst({
      where,
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });

    if (!user) return `${prefix}-1`;

    const currSL = parseInt(user.id.split('-')[1], 10);
    return `${prefix}-${currSL + 1}`;
  },

  /**
   * Register user and send otp
   */
  async register({
    email,
    phone,
    role,
    password,
    ...payload
  }: Omit<Prisma.UserCreateInput, 'id'>) {
    if (!(payload.google_id || payload.fb_id || email || phone)) {
      throw new ZodError(
        ['email', 'phone'].map(field => ({
          code: 'custom',
          message: `Either 'email' or 'phone' is required`,
          path: [field],
        })),
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });

    // Check if verified user already exists
    if (!payload.is_admin && existingUser?.is_verified) {
      throw new ServerError(
        StatusCodes.CONFLICT,
        `${existingUser.role} already exists with this ${existingUser?.email ? email : existingUser.phone ? phone : 'unknown'}.`,
      );
    }

    const hashedPassword = password && (await hashPassword(password));

    const omitFields = {
      ...userSelfOmit[role ?? EUserRole.USER],
      otp_id: false,
      stripe_account_id: false,
    };

    // Update existing unverified user or create new one
    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: { role, password: hashedPassword, ...payload },
          omit: omitFields,
        })
      : await prisma.user.create({
          data: {
            //? Generate user id based on role
            id: await UserServices.getNextUserId(
              payload.is_admin
                ? { is_admin: true }
                : {
                    role: role ?? EUserRole.USER,
                  },
            ),
            email,
            phone,
            role,
            password: hashedPassword,
            ...payload,
          },
          omit: omitFields,
        });

    // Send verification OTP email
    if (!user.is_verified) {
      if (user.email) {
        const otp = generateOTP({
          tokenType: 'access_token',
          otpId: user.id + user.otp_id,
        });

        sendEmail({
          to: user.email,
          subject: `Your ${config.server.name} Account Verification OTP is ⚡ ${otp} ⚡.`,
          html: await emailTemplate({
            userName: user.name,
            otp,
            template: 'account_verify',
          }),
        }).catch(err =>
          errorLogger.error('Failed to send verification email:', err),
        );
      }

      // TODO: do for phone sms as well
    }

    return {
      ...user,
      otp_id: undefined,
      stripe_account_id: undefined,
    };
  },

  async updateUser({ user, body }: { user: Partial<TUser>; body: TUserEdit }) {
    const data: Prisma.UserUpdateInput = body;

    if (body.avatar && user.avatar) {
      deleteFiles([user.avatar]).catch(err =>
        errorLogger.error('Failed to delete old avatar:', err),
      );
    }

    if (body.role && body.role !== user.role)
      data.id = await this.getNextUserId({ role: body.role });

    return prisma.user.update({
      where: { id: user.id },
      omit: userSelfOmit[body.role ?? user.role ?? EUserRole.USER],
      data,
    });
  },

  /**
   * Get all users with pagination and search
   */
  async getAllUser({ page, limit, search, role }: TList & { role: EUserRole }) {
    const where: Prisma.UserWhereInput = { role };

    if (search)
      where.OR = searchFields.map(field => ({
        [field]: {
          contains: search,
          mode: 'insensitive',
        },
      }));

    const users = await prisma.user.findMany({
      where,
      omit: userSelfOmit[role],
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.user.count({ where });

    return {
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        } as TPagination,
      },
      users,
    };
  },

  async getUserById({
    userId,
    omit = undefined,
  }: {
    userId: string;
    omit?: Prisma.UserOmit;
  }) {
    return prisma.user.findUnique({
      where: { id: userId },
      omit,
    });
  },

  async getUsersCount() {
    const counts = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        _all: true,
      },
    });

    return Object.fromEntries(
      counts.map(({ role, _count }: any) => [role, _count._all]),
    );
  },

  async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user?.avatar) {
      deleteFiles([user.avatar]).catch(err =>
        errorLogger.error('Failed to delete user avatar:', err),
      );
    }

    return prisma.user.delete({ where: { id: userId } });
  },

  async stripeAccountConnect(user_id: string) {
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      select: {
        stripe_account_id: true,
        email: true,
      },
    });

    if (!user) return;

    if (!user.stripe_account_id) {
      const spinner = ora({
        color: 'yellow',
        text: `Checking Stripe account for ${user.email}`,
      }).start();

      try {
        const accountPayload: Stripe.AccountCreateParams = {
          type: 'express',
          capabilities: {
            transfers: { requested: true },
          },
        };

        if (user.email) {
          accountPayload.email = user.email;
        }

        const stripeAccount = await stripe.accounts.create(accountPayload);

        await prisma.user.update({
          where: { id: user_id },
          data: { stripe_account_id: stripeAccount.id },
        });

        spinner.succeed(`Stripe account created for ${user.email}`);
      } catch (error) {
        spinner.fail(`Failed creating Stripe account for ${user.email}`);

        errorLogger.error(
          chalk.red(`Error creating Stripe account for ${user.email}`),
          error,
        );
      }
    }
  },
};
