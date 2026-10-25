import catchAsync from '@/middlewares/catchAsync';
import { errorLogger } from '@/utils/logger';
import chalk from 'chalk';
import { RevenueCatServices } from './RevenueCat.service';
import { StatusCodes } from 'http-status-codes';

export const RevenueCatControllers = {
  /**
   * Handle incoming RevenueCat webhook
   */
  webhook: catchAsync(
    async ({ body, headers }, res) => {
      const authHeader = (headers.authorization ||
        headers['x-revenuecat-webhook-auth']) as string | undefined;

      const result = await RevenueCatServices.handleWebhook(body, authHeader);

      res.status(StatusCodes.OK).json({
        received: true,
        ...result,
      });
    },
    (error, _req, res, next) => {
      errorLogger.error(
        chalk.red('🚨 RevenueCat Webhook Error ~~ '),
        error.message,
        JSON.stringify(error.stack, null, 2),
      );

      // Return status code if it is a ServerError (e.g. 401 unauthorized)
      if (error?.statusCode) {
        return res.status(error.statusCode).json({
          received: false,
          message: error.message,
        });
      }

      next(error);
    },
  ),

  /**
   * Sync active subscription for authenticated user
   */
  sync: catchAsync(async ({ user, body }) => {
    const data = await RevenueCatServices.syncSubscription(user, body);

    return {
      message: 'Subscription synced successfully',
      data,
    };
  }),

  /**
   * Get subscription status for authenticated user
   */
  status: catchAsync(async ({ user }) => {
    const data = await RevenueCatServices.getSubscriptionStatus(user.id);

    return {
      message: 'Subscription status retrieved successfully',
      data,
    };
  }),
};
