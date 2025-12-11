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
    setProgress({ status: 'fetching', progress: 0, current_step: 'Démarrage...' });

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
        return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
      case 'failure':
        return <XCircleIcon className="h-5 w-5 text-red-400" />;
      case 'warning':
        return <ExclamationCircleIcon className="h-5 w-5 text-yellow-400" />;
      default:
        return <EnvelopeIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadgeClass = (status: string | null) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'failure':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
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
      <div className="flex items-center gap-3">
        <SparklesIcon className="h-8 w-8 text-primary-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Analyse IA</h1>
          <p className="text-gray-400">
            Récupérez et analysez vos emails de sauvegarde avec l'intelligence artificielle
          </p>
        </div>
      </div>

      {/* Panneau de contrôle */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Lancer une analyse
        </h2>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nombre d'emails à analyser
            </label>
            <select
              value={emailCount}
              onChange={(e) => setEmailCount(Number(e.target.value))}
              disabled={analyzing}
              className="block w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            className="inline-flex items-center px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white font-medium rounded-lg transition-colors"
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
          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>{progress.current_step}</span>
              <span>{progress.progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center">
              <XCircleIcon className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-400">{error}</span>
            </div>
          </div>
        )}

        {/* Résultats de l'analyse */}
        {result && result.success && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="h-6 w-6 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-400">{result.message}</p>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <EnvelopeIcon className="h-4 w-4 text-green-400" />
                    <span className="text-gray-300">{result.total_analyzed} emails</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserGroupIcon className="h-4 w-4 text-blue-400" />
                    <span className="text-gray-300">{result.clients_created} clients créés</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CircleStackIcon className="h-4 w-4 text-purple-400" />
                    <span className="text-gray-300">{result.backups_created} sauvegardes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="h-4 w-4 text-orange-400" />
                    <span className="text-gray-300">{result.events_created} événements</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Résumé des sauvegardes */}
      {summary && summary.total_backup_notifications > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-primary-500" />
            Résumé ({summary.period_days} derniers jours)
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <div className="text-2xl font-bold text-white">
                {summary.total_backup_notifications}
              </div>
              <div className="text-xs text-gray-400">Notifications</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <div className="text-2xl font-bold text-green-400">{summary.success_rate}%</div>
              <div className="text-xs text-gray-400">Taux de succès</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/30">
              <div className="text-2xl font-bold text-green-400">{summary.by_status.success || 0}</div>
              <div className="text-xs text-green-400/70">Succès</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
              <div className="text-2xl font-bold text-red-400">{summary.by_status.failure || 0}</div>
              <div className="text-xs text-red-400/70">Échecs</div>
            </div>
          </div>

          {/* Par NAS */}
          {Object.keys(summary.by_nas).length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Par NAS</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.by_nas).map(([nas, count]) => (
                  <span key={nas} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-500/20 text-primary-300 border border-primary-500/30">
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
              <h3 className="text-sm font-medium text-gray-300 mb-2">Par type</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.by_type).map(([type, count]) => (
                  <span key={type} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Liste des emails */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <EnvelopeIcon className="h-5 w-5 text-gray-400" />
            Emails analysés ({totalEmails})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBackupOnly(!backupOnly)}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                backupOnly
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'bg-gray-700 text-gray-300 border border-gray-600'
              }`}
            >
              <FunnelIcon className="h-4 w-4 mr-1" />
              {backupOnly ? 'Sauvegardes uniquement' : 'Tous les emails'}
            </button>
            <button
              onClick={() => loadEmails(emailsOffset)}
              disabled={loadingEmails}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loadingEmails ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loadingEmails ? (
          <div className="p-8 text-center">
            <ArrowPathIcon className="h-8 w-8 text-gray-500 animate-spin mx-auto" />
            <p className="mt-2 text-gray-400">Chargement...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="p-8 text-center">
            <EnvelopeIcon className="h-12 w-12 text-gray-600 mx-auto" />
            <p className="mt-2 text-gray-400">Aucun email analysé. Lancez une analyse pour commencer.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Sujet</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Expéditeur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">NAS</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {emails.map((email) => (
                    <tr key={email.id} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3">
                        {email.is_backup_notification ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-primary-500/20 text-primary-300 border border-primary-500/30">
                            {email.detected_type || 'backup'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-600 text-gray-300">
                            autre
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                        {formatDate(email.received_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-white max-w-xs truncate">
                        <a href="#" onClick={(e) => { e.preventDefault(); loadEmailDetail(email.id); }} className="hover:text-primary-400 transition-colors">
                          {email.subject}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 truncate max-w-[150px]">
                        {email.sender}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {email.detected_nas ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
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
                          className="p-1.5 text-gray-400 hover:text-primary-400 rounded hover:bg-gray-700 transition-colors"
                          title="Voir le détail"
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
            <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Affichage {emailsOffset + 1} - {Math.min(emailsOffset + 50, totalEmails)} sur {totalEmails}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadEmails(Math.max(0, emailsOffset - 50))}
                  disabled={emailsOffset === 0}
                  className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-600 transition-colors"
                >
                  Précédent
                </button>
                <button
                  onClick={() => loadEmails(emailsOffset + 50)}
                  disabled={emailsOffset + 50 >= totalEmails}
                  className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-600 transition-colors"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal détail email */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-black/70" onClick={() => setSelectedEmail(null)} />

            <div className="relative bg-gray-800 rounded-xl border border-gray-700 shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Détail de l'email</h3>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {loadingDetail ? (
                <div className="p-8 text-center">
                  <ArrowPathIcon className="h-8 w-8 text-gray-500 animate-spin mx-auto" />
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
                  {/* Metadata */}
                  <div className="px-6 py-4 bg-gray-700/30 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">De:</span>
                      <span className="ml-2 text-white">{selectedEmail.sender}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Date:</span>
                      <span className="ml-2 text-white">{formatDate(selectedEmail.received_at)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400">Sujet:</span>
                      <span className="ml-2 text-white font-medium">{selectedEmail.subject}</span>
                    </div>
                    {selectedEmail.is_backup_notification && (
                      <>
                        <div>
                          <span className="text-gray-400">Type:</span>
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs ${getStatusBadgeClass(selectedEmail.detected_status)}`}>
                            {selectedEmail.detected_type || 'backup'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">NAS:</span>
                          <span className="ml-2 text-blue-400">{selectedEmail.detected_nas || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Statut:</span>
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs ${getStatusBadgeClass(selectedEmail.detected_status)}`}>
                            {getStatusIcon(selectedEmail.detected_status)}
                            <span className="ml-1">{selectedEmail.detected_status || 'inconnu'}</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Confiance IA:</span>
                          <span className="ml-2 text-white">{selectedEmail.ai_confidence}%</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="px-6 py-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Contenu</h4>
                    <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                        {selectedEmail.body_text || '(Pas de contenu texte)'}
                      </pre>
                    </div>
                  </div>

                  {/* Données extraites par l'IA */}
                  {selectedEmail.ai_extracted_data && (
                    <div className="px-6 py-4 border-t border-gray-700">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Données extraites par l'IA</h4>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                        <pre className="text-xs text-gray-400">
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
