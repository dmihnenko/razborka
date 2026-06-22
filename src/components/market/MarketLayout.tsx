import { Suspense, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, LogIn, Search, ShoppingCart } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Spinner } from '@/components/ui/Spinner'
import { CartProvider, useCart } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getDefaultRouteForRoles } from '@/config/navigation'

// ============================================================================
// Публичный каркас маркета (/market/*). Дизайн «Graphite» — минимал, монохром.
// Scope .market несёт все --mk-* токены; дочерние экраны — внутри <Outlet/>.
// Данные/корзина не тронуты: CartProvider сверху, как и было.
// ============================================================================

function navTab({ isActive }: { isActive: boolean }) {
  return [
    'inline-flex items-center justify-center min-w-0 sm:min-w-[92px] h-8 px-3 sm:px-4 rounded-[7px] text-sm whitespace-nowrap transition-colors',
    isActive ? 'font-semibold' : 'font-medium',
  ].join(' ')
}

function MarketLayoutInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('market')
  const { user } = useAuth()
  const { data: profile } = useUserProfile()
  const roleNames = (profile?.roles || []).map((r: any) => r.name)
  // «В кабинет» из маркета: маркет — публичная витрина разборки, поэтому владельца/работника
  // разборки ведём в кабинет разборки, даже если у него есть и роль admin.
  const dashboardHref = roleNames.includes('parts_owner') || roleNames.includes('parts_worker')
    ? '/parts/dashboard'
    : getDefaultRouteForRoles(roleNames)
  const { totalCount } = useCart()
  const [search, setSearch] = useState('')
  const isHome = location.pathname === '/market' || location.pathname === '/market/'
  // Каталог и разборки имеют свой поиск/листинг — поиск в шапке скрываем, чтобы не дублировать.
  // Когда поиска нет, табы «Каталог/Разборки» поднимаем в первый ряд (десктоп).
  const isCatalog = location.pathname.startsWith('/market/catalog')
  const isSupplier = location.pathname.startsWith('/market/supplier')
  const isProduct = location.pathname.startsWith('/market/part')
  // Поиск в шапке — только на страницах без собственного поиска. На карточке товара
  // (как на главной/каталоге/разборках) шапка БЕЗ поиска — иначе он встаёт над табами.
  const showHeaderSearch = !isHome && !isCatalog && !isSupplier && !isProduct

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? `/market/catalog?search=${encodeURIComponent(q)}` : '/market/catalog')
  }

  const navTabs = (
    <div className="inline-flex items-center gap-1 p-1 rounded-[10px]" style={{ background: 'var(--mk-surface-2)' }}>
      <NavLink
        to="/market/catalog"
        className={navTab}
        style={({ isActive }) => isActive
          ? { background: 'var(--mk-surface)', color: 'var(--mk-text)', boxShadow: 'var(--mk-shadow)' }
          : { color: 'var(--mk-text-2)' }}
      >
        {t('header.catalog')}
      </NavLink>
      <NavLink
        to="/market/suppliers"
        className={navTab}
        style={({ isActive }) => isActive
          ? { background: 'var(--mk-surface)', color: 'var(--mk-text)', boxShadow: 'var(--mk-shadow)' }
          : { color: 'var(--mk-text-2)' }}
      >
        {t('header.suppliers')}
      </NavLink>
    </div>
  )

  return (
    <div className="market min-h-dvh flex flex-col">

      {/* ── Шапка ──────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{ background: 'color-mix(in srgb, var(--mk-surface) 88%, transparent)', borderBottom: '1px solid var(--mk-border)' }}
      >
        <div className="mk-container">
          {/* Ряд 1 */}
          <div className="flex items-center gap-2 sm:gap-3 h-14 sm:h-16">
            {/* Лого: на мобиле компактный знак (в размер кнопок Каталог/Разборки),
                на десктопе — полная эмблема с дескриптором */}
            <Link to="/market" className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0 min-w-0" aria-label="Razborka.net — маркет запчастей, на главную">
              <Logo size="sm" withText={false} className="md:hidden flex-shrink-0" />
              <Logo size="sm" withText className="hidden md:inline-flex flex-shrink-0" />
            </Link>

            {/* Мобила: Каталог/Разборки в первом ряду рядом со знаком, корзиной и входом */}
            <div className="md:hidden">{navTabs}</div>

            {showHeaderSearch && (
              <form onSubmit={handleSearch} role="search" className="hidden md:flex flex-1 max-w-md mx-auto">
                <div className="relative w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none mk-meta" aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('header.searchPlaceholder')}
                    className="mk-input mk-search"
                    aria-label={t('header.searchPlaceholder')}
                  />
                </div>
              </form>
            )}

            {!showHeaderSearch && (
              <div className="hidden md:flex flex-1 justify-center">{navTabs}</div>
            )}

            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              <Link to="/market/cart" className="mk-icon-btn relative" aria-label={`Корзина${totalCount ? `, товаров: ${totalCount}` : ' (пусто)'}`}>
                <ShoppingCart className="w-5 h-5" aria-hidden="true" />
                {totalCount > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none"
                    style={{ background: 'var(--mk-accent)', color: 'var(--mk-on-accent)' }}
                  >
                    {totalCount > 99 ? '99+' : totalCount}
                  </span>
                )}
              </Link>
              <Link to={user ? dashboardHref : '/login'} className="mk-btn mk-btn-outline">
                {user
                  ? <><LayoutDashboard className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">{t('header.toCabinet')}</span></>
                  : <><LogIn className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">{t('header.login')}</span></>}
              </Link>
            </div>
          </div>

          {/* Навигация: на мобиле табы теперь в первом ряду (см. выше). Здесь —
              только десктоп, когда в первом ряду стоит поиск. */}
          <nav
            className={`${showHeaderSearch ? 'hidden md:flex' : 'hidden'} items-center justify-center pb-2.5`}
            aria-label="Разделы маркета"
          >
            {navTabs}
          </nav>

          {/* Поиск (мобила) — под категориями/разборками */}
          {showHeaderSearch && (
            <form onSubmit={handleSearch} role="search" className="md:hidden pb-2.5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none mk-meta" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск запчасти или артикула…"
                  className="mk-input mk-search !rounded-full"
                  aria-label={t('header.searchPlaceholder')}
                />
              </div>
            </form>
          )}
        </div>
      </header>

      {/* ── Контент ────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full">
        <div className="mk-container py-4 sm:py-5">
          {/* Свой Suspense для маркета: при переходах между ленивыми страницами
              НЕ мигает скелетон кабинета (LayoutSkeleton из общего Suspense) —
              шапка маркета остаётся, в контенте лишь короткий спиннер. */}
          <Suspense fallback={<div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* ── Подвал ─────────────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--mk-surface)', borderTop: '1px solid var(--mk-border)' }} className="mt-10">
        <div className="mk-container py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs mk-meta">{t('footer.tagline')}</p>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <Link to="/business" className="text-xs font-semibold mk-link">{t('footer.openBusiness')}</Link>
            <p className="text-xs mk-meta">© {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function MarketLayout() {
  return (
    <CartProvider>
      <MarketLayoutInner />
    </CartProvider>
  )
}

export default MarketLayout
