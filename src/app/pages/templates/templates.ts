import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { BankCard, ExpenseCategory } from '../../models/bank.models';
import { MockBankService } from '../../services/mock-bank.service';
import { BankValidators } from '../../validators/bank.validators';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './templates.html',
  styleUrl: './templates.scss',
})
export class TemplatesPage {
  private bankService = inject(MockBankService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  vm$ = combineLatest([
    this.bankService.templates$,
    this.bankService.accounts$,
    this.bankService.cards$,
  ]).pipe(
    map(([templates, accounts, cards]) => ({ templates, accounts, cards }))
  );

  showCreateForm = false;
  isSaving = false;
  categories: ExpenseCategory[] = [
    'Переводы',
    'ЖКХ и связь',
    'Продукты',
    'Транспорт',
    'Кафе и рестораны',
    'Развлечения',
  ];

  templateForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    fromAccountId: ['acc-1', Validators.required],
    recipientName: ['', [Validators.required, Validators.minLength(2)]],
    targetType: ['card' as 'card' | 'account'],
    recipientTarget: ['', [Validators.required, BankValidators.luhnCardNumber()]],
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    category: ['ЖКХ и связь' as ExpenseCategory, Validators.required],
    comment: [''],
  });

  isAccountFrozen(cards: BankCard[], accountId: string): boolean {
    const linked = cards.filter((c) => c.accountId === accountId);
    return linked.length > 0 && linked.some((c) => c.isBlocked);
  }

  onTargetTypeChange(): void {
    const type = this.templateForm.value.targetType;
    const ctrl = this.templateForm.get('recipientTarget')!;
    if (type === 'card') {
      ctrl.setValidators([Validators.required, BankValidators.luhnCardNumber()]);
    } else {
      ctrl.setValidators([Validators.required, BankValidators.accountNumber()]);
    }
    ctrl.updateValueAndValidity();
  }

  useTemplate(templateId: string): void {
    this.router.navigate(['/transfers'], { queryParams: { templateId } });
  }

  deleteTemplate(id: string): void {
    if (confirm('Удалить этот шаблон платежа?')) {
      this.bankService.deleteTemplate(id).subscribe();
    }
  }

  createTemplate(): void {
    this.templateForm.markAllAsTouched();
    if (this.templateForm.invalid) return;

    const val = this.templateForm.getRawValue();
    this.isSaving = true;

    this.bankService
      .addTemplate({
        name: val.name!,
        fromAccountId: val.fromAccountId!,
        recipientName: val.recipientName!,
        recipientTarget: val.recipientTarget!,
        amount: Number(val.amount),
        category: val.category!,
        comment: val.comment || undefined,
      })
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.showCreateForm = false;
          this.templateForm.reset({
            fromAccountId: 'acc-1',
            targetType: 'card',
            category: 'ЖКХ и связь',
          });
          this.cdr.markForCheck();
        },
        error: () => {
          this.isSaving = false;
          this.cdr.markForCheck();
        },
      });
  }
}
