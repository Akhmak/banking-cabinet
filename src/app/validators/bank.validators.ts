import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class BankValidators {
  /**
   * Проверка номера банковской карты по алгоритму Луна (16 цифр)
   */
  static luhnCardNumber(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const raw = (control.value || '').toString().replace(/\s+/g, '');
      if (!raw) return null; // required проверяется отдельно

      if (!/^\d{16}$/.test(raw)) {
        return { cardFormat: 'Номер карты должен содержать ровно 16 цифр' };
      }

      let sum = 0;
      let shouldDouble = false;
      for (let i = raw.length - 1; i >= 0; i--) {
        let digit = parseInt(raw.charAt(i), 10);
        if (shouldDouble) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
      }

      return sum % 10 === 0
        ? null
        : { luhnInvalid: 'Некорректный номер карты (ошибка контрольной суммы)' };
    };
  }

  /**
   * Проверка 20-значного банковского счёта
   */
  static accountNumber(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const raw = (control.value || '').toString().replace(/\s+/g, '');
      if (!raw) return null;
      return /^\d{20}$/.test(raw)
        ? null
        : { accountFormat: 'Номер счёта должен состоять из 20 цифр' };
    };
  }

  /**
   * Проверка суммы: положительное число, не больше доступного баланса и лимита
   */
  static maxBalance(getBalance: () => number, maxSingleLimit = 500000): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === '') return null;

      const normalized = String(control.value).replace(/\s+/g, '').replace(',', '.');
      const value = Number(normalized);

      if (isNaN(value) || value <= 0) {
        return { minAmount: 'Сумма должна быть больше 0' };
      }
      if (value > maxSingleLimit) {
        return { limitExceeded: `Максимальный разовый перевод — ${maxSingleLimit.toLocaleString('ru-RU')} ₽` };
      }
      const available = getBalance();
      if (value > available) {
        return { insufficientFunds: `Недостаточно средств (доступно ${available.toLocaleString('ru-RU')} ₽)` };
      }
      return null;
    };
  }

  /**
   * Запрет перевода на тот же самый счёт
   */
  static differentAccounts(fromKey: string, toKey: string, methodKey: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const method = group.get(methodKey)?.value;
      if (method !== 'own') return null;

      const fromId = group.get(fromKey)?.value;
      const toId = group.get(toKey)?.value;

      if (fromId && toId && fromId === toId) {
        return { sameAccount: 'Счёт списания и счёт зачисления не могут совпадать' };
      }
      return null;
    };
  }
}
