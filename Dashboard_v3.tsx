import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ServerStackIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  BellAlertIcon,
  ArrowPathIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { dashboardApi, emailsApi } from '../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchData();
        setLastRefresh(new Date());
      }, 60000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchData = async () => {
    try {
      const [statsData, trendData, syncData] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getTrend(14),
        emailsApi.getLastSync().catch(() => ({ last_sync: null })),
      ]);
      setStats(statsData);
      setTrend(trendData);
      setLastSync(syncData.last_sync);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
    setLastRefresh(new Date());
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Jamais';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    if (diffMins < 1) return 'A l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const lineChartData = {
    labels: trend.map((d) => new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })),
    datasets: [
      {
        label: 'OK',
        data: trend.map((d) => d.success),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Echec',
        data: trend.map((d) => d.failed),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const doughnutData = {
    labels: ['OK', 'Echec', 'Inconnu'],
    datasets: [
      {
        data: [stats?.backups_success || 0, stats?.backups_failed || 0, stats?.backups_unknown || 0],
        backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(156, 163, 175, 0.8)'],
        borderColor: ['rgb(34, 197, 94)', 'rgb(239, 68, 68)', 'rgb(156, 163, 175)'],
        borderWidth: 2,
      },
    ],
  };

  const barChartData = {
    labels: stats?.top_clients?.map((c: any) => c.name.substring(0, 15)) || [],
    datasets: [
      {
        label: 'OK',
        data: stats?.top_clients?.map((c: any) => c.ok) || [],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      },
      {
        label: 'Echec',
        data: stats?.top_clients?.map((c: any) => c.failed) || [],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
      },
    ],
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.title')}</h1>
          <p className="text-gray-400 mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <ClockIcon className="w-4 h-4" />
            <span>Synchro: {formatLastSync(lastSync)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="sr-only"
              />
              <span className={`w-10 h-5 rounded-full transition-colors ${autoRefresh ? 'bg-primary-600' : 'bg-gray-600'} relative`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${autoRefresh ? 'translate-x-5' : ''}`} />
              </span>
              <span className="ml-2 text-sm text-gray-400">Auto</span>
            </label>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 text-right">
        Derniere actualisation: {lastRefresh.toLocaleTimeString('fr-FR')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.totalClients')}</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.total_clients || 0}</p>
            </div>
            <UserGroupIcon className="w-12 h-12 text-primary-500 opacity-80" />
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.totalBackups')}</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.total_backups || 0}</p>
            </div>
            <ServerStackIcon className="w-12 h-12 text-blue-500 opacity-80" />
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.backupsOk')}</p>
              <p className="text-3xl font-bold text-green-500 mt-1">{stats?.backups_success || 0}</p>
            </div>
            <CheckCircleIcon className="w-12 h-12 text-green-500 opacity-80" />
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.backupsFailed')}</p>
              <p className="text-3xl font-bold text-red-500 mt-1">{stats?.backups_failed || 0}</p>
            </div>
            <XCircleIcon className="w-12 h-12 text-red-500 opacity-80" />
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.pendingAlerts')}</p>
              <p className="text-3xl font-bold text-yellow-500 mt-1">{stats?.pending_alerts || 0}</p>
            </div>
            <BellAlertIcon className="w-12 h-12 text-yellow-500 opacity-80" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">{t('dashboard.trend')}</h2>
          <div className="h-72">
            <Line
              data={lineChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { color: '#9ca3af' } } },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(75, 85, 99, 0.3)' }, ticks: { color: '#9ca3af' } },
                  x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
                },
              }}
            />
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">{t('dashboard.distribution')}</h2>
          <div className="h-72 flex items-center justify-center">
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 20 } } },
              }}
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">{t('dashboard.topClients')}</h2>
        <div className="h-64">
          <Bar
            data={barChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'top', labels: { color: '#9ca3af' } } },
              scales: {
                y: { beginAtZero: true, stacked: true, grid: { color: 'rgba(75, 85, 99, 0.3)' }, ticks: { color: '#9ca3af' } },
                x: { stacked: true, grid: { display: false }, ticks: { color: '#9ca3af' } },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}