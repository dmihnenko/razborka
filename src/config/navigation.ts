import {
  LayoutGrid,
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
  Inbox,
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

// Меню для владельца разборки
export const partsOwnerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/parts/dashboard', icon: LayoutGrid },
  { name: 'Автомобили', href: '/parts/vehicles', icon: Car },
  { name: 'Запчасти', href: '/parts/inventory?source=vehicles', icon: Package },
  { name: 'Магазин', href: '/parts/inventory?source=shop', icon: ShoppingBag },
  { name: 'Заказы', href: '/parts/orders', icon: ShoppingCart },
  { name: 'Заявки с маркета', href: '/parts/market-orders', icon: Inbox },
  { name: 'Клиенты', href: '/parts/customers', icon: Users },
  { name: 'Сотрудники', href: '/parts/employees', icon: Users },
  { name: 'Аналитика', href: '/parts/analytics', icon: LineChart },
  { name: 'Подписка', href: '/parts/subscription', icon: CreditCard },
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
  { name: 'Заявки с маркета', href: '/parts/market-orders', icon: Inbox },
  { name: 'Клиенты', href: '/parts/customers', icon: Users },
  { name: 'Профиль', href: '/profile', icon: CircleUser },
];

// Общее меню для обычного пользователя
export const userMenu: MenuItem[] = [
  { name: 'Мои автомобили', href: '/my-vehicles', icon: Car, mobileHidden: true },
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
