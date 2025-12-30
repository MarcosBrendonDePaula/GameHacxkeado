// Sistema Central de Configurações
// Cria window.__cfg() para gerenciamento dinâmico de configurações

module.exports = {
    name: "Config System",
    description: "Sistema central de configurações dinâmicas",
    version: "1.0.0",

    // Aplica o sistema de configuração
    apply: (sourceCode) => {
        console.log('Aplicando sistema central de configurações...');

        // Código do sistema de configuração
        const configSystemCode = `
// ===== SISTEMA CENTRAL DE CONFIGURAÇÃO =====
(function() {
    'use strict';

    // Storage central de configurações
    const CONFIG_STORAGE_KEY = 'gamehack_configs';
    const configs = {};

    // Carrega configurações salvas do localStorage
    function loadConfigs() {
        try {
            const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.assign(configs, parsed);
                console.log('[ConfigSystem] Configurações carregadas:', Object.keys(configs));
            }
        } catch (error) {
            console.warn('[ConfigSystem] Erro ao carregar configurações:', error);
        }
    }

    // Salva configurações no localStorage
    function saveConfigs() {
        try {
            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configs));
        } catch (error) {
            console.warn('[ConfigSystem] Erro ao salvar configurações:', error);
        }
    }

    // API principal: window.__cfg(key, defaultValue)
    function configAPI(key, defaultValue) {
        // Se não tem argumentos, retorna todas as configs
        if (arguments.length === 0) {
            return { ...configs };
        }

        // Se tem apenas key, retorna o valor
        if (arguments.length === 1) {
            return configs.hasOwnProperty(key) ? configs[key] : undefined;
        }

        // Se key não existe, cria com valor padrão
        if (!configs.hasOwnProperty(key)) {
            configs[key] = defaultValue;
            saveConfigs();
            console.log(\`[ConfigSystem] Criada configuração '\${key}' = \${defaultValue}\`);
        }

        return configs[key];
    }

    // API para definir valor: window.__cfg.set(key, value)
    configAPI.set = function(key, value) {
        const oldValue = configs[key];
        configs[key] = value;
        saveConfigs();
        console.log(\`[ConfigSystem] Configuração '\${key}' alterada: \${oldValue} → \${value}\`);
        return value;
    };

    // API para remover: window.__cfg.remove(key)
    configAPI.remove = function(key) {
        if (configs.hasOwnProperty(key)) {
            const value = configs[key];
            delete configs[key];
            saveConfigs();
            console.log(\`[ConfigSystem] Configuração '\${key}' removida (era: \${value})\`);
            return true;
        }
        return false;
    };

    // API para limpar tudo: window.__cfg.clear()
    configAPI.clear = function() {
        const count = Object.keys(configs).length;
        Object.keys(configs).forEach(key => delete configs[key]);
        saveConfigs();
        console.log(\`[ConfigSystem] Todas as configurações removidas (\${count} itens)\`);
    };

    // API para listar: window.__cfg.list()
    configAPI.list = function() {
        console.log('[ConfigSystem] Configurações ativas:');
        for (const [key, value] of Object.entries(configs)) {
            console.log(\`  \${key}: \${JSON.stringify(value)}\`);
        }
        return configs;
    };

    // Inicializar sistema
    loadConfigs();

    // Expor API globalmente
    window.__cfg = configAPI;

    console.log('[ConfigSystem] Sistema de configurações inicializado');
    console.log('[ConfigSystem] Uso: window.__cfg("nome", valorPadrao)');
    console.log('[ConfigSystem] APIs: __cfg.set(k,v), __cfg.remove(k), __cfg.clear(), __cfg.list()');

})();
// ===== FIM DO SISTEMA DE CONFIGURAÇÃO =====
`;

        // Encontra um local adequado para inserir no início do código
        const insertionPoint = sourceCode.indexOf('(function()') !== -1
            ? sourceCode.indexOf('(function()')
            : sourceCode.indexOf('!function(') !== -1
                ? sourceCode.indexOf('!function(')
                : 100; // Fallback para posição 100

        // Insere o sistema no início do código
        const modifiedCode = sourceCode.slice(0, insertionPoint) +
                            configSystemCode + '\n' +
                            sourceCode.slice(insertionPoint);

        console.log('✅ Sistema de configuração aplicado com sucesso!');
        return modifiedCode;
    },

    // Remove o sistema de configuração
    remove: (sourceCode) => {
        console.log('Removendo sistema central de configurações...');

        // Remove o bloco de código do sistema
        const startMarker = '// ===== SISTEMA CENTRAL DE CONFIGURAÇÃO =====';
        const endMarker = '// ===== FIM DO SISTEMA DE CONFIGURAÇÃO =====';

        const startIndex = sourceCode.indexOf(startMarker);
        const endIndex = sourceCode.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1) {
            const beforeSystem = sourceCode.substring(0, startIndex);
            const afterSystem = sourceCode.substring(endIndex + endMarker.length);

            // Remove quebras de linha extras
            const cleanedCode = beforeSystem + afterSystem.replace(/^\n+/, '');

            console.log('✅ Sistema de configuração removido com sucesso!');
            return cleanedCode;
        }

        console.warn('⚠️ Sistema de configuração não encontrado no código');
        return sourceCode;
    }
};