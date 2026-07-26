// ==UserScript==
// @name         Lostgamer - Visual Effects
// @name:fr      Lostgamer - Effets visuels
// @namespace    https://lostgamer.io/
// @version      1.9.0
// @description  Applies visual effects only to the Lostgamer panorama.
// @description:fr Applique des effets uniquement à la vue panoramique de Lostgamer.
// @author       Ziga
// @match        https://lostgamer.io/*
// @match        https://www.lostgamer.io/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const SCRIPT_ID = 'lg-visual-effects';
    const STORAGE_KEY = `${SCRIPT_ID}:mode`;
    const PANEL_ID = `${SCRIPT_ID}-panel`;
    const OVERLAY_ID = `${SCRIPT_ID}-pixel-overlay`;

    const LANGUAGE = (navigator.languages?.[0] || navigator.language || 'en')
        .toLowerCase()
        .startsWith('fr') ? 'fr' : 'en';

    const TRANSLATIONS = {
        en: {
            modes: {
                normal: 'Normal mode',
                grayscale: 'Black and white',
                pixelLight: 'Light pixelation',
                pixelExtreme: 'Extreme pixelation',
                blur: 'Blur',
                invert: 'Inverted colors',
                oneSecond: 'Visible for 1 second',
                edges: 'Edges only',
            },
            panelTitle: 'Lostgamer Effects',
            minimizePanel: 'Minimize panel (Alt+M)',
            replay: 'Show again for 1 s (Alt+R)',
            selectView: 'Select the view manually',
            clickPanorama: 'Click the center of the panorama now',
            searching: 'Looking for the panorama…',
            shortcutHint: 'Alt+0 to Alt+7 · Alt+M: panel · v1.9',
            resultScreen: 'Effect paused during the result screen',
            pixelLayerFailed: 'Unable to create the pixelated layer',
            pixelCopyFailed: 'WebGL copy failed for this round',
            edgeLayerFailed: 'Unable to create the edge layer',
            edgeFallback: 'GPU edges unavailable — using black and white instead',
            edgeFrameFailed: 'GPU edges blocked — using black and white instead',
            viewVisible: 'View visible…',
            viewHidden: 'View hidden — press Alt+R to show it again for 1 s',
            waitingForPanorama: 'Waiting for the panorama…',
            disabled: 'Effect disabled',
            grayscaleActive: 'Black and white active',
            pixelLightActive: 'Light pixelation active',
            pixelExtremeActive: 'Extreme pixelation active',
            blurActive: 'Blur active',
            invertActive: 'Inverted colors active',
            edgesActive: 'High-quality edges active (multiscale Scharr RGB, 60 FPS target)',
            noCanvas: 'No canvas found here — try again by clicking the image',
            mapSelected: 'This canvas is the map, not the 3D view',
            viewSelected: (width, height) => `View selected (${width} × ${height})`,
        },
        fr: {
            modes: {
                normal: 'Mode normal',
                grayscale: 'Noir et blanc',
                pixelLight: 'Pixelisé léger',
                pixelExtreme: 'Pixelisé extrême',
                blur: 'Flou',
                invert: 'Couleurs inversées',
                oneSecond: 'Visible pendant 1 seconde',
                edges: 'Contours uniquement',
            },
            panelTitle: 'Effets Lostgamer',
            minimizePanel: 'Réduire le panneau (Alt+M)',
            replay: 'Réafficher pendant 1 s (Alt+R)',
            selectView: 'Sélectionner la vue manuellement',
            clickPanorama: 'Clique maintenant au centre de la vue panoramique',
            searching: 'Recherche de la vue…',
            shortcutHint: 'Alt+0 à Alt+7 · Alt+M : panneau · v1.9',
            resultScreen: 'Effet suspendu pendant l’écran de résultat',
            pixelLayerFailed: 'Impossible de créer la couche pixelisée',
            pixelCopyFailed: 'La copie WebGL a échoué pour cette manche',
            edgeLayerFailed: 'Impossible de créer la couche contours',
            edgeFallback: 'Contours GPU indisponibles — noir et blanc de secours',
            edgeFrameFailed: 'Contours GPU bloqués — noir et blanc de secours',
            viewVisible: 'Vue visible…',
            viewHidden: 'Vue masquée — Alt+R pour revoir 1 s',
            waitingForPanorama: 'En attente de la vue panoramique…',
            disabled: 'Effet désactivé',
            grayscaleActive: 'Noir et blanc actif',
            pixelLightActive: 'Pixelisation légère active',
            pixelExtremeActive: 'Pixelisation extrême active',
            blurActive: 'Flou actif',
            invertActive: 'Couleurs inversées actives',
            edgesActive: 'Contours haute qualité actifs (Scharr RGB multiscale, 60 FPS cible)',
            noCanvas: 'Aucun canvas trouvé ici — recommence en cliquant sur l’image',
            mapSelected: 'Ce canvas est la carte, pas la vue 3D',
            viewSelected: (width, height) => `Vue sélectionnée (${width} × ${height})`,
        },
    };
    const UI = TRANSLATIONS[LANGUAGE];

    const MODES = {
        normal: { shortcut: 'Alt+0' },
        grayscale: { shortcut: 'Alt+1' },
        pixelLight: { shortcut: 'Alt+2', pixelSize: 7 },
        pixelExtreme: { shortcut: 'Alt+3', pixelSize: 28 },
        blur: { shortcut: 'Alt+4' },
        invert: { shortcut: 'Alt+5' },
        oneSecond: { shortcut: 'Alt+6' },
        edges: { shortcut: 'Alt+7' },
    };


    // High-quality profile. These values are grouped here so the workload can
    // be reduced easily if needed.
    const EDGE_CONFIG = {
        targetFps: 60,
        resolutionScale: 2,
        maxWidth: 2560,
        minWidth: 720,
        fineRadius: 1.0,
        coarseRadius: 2.35,
        coarseWeight: 0.9,
        lowThreshold: 0.028,
        highThreshold: 0.16,
        gamma: 0.72,
    };

    let currentMode = localStorage.getItem(STORAGE_KEY);
    if (!MODES[currentMode]) currentMode = 'normal';

    let targetCanvas = null;
    let visualOverlay = null;
    let visualContext = null;
    let overlayParent = null;
    let edgeState = null;
    let lastOverlayFrame = 0;
    let lastOverlayLayoutUpdate = 0;
    const raisedElements = new Map();
    const hostStyles = new Map();
    let animationFrameId = 0;
    let oneSecondTimer = 0;
    let lastRoundMarker = '';
    let lastUrl = location.href;
    let scanTimer = 0;
    let panel = null;
    let select = null;
    let status = null;
    let replayButton = null;
    let selectTargetButton = null;
    let manualSelectionActive = false;

    // Store only the inline styles modified by the script.
    const originalStyles = new WeakMap();

    function rememberStyles(element) {
        if (!element || originalStyles.has(element)) return;
        originalStyles.set(element, {
            filter: element.style.filter,
            opacity: element.style.opacity,
            visibility: element.style.visibility,
            imageRendering: element.style.imageRendering,
            willChange: element.style.willChange,
            width: element.style.width,
            height: element.style.height,
            minWidth: element.style.minWidth,
            minHeight: element.style.minHeight,
            maxWidth: element.style.maxWidth,
            maxHeight: element.style.maxHeight,
            transform: element.style.transform,
            transformOrigin: element.style.transformOrigin,
        });
    }

    function restoreStyles(element) {
        if (!element) return;
        const original = originalStyles.get(element);
        if (!original) return;
        element.style.filter = original.filter;
        element.style.opacity = original.opacity;
        element.style.visibility = original.visibility;
        element.style.imageRendering = original.imageRendering;
        element.style.willChange = original.willChange;
        element.style.width = original.width;
        element.style.height = original.height;
        element.style.minWidth = original.minWidth;
        element.style.minHeight = original.minHeight;
        element.style.maxWidth = original.maxWidth;
        element.style.maxHeight = original.maxHeight;
        element.style.transform = original.transform;
        element.style.transformOrigin = original.transformOrigin;
    }

    function isVisible(element) {
        if (!element || !element.isConnected) return false;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = element.getBoundingClientRect();
        return rect.width >= 300 && rect.height >= 180 && rect.bottom > 0 && rect.right > 0;
    }

    function isPanoramaCanvas(canvas) {
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        if (canvas.id === OVERLAY_ID) return false;
        if (canvas.matches('canvas.round-map') || canvas.closest('.map-container')) return false;

        const engine = (canvas.getAttribute('data-engine') || '').toLowerCase();
        return canvas.matches('canvas.panorama') || engine.includes('three.js');
    }

    function isRoundMapTakingOverScreen() {
        const viewportArea = Math.max(1, innerWidth * innerHeight);

        return [...document.querySelectorAll('canvas.round-map')].some(canvas => {
            if (!canvas.isConnected) return false;
            const style = getComputedStyle(canvas);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
                return false;
            }

            const rect = canvas.getBoundingClientRect();
            const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
            const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
            const visibleAreaRatio = visibleWidth * visibleHeight / viewportArea;

            return (
                visibleAreaRatio >= 0.90 ||
                (rect.width >= innerWidth * 0.65 && rect.height >= innerHeight * 0.65)
            );
        });
    }

    function isPanoramaPhaseActive(canvas = targetCanvas) {
        return isPanoramaCanvas(canvas) && isVisible(canvas) && !isRoundMapTakingOverScreen();
    }

    function hasMapLibraryAncestor(element) {
        let current = element;
        for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
            const haystack = [
                current.id,
                current.className,
                current.getAttribute?.('aria-label'),
                current.getAttribute?.('data-testid'),
            ].filter(value => typeof value === 'string').join(' ').toLowerCase();

            // Deliberately avoid the generic word "map", which could also
            // appear in the main game container.
            if (/leaflet|mapbox|google[-_ ]?map|mini[-_ ]?map|guess[-_ ]?map|location[-_ ]?map/.test(haystack)) {
                return true;
            }
        }
        return false;
    }

    function scoreCanvas(canvas) {
        if (!isVisible(canvas)) return -Infinity;

        const rect = canvas.getBoundingClientRect();
        const viewportArea = Math.max(1, innerWidth * innerHeight);
        const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
        const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
        const visibleArea = visibleWidth * visibleHeight;
        const areaRatio = visibleArea / viewportArea;
        const aspectRatio = rect.width / Math.max(1, rect.height);

        let score = areaRatio * 100;
        if (rect.width >= innerWidth * 0.65) score += 30;
        if (rect.height >= innerHeight * 0.55) score += 30;
        if (aspectRatio >= 1.15) score += 10;
        if (canvas.width >= 800 || canvas.height >= 450) score += 10;
        if (canvas.matches('canvas.round-map') || canvas.closest('.map-container')) score = -Infinity;
        if (hasMapLibraryAncestor(canvas)) score -= 200;
        if (isPanoramaCanvas(canvas)) score += 300;
        if (canvas.id === OVERLAY_ID) score = -Infinity;

        return score;
    }

    function findPanoramaCanvas() {
        // Strict targeting: the 3D view is the Three.js "panorama" canvas.
        // The map has the "round-map" class and must never become a fallback
        // target, even when it fills the screen.
        const exact = [...document.querySelectorAll('main.round-template canvas.panorama')]
            .find(canvas => isPanoramaCanvas(canvas) && isVisible(canvas));
        if (exact) return exact;

        const threeJsFallback = [...document.querySelectorAll('canvas[data-engine*="three.js" i]')]
            .filter(canvas => isPanoramaCanvas(canvas) && isVisible(canvas))
            .map(canvas => ({ canvas, score: scoreCanvas(canvas) }))
            .sort((a, b) => b.score - a.score)[0];

        return threeJsFallback?.canvas || null;
    }

    function setStatus(message, isError = false) {
        if (!status) return;
        status.textContent = message;
        status.style.color = isError ? '#ff9b9b' : '#c8c8c8';
    }

    function rememberRaisedElement(element) {
        if (!element || raisedElements.has(element)) return;
        raisedElements.set(element, {
            zIndex: element.style.zIndex,
            position: element.style.position,
        });
    }

    function rememberHostStyle(element) {
        if (!element || hostStyles.has(element)) return;
        hostStyles.set(element, {
            position: element.style.position,
        });
    }

    function elevateHud() {
        if (!overlayParent || !targetCanvas) return;

        // The panorama, compass, buttons, and map are sibling children of
        // main.round-template. Place every other child above the overlay.
        for (const child of overlayParent.children) {
            if (child === targetCanvas || child === visualOverlay) continue;
            rememberRaisedElement(child);
            child.style.zIndex = '50';
        }

        // The desktop header is outside <main> and also needs a higher
        // stacking context.
        for (const header of document.querySelectorAll('header.game-header')) {
            rememberRaisedElement(header);
            if (getComputedStyle(header).position === 'static') {
                header.style.position = 'relative';
            }
            header.style.zIndex = '50';
        }
    }

    function restoreOverlayParent() {
        for (const [element, original] of raisedElements) {
            if (!element?.isConnected) continue;
            element.style.zIndex = original.zIndex;
            element.style.position = original.position;
        }
        raisedElements.clear();

        for (const [element, original] of hostStyles) {
            if (!element?.isConnected) continue;
            element.style.position = original.position;
        }
        hostStyles.clear();
        overlayParent = null;
    }

    function destroyEdgeState() {
        if (!edgeState) return;
        const { gl, program, texture, buffer } = edgeState;
        try {
            if (texture) gl.deleteTexture(texture);
            if (buffer) gl.deleteBuffer(buffer);
            if (program) gl.deleteProgram(program);
        } catch (_) {
            // The context may already have been lost during a round change.
        }
        edgeState = null;
    }

    function removeVisualOverlay() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = 0;
        }
        destroyEdgeState();
        if (visualOverlay) {
            visualOverlay.remove();
            visualOverlay = null;
            visualContext = null;
        }
        lastOverlayFrame = 0;
        lastOverlayLayoutUpdate = 0;
        restoreOverlayParent();
    }

    function resetTargetVisuals() {
        clearTimeout(oneSecondTimer);
        oneSecondTimer = 0;
        removeVisualOverlay();
        restoreStyles(targetCanvas);
    }

    function suspendEffectsForMapPhase() {
        resetTargetVisuals();
        targetCanvas = null;
        setStatus(UI.resultScreen);
    }

    function createVisualOverlay(kind) {
        if (!targetCanvas?.parentElement) return null;

        removeVisualOverlay();

        const parent = targetCanvas.closest('main.round-template') || targetCanvas.parentElement;
        overlayParent = parent;
        rememberHostStyle(parent);
        if (getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative';
        }

        const overlay = document.createElement('canvas');
        overlay.id = OVERLAY_ID;
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.cssText = [
            'position:absolute',
            'pointer-events:none',
            'margin:0',
            'padding:0',
            'border:0',
            'z-index:10',
            'display:block',
            'transform:none',
            'transform-origin:top left',
        ].join(';');

        // The overlay is added to <main>, while all real HUD elements receive
        // a higher z-index in elevateHud().
        parent.appendChild(overlay);
        visualOverlay = overlay;

        if (kind === '2d') {
            visualContext = overlay.getContext('2d', {
                alpha: false,
                desynchronized: true,
            });
            if (!visualContext) {
                overlay.remove();
                visualOverlay = null;
                restoreOverlayParent();
                return null;
            }
            visualContext.imageSmoothingEnabled = false;
        }

        elevateHud();
        positionVisualOverlay(true);
        return overlay;
    }

    function positionVisualOverlay(force = false) {
        if (!targetCanvas || !visualOverlay || !overlayParent || !targetCanvas.isConnected) return false;

        const now = performance.now();
        if (!force && now - lastOverlayLayoutUpdate < 250) return true;
        lastOverlayLayoutUpdate = now;

        const targetRect = targetCanvas.getBoundingClientRect();
        const parentRect = overlayParent.getBoundingClientRect();
        const parentStyle = getComputedStyle(overlayParent);
        const borderLeft = Number.parseFloat(parentStyle.borderLeftWidth) || 0;
        const borderTop = Number.parseFloat(parentStyle.borderTopWidth) || 0;

        visualOverlay.style.left = `${targetRect.left - parentRect.left - borderLeft + overlayParent.scrollLeft}px`;
        visualOverlay.style.top = `${targetRect.top - parentRect.top - borderTop + overlayParent.scrollTop}px`;
        visualOverlay.style.width = `${targetRect.width}px`;
        visualOverlay.style.height = `${targetRect.height}px`;

        // Reapply the HUD level if Lostgamer recreated an element.
        elevateHud();
        return targetRect.width > 0 && targetRect.height > 0;
    }

    function prepareOverlayResolution(width, height) {
        if (!visualOverlay || !visualContext) return;
        if (visualOverlay.width === width && visualOverlay.height === height) return;

        visualOverlay.width = width;
        visualOverlay.height = height;
        visualContext = visualOverlay.getContext('2d', {
            alpha: false,
            desynchronized: true,
        });
        visualContext.imageSmoothingEnabled = false;
    }

    function startPixelation(pixelScale) {
        if (!targetCanvas) return;

        rememberStyles(targetCanvas);
        const overlay = createVisualOverlay('2d');
        if (!overlay || !visualContext) {
            setStatus(UI.pixelLayerFailed, true);
            return;
        }

        overlay.style.imageRendering = 'pixelated';
        overlay.style.imageRendering = 'crisp-edges';
        // Chrome uses the last recognized value. Set pixelated again after
        // crisp-edges for browsers that handle the two values differently.
        overlay.style.imageRendering = 'pixelated';

        const render = (now) => {
            if (!visualOverlay || currentMode !== 'pixelLight' && currentMode !== 'pixelExtreme') return;
            if (!targetCanvas?.isConnected) return;
            if (!isPanoramaPhaseActive(targetCanvas)) {
                suspendEffectsForMapPhase();
                return;
            }

            positionVisualOverlay();

            // Cap at 60 FPS. Copy into a very small surface, then let the
            // browser scale it up without interpolation.
            if (now - lastOverlayFrame >= 1000 / 60) {
                lastOverlayFrame = now;
                const rect = targetCanvas.getBoundingClientRect();
                const lowWidth = Math.max(32, Math.round(rect.width / pixelScale));
                const lowHeight = Math.max(32, Math.round(rect.height / pixelScale));
                prepareOverlayResolution(lowWidth, lowHeight);

                try {
                    visualContext.globalCompositeOperation = 'copy';
                    visualContext.drawImage(targetCanvas, 0, 0, lowWidth, lowHeight);
                } catch (error) {
                    console.warn('[Lostgamer Effects] Pixel copy failed:', error);
                    setStatus(UI.pixelCopyFailed, true);
                    return;
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);
    }

    function compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const message = gl.getShaderInfoLog(shader) || 'Shader compilation failed';
            gl.deleteShader(shader);
            throw new Error(message);
        }
        return shader;
    }

    function createEdgeState(overlay) {
        const gl = overlay.getContext('webgl', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            desynchronized: true,
            preserveDrawingBuffer: false,
        });
        if (!gl) return null;

        const vertexSource = `
            attribute vec2 a_position;
            varying vec2 v_uv;
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const fragmentSource = `
            precision highp float;
            uniform sampler2D u_texture;
            uniform vec2 u_texel;
            varying vec2 v_uv;

            // Scharr RGB is more accurate and isotropic than Sobel. Computing
            // all three channels also detects color boundaries with nearly
            // identical luminance.
            float scharrRgb(vec2 stepSize) {
                vec3 tl = texture2D(u_texture, v_uv + stepSize * vec2(-1.0,  1.0)).rgb;
                vec3  t = texture2D(u_texture, v_uv + stepSize * vec2( 0.0,  1.0)).rgb;
                vec3 tr = texture2D(u_texture, v_uv + stepSize * vec2( 1.0,  1.0)).rgb;
                vec3  l = texture2D(u_texture, v_uv + stepSize * vec2(-1.0,  0.0)).rgb;
                vec3  r = texture2D(u_texture, v_uv + stepSize * vec2( 1.0,  0.0)).rgb;
                vec3 bl = texture2D(u_texture, v_uv + stepSize * vec2(-1.0, -1.0)).rgb;
                vec3  b = texture2D(u_texture, v_uv + stepSize * vec2( 0.0, -1.0)).rgb;
                vec3 br = texture2D(u_texture, v_uv + stepSize * vec2( 1.0, -1.0)).rgb;

                vec3 gx = -3.0*tl - 10.0*l - 3.0*bl
                          + 3.0*tr + 10.0*r + 3.0*br;
                vec3 gy =  3.0*tl + 10.0*t + 3.0*tr
                          - 3.0*bl - 10.0*b - 3.0*br;

                // Normalize against the theoretical RGB maximum of the Scharr kernel.
                return sqrt(dot(gx, gx) + dot(gy, gy)) / 27.7128129;
            }

            void main() {
                // Two scales: the first preserves small details, while the
                // second reinforces silhouettes and large features.
                float fine = scharrRgb(u_texel * ${EDGE_CONFIG.fineRadius.toFixed(2)});
                float coarse = scharrRgb(u_texel * ${EDGE_CONFIG.coarseRadius.toFixed(2)});
                float strength = max(fine, coarse * ${EDGE_CONFIG.coarseWeight.toFixed(2)});

                // Crisp white lines on black, with a smooth transition to
                // reduce aliasing despite the finer thresholds.
                float line = smoothstep(
                    ${EDGE_CONFIG.lowThreshold.toFixed(3)},
                    ${EDGE_CONFIG.highThreshold.toFixed(3)},
                    strength
                );
                line = pow(line, ${EDGE_CONFIG.gamma.toFixed(2)});
                gl_FragColor = vec4(vec3(line), 1.0);
            }
        `;

        const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const message = gl.getProgramInfoLog(program) || 'Program link failed';
            gl.deleteProgram(program);
            throw new Error(message);
        }

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW,
        );

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        gl.useProgram(program);
        const positionLocation = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const textureLocation = gl.getUniformLocation(program, 'u_texture');
        const texelLocation = gl.getUniformLocation(program, 'u_texel');
        gl.uniform1i(textureLocation, 0);

        return {
            gl,
            program,
            buffer,
            texture,
            texelLocation,
            sourceWidth: 0,
            sourceHeight: 0,
        };
    }

    function startEdgeMode() {
        if (!targetCanvas) return;

        rememberStyles(targetCanvas);
        const overlay = createVisualOverlay('webgl');
        if (!overlay) {
            setStatus(UI.edgeLayerFailed, true);
            return;
        }

        try {
            edgeState = createEdgeState(overlay);
        } catch (error) {
            console.warn('[Lostgamer Effects] Edge shader failed:', error);
            edgeState = null;
        }

        if (!edgeState) {
            removeVisualOverlay();
            // Lightweight fallback: use simple black and white instead of
            // dropping the game to a few FPS with a spatial CSS filter.
            targetCanvas.style.filter = 'grayscale(1)';
            setStatus(UI.edgeFallback, true);
            return;
        }

        overlay.style.imageRendering = 'auto';

        const render = (now) => {
            if (!visualOverlay || currentMode !== 'edges' || !edgeState) return;
            if (!targetCanvas?.isConnected) return;
            if (!isPanoramaPhaseActive(targetCanvas)) {
                suspendEffectsForMapPhase();
                return;
            }

            positionVisualOverlay();

            // High-quality profile: up to 60 FPS and supersampling up to 2×
            // the CSS size, capped at 2560 px wide.
            if (now - lastOverlayFrame >= 1000 / EDGE_CONFIG.targetFps) {
                lastOverlayFrame = now;
                const rect = targetCanvas.getBoundingClientRect();
                const scale = Math.min(
                    EDGE_CONFIG.resolutionScale,
                    Math.max(1, window.devicePixelRatio || 1),
                );
                const outputWidth = Math.max(
                    EDGE_CONFIG.minWidth,
                    Math.min(EDGE_CONFIG.maxWidth, Math.round(rect.width * scale)),
                );
                const outputHeight = Math.max(
                    360,
                    Math.round(outputWidth * rect.height / Math.max(1, rect.width)),
                );

                if (overlay.width !== outputWidth || overlay.height !== outputHeight) {
                    overlay.width = outputWidth;
                    overlay.height = outputHeight;
                }

                const { gl, texture, texelLocation } = edgeState;
                gl.viewport(0, 0, outputWidth, outputHeight);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);

                try {
                    gl.texImage2D(
                        gl.TEXTURE_2D,
                        0,
                        gl.RGBA,
                        gl.RGBA,
                        gl.UNSIGNED_BYTE,
                        targetCanvas,
                    );
                    gl.uniform2f(
                        texelLocation,
                        1 / Math.max(1, targetCanvas.width),
                        1 / Math.max(1, targetCanvas.height),
                    );
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                } catch (error) {
                    console.warn('[Lostgamer Effects] Edge frame failed:', error);
                    removeVisualOverlay();
                    targetCanvas.style.filter = 'grayscale(1)';
                    setStatus(UI.edgeFrameFailed, true);
                    return;
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);
    }

    function revealForOneSecond() {
        if (currentMode !== 'oneSecond') return;

        if (!isPanoramaPhaseActive(targetCanvas)) {
            clearTimeout(oneSecondTimer);
            oneSecondTimer = 0;
            if (targetCanvas) restoreStyles(targetCanvas);
            targetCanvas = null;
            setStatus(UI.resultScreen);
            return;
        }

        clearTimeout(oneSecondTimer);
        rememberStyles(targetCanvas);
        removeVisualOverlay();

        targetCanvas.style.opacity = '1';
        targetCanvas.style.visibility = 'visible';
        targetCanvas.style.filter = 'none';
        setStatus(UI.viewVisible);

        oneSecondTimer = window.setTimeout(() => {
            if (currentMode !== 'oneSecond' || !isPanoramaPhaseActive(targetCanvas)) return;
            targetCanvas.style.filter = 'brightness(0)';
            setStatus(UI.viewHidden);
        }, 1000);
    }

    function applyMode({ triggerOneSecond = true } = {}) {
        if (!targetCanvas?.isConnected || !isPanoramaCanvas(targetCanvas)) {
            targetCanvas = findPanoramaCanvas();
        }

        if (isRoundMapTakingOverScreen()) {
            suspendEffectsForMapPhase();
            return;
        }

        if (!targetCanvas || !isPanoramaCanvas(targetCanvas)) {
            setStatus(UI.waitingForPanorama);
            return;
        }

        resetTargetVisuals();
        rememberStyles(targetCanvas);
        targetCanvas.style.visibility = 'visible';

        switch (currentMode) {
            case 'normal':
                setStatus(UI.disabled);
                break;
            case 'grayscale':
                targetCanvas.style.filter = 'grayscale(1)';
                setStatus(UI.grayscaleActive);
                break;
            case 'pixelLight':
                startPixelation(MODES.pixelLight.pixelSize);
                setStatus(UI.pixelLightActive);
                break;
            case 'pixelExtreme':
                startPixelation(MODES.pixelExtreme.pixelSize);
                setStatus(UI.pixelExtremeActive);
                break;
            case 'blur':
                targetCanvas.style.filter = 'blur(24px)';
                setStatus(UI.blurActive);
                break;
            case 'invert':
                targetCanvas.style.filter = 'invert(1)';
                setStatus(UI.invertActive);
                break;
            case 'oneSecond':
                if (triggerOneSecond) revealForOneSecond();
                else targetCanvas.style.filter = 'brightness(0)';
                break;
            case 'edges':
                startEdgeMode();
                setStatus(UI.edgesActive);
                break;
            default:
                currentMode = 'normal';
                restoreStyles(targetCanvas);
        }

        if (replayButton) replayButton.hidden = currentMode !== 'oneSecond';
    }

    function changeMode(mode) {
        if (!MODES[mode]) return;
        currentMode = mode;
        localStorage.setItem(STORAGE_KEY, currentMode);
        if (select) select.value = currentMode;
        applyMode();
    }

    function scanForTarget() {
        scanTimer = 0;

        // Between rounds, Lostgamer expands canvas.round-map. Remove every
        // overlay and filter immediately without ever targeting the map.
        if (isRoundMapTakingOverScreen()) {
            if (targetCanvas || visualOverlay || oneSecondTimer) {
                suspendEffectsForMapPhase();
            }
            return;
        }

        // Once found, keep the Three.js panorama while it remains the active
        // 3D view.
        if (isPanoramaPhaseActive(targetCanvas) && scoreCanvas(targetCanvas) >= 25) {
            return;
        }

        const found = findPanoramaCanvas();

        if (found && found !== targetCanvas) {
            resetTargetVisuals();
            targetCanvas = found;
            applyMode();
            return;
        }

        if (!found) {
            if (targetCanvas || visualOverlay || oneSecondTimer) resetTargetVisuals();
            targetCanvas = null;
            setStatus(UI.waitingForPanorama);
        }
    }

    function scheduleScan(delay = 100) {
        clearTimeout(scanTimer);
        scanTimer = window.setTimeout(scanForTarget, delay);
    }

    function extractRoundMarker() {
        if (currentMode !== 'oneSecond') return '';
        const bodyText = document.body?.innerText || '';
        const match = bodyText.match(/(?:round|manche)\s*#?\s*(\d+)\s*(?:\/|of|sur)?\s*(\d+)?/i);
        return match ? `${match[1]}/${match[2] || '?'}` : '';
    }

    function createPanel() {
        if (document.getElementById(PANEL_ID)) return;

        panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.style.cssText = [
            'position:fixed',
            'left:12px',
            'top:90px',
            'z-index:2147483647',
            'width:230px',
            'box-sizing:border-box',
            'padding:10px',
            'border:1px solid rgba(255,255,255,.18)',
            'border-radius:10px',
            'background:rgba(20,20,24,.94)',
            'box-shadow:0 8px 28px rgba(0,0,0,.38)',
            'color:#fff',
            'font:13px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        ].join(';');

        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;';

        const title = document.createElement('strong');
        title.textContent = UI.panelTitle;
        title.style.fontSize = '14px';

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = '−';
        closeButton.title = UI.minimizePanel;
        closeButton.style.cssText = 'width:26px;height:24px;border:0;border-radius:6px;background:#333;color:#fff;cursor:pointer;font-size:18px;line-height:18px;';

        titleRow.append(title, closeButton);

        const content = document.createElement('div');
        content.id = `${PANEL_ID}-content`;

        select = document.createElement('select');
        select.style.cssText = 'width:100%;padding:7px;border:1px solid #555;border-radius:7px;background:#25252a;color:#fff;cursor:pointer;';
        for (const [value, config] of Object.entries(MODES)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = `${UI.modes[value]} (${config.shortcut})`;
            select.appendChild(option);
        }
        select.value = currentMode;
        select.addEventListener('change', () => changeMode(select.value));

        replayButton = document.createElement('button');
        replayButton.type = 'button';
        replayButton.textContent = UI.replay;
        replayButton.hidden = currentMode !== 'oneSecond';
        replayButton.style.cssText = 'width:100%;margin-top:8px;padding:7px;border:0;border-radius:7px;background:#5865f2;color:#fff;font-weight:600;cursor:pointer;';
        replayButton.addEventListener('click', revealForOneSecond);

        selectTargetButton = document.createElement('button');
        selectTargetButton.type = 'button';
        selectTargetButton.textContent = UI.selectView;
        selectTargetButton.style.cssText = 'width:100%;margin-top:8px;padding:6px;border:1px solid #555;border-radius:7px;background:#303036;color:#ddd;cursor:pointer;font-size:11px;';
        selectTargetButton.addEventListener('click', () => {
            manualSelectionActive = true;
            setStatus(UI.clickPanorama);
        });

        status = document.createElement('div');
        status.style.cssText = 'margin-top:8px;font-size:11px;color:#c8c8c8;';
        status.textContent = UI.searching;

        const hint = document.createElement('div');
        hint.textContent = UI.shortcutHint;
        hint.style.cssText = 'margin-top:6px;font-size:10px;color:#8f8f98;';

        content.append(select, replayButton, selectTargetButton, status, hint);
        panel.append(titleRow, content);
        document.body.appendChild(panel);

        let minimized = false;
        const togglePanel = () => {
            minimized = !minimized;
            content.hidden = minimized;
            closeButton.textContent = minimized ? '+' : '−';
            panel.style.width = minimized ? '156px' : '230px';
        };
        closeButton.addEventListener('click', togglePanel);
        panel._toggle = togglePanel;
    }

    function handleKeyboard(event) {
        if (!event.altKey || event.ctrlKey || event.metaKey) return;

        const keyToMode = {
            '0': 'normal',
            '1': 'grayscale',
            '2': 'pixelLight',
            '3': 'pixelExtreme',
            '4': 'blur',
            '5': 'invert',
            '6': 'oneSecond',
            '7': 'edges',
        };

        if (keyToMode[event.key]) {
            event.preventDefault();
            changeMode(keyToMode[event.key]);
            return;
        }

        if (event.key.toLowerCase() === 'r' && currentMode === 'oneSecond') {
            event.preventDefault();
            revealForOneSecond();
            return;
        }

        if (event.key.toLowerCase() === 'm') {
            event.preventDefault();
            panel?._toggle?.();
        }
    }

    function installManualTargetSelection() {
        document.addEventListener('click', event => {
            if (!manualSelectionActive) return;
            if (event.target.closest?.(`#${PANEL_ID}`)) return;

            manualSelectionActive = false;
            const clickedCanvas = document.elementsFromPoint(event.clientX, event.clientY)
                .find(element => element instanceof HTMLCanvasElement && element.id !== OVERLAY_ID);

            if (!clickedCanvas) {
                setStatus(UI.noCanvas, true);
                return;
            }

            if (!isPanoramaCanvas(clickedCanvas)) {
                setStatus(UI.mapSelected, true);
                return;
            }

            resetTargetVisuals();
            targetCanvas = clickedCanvas;
            applyMode();
            const rect = clickedCanvas.getBoundingClientRect();
            setStatus(UI.viewSelected(Math.round(rect.width), Math.round(rect.height)));
        }, true);
    }

    function installAutomaticOneSecondTriggers() {
        // Detect the round counter when Lostgamer displays it in the DOM.
        window.setInterval(() => {
            if (currentMode !== 'oneSecond') return;
            const marker = extractRoundMarker();
            if (marker && marker !== lastRoundMarker) {
                const hadPreviousMarker = Boolean(lastRoundMarker);
                lastRoundMarker = marker;
                if (hadPreviousMarker) window.setTimeout(revealForOneSecond, 150);
            }
        }, 500);

        // Fallback for the usual round-change buttons.
        document.addEventListener('click', event => {
            if (currentMode !== 'oneSecond') return;
            const button = event.target.closest?.('button,[role="button"]');
            if (!button || button.closest(`#${PANEL_ID}`)) return;
            const text = (button.textContent || '').trim().toLowerCase();
            if (/next round|next location|continue|play again|start game|manche suivante|continuer|rejouer|commencer/.test(text)) {
                window.setTimeout(revealForOneSecond, 300);
            }
        }, true);
    }

    function boot() {
        createPanel();
        document.addEventListener('keydown', handleKeyboard, true);

        const observer = new MutationObserver(() => scheduleScan(100));
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-engine'],
        });

        window.addEventListener('resize', () => {
            scheduleScan(50);
            if (visualOverlay) positionVisualOverlay();
        }, { passive: true });

        // Lightweight phase check: remove the effect even if Lostgamer expands
        // the map without recreating a DOM node.
        window.setInterval(() => {
            if (targetCanvas || visualOverlay || /\/guessr\/game\//.test(location.pathname)) {
                scanForTarget();
            }
        }, 250);

        // SPAs can change the URL without reloading the page.
        window.setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                lastRoundMarker = '';
                scheduleScan(250);
                if (currentMode === 'oneSecond') window.setTimeout(revealForOneSecond, 600);
            }
        }, 500);

        installManualTargetSelection();
        installAutomaticOneSecondTriggers();
        scheduleScan(0);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
