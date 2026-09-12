import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { PasswordResetProvider } from '@/context/PasswordResetContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Toaster } from '@/components/ui/toaster'

import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import VerifyOtp from '@/pages/VerifyOtp'
import ResetPassword from '@/pages/ResetPassword'
import StateCity from '@/pages/StateCity'
import Dealers from '@/pages/Dealers'
import Dashboard from '@/pages/Dashboard'
import Users from '@/pages/Users'
import UserDetails from '@/pages/UserDetails'
import Requests from '@/pages/Requests'
import Subscriptions from '@/pages/Subscriptions'
import Notifications from '@/pages/Notifications'
import ActivityLogs from '@/pages/ActivityLogs'
import Settings from '@/pages/Settings'
import Profile from '@/pages/Profile'
import NoAccess from '@/pages/NoAccess'
import NotFound from '@/pages/NotFound'
import DealerDashboard from '@/pages/DealerDashboard'
import VehicleProcesses from '@/pages/VehicleProcesses'
import CreateVehicleProcess from '@/pages/CreateVehicleProcess'
import VehicleProcessDetail from '@/pages/VehicleProcessDetail'
import TaskBoard from '@/pages/TaskBoard'
import TaskHistory from '@/pages/TaskHistory'
import VehicleHistory from '@/pages/VehicleHistory'
import DealerSettings from '@/pages/DealerSettings'
import Agents from '@/pages/Agents'
import RtoServices from '@/pages/RtoServices'
import DocumentCategories from '@/pages/DocumentCategories'
import DealerAgents from '@/pages/DealerAgents'
import RolesPermissions from '@/pages/RolesPermissions'
import AgentDashboard from '@/pages/AgentDashboard'
import AgentBoard from '@/pages/AgentBoard'
import AgentAssignments from '@/pages/AgentAssignments'
import AgentAssignmentDetail from '@/pages/AgentAssignmentDetail'
import AgentDealers from '@/pages/AgentDealers'
import AgentDealerVehicles from '@/pages/AgentDealerVehicles'
import AgentCreateVehicleProcess from '@/pages/AgentCreateVehicleProcess'
import AgentVehicleProcessDetail from '@/pages/AgentVehicleProcessDetail'
import AgentSettings from '@/pages/AgentSettings'
import Ledger from '@/pages/Ledger'
import AgentOnboarding from '@/pages/AgentOnboarding'
import RegistrationRequests from '@/pages/RegistrationRequests'
import PendingApproval from '@/pages/PendingApproval'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <PasswordResetProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/forgot-password/verify-otp" element={<VerifyOtp />} />
              <Route path="/forgot-password/reset" element={<ResetPassword />} />
              {/* Public agent onboarding via a dealer's invitation link (no auth). */}
              <Route path="/agent-onboarding/:token" element={<AgentOnboarding />} />
              {/* Authenticated but not-yet-approved dealer/agent lands here (pending or rejected). */}
              <Route path="/pending-approval" element={<ProtectedRoute><PendingApproval /></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route element={<ProtectedRoute allowedRoles={['super_admin']}><DashboardLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/requests" element={<RegistrationRequests />} />
                <Route path="/dealers" element={<Dealers />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/rto-services" element={<RtoServices />} />
                <Route path="/document-categories" element={<DocumentCategories />} />
                <Route path="/state-city" element={<StateCity />} />
                <Route path="/users" element={<Users />} />
                <Route path="/users/:id" element={<UserDetails />} />
                <Route path="/requests" element={<Requests />} />
                <Route path="/subscriptions" element={<Subscriptions />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/activity" element={<ActivityLogs />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['dealer']}><DashboardLayout /></ProtectedRoute>}>
                <Route path="/dealer/dashboard" element={<DealerDashboard />} />
                <Route path="/dealer/processes" element={<VehicleProcesses />} />
                <Route path="/dealer/processes/new" element={<CreateVehicleProcess />} />
                <Route path="/dealer/processes/:id" element={<VehicleProcessDetail />} />
                <Route path="/dealer/board" element={<TaskBoard />} />
                <Route path="/dealer/tasks/history" element={<TaskHistory />} />
                <Route path="/dealer/vehicle-history" element={<VehicleHistory />} />
                <Route path="/dealer/settings" element={<DealerSettings />} />
                <Route path="/dealer/agents" element={<DealerAgents />} />
                <Route path="/dealer/roles" element={<RolesPermissions />} />
                <Route path="/dealer/ledger" element={<Ledger />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['agent']}><DashboardLayout /></ProtectedRoute>}>
                <Route path="/agent/dashboard" element={<AgentDashboard />} />
                <Route path="/agent/board" element={<AgentBoard />} />
                <Route path="/agent/assignments" element={<AgentAssignments />} />
                <Route path="/agent/assignments/:id" element={<AgentAssignmentDetail />} />
                <Route path="/agent/dealers" element={<AgentDealers />} />
                <Route path="/agent/dealers/:dealerId/vehicles" element={<AgentDealerVehicles />} />
                <Route path="/agent/dealers/:dealerId/vehicles/new" element={<AgentCreateVehicleProcess />} />
                <Route path="/agent/dealers/:dealerId/vehicles/:id" element={<AgentVehicleProcessDetail />} />
                <Route path="/agent/settings" element={<AgentSettings />} />
                <Route path="/agent/ledger" element={<Ledger />} />
              </Route>

              <Route
                path="/no-access"
                element={
                  <ProtectedRoute>
                    <NoAccess />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
          </PasswordResetProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
