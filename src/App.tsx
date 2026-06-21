import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/appStore.js';
import { defaultHomeRoute } from './lib/format.js';
import AppLayout from './components/AppLayout.js';
import LoginPage from './pages/Login.js';

import EmployeeDashboard from './pages/employee/Dashboard.js';
import ApplyPage from './pages/employee/Apply.js';
import ApplicationsPage from './pages/employee/Applications.js';
import ApplicationDetailPage from './pages/employee/ApplicationDetail.js';
import RatingPage from './pages/employee/Rating.js';

import SupervisorDashboard from './pages/supervisor/Dashboard.js';
import ApprovalsPage from './pages/supervisor/Approvals.js';
import SupervisorStatistics from './pages/supervisor/Statistics.js';
import BudgetPage from './pages/supervisor/Budget.js';

import DriverDashboard from './pages/driver/Dashboard.js';
import ScanPage from './pages/driver/Scan.js';
import DriverTrips from './pages/driver/Trips.js';
import SchedulePage from './pages/driver/Schedule.js';

import DispatcherDashboard from './pages/dispatch/Dashboard.js';
import VehiclesPage from './pages/dispatch/Vehicles.js';
import DriversPage from './pages/dispatch/Drivers.js';
import DispatchCenter from './pages/dispatch/Dispatch.js';
import MaintenancePage from './pages/dispatch/Maintenance.js';

import FinanceDashboard from './pages/finance/Dashboard.js';
import BillsPage from './pages/finance/Bills.js';
import FinanceStatistics from './pages/finance/Statistics.js';

import NotificationsPage from './pages/Notifications.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAppStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout title="公务车辆调度平台" subtitle="智能调度 · 高效出行" />
            </ProtectedRoute>
          }
        >
          <Route index element={<NavigateToHome />} />
          <Route path="employee/dashboard" element={<EmployeeDashboard />} />
          <Route path="employee/apply" element={<ApplyPage />} />
          <Route path="employee/applications" element={<ApplicationsPage />} />
          <Route path="employee/application/:id" element={<ApplicationDetailPage />} />
          <Route path="employee/applications/:id" element={<ApplicationDetailPage />} />
          <Route path="employee/rating/:tripId" element={<RatingPage />} />

          <Route path="supervisor/dashboard" element={<SupervisorDashboard />} />
          <Route path="supervisor/approvals" element={<ApprovalsPage />} />
          <Route path="supervisor/statistics" element={<SupervisorStatistics />} />
          <Route path="supervisor/budget" element={<BudgetPage />} />

          <Route path="driver/dashboard" element={<DriverDashboard />} />
          <Route path="driver/scan" element={<ScanPage />} />
          <Route path="driver/trips" element={<DriverTrips />} />
          <Route path="driver/schedule" element={<SchedulePage />} />

          <Route path="dispatcher/dashboard" element={<DispatcherDashboard />} />
          <Route path="dispatcher/vehicles" element={<VehiclesPage />} />
          <Route path="dispatcher/drivers" element={<DriversPage />} />
          <Route path="dispatcher/dispatch" element={<DispatchCenter />} />
          <Route path="dispatcher/maintenance" element={<MaintenancePage />} />

          <Route path="finance/dashboard" element={<FinanceDashboard />} />
          <Route path="finance/bills" element={<BillsPage />} />
          <Route path="finance/statistics" element={<FinanceStatistics />} />

          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

function NavigateToHome() {
  const user = useAppStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultHomeRoute(user.role)} replace />;
}
