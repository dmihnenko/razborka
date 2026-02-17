import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import { AlertProvider } from './components/CustomAlert'
import VersionChecker from './components/VersionChecker'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'

// Критичные страницы - загружаем сразу
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// Lazy loading для остальных страниц
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
const VehicleAccessPage = lazy(() => import('./pages/VehicleAccessPage'))
const Analytics = lazy(() => import('./pages/Analytics'))
const MonthlyDetails = lazy(() => import('./pages/MonthlyDetails'))
const MonthlyStatistics = lazy(() => import('./pages/MonthlyStatistics'))
const ActivityHistory = lazy(() => import('./pages/ActivityHistory'))
const PartsDashboard = lazy(() => import('./pages/PartsDashboard'))
const PartsVehicles = lazy(() => import('./pages/PartsVehicles'))
const PartsInventory = lazy(() => import('./pages/PartsInventory'))
const PartsOrders = lazy(() => import('./pages/PartsOrders'))
const PartsEmployees = lazy(() => import('./pages/PartsEmployees'))
const PartsAnalytics = lazy(() => import('./pages/PartsAnalytics'))
const PartsCustomers = lazy(() => import('./pages/PartsCustomers'))

import { useAuth } from './hooks/useAuth'
import { useUserProfile } from './hooks/useUserProfile'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './lib/supabase'

// Компонент загрузки для Suspense
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
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
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Toaster position="top-right" />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
        
        {/* Публичный доступ к автомобилям по коду */}
        <Route path="/vehicle-access" element={<VehicleAccessPage />} />
        <Route path="/public/personal-vehicle/:vehicleId" element={<PublicPersonalVehicleView />} />
        
        {/* Публичный профиль клиента */}
        <Route path="/public/customer/:id" element={<PublicCustomerView />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customer/:id" element={<CustomerProfile />} />
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
          <Route path="history" element={<ActivityHistory />} />
          <Route path="support" element={<Support />} />
          
          {/* Личные автомобили */}
          <Route path="my-vehicles" element={<MyVehicles />} />
          <Route path="my-vehicles/archive" element={<MyVehiclesArchive />} />
          <Route path="my-appointments" element={<Appointments />} />
          
          {/* Parts (Авторазборка) - Полностью отдельная система */}
          <Route path="parts/dashboard" element={<PartsDashboard />} />
          <Route path="parts/vehicles" element={<PartsVehicles />} />
          <Route path="parts/inventory" element={<PartsInventory />} />
          <Route path="parts/orders" element={<PartsOrders />} />
          <Route path="parts/customers" element={<PartsCustomers />} />
          <Route path="parts/employees" element={<PartsEmployees />} />
          <Route path="parts/analytics" element={<PartsAnalytics />} />
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
          <Route path="analytics" element={<div className="p-8"><h1 className="text-2xl font-bold">Аналитика</h1><p className="text-gray-600 mt-4">В разработке...</p></div>} />
          <Route path="database" element={<div className="p-8"><h1 className="text-2xl font-bold">База данных</h1><p className="text-gray-600 mt-4">В разработке...</p></div>} />
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
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default App
