import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Cog, LogIn, Search, ShoppingCart, Wrench } from 'lucide-react'
import { CartProvider, useCart } from '@/hooks/useCart'

// ============================================================================
// Публичный каркас маркетплейса (/market/*) — без сайдбара приложения.
// Сам оборачивает контент в CartProvider, поэтому в App.tsx достаточно:
// <Route path="/market" element={<MarketLayout />}> ...дочерние роуты... </Route>
// ============================================================================

function navLinkCls({ isActive }: { isActive: boolean }) {
  return [
    'inline-flex items-center justify-center min-w-[104px] px-5 py-1.5 rounded-full text-sm transition-all duration-150 whitespace-nowrap active:scale-[0.97]',
    isActive
      ? 'bg-white text-gray-900 font-semibold shadow-sm'
      : 'text-gray-500 font-medium hover:text-gray-800',
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
      <header className="glass border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 sm:px-4">

          {/* Ряд 1: логотип · поиск(десктоп) · корзина · войти */}
          <div className="flex items-center gap-2 sm:gap-3 h-[60px]">
            <Link to="/market" className="group flex items-center gap-2.5 flex-shrink-0 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 shadow-glow-blue flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
                <Cog className="w-5 h-5 text-white" />
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

            {/* Поиск — на десктопе в шапке */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-auto">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск запчасти, артикула…"
                  className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-200 rounded-full bg-gray-100/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200"
                  aria-label="Поиск по каталогу"
                />
              </div>
            </form>

            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-shrink-0">
              <Link
                to="/market/cart"
                className="relative p-2.5 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-150 active:scale-[0.94]"
                aria-label={`Корзина${totalCount ? `, ${totalCount} шт.` : ''}`}
              >
                <ShoppingCart className="w-5 h-5" />
                {totalCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-b from-blue-500 to-blue-600 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-glow-blue animate-scale-in">
                    {totalCount > 99 ? '99+' : totalCount}
                  </span>
                )}
              </Link>
              <Link
                to="/business"
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-b from-blue-500 to-blue-600 shadow-glow-blue hover:opacity-90 transition-all duration-150 active:scale-[0.97]"
              >
                <Wrench className="w-4 h-4" />
                <span>Открыть разборку</span>
              </Link>
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 bg-white hover:border-gray-300 hover:text-gray-900 shadow-sm transition-all duration-150 active:scale-[0.97]"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Войти</span>
              </Link>
            </div>
          </div>

          {/* Ряд 2 (мобила): поиск */}
          <form onSubmit={handleSearch} className="md:hidden pb-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск запчасти, артикула…"
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-full bg-gray-100/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200"
                aria-label="Поиск по каталогу"
              />
            </div>
          </form>

          {/* Ряд 3: навигация — центрированный сегмент-контрол */}
          <nav className="flex items-center justify-center pb-2.5" aria-label="Разделы маркета">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-gray-100/80 border border-gray-200/70">
              <NavLink to="/market/catalog" className={navLinkCls}>Каталог</NavLink>
              <NavLink to="/market/suppliers" className={navLinkCls}>Разборки</NavLink>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Контент ────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Outlet />
      </main>

      {/* ── Подвал ─────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <Cog className="w-3.5 h-3.5 text-white" />
            </span>
            <p className="text-xs font-medium text-gray-400">
              Маркет запчастей · б/у и новые запчасти от авторазборок
            </p>
          </div>
          <p className="text-xs text-gray-300">© {new Date().getFullYear()}</p>
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
