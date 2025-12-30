#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

console.log('🔄 GameHacxkeado Auto Update System');
console.log('=====================================');

const CONFIG = {
    siteUrl: 'https://app.fogofishing.com/',
    targetDir: './',
    sourceFile: 'source.js',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Função para fazer requisições HTTPS
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': CONFIG.userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache'
            }
        };

        https.get(url, options, (res) => {
            let data = '';

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// Função para baixar arquivo binário
function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': CONFIG.userAgent,
                'Accept': '*/*',
                'Referer': CONFIG.siteUrl
            }
        };

        const file = fs.createWriteStream(destination);

        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            let totalSize = 0;
            const contentLength = parseInt(res.headers['content-length'] || '0');

            res.on('data', (chunk) => {
                totalSize += chunk.length;
                if (contentLength > 0) {
                    const progress = Math.round((totalSize / contentLength) * 100);
                    process.stdout.write(`\r📥 Baixando... ${progress}% (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
                }
            });

            res.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`\n✅ Arquivo baixado: ${destination}`);
                resolve();
            });

            file.on('error', (err) => {
                fs.unlinkSync(destination);
                reject(err);
            });

        }).on('error', reject);
    });
}

// Função para extrair nome do arquivo JS da página
async function getJSFileName() {
    console.log('🔍 Detectando arquivo JavaScript atual...');

    try {
        const html = await httpsGet(CONFIG.siteUrl);

        // Buscar por padrões de script com assets
        const patterns = [
            /<script[^>]*src="\/assets\/(index-[^"]+\.js)"/i,
            /<script[^>]*src="\.\/assets\/(index-[^"]+\.js)"/i,
            /<script[^>]*src="([^"]*index-[^"]*\.js)"/i
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                const fileName = match[1];
                console.log(`📄 Arquivo detectado: ${fileName}`);
                return fileName;
            }
        }

        // Fallback: buscar qualquer arquivo JS em assets
        const fallbackMatch = html.match(/<script[^>]*src="\/assets\/([^"]+\.js)"/i);
        if (fallbackMatch) {
            const fileName = fallbackMatch[1];
            console.log(`📄 Arquivo detectado (fallback): ${fileName}`);
            return fileName;
        }

        throw new Error('Nenhum arquivo JavaScript encontrado na página');

    } catch (error) {
        console.error('❌ Erro ao acessar o site:', error.message);
        throw error;
    }
}

// Função para criar backup do source.js atual
function createBackup() {
    const sourceFile = CONFIG.sourceFile;

    if (!fs.existsSync(sourceFile)) {
        console.log('ℹ️  Arquivo source.js não existe, pularemos o backup');
        return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `old-source-${timestamp}.js`;

    console.log('💾 Criando backup do source.js atual...');
    fs.copyFileSync(sourceFile, backupName);
    console.log(`✅ Backup criado: ${backupName}`);

    return backupName;
}

// Função para verificar se o Node.js auto-unminify está disponível
function checkUnminifySystem() {
    const unminifyFile = './auto-unminify.js';

    if (!fs.existsSync(unminifyFile)) {
        console.error('❌ Arquivo auto-unminify.js não encontrado!');
        console.log('💡 Certifique-se de estar na pasta raiz do projeto GameHacxkeado');
        return false;
    }

    return true;
}

// Função para executar o unminify usando o módulo diretamente
async function runUnminify(inputFile) {
    console.log('🔄 Executando unminify automático...');

    try {
        // Importar e usar o módulo AutoUnminify diretamente
        const AutoUnminify = require('./auto-unminify.js');

        const unminifier = new AutoUnminify();
        await unminifier.init();

        // Usar o método formatFile para converter o arquivo baixado em source.js
        await unminifier.formatFile(inputFile, 'source.js');

        console.log('✅ Unminify concluído!');
        return true;

    } catch (error) {
        console.error('❌ Erro no unminify:');
        console.error(error.message);
        return false;
    }
}

// Função para verificar se houve mudanças
function checkForChanges(downloadedFile) {
    if (!fs.existsSync(CONFIG.sourceFile)) {
        console.log('ℹ️  Primeira vez executando, source.js será criado');
        return true;
    }

    const existingSize = fs.statSync(CONFIG.sourceFile).size;
    const newSize = fs.statSync(downloadedFile).size;

    console.log(`📊 Comparando arquivos:`);
    console.log(`   Atual: ${(existingSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Novo:  ${(newSize / 1024 / 1024).toFixed(2)} MB`);

    // Se os tamanhos forem muito diferentes, provavelmente há mudanças
    const sizeDiff = Math.abs(existingSize - newSize) / existingSize;

    if (sizeDiff > 0.01) { // Mais de 1% de diferença
        console.log('🔄 Mudanças detectadas no tamanho do arquivo');
        return true;
    }

    // Comparação simples de hash (primeiros/últimos bytes)
    try {
        const existingStart = fs.readFileSync(CONFIG.sourceFile, { start: 0, end: 1000 });
        const newStart = fs.readFileSync(downloadedFile, { start: 0, end: 1000 });

        if (!existingStart.equals(newStart)) {
            console.log('🔄 Mudanças detectadas no conteúdo do arquivo');
            return true;
        }

        console.log('ℹ️  Nenhuma mudança significativa detectada');
        return false;

    } catch (error) {
        console.log('⚠️  Erro na comparação, assumindo que há mudanças');
        return true;
    }
}

// Função principal
async function main() {
    try {
        // Verificações iniciais
        if (!checkUnminifySystem()) {
            process.exit(1);
        }

        // Detectar nome do arquivo JS atual
        const jsFileName = await getJSFileName();
        const downloadUrl = `${CONFIG.siteUrl}assets/${jsFileName}`;
        const tempFile = `temp-${jsFileName}`;

        console.log(`🌐 URL de download: ${downloadUrl}`);

        // Baixar arquivo
        console.log('⬇️  Iniciando download...');
        await downloadFile(downloadUrl, tempFile);

        // Verificar se houve mudanças
        if (!checkForChanges(tempFile)) {
            console.log('✨ Arquivo já está atualizado!');
            fs.unlinkSync(tempFile);
            return;
        }

        // Criar backup
        const backupFile = createBackup();

        // Executar unminify
        const unminifySuccess = await runUnminify(tempFile);

        if (unminifySuccess) {
            console.log('🎉 Update concluído com sucesso!');
            console.log(`📄 Novo arquivo: ${CONFIG.sourceFile}`);

            if (backupFile) {
                console.log(`💾 Backup anterior: ${backupFile}`);
            }

            // Limpar arquivo temporário
            fs.unlinkSync(tempFile);

        } else {
            console.error('❌ Falha no unminify. Restaurando backup...');

            if (backupFile) {
                fs.copyFileSync(backupFile, CONFIG.sourceFile);
                console.log('✅ Backup restaurado');
            }

            process.exit(1);
        }

    } catch (error) {
        console.error('💥 Erro no processo de update:', error.message);
        process.exit(1);
    }
}

// Verificar argumentos da linha de comando
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔄 GameHacxkeado Auto Update System

Uso:
    node auto-update.js                 # Update normal
    node auto-update.js --force         # Forçar update mesmo sem mudanças
    node auto-update.js --check         # Apenas verificar por updates
    node auto-update.js --help          # Mostrar esta ajuda

Funcionalidades:
    ✅ Detecta automaticamente arquivo JS atual do site
    ✅ Baixa apenas se houver mudanças
    ✅ Backup automático do source.js atual
    ✅ Integração com sistema unminify existente
    ✅ Rollback automático em caso de erro

Arquivos gerados:
    source.js                           # Código unminified atualizado
    old-source-TIMESTAMP.js             # Backup da versão anterior
`);
    process.exit(0);
}

if (args.includes('--check')) {
    console.log('🔍 Verificando por updates...');

    getJSFileName()
        .then(fileName => {
            console.log(`📄 Arquivo atual no site: ${fileName}`);

            // Verificar se temos esse arquivo já baixado
            const existingFiles = fs.readdirSync('.').filter(f => f.startsWith('index-') && f.endsWith('.js'));

            if (existingFiles.includes(fileName)) {
                console.log('✅ Arquivo já baixado localmente');
            } else {
                console.log('🆕 Novo arquivo disponível para download');
            }
        })
        .catch(error => {
            console.error('❌ Erro ao verificar updates:', error.message);
            process.exit(1);
        });
} else {
    // Executar update normal
    main();
}