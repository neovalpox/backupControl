import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChartBarIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { emailsApi } from '../api';

export default function EmailAnalysis() {
  const { t } = useTranslation();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [analysisCount, setAnalysisCount] = useState(50);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      const data = await emailsApi.getAnalyzedEmails(false, 100, 0);
      setEmails(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await emailsApi.fetchAndAnalyze(analysisCount, true);
      await fetchEmails();
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de l analyse');
    } finally {
      setAnalyzing(false);
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

  const getStatusBadge = (email: any) => {
    if (!email.is_backup_report) {
      return (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">Non-backup</span>);
    }
    if (email.backup_status === 'ok' || email.backup_status === 'success') {
      return (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500"><CheckCircleIcon className="w-4 h-4 mr-1" />OK</span>);
    }
    return (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500"><XCircleIcon className="w-4 h-4 mr-1" />Echec</span>);
  };

  const filteredEmails = emails.filter((email) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(searchLower) ||
      email.sender?.toLowerCase().includes(searchLower) ||
      email.detected_client?.toLowerCase().includes(searchLower)
    );
  });

  const backupEmails = emails.filter((e) => e.is_backup_report);
  const okCount = backupEmails.filter((e) => e.backup_status === 'ok' || e.backup_status === 'success').length;
  const failedCount = backupEmails.filter((e) => e.backup_status === 'failed' || e.backup_status === 'error').length;

  if (loading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analyse des Emails</h1>
          <p className="text-gray-400 mt-1">Analysez les emails de backup avec l IA</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={analysisCount}
            onChange={(e) => setAnalysisCount(Number(e.target.value))}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
          >
            <option value={20}>20 emails</option>
            <option value={50}>50 emails</option>
            <option value={100}>100 emails</option>
          </select>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            <ArrowPathIcon className={`w-5 h-5 mr-2 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analyse en cours...' : 'Analyser'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <EnvelopeIcon className="w-8 h-8 text-primary-500" />
            <div>
              <p className="text-gray-400 text-sm">Total analyses</p>
              <p className="text-2xl font-bold text-white">{emails.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <ChartBarIcon className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-gray-400 text-sm">Rapports backup</p>
              <p className="text-2xl font-bold text-blue-500">{backupEmails.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-gray-400 text-sm">OK</p>
              <p className="text-2xl font-bold text-green-500">{okCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <XCircleIcon className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-gray-400 text-sm">Echec</p>
              <p className="text-2xl font-bold text-red-500">{failedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par sujet, expediteur ou client..."
          className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Sujet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredEmails.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Aucun email analyse</td></tr>
            ) : (
              filteredEmails.map((email) => (
                <tr key={email.id} className="hover:bg-gray-700/50 cursor-pointer" onClick={() => setSelectedEmail(email)}>
                  <td className="px-6 py-4 text-gray-300 text-sm">{formatDate(email.analyzed_at)}</td>
                  <td className="px-6 py-4 text-white truncate max-w-[300px]">{email.subject || '-'}</td>
                  <td className="px-6 py-4 text-primary-400">{email.detected_client || '-'}</td>
                  <td className="px-6 py-4">{getStatusBadge(email)}</td>
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
            <h2 className="text-xl font-bold text-white mb-4">Details de l analyse</h2>
            <div className="space-y-4">
              <div><label className="text-sm text-gray-400">Sujet</label><p className="text-white">{selectedEmail.subject}</p></div>
              <div><label className="text-sm text-gray-400">Expediteur</label><p className="text-white">{selectedEmail.sender}</p></div>
              <div><label className="text-sm text-gray-400">Client detecte</label><p className="text-primary-400">{selectedEmail.detected_client || 'Non identifie'}</p></div>
              <div><label className="text-sm text-gray-400">Type</label><p className="text-white">{selectedEmail.is_backup_report ? 'Rapport de backup' : 'Autre'}</p></div>
              <div><label className="text-sm text-gray-400">Statut</label><p className="text-white">{selectedEmail.backup_status || 'N/A'}</p></div>
              {selectedEmail.analysis_result && (
                <div>
                  <label className="text-sm text-gray-400">Analyse IA</label>
                  <pre className="text-gray-300 text-sm bg-gray-900 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap mt-2">
                    {typeof selectedEmail.analysis_result === 'string' ? selectedEmail.analysis_result : JSON.stringify(selectedEmail.analysis_result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-6"><button onClick={() => setSelectedEmail(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}