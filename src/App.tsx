import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { AlertProvider } from './components/CustomAlert'
import VersionChecker from './components/VersionChecker'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Vehicles from './pages/Vehicles'
import Appointments from './pages/Appointments'
import AppointmentDetails from './pages/AppointmentDetails'
import WorkOrders from './pages/WorkOrders'
import Services from './pages/Services'
import Parts from './pages/Parts'
import Invoices from './pages/Invoices'
import Users from './pages/Users'
import Login from './pages/Login'
import AdminPanel from './pages/AdminPanel'
import Roles from './pages/Roles'
import StoCompanies from './pages/StoCompanies'
import PartsCompanies from './pages/PartsCompanies'
import Subscriptions from './pages/Subscriptions'
import StoEmployees from './pages/StoEmployees'
import EmployeeProfile from './pages/EmployeeProfile'
import WorkerDashboard from './pages/WorkerDashboard'
import Support from './pages/Support'
import AdminSupport from './pages/AdminSupport'
import MyVehicles from './pages/MyVehicles'
import MyVehiclesArchive from './pages/MyVehiclesArchive'
import PublicPersonalVehicleView from './pages/PublicPersonalVehicleView'
import PublicCustomerView from './pages/PublicCustomerView'
import CustomerProfile from './pages/CustomerProfile'
import VehicleAccessPage from './pages/VehicleAccessPage'
import Analytics from './pages/Analytics'
import MonthlyDetails from './pages/MonthlyDetails'
import MonthlyStatistics from './pages/MonthlyStatistics'
import ActivityHistory from './pages/ActivityHistory'
import PartsDashboard from './pages/PartsDashboard'
import PartsVehicles from './pages/PartsVehicles'
import PartsInventory from './pages/PartsInventory'
import PartsOrders from './pages/PartsOrders'
import PartsEmployees from './pages/PartsEmployees'
import PartsAnalytics from './pages/PartsAnalytics'
import PartsCustomers from './pages/PartsCustomers'
import { useAuth } from './hooks/useAuth'
import { useUserProfile } from './hooks/useUserProfile'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './lib/supabase'

function App() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Очищаем кэш только при выходе
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
      }
      // При входе НЕ очищаем кэш, чтобы не было перезагрузок
    })

    return () => subscription.unsubscribe()
  }, [queryClient])

  return (
    <AlertProvider>
      <VersionChecker />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster position="top-right" />
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
          <Route path="appointments/statistics" element={<MonthlyStatistics />} />
          <Route path="appointments/month/:month" element={<MonthlyDetails />} />
          <Route path="sto/appointments/:appointmentId" element={<AppointmentDetails />} />
          <Route path="work-orders" element={<WorkOrders />} />
          <Route path="services" element={<Services />} />
          <Route path="parts" element={<Parts />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="users" element={<Users />} />
          <Route path="sto/employees" element={<StoEmployees />} />
          <Route path="sto/employees/:employeeId" element={<EmployeeProfile />} />
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
      </BrowserRouter>
    </AlertProvider>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useUserProfile()

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
