import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  login: async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/auth/login', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },
  getMe: async () => (await api.get('/auth/me')).data,
};

export const dashboardApi = {
  getStats: async () => (await api.get('/dashboard/stats')).data,
  getTrend: async (days: number = 14) => (await api.get(`/dashboard/trend?days=${days}`)).data,
};

export const clientsApi = {
  getAll: async () => (await api.get('/clients')).data,
  getById: async (id: number) => (await api.get(`/clients/${id}`)).data,
  create: async (data: any) => (await api.post('/clients', data)).data,
  update: async (id: number, data: any) => (await api.put(`/clients/${id}`, data)).data,
  delete: async (id: number) => (await api.delete(`/clients/${id}`)).data,
  merge: async (sourceId: number, targetId: number) => (await api.post('/clients/merge', { source_client_id: sourceId, target_client_id: targetId })).data,
};

export const backupsApi = {
  getAll: async () => (await api.get('/backups')).data,
  getById: async (id: number) => (await api.get(`/backups/${id}`)).data,
  getByClient: async (clientId: number) => (await api.get(`/backups?client_id=${clientId}`)).data,
  create: async (data: any) => (await api.post('/backups', data)).data,
  update: async (id: number, data: any) => (await api.put(`/backups/${id}`, data)).data,
  delete: async (id: number) => (await api.delete(`/backups/${id}`)).data,
};

export const alertsApi = {
  getAll: async (params?: { status?: string; severity?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.severity) searchParams.append('severity', params.severity);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString();
    return (await api.get(`/alerts${query ? `?${query}` : ''}`)).data;
  },
  acknowledge: async (id: number) => (await api.post(`/alerts/${id}/acknowledge`)).data,
  resolve: async (id: number) => (await api.post(`/alerts/${id}/resolve`)).data,
  getCount: async () => (await api.get('/alerts/count')).data,
};

export const emailsApi = {
  fetchAndAnalyze: async (count?: number, createRecords?: boolean) => {
    const params = new URLSearchParams();
    if (count) params.append('count', count.toString());
    if (createRecords !== undefined) params.append('create_records', createRecords.toString());
    const query = params.toString();
    return (await api.post(`/emails/fetch${query ? `?${query}` : ''}`)).data;
  },
  getAnalyzedEmails: async (backupOnly?: boolean, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (backupOnly !== undefined) params.append('backup_only', backupOnly.toString());
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return (await api.get(`/emails/analyzed${query ? `?${query}` : ''}`)).data;
  },
  getLastSync: async () => (await api.get('/emails/last-sync')).data,
};

export const notificationsApi = {
  test: async (type: string) => (await api.post(`/notifications/test/${type}`)).data,
  sendReport: async () => (await api.post('/notifications/report')).data,
};

export const settingsApi = {
  getAll: async () => (await api.get('/settings')).data,
  update: async (key: string, value: any) => (await api.put(`/settings/${key}`, { value })).data,
};

export default api;