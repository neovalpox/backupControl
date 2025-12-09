-- BackupControl Database Initialization Script
-- This script creates the initial database schema and default data

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create default admin user (password: admin123 - CHANGE THIS!)
-- The password hash below is for 'admin123' using bcrypt
INSERT INTO users (username, email, password_hash, full_name, role, is_active, language, theme, created_at, updated_at)
VALUES (
    'admin',
    'admin@backupcontrol.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4awKRXlSZ5DoIQue',
    'Administrator',
    'admin',
    true,
    'fr',
    'dark',
    NOW(),
    NOW()
) ON CONFLICT (username) DO NOTHING;

-- Insert default settings
INSERT INTO settings (key, value, description, created_at, updated_at) VALUES
    ('email_provider', 'imap', 'Email provider type: imap, office365, gmail', NOW(), NOW()),
    ('email_host', '', 'IMAP server hostname', NOW(), NOW()),
    ('email_port', '993', 'IMAP server port', NOW(), NOW()),
    ('email_username', '', 'Email account username', NOW(), NOW()),
    ('email_password', '', 'Email account password (encrypted)', NOW(), NOW()),
    ('email_use_ssl', 'true', 'Use SSL for email connection', NOW(), NOW()),
    ('email_folder', 'INBOX', 'Email folder to monitor', NOW(), NOW()),
    ('ai_provider', 'anthropic', 'AI provider: anthropic or openai', NOW(), NOW()),
    ('ai_api_key', '', 'API key for AI provider', NOW(), NOW()),
    ('ai_model', 'claude-3-haiku-20240307', 'AI model to use', NOW(), NOW()),
    ('notification_email_enabled', 'false', 'Enable email notifications', NOW(), NOW()),
    ('notification_email_to', '', 'Email address for notifications', NOW(), NOW()),
    ('notification_telegram_enabled', 'false', 'Enable Telegram notifications', NOW(), NOW()),
    ('notification_telegram_token', '', 'Telegram bot token', NOW(), NOW()),
    ('notification_telegram_chat_id', '', 'Telegram chat ID for notifications', NOW(), NOW()),
    ('scheduler_enabled', 'true', 'Enable background scheduler', NOW(), NOW()),
    ('scheduler_email_check_interval', '60', 'Email check interval in minutes', NOW(), NOW()),
    ('app_name', 'BackupControl', 'Application name', NOW(), NOW()),
    ('app_version', '1.0.0', 'Application version', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Create sample client (optional - remove if not needed)
-- INSERT INTO clients (name, contact_email, nas_identifier, sla_hours, is_active, created_at, updated_at)
-- VALUES (
--     'Client Demo',
--     'demo@example.com',
--     'NDEMO01',
--     24,
--     true,
--     NOW(),
--     NOW()
-- ) ON CONFLICT DO NOTHING;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'BackupControl database initialized successfully!';
    RAISE NOTICE 'Default admin user created with username: admin';
    RAISE NOTICE 'IMPORTANT: Change the default password immediately!';
END $$;
