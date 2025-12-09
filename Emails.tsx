import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EnvelopeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { emailsApi } from '../api';

interface Email {
  id: number;
  message_id: string;
  subject: string;
  sender: string;
  received_at: string;
  is_backup_notification: boolean;
  detected_type: string | null;
  detected_status: string | null;
  detected_nas: string | null;
  ai_confidence: number | null;
  is_processed: boolean;
  body_text?: string;
  ai_extracted_data?: any;
}

export default function Emails() {
  const { t } = useTranslation();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailBody, setEmailBody] = useState<string>('');

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const data = await emailsApi.getAll();
      setEmails(data);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchNew = async () => {
    setFetching(true);
    try {
      await emailsApi.fetchNew();
      await fetchEmails();
    } catch (error) {
      console.error('Error fetching new emails:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleAnalyzeAll = async () => {
    setAnalyzing(true);
    try {
      await emailsApi.analyzeAll();
      await fetchEmails();
    } catch (error) {
      console.error('Error analyzing emails:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleViewEmail = async (email: Email) => {
    setSelectedEmail(email);
    try {
      const data = await emailsApi.getById(email.id);
      setEmailBody(data.body_text || '');
    } catch (error) {
      console.error('Error fetching email body:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const filteredEmails = emails.filter((email) =>
    email.subject.toLowerCase().includes(search.toLowerCase()) ||
    email.sender.toLowerCase().includes(search.toLowerCase()) ||
    email.detected_nas?.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const totalEmails = emails.length;
  const backupEmails = emails.filter(e => e.is_backup_notification).length;
  const processedEmails = emails.filter(e => e.is_processed).length;
  const successEmails = emails.filter(e => e.detected_status === 'success').length;
  const failedEmails = emails.filter(e => e.detected_status === 'failure').length;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('emails.title')}</h1>
          <p className="text-gray-400 mt-1">{t('emails.subtitle')}</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleFetchNew}
            disabled={fetching}
            className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <ArrowPathIcon className={`w-5 h-5 mr-2 ${fetching ? 'animate-spin' : ''}`} />
            {t('emails.fetchNew')}
          </button>
          <button
            onClick={handleAnalyzeAll}
            disabled={analyzing}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <SparklesIcon className={`w-5 h-5 mr-2 ${analyzing ? 'animate-pulse' : ''}`} />
            {t('emails.analyzeAll')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('emails.total')}</p>
              <p className="text-2xl font-bold text-white">{totalEmails}</p>
            </div>
            <EnvelopeIcon className="w-10 h-10 text-gray-600" />
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Notifications</p>
              <p className="text-2xl font-bold text-primary-500">{backupEmails}</p>
            </div>
            <SparklesIcon className="w-10 h-10 text-primary-600/50" />
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('emails.processed')}</p>
              <p className="text-2xl font-bold text-blue-500">{processedEmails}</p>
            </div>
            <CheckCircleIcon className="w-10 h-10 text-blue-600/50" />
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Succès</p>
              <p className="text-2xl font-bold text-green-500">{successEmails}</p>
            </div>
            <CheckCircleIcon className="w-10 h-10 text-green-600/50" />
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Échecs</p>
              <p className="text-2xl font-bold text-red-500">{failedEmails}</p>
            </div>
            <XCircleIcon className="w-10 h-10 text-red-600/50" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('emails.search')}
          className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Emails list */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('emails.subject')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('emails.sender')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('emails.received')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  NAS / Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('emails.status')}
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredEmails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {t('emails.noEmails')}
                  </td>
                </tr>
              ) : (
                filteredEmails.map((email) => (
                  <tr key={email.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <p className="text-white font-medium truncate max-w-xs" title={email.subject}>
                        {email.subject}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{email.sender}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{formatDate(email.received_at)}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {email.detected_nas && (
                          <p className="text-gray-300 font-medium">{email.detected_nas}</p>
                        )}
                        {email.detected_type && (
                          <p className="text-gray-500 text-xs">{email.detected_type}</p>
                        )}
                        {!email.detected_nas && !email.detected_type && (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {email.is_backup_notification ? (
                          <>
                            {email.detected_status === 'success' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-500">
                                Succès
                              </span>
                            ) : email.detected_status === 'failure' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-500">
                                Échec
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-500">
                                Inconnu
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">
                            Non backup
                          </span>
                        )}
                        {email.ai_confidence && (
                          <span className="text-xs text-gray-500">{email.ai_confidence}%</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleViewEmail(email)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
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
      </div>

      {/* Email detail modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedEmail(null)} />
          <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedEmail.subject}</h2>
                <p className="text-gray-400 mt-1">{selectedEmail.sender}</p>
                <p className="text-gray-500 text-sm">{formatDate(selectedEmail.received_at)}</p>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="text-gray-400 hover:text-white"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            {/* AI Analysis results */}
            {selectedEmail.is_backup_notification && (
              <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
                  <SparklesIcon className="w-5 h-5 mr-2 text-primary-500" />
                  Analyse IA
                </h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">NAS détecté</p>
                    <p className="text-white">{selectedEmail.detected_nas || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Type</p>
                    <p className="text-white">{selectedEmail.detected_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Statut</p>
                    <p className={`font-medium ${
                      selectedEmail.detected_status === 'success' ? 'text-green-500' :
                      selectedEmail.detected_status === 'failure' ? 'text-red-500' :
                      'text-yellow-500'
                    }`}>
                      {selectedEmail.detected_status || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Confiance IA</p>
                    <p className="text-white">{selectedEmail.ai_confidence ? `${selectedEmail.ai_confidence}%` : '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Email body */}
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono">
                {emailBody || 'Chargement du contenu...'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}