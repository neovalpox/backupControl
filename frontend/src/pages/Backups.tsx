import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowPathIcon,
  WrenchScrewdriverIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  UserGroupIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import { backupsApi, clientsApi } from '../api';
import type { Backup, BackupEvent } from '../api';

interface Client {
  id: number;
  name: string;
}

export default function Backups() {
  const { t } = useTranslation();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [events, setEvents] = useState<BackupEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchBackups();
    fetchClients();
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [statusFilter, clientFilter, typeFilter]);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (clientFilter !== 'all') params.client_id = parseInt(clientFilter);
      if (typeFilter !== 'all') params.backup_type = typeFilter;
      const data = await backupsApi.getAll(params);
      setBackups(data);
    } catch (error) {
      console.error('Error fetching backups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const data = await clientsApi.getAll();
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchEvents = async (backupId: number) => {
    setLoadingEvents(true);
    try {
      const data = await backupsApi.getEvents(backupId);
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleBackupClick = async (backup: Backup) => {
    setSelectedBackup(backup);
    await fetchEvents(backup.id);
  };

  const toggleMaintenance = async (backup: Backup) => {
    try {
      await backupsApi.setMaintenance(backup.id, !backup.is_maintenance);
      fetchBackups();
    } catch (error) {
      console.error('Error toggling maintenance:', error);
    }
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const headers = ['Nom', 'Client', 'Type', 'Statut', 'Derniere execution', 'Taille', 'Succes', 'Echecs'];
      const rows = filteredBackups.map(b => [
        b.name,
        b.client_name,
        b.backup_type,
        b.current_status,
        b.last_event_at || '-',
        b.last_size_bytes ? formatSize(b.last_size_bytes) : '-',
        b.total_success_count,
        b.total_failure_count
      ]);
      const csvContent = [headers, ...rows].map(row => row.join(';')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sauvegardes_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const getStatusIcon = (status: string, size = 'w-5 h-5') => {
    switch (status) {
      case 'success':
      case 'ok':
        return <CheckCircleIcon className={`${size} text-green-500`} />;
      case 'failed':
      case 'error':
        return <XCircleIcon className={`${size} text-red-500`} />;
      case 'warning':
        return <ExclamationTriangleIcon className={`${size} text-yellow-500`} />;
      default:
        return <ClockIcon className={`${size} text-gray-500`} />;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'ok':
        return 'bg-green-500/10 border-green-500/20';
      case 'failed':
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const formatSize = (bytes: number | null | undefined) => {
    if (!bytes) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(2)} ${units[i]}`;
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  // Get unique backup types
  const backupTypes = useMemo(() => {
    const types = [...new Set(backups.map(b => b.backup_type))];
    return types.filter(Boolean).sort();
  }, [backups]);

  const filteredBackups = useMemo(() => backups.filter((backup) =>
    backup.name.toLowerCase().includes(search.toLowerCase()) ||
    backup.client_name?.toLowerCase().includes(search.toLowerCase())
  ), [backups, search]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredBackups.length;
    const success = filteredBackups.filter(b => b.current_status === 'ok' || b.current_status === 'success').length;
    const failed = filteredBackups.filter(b => b.current_status === 'failed' || b.current_status === 'error').length;
    const warning = filteredBackups.filter(b => b.current_status === 'warning').length;
    const maintenance = filteredBackups.filter(b => b.is_maintenance).length;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0';
    return { total, success, failed, warning, maintenance, successRate };
  }, [filteredBackups]);

  if (loading && backups.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('backups.title')}</h1>
          <p className="text-gray-400 mt-1">{t('backups.subtitle')}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
            {exporting ? 'Export...' : 'CSV'}
          </button>
          <button
            onClick={fetchBackups}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <ArrowPathIcon className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('backups.search')}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="relative">
          <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none min-w-[150px]"
          >
            <option value="all">{t('backups.allStatuses')}</option>
            <option value="ok">{t('status.success')}</option>
            <option value="failed">{t('status.failed')}</option>
            <option value="warning">{t('status.warning')}</option>
          </select>
        </div>
        <div className="relative">
          <UserGroupIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="pl-10 pr-8 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none min-w-[180px]"
          >
            <option value="all">Tous les clients</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <ServerIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="pl-10 pr-8 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none min-w-[150px]"
          >
            <option value="all">Tous types</option>
            {backupTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('backups.total')}</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <ServerIcon className="w-8 h-8 text-gray-600" />
          </div>
        </div>
        <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-sm">{t('status.success')}</p>
              <p className="text-2xl font-bold text-green-500">{stats.success}</p>
            </div>
            <CheckCircleIcon className="w-8 h-8 text-green-500/50" />
          </div>
        </div>
        <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-400 text-sm">{t('status.failed')}</p>
              <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
            </div>
            <XCircleIcon className="w-8 h-8 text-red-500/50" />
          </div>
        </div>
        <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-sm">{t('status.warning')}</p>
              <p className="text-2xl font-bold text-yellow-500">{stats.warning}</p>
            </div>
            <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500/50" />
          </div>
        </div>
        <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-400 text-sm">Maintenance</p>
              <p className="text-2xl font-bold text-orange-500">{stats.maintenance}</p>
            </div>
            <WrenchScrewdriverIcon className="w-8 h-8 text-orange-500/50" />
          </div>
        </div>
        <div className="bg-primary-500/10 rounded-lg p-4 border border-primary-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-400 text-sm">Taux succes</p>
              <p className="text-2xl font-bold text-primary-500">{stats.successRate}%</p>
            </div>
            <ChartBarIcon className="w-8 h-8 text-primary-500/50" />
          </div>
        </div>
      </div>

      {/* Backups list */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('backups.name')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('backups.client')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('backups.type')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('backups.status')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('backups.lastRun')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('backups.size')}
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredBackups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    {t('backups.noBackups')}
                  </td>
                </tr>
              ) : (
                filteredBackups.map((backup) => (
                  <tr
                    key={backup.id}
                    className={`hover:bg-gray-700/50 cursor-pointer transition-colors ${
                      backup.is_maintenance ? 'opacity-60' : ''
                    }`}
                    onClick={() => handleBackupClick(backup)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${getStatusBgColor(backup.current_status || 'unknown')}`}>
                          {getStatusIcon(backup.current_status || 'unknown')}
                        </div>
                        <div>
                          <p className="text-white font-medium">{backup.name}</p>
                          {backup.is_maintenance && (
                            <span className="text-xs text-orange-500 flex items-center">
                              <WrenchScrewdriverIcon className="w-3 h-3 mr-1" />
                              {t('backups.maintenance')}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/clients`}
                        className="text-gray-300 hover:text-primary-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {backup.client_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                        {backup.backup_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        backup.current_status === 'ok' || backup.current_status === 'success'
                          ? 'bg-green-500/10 text-green-500'
                          : backup.current_status === 'failed' || backup.current_status === 'error'
                          ? 'bg-red-500/10 text-red-500'
                          : backup.current_status === 'warning'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {backup.current_status || 'unknown'}
                      </span>
                      {backup.last_error_message && (backup.current_status === 'failed' || backup.current_status === 'error') && (
                        <p className="text-red-400 text-xs mt-1 max-w-[200px] truncate" title={backup.last_error_message}>
                          {backup.last_error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {formatDate(backup.last_event_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {formatSize(backup.last_size_bytes)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-500">{backup.total_success_count}</span>
                      <span className="text-gray-500 mx-1">/</span>
                      <span className="text-red-500">{backup.total_failure_count}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMaintenance(backup);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          backup.is_maintenance
                            ? 'bg-orange-500/20 text-orange-500 hover:bg-orange-500/30'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                        title={t('backups.toggleMaintenance')}
                      >
                        <WrenchScrewdriverIcon className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedBackup(null)} />
          <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedBackup.name}</h2>
                <p className="text-gray-400">{selectedBackup.client_name}</p>
              </div>
              <button
                onClick={() => setSelectedBackup(null)}
                className="text-gray-400 hover:text-white"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Backup details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-500 text-sm">{t('backups.type')}</p>
                <p className="text-white font-medium">{selectedBackup.backup_type}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-500 text-sm">{t('backups.status')}</p>
                <div className="flex items-center">
                  {getStatusIcon(selectedBackup.current_status || 'unknown', 'w-4 h-4')}
                  <span className="ml-2 text-white font-medium">{selectedBackup.current_status || 'unknown'}</span>
                </div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-500 text-sm">{t('backups.lastRun')}</p>
                <p className="text-white font-medium">{formatDate(selectedBackup.last_event_at)}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-500 text-sm">{t('backups.size')}</p>
                <p className="text-white font-medium">{formatSize(selectedBackup.last_size_bytes)}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-500 text-sm">Dernier succes</p>
                <p className="text-green-400 font-medium">{formatDate(selectedBackup.last_success_at)}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-500 text-sm">Dernier echec</p>
                <p className="text-red-400 font-medium">{formatDate(selectedBackup.last_failure_at)}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-500 text-sm">Total succes</p>
                <p className="text-green-400 font-medium">{selectedBackup.total_success_count}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-gray-500 text-sm">Total echecs</p>
                <p className="text-red-400 font-medium">{selectedBackup.total_failure_count}</p>
              </div>
            </div>

            {/* Derniere erreur */}
            {selectedBackup.last_error_message && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <XCircleIcon className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-red-400 font-medium mb-1">Derniere erreur</p>
                    <p className="text-red-300 text-sm">{selectedBackup.last_error_message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Source/Destination info */}
            {(selectedBackup.source_nas || selectedBackup.destination) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {selectedBackup.source_nas && (
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <p className="text-gray-500 text-sm">Source NAS</p>
                    <p className="text-white">{selectedBackup.source_nas}</p>
                    {selectedBackup.source_device && (
                      <p className="text-gray-400 text-sm">{selectedBackup.source_device}</p>
                    )}
                  </div>
                )}
                {selectedBackup.destination && (
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <p className="text-gray-500 text-sm">Destination</p>
                    <p className="text-white">{selectedBackup.destination}</p>
                    {selectedBackup.destination_nas && (
                      <p className="text-gray-400 text-sm">{selectedBackup.destination_nas}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {selectedBackup.notes && (
              <div className="bg-gray-700/50 rounded-lg p-3 mb-6">
                <p className="text-gray-500 text-sm mb-1">Notes</p>
                <p className="text-white">{selectedBackup.notes}</p>
              </div>
            )}

            {/* Events history */}
            <h3 className="text-lg font-semibold text-white mb-4">{t('backups.history')}</h3>
            {loadingEvents ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : events.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t('backups.noHistory')}</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(event.event_type)}
                      <div>
                        <p className="text-white text-sm">{formatDate(event.event_date)}</p>
                        {event.error_message && (
                          <p className="text-red-400 text-xs">{event.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-gray-400 text-sm">
                      {event.duration_seconds && (
                        <p>{formatDuration(event.duration_seconds)}</p>
                      )}
                      {event.transferred_size_bytes && <p>{formatSize(event.transferred_size_bytes)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
