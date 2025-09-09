const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const cron = require('node-cron');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configuração do multer para upload de imagens
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = 'uploads';
        try {
            await fs.access(uploadDir);
        } catch {
            await fs.mkdir(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas!'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Variáveis globais
let sock;
let qrCodeData = '';
let connectionStatus = 'disconnected';
let connectionLogs = [];
let scheduledJobs = new Map();
let antiSpamControl = new Map();
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Estrutura de dados
const DATA_FILES = {
    campaigns: 'data/campaigns.json',
    groups: 'data/groups.json',
    statistics: 'data/statistics.json',
    settings: 'data/settings.json'
};

// Inicializar estrutura de dados
async function initializeDataStructure() {
    try {
        await fs.access('data');
    } catch {
        await fs.mkdir('data', { recursive: true });
    }

    for (const [key, filePath] of Object.entries(DATA_FILES)) {
        try {
            await fs.access(filePath);
        } catch {
            let initialData;
            switch (key) {
                case 'campaigns':
                    initialData = [];
                    break;
                case 'groups':
                    initialData = [];
                    break;
                case 'statistics':
                    initialData = {
                        totalSent: 0,
                        totalFailed: 0,
                        totalGroups: 0,
                        campaignsCreated: 0,
                        dailyStats: {}
                    };
                    break;
                case 'settings':
                    initialData = {
                        antiSpam: {
                            enabled: true,
                            intervalMinutes: 30,
                            maxMessagesPerGroup: 10
                        },
                        security: {
                            maxReconnectAttempts: 5,
                            reconnectDelay: 30000
                        }
                    };
                    break;
            }
            await fs.writeFile(filePath, JSON.stringify(initialData, null, 2));
        }
    }
}

// Funções de dados
async function readData(key) {
    try {
        const data = await fs.readFile(DATA_FILES[key], 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Erro ao ler ${key}:`, error);
        switch (key) {
            case 'statistics':
                return { totalSent: 0, totalFailed: 0, totalGroups: 0, campaignsCreated: 0, dailyStats: {} };
            default:
                return [];
        }
    }
}

async function writeData(key, data) {
    try {
        await fs.writeFile(DATA_FILES[key], JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Erro ao salvar ${key}:`, error);
        return false;
    }
}

// Função para atualizar estatísticas
async function updateStatistics(type, count = 1) {
    try {
        const stats = await readData('statistics');
        const today = new Date().toISOString().split('T')[0];
        
        if (!stats.dailyStats[today]) {
            stats.dailyStats[today] = { sent: 0, failed: 0, groups: 0 };
        }
        
        switch (type) {
            case 'sent':
                stats.totalSent += count;
                stats.dailyStats[today].sent += count;
                break;
            case 'failed':
                stats.totalFailed += count;
                stats.dailyStats[today].failed += count;
                break;
            case 'groups':
                stats.totalGroups = count;
                stats.dailyStats[today].groups = count;
                break;
            case 'campaign':
                stats.campaignsCreated += count;
                break;
        }
        
        await writeData('statistics', stats);
    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
    }
}

// Função anti-spam
async function checkAntiSpam(groupId) {
    try {
        const settings = await readData('settings');
        if (!settings.antiSpam.enabled) return true;
        
        const now = Date.now();
        const groupSpamData = antiSpamControl.get(groupId) || { count: 0, lastReset: now };
        
        // Reset contador se passou o intervalo
        if (now - groupSpamData.lastReset > settings.antiSpam.intervalMinutes * 60 * 1000) {
            groupSpamData.count = 0;
            groupSpamData.lastReset = now;
        }
        
        if (groupSpamData.count >= settings.antiSpam.maxMessagesPerGroup) {
            return false;
        }
        
        groupSpamData.count++;
        antiSpamControl.set(groupId, groupSpamData);
        return true;
    } catch (error) {
        console.error('Erro no anti-spam:', error);
        return true; // Em caso de erro, permitir envio
    }
}

// Função para conectar ao WhatsApp
async function connectToWhatsApp() {
    try {
        addConnectionLog('Iniciando conexão com WhatsApp...');
        connectionStatus = 'connecting';
        
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS('Chrome'),
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                try {
                    qrCodeData = await QRCode.toDataURL(qr);
                    connectionStatus = 'qr_ready';
                    addConnectionLog('QR Code gerado. Escaneie para conectar.');
                } catch (error) {
                    console.error('Erro ao gerar QR Code:', error);
                    addConnectionLog('Erro ao gerar QR Code: ' + error.message);
                }
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                
                connectionStatus = 'disconnected';
                qrCodeData = '';
                
                let reason = 'Conexão perdida';
                switch (statusCode) {
                    case DisconnectReason.badSession:
                        reason = 'Sessão inválida';
                        break;
                    case DisconnectReason.connectionClosed:
                        reason = 'Conexão fechada';
                        break;
                    case DisconnectReason.connectionLost:
                        reason = 'Conexão perdida';
                        break;
                    case DisconnectReason.connectionReplaced:
                        reason = 'Conexão substituída';
                        break;
                    case DisconnectReason.loggedOut:
                        reason = 'Deslogado';
                        break;
                    case DisconnectReason.restartRequired:
                        reason = 'Reinício necessário';
                        break;
                    case DisconnectReason.timedOut:
                        reason = 'Tempo esgotado';
                        break;
                }
                
                addConnectionLog(`${reason}. ${shouldReconnect ? 'Tentando reconectar...' : 'Não será reconectado.'}`);
                
                if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    addConnectionLog(`Tentativa de reconexão ${reconnectAttempts}/${maxReconnectAttempts}`);
                    setTimeout(connectToWhatsApp, 5000);
                } else if (reconnectAttempts >= maxReconnectAttempts) {
                    addConnectionLog('Máximo de tentativas de reconexão atingido');
                    reconnectAttempts = 0;
                }
            } else if (connection === 'open') {
                connectionStatus = 'connected';
                reconnectAttempts = 0;
                addConnectionLog('Conectado ao WhatsApp com sucesso!');
                qrCodeData = '';
                
                // Atualizar lista de grupos
                setTimeout(updateGroupsList, 2000);
            } else if (connection === 'connecting') {
                connectionStatus = 'connecting';
                addConnectionLog('Conectando...');
            }
        });

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('groups.update', async (updates) => {
            if (connectionStatus === 'connected') {
                addConnectionLog(`${updates.length} grupos atualizados`);
                await updateGroupsList();
            }
        });

        sock.ev.on('messaging-history.set', () => {
            addConnectionLog('Histórico de mensagens carregado');
        });

    } catch (error) {
        console.error('Erro na conexão:', error);
        connectionStatus = 'error';
        addConnectionLog(`Erro na conexão: ${error.message}`);
        
        // Tentar reconectar após erro
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(connectToWhatsApp, 10000);
        }
    }
}

// Função para adicionar logs de conexão
function addConnectionLog(message) {
    const log = {
        timestamp: new Date().toISOString(),
        message
    };
    connectionLogs.unshift(log);
    if (connectionLogs.length > 100) {
        connectionLogs = connectionLogs.slice(0, 100);
    }
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

// Função para atualizar lista de grupos
async function updateGroupsList() {
    try {
        if (!sock || connectionStatus !== 'connected') {
            addConnectionLog('Não é possível atualizar grupos - WhatsApp desconectado');
            return;
        }
        
        addConnectionLog('Buscando lista de grupos...');
        const groups = await sock.groupFetchAllParticipating();
        const groupsList = Object.values(groups).map(group => ({
            id: group.id,
            name: group.subject || 'Grupo sem nome',
            participantsCount: group.participants?.length || 0,
            isAdmin: group.participants?.some(p => 
                p.id === sock.user?.id && (p.admin === 'admin' || p.admin === 'superadmin')
            ) || false,
            description: group.desc || '',
            createdAt: group.creation ? new Date(group.creation * 1000).toISOString() : null
        }));
        
        await writeData('groups', groupsList);
        await updateStatistics('groups', groupsList.length);
        
        addConnectionLog(`${groupsList.length} grupos encontrados e salvos`);
        
    } catch (error) {
        console.error('Erro ao buscar grupos:', error);
        addConnectionLog(`Erro ao buscar grupos: ${error.message}`);
    }
}

// Função para enviar mensagem
async function sendMessage(groupId, text, imagePath = null) {
    try {
        if (!sock || connectionStatus !== 'connected') {
            throw new Error('WhatsApp não conectado');
        }

        if (!await checkAntiSpam(groupId)) {
            throw new Error('Limite de mensagens atingido para este grupo (anti-spam)');
        }

        let messageContent;
        
        if (imagePath) {
            try {
                const imageBuffer = await fs.readFile(imagePath);
                messageContent = {
                    image: imageBuffer,
                    caption: text || ''
                };
            } catch (imageError) {
                console.error('Erro ao ler imagem:', imageError);
                // Se falhar ao ler imagem, enviar só o texto
                messageContent = { text: text || 'Mensagem sem texto' };
            }
        } else {
            messageContent = { text: text || 'Mensagem sem texto' };
        }

        await sock.sendMessage(groupId, messageContent);
        await updateStatistics('sent');
        
        return true;
        
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        await updateStatistics('failed');
        throw error;
    }
}

// Função para agendar campanhas
function scheduleCampaign(campaign) {
    try {
        const { id, schedule } = campaign;
        
        // Remover agendamento anterior se existir
        if (scheduledJobs.has(id)) {
            scheduledJobs.get(id).stop();
            scheduledJobs.delete(id);
        }

        if (campaign.status !== 'active') return;

        let cronExpression = '';
        
        if (schedule.type === 'once') {
            const date = new Date(schedule.datetime);
            if (date <= new Date()) {
                addConnectionLog(`Campanha "${campaign.name}" tem data no passado - não será agendada`);
                return;
            }
            
            const minute = date.getMinutes();
            const hour = date.getHours();
            const day = date.getDate();
            const month = date.getMonth() + 1;
            cronExpression = `${minute} ${hour} ${day} ${month} *`;
            
        } else if (schedule.type === 'recurring') {
            const time = schedule.time.split(':');
            const minute = parseInt(time[1]);
            const hour = parseInt(time[0]);
            
            if (schedule.frequency === 'daily') {
                cronExpression = `${minute} ${hour} * * *`;
            } else if (schedule.frequency === 'weekly') {
                const days = schedule.daysOfWeek.join(',');
                cronExpression = `${minute} ${hour} * * ${days}`;
            }
        }

        if (cronExpression) {
            try {
                const job = cron.schedule(cronExpression, async () => {
                    await executeCampaign(campaign);
                }, {
                    scheduled: true,
                    timezone: 'America/Sao_Paulo'
                });

                scheduledJobs.set(id, job);
                addConnectionLog(`Campanha "${campaign.name}" agendada com sucesso`);
            } catch (cronError) {
                console.error('Erro ao agendar campanha:', cronError);
                addConnectionLog(`Erro ao agendar campanha "${campaign.name}": ${cronError.message}`);
            }
        }
    } catch (error) {
        console.error('Erro no agendamento:', error);
        addConnectionLog(`Erro no agendamento da campanha: ${error.message}`);
    }
}

// Função para executar campanha
async function executeCampaign(campaign) {
    try {
        if (campaign.status !== 'active' || connectionStatus !== 'connected') {
            addConnectionLog(`Campanha "${campaign.name}" não executada - status: ${campaign.status}, conexão: ${connectionStatus}`);
            return;
        }

        addConnectionLog(`Iniciando execução da campanha: ${campaign.name}`);
        
        const groups = await readData('groups');
        let successCount = 0;
        let failureCount = 0;

        for (const groupId of campaign.targetGroups) {
            const group = groups.find(g => g.id === groupId);
            if (!group) {
                failureCount++;
                continue;
            }

            try {
                await sendMessage(groupId, campaign.message, campaign.imagePath);
                successCount++;
                addConnectionLog(`Mensagem enviada para: ${group.name}`);
                
                // Delay entre envios para evitar spam
                await new Promise(resolve => setTimeout(resolve, 3000));
                
            } catch (error) {
                failureCount++;
                addConnectionLog(`Erro ao enviar para ${group.name}: ${error.message}`);
            }
        }

        // Atualizar estatísticas da campanha
        const campaigns = await readData('campaigns');
        const campaignIndex = campaigns.findIndex(c => c.id === campaign.id);
        if (campaignIndex !== -1) {
            if (!campaigns[campaignIndex].stats) {
                campaigns[campaignIndex].stats = { totalSent: 0, totalFailed: 0, executions: [] };
            }
            
            campaigns[campaignIndex].stats.totalSent += successCount;
            campaigns[campaignIndex].stats.totalFailed += failureCount;
            campaigns[campaignIndex].stats.executions.push({
                datetime: new Date().toISOString(),
                sent: successCount,
                failed: failureCount
            });

            // Manter apenas as últimas 10 execuções
            if (campaigns[campaignIndex].stats.executions.length > 10) {
                campaigns[campaignIndex].stats.executions = campaigns[campaignIndex].stats.executions.slice(-10);
            }

            await writeData('campaigns', campaigns);
        }

        addConnectionLog(`Campanha "${campaign.name}" concluída: ${successCount} enviados, ${failureCount} falharam`);

    } catch (error) {
        console.error('Erro na execução da campanha:', error);
        addConnectionLog(`Erro na execução da campanha "${campaign.name}": ${error.message}`);
    }
}

// Middleware para tratamento de erros
app.use((error, req, res, next) => {
    console.error('Erro no servidor:', error);
    res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Rotas da API

// Status da conexão
app.get('/api/connection/status', (req, res) => {
    res.json({
        status: connectionStatus,
        qrCode: qrCodeData,
        logs: connectionLogs.slice(0, 20),
        reconnectAttempts,
        maxReconnectAttempts
    });
});

// Conectar/Desconectar
app.post('/api/connection/connect', async (req, res) => {
    try {
        if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
            reconnectAttempts = 0;
            connectToWhatsApp();
            res.json({ success: true, message: 'Iniciando conexão...' });
        } else {
            res.json({ success: false, message: `Status atual: ${connectionStatus}` });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/connection/disconnect', async (req, res) => {
    try {
        if (sock) {
            await sock.logout();
        }
        
        // Parar todos os jobs agendados
        for (const job of scheduledJobs.values()) {
            job.stop();
        }
        scheduledJobs.clear();
        
        connectionStatus = 'disconnected';
        qrCodeData = '';
        reconnectAttempts = 0;
        addConnectionLog('Desconectado manualmente');
        
        res.json({ success: true, message: 'Desconectado com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Grupos
app.get('/api/groups', async (req, res) => {
    try {
        const groups = await readData('groups');
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/groups/refresh', async (req, res) => {
    try {
        if (connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp não conectado' });
        }
        
        await updateGroupsList();
        const groups = await readData('groups');
        res.json({ success: true, groups });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Campanhas
app.get('/api/campaigns', async (req, res) => {
    try {
        const campaigns = await readData('campaigns');
        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/campaigns', upload.single('image'), async (req, res) => {
    try {
        const campaigns = await readData('campaigns');
        
        // Validar dados
        if (!req.body.name || !req.body.message || !req.body.targetGroups || !req.body.schedule) {
            return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
        }

        const targetGroups = JSON.parse(req.body.targetGroups);
        const schedule = JSON.parse(req.body.schedule);

        if (!Array.isArray(targetGroups) || targetGroups.length === 0) {
            return res.status(400).json({ error: 'Pelo menos um grupo deve ser selecionado' });
        }

        const campaign = {
            id: Date.now().toString(),
            name: req.body.name.trim(),
            message: req.body.message.trim(),
            imagePath: req.file ? req.file.path : null,
            targetGroups: targetGroups,
            schedule: schedule,
            status: 'active',
            createdAt: new Date().toISOString(),
            stats: { totalSent: 0, totalFailed: 0, executions: [] }
        };

        campaigns.push(campaign);
        await writeData('campaigns', campaigns);
        await updateStatistics('campaign');
        
        // Agendar se necessário
        if (schedule.type !== 'now') {
            scheduleCampaign(campaign);
        } else {
            // Executar imediatamente
            setTimeout(() => executeCampaign(campaign), 1000);
        }
        
        res.json({ success: true, campaign });
    } catch (error) {
        console.error('Erro ao criar campanha:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/campaigns/:id', upload.single('image'), async (req, res) => {
    try {
        const campaigns = await readData('campaigns');
        const index = campaigns.findIndex(c => c.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        const updatedCampaign = {
            ...campaigns[index],
            name: req.body.name?.trim() || campaigns[index].name,
            message: req.body.message?.trim() || campaigns[index].message,
            targetGroups: req.body.targetGroups ? JSON.parse(req.body.targetGroups) : campaigns[index].targetGroups,
            schedule: req.body.schedule ? JSON.parse(req.body.schedule) : campaigns[index].schedule,
            updatedAt: new Date().toISOString()
        };

        if (req.file) {
            // Remover imagem antiga se existir
            if (campaigns[index].imagePath) {
                try {
                    await fs.unlink(campaigns[index].imagePath);
                } catch (error) {
                    console.error('Erro ao remover imagem antiga:', error);
                }
            }
            updatedCampaign.imagePath = req.file.path;
        }

        campaigns[index] = updatedCampaign;
        await writeData('campaigns', campaigns);
        
        // Reagendar
        if (updatedCampaign.status === 'active') {
            scheduleCampaign(updatedCampaign);
        }
        
        res.json({ success: true, campaign: updatedCampaign });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/campaigns/:id/status', async (req, res) => {
    try {
        const campaigns = await readData('campaigns');
        const index = campaigns.findIndex(c => c.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        campaigns[index].status = req.body.status;
        campaigns[index].updatedAt = new Date().toISOString();
        
        await writeData('campaigns', campaigns);
        
        // Reagendar ou parar
        if (req.body.status === 'active') {
            scheduleCampaign(campaigns[index]);
        } else if (scheduledJobs.has(req.params.id)) {
            scheduledJobs.get(req.params.id).stop();
            scheduledJobs.delete(req.params.id);
        }
        
        res.json({ success: true, campaign: campaigns[index] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/campaigns/:id', async (req, res) => {
    try {
        const campaigns = await readData('campaigns');
        const index = campaigns.findIndex(c => c.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        // Remover imagem se existir
        if (campaigns[index].imagePath) {
            try {
                await fs.unlink(campaigns[index].imagePath);
            } catch (error) {
                console.error('Erro ao remover imagem:', error);
            }
        }

        // Parar agendamento
        if (scheduledJobs.has(req.params.id)) {
            scheduledJobs.get(req.params.id).stop();
            scheduledJobs.delete(req.params.id);
        }

        campaigns.splice(index, 1);
        await writeData('campaigns', campaigns);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Estatísticas
app.get('/api/statistics', async (req, res) => {
    try {
        const stats = await readData('statistics');
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Configurações
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await readData('settings');
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/settings', async (req, res) => {
    try {
        await writeData('settings', req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        connection: connectionStatus,
        campaigns: scheduledJobs.size
    });
});

// Inicializar servidor
async function startServer() {
    try {
        await initializeDataStructure();
        
        // Criar diretórios necessários
        const dirs = ['uploads', 'auth_info', 'logs'];
        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
                console.log(`Diretório ${dir} criado`);
            }
        }
        
        // Recarregar campanhas agendadas
        const campaigns = await readData('campaigns');
        const activeCampaigns = campaigns.filter(c => c.status === 'active');
        activeCampaigns.forEach(campaign => {
            try {
                scheduleCampaign(campaign);
            } catch (error) {
                console.error(`Erro ao reagendar campanha ${campaign.name}:`, error);
            }
        });
        
        console.log(`${activeCampaigns.length} campanhas recarregadas`);
        
        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🚀 WA Divulgações - Sistema iniciado!');
            console.log(`📡 Servidor rodando na porta: ${PORT}`);
            console.log(`🌐 Acesse: http://localhost:${PORT}`);
            console.log(`📊 Campanhas ativas: ${activeCampaigns.length}`);
            console.log('='.repeat(50));
        });
        
        // Auto-conectar se houver sessão salva
        setTimeout(() => {
            addConnectionLog('Sistema iniciado - Verificando sessão salva...');
            connectToWhatsApp();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
    addConnectionLog(`Erro crítico: ${error.message}`);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promise rejeitada:', error);
    addConnectionLog(`Erro de promise: ${error.message}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando servidor...');
    
    // Parar todos os jobs agendados
    console.log(`⏹️  Parando ${scheduledJobs.size} campanhas agendadas...`);
    for (const job of scheduledJobs.values()) {
        try {
            job.stop();
        } catch (error) {
            console.error('Erro ao parar job:', error);
        }
    }
    scheduledJobs.clear();
    
    // Desconectar WhatsApp
    if (sock) {
        try {
            console.log('📱 Desconectando WhatsApp...');
            await sock.end();
        } catch (error) {
            console.error('Erro ao desconectar:', error);
        }
    }
    
    console.log('✅ Servidor encerrado com sucesso!');
    process.exit(0);
});

// Cleanup periódico
setInterval(async () => {
    try {
        // Limpar logs antigos
        if (connectionLogs.length > 200) {
            connectionLogs = connectionLogs.slice(0, 100);
        }
        
        // Limpar controle anti-spam antigo
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        
        for (const [groupId, data] of antiSpamControl.entries()) {
            if (data.lastReset < oneHourAgo) {
                antiSpamControl.delete(groupId);
            }
        }
    } catch (error) {
        console.error('Erro no cleanup:', error);
    }
}, 30 * 60 * 1000); // A cada 30 minutos

startServer();