import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { BankAccount, BankCard, ExpenseCategory, Transaction } from '../../models/bank.models';
import { MockBankService } from '../../services/mock-bank.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class HistoryPage implements OnInit {
  private bankService = inject(MockBankService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  accounts: BankAccount[] = [];
  cards: BankCard[] = [];
  allTransactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  selectedTx: Transaction | null = null;

  searchQuery = '';
  accountId = 'all';
  txType: 'all' | 'income' | 'expense' | 'transfer' = 'all';
  category: 'all' | ExpenseCategory = 'all';
  dateFrom = '';
  dateTo = '';

  categories: ExpenseCategory[] = [
    'Продукты',
    'Транспорт',
    'Кафе и рестораны',
    'ЖКХ и связь',
    'Переводы',
    'Развлечения',
    'Пополнение',
  ];

  ngOnInit(): void {
    combineLatest([
      this.bankService.accounts$,
      this.bankService.cards$,
      this.bankService.transactions$,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([accounts, cards, transactions]) => {
        this.accounts = accounts;
        this.cards = cards;
        this.allTransactions = transactions;
        this.applyFilters();
      });
  }

  isAccountFrozen(accountId: string): boolean {
    const linked = this.cards.filter((c) => c.accountId === accountId);
    return linked.length > 0 && linked.some((c) => c.isBlocked);
  }

  applyFilters(): void {
    const query = this.searchQuery.trim().toLowerCase();

    this.filteredTransactions = this.allTransactions.filter((tx) => {
      if (this.accountId !== 'all' && tx.accountId !== this.accountId) return false;
      if (this.txType !== 'all' && tx.type !== this.txType) return false;
      if (this.category !== 'all' && tx.category !== this.category) return false;

      if (this.dateFrom) {
        const from = new Date(this.dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(tx.date) < from) return false;
      }

      if (this.dateTo) {
        const to = new Date(this.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(tx.date) > to) return false;
      }

      if (query) {
        const hay = `${tx.title} ${tx.recipientOrSender} ${tx.comment || ''} ${tx.category}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }

      return true;
    });

    this.cdr.markForCheck();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.accountId = 'all';
    this.txType = 'all';
    this.category = 'all';
    this.dateFrom = '';
    this.dateTo = '';
    this.applyFilters();
  }

  get filteredIncome(): number {
    return this.filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
  }

  get filteredExpense(): number {
    return this.filteredTransactions
      .filter((t) => t.type !== 'income')
      .reduce((s, t) => s + t.amount, 0);
  }

  getAccountName(accId: string): string {
    return this.accounts.find((a) => a.id === accId)?.name || 'Счёт';
  }

  getTypeLabel(type: Transaction['type']): string {
    if (type === 'income') return 'Пополнение';
    if (type === 'transfer') return 'Перевод';
    return 'Оплата';
  }

  exportCsv(): void {
    const headers = ['ID', 'Дата', 'Счёт', 'Операция', 'Контрагент', 'Категория', 'Тип', 'Сумма (RUB)'];
    const rows = this.filteredTransactions.map((tx) => [
      tx.id,
      new Date(tx.date).toLocaleString('ru-RU'),
      this.getAccountName(tx.accountId),
      `"${tx.title.replace(/"/g, '""')}"`,
      `"${tx.recipientOrSender.replace(/"/g, '""')}"`,
      tx.category,
      this.getTypeLabel(tx.type),
      (tx.type === 'income' ? tx.amount : -tx.amount).toFixed(2),
    ]);

    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `statement_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
