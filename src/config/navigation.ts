import {
  LayoutGrid,
  Users,
  Car,
  ClipboardList,
  Wrench,
  Package,
  FileText,
  ShoppingCart,
  LineChart,
  MessageCircle,
  BarChart2,
  SlidersHorizontal,
  CircleUser,
  ShoppingBag,
  CreditCard,
} from 'lucide-react';

export interface MenuItem {
  name: string;
  href: string;
  icon: any;
  roles?: string[]; // Если не указано, доступно всем
  mobileHidden?: boolean; // Скрыть в мобильной версии
}

// Меню для администратора
export const adminMenu: MenuItem[] = [
  { name: 'Мои авто', href: '/my-vehicles', icon: Car },
  { name: 'Поддержка', href: '/admin/support', icon: MessageCircle },
];

// Меню для владельца СТО
export const stoOwnerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/', icon: LayoutGrid },
  { name: 'Клиенты', href: '/customers', icon: Users },
  { name: 'Автомобили', href: '/vehicles', icon: Car },
  { name: 'Записи', href: '/appointments', icon: ClipboardList },
  { name: 'Статистика', href: '/statistics', icon: BarChart2 },
  { name: 'Услуги', href: '/services', icon: Wrench },
  { name: 'Счета', href: '/invoices', icon: FileText },
  { name: 'Сотрудники', href: '/sto/employees', icon: Users },
  { name: 'Аналитика', href: '/analytics', icon: LineChart },
  { name: 'Підписка', href: '/sto/subscription', icon: CreditCard },
  { name: 'Настройки', href: '/sto/settings', icon: SlidersHorizontal },
  { name: 'Поддержка', href: '/support', icon: MessageCircle },
  { name: 'Профиль', href: '/profile', icon: CircleUser },
];

// Меню для работника СТО
export const stoWorkerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/', icon: LayoutGrid },
  { name: 'Клиенты', href: '/customers', icon: Users },
  { name: 'Автомобили', href: '/vehicles', icon: Car },
  { name: 'Записи', href: '/appointments', icon: ClipboardList },
  { name: 'Статистика', href: '/statistics', icon: BarChart2 },
  { name: 'Услуги', href: '/services', icon: Wrench },
  { name: 'Профиль', href: '/profile', icon: CircleUser },
];

// Меню для владельца разборки
export const partsOwnerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/parts/dashboard', icon: LayoutGrid },
  { name: 'Автомобили', href: '/parts/vehicles', icon: Car },
  { name: 'Запчасти', href: '/parts/inventory?source=vehicles', icon: Package },
  { name: 'Магазин', href: '/parts/inventory?source=shop', icon: ShoppingBag },
  { name: 'Заказы', href: '/parts/orders', icon: ShoppingCart },
  { name: 'Клиенты', href: '/parts/customers', icon: Users },
  { name: 'Сотрудники', href: '/parts/employees', icon: Users },
  { name: 'Аналитика', href: '/parts/analytics', icon: LineChart },
  { name: 'Настройки', href: '/parts/settings', icon: SlidersHorizontal },
  { name: 'Поддержка', href: '/support', icon: MessageCircle },
  { name: 'Профиль', href: '/profile', icon: CircleUser },
];

// Меню для работника разборки
export const partsWorkerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/parts/dashboard', icon: LayoutGrid },
  { name: 'Автомобили', href: '/parts/vehicles', icon: Car },
  { name: 'Запчасти', href: '/parts/inventory?source=vehicles', icon: Package },
  { name: 'Магазин', href: '/parts/inventory?source=shop', icon: ShoppingBag },
  { name: 'Заказы', href: '/parts/orders', icon: ShoppingCart },
  { name: 'Клиенты', href: '/parts/customers', icon: Users },
  { name: 'Профиль', href: '/profile', icon: CircleUser },
];

// Меню для владельца магазина
export const storeOwnerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/store-dashboard', icon: LayoutGrid },
  { name: 'Товары', href: '/store/products', icon: Package },
  { name: 'Заказы', href: '/store/orders', icon: ShoppingCart },
  { name: 'Клиенты', href: '/customers', icon: Users },
  { name: 'Сотрудники', href: '/store/employees', icon: Users },
  { name: 'Поддержка', href: '/support', icon: MessageCircle },
];

// Меню для работника магазина
export const storeWorkerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/store-dashboard', icon: LayoutGrid },
  { name: 'Товары', href: '/store/products', icon: Package },
  { name: 'Заказы', href: '/store/orders', icon: ShoppingCart },
  { name: 'Клиенты', href: '/customers', icon: Users },
];

// Общее меню для обычного пользователя
export const userMenu: MenuItem[] = [
  { name: 'Мои автомобили', href: '/my-vehicles', icon: Car, mobileHidden: true },
];

// Маппинг ролей на меню
export const roleMenuMap: Record<string, MenuItem[]> = {
  'admin': adminMenu,
  'sto_owner': stoOwnerMenu,
  'sto_worker': stoWorkerMenu,
  'parts_owner': partsOwnerMenu,
  'parts_worker': partsWorkerMenu,
  'store_owner': storeOwnerMenu,
  'store_worker': storeWorkerMenu,
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
  if (roleNames.includes('sto_owner') || roleNames.includes('sto_worker')) return '/';
  if (roleNames.includes('parts_owner') || roleNames.includes('parts_worker')) return '/parts/dashboard';
  if (roleNames.includes('store_owner') || roleNames.includes('store_worker')) return '/store-dashboard';
  return '/';
}
