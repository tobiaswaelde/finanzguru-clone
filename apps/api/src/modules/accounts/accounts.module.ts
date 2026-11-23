import { Module } from '@nestjs/common';
import { ImportModule } from '../import/import.module.js';
import { ManualTransactionService } from '../transactions/manual-transaction.service.js';
import { TransactionsController } from '../transactions/transactions.controller.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

/** Registers account lookup and the account-scoped review count. */
@Module({
  controllers: [AccountsController, TransactionsController],
  imports: [ImportModule],
  providers: [AccountsService, ManualTransactionService],
  exports: [AccountsService],
})
export class AccountsModule {}
