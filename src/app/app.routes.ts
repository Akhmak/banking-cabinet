import { Routes } from '@angular/router';
import { AccountsPage } from './pages/accounts/accounts';
import { TransfersPage } from './pages/transfers/transfers';
import { TemplatesPage } from './pages/templates/templates';
import { AnalyticsPage } from './pages/analytics/analytics';
import { HistoryPage } from './pages/history/history';

export const routes: Routes = [
  { path: '', redirectTo: 'accounts', pathMatch: 'full' },
  { path: 'accounts', component: AccountsPage, title: 'Счета и карты — NovaBank' },
  { path: 'transfers', component: TransfersPage, title: 'Переводы — NovaBank' },
  { path: 'templates', component: TemplatesPage, title: 'Шаблоны платежей — NovaBank' },
  { path: 'analytics', component: AnalyticsPage, title: 'Аналитика расходов — NovaBank' },
  { path: 'history', component: HistoryPage, title: 'История и выписка — NovaBank' },
  { path: '**', redirectTo: 'accounts' },
];
