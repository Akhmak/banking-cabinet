export type Currency = 'RUB' | 'USD' | 'EUR';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type ExpenseCategory =
  | 'Продукты'
  | 'Транспорт'
  | 'Кафе и рестораны'
  | 'ЖКХ и связь'
  | 'Переводы'
  | 'Развлечения'
  | 'Пополнение';

export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string; // 20-значный счёт
  balance: number;
  currency: Currency;
  type: 'debit' | 'savings';
}

export interface BankCard {
  id: string;
  accountId: string;
  name: string;
  maskedNumber: string;
  fullNumber: string;
  expiry: string;
  paymentSystem: 'MIR' | 'VISA' | 'Mastercard';
  colorGradient: string;
  isBlocked: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string; // ISO string
  title: string;
  recipientOrSender: string;
  amount: number; // всегда положительное, знак определяется type
  type: TransactionType;
  category: ExpenseCategory;
  status: 'completed' | 'pending';
  comment?: string;
}

export interface PaymentTemplate {
  id: string;
  name: string;
  fromAccountId: string;
  recipientName: string;
  recipientTarget: string; // номер карты или счёта
  amount: number;
  category: ExpenseCategory;
  comment?: string;
}

export interface TransferPayload {
  fromAccountId: string;
  transferMethod: 'own' | 'card' | 'account';
  toAccountId?: string;
  recipientCardOrAccount?: string;
  recipientName: string;
  amount: number;
  category: ExpenseCategory;
  comment?: string;
  saveAsTemplate?: boolean;
  templateName?: string;
}
