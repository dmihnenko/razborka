import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AlertProvider } from './components/CustomAlert'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Vehicles from './pages/Vehicles'
import Appointments from './pages/Appointments'
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
import VehicleAccessPage from './pages/VehicleAccessPage'
import { useAuth } from './hooks/useAuth'
import { useUserProfile } from './hooks/useUserProfile'

function App() {
  return (
    <AlertProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster position="top-right" />
        <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Публичный доступ к автомобилям по коду */}
        <Route path="/vehicle-access" element={<VehicleAccessPage />} />
        <Route path="/public/personal-vehicle/:vehicleId" element={<PublicPersonalVehicleView />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="work-orders" element={<WorkOrders />} />
          <Route path="services" element={<Services />} />
          <Route path="parts" element={<Parts />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="users" element={<Users />} />
          <Route path="sto/employees" element={<StoEmployees />} />
          <Route path="sto/employees/:employeeId" element={<EmployeeProfile />} />
          <Route path="worker/dashboard" element={<WorkerDashboard />} />
          <Route path="support" element={<Support />} />
          
          {/* Личные автомобили */}
          <Route path="my-vehicles" element={<MyVehicles />} />
          <Route path="my-vehicles/archive" element={<MyVehiclesArchive />} />
          <Route path="my-appointments" element={<Appointments />} />
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
