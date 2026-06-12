import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import { AlertProvider } from './components/CustomAlert'
import VersionChecker from './components/VersionChecker'
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
const PartsCompanies = lazy(() => import('./pages/PartsCompanies'))
const PartsCompanyDetail = lazy(() => import('./pages/PartsCompanyDetail'))
const Subscriptions = lazy(() => import('./pages/Subscriptions'))
const Support = lazy(() => import('./pages/Support'))
const AdminSupport = lazy(() => import('./pages/AdminSupport'))
const MyVehicles = lazy(() => import('./pages/MyVehicles'))
const MyVehiclesArchive = lazy(() => import('./pages/MyVehiclesArchive'))
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
const PartsCustomers = lazy(() => import('./pages/PartsCustomers'))
const PartsCustomerProfile = lazy(() => import('./pages/PartsCustomerProfile'))
const PublicPartsCustomerView = lazy(() => import('./pages/PublicPartsCustomerView'))
const PublicPartsItemView     = lazy(() => import('./pages/PublicPartsItemView'))
const PartsCategories = lazy(() => import('./pages/PartsCategories'))
const PartsSettings = lazy(() => import('./pages/PartsSettings'))
const PartsWarehouse = lazy(() => import('./pages/PartsWarehouse'))
const PartsNoPricePage = lazy(() => import('./pages/PartsNoPricePage'))
const PartsInventoryItemPage = lazy(() => import('./pages/PartsInventoryItemPage'))
const Trash = lazy(() => import('./pages/Trash'))
const DatabasePage = lazy(() => import('./pages/Database'))
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const AdminAccessRequests = lazy(() => import('./pages/AdminAccessRequests'))
const PartsSubscriptionPage = lazy(() => import('./pages/PartsSubscriptionPage'))
const PartsMarketOrders = lazy(() => import('./pages/PartsMarketOrders'))

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
const MarketCart = lazy(() => import('./pages/market/MarketCart'))

import { useAuth } from './hooks/useAuth'
import { CartProvider } from './hooks/useCart'
import { useUserProfile } from './hooks/useUserProfile'
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
        <Version />
        <ImpersonationBanner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Toaster position="top-right" />
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

        {/* Публичный лендинг авторазборок */}
        <Route path="/business" element={<BusinessLanding />} />
        <Route path="/business/apply" element={<PartsApplication />} />

        {/* Публичный маркетплейс запчастей */}
        <Route path="/market" element={<MarketLayout />}>
          <Route index element={<MarketHome />} />
          <Route path="catalog" element={<MarketCatalog />} />
          <Route path="part/:id" element={<MarketProductPage />} />
          <Route path="suppliers" element={<MarketSuppliers />} />
          <Route path="supplier/:id" element={<MarketSupplierPage />} />
          <Route path="cart" element={<MarketCart />} />
        </Route>

        {/* Корень: гость → публичный маркетплейс, авторизованный → его раздел по роли */}
        <Route path="/" element={<RootGate />} />

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

          {/* Parts (Авторазборка) - Полностью отдельная система */}
          <Route path="parts/dashboard" element={<PartsDashboard />} />
          <Route path="parts/vehicles" element={<PartsVehicles />} />
          <Route path="parts/vehicles/:id" element={<PartsVehicleDetails />} />
          <Route path="parts/inventory" element={<PartsInventory />} />
          <Route path="parts/inventory/no-price" element={<PartsNoPricePage />} />
          <Route path="parts/inventory/:id" element={<PartsInventoryItemPage />} />
          <Route path="parts/orders" element={<PartsOrders />} />
          <Route path="parts/market-orders" element={<PartsMarketOrders />} />
          <Route path="parts/orders/create" element={<PartsCreateOrder />} />
          <Route path="parts/orders/:id" element={<PartsOrderDetails />} />
          <Route path="parts/customers" element={<PartsCustomers />} />
          <Route path="parts/customers/:id" element={<PartsCustomerProfile />} />
          <Route path="parts/employees" element={<PartsEmployees />} />
          <Route path="parts/analytics" element={<PartsAnalytics />} />
          <Route path="parts/categories" element={<PartsCategories />} />
          <Route path="parts/settings" element={<PartsSettings />} />
          <Route path="parts/warehouse" element={<PartsWarehouse />} />
          <Route path="parts/trash" element={<Trash />} />
        </Route>

        {/* Admin Panel - полностью отдельный layout */}
        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminPanel />} />
          <Route path="users" element={<Users />} />
          <Route path="users/new" element={<UserCreate />} />
          <Route path="users/:id/edit" element={<UserEdit />} />
          <Route path="roles" element={<Roles />} />
          <Route path="parts-companies" element={<PartsCompanies />} />
          <Route path="parts-companies/:companyId" element={<PartsCompanyDetail />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="access-requests" element={<AdminAccessRequests />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="database" element={<DatabasePage />} />
        </Route>

        {/* Неизвестный путь — на главную (вместо пустой страницы) */}
        <Route path="*" element={<Navigate to="/" replace />} />
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
  const { isLoading: profileLoading } = useUserProfile()

  if (loading || profileLoading) {
    return <LayoutSkeleton />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Корень «/» — публичный маркетплейс запчастей для ВСЕХ (гостей и залогиненных).
// Залогиненные переходят в свой раздел кнопкой «В кабинет» в шапке маркета —
// без принудительного авто-редиректа (раньше он бросал в админку/разборку).
function RootGate() {
  return <Navigate to="/market" replace />
}

export default App
