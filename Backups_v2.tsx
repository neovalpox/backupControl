import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ServerStackIcon,
  CloudIcon,
  CircleStackIcon,
  ComputerDesktopIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { backupsApi, clientsApi } from '../api';

export default function Backups() {
  const { t } = useTranslation();
  const [backups, setBackups] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [backupsData, clientsData] = await Promise.all([
        backupsApi.getAll(),
        clientsApi.getAll(),
      ]);
      setBackups(backupsData);
      setClients(clientsData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
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

  const formatSize = (bytes: number) => {
    if (!bytes) return '-';
    const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
    let unitIndex = 0;
    let size = bytes;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ok':
      case 'success':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
            <CheckCircleIcon className="w-4 h-4 mr-1" />
            OK
          </span>
        );
      case 'failed':
      case 'error':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
            <XCircleIcon className="w-4 h-4 mr-1" />
            Echec
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
            <ClockIcon className="w-4 h-4 mr-1" />
            Inconnu
          </span>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'nas':
      case 'synology':
        return <ServerStackIcon className="w-5 h-5 text-blue-400" />;
      case 'cloud':
      case 'azure':
      case 'aws':
        return <CloudIcon className="w-5 h-5 text-sky-400" />;
      case 'database':
      case 'sql':
        return <CircleStackIcon className="w-5 h-5 text-purple-400" />;
      case 'hyperbackup':
        return <ArrowPathIcon className="w-5 h-5 text-green-400" />;
      default:
        return <ComputerDesktopIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getClientName = (clientId: number) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || 'Inconnu';
  };

  const filteredBackups = backups.filter((backup) => {
    const matchesSearch = backup.name?.toLowerCase().includes(search.toLowerCase()) ||
      getClientName(backup.client_id).toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || backup.current_status?.toLowerCase() === filterStatus;
    const matchesClient = filterClient === 'all' || backup.client_id === Number(filterClient);
    const matchesType = filterType === 'all' || backup.backup_type?.toLowerCase() === filterType;
    return matchesSearch && matchesStatus && matchesClient && matchesType;
  });

  const exportCSV = () => {
    const headers = ['Client', 'Nom', 'Type', 'Statut', 'Taille', 'Dernier evenement'];
    const rows = filteredBackups.map((b) => [
      getClientName(b.client_id),
      b.name,
      b.backup_type || '',
      b.current_status || 'Inconnu',
      formatSize(b.last_size_bytes),
      formatDate(b.last_event_at),
    ]);
    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sauvegardes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const backupTypes = [...new Set(backups.map((b) => b.backup_type).filter(Boolean))];
  const totalSize = filteredBackups.reduce((sum, b) => sum + (b.last_size_bytes || 0), 0);
  const okCount = filteredBackups.filter((b) => b.current_status === 'ok' || b.current_status === 'success').length;
  const failedCount = filteredBackups.filter((b) => b.current_status === 'failed' || b.current_status === 'error').length;

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
          <h1 className="text-2xl font-bold text-white">{t('backups.title')}</h1>
          <p className="text-gray-400 mt-1">{t('backups.subtitle')}</p>
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
        >
          <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total affiche</p>
          <p className="text-2xl font-bold text-white">{filteredBackups.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">OK</p>
          <p className="text-2xl font-bold text-green-500">{okCount}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">En echec</p>
          <p className="text-2xl font-bold text-red-500">{failedCount}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Taille totale</p>
          <p className="text-2xl font-bold text-primary-500">{formatSize(totalSize)}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou client..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <FunnelIcon className="w-5 h-5 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Tous statuts</option>
            <option value="ok">OK</option>
            <option value="success">Success</option>
            <option value="failed">Echec</option>
            <option value="error">Erreur</option>
          </select>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Tous clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Tous types</option>
            {backupTypes.map((type) => (
              <option key={type} value={type.toLowerCase()}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Taille</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Dernier evenement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredBackups.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Aucune sauvegarde trouvee</td></tr>
              ) : (
                filteredBackups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-primary-400 font-medium">{getClientName(backup.client_id)}</span>
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{backup.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(backup.backup_type)}
                        <span className="text-gray-300">{backup.backup_type || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(backup.current_status)}</td>
                    <td className="px-6 py-4 text-gray-300 font-mono">{formatSize(backup.last_size_bytes)}</td>
                    <td className="px-6 py-4 text-gray-300">{formatDate(backup.last_event_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}