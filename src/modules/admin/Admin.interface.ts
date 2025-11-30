import z from 'zod';
import { AdminValidations } from './Admin.validation';

export type TAdminOverviewArgs = z.infer<
  typeof AdminValidations.overview
>['body'];
