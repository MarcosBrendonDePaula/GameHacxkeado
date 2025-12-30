#!/usr/bin/env node

/**
 * Script para testar padrões regex dos patches auto-cast e super-cast
 */

const fs = require('fs');

// Lê o arquivo source.js
const sourceContent = fs.readFileSync('source.js', 'utf8');

console.log('🔍 Testando padrões regex para Auto Cast Speed...\n');

// Padrões do auto-cast-speed
const autocastPatterns = {
    autocastWithFifty: /const\s+\w+\s*=\s*(\d+(?:e\d+)?),\s*\w+\s*=\s*50/g,
    reactUseEffectInterval: /reactExports\.useEffect\(\(\)\s*=>\s*\{[\s\S]{1,500}?const\s+\w+\s*=\s*(\d+(?:e\d+)?),[\s\S]{1,300}?setInterval/g,
    fiftyPattern: /=\s*(\d+(?:e\d+)?),[\s\S]{0,50}?=\s*50[\s\S]{0,200}?setInterval/g,
    fishingContext: /const\s+\w+\s*=\s*(\d+(?:e\d+)?),[\s\S]{0,100}?\w+\s*=\s*50[\s\S]{0,300}?(?:rotateBoatToTile|toggleTileFished)/g
};

// Testa cada padrão do auto-cast
for (const [name, pattern] of Object.entries(autocastPatterns)) {
    console.log(`📋 Padrão "${name}":`)
    const matches = [...sourceContent.matchAll(pattern)];

    if (matches.length === 0) {
        console.log('  ❌ Nenhuma correspondência encontrada');
    } else {
        matches.forEach((match, i) => {
            const delay = match[1];
            const context = match[0].substring(0, 100) + '...';
            console.log(`  ✅ Match ${i + 1}: Delay = ${delay}ms`);
            console.log(`     Contexto: ${context.replace(/\n/g, '\\n')}`);
        });
    }
    console.log('');
}

console.log('\n🚀 Testando padrões regex para Super Cast Speed...\n');

// Padrões do super-cast-speed
const supercastPatterns = {
    tapSoundWithToggle: /audioManager\.playTileTapSound\(\)[\s\S]{1,150}?toggleTileFished[\s\S]{1,100}?},\s*(\d+)\);/g,
    supercastInterval: /setInterval\(\(\)\s*=>\s*\{[\s\S]{1,500}?toggleTileFished[\s\S]{1,200}?},\s*(\d+)\);/g,
    boatRotateWithSound: /rotateBoatToTile[\s\S]{1,100}?audioManager\.playTileTapSound\(\)[\s\S]{1,100}?},\s*(\d+)\);/g,
    toggleFishedDelay: /toggleTileFished\([^)]+\)[\s\S]{0,50}?\);?\s*},\s*(\d{1,3})\);/g,
    useEffectSmallInterval: /reactExports\.useEffect\(\(\)\s*=>\s*\{[\s\S]{1,300}?setInterval\([\s\S]{1,500}?},\s*(\d{1,3})\);/g
};

// Testa cada padrão do super-cast
for (const [name, pattern] of Object.entries(supercastPatterns)) {
    console.log(`📋 Padrão "${name}":`)
    const matches = [...sourceContent.matchAll(pattern)];

    if (matches.length === 0) {
        console.log('  ❌ Nenhuma correspondência encontrada');
    } else {
        matches.forEach((match, i) => {
            const delay = match[1];
            const context = match[0].substring(0, 150) + '...';
            console.log(`  ✅ Match ${i + 1}: Delay = ${delay}ms`);
            console.log(`     Contexto: ${context.replace(/\n/g, '\\n')}`);
        });
    }
    console.log('');
}

console.log('\n🎯 Teste manual dos locais específicos identificados...\n');

// Teste específico para linha 232003 (auto cast)
const autocastLine = sourceContent.split('\n')[232002]; // linha 232003 (0-based)
console.log(`Linha 232003: ${autocastLine}`);

// Teste específico para linha 232065 (super cast)
const supercastLine = sourceContent.split('\n')[232064]; // linha 232065 (0-based)
console.log(`Linha 232065: ${supercastLine}`);

// Procura por padrões mais simples
console.log('\n🔍 Busca simples por delays...\n');

// Procura "const var = 1000, var = 50"
const simple1000Pattern = /const\s+\w+\s*=\s*1000,[\s\S]{0,50}?50/g;
const matches1000 = [...sourceContent.matchAll(simple1000Pattern)];
console.log(`Padrão "const var = 1000, ... 50": ${matches1000.length} matches`);

// Procura ", 200);" no contexto do super cast
const simple200Pattern = /},\s*200\);/g;
const matches200 = [...sourceContent.matchAll(simple200Pattern)];
console.log(`Padrão "}, 200);": ${matches200.length} matches`);
matches200.forEach((match, i) => {
    const lineNumber = sourceContent.substring(0, match.index).split('\n').length;
    console.log(`  Match ${i + 1} na linha ${lineNumber}`);
});