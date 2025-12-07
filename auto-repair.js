// 🔧 SISTEMA DE AUTO REPAIR - OBSERVER DO MODAL
// Adicionar este código no FINAL do source.js

(function() {
    let repairObserverActive = true;
    let lastRepairTime = 0;
    let repairObserver = null;

    // 👀 OBSERVER PARA DETECTAR MODAL DE REPARO
    function createRepairObserver() {
        return new MutationObserver((mutations) => {
            if (!repairObserverActive) return;

            // Verificar se auto repair está ativado
            if (!window.getConfig('auto_repair', false)) return;

            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Procurar pelo modal de reparo
                        const repairModal = findRepairModal(node);
                        if (repairModal) {
                            handleRepairModal(repairModal);
                        }
                    }
                });
            });
        });
    }

    // 🔍 ENCONTRAR MODAL DE REPARO
    function findRepairModal(element) {
        // Método 1: Verificar se o próprio elemento contém o texto
        if (element.textContent && element.textContent.includes('🔧 Repair Fishing Rod')) {
            console.log('🔧 Modal encontrado diretamente:', element);
            return element;
        }

        // Método 2: Verificar se é um div com estilo de modal
        if (element.tagName === 'DIV' && element.style) {
            const style = element.style;
            // Verificar se tem características de modal de overlay
            if (style.position === 'fixed' &&
                style.backgroundColor &&
                style.backgroundColor.includes('rgba')) {

                // Procurar pelo texto específico dentro do modal
                const repairText = element.querySelector('h2');
                if (repairText && repairText.textContent && repairText.textContent.includes('🔧 Repair Fishing Rod')) {
                    console.log('🔧 Modal encontrado por overlay:', element);
                    return element;
                }
            }
        }

        // Método 3: Procurar em elementos filhos
        if (element.querySelectorAll) {
            const h2Elements = element.querySelectorAll('h2');
            for (let h2 of h2Elements) {
                if (h2.textContent && h2.textContent.includes('🔧 Repair Fishing Rod')) {
                    // Buscar o container do modal (normalmente é o pai ou avô)
                    let modalContainer = h2;
                    let attempts = 0;
                    while (modalContainer && attempts < 10) {
                        if (modalContainer.style &&
                            (modalContainer.style.position === 'fixed' ||
                             modalContainer.style.backgroundColor)) {
                            console.log('🔧 Modal encontrado por h2:', modalContainer);
                            return modalContainer;
                        }
                        modalContainer = modalContainer.parentElement;
                        attempts++;
                    }
                    // Se não encontrou o container, retorna o próprio h2
                    return h2.parentElement || h2;
                }
            }
        }

        return null;
    }

    // ⚡ PROCESSAR MODAL DE REPARO
    function handleRepairModal(modal) {
        const now = Date.now();

        // Evitar spam (min 3 segundos entre tentativas)
        if (now - lastRepairTime < 3000) {
            console.log('🔧 Auto repair: Cooldown ativo, aguardando...', ((3000 - (now - lastRepairTime)) / 1000).toFixed(1) + 's');
            return;
        }

        console.log('🔧 Auto repair: Modal de reparo detectado! Processando...');

        // Debug: log do modal encontrado
        if (window.getConfig('debug_mode', false)) {
            console.log('🔧 DEBUG: Modal encontrado:', modal);
            console.log('🔧 DEBUG: HTML do modal:', modal.innerHTML);
        }

        // Pequeno delay para garantir que o modal carregou completamente
        setTimeout(() => {
            const repairButton = findRepairButton(modal);
            if (repairButton) {
                performAutoRepair(repairButton);
                lastRepairTime = now;
            } else {
                console.log('❌ Auto repair: Botão de reparo não encontrado no modal');

                // Debug adicional
                if (window.getConfig('debug_mode', false)) {
                    const allButtons = modal.querySelectorAll('button');
                    console.log('🔧 DEBUG: Botões encontrados no modal:', Array.from(allButtons).map(btn => btn.textContent));
                }
            }
        }, 1000); // Aumentei o delay para 1 segundo
    }

    // 🔍 ENCONTRAR BOTÃO DE REPARO
    function findRepairButton(modal) {
        // Método 1: Procurar por texto específico
        const buttons = modal.querySelectorAll('button');

        console.log(`🔧 Auto repair: Encontrados ${buttons.length} botões no modal`);

        for (let button of buttons) {
            const text = button.textContent;
            console.log('🔧 Analisando botão:', text);

            if (text && (text.includes('Fix Rod') || text.includes('0.99 USDC'))) {
                // Evitar botão Cancel
                if (!text.toLowerCase().includes('cancel')) {
                    console.log('✅ Auto repair: Botão de reparo encontrado:', text);
                    return button;
                }
            }
        }

        // Método 2: Procurar por classe específica (baseado no HTML que você mostrou)
        const orangeButton = modal.querySelector('.modal-button-orange');
        if (orangeButton) {
            console.log('✅ Auto repair: Botão encontrado por classe orange:', orangeButton.textContent);
            return orangeButton;
        }

        // Método 3: Procurar por botão que não seja Cancel
        for (let button of buttons) {
            const text = button.textContent;
            if (text && !text.toLowerCase().includes('cancel') && text.trim() !== '') {
                console.log('✅ Auto repair: Botão encontrado por exclusão (não-Cancel):', text);
                return button;
            }
        }

        // Método 4: Último recurso - pegar o segundo botão (assumindo que o primeiro é Cancel)
        if (buttons.length >= 2) {
            console.log('✅ Auto repair: Usando segundo botão como último recurso:', buttons[1].textContent);
            return buttons[1];
        }

        return null;
    }

    // 🔧 EXECUTAR AUTO REPAIR
    function performAutoRepair(button) {
        try {
            console.log('🔧 Auto repair: Executando reparo automático...');

            // Log de debug se ativo
            if (window.getConfig('debug_mode', false)) {
                console.log('🔧 DEBUG: Clicando no botão:', button);
                console.log('🔧 DEBUG: Texto do botão:', button.textContent);
                console.log('🔧 DEBUG: Classes do botão:', button.className);
            }

            // Verificar se o botão não está desabilitado
            if (button.disabled) {
                console.log('⚠️ Auto repair: Botão está desabilitado, aguardando...');
                return;
            }

            // Simular clique completo do usuário
            button.focus();

            // Disparar eventos de mouse para simular clique real
            const mouseEvents = ['mousedown', 'mouseup', 'click'];
            mouseEvents.forEach(eventType => {
                const event = new MouseEvent(eventType, {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    buttons: 1
                });
                button.dispatchEvent(event);
            });

            console.log('✅ Auto repair: Reparo iniciado automaticamente!');

            // Mostrar notificação visual
            showRepairNotification();

        } catch (error) {
            console.error('❌ Auto repair: Erro ao executar reparo:', error);

            // Fallback: tentar clique direto
            try {
                button.click();
                console.log('✅ Auto repair: Fallback click executado!');
            } catch (fallbackError) {
                console.error('❌ Auto repair: Fallback também falhou:', fallbackError);
            }
        }
    }

    // 📢 NOTIFICAÇÃO VISUAL
    function showRepairNotification() {
        try {
            // Remover notificação anterior se existir
            const existingNotification = document.getElementById('auto-repair-notification');
            if (existingNotification) {
                document.body.removeChild(existingNotification);
            }

            // Criar notificação temporária
            const notification = document.createElement('div');
            notification.id = 'auto-repair-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #FF9800, #F57C00);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                z-index: 999999;
                font-weight: bold;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                border: 2px solid rgba(255,255,255,0.3);
                font-family: 'Arial', sans-serif;
                font-size: 14px;
                animation: slideIn 0.3s ease-out;
            `;

            // Adicionar CSS de animação
            if (!document.getElementById('auto-repair-styles')) {
                const styles = document.createElement('style');
                styles.id = 'auto-repair-styles';
                styles.textContent = `
                    @keyframes slideIn {
                        from {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                `;
                document.head.appendChild(styles);
            }

            notification.textContent = '🔧 Auto repair executado!';
            document.body.appendChild(notification);

            // Remover após 4 segundos
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    notification.style.animation = 'slideIn 0.3s ease-out reverse';
                    setTimeout(() => {
                        if (document.body.contains(notification)) {
                            document.body.removeChild(notification);
                        }
                    }, 300);
                }
            }, 4000);

        } catch (error) {
            // Falhou silenciosamente se não conseguir mostrar notificação
            console.log('⚠️ Não foi possível mostrar notificação visual');
        }
    }

    // 🚀 INICIALIZAR OBSERVER
    function startRepairObserver() {
        try {
            if (repairObserver) {
                repairObserver.disconnect();
            }

            repairObserver = createRepairObserver();
            repairObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log('👀 Auto repair observer ativo! Modal será detectado automaticamente.');

        } catch (error) {
            console.error('❌ Erro ao inicializar observer de auto repair:', error);
        }
    }

    // 🛑 PARAR OBSERVER (função global para debug)
    window.stopRepairObserver = function() {
        repairObserverActive = false;
        if (repairObserver) {
            repairObserver.disconnect();
        }
        console.log('🛑 Auto repair observer desativado.');
    };

    // ▶️ REATIVAR OBSERVER (função global para debug)
    window.startRepairObserver = function() {
        repairObserverActive = true;
        startRepairObserver();
    };

    // 🧪 FUNÇÃO DE TESTE (função global para debug)
    window.testRepairDetection = function() {
        console.log('🧪 Testando detecção de modal de reparo...');

        // Procurar modal existente
        const modals = document.querySelectorAll('div');
        let found = false;

        modals.forEach(modal => {
            if (modal.textContent && modal.textContent.includes('🔧 Repair Fishing Rod')) {
                console.log('🔧 Modal encontrado manualmente:', modal);
                handleRepairModal(modal);
                found = true;
            }
        });

        if (!found) {
            console.log('❌ Nenhum modal de reparo encontrado no momento.');
        }
    };

    // 🎯 LISTENER PARA MUDANÇAS NA CONFIGURAÇÃO AUTO_REPAIR
    window.addEventListener('configChanged', function(e) {
        const { key, value } = e.detail;

        if (key === 'auto_repair') {
            if (value) {
                console.log('🔧 Auto repair ativado! Modal será monitorado.');
                if (!repairObserverActive) {
                    window.startRepairObserver();
                }
            } else {
                console.log('🔧 Auto repair desativado.');
            }
        }
    });

    // 🚀 INICIALIZAR AUTOMATICAMENTE
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startRepairObserver);
    } else {
        startRepairObserver();
    }

    console.log('🔧 Sistema de Auto Repair carregado! Observer monitorando DOM...');
    console.log('🧪 Use window.testRepairDetection() para testar manualmente.');

})();

// 🏁 FIM DO SISTEMA DE AUTO REPAIR