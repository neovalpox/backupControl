import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Backups from './pages/Backups';
import Alerts from './pages/Alerts';
import Emails from './pages/Emails';
import EmailAnalysis from './pages/EmailAnalysis';
import Settings from './pages/Settings';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token } = useAuthStore();
  
  // Le store est maintenant initialisé dès le départ avec les données du localStorage
  // Pas besoin d'attendre l'hydratation
  return isAuthenticated || token ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/backups" element={<Backups />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/emails" element={<Emails />} />
                <Route path="/email-analysis" element={<EmailAnalysis />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;
