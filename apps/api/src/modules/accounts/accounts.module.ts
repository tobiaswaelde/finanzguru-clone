import { Module } from '@nestjs/common';
import { TransactionsController } from '../transactions/transactions.controller.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

/** Registers account lookup and the account-scoped review count. */
@Module({
  controllers: [AccountsController, TransactionsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
