import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';
import {
  BankAccount,
  BankCard,
  PaymentTemplate,
  Transaction,
  TransferPayload,
} from '../models/bank.models';

interface BankState {
  accounts: BankAccount[];
  cards: BankCard[];
  transactions: Transaction[];
  templates: PaymentTemplate[];
}

const STORAGE_KEY = 'demo_bank_state_v1';

@Injectable({
  providedIn: 'root',
})
export class MockBankService {
  private readonly initialState: BankState = {
    accounts: [
      {
        id: 'acc-1',
        name: 'Основной рублёвый счёт',
        accountNumber: '40817810099910004321',
        balance: 148520.5,
        currency: 'RUB',
        type: 'debit',
      },
      {
        id: 'acc-3',
        name: 'Счёт «Travel»',
        accountNumber: '40817810099910005577',
        balance: 45200.0,
        currency: 'RUB',
        type: 'debit',
      },
      {
        id: 'acc-2',
        name: 'Накопительный счёт «Цель»',
        accountNumber: '40817810099910008899',
        balance: 320000.0,
        currency: 'RUB',
        type: 'savings',
      },
    ],
    cards: [
      {
        id: 'card-1',
        accountId: 'acc-1',
        name: 'Nova Black МИР',
        maskedNumber: '•••• 4829',
        fullNumber: '2200 7001 4412 4829',
        expiry: '09/28',
        paymentSystem: 'MIR',
        colorGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        isBlocked: false,
      },
      {
        id: 'card-2',
        accountId: 'acc-3',
        name: 'Цифровая VISA Travel',
        maskedNumber: '•••• 9104',
        fullNumber: '4276 3800 1122 9104',
        expiry: '12/27',
        paymentSystem: 'VISA',
        colorGradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        isBlocked: false,
      },
    ],
    transactions: [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        date: this.daysAgo(0),
        title: 'Перекрёсток',
        recipientOrSender: 'ООО «Торговый дом Перекрёсток»',
        amount: 3420.5,
        type: 'expense',
        category: 'Продукты',
        status: 'completed',
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        date: this.daysAgo(1),
        title: 'Яндекс Go',
        recipientOrSender: 'Яндекс.Такси',
        amount: 680,
        type: 'expense',
        category: 'Транспорт',
        status: 'completed',
      },
      {
        id: 'tx-3',
        accountId: 'acc-1',
        date: this.daysAgo(2),
        title: 'Зарплата',
        recipientOrSender: 'ООО «ТехноСофт»',
        amount: 95000,
        type: 'income',
        category: 'Пополнение',
        status: 'completed',
      },
      {
        id: 'tx-4',
        accountId: 'acc-3',
        date: this.daysAgo(3),
        title: 'Кофемания',
        recipientOrSender: 'Ресторан Кофемания',
        amount: 2150,
        type: 'expense',
        category: 'Кафе и рестораны',
        status: 'completed',
      },
      {
        id: 'tx-5',
        accountId: 'acc-1',
        date: this.daysAgo(5),
        title: 'Оплата ЖКХ и интернета',
        recipientOrSender: 'МосОблЕИРЦ / Ростелеком',
        amount: 6450,
        type: 'expense',
        category: 'ЖКХ и связь',
        status: 'completed',
      },
      {
        id: 'tx-6',
        accountId: 'acc-3',
        date: this.daysAgo(7),
        title: 'Кинотеатр КАРО',
        recipientOrSender: 'КАРО Фильм',
        amount: 1400,
        type: 'expense',
        category: 'Развлечения',
        status: 'completed',
      },
      {
        id: 'tx-7',
        accountId: 'acc-1',
        date: this.daysAgo(10),
        title: 'Перевод Алексею К.',
        recipientOrSender: 'Алексей К.',
        amount: 5000,
        type: 'transfer',
        category: 'Переводы',
        status: 'completed',
        comment: 'Возврат за ужин',
      },
    ],
    templates: [
      {
        id: 'tpl-1',
        name: 'Оплата интернета',
        fromAccountId: 'acc-1',
        recipientName: 'ПАО Ростелеком',
        recipientTarget: '40702810500000012345',
        amount: 850,
        category: 'ЖКХ и связь',
        comment: 'Лицевой счёт №774910',
      },
      {
        id: 'tpl-2',
        name: 'Перевод маме',
        fromAccountId: 'acc-1',
        recipientName: 'Елена Ивановна С.',
        recipientTarget: '4276380012345679',
        amount: 5000,
        category: 'Переводы',
        comment: 'На продукты',
      },
    ],
  };

  private stateSubject = new BehaviorSubject<BankState>(this.loadState());
  public state$ = this.stateSubject.asObservable();

  public accounts$ = this.state$.pipe(map((s) => s.accounts));
  public cards$ = this.state$.pipe(map((s) => s.cards));
  public transactions$ = this.state$.pipe(map((s) => s.transactions));
  public templates$ = this.state$.pipe(map((s) => s.templates));

  private daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }

  private loadState(): BankState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // игнорируем ошибки парсинга
    }
    return structuredClone(this.initialState);
  }

  private saveState(state: BankState): void {
    this.stateSubject.next(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  isAccountFrozen(accountId: string): boolean {
    const linked = this.stateSubject.value.cards.filter(
      (c) => c.accountId === accountId
    );
    return linked.length > 0 && linked.some((c) => c.isBlocked);
  }

  getAccountBalance(accountId: string): number {
    if (this.isAccountFrozen(accountId)) return 0;
    return (
      this.stateSubject.value.accounts.find((a) => a.id === accountId)?.balance ?? 0
    );
  }

  toggleCardBlock(cardId: string): Observable<BankCard> {
    const state = structuredClone(this.stateSubject.value);
    const card = state.cards.find((c) => c.id === cardId);
    if (!card) {
      return throwError(() => new Error('Карта не найдена'));
    }
    card.isBlocked = !card.isBlocked;
    this.saveState(state);
    return of(card);
  }

  requestSmsCode(): Observable<{ codeHint: string }> {
    return of({ codeHint: '1234' }).pipe(delay(600));
  }

  executeTransfer(payload: TransferPayload, smsCode: string): Observable<Transaction> {
    if (this.isAccountFrozen(payload.fromAccountId)) {
      return throwError(
        () => new Error('Счёт списания заморожен из-за блокировки карты')
      ).pipe(delay(400));
    }

    if (
      payload.transferMethod === 'own' &&
      payload.toAccountId &&
      this.isAccountFrozen(payload.toAccountId)
    ) {
      return throwError(
        () => new Error('Счёт зачисления заморожен из-за блокировки карты')
      ).pipe(delay(400));
    }

    if (smsCode !== '1234') {
      return throwError(() => new Error('Неверный код подтверждения из SMS')).pipe(
        delay(400)
      );
    }

    const state = structuredClone(this.stateSubject.value);
    const fromAcc = state.accounts.find((a) => a.id === payload.fromAccountId);

    if (!fromAcc) {
      return throwError(() => new Error('Счёт списания не найден'));
    }
    if (fromAcc.balance < payload.amount) {
      return throwError(() => new Error('Недостаточно средств на счёте'));
    }

    fromAcc.balance = Number((fromAcc.balance - payload.amount).toFixed(2));

    let recipientTitle = payload.recipientName;
    if (payload.transferMethod === 'own' && payload.toAccountId) {
      const toAcc = state.accounts.find((a) => a.id === payload.toAccountId);
      if (toAcc) {
        toAcc.balance = Number((toAcc.balance + payload.amount).toFixed(2));
        recipientTitle = toAcc.name;

        const incomingTx: Transaction = {
          id: 'tx-' + Date.now() + '-in',
          accountId: toAcc.id,
          date: new Date().toISOString(),
          title: `Пополнение со счёта «${fromAcc.name}»`,
          recipientOrSender: fromAcc.name,
          amount: payload.amount,
          type: 'income',
          category: 'Пополнение',
          status: 'completed',
          comment: payload.comment,
        };
        state.transactions.unshift(incomingTx);
      }
    }

    const newTx: Transaction = {
      id: 'tx-' + Date.now(),
      accountId: fromAcc.id,
      date: new Date().toISOString(),
      title:
        payload.transferMethod === 'own'
          ? `Перевод на «${recipientTitle}»`
          : `Перевод: ${recipientTitle}`,
      recipientOrSender: recipientTitle,
      amount: payload.amount,
      type: 'transfer',
      category: payload.category,
      status: 'completed',
      comment: payload.comment,
    };

    state.transactions.unshift(newTx);

    if (payload.saveAsTemplate && payload.templateName) {
      state.templates.unshift({
        id: 'tpl-' + Date.now(),
        name: payload.templateName,
        fromAccountId: payload.fromAccountId,
        recipientName: payload.recipientName,
        recipientTarget: payload.recipientCardOrAccount || '',
        amount: payload.amount,
        category: payload.category,
        comment: payload.comment,
      });
    }

    return of(newTx).pipe(
      delay(800),
      tap(() => this.saveState(state))
    );
  }

  addTemplate(template: Omit<PaymentTemplate, 'id'>): Observable<PaymentTemplate> {
    const state = structuredClone(this.stateSubject.value);
    const newTemplate: PaymentTemplate = {
      ...template,
      id: 'tpl-' + Date.now(),
    };
    state.templates.unshift(newTemplate);
    return of(newTemplate).pipe(
      delay(300),
      tap(() => this.saveState(state))
    );
  }

  deleteTemplate(templateId: string): Observable<void> {
    const state = structuredClone(this.stateSubject.value);
    state.templates = state.templates.filter((t) => t.id !== templateId);
    return of(void 0).pipe(
      delay(300),
      tap(() => this.saveState(state))
    );
  }

  resetDemoData(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.saveState(structuredClone(this.initialState));
  }
}
