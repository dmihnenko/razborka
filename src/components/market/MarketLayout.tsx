import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Cog, LogIn, Search, ShoppingCart } from 'lucide-react'
import { CartProvider, useCart } from '@/hooks/useCart'

// ============================================================================
// Публичный каркас маркетплейса (/market/*) — без сайдбара приложения.
// Сам оборачивает контент в CartProvider, поэтому в App.tsx достаточно:
// <Route path="/market" element={<MarketLayout />}> ...дочерние роуты... </Route>
// ============================================================================

function navLinkCls({ isActive }: { isActive: boolean }) {
  return [
    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
    isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
  ].join(' ')
}

function MarketLayoutInner() {
  const navigate = useNavigate()
  const { totalCount } = useCart()
  const [search, setSearch] = useState('')

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? `/market/catalog?search=${encodeURIComponent(q)}` : '/market/catalog')
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">

      {/* ── Шапка ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 sm:px-4">

          {/* Ряд 1: логотип · поиск(десктоп) · корзина · войти */}
          <div className="flex items-center gap-2 sm:gap-3 h-14">
            <Link to="/market" className="flex items-center gap-2 flex-shrink-0 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <Cog className="w-5 h-5 text-white" />
              </span>
              <span className="font-bold text-gray-900 leading-tight text-sm sm:text-base truncate">
                Маркет запчастей
              </span>
            </Link>

            {/* Поиск — на десктопе в шапке */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-auto">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск запчасти, артикула…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  aria-label="Поиск по каталогу"
                />
              </div>
            </form>

            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-shrink-0">
              <Link
                to="/market/cart"
                className="relative p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                aria-label={`Корзина${totalCount ? `, ${totalCount} шт.` : ''}`}
              >
                <ShoppingCart className="w-5 h-5" />
                {totalCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {totalCount > 99 ? '99+' : totalCount}
                  </span>
                )}
              </Link>
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Войти</span>
              </Link>
            </div>
          </div>

          {/* Ряд 2 (мобила): поиск */}
          <form onSubmit={handleSearch} className="md:hidden pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск запчасти, артикула…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                aria-label="Поиск по каталогу"
              />
            </div>
          </form>

          {/* Ряд 3: навигация */}
          <nav className="flex items-center gap-1 pb-2 -mx-1 px-1 overflow-x-auto" aria-label="Разделы маркета">
            <NavLink to="/market/catalog" className={navLinkCls}>Каталог</NavLink>
            <NavLink to="/market/suppliers" className={navLinkCls}>Разборки</NavLink>
          </nav>
        </div>
      </header>

      {/* ── Контент ────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Outlet />
      </main>

      {/* ── Подвал ─────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            Маркет запчастей · б/у и новые запчасти от авторазборок
          </p>
          <p className="text-xs text-gray-300">TSP CRM · {new Date().getFullYear()}</p>
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
