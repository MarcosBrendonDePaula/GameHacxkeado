/**
 * Auto Cast Speed Patch (Com Sistema de Configuração)
 *
 * Modifica os delays do auto cast usando o sistema central de configuração.
 * Usa window.__cfg() para obter delay configurável dinamicamente.
 */

module.exports = {
    name: "Auto Cast Speed",
    description: "Modifica delays do auto cast usando sistema de configuração dinâmico",
    version: "2.0.0",
    author: "GameHacxkeado",

    // Padrões para encontrar delays de auto cast
    patterns: {
        // Padrão principal: const varname = DELAY, outraVar = 50
        autocastConstant: /const\s+(\w+)\s*=\s*(\d+(?:e\d+)?)(?:\s*,?\s*\/\/[^\n]*)?[\s\n]*(\w+)\s*=\s*50/g,

        // Padrão de contexto específico do auto cast
        autocastContext: /if\s*\(!ft\s*\|\|\s*!xe\.current\)[\s\S]*?const\s+(\w+)\s*=\s*(\d+(?:e\d+)?)/g,

        // Padrão setInterval com delay
        intervalDelay: /const\s+(\w+)\s*=\s*(\d+(?:e\d+)?),[\s\S]{1,200}?setInterval\([^,]*?,\s*\1\)/g
    },

    // Função principal de aplicação
    apply: (sourceCode) => {
        console.log('Aplicando Auto Cast Speed com sistema de configuração...');

        let modifiedCode = sourceCode;
        let modificationsCount = 0;

        // Código a ser injetado para modificar delays dinamicamente
        const delayModificationCode = `
// ===== AUTO CAST DELAY MODIFIER =====
(function() {
    'use strict';

    // Aguardar sistema de configuração estar disponível
    function waitForConfig(callback) {
        if (typeof window.__cfg === 'function') {
            callback();
        } else {
            setTimeout(() => waitForConfig(callback), 100);
        }
    }

    // Função para pegar delay das configurações
    function getAutocastDelay() {
        // Configuração padrão: 500ms (velocidade normal)
        return window.__cfg('autocast_delay', 500);
    }

    // Intercepta e modifica os delays no código
    waitForConfig(() => {
        console.log('[AutoCast] Sistema iniciado');

        // Configurações padrão
        window.__cfg('autocast_delay', 500);

        console.log(\`[AutoCast] Delay atual: \${getAutocastDelay()}ms\`);
        console.log('[AutoCast] Para alterar: window.__cfg.set("autocast_delay", NOVO_VALOR)');
    });

})();
// ===== FIM AUTO CAST DELAY MODIFIER =====
`;

        // Procura pelos padrões de delay e substitui
        Object.entries(module.exports.patterns).forEach(([patternName, pattern]) => {
            const matches = [...modifiedCode.matchAll(pattern)];

            matches.forEach(match => {
                const originalDelay = Number(match[2]);

                // Verifica se é um delay de auto cast (50ms - 3000ms)
                if (originalDelay >= 50 && originalDelay <= 3000) {
                    const replacement = module.exports.createReplacement(match, patternName);
                    modifiedCode = modifiedCode.replace(match[0], replacement);
                    modificationsCount++;

                    console.log(`[auto-cast-speed] ${patternName}: ${originalDelay}ms → dinâmico`);
                }
            });
        });

        // Insere o código de modificação de delay no final (mais seguro)
        modifiedCode = modifiedCode + '\n' + delayModificationCode;

        if (modificationsCount === 0) {
            console.log('[auto-cast-speed] Nenhum delay encontrado - injetando sistema dinâmico');
        } else {
            console.log(`[auto-cast-speed] ${modificationsCount} delays modificados para sistema dinâmico`);
        }

        console.log('✅ Auto Cast Speed aplicado com sistema de configuração!');
        return modifiedCode;
    },

    // Cria replacement baseado no padrão
    createReplacement(match, patternName) {
        const fullMatch = match[0];
        const varName = match[1];
        const originalDelay = match[2];

        switch (patternName) {
            case 'autocastConstant':
                // Substitui o delay por uma chamada dinâmica
                return fullMatch.replace(
                    `${varName} = ${originalDelay}`,
                    `${varName} = window.__cfg ? window.__cfg('autocast_delay', 500) : 500 // Dynamic autocast delay`
                );

            case 'autocastContext':
            case 'intervalDelay':
            default:
                // Para outros padrões, substitui o número diretamente
                return fullMatch.replace(
                    originalDelay,
                    `(window.__cfg ? window.__cfg('autocast_delay', 500) : 500)`
                );
        }
    },

    // Função de remoção
    remove: (sourceCode) => {
        console.log('Removendo Auto Cast Speed...');

        // Remove o bloco do modificador de delay
        const startMarker = '// ===== AUTO CAST DELAY MODIFIER =====';
        const endMarker = '// ===== FIM AUTO CAST DELAY MODIFIER =====';

        let modifiedCode = sourceCode;

        const startIndex = modifiedCode.indexOf(startMarker);
        const endIndex = modifiedCode.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1) {
            const beforeCode = modifiedCode.substring(0, startIndex);
            const afterCode = modifiedCode.substring(endIndex + endMarker.length);
            modifiedCode = beforeCode + afterCode.replace(/^\n+/, '');
        }

        // Remove comentários e substitui chamadas dinâmicas por valor padrão
        modifiedCode = modifiedCode.replace(/ \/\/ Dynamic autocast delay/g, '');
        modifiedCode = modifiedCode.replace(
            /\(window\.__cfg \? window\.__cfg\('autocast_delay', (\d+)\) : (\d+)\)/g,
            '$1' // Usa o valor padrão
        );
        modifiedCode = modifiedCode.replace(
            /= window\.__cfg \? window\.__cfg\('autocast_delay', (\d+)\) : (\d+)/g,
            '= $1' // Usa o valor padrão
        );

        console.log('✅ Auto Cast Speed removido!');
        return modifiedCode;
    }
};