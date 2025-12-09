import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export type Client = any;
export type Backup = any;
export type BackupEvent = any;
export type Alert = any;

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

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
    } catch (e) {}
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const stored = localStorage.getItem('backupcontrol-auth');
      if (stored && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('backupcontrol-auth');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const setApiToken = (_token: string | null) => {};
export const getApiToken = (): string | null => {
  try {
    const stored = localStorage.getItem('backupcontrol-auth');
    if (stored) return JSON.parse(stored).token || null;
  } catch (e) {}
  return null;
};

export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
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
  getStatusOverview: async () => {
    const response = await api.get('/dashboard/status-overview');
    return response.data;
  },
  getTrends: async (days = 30) => {
    const response = await api.get(`/dashboard/trends?days=${days}`);
    return response.data;
  },
};

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
  merge: async (sourceId: number, targetId: number) => {
    const response = await api.post('/clients/merge', { source_client_id: sourceId, target_client_id: targetId });
    return response.data;
  },
};

export const backupsApi = {
  getAll: async (params?: { client_id?: number; status?: string }) => {
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
  getEvents: async (backupId: number) => {
    const response = await api.get(`/backups/${backupId}/events`);
    return response.data;
  },
  setMaintenance: async (id: number, maintenance: boolean) => {
    const response = await api.put(`/backups/${id}`, { is_maintenance: maintenance });
    return response.data;
  },
};

export const alertsApi = {
  getAll: async () => {
    const response = await api.get('/dashboard/alerts?limit=100');
    return response.data;
  },
  acknowledge: async (id: number) => {
    const response = await api.post(`/dashboard/alerts/${id}/acknowledge`);
    return response.data;
  },
  resolve: async (id: number) => {
    const response = await api.post(`/dashboard/alerts/${id}/resolve`);
    return response.data;
  },
};

export const emailsApi = {
  getAll: async () => {
    const response = await api.get('/emails/');
    return response.data;
  },
  getById: async (id: number) => {
    const response = await api.get(`/emails/${id}`);
    return response.data;
  },
  fetch: async () => {
    const response = await api.post('/emails/fetch');
    return response.data;
  },
  fetchNew: async () => {
    const response = await api.post('/emails/fetch');
    return response.data;
  },
  analyze: async (emailId: number) => {
    const response = await api.post(`/emails/analyze/${emailId}`);
    return response.data;
  },
  analyzeAll: async () => {
    const response = await api.post('/emails/analyze-all');
    return response.data;
  },
  fetchAndAnalyze: async (days: number = 7) => {
    const response = await api.post(`/emails/fetch-and-analyze?days=${days}`);
    return response.data;
  },
  getAnalysisProgress: async () => {
    const response = await api.get('/emails/analysis-progress');
    return response.data;
  },
  getBackupSummary: async () => {
    const response = await api.get('/emails/backup-summary');
    return response.data;
  },
  getAnalyzedEmails: async () => {
    const response = await api.get('/emails/analyzed');
    return response.data;
  },
  getAnalyzedEmailDetail: async (id: number) => {
    const response = await api.get(`/emails/analyzed/${id}`);
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
    const response = await api.post('/notifications/test', { channel: 'telegram' });
    return response.data;
  },
  testDiscord: async () => {
    const response = await api.post('/notifications/test', { channel: 'discord' });
    return response.data;
  },
  testSlack: async () => {
    const response = await api.post('/notifications/test', { channel: 'slack' });
    return response.data;
  },
  testTeams: async () => {
    const response = await api.post('/notifications/test', { channel: 'teams' });
    return response.data;
  },
};

export const settingsApi = {
  get: async () => {
    const response = await api.get('/settings/');
    return response.data;
  },
  getAll: async () => {
    const response = await api.get('/settings/');
    return response.data;
  },
  update: async (data: any) => {
    const response = await api.put('/settings/', data);
    return response.data;
  },
  updateBatch: async (settings: any[]) => {
    const response = await api.put('/settings/batch', settings);
    return response.data;
  },
  initialize: async () => {
    const response = await api.post('/settings/initialize');
    return response.data;
  },
  testEmail: async () => {
    const response = await api.post('/settings/test-email');
    return response.data;
  },
  getOffice365Status: async () => {
    const response = await api.get('/settings/office365/status');
    return response.data;
  },
  getOffice365AuthUrl: async () => {
    const response = await api.get('/settings/office365/auth-url');
    return response.data;
  },
};

export const notificationsApi = {
  getSettings: async () => {
    const response = await api.get('/notifications/settings');
    return response.data;
  },
  test: async (channel: string, webhookUrl?: string) => {
    const response = await api.post('/notifications/test', { channel, webhook_url: webhookUrl });
    return response.data;
  },
  sendReport: async () => {
    const response = await api.post('/notifications/report');
    return response.data;
  },
};

export default api;