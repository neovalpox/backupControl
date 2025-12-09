import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BellAlertIcon,
  CheckIcon,
  XMarkIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { alertsApi } from '../api';
import type { Alert } from '../api';

export default function Alerts() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('active');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  useEffect(() => {
    fetchAlerts();
  }, [filter, severityFilter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      if (filter === 'active') params.active = true;
      if (filter === 'acknowledged') params.acknowledged = true;
      if (filter === 'resolved') params.resolved = true;
      if (severityFilter !== 'all') params.severity = severityFilter;
      
      const data = await alertsApi.getAll(params);
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await alertsApi.acknowledge(id);
      fetchAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await alertsApi.resolve(id);
      fetchAlerts();
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ExclamationCircleIcon className="w-6 h-6 text-red-500" />;
      case 'high':
        return <ExclamationTriangleIcon className="w-6 h-6 text-orange-500" />;
      case 'medium':
        return <BellAlertIcon className="w-6 h-6 text-yellow-500" />;
      default:
        return <InformationCircleIcon className="w-6 h-6 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-l-red-500 bg-red-500/5';
      case 'high':
        return 'border-l-orange-500 bg-orange-500/5';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-500/5';
      default:
        return 'border-l-blue-500 bg-blue-500/5';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}${t('time.daysAgo')}`;
    if (hours > 0) return `${hours}${t('time.hoursAgo')}`;
    if (minutes > 0) return `${minutes}${t('time.minutesAgo')}`;
    return t('time.justNow');
  };

  // Count by severity
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.resolved_at).length;
  const highCount = alerts.filter(a => a.severity === 'high' && !a.resolved_at).length;
  const mediumCount = alerts.filter(a => a.severity === 'medium' && !a.resolved_at).length;
  const lowCount = alerts.filter(a => a.severity === 'low' && !a.resolved_at).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{t('alerts.title')}</h1>
        <p className="text-gray-400 mt-1">{t('alerts.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-400 text-sm">{t('alerts.critical')}</p>
              <p className="text-3xl font-bold text-red-500">{criticalCount}</p>
            </div>
            <ExclamationCircleIcon className="w-10 h-10 text-red-500/50" />
          </div>
        </div>
        <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-400 text-sm">{t('alerts.high')}</p>
              <p className="text-3xl font-bold text-orange-500">{highCount}</p>
            </div>
            <ExclamationTriangleIcon className="w-10 h-10 text-orange-500/50" />
          </div>
        </div>
        <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-sm">{t('alerts.medium')}</p>
              <p className="text-3xl font-bold text-yellow-500">{mediumCount}</p>
            </div>
            <BellAlertIcon className="w-10 h-10 text-yellow-500/50" />
          </div>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm">{t('alerts.low')}</p>
              <p className="text-3xl font-bold text-blue-500">{lowCount}</p>
            </div>
            <InformationCircleIcon className="w-10 h-10 text-blue-500/50" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex bg-gray-800 rounded-lg p-1">
          {['active', 'acknowledged', 'resolved', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t(`alerts.filter.${f}`)}
            </button>
          ))}
        </div>

        <div className="relative">
          <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="pl-10 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
          >
            <option value="all">{t('alerts.allSeverities')}</option>
            <option value="critical">{t('alerts.critical')}</option>
            <option value="high">{t('alerts.high')}</option>
            <option value="medium">{t('alerts.medium')}</option>
            <option value="low">{t('alerts.low')}</option>
          </select>
        </div>
      </div>

      {/* Alerts list */}
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
            <BellAlertIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">{t('alerts.noAlerts')}</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-gray-800 rounded-xl border border-gray-700 border-l-4 ${getSeverityColor(alert.severity)} ${
                alert.resolved_at ? 'opacity-60' : ''
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{alert.title}</h3>
                      <p className="text-gray-400 mt-1">{alert.description}</p>
                      <div className="flex items-center space-x-4 mt-3 text-sm">
                        {alert.client_name && (
                          <span className="text-gray-500">
                            {t('alerts.client')}: <span className="text-gray-300">{alert.client_name}</span>
                          </span>
                        )}
                        {alert.backup_name && (
                          <span className="text-gray-500">
                            {t('alerts.backup')}: <span className="text-gray-300">{alert.backup_name}</span>
                          </span>
                        )}
                        <span className="text-gray-500" title={formatDate(alert.created_at)}>
                          {getTimeAgo(alert.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!alert.acknowledged_at && !alert.resolved_at && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="p-2 bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 rounded-lg transition-colors"
                        title={t('alerts.acknowledge')}
                      >
                        <CheckIcon className="w-5 h-5" />
                      </button>
                    )}
                    {!alert.resolved_at && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="p-2 bg-green-500/20 text-green-500 hover:bg-green-500/30 rounded-lg transition-colors"
                        title={t('alerts.resolve')}
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex items-center space-x-2 mt-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${
                    alert.severity === 'critical'
                      ? 'bg-red-500/20 text-red-500'
                      : alert.severity === 'high'
                      ? 'bg-orange-500/20 text-orange-500'
                      : alert.severity === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-500'
                      : 'bg-blue-500/20 text-blue-500'
                  }`}>
                    {t(`alerts.${alert.severity}`)}
                  </span>
                  {alert.acknowledged_at && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-500">
                      {t('alerts.acknowledged')}
                    </span>
                  )}
                  {alert.resolved_at && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-500">
                      {t('alerts.resolved')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
