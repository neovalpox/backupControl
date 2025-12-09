import { create } from 'zustand';
import api from './api';

interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  language: string;
  theme: string;
}

// Fonction pour lire l'auth depuis localStorage
const getStoredAuth = (): { user: User | null; token: string | null; isAuthenticated: boolean } => {
  try {
    const stored = localStorage.getItem('backupcontrol-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        user: parsed.user || null,
        token: parsed.token || null,
        isAuthenticated: !!parsed.token,
      };
    }
  } catch (e) {
    console.error('Error reading auth from localStorage:', e);
  }
  return { user: null, token: null, isAuthenticated: false };
};

// Fonction pour sauvegarder l'auth dans localStorage
const saveAuth = (user: User | null, token: string | null) => {
  if (token && user) {
    localStorage.setItem('backupcontrol-auth', JSON.stringify({ user, token }));
  } else {
    localStorage.removeItem('backupcontrol-auth');
  }
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  initFromStorage: () => void;
}

// Initialiser avec les valeurs du localStorage
const initialAuth = getStoredAuth();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialAuth.user,
  token: initialAuth.token,
  isAuthenticated: initialAuth.isAuthenticated,

  initFromStorage: () => {
    const auth = getStoredAuth();
    set({
      user: auth.user,
      token: auth.token,
      isAuthenticated: auth.isAuthenticated,
    });
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, user } = response.data;
    
    // Sauvegarder dans localStorage
    saveAuth(user, access_token);
    
    set({
      user,
      token: access_token,
      isAuthenticated: true,
    });
    
    // Appliquer le thème et la langue
    document.body.classList.toggle('light', user.theme === 'light');
    localStorage.setItem('language', user.language);
  },

  setAuth: (token: string, user: User) => {
    // Sauvegarder dans localStorage
    saveAuth(user, token);
    
    set({
      user,
      token,
      isAuthenticated: true,
    });
    
    // Appliquer le thème et la langue
    if (user.theme) {
      document.body.classList.toggle('light', user.theme === 'light');
    }
    if (user.language) {
      localStorage.setItem('language', user.language);
    }
  },

  logout: () => {
    // Supprimer du localStorage
    saveAuth(null, null);
    
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  updateUser: (userData: Partial<User>) => {
    const currentUser = get().user;
    const currentToken = get().token;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...userData };
      saveAuth(updatedUser, currentToken);
      set({ user: updatedUser });
    }
  },
}));

// Store pour le thème (simple, sans persist)
interface ThemeState {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
}

const getStoredTheme = (): 'dark' | 'light' => {
  try {
    const stored = localStorage.getItem('backupcontrol-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (e) {}
  return 'dark';
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getStoredTheme(),
  
  setTheme: (theme) => {
    localStorage.setItem('backupcontrol-theme', theme);
    set({ theme });
    document.body.classList.toggle('light', theme === 'light');
  },
  
  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('backupcontrol-theme', newTheme);
    set({ theme: newTheme });
    document.body.classList.toggle('light', newTheme === 'light');
  },
}));

// Store pour les données du dashboard
interface DashboardData {
  summary: {
    total_clients: number;
    total_backups: number;
    backups_ok: number;
    backups_warning: number;
    backups_alert: number;
    backups_critical: number;
    backups_failed: number;
    unresolved_alerts: number;
    health_percentage: number;
    last_update: string | null;
  } | null;
  statusOverview: any[];
  recentEvents: any[];
  alerts: any[];
  trends: any[];
  isLoading: boolean;
  error: string | null;
  fetchDashboard: () => Promise<void>;
}

export const useDashboardStore = create<DashboardData>((set) => ({
  summary: null,
  statusOverview: [],
  recentEvents: [],
  alerts: [],
  trends: [],
  isLoading: false,
  error: null,

  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const [summaryRes, overviewRes, eventsRes, alertsRes, trendsRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/status-overview'),
        api.get('/dashboard/recent-events'),
        api.get('/dashboard/alerts'),
        api.get('/dashboard/trends'),
      ]);

      set({
        summary: summaryRes.data,
        statusOverview: overviewRes.data,
        recentEvents: eventsRes.data,
        alerts: alertsRes.data,
        trends: trendsRes.data,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Erreur de chargement',
        isLoading: false,
      });
    }
  },
}));
