#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Cores para output no terminal
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

class Installer {
    constructor() {
        this.projectRoot = process.cwd();
        this.errors = [];
        this.warnings = [];
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    success(message) {
        this.log(`✅ ${message}`, 'green');
    }

    error(message) {
        this.log(`❌ ${message}`, 'red');
        this.errors.push(message);
    }

    warning(message) {
        this.log(`⚠️  ${message}`, 'yellow');
        this.warnings.push(message);
    }

    info(message) {
        this.log(`ℹ️  ${message}`, 'blue');
    }

    async checkRequirements() {
        this.log('\n📋 Verificando pré-requisitos...', 'cyan');

        try {
            // Verificar Node.js
            const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
            const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
            
            if (majorVersion >= 16) {
                this.success(`Node.js ${nodeVersion} ✓`);
            } else {
                this.error(`Node.js ${nodeVersion} - Versão 16+ necessária`);
            }

            // Verificar NPM
            const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
            this.success(`NPM ${npmVersion} ✓`);

            // Verificar Git (opcional)
            try {
                const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
                this.success(`${gitVersion} ✓`);
            } catch {
                this.warning('Git não encontrado - Opcional para desenvolvimento');
            }

            // Verificar espaço em disco
            const stats = await fs.stat(this.projectRoot);
            this.success('Diretório de instalação acessível ✓');

        } catch (error) {
            this.error(`Erro na verificação de pré-requisitos: ${error.message}`);
        }
    }

    async createDirectoryStructure() {
        this.log('\n📁 Criando estrutura de diretórios...', 'cyan');

        const directories = [
            'data',
            'uploads',
            'logs',
            'backups',
            'temp',
            'public'
        ];

        for (const dir of directories) {
            const dirPath = path.join(this.projectRoot, dir);
            try {
                await fs.access(dirPath);
                this.info(`Diretório '${dir}' já existe`);
            } catch {
                await fs.mkdir(dirPath, { recursive: true });
                this.success(`Diretório '${dir}' criado`);
            }
        }
    }

    async createConfigFiles() {
        this.log('\n⚙️  Criando arquivos de configuração...', 'cyan');

        // Criar .env se não existir
        const envPath = path.join(this.projectRoot, '.env');
        try {
            await fs.access(envPath);
            this.info('Arquivo .env já existe - mantendo configurações atuais');
        } catch {
            const envExamplePath = path.join(this.projectRoot, '.env.example');
            try {
                const envExample = await fs.readFile(envExamplePath, 'utf8');
                await fs.writeFile(envPath, envExample);
                this.success('Arquivo .env criado a partir do .env.example');
            } catch {
                // Criar .env básico
                const basicEnv = `# Configurações básicas do WA Divulgações
PORT=3000
NODE_ENV=production
ANTI_SPAM_ENABLED=true
ANTI_SPAM_INTERVAL_MINUTES=30
ANTI_SPAM_MAX_MESSAGES_PER_GROUP=10
`;
                await fs.writeFile(envPath, basicEnv);
                this.success('Arquivo .env básico criado');
            }
        }

        // Criar arquivos JSON iniciais
        const dataFiles = {
            'data/campaigns.json': [],
            'data/groups.json': [],
            'data/settings.json': {
                antiSpam: {
                    enabled: true,
                    intervalMinutes: 30,
                    maxMessagesPerGroup: 10
                },
                security: {
                    maxReconnectAttempts: 5,
                    reconnectDelay: 30000
                },
                notifications: {
                    enabled: true,
                    showSuccess: true,
                    showErrors: true
                }
            },
            'data/statistics.json': {
                totalSent: 0,
                totalFailed: 0,
                totalGroups: 0,
                campaignsCreated: 0,
                dailyStats: {}
            }
        };

        for (const [filePath, defaultData] of Object.entries(dataFiles)) {
            const fullPath = path.join(this.projectRoot, filePath);
            try {
                await fs.access(fullPath);
                this.info(`${filePath} já existe`);
            } catch {
                await fs.writeFile(fullPath, JSON.stringify(defaultData, null, 2));
                this.success(`${filePath} criado`);
            }
        }
    }

    async installDependencies() {
        this.log('\n📦 Instalando dependências...', 'cyan');

        try {
            this.info('Executando npm install...');
            execSync('npm install', { 
                stdio: 'inherit',
                cwd: this.projectRoot
            });
            this.success('Dependências instaladas com sucesso');
        } catch (error) {
            this.error(`Erro na instalação de dependências: ${error.message}`);
            this.info('Tente executar manualmente: npm install');
        }
    }

    async setupPermissions() {
        this.log('\n🔒 Configurando permissões...', 'cyan');

        const directories = ['uploads', 'data', 'logs', 'backups'];

        for (const dir of directories) {
            const dirPath = path.join(this.projectRoot, dir);
            try {
                // Verificar se o diretório é writável
                await fs.access(dirPath, fs.constants.W_OK);
                this.success(`Permissões OK para '${dir}'`);
            } catch {
                this.warning(`Verifique permissões de escrita para '${dir}'`);
            }
        }
    }

    async createStartupScript() {
        this.log('\n🚀 Criando scripts de inicialização...', 'cyan');

        // Script para Windows
        const startBat = `@echo off
echo Iniciando WA Divulgacoes...
echo.
node server.js
pause
`;

        // Script para Linux/Mac
        const startSh = `#!/bin/bash
echo "Iniciando WA Divulgações..."
echo
node server.js
`;

        try {
            await fs.writeFile(path.join(this.projectRoot, 'start.bat'), startBat);
            await fs.writeFile(path.join(this.projectRoot, 'start.sh'), startSh);
            
            // Dar permissão de execução para Linux/Mac
            try {
                execSync('chmod +x start.sh', { cwd: this.projectRoot });
            } catch {
                // Ignorar erro em Windows
            }

            this.success('Scripts de inicialização criados (start.bat e start.sh)');
        } catch (error) {
            this.warning(`Erro ao criar scripts de inicialização: ${error.message}`);
        }
    }

    async runTests() {
        this.log('\n🧪 Executando testes básicos...', 'cyan');

        try {
            // Testar se o servidor inicia
            this.info('Testando inicialização do servidor...');
            
            // Importar e testar configurações
            const configPath = path.join(this.projectRoot, 'config.js');
            try {
                const config = require(configPath);
                if (config && config.config) {
                    this.success('Configurações carregadas corretamente');
                } else {
                    this.warning('Arquivo config.js não encontrado ou inválido');
                }
            } catch {
                this.info('Config.js será criado automaticamente na primeira execução');
            }

            // Testar estrutura de arquivos principais
            const requiredFiles = ['server.js', 'package.json'];
            for (const file of requiredFiles) {
                const filePath = path.join(this.projectRoot, file);
                try {
                    await fs.access(filePath);
                    this.success(`${file} encontrado`);
                } catch {
                    this.error(`${file} não encontrado - arquivo obrigatório`);
                }
            }

        } catch (error) {
            this.warning(`Erro nos testes: ${error.message}`);
        }
    }

    async showCompletionMessage() {
        this.log('\n🎉 Instalação concluída!', 'green');
        
        if (this.errors.length > 0) {
            this.log('\n❌ Erros encontrados:', 'red');
            this.errors.forEach(error => this.log(`   • ${error}`, 'red'));
        }

        if (this.warnings.length > 0) {
            this.log('\n⚠️  Avisos:', 'yellow');
            this.warnings.forEach(warning => this.log(`   • ${warning}`, 'yellow'));
        }

        this.log('\n📖 Próximos passos:', 'cyan');
        this.log('   1. Configure o arquivo .env conforme necessário', 'bright');
        this.log('   2. Execute: npm start', 'bright');
        this.log('   3. Acesse: http://localhost:3000', 'bright');
        this.log('   4. Conecte seu WhatsApp escaneando o QR Code', 'bright');

        this.log('\n📚 Documentação:', 'cyan');
        this.log('   • README.md - Guia completo de uso', 'bright');
        this.log('   • .env.example - Exemplos de configuração', 'bright');

        this.log('\n🆘 Suporte:', 'cyan');
        this.log('   • GitHub: https://github.com/wallyssondev/wa-divulgacoes', 'bright');
        this.log('   • Email: contato@wallyssonstudio.dev', 'bright');

        this.log('\n✨ Desenvolvido por Wallysson Studio Dv - 2025', 'green');
    }

    async install() {
        this.log('🚀 Instalador WA Divulgações v1.0.0', 'green');
        this.log('=' .repeat(50), 'blue');

        await this.checkRequirements();
        await this.createDirectoryStructure();
        await this.createConfigFiles();
        await this.installDependencies();
        await this.setupPermissions();
        await this.createStartupScript();
        await this.runTests();
        await this.showCompletionMessage();

        // Retornar status da instalação
        return {
            success: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings
        };
    }
}

// Executar instalação se chamado diretamente
if (require.main === module) {
    const installer = new Installer();
    installer.install().then(result => {
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Erro crítico na instalação:', error.message);
        process.exit(1);
    });
}

module.exports = Installer;