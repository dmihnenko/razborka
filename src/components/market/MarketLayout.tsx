import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Boxes, LayoutDashboard, LogIn, Search, ShoppingCart, Wrench } from 'lucide-react'
import { CartProvider, useCart } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getDefaultRouteForRoles } from '@/config/navigation'

// ============================================================================
// Публичный каркас маркетплейса (/market/*) — без сайдбара приложения.
// Сам оборачивает контент в CartProvider, поэтому в App.tsx достаточно:
// <Route path="/market" element={<MarketLayout />}> ...дочерние роуты... </Route>
// «Azure Market» — токены бренда (--brand-*), тач-таргеты ≥44px, a11y.
// ============================================================================

function navLinkCls({ isActive }: { isActive: boolean }) {
  return [
    'inline-flex items-center justify-center min-w-[100px] px-5 rounded-full text-sm transition-colors duration-150 whitespace-nowrap',
    isActive
      ? 'bg-white text-gray-900 font-semibold shadow-sm'
      : 'text-gray-500 font-medium hover:text-gray-800',
  ].join(' ')
}

function MarketLayoutInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { data: profile } = useUserProfile()
  // Куда ведёт «В кабинет» — реальный раздел пользователя по роли (не «/», иначе петля на маркет)
  const dashboardHref = getDefaultRouteForRoles((profile?.roles || []).map((r: any) => r.name))
  const { totalCount } = useCart()
  const [search, setSearch] = useState('')
  // На главной маркета поиск живёт в герое — в шапке его прячем, чтобы не дублировать
  const isHome = location.pathname === '/market' || location.pathname === '/market/'

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? `/market/catalog?search=${encodeURIComponent(q)}` : '/market/catalog')
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">

      {/* ── Шапка ──────────────────────────────────────────────────────── */}
      <header className="glass border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-4">

          {/* Ряд 1: логотип · поиск(десктоп) · корзина · войти */}
          <div className="flex items-center gap-2 sm:gap-3 h-16">
            <Link
              to="/market"
              className="group flex items-center gap-2.5 flex-shrink-0 min-w-0"
              aria-label="Маркет запчастей — на главную"
            >
              <span className="w-10 h-10 rounded-xl bg-primary shadow-glow-blue flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
                <Boxes className="w-5 h-5 text-white" aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-none min-w-0">
                <span className="font-extrabold tracking-tight text-gray-900 text-sm sm:text-base truncate">
                  Маркет запчастей
                </span>
                <span className="hidden sm:block text-[11px] font-medium text-gray-400 mt-0.5 truncate">
                  б/у и новые · от авторазборок
                </span>
              </span>
            </Link>

            {/* Поиск — на десктопе в шапке (кроме главной, где он в герое) */}
            {!isHome && (
              <form onSubmit={handleSearch} role="search" className="hidden md:flex flex-1 max-w-md mx-auto">
                <div className="relative w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Поиск запчасти или артикула…"
                    className="w-full h-11 pl-11 pr-3 text-sm border border-gray-200 rounded-full bg-gray-100/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all duration-200"
                    aria-label="Поиск по каталогу запчастей"
                  />
                </div>
              </form>
            )}

            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-shrink-0">
              <Link
                to="/market/cart"
                className="relative inline-flex items-center justify-center w-11 h-11 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-150 active:scale-[0.94]"
                aria-label={`Корзина${totalCount ? `, товаров: ${totalCount}` : ' (пусто)'}`}
              >
                <ShoppingCart className="w-5 h-5" aria-hidden="true" />
                {totalCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-glow-blue animate-scale-in">
                    {totalCount > 99 ? '99+' : totalCount}
                  </span>
                )}
              </Link>
              <Link
                to={user ? dashboardHref : '/login'}
                className="inline-flex items-center gap-1.5 h-11 px-3.5 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 bg-white hover:border-gray-300 hover:text-gray-900 shadow-sm transition-colors duration-150 active:scale-[0.97]"
              >
                {user
                  ? <><LayoutDashboard className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">В кабинет</span></>
                  : <><LogIn className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Войти</span></>}
              </Link>
            </div>
          </div>

          {/* Ряд 2 (мобила): поиск — кроме главной, где он в герое */}
          {!isHome && (
            <form onSubmit={handleSearch} role="search" className="md:hidden pb-2.5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск запчасти или артикула…"
                  className="w-full h-11 pl-11 pr-3 text-sm border border-gray-200 rounded-full bg-gray-100/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all duration-200"
                  aria-label="Поиск по каталогу запчастей"
                />
              </div>
            </form>
          )}

          {/* Ряд 3: навигация — центрированный сегмент-контрол */}
          <nav className="flex items-center justify-center pb-2.5" aria-label="Разделы маркета">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-gray-100/80 border border-gray-200/70 h-11">
              <NavLink to="/market/catalog" className={navLinkCls}>Каталог</NavLink>
              <NavLink to="/market/suppliers" className={navLinkCls}>Разборки</NavLink>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Контент ────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Outlet />
      </main>

      {/* ── Подвал ─────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-[1440px] mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Boxes className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            </span>
            <p className="text-xs font-medium text-gray-500">
              Маркет запчастей · б/у и новые запчасти от авторазборок
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/business"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-brand-hover transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
              Открыть разборку
            </Link>
            <p className="text-xs text-gray-400">© {new Date().getFullYear()}</p>
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
