import { Router } from 'express';
import { UserRoutes } from '../user/User.route';
import { injectRoutes } from '@/utils/router/injectRouter';
import { SubscriptionRoutes } from '../subscription/Subscription.route';
import { UserActivityRoutes } from '../userActivity/UserActivity.route';
import { ContextPageRoutes } from '../contextPage/ContextPage.route';
import { AdminControllers } from './Admin.controller';
import purifyRequest from '@/middlewares/purifyRequest';
import { AdminValidations } from './Admin.validation';

const admin = injectRoutes(Router(), {
  '/users': [UserRoutes.admin],
  '/subscriptions': [SubscriptionRoutes.admin],
  '/user-activities': [UserActivityRoutes.admin],
  '/context-pages': [ContextPageRoutes.admin],
});
{
  admin.get(
    '/overview',
    purifyRequest(AdminValidations.overview),
    AdminControllers.overview,
  );
}

export const AdminRoutes = {
  /**
   * Only admin can access
   *
   * @url : (base_url)/admin/
   */
  admin,
};
