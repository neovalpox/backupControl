import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ServerStackIcon,
  BellAlertIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { dashboardApi } from '../api';

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

export default function Dashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, eventsData, alertsData] = await Promise.all([
          dashboardApi.getSummary(),
          dashboardApi.getRecentEvents(10),
          dashboardApi.getAlerts(5),
        ]);
        setSummary(summaryData);
        setRecentEvents(eventsData);
        setAlerts(alertsData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Backups */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.totalBackups')}</p>
              <p className="text-3xl font-bold text-white mt-1">{summary?.total_backups || 0}</p>
            </div>
            <div className="w-12 h-12 bg-primary-600/20 rounded-xl flex items-center justify-center">
              <ServerStackIcon className="w-6 h-6 text-primary-500" />
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            {summary?.total_clients || 0} {t('dashboard.clients')}
          </p>
        </div>

        {/* Success Rate */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.successRate')}</p>
              <p className="text-3xl font-bold text-green-500 mt-1">
                {summary?.success_rate?.toFixed(1) || 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <div className="flex items-center mt-4 text-sm">
            {(summary?.success_rate_trend || 0) >= 0 ? (
              <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
            ) : (
              <ArrowTrendingDownIcon className="w-4 h-4 text-red-500 mr-1" />
            )}
            <span className={summary?.success_rate_trend >= 0 ? 'text-green-500' : 'text-red-500'}>
              {summary?.success_rate_trend?.toFixed(1) || 0}%
            </span>
            <span className="text-gray-500 ml-1">{t('dashboard.vsLastWeek')}</span>
          </div>
        </div>

        {/* Failed Backups */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.failedBackups')}</p>
              <p className="text-3xl font-bold text-red-500 mt-1">{summary?.backups_failed || 0}</p>
            </div>
            <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center">
              <XCircleIcon className="w-6 h-6 text-red-500" />
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            {summary?.backups_warning || 0} {t('dashboard.warnings')}
          </p>
        </div>

        {/* Active Alerts */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('dashboard.activeAlerts')}</p>
              <p className="text-3xl font-bold text-yellow-500 mt-1">{summary?.active_alerts || 0}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-600/20 rounded-xl flex items-center justify-center">
              <BellAlertIcon className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            {summary?.critical_alerts || 0} {t('dashboard.critical')}
          </p>
        </div>
      </div>

      {/* Status overview */}
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
