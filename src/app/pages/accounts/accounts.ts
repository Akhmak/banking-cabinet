import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { BankAccount, BankCard } from '../../models/bank.models';
import { MockBankService } from '../../services/mock-bank.service';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
})
export class AccountsPage {
  private bankService = inject(MockBankService);
  private cdr = inject(ChangeDetectorRef);

  vm$ = combineLatest([
    this.bankService.accounts$,
    this.bankService.cards$,
    this.bankService.transactions$,
  ]).pipe(
    map(([accounts, cards, transactions]) => {
      const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
      const frozenBalance = accounts
        .filter((acc) => this.isAccountFrozen(cards, acc.id))
        .reduce((sum, acc) => sum + acc.balance, 0);
      const availableBalance = Number((totalBalance - frozenBalance).toFixed(2));

      return {
        accounts,
        cards,
        recentTransactions: transactions.slice(0, 5),
        totalBalance,
        frozenBalance,
        availableBalance,
      };
    })
  );

  revealedCardIds = new Set<string>();
  copiedAccountId: string | null = null;

  getAccount(accounts: BankAccount[], accountId: string): BankAccount | undefined {
    return accounts.find((a) => a.id === accountId);
  }

  getCardsByAccount(cards: BankCard[], accountId: string): BankCard[] {
    return cards.filter((c) => c.accountId === accountId);
  }

  isAccountFrozen(cards: BankCard[], accountId: string): boolean {
    const linked = cards.filter((c) => c.accountId === accountId);
    return linked.length > 0 && linked.some((c) => c.isBlocked);
  }

  toggleRevealCard(cardId: string): void {
    if (this.revealedCardIds.has(cardId)) {
      this.revealedCardIds.delete(cardId);
    } else {
      this.revealedCardIds.add(cardId);
    }
  }

  onToggleBlock(cardId: string): void {
    this.bankService.toggleCardBlock(cardId).subscribe({
      next: () => this.cdr.markForCheck(),
    });
  }

  copyAccountNumber(accountId: string, accountNumber: string): void {
    navigator.clipboard.writeText(accountNumber);
    this.copiedAccountId = accountId;
    setTimeout(() => {
      if (this.copiedAccountId === accountId) {
        this.copiedAccountId = null;
        this.cdr.markForCheck();
      }
    }, 2000);
  }
}
