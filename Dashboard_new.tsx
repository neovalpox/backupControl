import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ServerStackIcon,
  BellAlertIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { dashboardApi } from '../api';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardSummary {
  total_clients: number;
  total_backups: number;
  backups_success: number;
  backups_failed: number;
  backups_warning: number;
  backups_unknown: number;
  active_alerts: number;
  critical_alerts: number;
  success_rate: number;
  success_rate_trend: number;
}

interface RecentEvent {
  id: number;
  backup_name: string;
  client_name: string;
  status: string;
  event_date: string;
  message: string;
}

interface Alert {
  id: number;
  title: string;
  severity: string;
  client_name: string;
  created_at: string;
}

interface ClientOverview {
  client_id: number;
  client_name: string;
  short_name: string;
  global_status: string;
  backups_ok: number;
  backups_critical: number;
  total_backups: number;
}

interface TrendData {
  date: string;
  success: number;
  failure: number;
  warning: number;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clientsOverview, setClientsOverview] = useState<ClientOverview[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, eventsData, alertsData, overviewData, trendsData] = await Promise.all([
          dashboardApi.getSummary(),
          dashboardApi.getRecentEvents(10),
          dashboardApi.getAlerts(5),
          dashboardApi.getStatusOverview().catch(() => []),
          dashboardApi.getTrends(14).catch(() => []),
        ]);
        setSummary(summaryData);
        setRecentEvents(eventsData);
        setAlerts(alertsData);
        setClientsOverview(overviewData);
        setTrends(trendsData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-500 border-red-500';
      case 'high':
        return 'bg-orange-500/10 text-orange-500 border-orange-500';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Donnees pour le graphique Doughnut (repartition des statuts)
  const statusChartData = {
    labels: ['Succes', 'Echec', 'Attention', 'Inconnu'],
    datasets: [{
      data: [
        summary?.backups_success || 0,
        summary?.backups_failed || 0,
        summary?.backups_warning || 0,
        summary?.backups_unknown || 0,
      ],
      backgroundColor: ['#22c55e', '#ef4444', '#eab308', '#6b7280'],
      borderColor: ['#16a34a', '#dc2626', '#ca8a04', '#4b5563'],
      borderWidth: 2,
    }],
  };

  // Donnees pour le graphique de tendance (Line chart)
  const trendChartData = {
    labels: trends.map(t => {
      const d = new Date(t.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }),
    datasets: [
      {
        label: 'Succes',
        data: trends.map(t => t.success || 0),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Echecs',
        data: trends.map(t => t.failure || 0),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Donnees pour le graphique des clients (Bar chart horizontal)
  const clientsChartData = {
    labels: clientsOverview.slice(0, 10).map(c => c.short_name || c.client_name.substring(0, 10)),
    datasets: [
      {
        label: 'OK',
        data: clientsOverview.slice(0, 10).map(c => c.backups_ok),
        backgroundColor: '#22c55e',
      },
      {
        label: 'Echec',
        data: clientsOverview.slice(0, 10).map(c => c.backups_critical),
        backgroundColor: '#ef4444',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#9ca3af' },
      },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(75, 85, 99, 0.3)' },
      },
      y: {
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(75, 85, 99, 0.3)' },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#9ca3af', padding: 20 },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('dashboard.title')}</h1>
        <p className="text-gray-400 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Clients */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Clients</p>
              <p className="text-2xl font-bold text-white mt-1">{summary?.total_clients || 0}</p>
            </div>
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <UserGroupIcon className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Total Backups */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.totalBackups')}</p>
              <p className="text-2xl font-bold text-white mt-1">{summary?.total_backups || 0}</p>
            </div>
            <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
              <ServerStackIcon className="w-5 h-5 text-primary-500" />
            </div>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.successRate')}</p>
              <p className="text-2xl font-bold text-green-500 mt-1">
                {summary?.success_rate?.toFixed(1) || 0}%
              </p>
            </div>
            <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
            </div>
          </div>
          <div className="flex items-center mt-2 text-xs">
            {(summary?.success_rate_trend || 0) >= 0 ? (
              <ArrowTrendingUpIcon className="w-3 h-3 text-green-500 mr-1" />
            ) : (
              <ArrowTrendingDownIcon className="w-3 h-3 text-red-500 mr-1" />
            )}
            <span className={(summary?.success_rate_trend ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
              {summary?.success_rate_trend?.toFixed(1) || 0}%
            </span>
            <span className="text-gray-500 ml-1">vs semaine dern.</span>
          </div>
        </div>

        {/* Failed Backups */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.failedBackups')}</p>
              <p className="text-2xl font-bold text-red-500 mt-1">{summary?.backups_failed || 0}</p>
            </div>
            <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
              <XCircleIcon className="w-5 h-5 text-red-500" />
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.activeAlerts')}</p>
              <p className="text-2xl font-bold text-yellow-500 mt-1">{summary?.active_alerts || 0}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center">
              <BellAlertIcon className="w-5 h-5 text-yellow-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Tendance sur 14 jours</h2>
          <div className="h-64">
            {trends.length > 0 ? (
              <Line data={trendChartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Pas de donnees de tendance
              </div>
            )}
          </div>
        </div>

        {/* Doughnut Chart */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Repartition des statuts</h2>
          <div className="h-64">
            <Doughnut data={statusChartData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Clients bar chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Sauvegardes par client (Top 10)</h2>
          <Link to="/clients" className="text-primary-500 hover:text-primary-400 text-sm">
            Voir tous les clients
          </Link>
        </div>
        <div className="h-64">
          {clientsOverview.length > 0 ? (
            <Bar data={clientsChartData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Pas de donnees clients
            </div>
          )}
        </div>
      </div>

      {/* Status overview circles */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">{t('dashboard.statusOverview')}</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-2">
              <CheckCircleIcon className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-500">{summary?.backups_success || 0}</p>
            <p className="text-gray-400 text-sm">{t('dashboard.success')}</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-2">
              <XCircleIcon className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-500">{summary?.backups_failed || 0}</p>
            <p className="text-gray-400 text-sm">{t('dashboard.failed')}</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center mb-2">
              <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-yellow-500">{summary?.backups_warning || 0}</p>
            <p className="text-gray-400 text-sm">{t('dashboard.warning')}</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-gray-500/20 rounded-full flex items-center justify-center mb-2">
              <ClockIcon className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-2xl font-bold text-gray-500">{summary?.backups_unknown || 0}</p>
            <p className="text-gray-400 text-sm">{t('dashboard.unknown')}</p>
          </div>
        </div>
      </div>

      {/* Two columns: Recent events & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent events */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{t('dashboard.recentEvents')}</h2>
            <Link to="/backups" className="text-primary-500 hover:text-primary-400 text-sm">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          <div className="space-y-3">
            {recentEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">{t('dashboard.noEvents')}</p>
            ) : (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(event.status)}
                    <div>
                      <p className="text-white text-sm font-medium">{event.backup_name}</p>
                      <p className="text-gray-400 text-xs">{event.client_name}</p>
                    </div>
                  </div>
                  <span className="text-gray-500 text-xs">{formatDate(event.event_date)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active alerts */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{t('dashboard.activeAlertsTitle')}</h2>
            <Link to="/alerts" className="text-primary-500 hover:text-primary-400 text-sm">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-gray-500 text-center py-4">{t('dashboard.noAlerts')}</p>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{alert.title}</p>
                    <span className="text-xs uppercase font-semibold">{alert.severity}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs opacity-75">{alert.client_name}</p>
                    <span className="text-xs opacity-75">{formatDate(alert.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}