import { Suspense, useCallback, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, LayoutGrid, LogIn, Search, ShoppingCart, Heart, Store } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { BRAND } from '@/config/brand'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Spinner } from '@/components/ui/Spinner'
import { CartProvider, useCart } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useFeatureFlag } from '@/hooks/useFeatureFlags'
import { getDefaultRouteForRoles } from '@/config/navigation'

// ============================================================================
// Публичный каркас маркета (/market/*). Дизайн «Graphite» — минимал, монохром.
// Scope .market несёт все --mk-* токены; дочерние экраны — внутри <Outlet/>.
// Данные/корзина не тронуты: CartProvider сверху, как и было.
// ============================================================================

function MarketLayoutInner() {
  const navigate = useNavigate()
  const { t } = useTranslation('market')
  const { user } = useAuth()
  const { data: profile } = useUserProfile()
  const roleNames = (profile?.roles || []).map((r: { name: string }) => r.name)
  // «В кабинет» из маркета: маркет — публичная витрина разборки, поэтому владельца/работника
  // разборки ведём в кабинет разборки, даже если у него есть и роль admin.
  const dashboardHref = roleNames.includes('parts_owner') || roleNames.includes('parts_worker')
    ? '/parts/dashboard'
    : getDefaultRouteForRoles(roleNames)
  const { totalCount } = useCart()
  const showFav = useFeatureFlag('market_favorites')
  // Pull-to-refresh (мобайл, скролл документа): протяжка вниз → мягкий рефетч.
  const qc = useQueryClient()
  const handlePullRefresh = useCallback(async () => {
    const started = Date.now()
    await qc.refetchQueries({ type: 'active' })
    const left = 500 - (Date.now() - started)
    if (left > 0) await new Promise(r => setTimeout(r, left))
  }, [qc])
  const { pull, refreshing } = usePullToRefresh({ onRefresh: handlePullRefresh })
  const [search, setSearch] = useState('')
  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? `/market/catalog?search=${encodeURIComponent(q)}` : '/market/catalog')
  }

  const searchForm = (cls: string) => (
    <form onSubmit={handleSearch} role="search" className={cls}>
      <div className="relative w-full flex">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('header.searchPlaceholder')}
          className="mk-input !rounded-r-none !border-r-0 min-w-0"
          aria-label={t('header.searchPlaceholder')}
        />
        <button type="submit" className="mk-add !rounded-l-none" aria-label={t('header.searchSubmit')}>
          <Search className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  )

  return (
    <div className="market min-h-dvh flex flex-col">
      <PullToRefreshIndicator pull={pull} refreshing={refreshing} />

      {/* ── Шапка ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40" style={{ background: 'var(--mk-surface)', borderBottom: '1px solid var(--mk-border)' }}>
        {/* Узкая серая полоса: только существующие страницы */}
        <div className="mk-topstrip hidden md:block">
          <div className="mk-container flex items-center justify-between gap-4 h-8">
            <span className="truncate">{t('header.stripTagline')}</span>
            <Link to="/business" className="flex-shrink-0">{t('header.forBusiness')}</Link>
          </div>
        </div>

        <div className="mk-container">
          <div className="flex items-center gap-2 sm:gap-3 h-14 sm:h-16 [--mk-control-h:40px] sm:[--mk-control-h:44px]">
            <Link to="/market" className="flex items-center flex-shrink-0 min-w-0" aria-label={t('header.logoAria')}>
              <Logo size="sm" withText={false} className="md:hidden flex-shrink-0 [&>svg]:!w-[44px] [&>svg]:!h-[44px]" />
              <Logo size="sm" withText className="hidden md:inline-flex flex-shrink-0" />
            </Link>

            <Link to="/market/catalog" className="mk-btn mk-btn-accent hidden md:inline-flex flex-shrink-0">
              <LayoutGrid className="w-4 h-4" aria-hidden="true" />{t('header.catalog')}
            </Link>

            {searchForm('hidden md:flex flex-1 min-w-0')}

            <NavLink
              to="/market/suppliers"
              className={({ isActive }) => `mk-btn mk-btn-ghost hidden md:inline-flex flex-shrink-0 ${isActive ? '!text-[color:var(--mk-text)]' : ''}`}
            >
              <Store className="w-4 h-4" aria-hidden="true" />{t('header.suppliers')}
            </NavLink>

            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto md:ml-0 flex-shrink-0">
              <LanguageSwitcher />
              {showFav && (
                <Link to="/market/favorites" className="mk-icon-btn" aria-label={t('header.favorites')}>
                  <Heart className="w-5 h-5" aria-hidden="true" />
                </Link>
              )}
              <Link to="/market/cart" className="mk-icon-btn relative" aria-label={totalCount ? t('header.cartCount', { n: totalCount }) : t('header.cartEmpty')}>
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
              <Link to={user ? dashboardHref : '/login'} className="mk-btn mk-btn-outline px-2.5 sm:px-[0.875rem]" aria-label={user ? t('header.toCabinet') : t('header.login')}>
                {user
                  ? <><LayoutDashboard className="w-4 h-4" aria-hidden="true" /><span className="hidden lg:inline">{t('header.toCabinet')}</span></>
                  : <><LogIn className="w-4 h-4" aria-hidden="true" /><span className="hidden lg:inline">{t('header.login')}</span></>}
              </Link>
            </div>
          </div>

          {/* Телефон: поиск отдельной строкой, ниже — Каталог и Разборки */}
          <div className="md:hidden pb-2.5 space-y-2 [--mk-control-h:40px]">
            {searchForm('')}
            <nav className="grid grid-cols-2 gap-2" aria-label={t('header.sectionsNav')}>
              <Link to="/market/catalog" className="mk-btn mk-btn-accent">
                <LayoutGrid className="w-4 h-4" aria-hidden="true" />{t('header.catalog')}
              </Link>
              <Link to="/market/suppliers" className="mk-btn mk-btn-outline">
                <Store className="w-4 h-4" aria-hidden="true" />{t('header.suppliers')}
              </Link>
            </nav>
          </div>
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
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-4">
            <Link to="/market" aria-label={BRAND.name} className="inline-flex flex-shrink-0 md:hidden">
              <Logo size="sm" withText />
            </Link>
            <p className="text-xs mk-meta text-center sm:text-left">{t('footer.tagline')}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
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
