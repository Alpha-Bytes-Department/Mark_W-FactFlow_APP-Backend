import { StatusCodes } from 'http-status-codes';
import ServerError from '@/errors/ServerError';
import { TWithdrawArgs } from './Payment.interface';
import { UserServices } from '../user/User.service';
import ora from 'ora';
import { prisma } from '@/utils/db';
import config from '@/config';
import { stripe } from './Payment.utils';
import chalk from 'chalk';

/**
 * Payment Services
 */
export const PaymentServices = {
  /**
   * Withdraw money
   *
   * @event withdraw
   */
  async withdraw({ amount, user }: TWithdrawArgs) {
    if (user.balance < amount) {
      throw new ServerError(
        StatusCodes.BAD_REQUEST,
        "You don't have enough balance",
      );
    }

    if (!user.is_stripe_connected) {
      throw new ServerError(
        StatusCodes.BAD_REQUEST,
        "You haven't connected your Stripe account",
      );
    }

    if (!user.stripe_account_id) {
      await UserServices.stripeAccountConnect(user.id);

      throw new ServerError(
        StatusCodes.ACCEPTED,
        'Stripe account connecting. Try again later!',
      );
    }

    await this.stripeWithdraw({ amount, user });
  },

  async stripeWithdraw(data: TWithdrawArgs) {
    const spinner = ora({
      color: 'yellow',
      text: `Withdrawing ${data.amount} from ${data.user.email}`,
    }).start();

    const user = await prisma.user.findUnique({
      where: { id: data.user.id },
      select: {
        balance: true,
        stripe_account_id: true,
      },
    });

    try {
      spinner.text = `Checking Stripe account and balance for ${data.user.email}`;

      if (!user?.stripe_account_id) {
        throw new Error('Stripe account not found');
      }

      //? ensure user has enough balance
      if (user.balance < data.amount) {
        throw new Error(
          `Insufficient balance, current balance: ${user.balance}, required balance: ${data.amount} ${config.payment.currency}`,
        );
      }

      spinner.text = `Transferring ${data.amount} ${config.payment.currency} to ${data.user.email}`;

      await stripe.transfers.create({
        amount: data.amount * 100,
        currency: config.payment.currency,
        destination: user.stripe_account_id,
        description: `Transfer to ${data.user.email}`,
      });

      spinner.text = `Retrieving balance for ${data.user.email}`;

      const balance = (
        await stripe.balance.retrieve({ stripeAccount: user.stripe_account_id })
      ).available.find(b => b.currency === config.payment.currency)?.amount;

      if (!balance) {
        throw new Error('Transfer failed');
      }

      spinner.text = `Payout ${balance / 100} ${config.payment.currency} to ${data.user.email}`;

      await stripe.payouts.create(
        { amount: balance, currency: config.payment.currency },
        { stripeAccount: user.stripe_account_id },
      );

      spinner.text = `Updating balance for ${data.user.email}`;

      await prisma.user.update({
        where: { id: data.user.id },
        data: { balance: { decrement: data.amount } },
      });

      spinner.succeed(
        chalk.green(
          `${data.amount} ${config.payment.currency} withdrawn successfully to ${data.user.email}`,
        ),
      );
    } catch (error) {
      if (error instanceof Error) {
        spinner.fail(chalk.red(`Withdrawal failed: ${error.message}`));
      }
    }
  },
};
