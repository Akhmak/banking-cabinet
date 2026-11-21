import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import {
  BankAccount,
  BankCard,
  ExpenseCategory,
  PaymentTemplate,
  Transaction,
  TransferPayload,
} from '../../models/bank.models';
import { MockBankService } from '../../services/mock-bank.service';
import { BankValidators } from '../../validators/bank.validators';

@Component({
  selector: 'app-transfers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './transfers.html',
  styleUrl: './transfers.scss',
})
export class TransfersPage implements OnInit {
  private fb = inject(FormBuilder);
  private bankService = inject(MockBankService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  accounts: BankAccount[] = [];
  cards: BankCard[] = [];
  templates: PaymentTemplate[] = [];
  categories: ExpenseCategory[] = [
    'Переводы',
    'ЖКХ и связь',
    'Продукты',
    'Транспорт',
    'Кафе и рестораны',
    'Развлечения',
  ];

  step: 1 | 2 | 3 = 1;
  isLoading = false;
  serverError: string | null = null;
  smsHint = '';
  completedTransaction: Transaction | null = null;

  transferForm = this.fb.group(
    {
      transferMethod: ['card' as 'card' | 'account' | 'own', Validators.required],
      fromAccountId: ['acc-1', Validators.required],
      toAccountId: ['acc-2'],
      recipientCardOrAccount: [''],
      recipientName: [''],
      amount: [
        '' as string,
        [
          Validators.required,
          BankValidators.maxBalance(() => this.getSelectedBalance()),
        ],
      ],
      category: ['Переводы' as ExpenseCategory, Validators.required],
      comment: ['', Validators.maxLength(100)],
      saveAsTemplate: [false],
      templateName: [''],
    },
    {
      validators: [
        BankValidators.differentAccounts('fromAccountId', 'toAccountId', 'transferMethod'),
      ],
    }
  );

  smsForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
  });

  get numericAmount(): number {
    const raw = String(this.transferForm.get('amount')?.value || '0')
      .replace(/\s+/g, '')
      .replace(',', '.');
    const num = Number(raw);
    return isNaN(num) ? 0 : num;
  }

  ngOnInit(): void {
    this.updateDynamicValidators('card');

    combineLatest([
      this.bankService.accounts$,
      this.bankService.cards$,
      this.bankService.templates$,
      this.route.queryParamMap,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([accounts, cards, templates, params]) => {
        this.accounts = accounts;
        this.cards = cards;
        this.templates = templates;

        const templateId = params.get('templateId');
        if (templateId) {
          const found = templates.find((t) => t.id === templateId);
          if (found) {
            this.applyTemplate(found);
          }
        }
        this.transferForm.get('amount')?.updateValueAndValidity();
        this.cdr.markForCheck();
      });

    this.transferForm
      .get('transferMethod')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((method) => {
        if (method) this.updateDynamicValidators(method);
      });

    this.transferForm
      .get('fromAccountId')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.transferForm.get('amount')?.updateValueAndValidity();
      });

    this.transferForm
      .get('saveAsTemplate')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((save) => {
        const tplCtrl = this.transferForm.get('templateName')!;
        if (save) {
          tplCtrl.setValidators([Validators.required, Validators.minLength(2)]);
        } else {
          tplCtrl.clearValidators();
          tplCtrl.setValue('');
        }
        tplCtrl.updateValueAndValidity();
      });
  }

  isAccountFrozen(accountId: string | null | undefined): boolean {
    if (!accountId) return false;
    const linked = this.cards.filter((c) => c.accountId === accountId);
    return linked.length > 0 && linked.some((c) => c.isBlocked);
  }

  onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const oldLength = input.value.length;
    const cursorPos = input.selectionStart ?? oldLength;

    const formatted = this.formatAmountString(input.value);
    input.value = formatted;
    this.transferForm.get('amount')?.setValue(formatted);

    const diff = formatted.length - oldLength;
    const newPos = Math.max(0, cursorPos + diff);
    input.setSelectionRange(newPos, newPos);
  }

  private formatAmountString(val: string | number | null | undefined): string {
    if (val === null || val === undefined) return '';
    const cleaned = String(val)
      .replace(/\s+/g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');

    if (!cleaned) return '';

    const dotIndex = cleaned.indexOf('.');
    let intPart = dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex);
    const decPart =
      dotIndex === -1 ? '' : cleaned.slice(dotIndex + 1).replace(/\./g, '').slice(0, 2);
    const hasDot = dotIndex !== -1;

    if (hasDot && intPart === '') {
      intPart = '0';
    } else if (intPart.length > 1) {
      intPart = intPart.replace(/^0+/, '') || '0';
    }

    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return hasDot ? `${formattedInt}.${decPart}` : formattedInt;
  }

  getSelectedBalance(): number {
    const id = this.transferForm.get('fromAccountId')?.value || '';
    return this.bankService.getAccountBalance(id);
  }

  getSelectedAccount(id: string | null | undefined): BankAccount | undefined {
    return this.accounts.find((a) => a.id === id);
  }

  updateDynamicValidators(method: 'card' | 'account' | 'own'): void {
    const targetCtrl = this.transferForm.get('recipientCardOrAccount')!;
    const nameCtrl = this.transferForm.get('recipientName')!;
    const toAccCtrl = this.transferForm.get('toAccountId')!;

    if (method === 'card') {
      targetCtrl.setValidators([Validators.required, BankValidators.luhnCardNumber()]);
      nameCtrl.setValidators([Validators.required, Validators.minLength(2)]);
      toAccCtrl.clearValidators();
    } else if (method === 'account') {
      targetCtrl.setValidators([Validators.required, BankValidators.accountNumber()]);
      nameCtrl.setValidators([Validators.required, Validators.minLength(2)]);
      toAccCtrl.clearValidators();
    } else {
      targetCtrl.clearValidators();
      nameCtrl.clearValidators();
      toAccCtrl.setValidators([Validators.required]);
    }

    targetCtrl.updateValueAndValidity();
    nameCtrl.updateValueAndValidity();
    toAccCtrl.updateValueAndValidity();
  }

  applyTemplate(tpl: PaymentTemplate): void {
    const cleanTarget = tpl.recipientTarget.replace(/\s+/g, '');
    const method = cleanTarget.length === 20 ? 'account' : 'card';

    this.step = 1;
    this.transferForm.patchValue({
      transferMethod: method,
      fromAccountId: tpl.fromAccountId,
      recipientCardOrAccount: tpl.recipientTarget,
      recipientName: tpl.recipientName,
      amount: this.formatAmountString(tpl.amount),
      category: tpl.category,
      comment: tpl.comment || '',
      saveAsTemplate: false,
    });
    this.updateDynamicValidators(method);
  }

  fillTestCard(): void {
    this.transferForm.patchValue({
      transferMethod: 'card',
      recipientCardOrAccount: '4276 3800 1234 5679',
      recipientName: 'Иван Петров',
    });
    this.transferForm.get('recipientCardOrAccount')?.markAsTouched();
    this.transferForm.get('recipientName')?.markAsTouched();
  }

  getError(controlName: string): string | null {
    const ctrl = this.transferForm.get(controlName);
    if (!ctrl || !ctrl.touched || !ctrl.errors) return null;

    const errors = ctrl.errors;
    if (errors['required']) return 'Обязательное поле';
    if (errors['minlength']) return `Минимум ${errors['minlength'].requiredLength} символа`;
    if (errors['maxlength']) return `Максимум ${errors['maxlength'].requiredLength} символов`;
    if (errors['cardFormat']) return errors['cardFormat'];
    if (errors['luhnInvalid']) return errors['luhnInvalid'];
    if (errors['accountFormat']) return errors['accountFormat'];
    if (errors['minAmount']) return errors['minAmount'];
    if (errors['limitExceeded']) return errors['limitExceeded'];
    if (errors['insufficientFunds']) return errors['insufficientFunds'];
    return 'Некорректное значение';
  }

  goToConfirmation(): void {
    this.transferForm.markAllAsTouched();
    if (this.isAccountFrozen(this.transferForm.value.fromAccountId)) {
      this.serverError = 'Невозможно выполнить перевод: счёт заморожен из-за блокировки карты';
      return;
    }
    if (
      this.transferForm.value.transferMethod === 'own' &&
      this.isAccountFrozen(this.transferForm.value.toAccountId)
    ) {
      this.serverError = 'Невозможно выполнить перевод: счёт зачисления заморожен';
      return;
    }
    if (this.transferForm.invalid) return;

    this.isLoading = true;
    this.serverError = null;
    this.smsForm.reset();

    this.bankService.requestSmsCode().subscribe({
      next: (res) => {
        this.isLoading = false;
        this.smsHint = res.codeHint;
        this.step = 2;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.serverError = 'Не удалось отправить SMS-код';
        this.cdr.markForCheck();
      },
    });
  }

  confirmTransfer(): void {
    this.smsForm.markAllAsTouched();
    if (this.smsForm.invalid) return;

    const raw = this.transferForm.getRawValue();
    const toAcc = this.getSelectedAccount(raw.toAccountId);

    const payload: TransferPayload = {
      fromAccountId: raw.fromAccountId!,
      transferMethod: raw.transferMethod!,
      toAccountId: raw.toAccountId || undefined,
      recipientCardOrAccount: raw.recipientCardOrAccount || undefined,
      recipientName:
        raw.transferMethod === 'own'
          ? toAcc?.name || 'Свой счёт'
          : raw.recipientName || 'Получатель',
      amount: this.numericAmount,
      category: raw.category!,
      comment: raw.comment || undefined,
      saveAsTemplate: !!raw.saveAsTemplate,
      templateName: raw.templateName || undefined,
    };

    this.isLoading = true;
    this.serverError = null;

    this.bankService
      .executeTransfer(payload, this.smsForm.value.code || '')
      .subscribe({
        next: (tx) => {
          this.isLoading = false;
          this.completedTransaction = tx;
          this.step = 3;
          this.cdr.markForCheck();
        },
        error: (err: Error) => {
          this.isLoading = false;
          this.serverError = err.message || 'Ошибка при выполнении операции';
          this.cdr.markForCheck();
        },
      });
  }

  resetWizard(): void {
    this.step = 1;
    this.completedTransaction = null;
    this.serverError = null;
    this.transferForm.patchValue({
      recipientCardOrAccount: '',
      recipientName: '',
      amount: '',
      comment: '',
      saveAsTemplate: false,
      templateName: '',
    });
    this.transferForm.markAsUntouched();
  }
}
