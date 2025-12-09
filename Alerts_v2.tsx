import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BellIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  FunnelIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { alertsApi } from '../api';

export default function Alerts() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [selectedAlerts, setSelectedAlerts] = useState<number[]>([]);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const data = await alertsApi.getAll();
      setAlerts(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await alertsApi.acknowledge(id);
      fetchAlerts();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await alertsApi.resolve(id);
      fetchAlerts();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleBatchAcknowledge = async () => {
    for (const id of selectedAlerts) {
      await alertsApi.acknowledge(id);
    }
    setSelectedAlerts([]);
    fetchAlerts();
  };

  const handleBatchResolve = async () => {
    for (const id of selectedAlerts) {
      await alertsApi.resolve(id);
    }
    setSelectedAlerts([]);
    fetchAlerts();
  };

  const toggleSelect = (id: number) => {
    setSelectedAlerts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedAlerts.length === filteredAlerts.length) {
      setSelectedAlerts([]);
    } else {
      setSelectedAlerts(filteredAlerts.map((a) => a.id));
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return <XMarkIcon className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/10 text-red-500',
      warning: 'bg-yellow-500/10 text-yellow-500',
      info: 'bg-blue-500/10 text-blue-500',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[severity?.toLowerCase()] || colors.info}`}>
        {getSeverityIcon(severity)}
        <span className="ml-1 capitalize">{severity || 'Info'}</span>
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-red-500/10 text-red-500',
      acknowledged: 'bg-yellow-500/10 text-yellow-500',
      resolved: 'bg-green-500/10 text-green-500',
    };
    const icons: Record<string, JSX.Element> = {
      new: <BellIcon className="w-4 h-4" />,
      acknowledged: <ClockIcon className="w-4 h-4" />,
      resolved: <CheckCircleIcon className="w-4 h-4" />,
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status?.toLowerCase()] || colors.new}`}>
        {icons[status?.toLowerCase()] || icons.new}
        <span className="ml-1 capitalize">{status || 'Nouveau'}</span>
      </span>
    );
  };

  const filteredAlerts = alerts.filter((alert) => {
    const matchesStatus = filterStatus === 'all' || alert.status?.toLowerCase() === filterStatus;
    const matchesSeverity = filterSeverity === 'all' || alert.severity?.toLowerCase() === filterSeverity;
    return matchesStatus && matchesSeverity;
  });

  const newCount = alerts.filter((a) => a.status?.toLowerCase() === 'new').length;
  const acknowledgedCount = alerts.filter((a) => a.status?.toLowerCase() === 'acknowledged').length;
  const criticalCount = alerts.filter((a) => a.severity?.toLowerCase() === 'critical').length;

  if (loading) {
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
          <h1 className="text-2xl font-bold text-white">{t('alerts.title')}</h1>
          <p className="text-gray-400 mt-1">{t('alerts.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total</p>
          <p className="text-2xl font-bold text-white">{alerts.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Nouvelles</p>
          <p className="text-2xl font-bold text-red-500">{newCount}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">En cours</p>
          <p className="text-2xl font-bold text-yellow-500">{acknowledgedCount}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Critiques</p>
          <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-2">
          <FunnelIcon className="w-5 h-5 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            <option value="all">Tous statuts</option>
            <option value="new">Nouvelles</option>
            <option value="acknowledged">En cours</option>
            <option value="resolved">Resolues</option>
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            <option value="all">Toutes severites</option>
            <option value="critical">Critique</option>
            <option value="warning">Attention</option>
            <option value="info">Info</option>
          </select>
        </div>
        {selectedAlerts.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-sm">{selectedAlerts.length} selectionnee(s)</span>
            <button
              onClick={handleBatchAcknowledge}
              className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg"
            >
              Prendre en charge
            </button>
            <button
              onClick={handleBatchResolve}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg"
            >
              Resoudre
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedAlerts.length === filteredAlerts.length && filteredAlerts.length > 0}
                  onChange={selectAll}
                  className="rounded border-gray-600 text-primary-600 focus:ring-primary-500"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Severite</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Message</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredAlerts.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Aucune alerte</td></tr>
            ) : (
              filteredAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedAlerts.includes(alert.id)}
                      onChange={() => toggleSelect(alert.id)}
                      className="rounded border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-4">{getSeverityBadge(alert.severity)}</td>
                  <td className="px-6 py-4">
                    <p className="text-white font-medium">{alert.title || 'Alerte'}</p>
                    <p className="text-gray-400 text-sm truncate max-w-md">{alert.message}</p>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(alert.status)}</td>
                  <td className="px-6 py-4 text-gray-300 text-sm">{formatDate(alert.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      {alert.status?.toLowerCase() !== 'acknowledged' && alert.status?.toLowerCase() !== 'resolved' && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg"
                          title="Prendre en charge"
                        >
                          <ClockIcon className="w-5 h-5" />
                        </button>
                      )}
                      {alert.status?.toLowerCase() !== 'resolved' && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg"
                          title="Resoudre"
                        >
                          <CheckIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}