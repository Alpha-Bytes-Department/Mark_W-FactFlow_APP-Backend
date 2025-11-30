import { exists } from '@/utils/db/exists';
import z from 'zod';

export const UserActivityValidations = {
  toggleReadStatus: z.object({
    body: z.object({
      activity_id: z
        .string()
        .optional()
        .refine(exists('userActivity'), {
          error: ({ input }) => `Activity with id ${input} does not exist.`,
        }),
      unread: z.boolean().default(false),
    }),
  }),

  deleteActivity: z.object({
    body: z.object({
      activity_id: z
        .string()
        .optional()
        .refine(exists('userActivity'), {
          error: ({ input }) => `Activity with id ${input} does not exist.`,
        }),
    }),
  }),

  getAllActivity: z.object({
    query: z.object({
      user_id: z
        .string()
        .optional()
        .refine(exists('user'), {
          error: ({ input }) => `User with id ${input} does not exist.`,
        }),
      unread: z.boolean().optional(),
      start_date: z.iso.date().optional(),
      end_date: z.iso.date().optional(),
    }),
  }),
};
