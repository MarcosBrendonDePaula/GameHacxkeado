#!/usr/bin/env node

/**
 * Auto Unminify Script
 * Detecta automaticamente arquivos index-*.js e os desminifica
 * Renomeia source.js atual e cria novo source.js legível
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AutoUnminify {
    constructor() {
        this.projectDir = process.cwd();
        this.sourceFile = path.join(this.projectDir, 'source.js');
        this.indexPattern = /^index-.*\.js$/;
        this.prettier = null;
        this.isVerbose = false;
    }

    log(message, isVerbose = false) {
        if (!isVerbose || this.isVerbose) {
            console.log(`[AutoUnminify] ${message}`);
        }
    }

    error(message, exit = true) {
        console.error(`[ERROR] ${message}`);
        if (exit) process.exit(1);
    }

    async init() {
        this.log('Inicializando Auto Unminify...');
        await this.checkPrettier();
        return this;
    }

    async checkPrettier() {
        try {
            this.prettier = require('prettier');
            this.log('Prettier encontrado.', true);
        } catch (error) {
            this.log('Prettier não encontrado. Instalando...');
            try {
                execSync('npm install prettier --save-dev', {
                    stdio: 'inherit',
                    cwd: this.projectDir
                });
                this.prettier = require('prettier');
                this.log('Prettier instalado com sucesso!');
            } catch (installError) {
                this.error('Erro ao instalar Prettier: ' + installError.message);
            }
        }
    }

    findIndexFiles() {
        this.log('Procurando por arquivos index-*.js...', true);

        try {
            const files = fs.readdirSync(this.projectDir);
            const indexFiles = files.filter(file => this.indexPattern.test(file));

            this.log(`Encontrados ${indexFiles.length} arquivo(s): ${indexFiles.join(', ')}`, true);
            return indexFiles;
        } catch (error) {
            this.error('Erro ao ler diretório: ' + error.message);
            return [];
        }
    }

    getNewestIndexFile(indexFiles) {
        if (indexFiles.length === 0) return null;
        if (indexFiles.length === 1) return indexFiles[0];

        // Ordenar por data de modificação (mais recente primeiro)
        const filesWithStats = indexFiles.map(file => {
            const filePath = path.join(this.projectDir, file);
            const stats = fs.statSync(filePath);
            return { file, mtime: stats.mtime };
        });

        filesWithStats.sort((a, b) => b.mtime - a.mtime);
        return filesWithStats[0].file;
    }

    backupSourceFile() {
        this.log('Sistema de backup desabilitado - não será criado backup');
        return null;
    }

    async unminifyFile(inputFile) {
        const inputPath = path.join(this.projectDir, inputFile);

        this.log(`Lendo arquivo: ${inputFile}...`, true);

        try {
            const minifiedCode = fs.readFileSync(inputPath, 'utf8');
            this.log(`Tamanho do arquivo: ${(minifiedCode.length / 1024 / 1024).toFixed(2)} MB`, true);

            this.log('Desminificando código com Prettier...');

            const formattedCode = await this.prettier.format(minifiedCode, {
                parser: 'babel',
                printWidth: 120,
                tabWidth: 4,
                useTabs: false,
                semi: true,
                singleQuote: false,
                trailingComma: 'es5',
                bracketSpacing: true,
                arrowParens: 'always'
            });

            return formattedCode;
        } catch (error) {
            this.error('Erro ao processar arquivo: ' + error.message);
            return null;
        }
    }

    writeSourceFile(code) {
        try {
            fs.writeFileSync(this.sourceFile, code, 'utf8');
            this.log(`Novo source.js criado: ${(code.length / 1024 / 1024).toFixed(2)} MB`);
            return true;
        } catch (error) {
            this.error('Erro ao escrever source.js: ' + error.message, false);
            return false;
        }
    }

    async process(options = {}) {
        this.isVerbose = options.verbose || false;

        this.log('='.repeat(60));
        this.log('INICIANDO PROCESSO DE AUTO UNMINIFY');
        this.log('='.repeat(60));

        // 1. Encontrar arquivos index-*.js
        const indexFiles = this.findIndexFiles();
        if (indexFiles.length === 0) {
            this.error('Nenhum arquivo index-*.js encontrado!');
        }

        // 2. Selecionar o arquivo mais recente
        const targetFile = this.getNewestIndexFile(indexFiles);
        this.log(`Arquivo selecionado: ${targetFile}`);

        // 3. Pular backup (sistema desabilitado)
        const backupFile = this.backupSourceFile();

        // 4. Desminificar o arquivo
        const unminifiedCode = await this.unminifyFile(targetFile);
        if (!unminifiedCode) {
            this.error('Falha na desminificação!');
        }

        // 5. Escrever novo source.js
        const success = this.writeSourceFile(unminifiedCode);
        if (!success) {
            this.error('Falha ao escrever source.js!');
        }

        this.log('='.repeat(60));
        this.log('PROCESSO CONCLUÍDO COM SUCESSO!');
        this.log('='.repeat(60));
        this.log(`✅ Arquivo processado: ${targetFile}`);
        this.log(`✅ Novo source.js criado`);
        this.log(`✅ Tamanho: ${(unminifiedCode.length / 1024 / 1024).toFixed(2)} MB`);
    }

    // Método para usar apenas formatação (sem detectar arquivos)
    async formatFile(inputFile, outputFile) {
        this.log(`Formatando ${inputFile} -> ${outputFile}...`);

        const inputPath = path.join(this.projectDir, inputFile);
        const outputPath = path.join(this.projectDir, outputFile);

        if (!fs.existsSync(inputPath)) {
            this.error(`Arquivo não encontrado: ${inputFile}`);
        }

        const code = fs.readFileSync(inputPath, 'utf8');
        const formatted = await this.prettier.format(code, {
            parser: 'babel',
            printWidth: 120,
            tabWidth: 4,
            useTabs: false,
            semi: true,
            singleQuote: false,
            trailingComma: 'es5',
            bracketSpacing: true,
            arrowParens: 'always'
        });

        fs.writeFileSync(outputPath, formatted, 'utf8');
        this.log('Formatação concluída!');
    }

    // Método para listar arquivos disponíveis
    listFiles() {
        const indexFiles = this.findIndexFiles();

        console.log('\n=== Arquivos index-*.js encontrados ===');
        if (indexFiles.length === 0) {
            console.log('Nenhum arquivo encontrado.');
            return;
        }

        indexFiles.forEach((file, index) => {
            const filePath = path.join(this.projectDir, file);
            const stats = fs.statSync(filePath);
            const size = (stats.size / 1024 / 1024).toFixed(2);
            const date = stats.mtime.toLocaleString();
            console.log(`${index + 1}. ${file}`);
            console.log(`   Tamanho: ${size} MB`);
            console.log(`   Modificado: ${date}`);
            console.log('');
        });
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    const unminifier = await new AutoUnminify().init();

    switch (command) {
        case 'list':
        case 'ls':
            unminifier.listFiles();
            break;

        case 'format':
            if (args.length < 3) {
                console.log('Uso: node auto-unminify.js format <input-file> <output-file>');
                process.exit(1);
            }
            await unminifier.formatFile(args[1], args[2]);
            break;

        case 'verbose':
        case '-v':
            await unminifier.process({ verbose: true });
            break;

        case 'help':
        case '--help':
        case '-h':
            console.log(`
Auto Unminify Script - Desminificador automático de arquivos JavaScript

COMANDOS:
  node auto-unminify.js              - Executa o processo completo automaticamente
  node auto-unminify.js verbose      - Executa com saída detalhada
  node auto-unminify.js list         - Lista arquivos index-*.js disponíveis
  node auto-unminify.js format <in> <out> - Formata um arquivo específico
  node auto-unminify.js help         - Mostra esta ajuda

FUNCIONALIDADES:
  ✅ Detecta automaticamente arquivos index-*.js
  ✅ Seleciona o arquivo mais recente
  ⚠️  Sistema de backup DESABILITADO
  ✅ Desminifica usando Prettier
  ✅ Cria novo source.js legível
  ✅ Instala Prettier automaticamente se necessário

EXEMPLOS:
  node auto-unminify.js              # Processo automático
  node auto-unminify.js verbose      # Com detalhes
  node auto-unminify.js list         # Listar arquivos
  node auto-unminify.js format index-ABC.js my-source.js
            `);
            break;

        default:
            // Comando padrão - executa o processo completo
            await unminifier.process({ verbose: command === 'verbose' });
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    main().catch(error => {
        console.error('[FATAL ERROR]', error.message);
        process.exit(1);
    });
}

module.exports = AutoUnminify;