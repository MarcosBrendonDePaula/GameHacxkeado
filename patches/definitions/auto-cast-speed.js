/**
 * Auto Cast Speed Patch (Com Sistema de Configuração)
 *
 * Modifica os delays do auto cast usando o sistema central de configuração.
 * Usa window.__cfg() para obter delay configurável dinamicamente.
 *
 * Atualizado para source index-CCCcPKhO.js
 */

module.exports = {
    name: "Auto Cast Speed",
    description: "Modifica delays do auto cast usando sistema de configuração dinâmico",
    version: "3.0.0",
    author: "GameHacxkeado",

    // Substituições diretas no código
    replacements: [
        {
            description: "Autocast main delay (2s -> dynamic)",
            find: `if (!mt || !it.current) {
                fe(0);
                return;
            }
            const Sr = 2e3,
                jr = 50;`,
            replace: `if (!mt || !it.current) {
                fe(0);
                return;
            }
            const Sr = window.__cfg ? window.__cfg('autocast_delay', 2e3) : 2e3,
                jr = 50;`,
        },
    ],

    apply: (sourceCode) => {
        console.log('Aplicando Auto Cast Speed com sistema de configuração...');

        let modifiedCode = sourceCode;
        let modificationsCount = 0;

        const delayModificationCode = `
// ===== AUTO CAST DELAY MODIFIER =====
(function() {
    'use strict';

    function waitForConfig(callback) {
        if (typeof window.__cfg === 'function') {
            callback();
        } else {
            setTimeout(() => waitForConfig(callback), 100);
        }
    }

    function getAutocastDelay() {
        return window.__cfg('autocast_delay', 2000);
    }

    waitForConfig(() => {
        console.log('[AutoCast] Sistema iniciado');
        window.__cfg('autocast_delay', 2000);
        console.log(\`[AutoCast] Delay atual: \${getAutocastDelay()}ms\`);
        console.log('[AutoCast] Para alterar: window.__cfg.set("autocast_delay", NOVO_VALOR)');
        console.log('[AutoCast] Valores sugeridos: 50 (instant), 200 (ultra), 500 (rápido), 1000 (médio), 2000 (normal)');
    });

})();
// ===== FIM AUTO CAST DELAY MODIFIER =====
`;

        const eol = modifiedCode.includes('\r\n') ? '\r\n' : '\n';

        for (const { description, find, replace } of module.exports.replacements) {
            const findText = find.replace(/\n/g, eol);
            const replaceText = replace.replace(/\n/g, eol);

            if (modifiedCode.includes(replaceText)) {
                console.log(`[auto-cast-speed] ${description}: já aplicado`);
                continue;
            }

            if (modifiedCode.includes(findText)) {
                modifiedCode = modifiedCode.replace(findText, replaceText);
                modificationsCount++;
                console.log(`[auto-cast-speed] ${description}: aplicado`);
            } else {
                console.warn(`[auto-cast-speed] ${description}: padrão não encontrado`);
            }
        }

        modifiedCode = modifiedCode + '\n' + delayModificationCode;

        if (modificationsCount === 0) {
            console.log('[auto-cast-speed] Nenhum delay encontrado via substituição direta');
        } else {
            console.log(`[auto-cast-speed] ${modificationsCount} delays modificados para sistema dinâmico`);
        }

        console.log('✅ Auto Cast Speed aplicado com sistema de configuração!');
        return modifiedCode;
    },

    remove: (sourceCode) => {
        console.log('Removendo Auto Cast Speed...');

        const startMarker = '// ===== AUTO CAST DELAY MODIFIER =====';
        const endMarker = '// ===== FIM AUTO CAST DELAY MODIFIER =====';

        let modifiedCode = sourceCode;
        const eol = modifiedCode.includes('\r\n') ? '\r\n' : '\n';

        const startIndex = modifiedCode.indexOf(startMarker);
        const endIndex = modifiedCode.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1) {
            const beforeCode = modifiedCode.substring(0, startIndex);
            const afterCode = modifiedCode.substring(endIndex + endMarker.length);
            modifiedCode = beforeCode + afterCode.replace(/^\n+/, '');
        }

        for (const { find, replace } of module.exports.replacements.slice().reverse()) {
            const findText = find.replace(/\n/g, eol);
            const replaceText = replace.replace(/\n/g, eol);
            if (modifiedCode.includes(replaceText)) {
                modifiedCode = modifiedCode.replace(replaceText, findText);
            }
        }

        console.log('✅ Auto Cast Speed removido!');
        return modifiedCode;
    }
};
