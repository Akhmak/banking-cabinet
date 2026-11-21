import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { BankAccount, BankCard, Transaction } from '../../models/bank.models';
import { MockBankService } from '../../services/mock-bank.service';

Chart.register(...registerables);

interface CategoryStat {
  category: string;
  amount: number;
  percent: number;
  color: string;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss',
})
export class AnalyticsPage implements AfterViewInit, OnDestroy {
  private bankService = inject(MockBankService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('doughnutCanvas') doughnutCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('barCanvas') barCanvas?: ElementRef<HTMLCanvasElement>;

  private doughnutChart?: Chart;
  private barChart?: Chart;
  private viewReady = false;

  accounts: BankAccount[] = [];
  cards: BankCard[] = [];
  allTransactions: Transaction[] = [];

  selectedAccountId = 'all';
  selectedDays: '7' | '30' | 'all' = '30';

  totalIncome = 0;
  totalExpense = 0;
  categoryStats: CategoryStat[] = [];

  private readonly palette = [
    '#2563eb',
    '#7c3aed',
    '#db2777',
    '#ea580c',
    '#16a34a',
    '#0891b2',
    '#ca8a04',
  ];

  ngAfterViewInit(): void {
    this.viewReady = true;

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
        this.recalculate();
      });
  }

  ngOnDestroy(): void {
    this.doughnutChart?.destroy();
    this.barChart?.destroy();
  }

  isAccountFrozen(accountId: string): boolean {
    const linked = this.cards.filter((c) => c.accountId === accountId);
    return linked.length > 0 && linked.some((c) => c.isBlocked);
  }

  recalculate(): void {
    const now = new Date();
    const filtered = this.allTransactions.filter((tx) => {
      if (this.selectedAccountId !== 'all' && tx.accountId !== this.selectedAccountId) {
        return false;
      }
      if (this.selectedDays !== 'all') {
        const days = Number(this.selectedDays);
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - days);
        if (new Date(tx.date) < cutoff) return false;
      }
      return true;
    });

    this.totalIncome = filtered
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = filtered.filter((t) => t.type === 'expense' || t.type === 'transfer');
    this.totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);

    const grouped = new Map<string, number>();
    for (const tx of expenses) {
      grouped.set(tx.category, (grouped.get(tx.category) || 0) + tx.amount);
    }

    this.categoryStats = Array.from(grouped.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount], idx) => ({
        category,
        amount,
        percent: this.totalExpense > 0 ? Math.round((amount / this.totalExpense) * 100) : 0,
        color: this.palette[idx % this.palette.length],
      }));

    if (this.viewReady) {
      this.renderCharts();
    }
    this.cdr.markForCheck();
  }

  private renderCharts(): void {
    this.doughnutChart?.destroy();
    this.barChart?.destroy();

    if (this.doughnutCanvas && this.categoryStats.length > 0) {
      this.doughnutChart = new Chart(this.doughnutCanvas.nativeElement, {
        type: 'doughnut',
        data: {
          labels: this.categoryStats.map((c) => c.category),
          datasets: [
            {
              data: this.categoryStats.map((c) => c.amount),
              backgroundColor: this.categoryStats.map((c) => c.color),
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, padding: 14 },
            },
          },
        },
      });
    }

    if (this.barCanvas) {
      this.barChart = new Chart(this.barCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: ['Доходы', 'Расходы'],
          datasets: [
            {
              label: 'Сумма (₽)',
              data: [this.totalIncome, this.totalExpense],
              backgroundColor: ['#16a34a', '#2563eb'],
              borderRadius: 10,
              barThickness: 56,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
            },
            x: {
              grid: { display: false },
            },
          },
        },
      });
    }
  }
}
