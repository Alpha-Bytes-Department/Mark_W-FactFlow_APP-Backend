import { Router } from 'express';
import { UserRoutes } from '../user/User.route';
import { injectRoutes } from '@/utils/router/injectRouter';
import { SubscriptionRoutes } from '../subscription/Subscription.route';
import { UserActivityRoutes } from '../userActivity/UserActivity.route';
import { ContextPageRoutes } from '../contextPage/ContextPage.route';

const admin = injectRoutes(Router(), {
  '/users': [UserRoutes.admin],
  '/subscriptions': [SubscriptionRoutes.admin],
  '/user-activities': [UserActivityRoutes.admin],
  '/context-pages': [ContextPageRoutes.admin],
});

export const AdminRoutes = {
  /**
   * Only admin can access
   *
   * @url : (base_url)/admin/
   */
  admin,
};
