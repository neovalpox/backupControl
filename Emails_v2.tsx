import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EnvelopeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  InboxArrowDownIcon,
  FunnelIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { emailsApi } from '../api';

export default function Emails() {
  const { t } = useTranslation();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [filterBackupOnly, setFilterBackupOnly] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [syncCount, setSyncCount] = useState(50);

  useEffect(() => {
    fetchData();
  }, [filterBackupOnly]);

  const fetchData = async () => {
    try {
      const [emailsData, syncData] = await Promise.all([
        emailsApi.getAnalyzedEmails(filterBackupOnly, 100, 0),
        emailsApi.getLastSync().catch(() => ({ last_sync: null })),
      ]);
      setEmails(emailsData);
      setLastSync(syncData.last_sync);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await emailsApi.fetchAndAnalyze(syncCount, true);
      await fetchData();
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de la synchronisation');
    } finally {
      setSyncing(false);
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

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Jamais synchronise';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    if (diffMins < 1) return 'A l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (email: any) => {
    if (email.is_backup_report) {
      if (email.backup_status === 'ok' || email.backup_status === 'success') {
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
            <CheckCircleIcon className="w-4 h-4 mr-1" />
            OK
          </span>
        );
      } else if (email.backup_status === 'failed' || email.backup_status === 'error') {
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
            <XCircleIcon className="w-4 h-4 mr-1" />
            Echec
          </span>
        );
      }
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
        Non-backup
      </span>
    );
  };

  const backupEmails = emails.filter((e) => e.is_backup_report);
  const okCount = backupEmails.filter((e) => e.backup_status === 'ok' || e.backup_status === 'success').length;
  const failedCount = backupEmails.filter((e) => e.backup_status === 'failed' || e.backup_status === 'error').length;

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
          <h1 className="text-2xl font-bold text-white">{t('emails.title')}</h1>
          <p className="text-gray-400 mt-1">{t('emails.subtitle')}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm">
            <ClockIcon className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">{formatLastSync(lastSync)}</span>
          </div>
          <select
            value={syncCount}
            onChange={(e) => setSyncCount(Number(e.target.value))}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
          >
            <option value={20}>20 emails</option>
            <option value={50}>50 emails</option>
            <option value={100}>100 emails</option>
          </select>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            <ArrowPathIcon className={`w-5 h-5 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronisation...' : 'Synchroniser'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total emails</p>
          <p className="text-2xl font-bold text-white">{emails.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Rapports backup</p>
          <p className="text-2xl font-bold text-primary-500">{backupEmails.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">OK</p>
          <p className="text-2xl font-bold text-green-500">{okCount}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Echec</p>
          <p className="text-2xl font-bold text-red-500">{failedCount}</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <FunnelIcon className="w-5 h-5 text-gray-400" />
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={filterBackupOnly}
            onChange={(e) => setFilterBackupOnly(e.target.checked)}
            className="sr-only"
          />
          <span className={`w-10 h-5 rounded-full transition-colors ${filterBackupOnly ? 'bg-primary-600' : 'bg-gray-600'} relative`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${filterBackupOnly ? 'translate-x-5' : ''}`} />
          </span>
          <span className="ml-2 text-sm text-gray-300">Rapports de backup uniquement</span>
        </label>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Expediteur</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Sujet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {emails.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Aucun email analyse</td></tr>
            ) : (
              emails.map((email) => (
                <tr key={email.id} className="hover:bg-gray-700/50">
                  <td className="px-6 py-4 text-gray-300 text-sm">{formatDate(email.received_at || email.analyzed_at)}</td>
                  <td className="px-6 py-4 text-gray-300 truncate max-w-[150px]">{email.sender || '-'}</td>
                  <td className="px-6 py-4 text-white truncate max-w-[250px]">{email.subject || '-'}</td>
                  <td className="px-6 py-4 text-primary-400">{email.detected_client || '-'}</td>
                  <td className="px-6 py-4">{getStatusBadge(email)}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedEmail(email)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedEmail(null)} />
          <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Details de l'email</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Sujet</label>
                <p className="text-white">{selectedEmail.subject}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Expediteur</label>
                <p className="text-white">{selectedEmail.sender}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Client detecte</label>
                <p className="text-primary-400">{selectedEmail.detected_client || 'Non identifie'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Statut backup</label>
                <p className="text-white">{selectedEmail.backup_status || 'N/A'}</p>
              </div>
              {selectedEmail.analysis_result && (
                <div>
                  <label className="text-sm text-gray-400">Analyse IA</label>
                  <pre className="text-gray-300 text-sm bg-gray-900 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {typeof selectedEmail.analysis_result === 'string' 
                      ? selectedEmail.analysis_result 
                      : JSON.stringify(selectedEmail.analysis_result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-6">
              <button
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}