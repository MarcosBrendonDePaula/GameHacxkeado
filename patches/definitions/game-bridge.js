/**
 * Game External Bridge Patch
 *
 * Injeta um efeito no GameView para expor window.__game com dados dinâmicos e ações
 * controláveis externamente. O patch tenta detectar automaticamente os nomes das variáveis
 * relevantes para continuar funcionando mesmo quando o bundler renomeia tudo.
 */

const BRIDGE_MARKER = "// ===== GAME EXTERNAL BRIDGE =====";
const BRIDGE_REGEX = /\s*\/\/ ===== GAME EXTERNAL BRIDGE =====[\s\S]*?\/\/ ===== END GAME EXTERNAL BRIDGE =====\s*/;
const REPAIR_CONTROLLER_MARKER = "// ===== REPAIR MODAL CONTROLLER =====";
const REPAIR_CONTROLLER_REGEX =
    /\s*\/\/ ===== REPAIR MODAL CONTROLLER =====[\s\S]*?\/\/ ===== END REPAIR MODAL CONTROLLER =====\s*/;

function getGameViewBlock(source) {
    const start = source.indexOf("GameView = () => {");
    if (start === -1) throw new Error("[game-bridge] GameView não encontrado");
    const end = source.indexOf("AppRoutes =", start);
    if (end === -1) throw new Error("[game-bridge] AppRoutes não encontrado após GameView");
    return { start, end, block: source.slice(start, end) };
}

function matchOnce(regex, text, label) {
    const match = regex.exec(text);
    if (!match) throw new Error(`[game-bridge] Não foi possível localizar ${label}`);
    return match;
}

function captureModalPairs(boolBlock) {
    const matches = [...boolBlock.matchAll(/\[([A-Za-z0-9_$]+),\s*([A-Za-z0-9_$]+)\]\s*=\s*reactExports\.useState\(!1\)/g)];
    if (matches.length < 6) throw new Error("[game-bridge] Não encontrei as 6 variáveis básicas de modal");
    return {
        initialization: { state: matches[0][1], setter: matches[0][2] },
        upgrade: { state: matches[1][1], setter: matches[1][2] },
        repair: { state: matches[2][1], setter: matches[2][2] },
        supercast: { state: matches[3][1], setter: matches[3][2] },
        process: { state: matches[4][1], setter: matches[4][2] },
        session: { state: matches[5][1], setter: matches[5][2] },
    };
}

function collectIdentifiers(block) {
    const sessionVar = matchOnce(/const\s+(\w+)\s*=\s*useSession\(\)/, block, "useSession")[1];
    const fogoMatch = matchOnce(/\{\s*program:\s*(\w+),\s*walletPublicKey:\s*(\w+)\s*\}\s*=\s*useFogoProgram\(\)/, block, "useFogoProgram");
    const playerMatch = matchOnce(
        /\{\s*globalState:\s*(\w+),\s*playerState:\s*(\w+),\s*loading:\s*(\w+),\s*refresh:\s*(\w+),\s*setPlayerStateFromDecoded:\s*(\w+),\s*setGlobalStateFromDecoded:\s*(\w+),\s*globalStatePda:\s*(\w+),\s*playerStatePda:\s*(\w+)[^}]*\}\s*=\s*usePlayerState\(\)/,
        block,
        "usePlayerState"
    );
    const detectedMatch = matchOnce(/,\s*(\w+)\s*=\s*useDetectedWalletPublicKey\(\)/, block, "useDetectedWallet");
    const referrerMatch = matchOnce(/\{\s*referrerPublicKey:\s*(\w+)\s*\}\s*=\s*useReferral\(\)/, block, "useReferral");
    const referralIndex = referrerMatch.index + referrerMatch[0].length;
    // Use a larger window (1200 chars) and no hardcoded boundary
    const boolBlock = block.slice(referralIndex, referralIndex + 1200);
    const modals = captureModalPairs(boolBlock);
    const devHudMatch = matchOnce(/\[([A-Za-z0-9_$]+),\s*([A-Za-z0-9_$]+)\]\s*=\s*reactExports\.useState\(DEV_MODE\)/, block, "dev HUD state");
    const mismatchPairMatch = matchOnce(
        /\[([A-Za-z0-9_$]+),\s*([A-Za-z0-9_$]+)\]\s*=\s*reactExports\.useState\(!1\),\s*\[([A-Za-z0-9_$]+),\s*([A-Za-z0-9_$]+)\]\s*=\s*reactExports\.useState\(\{\s*sessionWallet:/,
        block,
        "wallet mismatch state"
    );
    const tailMatch = matchOnce(
        /\[([A-Za-z0-9_$]+),\s*([A-Za-z0-9_$]+)\]\s*=\s*reactExports\.useState\(!1\),\s*\[([A-Za-z0-9_$]+),\s*([A-Za-z0-9_$]+)\]\s*=\s*reactExports\.useState\(!1\),\s*\[([A-Za-z0-9_$]+),\s*([A-Za-z0-9_$]+)\]\s*=\s*reactExports\.useState\(!1\),\s*(\w+)\s*=/,
        block,
        "flag tail states"
    );
    return {
        session: sessionVar,
        program: fogoMatch[1],
        wallet: fogoMatch[2],
        globalState: playerMatch[1],
        playerState: playerMatch[2],
        loading: playerMatch[3],
        refresh: playerMatch[4],
        setPlayerState: playerMatch[5],
        setGlobalState: playerMatch[6],
        globalPda: playerMatch[7],
        playerPda: playerMatch[8],
        detectedWallet: detectedMatch[1],
        referrer: referrerMatch[1],
        modals,
        devHud: { state: devHudMatch[1], setter: devHudMatch[2] },
        mismatchFlag: mismatchPairMatch[1],
        mismatchSetter: mismatchPairMatch[2],
        mismatchInfo: mismatchPairMatch[3],
        mismatchInfoSetter: mismatchPairMatch[4],
        hasEver: tailMatch[1],
        hasEverSetter: tailMatch[2],
        ready: tailMatch[3],
        readySetter: tailMatch[4],
        demoMode: tailMatch[5],
        demoSetter: tailMatch[6],
    };
}

function buildBridgeBlock(ctx, eol) {
    const indent = "            ";
    const mismatchSetterId = ctx.mismatchSetter || "null";
    const mismatchInfoSetterId = ctx.mismatchInfoSetter || "null";
    const hasEverSetterId = ctx.hasEverSetter || "null";
    const readySetterId = ctx.readySetter || "null";
    const demoSetterId = ctx.demoSetter || "null";
    const modalHandlers = `const modalHandlers = {
        initialization: ${ctx.modals.initialization.setter},
        upgrade: ${ctx.modals.upgrade.setter},
        repair: ${ctx.modals.repair.setter},
        supercast: ${ctx.modals.supercast.setter},
        supercastModal: ${ctx.modals.supercast.setter},
        process: ${ctx.modals.process.setter},
        processFish: ${ctx.modals.process.setter},
        session: ${ctx.modals.session.setter},
        sessionConnect: ${ctx.modals.session.setter},
    };`
        .split("\n")
        .map((line) => indent + "    " + line)
        .join(eol);
    const deps = [
        ctx.session,
        ctx.program,
        ctx.wallet,
        ctx.detectedWallet,
        ctx.referrer,
        ctx.globalState,
        ctx.playerState,
        ctx.loading,
        ctx.refresh,
        ctx.setPlayerState,
        ctx.setGlobalState,
        ctx.globalPda,
        ctx.playerPda,
        ctx.modals.initialization.state,
        ctx.modals.upgrade.state,
        ctx.modals.repair.state,
        ctx.modals.supercast.state,
        ctx.modals.process.state,
        ctx.modals.session.state,
        ctx.modals.initialization.setter,
        ctx.modals.upgrade.setter,
        ctx.modals.repair.setter,
        ctx.modals.supercast.setter,
        ctx.modals.process.setter,
        ctx.modals.session.setter,
        ctx.devHud.state,
        ctx.devHud.setter,
        ctx.mismatchFlag,
        ctx.mismatchInfo,
        ctx.hasEver,
        ctx.ready,
        ctx.demoMode,
    ];
    ctx.mismatchSetter && deps.push(ctx.mismatchSetter);
    ctx.mismatchInfoSetter && deps.push(ctx.mismatchInfoSetter);
    ctx.hasEverSetter && deps.push(ctx.hasEverSetter);
    ctx.readySetter && deps.push(ctx.readySetter);
    ctx.demoSetter && deps.push(ctx.demoSetter);
    const depsList = deps.join(", ");
    const lines = [
        `${indent}${BRIDGE_MARKER}`,
        `${indent}reactExports.useEffect(() => {`,
        `${indent}    if (typeof window == "undefined") return;`,
        `${indent}    const sessionInfo = ${ctx.session};`,
        `${indent}    const sessionEstablished = isEstablished(sessionInfo);`,
        `${indent}    const walletAddress = ${ctx.wallet} ? ${ctx.wallet}.toString() : null;`,
        `${indent}    const detectedWallet = ${ctx.detectedWallet} ? ${ctx.detectedWallet}.toString() : null;`,
        `${indent}    const toPubkeyString = (value) => {`,
        `${indent}        if (!value) return null;`,
        `${indent}        if (typeof value == "string") return value;`,
        `${indent}        if (typeof value.toBase58 == "function") return value.toBase58();`,
        `${indent}        if (typeof value.toString == "function") return value.toString();`,
        `${indent}        return null;`,
        `${indent}    };`,
        `${indent}    const getRepairController = () => window.__repairModal || null;`,
        `${indent}    const attemptRepair = () => {`,
        `${indent}        const controller = getRepairController();`,
        `${indent}        if (controller && typeof controller.repairNow == "function") {`,
        `${indent}            controller.repairNow();`,
        `${indent}            return !0;`,
        `${indent}        }`,
        `${indent}        return !1;`,
        `${indent}    };`,
        `${indent}    const autoRepairApi = typeof window.AutoRepair == "object" ? window.AutoRepair : null;`,
        `${indent}    const autoRepairStatus = autoRepairApi && typeof autoRepairApi.status == "function" ? autoRepairApi.status() : null;`,
        `${indent}    const configSnapshot = typeof window.__cfg == "function" ? window.__cfg() : null;`,
        `${indent}    const sessionDetails = sessionInfo && typeof sessionInfo == "object" ? {`,
        `${indent}        type: sessionInfo.type || null,`,
        `${indent}        wallet: toPubkeyString(sessionInfo.walletPublicKey),`,
        `${indent}        sessionPublicKey: toPubkeyString(sessionInfo.sessionPublicKey),`,
        `${indent}        payer: toPubkeyString(sessionInfo.payer),`,
        `${indent}        hasSendTransaction: typeof sessionInfo.sendTransaction == "function",`,
        `${indent}        hasEndSession: typeof sessionInfo.endSession == "function",`,
        `${indent}        hasStartSupercast: typeof sessionInfo.startSuperCast == "function",`,
        `${indent}    } : null;`,
        `${indent}    const playerData = ${ctx.playerState} || null;`,
        `${indent}    const playerSummary = playerData ? {`,
        `${indent}        rodLevel: playerData.rodLevel ?? null,`,
        `${indent}        boatTier: playerData.boatTier ?? null,`,
        `${indent}        castCount: playerData.castCount ?? null,`,
        `${indent}        power: playerData.power ?? null,`,
        `${indent}        unprocessedFish: playerData.unprocessedFish ?? null,`,
        `${indent}        durability: playerData.maxDurability ? {`,
        `${indent}            current: playerData.currentDurability ?? null,`,
        `${indent}            max: playerData.maxDurability ?? null,`,
        `${indent}            percent: playerData.maxDurability ? Math.round(((playerData.currentDurability ?? 0) / playerData.maxDurability) * 100) : null,`,
        `${indent}            canRepair: playerData.maxDurability ? (playerData.currentDurability ?? 0) <= playerData.maxDurability * 0.2 : null,`,
        `${indent}        } : null,`,
        `${indent}        supercast: { remaining: playerData.supercastRemainingCasts ?? null },`,
        `${indent}    } : null;`,
        `${indent}    const globalData = ${ctx.globalState} || null;`,
        `${indent}    const globalSummary = globalData ? {`,
        `${indent}        difficulty: globalData.currentDifficulty ?? null,`,
        `${indent}        totalNetworkPower: globalData.totalNetworkPower ?? null,`,
        `${indent}        baseEmissionRate: globalData.baseEmissionRate ?? null,`,
        `${indent}    } : null;`,
        `${indent}    const modalState = {`,
        `${indent}        initialization: ${ctx.modals.initialization.state},`,
        `${indent}        upgrade: ${ctx.modals.upgrade.state},`,
        `${indent}        repair: ${ctx.modals.repair.state},`,
        `${indent}        supercast: ${ctx.modals.supercast.state},`,
        `${indent}        process: ${ctx.modals.process.state},`,
        `${indent}        sessionConnect: ${ctx.modals.session.state},`,
        `${indent}    };`,
        `${indent}    const pdas = {`,
        `${indent}        globalState: toPubkeyString(${ctx.globalPda}),`,
        `${indent}        playerState: toPubkeyString(${ctx.playerPda}),`,
        `${indent}    };`,
        `${indent}    const timestamp = Date.now();`,
        `${indent}    const stateSnapshot = {`,
        `${indent}        timestamp,`,
        `${indent}        sessionEstablished,`,
        `${indent}        loadingPlayerState: ${ctx.loading},`,
        `${indent}        hasPlayerState: !!${ctx.playerState},`,
        `${indent}        hasEverHadPlayerState: ${ctx.hasEver},`,
        `${indent}        readyForGameplay: ${ctx.ready},`,
        `${indent}        demoMode: ${ctx.demoMode},`,
        `${indent}        walletMismatchActive: ${ctx.mismatchFlag},`,
        `${indent}        walletMismatchInfo: ${ctx.mismatchInfo},`,
        `${indent}        devHUD: ${ctx.devHud.state},`,
        `${indent}        modals: modalState,`,
        `${indent}        playerState: ${ctx.playerState} || null,`,
        `${indent}        globalState: ${ctx.globalState} || null,`,
        `${indent}        playerSummary,`,
        `${indent}        globalSummary,`,
        `${indent}        sessionDetails,`,
        `${indent}        referrer: ${ctx.referrer} || null,`,
        `${indent}        pdas,`,
        `${indent}        walletDetected: detectedWallet,`,
        `${indent}        config: configSnapshot,`,
        `${indent}        autoRepair: {`,
        `${indent}            available: !!autoRepairApi,`,
        `${indent}            enabled: autoRepairStatus ? !!autoRepairStatus.enabled : autoRepairApi && typeof autoRepairApi.isEnabled == "function" ? autoRepairApi.isEnabled() : null,`,
        `${indent}            status: autoRepairStatus,`,
        `${indent}        },`,
        `${indent}    };`,
        modalHandlers,
        `${indent}    const actions = {`,
        `${indent}        refreshPlayerState: () => ${ctx.refresh}(),`,
        `${indent}        setPlayerStateFromDecoded: (payload) => ${ctx.setPlayerState}(payload),`,
        `${indent}        setGlobalStateFromDecoded: (payload) => ${ctx.setGlobalState}(payload),`,
        `${indent}        setModalState: (name, isOpen) => {`,
        `${indent}            const setter = modalHandlers[name];`,
        `${indent}            if (!setter) return !1;`,
        `${indent}            setter(!!isOpen);`,
        `${indent}            return !0;`,
        `${indent}        },`,
        `${indent}        openModal: (name) => actions.setModalState(name, !0),`,
        `${indent}        closeModal: (name) => actions.setModalState(name, !1),`,
        `${indent}        closeAllModals: () => {`,
        `${indent}            Object.keys(modalHandlers).forEach((key) => {`,
        `${indent}                const setter = modalHandlers[key];`,
        `${indent}                typeof setter == "function" && setter(!1);`,
        `${indent}            });`,
        `${indent}            return !0;`,
        `${indent}        },`,
        `${indent}        toggleDevHUD: (value) => {`,
        `${indent}            const next = typeof value == "boolean" ? value : !${ctx.devHud.state};`,
        `${indent}            ${ctx.devHud.setter}(next);`,
        `${indent}            return next;`,
        `${indent}        },`,
        `${indent}        setDevHUD: (value) => {`,
        `${indent}            const next = !!value;`,
        `${indent}            ${ctx.devHud.setter}(next);`,
        `${indent}            return next;`,
        `${indent}        },`,
        `${indent}        requestRepairModal: () => {`,
        `${indent}            modalHandlers.repair(!0);`,
        `${indent}            return !0;`,
        `${indent}        },`,
        `${indent}        repairNow: () => {`,
        `${indent}            modalHandlers.repair(!0);`,
        `${indent}            if (attemptRepair()) return !0;`,
        `${indent}            const delays = [50, 200, 500];`,
        `${indent}            delays.forEach((delay) => {`,
        `${indent}                window.setTimeout(() => attemptRepair(), delay);`,
        `${indent}            });`,
        `${indent}            return !1;`,
        `${indent}        },`,
        `${indent}        getRepairController: () => getRepairController(),`,
        `${indent}        setWalletMismatch: (value, info) => {`,
        `${indent}            if (typeof ${mismatchSetterId} != "function") return !1;`,
        `${indent}            ${mismatchSetterId}(!!value);`,
        `${indent}            if (${mismatchInfoSetterId} && info) {`,
        `${indent}                typeof ${mismatchInfoSetterId} == "function" && ${mismatchInfoSetterId}(info);`,
        `${indent}            }`,
        `${indent}            return !0;`,
        `${indent}        },`,
        `${indent}        clearWalletMismatch: () => {`,
        `${indent}            if (typeof ${mismatchSetterId} != "function") return !1;`,
        `${indent}            ${mismatchSetterId}(!1);`,
        `${indent}            if (${mismatchInfoSetterId} && typeof ${mismatchInfoSetterId} == "function") {`,
        `${indent}                ${mismatchInfoSetterId}({ sessionWallet: null, detectedWallet: null });`,
        `${indent}            }`,
        `${indent}            return !0;`,
        `${indent}        },`,
        `${indent}        setHasEverHadPlayerState: (value) => {`,
        `${indent}            if (typeof ${hasEverSetterId} != "function") return !1;`,
        `${indent}            ${hasEverSetterId}(!!value);`,
        `${indent}            return !!value;`,
        `${indent}        },`,
        `${indent}        setReadyForGameplay: (value) => {`,
        `${indent}            if (typeof ${readySetterId} != "function") return !1;`,
        `${indent}            ${readySetterId}(!!value);`,
        `${indent}            return !!value;`,
        `${indent}        },`,
        `${indent}        setDemoMode: (value) => {`,
        `${indent}            if (typeof ${demoSetterId} != "function") return !1;`,
        `${indent}            ${demoSetterId}(!!value);`,
        `${indent}            return !!value;`,
        `${indent}        },`,
        `${indent}        getSessionDetails: () => sessionDetails,`,
        `${indent}        getPlayerSummary: () => playerSummary,`,
        `${indent}        getConfigSnapshot: () => (typeof window.__cfg == "function" ? window.__cfg() : null),`,
        `${indent}        getConfigValue: (key, defaultValue) => (typeof window.__cfg == "function" ? window.__cfg(key, defaultValue) : defaultValue),`,
        `${indent}        setConfigValue: (key, value) => {`,
        `${indent}            if (typeof window.__cfg != "function" || typeof window.__cfg.set != "function") return null;`,
        `${indent}            return window.__cfg.set(key, value);`,
        `${indent}        },`,
        `${indent}        enableAutoRepair: () => {`,
        `${indent}            if (!autoRepairApi || typeof autoRepairApi.enable != "function") return null;`,
        `${indent}            return autoRepairApi.enable();`,
        `${indent}        },`,
        `${indent}        disableAutoRepair: () => {`,
        `${indent}            if (!autoRepairApi || typeof autoRepairApi.disable != "function") return null;`,
        `${indent}            return autoRepairApi.disable();`,
        `${indent}        },`,
        `${indent}        toggleAutoRepair: (value) => {`,
        `${indent}            if (!autoRepairApi || typeof autoRepairApi.toggle != "function") {`,
        `${indent}                if (!autoRepairApi || !value) return null;`,
        `${indent}                return value ? autoRepairApi.enable && autoRepairApi.enable() : autoRepairApi.disable && autoRepairApi.disable();`,
        `${indent}            }`,
        `${indent}            return typeof value == "boolean" ? (value ? autoRepairApi.enable && autoRepairApi.enable() : autoRepairApi.disable && autoRepairApi.disable()) : autoRepairApi.toggle();`,
        `${indent}        },`,
        `${indent}        setAutoRepairDebug: (value) => {`,
        `${indent}            if (!autoRepairApi || typeof autoRepairApi.setDebug != "function") return null;`,
        `${indent}            return autoRepairApi.setDebug(!!value);`,
        `${indent}        },`,
        `${indent}        getAutoRepairStatus: () => (autoRepairApi && typeof autoRepairApi.status == "function" ? autoRepairApi.status() : null),`,
        `${indent}        emitEvent: (name, detail) => {`,
        `${indent}            if (typeof window.dispatchEvent != "function" || typeof CustomEvent != "function") return !1;`,
        `${indent}            window.dispatchEvent(new CustomEvent(name, { detail }));`,
        `${indent}            return !0;`,
        `${indent}        },`,
        `${indent}    };`,
        `${indent}    const externalBridge = {`,
        `${indent}        version: "game-bridge/v1",`,
        `${indent}        timestamp,`,
        `${indent}        session: sessionInfo,`,
        `${indent}        program: ${ctx.program},`,
        `${indent}        walletPublicKey: walletAddress,`,
        `${indent}        detectedWallet,`,
        `${indent}        state: stateSnapshot,`,
        `${indent}        actions,`,
        `${indent}        getState: () => stateSnapshot,`,
        `${indent}        getPlayerState: () => stateSnapshot.playerState,`,
        `${indent}        getGlobalState: () => stateSnapshot.globalState,`,
        `${indent}    };`,
        `${indent}    window.__game = externalBridge;`,
        `${indent}    if (typeof window.dispatchEvent == "function" && typeof CustomEvent == "function") {`,
        `${indent}        window.dispatchEvent(`,
        `${indent}            new CustomEvent("game-bridge-update", {`,
        `${indent}                detail: {`,
        `${indent}                    wallet: walletAddress,`,
        `${indent}                    hasPlayerState: !!${ctx.playerState},`,
        `${indent}                    ready: !!(${ctx.playerState} && ${ctx.program} && ${ctx.wallet} && !${ctx.loading}),`,
        `${indent}                    timestamp,`,
        `${indent}                },`,
        `${indent}            })`,
        `${indent}        );`,
        `${indent}    }`,
        `${indent}    return () => {`,
        `${indent}        if (window.__game === externalBridge) delete window.__game;`,
        `${indent}    };`,
        `${indent}}, [${depsList}]),`,
        `${indent}// ===== END GAME EXTERNAL BRIDGE =====`,
    ];
    return lines.join(eol) + eol;
}

/**
 * Detecta dinamicamente as variaveis do RepairRodModal e constroi o bloco do controller.
 */
function buildRepairControllerBlock(source, eol) {
    const modalStart = source.indexOf("RepairRodModal = ({");
    if (modalStart === -1) throw new Error("[game-bridge] RepairRodModal nao encontrado");
    const modalBlock = source.slice(modalStart, modalStart + 3000);

    const onCloseMatch = modalBlock.match(/onClose:\s*(\w+)/);
    if (!onCloseMatch) throw new Error("[game-bridge] onClose do RepairRodModal nao encontrado");
    const closeVar = onCloseMatch[1];

    const processingMatch = modalBlock.match(/const\s*\[(\w+),\s*(\w+)\]\s*=\s*reactExports\.useState\(!1\)/);
    if (!processingMatch) throw new Error("[game-bridge] isProcessing do RepairRodModal nao encontrado");
    const isProcessingVar = processingMatch[1];

    const errorMatch = modalBlock.match(/\[(\w+),\s*(\w+)\]\s*=\s*reactExports\.useState\(null\)/);
    if (!errorMatch) throw new Error("[game-bridge] error state do RepairRodModal nao encontrado");
    const errorVar = errorMatch[1];
    const setErrorVar = errorMatch[2];

    const aliasMatch = modalBlock.match(/if\s*\(!\w+\)\s*return[^;]*;\s*const\s+(\w+)\s*=\s*\w+;/);
    if (!aliasMatch) throw new Error("[game-bridge] playerState alias do RepairRodModal nao encontrado");
    const playerStateVar = aliasMatch[1];

    const canRepairMatch = modalBlock.match(/(\w+)\s*=\s*\w+\s*&&\s*\w+\.currentDurability\s*<=\s*\w+/);
    if (!canRepairMatch) throw new Error("[game-bridge] canRepair do RepairRodModal nao encontrado");
    const canRepairVar = canRepairMatch[1];

    const canRepairIndex = modalBlock.indexOf(canRepairMatch[0]);
    const afterCanRepair = modalBlock.slice(canRepairIndex);
    const repairFnMatch = afterCanRepair.match(/(\w+)\s*=\s*async\s*\(\)\s*=>\s*\{/);
    if (!repairFnMatch) throw new Error("[game-bridge] repairNow function do RepairRodModal nao encontrada");
    const repairNowVar = repairFnMatch[1];

    console.log(`[game-bridge] RepairRodModal vars: close=${closeVar}, processing=${isProcessingVar}, error=${errorVar}, setError=${setErrorVar}, playerState=${playerStateVar}, canRepair=${canRepairVar}, repairNow=${repairNowVar}`);

    return `
        // ===== REPAIR MODAL CONTROLLER =====
        reactExports.useEffect(() => {
            if (typeof window == "undefined") return;
            const controller = {
                version: "repair-modal/v1",
                repairNow: () => ${repairNowVar}(),
                close: () => ${closeVar}(),
                setError: (message) => ${setErrorVar}(message),
                state: () => ({
                    canRepair: ${canRepairVar},
                    isProcessing: ${isProcessingVar},
                    error: ${errorVar},
                    playerState: ${playerStateVar},
                }),
            };
            window.__repairModal = controller;
            return () => {
                if (window.__repairModal === controller) delete window.__repairModal;
            };
        }, [${canRepairVar}, ${isProcessingVar}, ${errorVar}, ${playerStateVar}, ${repairNowVar}, ${closeVar}, ${setErrorVar}]);
        // ===== END REPAIR MODAL CONTROLLER =====
`;
}

function injectRepairController(source, eol) {
    if (source.includes(REPAIR_CONTROLLER_MARKER)) {
        console.log("[game-bridge] Controller do RepairRodModal ja presente.");
        return source;
    }
    // Generic anchor: <var> = (<var>.currentDurability / <var>.maxDurability) * 100;
    const anchorRegex = /\s(\w+)\s*=\s*\(\w+\.currentDurability\s*\/\s*\w+\.maxDurability\)\s*\*\s*100;/;
    const match = anchorRegex.exec(source);
    if (!match) throw new Error("[game-bridge] Nao encontrei o anchor do RepairRodModal.");
    const insertIndex = match.index + match[0].length;
    console.log("[game-bridge] Expondo controller global do RepairRodModal.");
    const controllerBlock = buildRepairControllerBlock(source, eol);
    const block = `${eol}${controllerBlock.replace(/\n/g, eol)}`;
    return source.slice(0, insertIndex) + block + source.slice(insertIndex);
}



module.exports = {
    name: "Game External Bridge",
    description: "Exibe dados do jogo e ações de controle via window.__game",
    version: "3.0.0",

    apply(sourceCode) {
        const eol = sourceCode.includes("\r\n") ? "\r\n" : "\n";
        let modified = sourceCode;
        if (!modified.includes(BRIDGE_MARKER)) {
            const { start, block } = getGameViewBlock(modified);
            const identifiers = collectIdentifiers(block);
            const bridgeBlock = buildBridgeBlock(identifiers, eol);
            const emptyEffectIndex = block.indexOf("reactExports.useEffect(() => {}, [])");
            if (emptyEffectIndex === -1) throw new Error("[game-bridge] Anchor para o efeito vazio não encontrada");
            const insertIndex = start + emptyEffectIndex;
            console.log("[game-bridge] Inserindo bridge externa dinâmica.");
            modified = modified.slice(0, insertIndex) + bridgeBlock + modified.slice(insertIndex);
        } else {
            console.log("[game-bridge] Bridge já aplicada.");
        }
        modified = injectRepairController(modified, eol);
        return modified;
    },

    remove(sourceCode) {
        let modified = sourceCode;
        if (modified.includes(BRIDGE_MARKER)) {
            console.log("[game-bridge] Removendo bridge externa.");
            modified = modified.replace(BRIDGE_REGEX, "");
        }
        if (modified.includes(REPAIR_CONTROLLER_MARKER)) {
            console.log("[game-bridge] Removendo controller do RepairRodModal.");
            modified = modified.replace(REPAIR_CONTROLLER_REGEX, "");
        }
        return modified;
    },
};
