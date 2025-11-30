import z from 'zod';
import { adminOverviewGroupBy } from './Admin.constant';

export const AdminValidations = {
  overview: z.object({
    body: z.object({
      start_date: z.iso.datetime().optional(),
      end_date: z.iso.datetime().optional(),
      group_by: z.enum(Object.keys(adminOverviewGroupBy)).optional(),
    }),
  }),
};
