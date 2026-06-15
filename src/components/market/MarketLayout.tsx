import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Boxes, LayoutDashboard, LogIn, Search, ShoppingCart } from 'lucide-react'
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
    'inline-flex items-center justify-center min-w-[96px] h-9 px-4 rounded-full text-sm transition-colors',
    isActive ? 'font-semibold' : 'font-medium',
  ].join(' ')
}

function MarketLayoutInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { data: profile } = useUserProfile()
  const dashboardHref = getDefaultRouteForRoles((profile?.roles || []).map((r: any) => r.name))
  const { totalCount } = useCart()
  const [search, setSearch] = useState('')
  const isHome = location.pathname === '/market' || location.pathname === '/market/'

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? `/market/catalog?search=${encodeURIComponent(q)}` : '/market/catalog')
  }

  return (
    <div className="market min-h-dvh flex flex-col">

      {/* ── Шапка ──────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{ background: 'color-mix(in srgb, var(--mk-surface) 88%, transparent)', borderBottom: '1px solid var(--mk-border)' }}
      >
        <div className="mk-container">
          {/* Ряд 1 */}
          <div className="flex items-center gap-3 h-16">
            <Link to="/market" className="flex items-center gap-2.5 flex-shrink-0 min-w-0" aria-label="Маркет запчастей — на главную">
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--mk-accent-weak)', color: 'var(--mk-accent)' }}
              >
                <Boxes className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-none min-w-0">
                <span className="font-bold tracking-tight text-sm sm:text-[15px] truncate" style={{ color: 'var(--mk-text)' }}>
                  Маркет запчастей
                </span>
                <span className="hidden sm:block text-[11px] mt-0.5 truncate mk-meta">
                  от авторазборок
                </span>
              </span>
            </Link>

            {!isHome && (
              <form onSubmit={handleSearch} role="search" className="hidden md:flex flex-1 max-w-md mx-auto">
                <div className="relative w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none mk-meta" aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Поиск запчасти или артикула…"
                    className="mk-input mk-search !rounded-full"
                    aria-label="Поиск по каталогу запчастей"
                  />
                </div>
              </form>
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
                  ? <><LayoutDashboard className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">В кабинет</span></>
                  : <><LogIn className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Войти</span></>}
              </Link>
            </div>
          </div>

          {/* Ряд 2 (мобила): поиск */}
          {!isHome && (
            <form onSubmit={handleSearch} role="search" className="md:hidden pb-2.5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none mk-meta" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск запчасти или артикула…"
                  className="mk-input mk-search !rounded-full"
                  aria-label="Поиск по каталогу запчастей"
                />
              </div>
            </form>
          )}

          {/* Ряд 3: навигация */}
          <nav className="flex items-center justify-center pb-2.5" aria-label="Разделы маркета">
            <div className="inline-flex items-center gap-1 p-1 rounded-full" style={{ background: 'var(--mk-surface-2)' }}>
              <NavLink
                to="/market/catalog"
                className={navTab}
                style={({ isActive }) => isActive
                  ? { background: 'var(--mk-surface)', color: 'var(--mk-text)', boxShadow: 'var(--mk-shadow)' }
                  : { color: 'var(--mk-text-2)' }}
              >
                Каталог
              </NavLink>
              <NavLink
                to="/market/suppliers"
                className={navTab}
                style={({ isActive }) => isActive
                  ? { background: 'var(--mk-surface)', color: 'var(--mk-text)', boxShadow: 'var(--mk-shadow)' }
                  : { color: 'var(--mk-text-2)' }}
              >
                Разборки
              </NavLink>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Контент ────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full">
        <div className="mk-container py-5 sm:py-7">
          <Outlet />
        </div>
      </main>

      {/* ── Подвал ─────────────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--mk-surface)', borderTop: '1px solid var(--mk-border)' }} className="mt-10">
        <div className="mk-container py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs mk-meta">Маркет запчастей · б/у и новые запчасти от авторазборок</p>
          <div className="flex items-center gap-4">
            <Link to="/business" className="text-xs font-semibold mk-link">Открыть разборку</Link>
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
