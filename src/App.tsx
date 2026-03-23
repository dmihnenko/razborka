import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import { AlertProvider } from './components/CustomAlert'
import VersionChecker from './components/VersionChecker'
import Version from './components/Version'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'

// Критичные страницы - загружаем сразу
import Login from './pages/Login'

// Lazy loading для остальных страниц
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Customers = lazy(() => import('./pages/Customers'))
const Vehicles = lazy(() => import('./pages/Vehicles'))
const Appointments = lazy(() => import('./pages/Appointments'))
const AppointmentDetails = lazy(() => import('./pages/AppointmentDetails'))
const WorkOrders = lazy(() => import('./pages/WorkOrders'))
const Services = lazy(() => import('./pages/Services'))
const Parts = lazy(() => import('./pages/Parts'))
const Invoices = lazy(() => import('./pages/Invoices'))
const Users = lazy(() => import('./pages/Users'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const Roles = lazy(() => import('./pages/Roles'))
const StoCompanies = lazy(() => import('./pages/StoCompanies'))
const PartsCompanies = lazy(() => import('./pages/PartsCompanies'))
const Subscriptions = lazy(() => import('./pages/Subscriptions'))
const StoEmployees = lazy(() => import('./pages/StoEmployees'))
const StoSettings = lazy(() => import('./pages/StoSettings'))
const EmployeeProfile = lazy(() => import('./pages/EmployeeProfile'))
const WorkerDashboard = lazy(() => import('./pages/WorkerDashboard'))
const Support = lazy(() => import('./pages/Support'))
const AdminSupport = lazy(() => import('./pages/AdminSupport'))
const MyVehicles = lazy(() => import('./pages/MyVehicles'))
const MyVehiclesArchive = lazy(() => import('./pages/MyVehiclesArchive'))
const PublicPersonalVehicleView = lazy(() => import('./pages/PublicPersonalVehicleView'))
const PublicCustomerView = lazy(() => import('./pages/PublicCustomerView'))
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'))
const VehicleHistory = lazy(() => import('./pages/VehicleHistory'))
const VehicleAccessPage = lazy(() => import('./pages/VehicleAccessPage'))
const Analytics = lazy(() => import('./pages/Analytics'))
const MonthlyDetails = lazy(() => import('./pages/MonthlyDetails'))
const MonthlyStatistics = lazy(() => import('./pages/MonthlyStatistics'))
const MonthlyRevenue = lazy(() => import('./pages/MonthlyRevenue'))
const ActivityHistory = lazy(() => import('./pages/ActivityHistory'))
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
const PartsCategories = lazy(() => import('./pages/PartsCategories'))
const PartsSettings = lazy(() => import('./pages/PartsSettings'))
const PartsWarehouse = lazy(() => import('./pages/PartsWarehouse'))
const PartsNoPricePage = lazy(() => import('./pages/PartsNoPricePage'))
const PartsInventoryItemPage = lazy(() => import('./pages/PartsInventoryItemPage'))
const Trash = lazy(() => import('./pages/Trash'))
const DatabasePage = lazy(() => import('./pages/Database'))
const DatabaseAdminPage = lazy(() => import('./pages/DatabaseAdmin'))

import { useAuth } from './hooks/useAuth'
import { useUserProfile } from './hooks/useUserProfile'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './lib/supabase'

import { LayoutSkeleton } from './components/LayoutSkeleton'

// Компонент загрузки для Suspense
function PageLoader() {
  return <LayoutSkeleton />
}

function App() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let mounted = true

    // Управляем кешем при изменении состояния аутентификации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return
      
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
      }
      if (event === 'SIGNED_IN') {
        // Инвалидируем только профиль пользователя, чтобы перезагрузить его данные
        queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [queryClient])

  return (
    <ErrorBoundary>
      <AlertProvider>
        <VersionChecker />
        <Version />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Toaster position="top-right" />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
        
        {/* Публичный доступ к автомобилям по коду */}
        <Route path="/vehicle-access" element={<VehicleAccessPage />} />
        <Route path="/public/personal-vehicle/:vehicleId" element={<PublicPersonalVehicleView />} />
        
        {/* Публичный профиль клиента СТО */}
        <Route path="/public/customer/:id" element={<PublicCustomerView />} />
        
        {/* Публичный профиль клиента разборки */}
        <Route path="/public/parts-customer/:id" element={<PublicPartsCustomerView />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Navigate to="/" replace />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customer/:id" element={<CustomerProfile />} />
          <Route path="vehicle/:vehicleId/history" element={<VehicleHistory />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="statistics" element={<MonthlyStatistics />} />
          <Route path="statistics/month/:month" element={<MonthlyDetails />} />
          <Route path="sto/appointments/:appointmentId" element={<AppointmentDetails />} />
          <Route path="work-orders" element={<WorkOrders />} />
          <Route path="services" element={<Services />} />
          <Route path="parts" element={<Parts />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="users" element={<Users />} />
          <Route path="sto" element={<Navigate to="/" replace />} />
          <Route path="sto/employees" element={<StoEmployees />} />
          <Route path="sto/employees/:employeeId" element={<EmployeeProfile />} />
          <Route path="sto/settings" element={<StoSettings />} />
          <Route path="worker/dashboard" element={<WorkerDashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="monthly-revenue" element={<MonthlyRevenue />} />
          <Route path="history" element={<ActivityHistory />} />
          <Route path="support" element={<Support />} />
          
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
          <Route path="parts/orders/create" element={<PartsCreateOrder />} />
          <Route path="parts/orders/:id" element={<PartsOrderDetails />} />
          <Route path="parts/customers" element={<PartsCustomers />} />
          <Route path="parts/customers/:id" element={<PartsCustomerProfile />} />
          <Route path="parts/employees" element={<PartsEmployees />} />
          <Route path="parts/analytics" element={<PartsAnalytics />} />
          <Route path="parts/categories" element={<PartsCategories />} />
          <Route path="parts/settings" element={<PartsSettings />} />
          <Route path="parts/warehouse" element={<PartsWarehouse />} />
          <Route path="sto/trash" element={<Trash />} />
          <Route path="parts/trash" element={<Trash />} />
        </Route>
        
        {/* Admin Panel - полностью отдельный layout */}
        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminPanel />} />
          <Route path="users" element={<Users />} />
          <Route path="roles" element={<Roles />} />
          <Route path="sto" element={<StoCompanies />} />
          <Route path="parts-companies" element={<PartsCompanies />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="settings" element={<div className="p-8"><h1 className="text-2xl font-bold">Настройки</h1><p className="text-gray-600 mt-4">В разработке...</p></div>} />
          <Route path="analytics" element={<DatabasePage />} />
          <Route path="database" element={<DatabaseAdminPage />} />
        </Route>
      </Routes>
    </Suspense>
    </BrowserRouter>
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

export default App