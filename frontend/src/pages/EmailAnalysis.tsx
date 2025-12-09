import { useState, useEffect } from 'react';
import {
  SparklesIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  ServerIcon,
  ChartBarIcon,
  EnvelopeIcon,
  EyeIcon,
  XMarkIcon,
  FunnelIcon,
  UserGroupIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';
import { emailsApi } from '../api';

interface AnalysisResult {
  message_id: string;
  subject: string;
  sender: string;
  received_at: string | null;
  is_backup_notification: boolean;
  backup_type: string | null;
  status: string | null;
  source_nas: string | null;
  task_name: string | null;
  confidence: number;
}

interface AnalysisResponse {
  success: boolean;
  message: string;
  total_fetched: number;
  total_analyzed: number;
  backup_notifications_found: number;
  clients_created: number;
  backups_created: number;
  events_created: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  emails: AnalysisResult[];
  errors: string[];
}

interface BackupSummary {
  period_days: number;
  total_backup_notifications: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_nas: Record<string, number>;
  recent_failures: Array<{
    id: number;
    subject: string;
    nas: string | null;
    type: string | null;
    date: string | null;
  }>;
  success_rate: number;
  clients_count: number;
  backups_count: number;
}

interface AnalyzedEmail {
  id: number;
  message_id: string;
  subject: string;
  sender: string;
  received_at: string | null;
  is_backup_notification: boolean;
  detected_type: string | null;
  detected_status: string | null;
  detected_nas: string | null;
  ai_confidence: number;
  body_preview: string | null;
}

interface EmailDetail {
  id: number;
  subject: string;
  sender: string;
  received_at: string | null;
  body_text: string | null;
  body_html: string | null;
  is_backup_notification: boolean;
  detected_type: string | null;
  detected_status: string | null;
  detected_nas: string | null;
  ai_confidence: number;
  ai_extracted_data: any;
}

export default function EmailAnalysis() {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [emailCount, setEmailCount] = useState(500);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [progress, setProgress] = useState({ status: 'idle', progress: 0, current_step: '' });
  const [error, setError] = useState<string | null>(null);
  
  // Liste des emails
  const [emails, setEmails] = useState<AnalyzedEmail[]>([]);
  const [totalEmails, setTotalEmails] = useState(0);
  const [emailsOffset, setEmailsOffset] = useState(0);
  const [backupOnly, setBackupOnly] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);
  
  // Modal detail email
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadSummary();
    loadEmails();
  }, []);

  useEffect(() => {
    loadEmails();
  }, [backupOnly]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (analyzing) {
      interval = setInterval(async () => {
        try {
          const prog = await emailsApi.getAnalysisProgress();
          setProgress(prog);
          if (prog.status === 'complete' || prog.status === 'error') {
            setAnalyzing(false);
          }
        } catch (e) {
          console.error('Error fetching progress:', e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [analyzing]);

  const loadSummary = async () => {
    try {
      const data = await emailsApi.getBackupSummary(30);
      setSummary(data);
    } catch (e: any) {
      console.error('Error loading summary:', e);
    }
  };

  const loadEmails = async (offset: number = 0) => {
    setLoadingEmails(true);
    try {
      const data = await emailsApi.getAnalyzedEmails(backupOnly, 50, offset);
      setEmails(data.emails || []);
      setTotalEmails(data.total || 0);
      setEmailsOffset(offset);
    } catch (e: any) {
      console.error('Error loading emails:', e);
    } finally {
      setLoadingEmails(false);
    }
  };

  const loadEmailDetail = async (emailId: number) => {
    setLoadingDetail(true);
    try {
      const data = await emailsApi.getAnalyzedEmailDetail(emailId);
      setSelectedEmail(data);
    } catch (e: any) {
      console.error('Error loading email detail:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const startAnalysis = async () => {
    setLoading(true);
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setProgress({ status: 'fetching', progress: 0, current_step: 'Demarrage...' });

    try {
      const response = await emailsApi.fetchAndAnalyze(emailCount, true);
      setResult(response);
      if (!response.success) {
        setError(response.message);
      }
      await loadSummary();
      await loadEmails();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failure':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <EnvelopeIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadgeClass = (status: string | null) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'failure':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SparklesIcon className="h-8 w-8 text-purple-500" />
            Analyse des Emails par IA
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Recuperez et analysez vos emails de sauvegarde avec l'intelligence artificielle
          </p>
        </div>
      </div>

      {/* Panneau de controle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Lancer une analyse
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre d'emails a analyser
            </label>
            <select
              value={emailCount}
              onChange={(e) => setEmailCount(Number(e.target.value))}
              disabled={analyzing}
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-purple-500 focus:ring-purple-500"
            >
              <option value={50}>50 emails</option>
              <option value={100}>100 emails</option>
              <option value={250}>250 emails</option>
              <option value={500}>500 emails</option>
              <option value={1000}>1000 emails</option>
            </select>
          </div>

          <button
            onClick={startAnalysis}
            disabled={loading || analyzing}
            className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium rounded-lg transition-colors"
          >
            {analyzing ? (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                <SparklesIcon className="h-5 w-5 mr-2" />
                Lancer l'analyse IA
              </>
            )}
          </button>
        </div>

        {/* Barre de progression */}
        {analyzing && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span>{progress.current_step}</span>
              <span>{progress.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
          </div>
        )}

        {/* Resultats de l'analyse */}
        {result && result.success && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-300">{result.message}</p>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <EnvelopeIcon className="h-4 w-4 text-green-600" />
                    <span className="text-green-700 dark:text-green-400">{result.total_analyzed} emails</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserGroupIcon className="h-4 w-4 text-blue-600" />
                    <span className="text-blue-700 dark:text-blue-400">{result.clients_created} clients crees</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CircleStackIcon className="h-4 w-4 text-purple-600" />
                    <span className="text-purple-700 dark:text-purple-400">{result.backups_created} sauvegardes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="h-4 w-4 text-orange-600" />
                    <span className="text-orange-700 dark:text-orange-400">{result.events_created} evenements</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resume des sauvegardes */}
      {summary && summary.total_backup_notifications > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-blue-500" />
            Resume ({summary.period_days} derniers jours)
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.total_backup_notifications}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Notifications</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{summary.success_rate}%</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Taux de succes</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{summary.by_status.success || 0}</div>
              <div className="text-xs text-green-700 dark:text-green-400">Succes</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{summary.by_status.failure || 0}</div>
              <div className="text-xs text-red-700 dark:text-red-400">Echecs</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{summary.clients_count}</div>
              <div className="text-xs text-purple-700 dark:text-purple-400">Clients</div>
            </div>
          </div>

          {/* Par NAS */}
          {Object.keys(summary.by_nas).length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Par NAS</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.by_nas).map(([nas, count]) => (
                  <span key={nas} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                    <ServerIcon className="h-4 w-4 mr-1" />
                    {nas}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Par type */}
          {Object.keys(summary.by_type).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Par type</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.by_type).map(([type, count]) => (
                  <span key={type} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Liste des emails */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <EnvelopeIcon className="h-5 w-5 text-gray-500" />
            Emails analyses ({totalEmails})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBackupOnly(!backupOnly)}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                backupOnly
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              <FunnelIcon className="h-4 w-4 mr-1" />
              {backupOnly ? 'Sauvegardes uniquement' : 'Tous les emails'}
            </button>
            <button
              onClick={() => loadEmails(emailsOffset)}
              disabled={loadingEmails}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loadingEmails ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loadingEmails ? (
          <div className="p-8 text-center">
            <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin mx-auto" />
            <p className="mt-2 text-gray-500">Chargement...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="p-8 text-center">
            <EnvelopeIcon className="h-12 w-12 text-gray-400 mx-auto" />
            <p className="mt-2 text-gray-500">Aucun email analyse. Lancez une analyse pour commencer.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Sujet</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Expediteur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">NAS</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {emails.map((email) => (
                    <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        {email.is_backup_notification ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                            {email.detected_type || 'backup'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            autre
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(email.received_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                        {email.subject}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                        {email.sender}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {email.detected_nas ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                            {email.detected_nas}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {email.is_backup_notification && (
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${getStatusBadgeClass(email.detected_status)}`}>
                            {getStatusIcon(email.detected_status)}
                            <span className="ml-1">{email.detected_status || 'inconnu'}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => loadEmailDetail(email.id)}
                          className="p-1.5 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Voir le detail"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Affichage {emailsOffset + 1} - {Math.min(emailsOffset + 50, totalEmails)} sur {totalEmails}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadEmails(Math.max(0, emailsOffset - 50))}
                  disabled={emailsOffset === 0}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50"
                >
                  Precedent
                </button>
                <button
                  onClick={() => loadEmails(emailsOffset + 50)}
                  disabled={emailsOffset + 50 >= totalEmails}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal detail email */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedEmail(null)} />
            
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Detail de l'email</h3>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="p-8 text-center">
                  <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin mx-auto" />
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
                  {/* Metadata */}
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">De:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{selectedEmail.sender}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Date:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{formatDate(selectedEmail.received_at)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500 dark:text-gray-400">Sujet:</span>
                      <span className="ml-2 text-gray-900 dark:text-white font-medium">{selectedEmail.subject}</span>
                    </div>
                    {selectedEmail.is_backup_notification && (
                      <>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Type:</span>
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs ${getStatusBadgeClass(selectedEmail.detected_status)}`}>
                            {selectedEmail.detected_type || 'backup'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">NAS:</span>
                          <span className="ml-2 text-blue-600 dark:text-blue-400">{selectedEmail.detected_nas || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Statut:</span>
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs ${getStatusBadgeClass(selectedEmail.detected_status)}`}>
                            {getStatusIcon(selectedEmail.detected_status)}
                            <span className="ml-1">{selectedEmail.detected_status || 'inconnu'}</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Confiance IA:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{selectedEmail.ai_confidence}%</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="px-6 py-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contenu</h4>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                        {selectedEmail.body_text || '(Pas de contenu texte)'}
                      </pre>
                    </div>
                  </div>

                  {/* Donnees extraites par l'IA */}
                  {selectedEmail.ai_extracted_data && (
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Donnees extraites par l'IA</h4>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-xs text-gray-600 dark:text-gray-400">
                          {JSON.stringify(selectedEmail.ai_extracted_data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
