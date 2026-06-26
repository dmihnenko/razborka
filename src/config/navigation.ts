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
  History,
  Truck,
  FolderTree,
  Warehouse,
  PiggyBank,
} from 'lucide-react';

export interface MenuItem {
  name: string;
  href: string;
  icon: any;
  roles?: string[]; // Если не указано, доступно всем
  mobileHidden?: boolean; // Скрыть в мобильной версии
  group?: 'work' | 'base' | 'system'; // Смысловой блок сайдбара (кабинет разборки)
}

// Заголовки групп сайдбара кабинета (порядок = порядок отображения)
export const PARTS_NAV_GROUPS: { id: 'work' | 'base' | 'system'; label: string }[] = [
  { id: 'work',   label: 'Работа' },
  { id: 'base',   label: 'База' },
  { id: 'system', label: 'Система' },
];

// Меню для администратора
export const adminMenu: MenuItem[] = [
  { name: 'Мои авто', href: '/my-vehicles', icon: Car },
  { name: 'Мои заказы', href: '/my-orders', icon: Package },
  { name: 'Поддержка', href: '/admin/support', icon: MessageCircle },
];

// Меню для владельца разборки.
// Порядок = и для сайдбара, и для мобильного нижнего меню (первые 4 — табы):
// Дашборд / Заказы / Заявки с маркета / Запчасти — самые частые.
export const partsOwnerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/parts/dashboard', icon: LayoutGrid, group: 'work' },
  { name: 'Заказы', href: '/parts/orders', icon: ShoppingCart, group: 'work' },
  { name: 'Заявки с маркета', href: '/parts/market-orders', icon: Inbox, group: 'work' },
  { name: 'Запчасти', href: '/parts/inventory?source=vehicles', icon: Package, group: 'base' },
  { name: 'Доставка', href: '/parts/shipments', icon: Truck, group: 'work' },
  { name: 'Магазин', href: '/parts/inventory?source=shop', icon: ShoppingBag, group: 'base' },
  { name: 'Автомобили', href: '/parts/vehicles', icon: Car, group: 'base' },
  { name: 'Клиенты', href: '/parts/customers', icon: Users, group: 'base' },
  { name: 'Категории', href: '/parts/categories', icon: FolderTree, group: 'base' },
  { name: 'Места хранения', href: '/parts/warehouse', icon: Warehouse, group: 'base' },
  { name: 'Окупаемость авто', href: '/parts/roi', icon: PiggyBank, group: 'system' },
  { name: 'Аналитика', href: '/parts/analytics', icon: LineChart, group: 'system' },
  { name: 'Сотрудники', href: '/parts/employees', icon: Users, group: 'system' },
  { name: 'Настройки', href: '/parts/settings', icon: SlidersHorizontal, group: 'system' },
  { name: 'Подписка', href: '/parts/subscription', icon: CreditCard, group: 'system' },
  { name: 'История', href: '/parts/activity', icon: History, group: 'system' },
  { name: 'Поддержка', href: '/support', icon: MessageCircle, group: 'system' },
  { name: 'Профиль', href: '/profile', icon: CircleUser, group: 'system' },
];

// Меню для работника разборки (первые 4 — мобильные табы)
export const partsWorkerMenu: MenuItem[] = [
  { name: 'Дашборд', href: '/parts/dashboard', icon: LayoutGrid, group: 'work' },
  { name: 'Заказы', href: '/parts/orders', icon: ShoppingCart, group: 'work' },
  { name: 'Заявки с маркета', href: '/parts/market-orders', icon: Inbox, group: 'work' },
  { name: 'Запчасти', href: '/parts/inventory?source=vehicles', icon: Package, group: 'base' },
  { name: 'Доставка', href: '/parts/shipments', icon: Truck, group: 'work' },
  { name: 'Автомобили', href: '/parts/vehicles', icon: Car, group: 'base' },
  { name: 'Клиенты', href: '/parts/customers', icon: Users, group: 'base' },
  { name: 'Категории', href: '/parts/categories', icon: FolderTree, group: 'base' },
  { name: 'Места хранения', href: '/parts/warehouse', icon: Warehouse, group: 'base' },
  { name: 'Настройки', href: '/parts/settings', icon: SlidersHorizontal, group: 'system' },
  { name: 'Профиль', href: '/profile', icon: CircleUser, group: 'system' },
];

// Общее меню для обычного пользователя
export const userMenu: MenuItem[] = [
  { name: 'Мои автомобили', href: '/my-vehicles', icon: Car, mobileHidden: true },
  { name: 'Мои заказы', href: '/my-orders', icon: Package, mobileHidden: true },
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
