import { Router } from 'express';
import auth from '@/middlewares/auth';
import { AdminRoutes } from '@/modules/admin/Admin.route';
import { AuthRoutes } from '@/modules/auth/Auth.route';
import { UserRoutes } from '@/modules/user/User.route';
import { injectRoutes } from '@/utils/router/injectRouter';
import { ChatRoutes } from '@/modules/chat/Chat.route';
import { MessageRoutes } from '@/modules/message/Message.route';
import { PaymentRoutes } from '@/modules/payment/Payment.route';
import { SubscriptionRoutes } from '@/modules/subscription/Subscription.route';
import { TransactionRoutes } from '@/modules/transaction/Transaction.route';
import { authRateLimiter } from '@/modules/auth/Auth.utils';

const appRouter = Router();

//? Media upload endpoint
//! Disabled for now
// appRouter.post(
//   '/upload-media',
//   auth.all,
//   capture({
//     any: {
//       maxCount: 10,
//       fileType: 'any',
//       size: 256 * 1024 * 1024, //? max 256 MB
//     },
//   }),
//   catchAsync(({ body }) => {
//     return {
//       message: 'Media uploaded successfully!',
//       data: body,
//     };
//   }),
// );

export default injectRoutes(appRouter, {
  // no auth required
  '/auth': [authRateLimiter, AuthRoutes.free],
  '/payments': [PaymentRoutes.free],
  '/subscriptions': [SubscriptionRoutes.free],

  // all user can access
  '/profile': [auth.default, UserRoutes.all],
  '/transactions': [auth.all, TransactionRoutes.all],
  '/inbox': [auth.all, ChatRoutes.all],
  '/messages': [auth.all, MessageRoutes.all],

  // only admin can access
  '/admin': [auth.admin, AdminRoutes.admin],
});
