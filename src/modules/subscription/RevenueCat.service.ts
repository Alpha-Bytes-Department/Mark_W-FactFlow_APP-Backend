import { StatusCodes } from 'http-status-codes';
import ServerError from '@/errors/ServerError';
import config from '@/config';
import { prisma, User as TUser } from '@/utils/db';
import { logger } from '@/utils/logger';
import chalk from 'chalk';
import axios from 'axios';
import {
  TRevenueCatSyncPayload,
  TRevenueCatWebhookEvent,
  TSubscriptionStatusResponse,
} from './RevenueCat.interface';

export const RevenueCatServices = {
  /**
   * Handle incoming RevenueCat Webhook
   */
  async handleWebhook(
    payload: TRevenueCatWebhookEvent,
    authHeader?: string,
  ): Promise<{ message: string }> {
    // 1. Verify webhook authorization if auth key is configured
    const configuredAuthKey = config.payment.revenuecat.webhook_auth_key;
    if (configuredAuthKey) {
      const incomingToken = authHeader?.trim();
      const validBearer = `Bearer ${configuredAuthKey}`;

      if (
        incomingToken !== configuredAuthKey &&
        incomingToken !== validBearer
      ) {
        throw new ServerError(
          StatusCodes.UNAUTHORIZED,
          'Invalid RevenueCat webhook authorization',
        );
      }
    }

    const { event } = payload;

    console.log(JSON.stringify(event));

    if (!event) {
      return { message: 'No event object found in payload' };
    }

    // 2. Handle TEST event from RevenueCat dashboard
    if (event.type === 'TEST') {
      logger.info(
        chalk.cyan('🔔 RevenueCat test webhook event received successfully!'),
      );
      return { message: 'Test event received successfully' };
    }

    // 3. Handle TRANSFER event
    // Note: RevenueCat TRANSFER events do not send app_user_id.
    // Instead they provide transferred_from and transferred_to arrays.
    if (event.type === 'TRANSFER') {
      const fromIds = (event.transferred_from || []).filter(
        (id): id is string => Boolean(id && typeof id === 'string'),
      );
      const toIds = (event.transferred_to || []).filter(
        (id): id is string => Boolean(id && typeof id === 'string'),
      );

      const fromUser = fromIds.length
        ? await prisma.user.findFirst({
            where: {
              OR: [
                { id: { in: fromIds } },
                { revenuecat_customer_id: { in: fromIds } },
              ],
            },
          })
        : null;

      const toUser = toIds.length
        ? await prisma.user.findFirst({
            where: {
              OR: [
                { id: { in: toIds } },
                { revenuecat_customer_id: { in: toIds } },
              ],
            },
          })
        : null;

      // Revoke from previous owner
      if (fromUser) {
        await prisma.user.update({
          where: { id: fromUser.id },
          data: {
            subscription_name: null,
            subscription_expires_at: new Date(),
          },
        });
        logger.info(
          chalk.yellow(
            `🔄 RevenueCat [TRANSFER]: Subscription revoked from previous user ${chalk.bold(fromUser.id)} (${fromUser.email ?? 'no email'})`,
          ),
        );
      }

      // Grant to new owner
      if (toUser) {
        const transferredSubName =
          fromUser?.subscription_name ||
          event.entitlement_id ||
          (event.entitlement_ids && event.entitlement_ids.length > 0
            ? event.entitlement_ids[0]
            : null) ||
          event.product_id ||
          'Active Subscription';

        const transferredExpiresAt =
          fromUser?.subscription_expires_at &&
          fromUser.subscription_expires_at > new Date()
            ? fromUser.subscription_expires_at
            : event.expiration_at_ms
              ? new Date(event.expiration_at_ms)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await prisma.user.update({
          where: { id: toUser.id },
          data: {
            is_active: true,
            subscription_name: transferredSubName,
            subscription_expires_at: transferredExpiresAt,
            revenuecat_customer_id: toUser.id,
          },
        });

        logger.info(
          chalk.green(
            `🔄 RevenueCat [TRANSFER]: Subscription transferred to user ${chalk.bold(toUser.id)} (${toUser.email ?? 'no email'}) until ${transferredExpiresAt.toISOString()}`,
          ),
        );
      } else {
        logger.warn(
          chalk.yellow(
            `⚠️ RevenueCat [TRANSFER]: Target user not found for IDs: ${toIds.join(', ')}`,
          ),
        );
      }

      return { message: 'Transfer processed successfully' };
    }

    // 4. Find user by app_user_id, original_app_user_id, or aliases
    const candidateIds = [
      event.app_user_id,
      event.original_app_user_id,
      ...(event.aliases || []),
    ].filter((id): id is string => Boolean(id && typeof id === 'string'));

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: { in: candidateIds } },
          { revenuecat_customer_id: { in: candidateIds } },
        ],
      },
    });

    if (!user) {
      logger.warn(
        chalk.yellow(
          `⚠️ RevenueCat webhook: User not found for app_user_id: "${event.app_user_id ?? candidateIds.join(', ')}"`,
        ),
      );
      return { message: 'User not found, webhook acknowledged' };
    }

    const subscriptionName =
      event.entitlement_id ||
      (event.entitlement_ids && event.entitlement_ids.length > 0
        ? event.entitlement_ids[0]
        : null) ||
      event.product_id ||
      'Active Subscription';

    // 4. Handle event types
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
      case 'UNCANCELLATION':
      case 'SUBSCRIPTION_EXTENDED':
      case 'NON_RENEWING_PURCHASE': {
        const expirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms)
          : new Date('2099-12-31');

        await prisma.user.update({
          where: { id: user.id },
          data: {
            is_active: true,
            subscription_name: subscriptionName,
            subscription_expires_at: expirationDate,
            revenuecat_customer_id:
              event.original_app_user_id || event.app_user_id,
          },
        });

        logger.info(
          chalk.green(
            `🎉 RevenueCat [${event.type}]: User ${chalk.bold(user.id)} (${user.email ?? 'no email'}) subscribed to "${subscriptionName}" until ${expirationDate.toISOString()}`,
          ),
        );
        break;
      }

      case 'EXPIRATION': {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscription_name: null,
            subscription_expires_at: event.expiration_at_ms
              ? new Date(event.expiration_at_ms)
              : new Date(),
          },
        });

        logger.info(
          chalk.yellow(
            `⌛ RevenueCat [EXPIRATION]: User ${chalk.bold(user.id)} subscription expired`,
          ),
        );
        break;
      }

      case 'CANCELLATION': {
        const hasFutureExpiry =
          event.expiration_at_ms &&
          new Date(event.expiration_at_ms) > new Date();

        if (hasFutureExpiry && event.cancel_reason !== 'CUSTOMER_SUPPORT') {
          // Auto-renewal cancelled, user keeps access until expiration
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscription_expires_at: new Date(event.expiration_at_ms!),
            },
          });
          logger.info(
            chalk.yellow(
              `⚠️ RevenueCat [CANCELLATION]: User ${chalk.bold(user.id)} auto-renewal cancelled. Retains access until ${new Date(event.expiration_at_ms!).toISOString()}`,
            ),
          );
        } else {
          // Refunded or immediate cancellation
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscription_name: null,
              subscription_expires_at: new Date(),
            },
          });
          logger.info(
            chalk.red(
              `❌ RevenueCat [CANCELLATION]: User ${chalk.bold(user.id)} subscription revoked immediately`,
            ),
          );
        }
        break;
      }

      case 'BILLING_ISSUE': {
        logger.warn(
          chalk.yellow(
            `⚠️ RevenueCat [BILLING_ISSUE]: Billing problem for user ${chalk.bold(user.id)} (${user.email ?? 'no email'})`,
          ),
        );
        break;
      }


      default: {
        logger.info(
          chalk.blue(
            `ℹ️ RevenueCat webhook unhandled event type: "${event.type}" for user ${user.id}`,
          ),
        );
      }
    }

    return { message: 'Webhook processed successfully' };
  },

  /**
   * Sync user subscription directly from RevenueCat REST API or from Flutter payload
   */
  async syncSubscription(
    user: TUser,
    payload?: TRevenueCatSyncPayload,
  ): Promise<TSubscriptionStatusResponse> {
    console.log(JSON.stringify(payload, null, 2));

    const secretKey = config.payment.revenuecat.secret_key;
    let syncedViaApi = false;

    // 1. Try querying RevenueCat REST API if API Secret Key is provided
    if (secretKey) {
      try {
        const response = await axios.get(
          `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
          {
            headers: {
              Authorization: `Bearer ${secretKey}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            timeout: 7000,
          },
        );

        const entitlements = response.data?.subscriber?.entitlements || {};
        const activeEntry = Object.entries(entitlements).find(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ([_, val]: [string, any]) =>
            !val.expires_date || new Date(val.expires_date) > new Date(),
        );

        if (activeEntry) {
          const [entitlementName, val] = activeEntry as [string, any];
          const expiresAt = val.expires_date
            ? new Date(val.expires_date)
            : new Date('2099-12-31');

          await prisma.user.update({
            where: { id: user.id },
            data: {
              is_active: true,
              subscription_name: entitlementName,
              subscription_expires_at: expiresAt,
              revenuecat_customer_id: user.id,
            },
          });
          syncedViaApi = true;
        } else {
          // No active entitlement found in RevenueCat
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscription_name: null,
              subscription_expires_at: new Date(),
            },
          });
          syncedViaApi = true;
        }
      } catch (err: any) {
        logger.warn(
          chalk.yellow(
            `Could not sync directly with RevenueCat API: ${err.message}`,
          ),
        );
      }
    }

    // 2. If API sync did not run/succeed, update from Flutter client payload
    if (!syncedViaApi && (payload?.entitlement_id || payload?.product_id)) {
      const subName = payload.entitlement_id || payload.product_id!;
      const expiresAt = payload.expiration_at_ms
        ? new Date(payload.expiration_at_ms)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          is_active: true,
          subscription_name: subName,
          subscription_expires_at: expiresAt,
          revenuecat_customer_id: user.id,
        },
      });
    }

    return this.getSubscriptionStatus(user.id);
  },

  /**
   * Get current subscription status for a user
   */
  async getSubscriptionStatus(
    userId: string,
  ): Promise<TSubscriptionStatusResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscription_name: true,
        subscription_expires_at: true,
      },
    });

    const isSubscribed = Boolean(
      user?.subscription_name &&
        user?.subscription_expires_at &&
        user.subscription_expires_at > new Date(),
    );

    const daysRemaining =
      user?.subscription_expires_at && isSubscribed
        ? Math.max(
            0,
            Math.ceil(
              (user.subscription_expires_at.getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 0;

    return {
      is_subscribed: isSubscribed,
      subscription_name: isSubscribed
        ? (user?.subscription_name ?? null)
        : null,
      subscription_expires_at: user?.subscription_expires_at ?? null,
      days_remaining: daysRemaining,
    };
  },
};
