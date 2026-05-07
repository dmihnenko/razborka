import {
  LayoutDashboard,
  Users,
  Car,
  Calendar,
  Wrench,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  MessageSquare,
  BarChart3,
  Settings,
  Store
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
  { name: 'Поддержка', href: '/admin/support', icon: MessageSquare },
];

// Меню для владельца СТО
export const stoOwnerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/', icon: LayoutDashboard },
  { name: 'Клиенты', href: '/customers', icon: Users },
  { name: 'Автомобили', href: '/vehicles', icon: Car },
  { name: 'Записи', href: '/appointments', icon: Calendar },
  { name: 'Статистика', href: '/statistics', icon: BarChart3 },
  { name: 'Услуги', href: '/services', icon: Wrench },
  { name: 'Счета', href: '/invoices', icon: Receipt },
  { name: 'Сотрудники', href: '/sto/employees', icon: Users },
  { name: 'Аналитика', href: '/analytics', icon: TrendingUp },
  { name: 'Настройки', href: '/sto/settings', icon: Settings },
  { name: 'Поддержка', href: '/support', icon: MessageSquare },
];

// Меню для работника СТО
export const stoWorkerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/', icon: LayoutDashboard },
  { name: 'Клиенты', href: '/customers', icon: Users },
  { name: 'Автомобили', href: '/vehicles', icon: Car },
  { name: 'Записи', href: '/appointments', icon: Calendar },
  { name: 'Статистика', href: '/statistics', icon: BarChart3 },
  { name: 'Услуги', href: '/services', icon: Wrench },
];

// Меню для владельца разборки
export const partsOwnerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/parts/dashboard', icon: LayoutDashboard },
  { name: 'Автомобили', href: '/parts/vehicles', icon: Car },
  { name: 'Запчасти', href: '/parts/inventory?source=vehicles', icon: Package },
  { name: 'Магазин', href: '/parts/inventory?source=shop', icon: Store },
  { name: 'Заказы', href: '/parts/orders', icon: ShoppingCart },
  { name: 'Клиенты', href: '/parts/customers', icon: Users },
  { name: 'Сотрудники', href: '/parts/employees', icon: Users },
  { name: 'Аналитика', href: '/parts/analytics', icon: TrendingUp },
  { name: 'Настройки', href: '/parts/settings', icon: Settings },
  { name: 'Поддержка', href: '/support', icon: MessageSquare },
];

// Меню для работника разборки
export const partsWorkerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/parts/dashboard', icon: LayoutDashboard },
  { name: 'Автомобили', href: '/parts/vehicles', icon: Car },
  { name: 'Запчасти', href: '/parts/inventory?source=vehicles', icon: Package },
  { name: 'Магазин', href: '/parts/inventory?source=shop', icon: Store },
  { name: 'Заказы', href: '/parts/orders', icon: ShoppingCart },
  { name: 'Клиенты', href: '/parts/customers', icon: Users },
];

// Меню для владельца магазина
export const storeOwnerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/store-dashboard', icon: LayoutDashboard },
  { name: 'Товары', href: '/store/products', icon: Package },
  { name: 'Заказы', href: '/store/orders', icon: ShoppingCart },
  { name: 'Клиенты', href: '/customers', icon: Users },
  { name: 'Сотрудники', href: '/store/employees', icon: Users },
  { name: 'Поддержка', href: '/support', icon: MessageSquare },
];

// Меню для работника магазина
export const storeWorkerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/store-dashboard', icon: LayoutDashboard },
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
