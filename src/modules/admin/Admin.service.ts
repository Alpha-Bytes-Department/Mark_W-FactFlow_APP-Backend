import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { Prisma, prisma } from '@/utils/db';
import { hashPassword } from '../auth/Auth.utils';
import { TAdminOverviewArgs } from './Admin.interface';
import { adminOverviewGroupBy } from './Admin.constant';

/**
 * Admin services
 */
export const AdminServices = {
  /**
   * Seeds the admin user if it doesn't exist in the database
   *
   * This function checks if an admin user already exists in the database.
   * If an admin user exists, it returns without creating a new one.
   * Otherwise, it prompts for admin credentials and creates a new admin user.
   */
  async seed() {
    const spinner = ora(
      chalk.yellow('Preparing to create admin user...'),
    ).start();

    try {
      spinner.stop();

      // Prompt for admin credentials
      console.log(chalk.cyan('\n📝 Enter admin credentials:\n'));

      const { name } = await inquirer.prompt<{ name: string }>([
        {
          type: 'input',
          name: 'name',
          message: 'Admin name:',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Name is required';
            }
            return true;
          },
        },
      ]);

      const { email } = await inquirer.prompt<{ email: string }>([
        {
          type: 'input',
          name: 'email',
          message: 'Admin email:',
          validate: (input: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input)) {
              return 'Please enter a valid email address';
            }
            return true;
          },
        },
      ]);

      const { password } = await inquirer.prompt<{ password: string }>([
        {
          type: 'password',
          name: 'password',
          message: 'Admin password:',
          mask: '*',
          validate: (input: string) => {
            if (input.length < 6) {
              return 'Password must be at least 6 characters long';
            }
            return true;
          },
        },
      ]);

      await inquirer.prompt<{ confirmPassword: string }>([
        {
          type: 'password',
          name: 'confirmPassword',
          message: 'Confirm password:',
          mask: '*',
          validate: (input: string) => {
            if (input !== password) {
              return 'Passwords do not match';
            }
            return true;
          },
        },
      ]);

      // Check if user with this email already exists
      const existingUser = await prisma.user.findFirst({ where: { email } });

      const hashedPassword = await hashPassword(password);

      if (existingUser) {
        spinner.warn(chalk.yellow('User with this email already exists!'));

        const { action } = await inquirer.prompt<{ action: string }>([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: 'Make this user an admin', value: 'upgrade' },
              { name: 'Cancel', value: 'cancel' },
            ],
          },
        ]);

        if (action === 'cancel') {
          spinner.info(chalk.blue('Operation cancelled.'));
          return;
        }

        spinner.start(chalk.yellow('⚙ Updating user to admin...'));

        // Update existing user to admin
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            password: hashedPassword,
            is_admin: true,
            is_active: true,
            is_verified: true,
          },
        });
      }

      spinner.succeed(chalk.green('Admin user created successfully!'));
    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to seed admin user: ${error.message}`));
      throw error;
    }
  },

  async overview({ end_date, group_by, start_date }: TAdminOverviewArgs) {
    const grouping: keyof typeof adminOverviewGroupBy =
      (group_by as any) || 'days';

    const now = new Date();
    let start: Date;
    let end: Date;

    if (start_date) {
      start = new Date(start_date);
    } else {
      if (grouping === 'days') {
        start = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0),
        );
      } else if (grouping === 'months') {
        start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
      } else {
        start = new Date(Date.UTC(now.getUTCFullYear() - 4, 0, 1, 0, 0, 0));
      }
    }

    if (end_date) {
      end = new Date(end_date);
    } else {
      if (grouping === 'days') {
        end = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59),
        );
      } else if (grouping === 'months') {
        end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59));
      } else {
        end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59));
      }
    }

    const whereUser: Prisma.UserWhereInput = {
      created_at: {
        gte: start,
        lte: end,
      },
    };

    const users = await prisma.user.findMany({
      where: whereUser,
      select: { created_at: true },
    });

    let labels: string[] = [];
    const countsMap = new Map<string, number>();

    if (grouping === 'days') {
      labels = adminOverviewGroupBy.days;
      for (const label of labels) countsMap.set(label, 0);
      for (const u of users) {
        const d = u.created_at.getUTCDate().toString();
        if (countsMap.has(d)) countsMap.set(d, (countsMap.get(d) || 0) + 1);
      }
    } else if (grouping === 'months') {
      labels = adminOverviewGroupBy.months;
      for (const label of labels) countsMap.set(label, 0);
      for (const u of users) {
        const m = u.created_at.toLocaleString('en-US', {
          month: 'short',
          timeZone: 'UTC',
        });
        if (countsMap.has(m)) countsMap.set(m, (countsMap.get(m) || 0) + 1);
      }
    } else {
      labels = [...adminOverviewGroupBy.years].reverse();
      for (const label of labels) countsMap.set(label, 0);
      for (const u of users) {
        const y = u.created_at.getUTCFullYear().toString();
        if (countsMap.has(y)) countsMap.set(y, (countsMap.get(y) || 0) + 1);
      }
    }

    const counts = labels.map(l => countsMap.get(l) || 0);
    const total = users.length;

    let growth_percentage: number | null = null;
    if (users.length > 1) {
      const midpoint = start.getTime() + (end.getTime() - start.getTime()) / 2;
      const firstHalf = users.filter(
        u => u.created_at.getTime() <= midpoint,
      ).length;
      const secondHalf = total - firstHalf;
      if (firstHalf > 0) {
        growth_percentage = ((secondHalf - firstHalf) / firstHalf) * 100;
      }
    }

    const total_user = await prisma.user.count();

    const total_income = await prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
    });

    const total_new_users = await prisma.user.count({
      where: {
        created_at: {
          gte: new Date(
            new Date().getFullYear(),
            new Date().getMonth() - 1,
            new Date().getDate(),
          ),
        },
      },
    });

    return {
      range: { start_date: start.toISOString(), end_date: end.toISOString() },
      group_by: grouping,
      labels,
      counts,
      growth_percentage,
      total_user,
      total_new_users,
      total_income: total_income._sum.amount || 0,
    };
  },
};
