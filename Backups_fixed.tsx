import { useEffect, useState } from 'react';
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
} from '@heroicons/react/24/outline';
import { backupsApi } from '../api';
import type { Backup, BackupEvent } from '../api';

export default function Backups() {
  const { t } = useTranslation();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [events, setEvents] = useState<BackupEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    fetchBackups();
  }, [statusFilter]);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const data = await backupsApi.getAll(params);
      setBackups(data);
    } catch (error) {
      console.error('Error fetching backups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async (backupId: number) => {
    setLoadingEvents(true);
    try {
      const data = await backupsApi.getEvents(backupId);
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
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

  const getStatusIcon = (status: string, size = 'w-5 h-5') => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className={`${size} text-green-500`} />;
      case 'failed':
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
        return 'bg-green-500/10 border-green-500/20';
      case 'failed':
        return 'bg-red-500/10 border-red-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const formatSize = (bytes: number | null) => {
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

  const filteredBackups = backups.filter((backup) =>
    backup.name.toLowerCase().includes(search.toLowerCase()) ||
    backup.client_name?.toLowerCase().includes(search.toLowerCase())
  );

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
        <h1 className="text-2xl font-bold text-white">{t('backups.title')}</h1>
        <p className="text-gray-400 mt-1">{t('backups.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
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
            className="pl-10 pr-8 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
          >
            <option value="all">{t('backups.allStatuses')}</option>
            <option value="success">{t('status.success')}</option>
            <option value="failed">{t('status.failed')}</option>
            <option value="warning">{t('status.warning')}</option>
            <option value="unknown">{t('status.unknown')}</option>
          </select>
        </div>
        <button
          onClick={fetchBackups}
          className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <ArrowPathIcon className="w-5 h-5 mr-2" />
          {t('common.refresh')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">{t('backups.total')}</p>
          <p className="text-2xl font-bold text-white">{backups.length}</p>
        </div>
        <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
          <p className="text-green-400 text-sm">{t('status.success')}</p>
          <p className="text-2xl font-bold text-green-500">
            {backups.filter(b => b.current_status === 'ok').length}
          </p>
        </div>
        <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
          <p className="text-red-400 text-sm">{t('status.failed')}</p>
          <p className="text-2xl font-bold text-red-500">
            {backups.filter(b => b.current_status === 'failed').length}
          </p>
        </div>
        <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
          <p className="text-yellow-400 text-sm">{t('status.warning')}</p>
          <p className="text-2xl font-bold text-yellow-500">
            {backups.filter(b => b.current_status === 'warning').length}
          </p>
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
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {t('backups.noBackups')}
                  </td>
                </tr>
              ) : (
                filteredBackups.map((backup) => (
                  <tr
                    key={backup.id}
                    className={`hover:bg-gray-700/50 cursor-pointer ${
                      backup.is_maintenance ? 'opacity-50' : ''
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
                    <td className="px-6 py-4 text-gray-400">{backup.backup_type}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        backup.current_status === 'ok'
                          ? 'bg-green-500/10 text-green-500'
                          : backup.current_status === 'failed'
                          ? 'bg-red-500/10 text-red-500'
                          : backup.current_status === 'warning'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {t(`status.${backup.current_status || 'unknown'}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {formatDate(backup.last_event_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {formatSize(backup.last_size_bytes)}
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
          <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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
              <div>
                <p className="text-gray-500 text-sm">{t('backups.type')}</p>
                <p className="text-white">{selectedBackup.backup_type}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">{t('backups.status')}</p>
                <div className="flex items-center">
                  {getStatusIcon(selectedBackup.current_status || 'unknown', 'w-4 h-4')}
                  <span className="ml-2 text-white">{t(`status.${selectedBackup.current_status || 'unknown'}`)}</span>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-sm">{t('backups.lastRun')}</p>
                <p className="text-white">{formatDate(selectedBackup.last_event_at)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">{t('backups.size')}</p>
                <p className="text-white">{formatSize(selectedBackup.last_size_bytes)}</p>
              </div>
            </div>

            {/* Events history */}
            <h3 className="text-lg font-semibold text-white mb-4">{t('backups.history')}</h3>
            {loadingEvents ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : events.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t('backups.noHistory')}</p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(event.status)}
                      <div>
                        <p className="text-white text-sm">{formatDate(event.event_date)}</p>
                        {event.message && (
                          <p className="text-gray-400 text-xs">{event.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-gray-400 text-sm">
                      {event.duration_seconds && (
                        <p>{Math.floor(event.duration_seconds / 60)}m {event.duration_seconds % 60}s</p>
                      )}
                      {event.size_bytes && <p>{formatSize(event.size_bytes)}</p>}
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
