const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Utilitários para o sistema WA Divulgações
 */
class Utils {
    
    /**
     * Formatar data para exibição
     * @param {Date|string} date - Data para formatar
     * @param {string} format - Formato desejado ('full', 'date', 'time', 'datetime')
     * @returns {string} Data formatada
     */
    static formatDate(date, format = 'datetime') {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Data inválida';

        const options = {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };

        switch (format) {
            case 'date':
                delete options.hour;
                delete options.minute;
                delete options.second;
                break;
            case 'time':
                delete options.year;
                delete options.month;
                delete options.day;
                break;
            case 'full':
                options.weekday = 'long';
                break;
        }

        return d.toLocaleString('pt-BR', options);
    }

    /**
     * Gerar ID único
     * @param {number} length - Comprimento do ID
     * @returns {string} ID único
     */
    static generateId(length = 16) {
        return crypto.randomBytes(length).toString('hex').substring(0, length);
    }

    /**
     * Validar número de telefone do WhatsApp
     * @param {string} number - Número a validar
     * @returns {boolean} Verdadeiro se válido
     */
    static validateWhatsAppNumber(number) {
        // Remover caracteres especiais
        const cleaned = number.replace(/[^\d]/g, '');
        
        // Verificar se tem pelo menos 10 dígitos
        if (cleaned.length < 10 || cleaned.length > 15) {
            return false;
        }

        // Verificar padrões brasileiros
        if (cleaned.startsWith('55')) {
            return cleaned.length === 13 || cleaned.length === 14;
        }

        return true;
    }

    /**
     * Sanitizar nome de arquivo
     * @param {string} filename - Nome do arquivo
     * @returns {string} Nome sanitizado
     */
    static sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase()
            .substring(0, 100);
    }

    /**
     * Obter extensão do arquivo
     * @param {string} filename - Nome do arquivo
     * @returns {string} Extensão
     */
    static getFileExtension(filename) {
        return path.extname(filename).toLowerCase().replace('.', '');
    }

    /**
     * Verificar se arquivo é imagem válida
     * @param {string} filename - Nome do arquivo
     * @returns {boolean} Verdadeiro se for imagem válida
     */
    static isValidImage(filename) {
        const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const extension = this.getFileExtension(filename);
        return validExtensions.includes(extension);
    }

    /**
     * Formatear tamanho de arquivo
     * @param {number} bytes - Tamanho em bytes
     * @returns {string} Tamanho formatado
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Validar dados de campanha
     * @param {Object} campaign - Dados da campanha
     * @returns {Object} Resultado da validação
     */
    static validateCampaign(campaign) {
        const errors = [];

        // Validar nome
        if (!campaign.name || campaign.name.trim().length === 0) {
            errors.push('Nome da campanha é obrigatório');
        } else if (campaign.name.length > 100) {
            errors.push('Nome da campanha deve ter no máximo 100 caracteres');
        }

        // Validar mensagem
        if (!campaign.message || campaign.message.trim().length === 0) {
            errors.push('Mensagem é obrigatória');
        } else if (campaign.message.length > 4096) {
            errors.push('Mensagem deve ter no máximo 4096 caracteres');
        }

        // Validar grupos
        if (!campaign.targetGroups || campaign.targetGroups.length === 0) {
            errors.push('Pelo menos um grupo deve ser selecionado');
        } else if (campaign.targetGroups.length > 50) {
            errors.push('Máximo de 50 grupos por campanha');
        }

        // Validar agendamento
        if (campaign.schedule) {
            const scheduleValidation = this.validateSchedule(campaign.schedule);
            if (!scheduleValidation.valid) {
                errors.push(...scheduleValidation.errors);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validar agendamento
     * @param {Object} schedule - Dados do agendamento
     * @returns {Object} Resultado da validação
     */
    static validateSchedule(schedule) {
        const errors = [];

        if (!schedule.type) {
            errors.push('Tipo de agendamento é obrigatório');
            return { valid: false, errors };
        }

        switch (schedule.type) {
            case 'once':
                if (!schedule.datetime) {
                    errors.push('Data e hora são obrigatórias para agendamento único');
                } else {
                    const scheduledDate = new Date(schedule.datetime);
                    const now = new Date();
                    
                    if (scheduledDate <= now) {
                        errors.push('Data deve ser futura');
                    }

                    // Verificar se não é muito distante (1 ano)
                    const maxDate = new Date();
                    maxDate.setFullYear(maxDate.getFullYear() + 1);
                    
                    if (scheduledDate > maxDate) {
                        errors.push('Data não pode ser superior a 1 ano');
                    }
                }
                break;

            case 'recurring':
                if (!schedule.frequency) {
                    errors.push('Frequência é obrigatória para agendamento recorrente');
                } else if (!['daily', 'weekly'].includes(schedule.frequency)) {
                    errors.push('Frequência deve ser "daily" ou "weekly"');
                }

                if (!schedule.time) {
                    errors.push('Horário é obrigatório para agendamento recorrente');
                } else if (!/^\d{2}:\d{2}$/.test(schedule.time)) {
                    errors.push('Formato de horário inválido (HH:MM)');
                }

                if (schedule.frequency === 'weekly') {
                    if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
                        errors.push('Dias da semana são obrigatórios para frequência semanal');
                    } else {
                        const validDays = schedule.daysOfWeek.every(day => 
                            Number.isInteger(day) && day >= 0 && day <= 6
                        );
                        if (!validDays) {
                            errors.push('Dias da semana inválidos (0-6)');
                        }
                    }
                }
                break;

            case 'now':
                // Sem validações adicionais para envio imediato
                break;

            default:
                errors.push('Tipo de agendamento inválido');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Limpar texto de mensagem
     * @param {string} text - Texto a limpar
     * @returns {string} Texto limpo
     */
    static sanitizeMessage(text) {
        if (!text) return '';
        
        return text
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remover caracteres invisíveis
            .replace(/\s+/g, ' ') // Normalizar espaços
            .trim()
            .substring(0, 4096); // Limitar tamanho
    }

    /**
     * Calcular estatísticas de campanha
     * @param {Object} campaign - Dados da campanha
     * @returns {Object} Estatísticas calculadas
     */
    static calculateCampaignStats(campaign) {
        const stats = campaign.stats || { totalSent: 0, totalFailed: 0, executions: [] };
        
        const totalMessages = stats.totalSent + stats.totalFailed;
        const successRate = totalMessages > 0 ? (stats.totalSent / totalMessages) * 100 : 0;
        const lastExecution = stats.executions.length > 0 
            ? stats.executions[stats.executions.length - 1]
            : null;

        return {
            totalSent: stats.totalSent,
            totalFailed: stats.totalFailed,
            totalMessages,
            successRate: Math.round(successRate * 100) / 100,
            executionCount: stats.executions.length,
            lastExecution: lastExecution ? new Date(lastExecution.datetime) : null,
            averagePerExecution: stats.executions.length > 0 
                ? Math.round(totalMessages / stats.executions.length)
                : 0
        };
    }

    /**
     * Gerar relatório de estatísticas
     * @param {Object} statistics - Dados de estatísticas
     * @returns {Object} Relatório formatado
     */
    static generateStatsReport(statistics) {
        const totalMessages = statistics.totalSent + statistics.totalFailed;
        const successRate = totalMessages > 0 
            ? (statistics.totalSent / totalMessages) * 100 
            : 0;

        // Analisar dados diários dos últimos 30 dias
        const dailyStats = statistics.dailyStats || {};
        const last30Days = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayStats = dailyStats[dateStr] || { sent: 0, failed: 0 };
            last30Days.push({
                date: dateStr,
                sent: dayStats.sent,
                failed: dayStats.failed,
                total: dayStats.sent + dayStats.failed
            });
        }

        const last30DaysTotal = last30Days.reduce((sum, day) => sum + day.total, 0);
        const last7DaysTotal = last30Days.slice(-7).reduce((sum, day) => sum + day.total, 0);

        return {
            overview: {
                totalSent: statistics.totalSent,
                totalFailed: statistics.totalFailed,
                totalMessages,
                successRate: Math.round(successRate * 100) / 100,
                totalGroups: statistics.totalGroups,
                campaignsCreated: statistics.campaignsCreated
            },
            trends: {
                last30Days: last30DaysTotal,
                last7Days: last7DaysTotal,
                dailyAverage: Math.round(last30DaysTotal / 30),
                weeklyGrowth: last7DaysTotal > 0 && last30Days.slice(-14, -7).reduce((sum, day) => sum + day.total, 0) > 0
                    ? ((last7DaysTotal / last30Days.slice(-14, -7).reduce((sum, day) => sum + day.total, 0)) - 1) * 100
                    : 0
            },
            daily: last30Days,
            topPerformanceDays: last30Days
                .filter(day => day.total > 0)
                .sort((a, b) => b.total - a.total)
                .slice(0, 5)
        };
    }

    /**
     * Verificar saúde do sistema
     * @param {Object} systemData - Dados do sistema
     * @returns {Object} Status de saúde
     */
    static checkSystemHealth(systemData) {
        const health = {
            status: 'healthy',
            issues: [],
            warnings: [],
            recommendations: []
        };

        // Verificar conexão WhatsApp
        if (systemData.connectionStatus !== 'connected') {
            health.issues.push('WhatsApp desconectado');
            health.status = 'unhealthy';
        }

        // Verificar campanhas ativas
        const activeCampaigns = systemData.campaigns ? 
            systemData.campaigns.filter(c => c.status === 'active').length : 0;
        
        if (activeCampaigns === 0) {
            health.warnings.push('Nenhuma campanha ativa');
        } else if (activeCampaigns > 20) {
            health.warnings.push('Muitas campanhas ativas (>20)');
            health.recommendations.push('Considere pausar algumas campanhas para melhor performance');
        }

        // Verificar estatísticas
        if (systemData.statistics) {
            const failureRate = systemData.statistics.totalSent + systemData.statistics.totalFailed > 0
                ? (systemData.statistics.totalFailed / (systemData.statistics.totalSent + systemData.statistics.totalFailed)) * 100
                : 0;

            if (failureRate > 50) {
                health.issues.push('Taxa de falha alta (>50%)');
                health.status = 'warning';
                health.recommendations.push('Verifique a qualidade dos grupos e mensagens');
            } else if (failureRate > 20) {
                health.warnings.push('Taxa de falha moderada (>20%)');
                health.recommendations.push('Monitor as campanhas mais de perto');
            }
        }

        // Verificar uso de armazenamento
        if (systemData.uploadedFiles && systemData.uploadedFiles > 1000) {
            health.warnings.push('Muitos arquivos enviados');
            health.recommendations.push('Considere fazer limpeza de arquivos antigos');
        }

        // Determinar status final
        if (health.issues.length > 0) {
            health.status = 'unhealthy';
        } else if (health.warnings.length > 0) {
            health.status = 'warning';
        }

        return health;
    }

    /**
     * Limpar arquivos antigos
     * @param {string} directory - Diretório para limpar
     * @param {number} maxAge - Idade máxima em dias
     * @returns {Promise<number>} Número de arquivos removidos
     */
    static async cleanupOldFiles(directory, maxAge = 30) {
        try {
            const files = await fs.readdir(directory);
            let removedCount = 0;
            const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
            const now = Date.now();

            for (const file of files) {
                const filePath = path.join(directory, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() > maxAgeMs) {
                    await fs.unlink(filePath);
                    removedCount++;
                }
            }

            return removedCount;
        } catch (error) {
            console.error('Erro na limpeza de arquivos:', error);
            return 0;
        }
    }

    /**
     * Backup de dados
     * @param {string} dataDir - Diretório de dados
     * @param {string} backupDir - Diretório de backup
     * @returns {Promise<string>} Caminho do backup criado
     */
    static async createBackup(dataDir, backupDir) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `backup-${timestamp}`;
            const backupPath = path.join(backupDir, backupName);

            // Criar diretório de backup
            await fs.mkdir(backupPath, { recursive: true });

            // Copiar arquivos de dados
            const files = await fs.readdir(dataDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const sourcePath = path.join(dataDir, file);
                    const targetPath = path.join(backupPath, file);
                    const data = await fs.readFile(sourcePath);
                    await fs.writeFile(targetPath, data);
                }
            }

            // Criar arquivo de metadados
            const metadata = {
                created: new Date().toISOString(),
                version: '1.0.0',
                files: files.filter(f => f.endsWith('.json'))
            };

            await fs.writeFile(
                path.join(backupPath, 'metadata.json'),
                JSON.stringify(metadata, null, 2)
            );

            return backupPath;
        } catch (error) {
            throw new Error(`Erro ao criar backup: ${error.message}`);
        }
    }

    /**
     * Restaurar backup
     * @param {string} backupPath - Caminho do backup
     * @param {string} dataDir - Diretório de dados
     * @returns {Promise<boolean>} Sucesso da operação
     */
    static async restoreBackup(backupPath, dataDir) {
        try {
            // Verificar se backup existe
            const metadataPath = path.join(backupPath, 'metadata.json');
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

            // Fazer backup dos dados atuais
            const currentBackup = await this.createBackup(dataDir, path.join(dataDir, '..', 'restore-backups'));
            console.log(`Backup atual salvo em: ${currentBackup}`);

            // Restaurar arquivos
            for (const file of metadata.files) {
                const sourcePath = path.join(backupPath, file);
                const targetPath = path.join(dataDir, file);
                const data = await fs.readFile(sourcePath);
                await fs.writeFile(targetPath, data);
            }

            return true;
        } catch (error) {
            throw new Error(`Erro ao restaurar backup: ${error.message}`);
        }
    }

    /**
     * Validar configurações do sistema
     * @param {Object} settings - Configurações
     * @returns {Object} Resultado da validação
     */
    static validateSettings(settings) {
        const errors = [];

        // Validar anti-spam
        if (settings.antiSpam) {
            if (settings.antiSpam.intervalMinutes < 1 || settings.antiSpam.intervalMinutes > 1440) {
                errors.push('Intervalo anti-spam deve estar entre 1 e 1440 minutos');
            }
            
            if (settings.antiSpam.maxMessagesPerGroup < 1 || settings.antiSpam.maxMessagesPerGroup > 100) {
                errors.push('Máximo de mensagens por grupo deve estar entre 1 e 100');
            }
        }

        // Validar segurança
        if (settings.security) {
            if (settings.security.maxReconnectAttempts < 1 || settings.security.maxReconnectAttempts > 10) {
                errors.push('Máximo de tentativas de reconexão deve estar entre 1 e 10');
            }

            if (settings.security.reconnectDelay < 5000 || settings.security.reconnectDelay > 300000) {
                errors.push('Delay de reconexão deve estar entre 5000ms e 300000ms');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Log de sistema com timestamp
     * @param {string} level - Nível do log (info, warn, error)
     * @param {string} message - Mensagem
     * @param {Object} data - Dados adicionais
     */
    static log(level, message, data = null) {
        const timestamp = this.formatDate(new Date(), 'full');
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            data
        };

        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
        
        if (data) {
            console.log('Dados:', JSON.stringify(data, null, 2));
        }

        return logEntry;
    }

    /**
     * Delay/Sleep
     * @param {number} ms - Milissegundos para aguardar
     * @returns {Promise} Promise que resolve após o delay
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retry com backoff exponencial
     * @param {Function} fn - Função para tentar
     * @param {number} maxRetries - Máximo de tentativas
     * @param {number} baseDelay - Delay base em ms
     * @returns {Promise} Resultado da função
     */
    static async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }

                const delay = baseDelay * Math.pow(2, attempt - 1);
                this.log('warn', `Tentativa ${attempt} falhou, tentando novamente em ${delay}ms`, { error: error.message });
                await this.sleep(delay);
            }
        }
    }
}

module.exports = Utils;