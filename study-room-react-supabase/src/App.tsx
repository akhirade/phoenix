import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './layout/AppLayout'
import { AdmissionPrintPage } from './pages/AdmissionPrintPage'
import { AdmissionPublicPage } from './pages/AdmissionPublicPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SeatsPage } from './pages/SeatsPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudentsPage } from './pages/StudentsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/admission/:token" element={<AdmissionPublicPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/seats" element={<SeatsPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/admission/print/:studentId" element={<AdmissionPrintPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
