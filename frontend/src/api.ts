import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Instance Axios configurée
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// INTERCEPTEUR DE REQUÊTE - lit TOUJOURS le token depuis localStorage
// Cette approche garantit que le token est lu au moment de chaque requête
api.interceptors.request.use(
  (config) => {
    try {
      const stored = localStorage.getItem('backupcontrol-auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.token) {
          config.headers.Authorization = `Bearer ${parsed.token}`;
        }
      }
    } catch (e) {
      console.error('Error reading token for request:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur de réponse pour gérer les erreurs 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Vérifier si on avait un token (pour éviter la boucle sur la page login)
      const stored = localStorage.getItem('backupcontrol-auth');
      if (stored && !window.location.pathname.includes('/login')) {
        console.log('401 received with stored token - clearing and redirecting');
        localStorage.removeItem('backupcontrol-auth');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Fonctions utilitaires pour gérer le token (utilisées depuis Login)
export const setApiToken = (token: string | null) => {
  // Cette fonction n'est plus nécessaire car l'intercepteur lit directement localStorage
  // Mais on la garde pour compatibilité - elle ne fait rien
  console.log('setApiToken called (no-op, interceptor reads from localStorage)');
};

export const getApiToken = (): string | null => {
  try {
    const stored = localStorage.getItem('backupcontrol-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.token || null;
    }
  } catch (e) {
    console.error('Error reading token:', e);
  }
  return null;
};

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    // Le backend attend du JSON avec email/password
    const response = await api.post('/auth/login', {
      email,
      password
    });
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Dashboard API
export const dashboardApi = {
  getSummary: async () => {
    const response = await api.get('/dashboard/summary');
    return response.data;
  },

  getAlerts: async (limit = 5) => {
    const response = await api.get(`/dashboard/alerts?limit=${limit}`);
    return response.data;
  },

  getRecentEvents: async (limit = 10) => {
    const response = await api.get(`/dashboard/recent-events?limit=${limit}`);
    return response.data;
  },
};

// Clients API
export const clientsApi = {
  getAll: async () => {
    const response = await api.get('/clients/');
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/clients/', data);
    return response.data;
  },

  update: async (id: number, data: any) => {
    const response = await api.put(`/clients/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },

  getBackups: async (id: number) => {
    const response = await api.get(`/clients/${id}/backups`);
    return response.data;
  },
};

// Backups API
export const backupsApi = {
  getAll: async (params?: any) => {
    const response = await api.get('/backups/', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/backups/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/backups/', data);
    return response.data;
  },

  update: async (id: number, data: any) => {
    const response = await api.put(`/backups/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/backups/${id}`);
    return response.data;
  },

  getHistory: async (id: number, limit = 30) => {
    const response = await api.get(`/backups/${id}/history?limit=${limit}`);
    return response.data;
  },

  addHistory: async (id: number, data: any) => {
    const response = await api.post(`/backups/${id}/history`, data);
    return response.data;
  },
};

// Alerts API
export const alertsApi = {
  getAll: async (params?: any) => {
    const response = await api.get('/alerts/', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/alerts/${id}`);
    return response.data;
  },

  acknowledge: async (id: number) => {
    const response = await api.patch(`/alerts/${id}/acknowledge`);
    return response.data;
  },

  resolve: async (id: number) => {
    const response = await api.patch(`/alerts/${id}/resolve`);
    return response.data;
  },
};

// Emails API
export const emailsApi = {
  getSettings: async () => {
    const response = await api.get('/email/settings');
    return response.data;
  },

  updateSettings: async (data: any) => {
    const response = await api.put('/email/settings', data);
    return response.data;
  },

  testConnection: async () => {
    const response = await api.post('/emails/test-connection');
    return response.data;
  },

  testSmtp: async () => {
    const response = await api.post('/emails/test-smtp');
    return response.data;
  },

  testTelegram: async () => {
    const response = await api.post('/emails/test-telegram');
    return response.data;
  },

  testDiscord: async () => {
    const response = await api.post('/emails/test-discord');
    return response.data;
  },

  testSlack: async () => {
    const response = await api.post('/emails/test-slack');
    return response.data;
  },

  testTeams: async () => {
    const response = await api.post('/emails/test-teams');
    return response.data;
  },

  // Nouvelle fonction: Recuperer et analyser les emails
  fetchAndAnalyze: async (limit: number = 500, analyze: boolean = true) => {
    const response = await api.post('/emails/fetch-and-analyze', {
      limit,
      folder: 'INBOX',
      analyze
    }, {
      timeout: 600000 // 10 minutes timeout pour l'analyse de 500 emails
    });
    return response.data;
  },

  // Progression de l'analyse
  getAnalysisProgress: async () => {
    const response = await api.get('/emails/analysis/progress');
    return response.data;
  },

  // Resume des sauvegardes
  getBackupSummary: async (days: number = 30) => {
    const response = await api.get(`/emails/backup-summary?days=${days}`);
    return response.data;
  },

  // Liste des emails analyses (nouvelle API v2)
  getAnalyzedEmails: async (backupOnly: boolean = false, limit: number = 200, offset: number = 0) => {
    const response = await api.get('/emails/analyzed', { 
      params: { backup_only: backupOnly, limit, offset }
    });
    return response.data;
  },

  // Detail d'un email analyse
  getAnalyzedEmailDetail: async (emailId: number) => {
    const response = await api.get(`/emails/analyzed/${emailId}`);
    return response.data;
  },

  getTemplates: async () => {
    const response = await api.get('/email/templates');
    return response.data;
  },

  getTemplate: async (id: number) => {
    const response = await api.get(`/email/templates/${id}`);
    return response.data;
  },

  updateTemplate: async (id: number, data: any) => {
    const response = await api.put(`/email/templates/${id}`, data);
    return response.data;
  },
};

// Settings API
export const settingsApi = {
  getAll: async () => {
    const response = await api.get('/settings/');
    return response.data;
  },

  update: async (key: string, value: any) => {
    const response = await api.put(`/settings/${key}`, { value: String(value) });
    return response.data;
  },

  updateBatch: async (settings: Record<string, any>) => {
    const response = await api.post('/settings/batch', settings);
    return response.data;
  },

  initialize: async () => {
    const response = await api.post('/settings/initialize');
    return response.data;
  },

  getRetentionPolicies: async () => {
    const response = await api.get('/settings/retention-policies');
    return response.data;
  },

  updateRetentionPolicy: async (id: number, data: any) => {
    const response = await api.put(`/settings/retention-policies/${id}`, data);
    return response.data;
  },
};

// Users API
export const usersApi = {
  getAll: async () => {
    const response = await api.get('/users/');
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/users/', data);
    return response.data;
  },

  update: async (id: number, data: any) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  changePassword: async (id: number, data: { current_password: string; new_password: string }) => {
    const response = await api.put(`/users/${id}/password`, data);
    return response.data;
  },
};

export default api;
