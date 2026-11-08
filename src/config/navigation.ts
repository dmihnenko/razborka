import {
  Gauge,
  Users,
  Car,
  Package,
  ShoppingCart,
  LineChart,
  MessageCircle,
  SlidersHorizontal,
  CircleUser,
  ShoppingBag,
  CreditCard,
  History,
  BookMarked,
  PiggyBank,
  type LucideIcon,
} from 'lucide-react';

export interface MenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles?: string[]; // Если не указано, доступно всем
  mobileHidden?: boolean; // Скрыть в мобильной версии
  group?: 'main' | 'more'; // Блок сайдбара кабинета разборки: основное / «Ещё»
  match?: string[]; // Префиксы путей, при которых пункт подсвечивается активным (по умолчанию — href)
}

// Блоки сайдбара кабинета (порядок = порядок отображения); у «main» подписи нет
export const PARTS_NAV_GROUPS: { id: 'main' | 'more'; label: string }[] = [
  { id: 'main', label: '' },
  { id: 'more', label: 'Ещё' },
];

// Пункты «Продаж» — вкладки Входящие/Заказы/Отправки живут на /parts/sales,
// но карточки заказов и отправок открываются по своим адресам.
const SALES_MATCH = ['/parts/sales', '/parts/orders', '/parts/shipments', '/parts/market-orders'];

// «Справочники» (места хранения + категории) и «Журнал» (история + корзина) — хабы;
// старые адреса остаются рабочими и подсвечивают те же пункты.
const DIRECTORY_MATCH = ['/parts/directory', '/parts/warehouse', '/parts/categories'];
const JOURNAL_MATCH = ['/parts/journal', '/parts/activity', '/parts/trash'];

// Меню для администратора
export const adminMenu: MenuItem[] = [
  { name: 'Мои авто', href: '/my-vehicles', icon: Car },
  { name: 'Поддержка', href: '/admin/support', icon: MessageCircle },
];

// Основные пункты кабинета разборки (общие для владельца и работника).
// Мобильная нижняя панель: Пульт · Склад · [+] · Продажи · Ещё (Layout берёт их по href).
const partsMainItems: MenuItem[] = [
  { name: 'Пульт', href: '/parts/dashboard', icon: Gauge, group: 'main' },
  { name: 'Склад', href: '/parts/inventory', icon: Package, group: 'main', match: ['/parts/inventory'] },
  { name: 'Продажи', href: '/parts/sales', icon: ShoppingCart, group: 'main', match: SALES_MATCH },
  { name: 'Машины', href: '/parts/vehicles', icon: Car, group: 'main' },
  { name: 'Клиенты', href: '/parts/customers', icon: Users, group: 'main' },
];

// Меню для владельца разборки
export const partsOwnerMenu: MenuItem[] = [
  ...partsMainItems,
  { name: 'Отчёты', href: '/parts/analytics', icon: LineChart, group: 'more' },
  { name: 'Окупаемость авто', href: '/parts/roi', icon: PiggyBank, group: 'more' },
  { name: 'Справочники', href: '/parts/directory', icon: BookMarked, group: 'more', match: DIRECTORY_MATCH },
  { name: 'Сотрудники', href: '/parts/employees', icon: Users, group: 'more' },
  { name: 'Настройки', href: '/parts/settings', icon: SlidersHorizontal, group: 'more' },
  { name: 'Подписка', href: '/parts/subscription', icon: CreditCard, group: 'more' },
  { name: 'Журнал', href: '/parts/journal', icon: History, group: 'more', match: JOURNAL_MATCH },
  { name: 'Поддержка', href: '/support', icon: MessageCircle, group: 'more' },
  { name: 'Профиль', href: '/profile', icon: CircleUser, group: 'more' },
];

// Меню для работника разборки (без отчётов, сотрудников, подписки; в «Журнале» только корзина)
export const partsWorkerMenu: MenuItem[] = [
  ...partsMainItems,
  { name: 'Справочники', href: '/parts/directory', icon: BookMarked, group: 'more', match: DIRECTORY_MATCH },
  { name: 'Настройки', href: '/parts/settings', icon: SlidersHorizontal, group: 'more' },
  { name: 'Журнал', href: '/parts/journal', icon: History, group: 'more', match: JOURNAL_MATCH },
  { name: 'Поддержка', href: '/support', icon: MessageCircle, group: 'more' },
  { name: 'Профиль', href: '/profile', icon: CircleUser, group: 'more' },
];

// Меню обычного пользователя (раздел «Мои авто»).
// Порядок = мобильный нижний бар: Мои авто / Заявки с разборки / Профиль.
export const userMenu: MenuItem[] = [
  { name: 'Мои авто', href: '/my-vehicles', icon: Car },
  { name: 'Заявки с разборки', href: '/my-orders', icon: ShoppingBag },
  { name: 'Профиль', href: '/profile', icon: CircleUser },
];

// Маппинг ролей на меню
export const roleMenuMap: Record<string, MenuItem[]> = {
  'admin': adminMenu,
  'parts_owner': partsOwnerMenu,
  'parts_worker': partsWorkerMenu,
  'user': userMenu,
};

// Функция для получения объединенного меню для пользователя с несколькими ролями
export function getMenuForRoles(roleNames: string[]): MenuItem[] {
  const menuItems = new Map<string, MenuItem>();

  // Собираем все уникальные пункты меню из всех ролей
  roleNames.forEach(roleName => {
    const roleMenu = roleMenuMap[roleName] || [];
    roleMenu.forEach(item => {
      menuItems.set(item.href, item);
    });
  });

  // Если ролей нет, возвращаем пустой массив (Layout покажет спиннер)
  if (menuItems.size === 0) {
    return [];
  }

  return Array.from(menuItems.values());
}

// Функция для определения стартовой страницы по ролям
export function getDefaultRouteForRoles(roleNames: string[]): string {
  if (roleNames.includes('admin')) return '/admin';
  if (roleNames.includes('parts_owner') || roleNames.includes('parts_worker')) return '/parts/dashboard';
  return '/my-vehicles';
}
