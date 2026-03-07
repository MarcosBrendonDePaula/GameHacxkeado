/**
 * Boat Manual Control Patch
 *
 * Adds WASD movement for the boat, automatic catches when overlapping fishable tiles,
 * and hooks into the config system for toggling.
 */

const replacements = [
    {
        description: "Add manual boat constants/helpers",
        // This replacement is handled specially in apply() below
        find: null,
        replace: null,
        customApply: function(source, eol) {
            // Already applied?
            if (source.includes("MANUAL_BOAT_EVENT")) return source;

            const manualBoatConstants = [
                'const MANUAL_BOAT_EVENT = "manual-boat-control-change";',
            ].join(eol);

            const manualBoatHelper = [
                'const getManualBoatControlState = () => {',
                '    if (typeof window == "undefined") return !1;',
                '    if (typeof window.__cfg == "function") return window.__cfg("manual_boat_control", !1);',
                '    if (typeof window.__manualBoatControlEnabled == "boolean") return window.__manualBoatControlEnabled;',
                '    return !1;',
                '};',
            ].join(eol);

            // Case 1: render-toggle already applied (getRenderToggleState exists)
            const renderToggleEnd = 'const getRenderToggleState = () => {' + eol +
                '    if (typeof window == "undefined") return !0;' + eol +
                '    if (typeof window.__cfg == "function") return window.__cfg("render_enabled", !0);' + eol +
                '    if (typeof window.__fishingRenderEnabled == "boolean") return window.__fishingRenderEnabled;' + eol +
                '    return !0;' + eol +
                '};';

            if (source.includes(renderToggleEnd)) {
                // Insert MANUAL_BOAT_EVENT after RENDER_TOGGLE_EVENT line
                const rtEventLine = 'const RENDER_TOGGLE_EVENT = "fishing-render-toggle-change";';
                source = source.replace(rtEventLine, rtEventLine + eol + manualBoatConstants);
                // Insert helper after getRenderToggleState
                source = source.replace(renderToggleEnd, renderToggleEnd + eol + manualBoatHelper);
                return source;
            }

            // Case 2: render-toggle NOT applied - insert everything after percentToProgress
            const anchor = 'const percentToProgress = (b) => b / 100;';
            if (!source.includes(anchor)) throw new Error("[boat-manual-control] percentToProgress anchor not found");
            const insertBlock = eol + manualBoatConstants + eol + manualBoatHelper;
            return source.replace(anchor, anchor + insertBlock);
        },
        customRemove: function(source, eol) {
            // Remove MANUAL_BOAT_EVENT constant
            source = source.replace(eol + 'const MANUAL_BOAT_EVENT = "manual-boat-control-change";', '');
            // Remove getManualBoatControlState helper
            const helper = eol + [
                'const getManualBoatControlState = () => {',
                '    if (typeof window == "undefined") return !1;',
                '    if (typeof window.__cfg == "function") return window.__cfg("manual_boat_control", !1);',
                '    if (typeof window.__manualBoatControlEnabled == "boolean") return window.__manualBoatControlEnabled;',
                '    return !1;',
                '};',
            ].join(eol);
            source = source.replace(helper, '');
            return source;
        },
    },
    {
        description: "Inject manual boat instance state",
        find: `        ur(this, "boatPulseDownAmount", 0.15);
        ur(this, "boatPulseSplashTriggered", !1);
        ur(this, "lastCatchRarity", 1);
        ur(this, "fishingLine", null);
`,
        replace: `        ur(this, "boatPulseDownAmount", 0.15);
        ur(this, "boatPulseSplashTriggered", !1);
        ur(this, "lastCatchRarity", 1);
        ur(this, "manualBoatControlDesired", !1);
        ur(this, "manualBoatControlActive", !1);
        ur(this, "manualBoatState", { posX: 0, posZ: 0, velX: 0, velZ: 0 });
        ur(this, "manualBoatKeys", { forward: !1, backward: !1, left: !1, right: !1 });
        ur(this, "manualBoatSpeed", 5);
        ur(this, "manualBoatAcceleration", 14);
        ur(this, "manualBoatFriction", 6);
        ur(this, "manualBoatLastTileId", null);
        ur(this, "manualBoatLastCatchAt", 0);
        ur(this, "manualBoatCatchCooldown", 800);
        ur(this, "handleManualBoatKeyDownBound");
        ur(this, "handleManualBoatKeyUpBound");
        ur(this, "manualBoatControlEventBound");
        ur(this, "fishingLine", null);
`,
    },
    {
        description: "Watch manual control config",
        find: `        }),
            (this.HALF_COLUMNS = Math.floor(this.config.gridColumns / 2)),
`,
        replace: `        }),
            (this.manualBoatState.posX = this.config.boatOffsetX ?? 0),
            (this.manualBoatState.posZ = this.config.boatOffsetZ ?? 0),
            (this.manualBoatControlDesired = typeof window != "undefined" ? getManualBoatControlState() : !1),
            typeof window != "undefined" &&
                ((this.manualBoatControlEventBound = (y) => {
                    var x;
                    this.manualBoatControlDesired =
                        (x = y == null ? void 0 : y.detail) != null && typeof x.enabled == "boolean"
                            ? x.enabled
                            : getManualBoatControlState();
                }),
                window.addEventListener(MANUAL_BOAT_EVENT, this.manualBoatControlEventBound)),
            (this.HALF_COLUMNS = Math.floor(this.config.gridColumns / 2)),
`,
    },
    {
        description: "Dispose manual control listeners",
        find: `    dispose() {
        var y, x;
        (this.hexMesh &&
`,
        replace: `    dispose() {
        var y, x;
        this.disableManualBoatControl();
        typeof window != "undefined" &&
            this.manualBoatControlEventBound &&
            (window.removeEventListener(MANUAL_BOAT_EVENT, this.manualBoatControlEventBound),
            (this.manualBoatControlEventBound = null));
        (this.hexMesh &&
`,
    },
    {
        description: "Insert manual boat methods before updateBoatTransform",
        find: `        return z;
    }
    updateBoatTransform() {
`,
        replace: `        return z;
    }
    shouldUseManualBoatControl() {
        return !!this.manualBoatControlDesired;
    }
    enableManualBoatControl() {
        if (this.manualBoatControlActive) return;
        (this.manualBoatControlActive = !0),
            (this.manualBoatKeys = { forward: !1, backward: !1, left: !1, right: !1 }),
            (this.manualBoatState.velX = 0),
            (this.manualBoatState.velZ = 0);
        const y = (this.boat && this.boat.object3d ? this.boat.object3d.position : null) ?? {
            x: this.config.boatOffsetX ?? 0,
            z: this.config.boatOffsetZ ?? 0,
        };
        (this.manualBoatState.posX = y.x), (this.manualBoatState.posZ = y.z);
        if (typeof window != "undefined") {
            this.handleManualBoatKeyDownBound =
                this.handleManualBoatKeyDownBound ?? this.handleManualBoatKeyDown.bind(this);
            this.handleManualBoatKeyUpBound =
                this.handleManualBoatKeyUpBound ?? this.handleManualBoatKeyUp.bind(this);
            window.addEventListener("keydown", this.handleManualBoatKeyDownBound),
                window.addEventListener("keyup", this.handleManualBoatKeyUpBound);
        }
        debugLog("�Ys� Manual boat control ENABLED");
    }
    disableManualBoatControl() {
        if (!this.manualBoatControlActive) return;
        (this.manualBoatControlActive = !1),
            (this.manualBoatKeys = { forward: !1, backward: !1, left: !1, right: !1 }),
            (this.manualBoatState.velX = 0),
            (this.manualBoatState.velZ = 0),
            (this.manualBoatLastTileId = null);
        if (typeof window != "undefined") {
            this.handleManualBoatKeyDownBound &&
                window.removeEventListener("keydown", this.handleManualBoatKeyDownBound);
            this.handleManualBoatKeyUpBound &&
                window.removeEventListener("keyup", this.handleManualBoatKeyUpBound);
        }
        debugLog("�Ys� Manual boat control DISABLED");
    }
    mapManualBoatKey(y) {
        const x = y.key;
        if (!x) return null;
        switch (x) {
            case "w":
            case "W":
            case "ArrowUp":
                return "forward";
            case "s":
            case "S":
            case "ArrowDown":
                return "backward";
            case "a":
            case "A":
            case "ArrowLeft":
                return "left";
            case "d":
            case "D":
            case "ArrowRight":
                return "right";
            default:
                return null;
        }
    }
    handleManualBoatKeyDown(y) {
        if (!this.manualBoatControlActive) return;
        const x = this.mapManualBoatKey(y);
        x &&
            ((this.manualBoatKeys[x] = !0),
            (y.key.startsWith("Arrow") || y.key === " ") && y.preventDefault && y.preventDefault());
    }
    handleManualBoatKeyUp(y) {
        const x = this.mapManualBoatKey(y);
        x && (this.manualBoatKeys[x] = !1);
    }
    clampManualBoatPosition(y) {
        const x = this.getColumnWidth() * this.config.gridColumns * 0.45,
            A = this.getRowStep(),
            O = Math.max(-2, -this.config.backPaddingRows * A),
            U = this.config.forwardViewRows * A;
        (y.posX = Math.max(-x, Math.min(x, y.posX))), (y.posZ = Math.max(O, Math.min(U, y.posZ)));
    }
    updateManualBoatControl(y) {
        if (typeof window != "undefined" && typeof window.__cfg == "function") {
            const O = window.__cfg("manual_boat_control", this.manualBoatControlDesired ?? !1);
            O !== this.manualBoatControlDesired && (this.manualBoatControlDesired = O);
        }
        const x = this.shouldUseManualBoatControl();
        x && !this.manualBoatControlActive ? this.enableManualBoatControl() : !x && this.manualBoatControlActive && this.disableManualBoatControl();
        if (!this.manualBoatControlActive) return;
        const A = this.manualBoatKeys,
            O = this.manualBoatState,
            U = (A.left ? 1 : 0) - (A.right ? 1 : 0),
            z = (A.forward ? 1 : 0) - (A.backward ? 1 : 0),
            X = Math.max(0, 1 - this.manualBoatFriction * y);
        (O.velX *= X), (O.velZ *= X);
        if (U !== 0 || z !== 0) {
            const J = Math.hypot(U, z) || 1,
                ee = this.manualBoatAcceleration * y;
            (O.velX += (U / J) * ee), (O.velZ += (z / J) * ee);
        }
        const J = Math.hypot(O.velX, O.velZ),
            ee = this.manualBoatSpeed;
        J > ee && ((O.velX = (O.velX / J) * ee), (O.velZ = (O.velZ / J) * ee)),
            (O.posX += O.velX * y),
            (O.posZ += O.velZ * y),
            this.clampManualBoatPosition(O),
            this.maybeTriggerManualBoatCatch();
    }
    maybeTriggerManualBoatCatch() {
        if (!this.manualBoatControlActive || !this.tileData.length) return;
        const y = this.worldGroup ? this.manualBoatState.posZ - this.worldGroup.position.z : this.manualBoatState.posZ,
            x = this.getBoatSupportTile(this.manualBoatState.posX, y);
        if (!x || !x.isFishable || x.isFished || x.isPending) return;
        const A = performance.now();
        if (x.instanceIndex === this.manualBoatLastTileId && A - this.manualBoatLastCatchAt < this.manualBoatCatchCooldown) return;
        (this.manualBoatLastTileId = x.instanceIndex), (this.manualBoatLastCatchAt = A), this.rotateBoatToTile(x);
        try {
            typeof window != "undefined" && typeof window.__onManualTileClick == "function" && window.__onManualTileClick();
        } catch (O) {
            debugWarn("�s���? Manual boat hook error:", O);
        }
        this.toggleTileFished(x.instanceIndex);
    }
    updateBoatTransform() {
`,
    },
    {
        description: "Tie camera to manual boat when active",
        find: `(this.camera.position.set(J + ue * Math.sin(_e), A + Je, ee + ue * Math.cos(_e)), this.camera.lookAt(J, U, ee));`,
        replace: `        let manualCamJ = J,
            manualCamEe = ee;
        if (this.manualBoatControlActive) {
            const worldGroupZ = this.worldGroup ? this.worldGroup.position.z : 0;
            manualCamJ = this.manualBoatState.posX;
            manualCamEe = this.manualBoatState.posZ + worldGroupZ;
        }
        (this.camera.position.set(manualCamJ + ue * Math.sin(_e), A + Je, manualCamEe + ue * Math.cos(_e)), this.camera.lookAt(manualCamJ, U, manualCamEe));`,
    },
    {
        description: "Use manual coordinates when active",
        find: `        const y = this.config.boatOffsetX ?? 0,
            x = this.config.boatOffsetZ ?? 0,
`,
        replace: `        const manualActive = this.manualBoatControlActive,
            y = manualActive ? this.manualBoatState.posX : this.config.boatOffsetX ?? 0,
            x = manualActive ? this.manualBoatState.posZ : this.config.boatOffsetZ ?? 0,
`,
    },
    {
        description: "Update scroll loop to include manual control",
        find: `        const x = this.targetRows - this.totalRows,
            A = 1e-4,
            O = this.getRowStep();
        if (this.controls && this.controls.enabled) this.controls.update();
`,
        replace: `        const x = this.targetRows - this.totalRows,
            A = 1e-4,
            O = this.getRowStep();
        this.updateManualBoatControl(y);
        if (this.controls && this.controls.enabled) this.controls.update();
`,
    },
];

const manualControlBlock = `

// ===== MANUAL BOAT CONTROL CONFIG INTEGRATION =====
(function () {
    "use strict";
    const CONFIG_KEY = "manual_boat_control";
    const GLOBAL_FLAG = "__manualBoatControlEnabled";
    const EVENT_NAME = typeof MANUAL_BOAT_EVENT < "u" ? MANUAL_BOAT_EVENT : "manual-boat-control-change";
    function waitForConfig(iteration = 0) {
        if (typeof window.__cfg == "function") return Promise.resolve();
        if (iteration > 100) return Promise.resolve();
        return new Promise((resolve) => setTimeout(resolve, 100)).then(() => waitForConfig(iteration + 1));
    }
    function emitManualState(state) {
        if (typeof window.dispatchEvent != "function" || typeof CustomEvent != "function") return;
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { enabled: state } }));
    }
    function applyManualState(state) {
        const normalized = !!state;
        if (typeof window.__cfg == "function") window.__cfg.set(CONFIG_KEY, normalized);
        window[GLOBAL_FLAG] = normalized;
        emitManualState(normalized);
        console.log(\`[ManualBoat] Controle manual \${normalized ? "ativado" : "desativado"}\`);
        return normalized;
    }
    waitForConfig().then(() => {
        const current = typeof window.__cfg == "function" ? window.__cfg(CONFIG_KEY, !1) : !1;
        window[GLOBAL_FLAG] = current;
        emitManualState(current);
        window.getManualBoatControl = () => {
            if (typeof window.__cfg == "function") return window.__cfg(CONFIG_KEY, !1);
            return !!window[GLOBAL_FLAG];
        };
        window.setManualBoatControl = (value) => applyManualState(value);
        window.toggleManualBoatControl = (value) => {
            const next = typeof value == "boolean" ? value : !window.getManualBoatControl();
            return applyManualState(next);
        };
        console.log("[ManualBoat] Use window.toggleManualBoatControl() para alternar o modo manual.");
    });
})();
// ===== FIM MANUAL BOAT CONTROL CONFIG INTEGRATION =====
`;

function normalize(str, eol) {
    return str.replace(/\n/g, eol);
}

module.exports = {
    name: "Boat Manual Control",
    description: "Adiciona controle manual do barco com WASD e pesca automática",
    version: "2.0.0",

    apply(sourceCode) {
        const eol = sourceCode.includes("\r\n") ? "\r\n" : "\n";
        let modified = sourceCode;
        for (const r of replacements) {
            if (r.customApply) {
                modified = r.customApply(modified, eol);
                continue;
            }
            const { description, find, replace } = r;
            const findText = normalize(find, eol);
            const replaceText = normalize(replace, eol);
            if (modified.includes(replaceText)) continue;
            if (!modified.includes(findText)) throw new Error(`[boat-manual-control] Anchor not found for: ${description}`);
            modified = modified.replace(findText, replaceText);
        }
        const blockText = normalize(manualControlBlock, eol);
        if (!modified.includes(blockText)) modified += blockText;
        return modified;
    },

    remove(sourceCode) {
        const eol = sourceCode.includes("\r\n") ? "\r\n" : "\n";
        let modified = sourceCode;
        for (const r of replacements.slice().reverse()) {
            if (r.customRemove) {
                modified = r.customRemove(modified, eol);
                continue;
            }
            const { find, replace } = r;
            const findText = normalize(find, eol);
            const replaceText = normalize(replace, eol);
            if (modified.includes(replaceText)) modified = modified.replace(replaceText, findText);
        }
        const blockText = normalize(manualControlBlock, eol);
        if (modified.includes(blockText)) modified = modified.replace(blockText, "");
        return modified;
    },
};
