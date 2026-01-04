#!/usr/bin/env node

/**
 * GameHacxkeado - Copy to Index Script
 * Copia source.js para o arquivo index-*.js encontrado na pasta
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔄 GameHacxkeado - Copy to Index');
console.log('==================================\n');

// Verificar se source.js existe
const sourceFile = 'source.js';
if (!fs.existsSync(sourceFile)) {
    console.log('❌ Erro: source.js não encontrado!');
    console.log('💡 Execute o unminify primeiro ou verifique se está na pasta correta.');
    process.exit(1);
}

// Procurar por arquivos index-*.js
console.log('🔍 Procurando arquivos index-*.js...');

const files = fs.readdirSync('.').filter(file =>
    file.startsWith('index-') && file.endsWith('.js')
);

if (files.length === 0) {
    console.log('❌ Nenhum arquivo index-*.js encontrado na pasta!');
    console.log('💡 Verifique se há arquivos com padrão index-[ID].js na pasta.');
    process.exit(1);
}

// Selecionar arquivo (usar o último se houver múltiplos)
let indexFile = files[files.length - 1];

if (files.length > 1) {
    console.log(`⚠️  Múltiplos arquivos index-*.js encontrados (${files.length} arquivos):`);
    files.forEach(file => console.log(`   ${file}`));
    console.log(`🎯 Usando o último encontrado: ${indexFile}\n`);
} else {
    console.log(`   Encontrado: ${indexFile}`);
}

// Mostrar informações dos arquivos
console.log('\n📊 Informações dos arquivos:');
const sourceStats = fs.statSync(sourceFile);
console.log(`   ${sourceFile}: ${(sourceStats.size / 1024 / 1024).toFixed(2)} MB`);

if (fs.existsSync(indexFile)) {
    const indexStats = fs.statSync(indexFile);
    console.log(`   ${indexFile}: ${(indexStats.size / 1024 / 1024).toFixed(2)} MB`);
}

console.log(`\n🎯 Arquivo destino: ${indexFile}`);

// Copiar source.js para index-*.js
console.log(`\n🔄 Copiando ${sourceFile} para ${indexFile}...`);

try {
    fs.copyFileSync(sourceFile, indexFile);
    console.log('✅ Cópia concluída com sucesso!');

    // Mostrar informações finais
    const finalStats = fs.statSync(indexFile);
    console.log('\n📊 Resultado:');
    console.log(`   ${indexFile}: ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n💡 Dicas:');
    console.log(`   • O arquivo ${indexFile} agora contém o código modificado`);
    console.log('   • Você pode usar este arquivo no jogo');

    console.log('\n🎉 Processo concluído!');

} catch (error) {
    console.log('❌ Erro ao copiar arquivo:', error.message);
    console.log('💡 Verifique permissões e espaço em disco.');
    process.exit(1);
}