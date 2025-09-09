const path = require('path');

// Configurações do sistema
const config = {
    // Configurações do servidor
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost',
        nodeEnv: process.env.NODE_ENV || 'development'
    },

    // Configurações do WhatsApp
    whatsapp: {
        sessionName: process.env.WA_SESSION_NAME || 'wa-divulgacoes-session',
        browserName: process.env.WA_BROWSER_NAME || 'Chrome',
        maxReconnectAttempts: parseInt(process.env.WA_MAX_RECONNECT_ATTEMPTS) || 5,
        reconnectDelay: parseInt(process.env.WA_RECONNECT_DELAY) || 30000,
        qrCodeTimeout: parseInt(process.env.WA_QR_TIMEOUT) || 60000,
        authTimeout: parseInt(process.env.WA_AUTH_TIMEOUT) || 60000
    },

    // Configurações anti-spam
    antiSpam: {
        enabled: process.env.ANTI_SPAM_ENABLED !== 'false',
        intervalMinutes: parseInt(process.env.ANTI_SPAM_INTERVAL_MINUTES) || 30,
        maxMessagesPerGroup: parseInt(process.env.ANTI_SPAM_MAX_MESSAGES_PER_GROUP) || 10,
        delayBetweenMessages: parseInt(process.env.ANTI_SPAM_DELAY_BETWEEN_MESSAGES) || 2000,
        cooldownPeriod: parseInt(process.env.ANTI_SPAM_COOLDOWN_PERIOD) || 300000, // 5 minutos
        maxRetries: parseInt(process.env.ANTI_SPAM_MAX_RETRIES) || 3
    },

    // Configurações de upload
    upload: {
        maxSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 5242880, // 5MB
        allowedExtensions: (process.env.UPLOAD_ALLOWED_EXTENSIONS || 'jpg,jpeg,png,gif,webp').split(','),
        uploadDir: path.join(__dirname, 'uploads'),
        tempDir: path.join(__dirname, 'temp')
    },

    // Configurações de logs
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        maxFiles: parseInt(process.env.LOG_MAX_FILES) || 50,
        maxConnectionLogs: parseInt(process.env.LOG_MAX_CONNECTION) || 100,
        enableFileLogging: process.env.LOG_ENABLE_FILE !== 'false',
        logDir: path.join(__dirname, 'logs')
    },

    // Configurações de segurança
    security: {
        enableCors: process.env.ENABLE_CORS !== 'false',
        rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutos
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        maxConcurrentConnections: parseInt(process.env.MAX_CONCURRENT_CONNECTIONS) || 10,
        enableRequestValidation: process.env.ENABLE_REQUEST_VALIDATION !== 'false'
    },

    // Configurações de backup
    backup: {
        enabled: process.env.AUTO_BACKUP_ENABLED !== 'false',
        intervalHours: parseInt(process.env.AUTO_BACKUP_INTERVAL_HOURS) || 24,
        retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 7,
        backupDir: path.join(__dirname, 'backups'),
        includeImages: process.env.BACKUP_INCLUDE_IMAGES !== 'false',
        compressBackups: process.env.BACKUP_COMPRESS !== 'false'
    },

    // Configurações de dados
    database: {
        dataDir: path.join(__dirname, 'data'),
        authDir: path.join(__dirname, 'auth_info'),
        campaigns: path.join(__dirname, 'data', 'campaigns.json'),
        groups: path.join(__dirname, 'data', 'groups.json'),
        statistics: path.join(__dirname, 'data', 'statistics.json'),
        settings: path.join(__dirname, 'data', 'settings.json'),
        logs: path.join(__dirname, 'data', 'logs.json')
    },

    // Configurações de campanhas
    campaigns: {
        maxConcurrentExecution: parseInt(process.env.CAMPAIGNS_MAX_CONCURRENT) || 3,
        defaultTimeout: parseInt(process.env.CAMPAIGNS_DEFAULT_TIMEOUT) || 30000,
        maxScheduledCampaigns: parseInt(process.env.CAMPAIGNS_MAX_SCHEDULED) || 50,
        minScheduleInterval: parseInt(process.env.CAMPAIGNS_MIN_SCHEDULE_INTERVAL) || 300000, // 5 minutos
        maxMessageLength: parseInt(process.env.CAMPAIGNS_MAX_MESSAGE_LENGTH) || 4096,
        enableImageResize: process.env.CAMPAIGNS_ENABLE_IMAGE_RESIZE !== 'false',
        maxImageWidth: parseInt(process.env.CAMPAIGNS_MAX_IMAGE_WIDTH) || 1920,
        maxImageHeight: parseInt(process.env.CAMPAIGNS_MAX_IMAGE_HEIGHT) || 1080
    },

    // Configurações de monitoramento
    monitoring: {
        enableHealthCheck: process.env.MONITORING_HEALTH_CHECK !== 'false',
        healthCheckInterval: parseInt(process.env.MONITORING_HEALTH_INTERVAL) || 60000, // 1 minuto
        enablePerformanceMetrics: process.env.MONITORING_PERFORMANCE !== 'false',
        enableMemoryMonitoring: process.env.MONITORING_MEMORY !== 'false',
        memoryThresholdMB: parseInt(process.env.MONITORING_MEMORY_THRESHOLD) || 512,
        cpuThresholdPercent: parseInt(process.env.MONITORING_CPU_THRESHOLD) || 80
    },

    // Configurações de notificações
    notifications: {
        enableSystemNotifications: process.env.NOTIFICATIONS_SYSTEM !== 'false',
        enableErrorNotifications: process.env.NOTIFICATIONS_ERROR !== 'false',
        enableSuccessNotifications: process.env.NOTIFICATIONS_SUCCESS !== 'false',
        enableWebhooks: process.env.NOTIFICATIONS_WEBHOOKS === 'true',
        webhookUrl: process.env.NOTIFICATION_WEBHOOK_URL || '',
        maxNotificationHistory: parseInt(process.env.NOTIFICATIONS_MAX_HISTORY) || 100
    },

    // Configurações de desenvolvimento
    development: {
        enableDebugMode: process.env.NODE_ENV === 'development',
        enableHotReload: process.env.ENABLE_HOT_RELOAD === 'true',
        showDetailedErrors: process.env.SHOW_DETAILED_ERRORS !== 'false',
        enableTestMode: process.env.ENABLE_TEST_MODE === 'true',
        mockWhatsApp: process.env.MOCK_WHATSAPP === 'true'
    },

    // Constantes do sistema
    constants: {
        APP_NAME: 'WA Divulgações',
        APP_VERSION: '1.0.0',
        AUTHOR: 'Wallysson Studio Dv',
        COPYRIGHT_YEAR: '2025',
        SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        MAX_GROUPS_PER_CAMPAIGN: 50,
        MAX_CAMPAIGNS_PER_USER: 100,
        DEFAULT_TIMEZONE: 'America/Sao_Paulo',
        SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 horas
        QR_CODE_REFRESH_INTERVAL: 30000, // 30 segundos
        CONNECTION_CHECK_INTERVAL: 5000, // 5 segundos
        STATISTICS_UPDATE_INTERVAL: 60000, // 1 minuto
        CLEANUP_INTERVAL: 6 * 60 * 60 * 1000 // 6 horas
    },

    // Mensagens do sistema
    messages: {
        connection: {
            connecting: 'Conectando ao WhatsApp...',
            connected: 'Conectado com sucesso!',
            disconnected: 'Desconectado do WhatsApp',
            qrReady: 'QR Code gerado. Escaneie para conectar.',
            authSuccess: 'Autenticação realizada com sucesso!',
            authFailed: 'Falha na autenticação',
            reconnecting: 'Tentando reconectar...',
            maxRetriesReached: 'Máximo de tentativas de reconexão atingido'
        },
        campaigns: {
            created: 'Campanha criada com sucesso!',
            updated: 'Campanha atualizada com sucesso!',
            deleted: 'Campanha excluída com sucesso!',
            paused: 'Campanha pausada',
            resumed: 'Campanha retomada',
            executed: 'Campanha executada',
            failed: 'Falha na execução da campanha',
            noGroups: 'Nenhum grupo selecionado',
            invalidSchedule: 'Agendamento inválido'
        },
        errors: {
            generic: 'Ocorreu um erro inesperado',
            connectionFailed: 'Falha na conexão com o WhatsApp',
            groupNotFound: 'Grupo não encontrado',
            messageNotSent: 'Mensagem não enviada',
            imageUploadFailed: 'Falha no upload da imagem',
            invalidData: 'Dados inválidos fornecidos',
            rateLimitExceeded: 'Limite de requisições excedido',
            antiSpamTriggered: 'Proteção anti-spam ativada'
        }
    }
};

// Validação de configurações
function validateConfig() {
    const errors = [];

    // Validar porta
    if (!config.server.port || config.server.port < 1 || config.server.port > 65535) {
        errors.push('Porta do servidor inválida');
    }

    // Validar configurações anti-spam
    if (config.antiSpam.intervalMinutes < 1) {
        errors.push('Intervalo anti-spam deve ser maior que 0');
    }

    if (config.antiSpam.maxMessagesPerGroup < 1) {
        errors.push('Máximo de mensagens por grupo deve ser maior que 0');
    }

    // Validar tamanho de upload
    if (config.upload.maxSize < 1024) {
        errors.push('Tamanho máximo de upload muito pequeno');
    }

    // Validar diretórios
    const requiredDirs = [
        config.upload.uploadDir,
        config.database.dataDir,
        config.logging.logDir,
        config.backup.backupDir
    ];

    requiredDirs.forEach(dir => {
        if (!dir || typeof dir !== 'string') {
            errors.push(`Diretório inválido: ${dir}`);
        }
    });

    if (errors.length > 0) {
        throw new Error('Configurações inválidas:\n' + errors.join('\n'));
    }
}

// Função para obter configuração específica
function getConfig(key) {
    const keys = key.split('.');
    let value = config;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return undefined;
        }
    }
    
    return value;
}

// Função para definir configuração específica
function setConfig(key, value) {
    const keys = key.split('.');
    let obj = config;
    
    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!obj[k] || typeof obj[k] !== 'object') {
            obj[k] = {};
        }
        obj = obj[k];
    }
    
    obj[keys[keys.length - 1]] = value;
}

// Função para criar diretórios necessários
async function createRequiredDirectories() {
    const fs = require('fs').promises;
    
    const directories = [
        config.upload.uploadDir,
        config.upload.tempDir,
        config.database.dataDir,
        config.database.authDir,
        config.logging.logDir,
        config.backup.backupDir
    ];

    for (const dir of directories) {
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
            console.log(`Diretório criado: ${dir}`);
        }
    }
}

// Função para exibir configurações (sem dados sensíveis)
function displayConfig() {
    const publicConfig = {
        server: config.server,
        antiSpam: config.antiSpam,
        upload: {
            ...config.upload,
            uploadDir: '[HIDDEN]',
            tempDir: '[HIDDEN]'
        },
        campaigns: config.campaigns,
        constants: config.constants
    };

    console.log('Configurações do sistema:');
    console.log(JSON.stringify(publicConfig, null, 2));
}

// Inicializar configurações
async function initializeConfig() {
    try {
        validateConfig();
        await createRequiredDirectories();
        
        if (config.development.enableDebugMode) {
            displayConfig();
        }
        
        console.log(`${config.constants.APP_NAME} v${config.constants.APP_VERSION} inicializado`);
        return true;
    } catch (error) {
        console.error('Erro na inicialização das configurações:', error.message);
        return false;
    }
}

module.exports = {
    config,
    getConfig,
    setConfig,
    validateConfig,
    createRequiredDirectories,
    displayConfig,
    initializeConfig
};