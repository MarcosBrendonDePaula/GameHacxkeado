#!/usr/bin/env node

const fs = require('fs');

// Lê o arquivo source.js
const sourceContent = fs.readFileSync('source.js', 'utf8');

console.log('🔍 Debug específico do Auto Cast Speed...\n');

// Padrões do auto-cast-speed
const patterns = {
    autocastWithFiftyRobust: /const\s+(\w+)\s*=\s*(\d+(?:e\d+)?)(?:\s*,?\s*\/\/[^\n]*)?[\s\n]*(\w+)\s*=\s*50/g,
    reactUseEffectInterval: /reactExports\.useEffect\(\(\)\s*=>\s*\{[\s\S]{1,500}?const\s+\w+\s*=\s*(\d+(?:e\d+)?),[\s\S]{1,300}?setInterval/g,
    fiftyPatternMultiline: /=\s*(\d+(?:e\d+)?)(?:\s*,?\s*\/\/[^\n]*)?[\s\n]*\w+\s*=\s*50/g,
    fishingContextRobust: /const\s+\w+\s*=\s*(\d+(?:e\d+)?)(?:[^\n]*\n)*[\s\S]{0,300}?(?:rotateBoatToTile|toggleTileFished)/g,
    modifiedByPatch: /(\d+)(?:\s*,?\s*)?\/\/[^\n]*Modified by auto-cast-speed patch/g
};

function isAutocastDelay(delay) {
    return delay >= 500 && delay <= 2000;
}

// Testa cada padrão
for (const [name, pattern] of Object.entries(patterns)) {
    console.log(`📋 Padrão "${name}":`);
    const matches = [...sourceContent.matchAll(pattern)];

    if (matches.length === 0) {
        console.log('  ❌ Nenhuma correspondência encontrada');
    } else {
        matches.forEach((match, i) => {
            console.log(`  ✅ Match ${i + 1}:`);
            console.log(`     Match completo:`, match[0].substring(0, 100).replace(/\n/g, '\\n') + '...');
            console.log(`     Grupos:`, match.slice(1));

            // Dependendo do padrão, o delay está em grupos diferentes
            let delayStr = '';
            if (name === 'autocastWithFiftyRobust') {
                delayStr = match[2]; // Grupo 2
            } else if (name === 'reactUseEffectInterval' || name === 'fiftyPatternMultiline' ||
                      name === 'fishingContextRobust' || name === 'modifiedByPatch') {
                delayStr = match[1]; // Grupo 1
            }

            const delay = Number(delayStr);
            const isValid = isAutocastDelay(delay);

            console.log(`     Delay string: "${delayStr}"`);
            console.log(`     Delay convertido: ${delay}ms`);
            console.log(`     É delay válido (500-2000ms)? ${isValid ? '✅ SIM' : '❌ NÃO'}`);
        });
    }
    console.log('');
}

// Busca específica por "2e3"
console.log('🎯 Busca específica por "2e3":');
const specificPattern = /2e3/g;
const matches2e3 = [...sourceContent.matchAll(specificPattern)];
console.log(`Encontrado ${matches2e3.length} ocorrências de "2e3"`);

matches2e3.forEach((match, i) => {
    const lineNumber = sourceContent.substring(0, match.index).split('\n').length;
    const line = sourceContent.split('\n')[lineNumber - 1];
    console.log(`  ${i + 1}. Linha ${lineNumber}: ${line.trim()}`);
});

// Teste de conversão
console.log('\n🧮 Teste de conversão:');
console.log(`parseInt("2e3") = ${parseInt("2e3")}`);
console.log(`Number("2e3") = ${Number("2e3")}`);
console.log(`parseFloat("2e3") = ${parseFloat("2e3")}`);