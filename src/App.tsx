import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import { AlertProvider } from './components/CustomAlert'
import VersionChecker from './components/VersionChecker'
import LocaleSync from './components/LocaleSync'
import Version from './components/Version'
import ImpersonationBanner from './components/ImpersonationBanner'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'

// Критичные страницы - загружаем сразу
import Login from './pages/Login'
import LandingPage from './pages/LandingPage'
import ResetPassword from './pages/ResetPassword'

// Lazy loading для остальных страниц
const Users = lazy(() => import('./pages/Users'))
const UserCreate = lazy(() => import('./pages/UserCreate'))
const UserEdit = lazy(() => import('./pages/UserEdit'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const Roles = lazy(() => import('./pages/Roles'))
const PartsCompanyDetail = lazy(() => import('./pages/PartsCompanyDetail'))
const Subscriptions = lazy(() => import('./pages/Subscriptions'))
const Support = lazy(() => import('./pages/Support'))
const AdminSupport = lazy(() => import('./pages/AdminSupport'))
const MyVehicles = lazy(() => import('./pages/MyVehicles'))
const MyVehiclesArchive = lazy(() => import('./pages/MyVehiclesArchive'))
const MyOrders = lazy(() => import('./pages/MyOrders'))
const PublicPersonalVehicleView = lazy(() => import('./pages/PublicPersonalVehicleView'))
const VehicleAccessPage = lazy(() => import('./pages/VehicleAccessPage'))
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'))
const PartsDashboard = lazy(() => import('./pages/PartsDashboard'))
const PartsVehicles = lazy(() => import('./pages/PartsVehicles'))
const PartsVehicleDetails = lazy(() => import('./pages/PartsVehicleDetails'))
const PartsInventory = lazy(() => import('./pages/PartsInventory'))
const PartsOrders = lazy(() => import('./pages/PartsOrders'))
const PartsOrderDetails = lazy(() => import('./pages/PartsOrderDetails'))
const PartsCreateOrder = lazy(() => import('./pages/PartsCreateOrder'))
const PartsEmployees = lazy(() => import('./pages/PartsEmployees'))
const PartsAnalytics = lazy(() => import('./pages/PartsAnalytics'))
const PartsRoi = lazy(() => import('./pages/PartsRoi'))
const PartsCustomers = lazy(() => import('./pages/PartsCustomers'))
const PartsCustomerProfile = lazy(() => import('./pages/PartsCustomerProfile'))
const PublicPartsCustomerView = lazy(() => import('./pages/PublicPartsCustomerView'))
const PublicPartsItemView     = lazy(() => import('./pages/PublicPartsItemView'))
const PublicPartsLocationView = lazy(() => import('./pages/PublicPartsLocationView'))
const PartsCategories = lazy(() => import('./pages/PartsCategories'))
const PartsSettings = lazy(() => import('./pages/PartsSettings'))
const PartsWarehouse = lazy(() => import('./pages/PartsWarehouse'))
const PartsNoPricePage = lazy(() => import('./pages/PartsNoPricePage'))
const PartsInventoryItemPage = lazy(() => import('./pages/PartsInventoryItemPage'))
const PartsInventoryEdit = lazy(() => import('./pages/PartsInventoryEdit'))
const Trash = lazy(() => import('./pages/Trash'))
const DatabasePage = lazy(() => import('./pages/Database'))
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const AdminAccessRequests = lazy(() => import('./pages/AdminAccessRequests'))
const AdminCarModels = lazy(() => import('./pages/AdminCarModels'))
const PartsSubscriptionPage = lazy(() => import('./pages/PartsSubscriptionPage'))
const PartsMarketOrders = lazy(() => import('./pages/PartsMarketOrders'))
const PartsShipments = lazy(() => import('./pages/PartsShipments'))
const PartsShipmentDetails = lazy(() => import('./pages/PartsShipmentDetails'))
const PartsActivityLog = lazy(() => import('./pages/PartsActivityLog'))

// Публичный лендинг авторазборок
const BusinessLanding = lazy(() => import('./pages/business/BusinessLanding'))
const PartsApplication = lazy(() => import('./pages/business/PartsApplication'))

// Публичный маркетплейс запчастей
const MarketLayout = lazy(() => import('./components/market/MarketLayout'))
const MarketHome = lazy(() => import('./pages/market/MarketHome'))
const MarketCatalog = lazy(() => import('./pages/market/MarketCatalog'))
const MarketProductPage = lazy(() => import('./pages/market/MarketProductPage'))
const MarketSuppliers = lazy(() => import('./pages/market/MarketSuppliers'))
const MarketSupplierPage = lazy(() => import('./pages/market/MarketSupplierPage'))
const MarketFavorites = lazy(() => import('./pages/market/MarketFavorites'))
const MarketCart = lazy(() => import('./pages/market/MarketCart'))
const WaitingAccessPage = lazy(() => import('./components/WaitingAccessPage'))
const NotFound = lazy(() => import('./pages/NotFound'))

import { useAuth } from './hooks/useAuth'
import { CartProvider } from './hooks/useCart'
import { useUserProfile, useIsAdmin } from './hooks/useUserProfile'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './lib/supabase'

import { LayoutSkeleton } from './components/LayoutSkeleton'

async function hardRecover() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.filter(k => !k.includes('google-fonts') && !k.includes('imgbb')).map(k => caches.delete(k)))
    }
  } catch { /* ignore */ }
  window.location.reload()
}

// Компонент загрузки для Suspense + «сторож»: если загрузка зависла надолго,
// предлагаем восстановление (часто причина — устаревший кэш SW в PWA).
function PageLoader() {
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setStuck(true), 12_000)
    return () => clearTimeout(t)
  }, [])
  return (
    <>
      <LayoutSkeleton />
      {stuck && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 flex justify-center">
          <div className="bg-white shadow-xl border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3 max-w-sm w-full">
            <p className="text-sm text-gray-700 flex-1">Загрузка затянулась. Обновить приложение?</p>
            <button onClick={hardRecover}
              className="px-3 py-1.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors flex-shrink-0">
              Обновить
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function App() {
  const queryClient = useQueryClient()
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    // Управляем кешем при изменении состояния аутентификации.
    // ВАЖНО: supabase повторно шлёт SIGNED_IN при фокусе вкладки/обновлении токена.
    // Чистим кэш ТОЛЬКО при реальной смене пользователя (вход/выход), иначе при
    // каждом фокусе страница перезагружала все данные.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        lastUserId.current = null
        queryClient.clear()
        localStorage.removeItem('tsp_profile_cache')
        localStorage.removeItem('activeRole')
        return
      }

      if (event === 'SIGNED_IN' && session) {
        const uid = session.user.id
        // Тот же пользователь (повторный SIGNED_IN при фокусе) — ничего не делаем
        if (lastUserId.current === uid) return
        lastUserId.current = uid
        queryClient.clear()
        queryClient.refetchQueries({ queryKey: ['userProfile'] })
      }
    })

    // Реальный выход/протухание токена ловится выше через onAuthStateChange
    // (SIGNED_OUT / TOKEN_REFRESHED без сессии). Раньше тут был обработчик на
    // 'focus', который при транзиентном getSession()===null (во время рефреша
    // токена или сразу после перезагрузки) делал принудительный signOut и
    // затирал валидную сессию — это вызывало случайные разлогины (в т.ч. при
    // переходе в маркет). supabase сам обновляет токен на фокусе, ручной выход не нужен.

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [queryClient])

  return (
    <ErrorBoundary>
      <AlertProvider>
        <CartProvider>
        <VersionChecker />
        <LocaleSync />
        <Version />
        <ImpersonationBanner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {/* Короче по времени и не перекрывают мобильную шапку:
              на мобиле опускаем ниже хедера (mobileOffset), на десктопе — обычный отступ. */}
          <Toaster
            position="top-center"
            duration={2500}
            offset={{ top: 16 }}
            mobileOffset={{ top: 64 }}
          />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/landing" element={<LandingPage />} />

        {/* Публичный доступ к автомобилям по коду */}
        <Route path="/vehicle-access" element={<VehicleAccessPage />} />
        <Route path="/public/personal-vehicle/:vehicleId" element={<PublicPersonalVehicleView />} />

        {/* Публичный профиль клиента разборки */}
        <Route path="/public/parts-customer/:id" element={<PublicPartsCustomerView />} />

        {/* Публичная страница запчасти */}
        <Route path="/public/parts-item/:id" element={<PublicPartsItemView />} />

        {/* Публичная страница места хранения (QR-этикетка) */}
        <Route path="/public/parts-location/:id" element={<PublicPartsLocationView />} />

        {/* Публичный лендинг авторазборок */}
        <Route path="/business" element={<BusinessLanding />} />
        <Route path="/business/apply" element={<PartsApplication />} />

        {/* Публичный маркетплейс запчастей */}
        <Route path="/market" element={<MarketLayout />}>
          <Route index element={<MarketHome />} />
          <Route path="catalog" element={<MarketCatalog />} />
          {/* SEO-лендинги по марке/модели: /market/catalog/tesla[/model-3] */}
          <Route path="catalog/:makeSlug" element={<MarketCatalog />} />
          <Route path="catalog/:makeSlug/:modelSlug" element={<MarketCatalog />} />
          <Route path="part/:id" element={<MarketProductPage />} />
          <Route path="suppliers" element={<MarketSuppliers />} />
          <Route path="supplier/:id" element={<MarketSupplierPage />} />
          <Route path="favorites" element={<MarketFavorites />} />
          <Route path="cart" element={<MarketCart />} />
        </Route>

        {/* Корень: гость → публичный маркетплейс, авторизованный → его раздел по роли */}
        <Route path="/" element={<RootGate />} />

        {/* Онбординг — выбор роли для нового пользователя (без роли) */}
        <Route path="/welcome" element={<WelcomePage />} />

        {/* Приложение — требует вход */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="dashboard" element={<Navigate to="/" replace />} />
          <Route path="users" element={<Users />} />
          <Route path="users/new" element={<UserCreate />} />
          <Route path="users/:id/edit" element={<UserEdit />} />
          <Route path="parts/subscription" element={<PartsSubscriptionPage />} />
          <Route path="support" element={<Support />} />
          <Route path="profile" element={<ProfileSettings />} />

          {/* Личные автомобили */}
          <Route path="my-vehicles" element={<MyVehicles />} />
          <Route path="my-vehicles/archive" element={<MyVehiclesArchive />} />
          <Route path="my-vehicles/:vehicleId" element={<PublicPersonalVehicleView />} />
          <Route path="my-orders" element={<MyOrders />} />

          {/* Parts (Авторазборка) - Полностью отдельная система */}
          <Route path="parts/dashboard" element={<PartsDashboard />} />
          <Route path="parts/vehicles" element={<PartsVehicles />} />
          <Route path="parts/vehicles/:id" element={<PartsVehicleDetails />} />
          <Route path="parts/inventory" element={<PartsInventory />} />
          <Route path="parts/inventory/new" element={<PartsInventoryEdit />} />
          <Route path="parts/inventory/no-price" element={<PartsNoPricePage />} />
          <Route path="parts/inventory/:id" element={<PartsInventoryItemPage />} />
          <Route path="parts/inventory/:id/edit" element={<PartsInventoryEdit />} />
          <Route path="parts/orders" element={<PartsOrders />} />
          <Route path="parts/market-orders" element={<PartsMarketOrders />} />
          <Route path="parts/shipments" element={<PartsShipments />} />
          <Route path="parts/shipments/:id" element={<PartsShipmentDetails />} />
          <Route path="parts/orders/create" element={<PartsCreateOrder />} />
          <Route path="parts/orders/:id" element={<PartsOrderDetails />} />
          <Route path="parts/customers" element={<PartsCustomers />} />
          <Route path="parts/customers/:id" element={<PartsCustomerProfile />} />
          <Route path="parts/employees" element={<PartsEmployees />} />
          <Route path="parts/analytics" element={<PartsAnalytics />} />
          <Route path="parts/roi" element={<PartsRoi />} />
          <Route path="parts/activity" element={<PartsActivityLog />} />
          <Route path="parts/categories" element={<PartsCategories />} />
          <Route path="parts/settings" element={<PartsSettings />} />
          <Route path="parts/warehouse" element={<PartsWarehouse />} />
          <Route path="parts/trash" element={<Trash />} />
        </Route>

        {/* Admin Panel - полностью отдельный layout. Ролевой guard в роутере
            (defense-in-depth: не полагаемся только на проверку внутри AdminLayout). */}
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<AdminPanel />} />
          <Route path="users" element={<Users />} />
          <Route path="users/new" element={<UserCreate />} />
          <Route path="users/:id/edit" element={<UserEdit />} />
          <Route path="roles" element={<Roles />} />
          <Route path="parts-companies" element={<Navigate to="/admin/subscriptions" replace />} />
          <Route path="parts-companies/:companyId" element={<PartsCompanyDetail />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="access-requests" element={<AdminAccessRequests />} />
          <Route path="car-models" element={<AdminCarModels />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="database" element={<DatabasePage />} />
        </Route>

        {/* Неизвестный путь — светлая 404 (вместо молчаливого редиректа на «/») */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
    </BrowserRouter>
    </CartProvider>
  </AlertProvider>
</ErrorBoundary>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useUserProfile()

  // Ждём профиль: profile===undefined = запрос ещё не завершён (isLoading бывает false,
  // когда запрос отключён) — иначе внутренние гейты рендерятся с неизвестными ролями.
  if (loading || profileLoading || (user && profile === undefined)) {
    return <LayoutSkeleton />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Ролевой guard для /admin/* — редиректит не-админов ещё в роутере, до монтирования
// админ-страниц (не полагаемся на проверку внутри AdminLayout как единственную защиту).
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useUserProfile()
  const isAdmin = useIsAdmin()

  // Ждём профиль, иначе isAdmin=false во время загрузки → ложный редирект из /admin.
  if (loading || profileLoading || (user && profile === undefined)) {
    return <LayoutSkeleton />
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

// Корень «/»: гость → публичный маркет; новый пользователь без роли → экран выбора
// роли (онбординг); пользователь с ролью → публичный маркет (дальше «В кабинет»).
function RootGate() {
  const { user, loading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useUserProfile()
  // ВАЖНО для OAuth: при возврате с Google в URL лежит «?code=…», который supabase-js
  // обменивает на сессию во время инициализации (loading=true). Если редиректнуть
  // сразу, Navigate затрёт «?code» из адреса ДО обмена — сессия не создастся.
  // Поэтому ждём окончания инициализации авторизации (и профиль, чтобы знать роли).
  // Ждём и профиль: isLoading=false пока запрос отключён/не стартовал (profile===undefined),
  // тогда роли ещё НЕ известны — нельзя редиректить на онбординг, показываем грузилку.
  if (loading || (user && (profileLoading || profile === undefined))) return <PageLoader />
  // Залогинен, но роли ещё нет — это новый пользователь: ведём на выбор роли.
  if (user && !profile?.roles?.length) return <Navigate to="/welcome" replace />
  return <Navigate to="/market" replace />
}

// «/welcome» — экран приветствия с выбором роли (Авторазборка → Владелец/Работник,
// либо Личные авто). Для залогиненного пользователя БЕЗ роли; с ролью — на маркет.
function WelcomePage() {
  const queryClient = useQueryClient()
  const { user, loading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useUserProfile()

  const handleLogout = async () => {
    queryClient.clear()
    localStorage.removeItem('tsp_profile_cache')
    localStorage.removeItem('activeRole')
    await supabase.auth.signOut()
  }

  // Форму выбора роли показываем ТОЛЬКО когда профиль реально загружен (иначе, пока
  // profile===undefined, роли не известны → мелькала форма вместо грузилки).
  if (loading || (user && (profileLoading || profile === undefined))) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (profile?.roles?.length) return <Navigate to="/market" replace />
  return <WaitingAccessPage profile={profile} onLogout={handleLogout} />
}

export default App
