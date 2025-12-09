import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EnvelopeIcon,
  SparklesIcon,
  BellIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { settingsApi, emailsApi } from '../api';

interface SettingsData {
  email: Record<string, any>;
  ai: Record<string, any>;
  alerts: Record<string, any>;
  general: Record<string, any>;
}

export default function Settings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SettingsData>({
    email: {},
    ai: {},
    alerts: {},
    general: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [testingTeams, setTestingTeams] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState('email');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Local form state for editing
  const [formData, setFormData] = useState({
    // Email Type
    email_provider: 'imap',
    email_address: '',  // Adresse email a surveiller (pour tous les types)
    email_folder: 'INBOX',
    // Email IMAP
    email_host: '',
    email_port: 993,
    email_username: '',
    email_password: '',
    email_use_ssl: true,
    // Email Office 365
    office365_client_id: '',
    office365_client_secret: '',
    office365_tenant_id: '',
    // AI
    ai_provider: 'claude',
    claude_api_key: '',
    openai_api_key: '',
    ai_model: 'claude-3-haiku-20240307',
    // Alerts thresholds
    alert_warning_hours: 24,
    alert_alert_hours: 48,
    alert_critical_hours: 72,
    // Notifications
    telegram_bot_token: '',
    telegram_chat_id: '',
    discord_webhook_url: '',
    slack_webhook_url: '',
    teams_webhook_url: '',
    // SMTP for email notifications
    smtp_server: '',
    smtp_port: 587,
    smtp_use_tls: true,
    smtp_username: '',
    smtp_password: '',
    alert_from_email: '',
    alert_to_emails: '',
    notification_email_enabled: false,
    notification_email_to: '',
    // Scheduler
    email_check_hour: 6,
    scheduler_enabled: true,
    // General
    default_language: 'fr',
    default_theme: 'dark',
    log_retention_days: 90,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await settingsApi.getAll();
      setSettings(data);
      
      // Merge fetched settings into formData
      const merged = { ...formData };
      Object.entries(data).forEach(([category, categorySettings]) => {
        Object.entries(categorySettings as Record<string, any>).forEach(([key, setting]) => {
          if (key in merged) {
            // Don't overwrite with masked values
            if (setting.value !== '********') {
              (merged as any)[key] = setting.value;
            }
          }
        });
      });
      setFormData(merged);
    } catch (error) {
      console.error('Error fetching settings:', error);
      showNotification('error', 'Erreur lors du chargement des parametres');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Prepare settings object - only include non-empty values
      const settingsToSave: Record<string, string> = {};
      
      Object.entries(formData).forEach(([key, value]) => {
        // Skip empty strings for secrets (means unchanged)
        if (typeof value === 'string' && value === '' && key.includes('key') || key.includes('secret') || key.includes('password') || key.includes('webhook')) {
          return;
        }
        settingsToSave[key] = String(value);
      });

      await settingsApi.updateBatch(settingsToSave);
      showNotification('success', 'Parametres sauvegardes avec succes');
      await fetchSettings();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      showNotification('error', error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      // Test la connexion avec les settings sauvegardés dans la base de données
      const result = await emailsApi.testConnection();
      showNotification(result.success ? 'success' : 'error', result.message || (result.success ? 'Connexion réussie!' : 'Échec de la connexion'));
    } catch (error: any) {
      showNotification('error', error.response?.data?.detail || 'Échec du test de connexion');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestAI = async () => {
    setTestingAI(true);
    try {
      // Simple test - just verify the API key format
      const apiKey = formData.ai_provider === 'claude' ? formData.claude_api_key : formData.openai_api_key;
      if (!apiKey || apiKey.length < 10) {
        showNotification('error', 'Clé API invalide ou manquante');
        return;
      }
      showNotification('success', 'Format de clé API valide');
    } catch (error: any) {
      showNotification('error', 'Erreur lors du test');
    } finally {
      setTestingAI(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    try {
      const result = await emailsApi.testSmtp();
      showNotification(result.success ? 'success' : 'error', result.message);
    } catch (error: any) {
      showNotification('error', error.response?.data?.detail || 'Erreur lors du test SMTP');
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    try {
      const result = await emailsApi.testTelegram();
      showNotification(result.success ? 'success' : 'error', result.message);
    } catch (error: any) {
      showNotification('error', error.response?.data?.detail || 'Erreur lors du test Telegram');
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleTestDiscord = async () => {
    setTestingDiscord(true);
    try {
      const result = await emailsApi.testDiscord();
      showNotification(result.success ? 'success' : 'error', result.message);
    } catch (error: any) {
      showNotification('error', error.response?.data?.detail || 'Erreur lors du test Discord');
    } finally {
      setTestingDiscord(false);
    }
  };

  const handleTestSlack = async () => {
    setTestingSlack(true);
    try {
      const result = await emailsApi.testSlack();
      showNotification(result.success ? 'success' : 'error', result.message);
    } catch (error: any) {
      showNotification('error', error.response?.data?.detail || 'Erreur lors du test Slack');
    } finally {
      setTestingSlack(false);
    }
  };

  const handleTestTeams = async () => {
    setTestingTeams(true);
    try {
      const result = await emailsApi.testTeams();
      showNotification(result.success ? 'success' : 'error', result.message);
    } catch (error: any) {
      showNotification('error', error.response?.data?.detail || 'Erreur lors du test Teams');
    } finally {
      setTestingTeams(false);
    }
  };

  const handleInitialize = async () => {
    try {
      await settingsApi.initialize();
      showNotification('success', 'Parametres par defaut initialises');
      await fetchSettings();
    } catch (error: any) {
      showNotification('error', error.response?.data?.detail || 'Erreur lors de l\'initialisation');
    }
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateFormData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'email', name: 'E-mail', icon: EnvelopeIcon },
    { id: 'ai', name: 'Intelligence Artificielle', icon: SparklesIcon },
    { id: 'alerts', name: 'Alertes & Notifications', icon: BellIcon },
    { id: 'general', name: 'Général', icon: Cog6ToothIcon },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const SecretInput = ({ label, value, onChange, placeholder, fieldKey }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    fieldKey: string;
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <div className="relative">
        <input
          type={showSecrets[fieldKey] ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={() => toggleShowSecret(fieldKey)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
        >
          {showSecrets[fieldKey] ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Parametres</h1>
          <p className="text-gray-400 mt-1">Configuration de l'application</p>
        </div>
        <button
          onClick={handleInitialize}
          className="inline-flex items-center px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          Initialiser les défauts
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`flex items-center p-4 rounded-lg ${
          notification.type === 'success'
            ? 'bg-green-500/10 text-green-500 border border-green-500'
            : 'bg-red-500/10 text-red-500 border border-red-500'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
          ) : (
            <ExclamationCircleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
          )}
          {notification.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-800 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <tab.icon className="w-5 h-5 mr-2" />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        {/* Email Settings */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <EnvelopeIcon className="w-5 h-5 mr-2" />
              Configuration E-mail
            </h3>
            <p className="text-gray-400 text-sm">
              Configurez la connexion à votre boîte mail pour l'analyse automatique des rapports de sauvegarde.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Type de compte
              </label>
              <select
                value={formData.email_provider}
                onChange={(e) => updateFormData('email_provider', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="imap">IMAP (Générique)</option>
                <option value="office365">Microsoft 365 (OAuth2)</option>
                <option value="gmail">Gmail (OAuth2)</option>
              </select>
            </div>

            {formData.email_provider === 'imap' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Serveur IMAP
                    </label>
                    <input
                      type="text"
                      value={formData.email_host}
                      onChange={(e) => updateFormData('email_host', e.target.value)}
                      placeholder="imap.exemple.com"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Port
                    </label>
                    <input
                      type="number"
                      value={formData.email_port}
                      onChange={(e) => updateFormData('email_port', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="email_use_ssl"
                    checked={formData.email_use_ssl}
                    onChange={(e) => updateFormData('email_use_ssl', e.target.checked)}
                    className="w-4 h-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="email_use_ssl" className="ml-2 text-sm text-gray-300">
                    Utiliser SSL/TLS
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Adresse e-mail
                    </label>
                    <input
                      type="email"
                      value={formData.email_username}
                      onChange={(e) => updateFormData('email_username', e.target.value)}
                      placeholder="backup@exemple.com"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <SecretInput
                    label="Mot de passe"
                    value={formData.email_password}
                    onChange={(value) => updateFormData('email_password', value)}
                    placeholder="••••••••"
                    fieldKey="email_password"
                  />
                </div>
              </>
            )}

            {formData.email_provider === 'office365' && (
              <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-400">
                  Configuration Azure AD pour Microsoft 365. Créez une application dans Azure Portal.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Client ID (Application ID)
                  </label>
                  <input
                    type="text"
                    value={formData.office365_client_id}
                    onChange={(e) => updateFormData('office365_client_id', e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <SecretInput
                  label="Client Secret"
                  value={formData.office365_client_secret}
                  onChange={(value) => updateFormData('office365_client_secret', value)}
                  fieldKey="office365_client_secret"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tenant ID
                  </label>
                  <input
                    type="text"
                    value={formData.office365_tenant_id}
                    onChange={(e) => updateFormData('office365_tenant_id', e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Adresse e-mail a surveiller
                  </label>
                  <input
                    type="email"
                    value={formData.email_address}
                    onChange={(e) => updateFormData('email_address', e.target.value)}
                    placeholder="backup@entreprise.com"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Dossier à surveiller
              </label>
              <input
                type="text"
                value={formData.email_folder}
                onChange={(e) => updateFormData('email_folder', e.target.value)}
                placeholder="INBOX"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Heure d'analyse quotidienne
              </label>
              <select
                value={formData.email_check_hour}
                onChange={(e) => updateFormData('email_check_hour', parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {[...Array(24)].map((_, i) => (
                  <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleTestEmail}
              disabled={testingEmail}
              className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {testingEmail ? (
                <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <EnvelopeIcon className="w-5 h-5 mr-2" />
              )}
              Tester la connexion
            </button>
          </div>
        )}

        {/* AI Settings */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <SparklesIcon className="w-5 h-5 mr-2" />
              Configuration de l'IA
            </h3>
            <p className="text-gray-400 text-sm">
              L'IA analyse automatiquement les e-mails de sauvegarde pour extraire les informations importantes.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Provider IA
              </label>
              <select
                value={formData.ai_provider}
                onChange={(e) => updateFormData('ai_provider', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="claude">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
              </select>
            </div>

            {formData.ai_provider === 'claude' && (
              <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">Anthropic Claude</span>
                  <a 
                    href="https://console.anthropic.com/account/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:text-primary-300 text-sm"
                  >
                    Obtenir une clé API →
                  </a>
                </div>
                <SecretInput
                  label="Clé API Claude"
                  value={formData.claude_api_key}
                  onChange={(value) => updateFormData('claude_api_key', value)}
                  placeholder="sk-ant-api..."
                  fieldKey="claude_api_key"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Modèle
                  </label>
                  <select
                    value={formData.ai_model}
                    onChange={(e) => updateFormData('ai_model', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku (Rapide & Économique)</option>
                    <option value="claude-3-sonnet-20240229">Claude 3 Sonnet (Équilibré)</option>
                    <option value="claude-3-opus-20240229">Claude 3 Opus (Plus puissant)</option>
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Recommandé)</option>
                  </select>
                </div>
              </div>
            )}

            {formData.ai_provider === 'openai' && (
              <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">OpenAI GPT</span>
                  <a 
                    href="https://platform.openai.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:text-primary-300 text-sm"
                  >
                    Obtenir une clé API →
                  </a>
                </div>
                <SecretInput
                  label="Clé API OpenAI"
                  value={formData.openai_api_key}
                  onChange={(value) => updateFormData('openai_api_key', value)}
                  placeholder="sk-..."
                  fieldKey="openai_api_key"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Modèle
                  </label>
                  <select
                    value={formData.ai_model}
                    onChange={(e) => updateFormData('ai_model', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Économique)</option>
                    <option value="gpt-4">GPT-4 (Puissant)</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo (Rapide)</option>
                    <option value="gpt-4o">GPT-4o (Dernière version)</option>
                  </select>
                </div>
              </div>
            )}

            <button
              onClick={handleTestAI}
              disabled={testingAI}
              className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {testingAI ? (
                <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <SparklesIcon className="w-5 h-5 mr-2" />
              )}
              Vérifier la clé API
            </button>
          </div>
        )}

        {/* Alerts Settings */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <BellIcon className="w-5 h-5 mr-2" />
              Alertes & Notifications
            </h3>

            {/* Thresholds */}
            <div className="p-4 bg-gray-700/50 rounded-lg space-y-4">
              <h4 className="font-medium text-white">Seuils d'alerte</h4>
              <p className="text-gray-400 text-sm">
                Définissez après combien de temps sans sauvegarde une alerte est déclenchée.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-yellow-400 mb-2">
                    ⚠️ Avertissement (heures)
                  </label>
                  <input
                    type="number"
                    value={formData.alert_warning_hours}
                    onChange={(e) => updateFormData('alert_warning_hours', parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-orange-400 mb-2">
                    🔶 Alerte (heures)
                  </label>
                  <input
                    type="number"
                    value={formData.alert_alert_hours}
                    onChange={(e) => updateFormData('alert_alert_hours', parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-400 mb-2">
                    🔴 Critique (heures)
                  </label>
                  <input
                    type="number"
                    value={formData.alert_critical_hours}
                    onChange={(e) => updateFormData('alert_critical_hours', parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Webhooks */}
            <div className="p-4 bg-gray-700/50 rounded-lg space-y-4">
              <h4 className="font-medium text-white">Webhooks de notification</h4>
              <p className="text-gray-400 text-sm">
                Recevez des notifications sur vos plateformes préférées.
              </p>
              
              {/* Telegram */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SecretInput
                  label="Telegram Bot Token"
                  value={formData.telegram_bot_token}
                  onChange={(value) => updateFormData('telegram_bot_token', value)}
                  placeholder="123456789:ABCdefGHI..."
                  fieldKey="telegram_bot_token"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Telegram Chat ID</label>
                  <input
                    type="text"
                    value={formData.telegram_chat_id}
                    onChange={(e) => updateFormData('telegram_chat_id', e.target.value)}
                    placeholder="-1001234567890"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <button
                onClick={handleTestTelegram}
                disabled={testingTelegram || !formData.telegram_bot_token || !formData.telegram_chat_id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {testingTelegram ? 'Test en cours...' : '🧪 Tester Telegram'}
              </button>
              
              <div className="border-t border-gray-600 pt-4 mt-4">
                <SecretInput
                  label="Discord Webhook URL"
                  value={formData.discord_webhook_url}
                  onChange={(value) => updateFormData('discord_webhook_url', value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  fieldKey="discord_webhook_url"
                />
                <button
                  onClick={handleTestDiscord}
                  disabled={testingDiscord || !formData.discord_webhook_url}
                  className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {testingDiscord ? 'Test en cours...' : '🧪 Tester Discord'}
                </button>
              </div>
              
              <div className="border-t border-gray-600 pt-4">
                <SecretInput
                  label="Slack Webhook URL"
                  value={formData.slack_webhook_url}
                  onChange={(value) => updateFormData('slack_webhook_url', value)}
                  placeholder="https://hooks.slack.com/services/..."
                  fieldKey="slack_webhook_url"
                />
                <button
                  onClick={handleTestSlack}
                  disabled={testingSlack || !formData.slack_webhook_url}
                  className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {testingSlack ? 'Test en cours...' : '🧪 Tester Slack'}
                </button>
              </div>
              
              <div className="border-t border-gray-600 pt-4">
                <SecretInput
                  label="Microsoft Teams Webhook URL"
                  value={formData.teams_webhook_url}
                  onChange={(value) => updateFormData('teams_webhook_url', value)}
                  placeholder="https://outlook.office.com/webhook/..."
                  fieldKey="teams_webhook_url"
                />
                <button
                  onClick={handleTestTeams}
                  disabled={testingTeams || !formData.teams_webhook_url}
                  className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {testingTeams ? 'Test en cours...' : '🧪 Tester Teams'}
                </button>
              </div>
            </div>

            {/* SMTP Configuration */}
            <div className="p-4 bg-gray-700/50 rounded-lg space-y-4">
              <h4 className="font-medium text-white">Configuration SMTP (envoi d'alertes)</h4>
              <p className="text-gray-400 text-sm">
                Configurez un serveur SMTP pour envoyer des alertes par e-mail.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Serveur SMTP</label>
                  <input
                    type="text"
                    value={formData.smtp_server}
                    onChange={(e) => updateFormData('smtp_server', e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Port</label>
                  <input
                    type="number"
                    value={formData.smtp_port}
                    onChange={(e) => updateFormData('smtp_port', parseInt(e.target.value))}
                    placeholder="587"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.smtp_use_tls}
                    onChange={(e) => updateFormData('smtp_use_tls', e.target.checked)}
                    className="w-4 h-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                  />
                  Utiliser TLS
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nom d'utilisateur SMTP</label>
                  <input
                    type="text"
                    value={formData.smtp_username}
                    onChange={(e) => updateFormData('smtp_username', e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <SecretInput
                  label="Mot de passe SMTP"
                  value={formData.smtp_password}
                  onChange={(value) => updateFormData('smtp_password', value)}
                  placeholder="••••••••"
                  fieldKey="smtp_password"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">E-mail expéditeur</label>
                  <input
                    type="email"
                    value={formData.alert_from_email}
                    onChange={(e) => updateFormData('alert_from_email', e.target.value)}
                    placeholder="alertes@mondomaine.com"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">E-mail(s) destinataire(s)</label>
                  <input
                    type="text"
                    value={formData.alert_to_emails}
                    onChange={(e) => updateFormData('alert_to_emails', e.target.value)}
                    placeholder="admin@exemple.com, tech@exemple.com"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-gray-500 text-xs mt-1">Séparez plusieurs adresses par des virgules</p>
                </div>
              </div>

              <button
                onClick={handleTestSmtp}
                disabled={testingSmtp || !formData.smtp_server || !formData.smtp_username || !formData.smtp_password}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {testingSmtp ? 'Test en cours...' : '🧪 Tester SMTP'}
              </button>
            </div>

            {/* Email notifications */}
            <div className="p-4 bg-gray-700/50 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-white">Notifications par e-mail</h4>
                  <p className="text-gray-400 text-sm">Envoyer un résumé des alertes par e-mail</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.notification_email_enabled}
                  onChange={(e) => updateFormData('notification_email_enabled', e.target.checked)}
                  className="w-5 h-5 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                />
              </div>
              {formData.notification_email_enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Adresse(s) e-mail destinataire(s)
                  </label>
                  <input
                    type="text"
                    value={formData.notification_email_to}
                    onChange={(e) => updateFormData('notification_email_to', e.target.value)}
                    placeholder="admin@exemple.com, tech@exemple.com"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-gray-500 text-xs mt-1">Séparez plusieurs adresses par des virgules</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Cog6ToothIcon className="w-5 h-5 mr-2" />
              Paramètres généraux
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Langue par défaut
                </label>
                <select
                  value={formData.default_language}
                  onChange={(e) => updateFormData('default_language', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Thème par défaut
                </label>
                <select
                  value={formData.default_theme}
                  onChange={(e) => updateFormData('default_theme', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="dark">Sombre</option>
                  <option value="light">Clair</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Rétention des logs (jours)
              </label>
              <input
                type="number"
                value={formData.log_retention_days}
                onChange={(e) => updateFormData('log_retention_days', parseInt(e.target.value))}
                min="7"
                max="365"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-gray-500 text-xs mt-1">Les logs plus anciens seront automatiquement supprimés</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
              <div>
                <p className="text-white font-medium">Planificateur automatique</p>
                <p className="text-gray-400 text-sm">Activer l'analyse automatique des e-mails</p>
              </div>
              <input
                type="checkbox"
                checked={formData.scheduler_enabled}
                onChange={(e) => updateFormData('scheduler_enabled', e.target.checked)}
                className="w-5 h-5 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
        >
          {saving ? (
            <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <CheckCircleIcon className="w-5 h-5 mr-2" />
          )}
          Enregistrer les paramètres
        </button>
      </div>
    </div>
  );
}
