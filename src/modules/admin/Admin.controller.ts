import catchAsync from '@/middlewares/catchAsync';
import { AdminServices } from './Admin.service';

export const AdminControllers = {
  overview: catchAsync(async ({ body }) => {
    const data = await AdminServices.overview(body);

    return {
      message: 'Admin overview fetched successfully',
      data,
    };
  }),
};
