import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ServerStackIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { clientsApi, backupsApi } from '../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const [clientData, backupsData] = await Promise.all([
        clientsApi.getById(Number(id)),
        backupsApi.getByClient(Number(id)),
      ]);
      setClient(clientData);
      setBackups(backupsData);
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

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ok':
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getLast30DaysData = () => {
    const last30Days: { [key: string]: { ok: number; failed: number } } = {};
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      last30Days[key] = { ok: 0, failed: 0 };
    }
    backups.forEach((backup) => {
      if (backup.last_event_at) {
        const key = backup.last_event_at.split('T')[0];
        if (last30Days[key]) {
          if (backup.current_status === 'ok' || backup.current_status === 'success') {
            last30Days[key].ok++;
          } else {
            last30Days[key].failed++;
          }
        }
      }
    });
    return last30Days;
  };

  const chartData = () => {
    const data = getLast30DaysData();
    const labels = Object.keys(data).map((d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    return {
      labels,
      datasets: [
        {
          label: 'OK',
          data: Object.values(data).map((d) => d.ok),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Echec',
          data: Object.values(data).map((d) => d.failed),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.3,
        },
      ],
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!client) {
    return <div className="text-center text-gray-400 py-8">Client non trouve</div>;
  }

  const backupsOk = backups.filter((b) => b.current_status === 'ok' || b.current_status === 'success').length;
  const backupsFailed = backups.filter((b) => b.current_status === 'failed' || b.current_status === 'error').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/clients" className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
          <ArrowLeftIcon className="w-6 h-6 text-gray-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{client.name}</h1>
          {client.short_name && <p className="text-primary-400 font-mono">{client.short_name}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Informations</h2>
          <div className="space-y-3">
            {client.contact_email && (
              <div className="flex items-center text-gray-300">
                <EnvelopeIcon className="w-5 h-5 mr-3 text-gray-500" />
                <a href={`mailto:${client.contact_email}`} className="hover:text-primary-400">{client.contact_email}</a>
              </div>
            )}
            {client.contact_phone && (
              <div className="flex items-center text-gray-300">
                <PhoneIcon className="w-5 h-5 mr-3 text-gray-500" />
                <a href={`tel:${client.contact_phone}`} className="hover:text-primary-400">{client.contact_phone}</a>
              </div>
            )}
            <div className="flex items-center text-gray-300">
              <CalendarIcon className="w-5 h-5 mr-3 text-gray-500" />
              <span>Cree le {formatDate(client.created_at)}</span>
            </div>
            {client.sla_hours && (
              <div className="flex items-center text-gray-300">
                <ClockIcon className="w-5 h-5 mr-3 text-gray-500" />
                <span>SLA: {client.sla_hours}h</span>
              </div>
            )}
          </div>
          {client.nas_identifiers?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Identifiants NAS</h3>
              <div className="flex flex-wrap gap-2">
                {client.nas_identifiers.map((nas: string, idx: number) => (
                  <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-700 text-gray-300">
                    <ServerStackIcon className="w-4 h-4 mr-1" />
                    {nas}
                  </span>
                ))}
              </div>
            </div>
          )}
          {client.notes && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Notes</h3>
              <p className="text-gray-300 text-sm">{client.notes}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
              <ChartBarIcon className="w-8 h-8 mx-auto text-primary-500 mb-2" />
              <p className="text-3xl font-bold text-white">{backups.length}</p>
              <p className="text-gray-400 text-sm">Total backups</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
              <CheckCircleIcon className="w-8 h-8 mx-auto text-green-500 mb-2" />
              <p className="text-3xl font-bold text-green-500">{backupsOk}</p>
              <p className="text-gray-400 text-sm">OK</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
              <XCircleIcon className="w-8 h-8 mx-auto text-red-500 mb-2" />
              <p className="text-3xl font-bold text-red-500">{backupsFailed}</p>
              <p className="text-gray-400 text-sm">En echec</p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Historique 30 jours</h2>
            <Line
              data={chartData()}
              options={{
                responsive: true,
                plugins: { legend: { position: 'top', labels: { color: '#9ca3af' } } },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(75, 85, 99, 0.3)' }, ticks: { color: '#9ca3af' } },
                  x: { grid: { display: false }, ticks: { color: '#9ca3af', maxRotation: 45 } },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Sauvegardes ({backups.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Taille</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Dernier evenement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {backups.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Aucune sauvegarde</td></tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-white font-medium">{backup.name}</td>
                    <td className="px-6 py-4 text-gray-300">{backup.backup_type || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(backup.current_status)}
                        <span className="text-gray-300 capitalize">{backup.current_status || 'Inconnu'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{formatSize(backup.last_size_bytes)}</td>
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