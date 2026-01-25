// modules/road-marking-detector.js - Détection automatique de marquages routiers
// Version améliorée avec OpenCV.js + algorithmes avancés de post-traitement
//
// 🎨 FONCTIONNALITÉS:
// ===================
// • Détection automatique des lignes de marquage routier (continues, pointillées)
// • Sélection de zone d'intérêt par rectangle
// • Filtrage intelligent des lignes (orientation, longueur, espacement)
// • Post-traitement pour connecter les segments et éliminer le bruit
// • Paramètres ajustables en temps réel via panneau de configuration
// • Export des marquages tracés en vectoriel (Fabric.js)
//
// 🔧 TECHNOLOGIES:
// ================
// • OpenCV.js - Bibliothèque de vision par ordinateur
// • Transformée de Hough probabiliste - Détection de lignes
// • Opérations morphologiques - Nettoyage et connexion
// • Filtrage par orientation et longueur - Qualité des résultats
//
// 📖 UTILISATION:
// ===============
// 1. Charger OpenCV.js (automatique au premier lancement)
// 2. Cliquer sur le bouton "🛣️ Marquages" dans la toolbar
// 3. Tracer un rectangle sur la zone à analyser
// 4. Ajuster les paramètres si nécessaire dans le panneau de configuration
// 5. Les marquages détectés sont automatiquement tracés sur le canvas

(function() {
    'use strict';

    /**
     * Gestionnaire de détection de marquages routiers
     * Utilise OpenCV.js pour la détection de lignes avec post-traitement avancé
     */
    class RoadMarkingDetector {
        constructor(state, layerManager, canvasManager) {
            this.state = state;
            this.layerManager = layerManager;
            this.canvasManager = canvasManager;

            // Configuration par défaut optimisée pour les marquages routiers
            this.config = {
                // Couleur et épaisseur du tracé
                lineColor: '#FFFFFF',
                lineThickness: 3,
                lineOpacity: 1.0,

                // Prétraitement
                useGaussianBlur: true,
                blurKernelSize: 3,
                useMorphology: true,
                morphKernelSize: 3,
                morphIterations: 2,

                // Détection de contours (Canny)
                cannyLowThreshold: 50,
                cannyHighThreshold: 150,
                useAdaptiveThreshold: false,

                // Transformée de Hough
                houghRho: 1,                    // Résolution distance (pixels)
                houghTheta: Math.PI / 180,      // Résolution angle (radians)
                houghThreshold: 50,             // Seuil de votes minimaux
                houghMinLineLength: 40,         // Longueur minimale des lignes
                houghMaxLineGap: 20,            // Espacement max pour connecter

                // Filtrage des lignes
                minLineLength: 50,              // Longueur minimale après filtrage
                maxLineLength: 2000,            // Longueur maximale
                filterByOrientation: true,
                allowedAngleRange: 20,          // ±20° autour de l'orientation dominante
                dominantAngle: null,            // Angle dominant calculé automatiquement

                // Post-traitement
                enablePostProcessing: true,
                mergeSimilarLines: true,
                mergeAngleThreshold: 5,         // Fusionner si angle < 5°
                mergeDistanceThreshold: 15,     // Fusionner si distance < 15px
                removeOutliers: true,
                outlierDistanceThreshold: 30,   // Écart max par rapport à la tendance

                // Type de marquage
                detectSolidLines: true,
                detectDashedLines: true,
                dashLengthRange: [10, 30],      // Plage de longueur des pointillés
                dashGapRange: [10, 40]          // Plage d'espacement
            };

            // État de l'outil
            this.isActive = false;
            this.isSelecting = false;
            this.selectionRect = null;
            this.currentCanvas = null;
            this.opencv = null;
            this.isLoading = false;
            this.panelVisible = false;

            // Statistiques
            this.stats = {
                totalDetected: 0,
                totalKept: 0,
                processingTime: 0
            };
        }

        // ========== INITIALISATION ==========

        async init() {
            console.log('🛣️ Initialisation du Road Marking Detector...');
            console.log('🔍 Paramètres:', {
                state: !!this.state,
                layerManager: !!this.layerManager,
                canvasManager: !!this.canvasManager
            });

            await this.loadOpenCV();
            this.setupEventListeners();
            this.createConfigPanel();

            console.log('✅ Road Marking Detector initialisé et prêt');
            console.log('🔍 Écouteurs d\'événements configurés pour: road-marking-start, road-marking-stop');
        }

        async loadOpenCV() {
            return new Promise((resolve, reject) => {
                if (typeof cv !== 'undefined') {
                    this.opencv = cv;
                    console.log('✅ OpenCV.js déjà disponible');
                    resolve();
                    return;
                }

                this.isLoading = true;
                this.showLoadingIndicator();

                console.log('⏳ Chargement d\'OpenCV.js...');

                const script = document.createElement('script');
                script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
                script.async = true;

                script.onload = () => {
                    const checkOpenCV = () => {
                        if (typeof cv !== 'undefined' && cv.Mat) {
                            this.opencv = cv;
                            this.isLoading = false;
                            this.hideLoadingIndicator();
                            console.log('✅ OpenCV.js chargé et initialisé');
                            resolve();
                        } else {
                            setTimeout(checkOpenCV, 100);
                        }
                    };
                    checkOpenCV();
                };

                script.onerror = () => {
                    this.isLoading = false;
                    this.hideLoadingIndicator();
                    console.error('❌ Erreur lors du chargement d\'OpenCV.js');
                    reject(new Error('Impossible de charger OpenCV.js'));
                };

                document.head.appendChild(script);
            });
        }

        setupEventListeners() {
            // Démarrage de l'outil
            document.addEventListener('road-marking-start', () => {
                console.log('🛣️ Événement road-marking-start reçu !');
                this.startDetection();
            });

            // Arrêt de l'outil
            document.addEventListener('road-marking-stop', () => {
                console.log('🛣️ Événement road-marking-stop reçu !');
                this.stopDetection();
            });

            // Mise à jour de la configuration
            document.addEventListener('road-marking-config-update', (e) => {
                this.updateConfig(e.detail);
            });

            // événements de canvas pour la sélection
            document.addEventListener('canvas-mouse-down', (e) => {
                if (this.isActive) {
                    this.handleMouseDown(e.detail);
                }
            });

            document.addEventListener('canvas-mouse-move', (e) => {
                if (this.isActive && this.isSelecting) {
                    this.handleMouseMove(e.detail);
                }
            });

            document.addEventListener('canvas-mouse-up', (e) => {
                if (this.isActive && this.isSelecting) {
                    this.handleMouseUp(e.detail);
                }
            });
        }

        createConfigPanel() {
            // Créer le panneau de configuration
            const panel = document.createElement('div');
            panel.id = 'road-marking-config-panel';
            panel.className = 'config-panel';
            panel.style.cssText = `
                position: fixed;
                top: 60px;
                right: 20px;
                width: 320px;
                max-height: 80vh;
                overflow-y: auto;
                background: rgba(30, 30, 30, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 20px;
                z-index: 10001;
                display: none;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                color: #fff;
                font-size: 13px;
            `;

            panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 16px;">⚙️ Configuration Marquages</h3>
                    <button onclick="document.getElementById('road-marking-config-panel').style.display='none'" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">×</button>
                </div>

                <!-- Section: Prétraitement -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px; color: #4CAF50;">🔧 Prétraitement</h4>
                    <label style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input type="checkbox" id="rm-use-blur" ${this.config.useGaussianBlur ? 'checked' : ''} style="margin-right: 8px;">
                        Flou gaussien
                    </label>
                    <div style="margin-left: 20px; margin-bottom: 8px;">
                        <label>Noyau: <span id="rm-blur-kernel-val">${this.config.blurKernelSize}</span></label>
                        <input type="range" id="rm-blur-kernel" min="1" max="7" step="2" value="${this.config.blurKernelSize}" style="width: 100%;">
                    </div>
                    <label style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input type="checkbox" id="rm-use-morph" ${this.config.useMorphology ? 'checked' : ''} style="margin-right: 8px;">
                        Morphologie
                    </label>
                </div>

                <!-- Section: Détection -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px; color: #2196F3;">🔍 Détection (Canny)</h4>
                    <div style="margin-bottom: 8px;">
                        <label>Seuil bas: <span id="rm-canny-low-val">${this.config.cannyLowThreshold}</span></label>
                        <input type="range" id="rm-canny-low" min="10" max="150" value="${this.config.cannyLowThreshold}" style="width: 100%;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label>Seuil haut: <span id="rm-canny-high-val">${this.config.cannyHighThreshold}</span></label>
                        <input type="range" id="rm-canny-high" min="50" max="300" value="${this.config.cannyHighThreshold}" style="width: 100%;">
                    </div>
                </div>

                <!-- Section: Hough -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px; color: #FF9800;">📏 Transformée de Hough</h4>
                    <div style="margin-bottom: 8px;">
                        <label>Seuil: <span id="rm-hough-thresh-val">${this.config.houghThreshold}</span></label>
                        <input type="range" id="rm-hough-thresh" min="10" max="150" value="${this.config.houghThreshold}" style="width: 100%;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label>Longueur min: <span id="rm-hough-minlen-val">${this.config.houghMinLineLength}</span>px</label>
                        <input type="range" id="rm-hough-minlen" min="10" max="100" value="${this.config.houghMinLineLength}" style="width: 100%;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label>Écart max: <span id="rm-hough-gap-val">${this.config.houghMaxLineGap}</span>px</label>
                        <input type="range" id="rm-hough-gap" min="5" max="50" value="${this.config.houghMaxLineGap}" style="width: 100%;">
                    </div>
                </div>

                <!-- Section: Filtrage -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px; color: #9C27B0;">🎯 Filtrage</h4>
                    <div style="margin-bottom: 8px;">
                        <label>Longueur min: <span id="rm-filter-minlen-val">${this.config.minLineLength}</span>px</label>
                        <input type="range" id="rm-filter-minlen" min="10" max="200" value="${this.config.minLineLength}" style="width: 100%;">
                    </div>
                    <label style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input type="checkbox" id="rm-filter-orient" ${this.config.filterByOrientation ? 'checked' : ''} style="margin-right: 8px;">
                        Filtrer par orientation
                    </label>
                    <div style="margin-left: 20px; margin-bottom: 8px;">
                        <label>Tolérance: ±<span id="rm-angle-range-val">${this.config.allowedAngleRange}</span>°</label>
                        <input type="range" id="rm-angle-range" min="5" max="45" value="${this.config.allowedAngleRange}" style="width: 100%;">
                    </div>
                </div>

                <!-- Section: Post-traitement -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px; color: #00BCD4;">✨ Post-traitement</h4>
                    <label style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input type="checkbox" id="rm-enable-post" ${this.config.enablePostProcessing ? 'checked' : ''} style="margin-right: 8px;">
                        Activer le post-traitement
                    </label>
                    <label style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input type="checkbox" id="rm-merge-lines" ${this.config.mergeSimilarLines ? 'checked' : ''} style="margin-right: 8px;">
                        Fusionner lignes similaires
                    </label>
                    <label style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input type="checkbox" id="rm-remove-outliers" ${this.config.removeOutliers ? 'checked' : ''} style="margin-right: 8px;">
                        Supprimer les outliers
                    </label>
                </div>

                <!-- Section: Tracé -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px; color: #E91E63;">🎨 Tracé</h4>
                    <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
                        <label>Couleur:</label>
                        <input type="color" id="rm-line-color" value="${this.config.lineColor}" style="width: 50px;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label>Épaisseur: <span id="rm-line-thickness-val">${this.config.lineThickness}</span>px</label>
                        <input type="range" id="rm-line-thickness" min="1" max="10" value="${this.config.lineThickness}" style="width: 100%;">
                    </div>
                </div>

                <!-- Boutons -->
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button id="rm-reset-config" style="flex: 1; padding: 10px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Réinitialiser</button>
                    <button id="rm-apply-config" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Appliquer</button>
                </div>
            `;

            document.body.appendChild(panel);

            // Attacher les événements
            this.attachConfigPanelEvents();
        }

        attachConfigPanelEvents() {
            const panel = document.getElementById('road-marking-config-panel');

            // Helpers pour mettre à jour les valeurs affichées
            const updateVal = (id, val) => {
                const el = document.getElementById(id + '-val');
                if (el) el.textContent = val;
            };

            // Checkbox et sliders
            const inputs = [
                { id: 'rm-use-blur', config: 'useGaussianBlur', type: 'checkbox' },
                { id: 'rm-blur-kernel', config: 'blurKernelSize', type: 'value', display: 'rm-blur-kernel-val' },
                { id: 'rm-use-morph', config: 'useMorphology', type: 'checkbox' },
                { id: 'rm-canny-low', config: 'cannyLowThreshold', type: 'value', display: 'rm-canny-low-val' },
                { id: 'rm-canny-high', config: 'cannyHighThreshold', type: 'value', display: 'rm-canny-high-val' },
                { id: 'rm-hough-thresh', config: 'houghThreshold', type: 'value', display: 'rm-hough-thresh-val' },
                { id: 'rm-hough-minlen', config: 'houghMinLineLength', type: 'value', display: 'rm-hough-minlen-val' },
                { id: 'rm-hough-gap', config: 'houghMaxLineGap', type: 'value', display: 'rm-hough-gap-val' },
                { id: 'rm-filter-minlen', config: 'minLineLength', type: 'value', display: 'rm-filter-minlen-val' },
                { id: 'rm-filter-orient', config: 'filterByOrientation', type: 'checkbox' },
                { id: 'rm-angle-range', config: 'allowedAngleRange', type: 'value', display: 'rm-angle-range-val' },
                { id: 'rm-enable-post', config: 'enablePostProcessing', type: 'checkbox' },
                { id: 'rm-merge-lines', config: 'mergeSimilarLines', type: 'checkbox' },
                { id: 'rm-remove-outliers', config: 'removeOutliers', type: 'checkbox' },
                { id: 'rm-line-color', config: 'lineColor', type: 'value' },
                { id: 'rm-line-thickness', config: 'lineThickness', type: 'value', display: 'rm-line-thickness-val' }
            ];

            inputs.forEach(input => {
                const el = document.getElementById(input.id);
                if (!el) return;

                el.addEventListener('input', (e) => {
                    const value = input.type === 'checkbox' ? e.target.checked : parseInt(e.target.value);
                    if (input.display) updateVal(input.id, value);
                });
            });

            // Bouton Appliquer
            document.getElementById('rm-apply-config').addEventListener('click', () => {
                const newConfig = {};
                inputs.forEach(input => {
                    const el = document.getElementById(input.id);
                    if (!el) return;
                    const value = input.type === 'checkbox' ? el.checked : parseInt(el.value);
                    newConfig[input.config] = value;
                });
                this.updateConfig(newConfig);
                panel.style.display = 'none';
            });

            // Bouton Réinitialiser
            document.getElementById('rm-reset-config').addEventListener('click', () => {
                // Reset to defaults
                location.reload();
            });
        }

        // ========== GESTION DE L'OUTIL ==========

        startDetection() {
            console.log('🛣️ startDetection() appelé');
            console.log('🔍 OpenCV chargé:', !!this.opencv);
            console.log('🔍 State:', !!this.state);
            console.log('🔍 LayerManager:', !!this.layerManager);
            console.log('🔍 CanvasManager:', !!this.canvasManager);

            if (!this.opencv) {
                console.error('❌ OpenCV.js n\'est pas chargé');
                alert('❌ OpenCV.js n\'est pas encore chargé. Veuillez patienter...');
                return;
            }

            const canvas = this.state.getActiveCanvas();
            console.log('🔍 Canvas actif:', !!canvas);
            if (!canvas) {
                console.error('❌ Aucun canvas actif');
                alert('❌ Veuillez d\'abord sélectionner un calque.');
                return;
            }

            const backgroundImage = this.findBackgroundImage();
            console.log('🔍 Image de fond:', !!backgroundImage);
            if (!backgroundImage) {
                console.error('❌ Aucune image de fond trouvée');
                alert('❌ Aucune image de fond trouvée.\n\nVeuillez d\'abord ajouter une image avec le bouton 🖼️.');
                return;
            }

            this.isActive = true;
            this.currentCanvas = canvas;
            this.updateCursor('crosshair');
            this.showInstructions();

            console.log('✅ 🛣️ Outil de détection de marquages activé avec succès');
        }

        stopDetection() {
            this.isActive = false;
            this.isSelecting = false;
            this.selectionRect = null;
            this.removeSelectionVisual();
            this.updateCursor('default');
            this.hideInstructions();

            document.dispatchEvent(new CustomEvent('auto-select-tool'));
            console.log('✅ Outil de détection de marquages désactivé');
        }

        // ========== SÉLECTION DE ZONE ==========

        handleMouseDown(event) {
            if (!this.isActive) return;

            this.isSelecting = true;

            // Utiliser le canvas de l'événement (celui sur lequel on a cliqué)
            this.eventCanvas = event.canvas;

            console.log('🖱️ handleMouseDown - Canvas utilisé:', this.eventCanvas);

            this.selectionRect = {
                startX: event.pointer.x,
                startY: event.pointer.y,
                endX: event.pointer.x,
                endY: event.pointer.y
            };

            this.createSelectionVisual();
        }

        handleMouseMove(event) {
            if (!this.isActive || !this.isSelecting) return;

            this.selectionRect.endX = event.pointer.x;
            this.selectionRect.endY = event.pointer.y;
            this.updateSelectionVisual();
        }

        async handleMouseUp(event) {
            if (!this.isActive || !this.isSelecting) return;

            this.isSelecting = false;
            this.selectionRect.endX = event.pointer.x;
            this.selectionRect.endY = event.pointer.y;
            this.removeSelectionVisual();

            const width = Math.abs(this.selectionRect.endX - this.selectionRect.startX);
            const height = Math.abs(this.selectionRect.endY - this.selectionRect.startY);

            if (width < 20 || height < 20) {
                console.log('⚠️ Zone sélectionnée trop petite');
                return;
            }

            try {
                console.log('🔍 Analyse de la zone...');
                await this.analyzeSelectedArea();
            } catch (error) {
                console.error('❌ Erreur:', error);
                alert('Erreur lors de l\'analyse: ' + error.message);
            }
        }

        createSelectionVisual() {
            this.removeSelectionVisual();

            console.log('🎨 Création du rectangle de sélection visuel');

            // IMPORTANT : Utiliser le canvas de dessin (z-index le plus élevé) pour être visible
            // Chercher le calque de dessin
            const drawingLayer = this.state.layers.find(l =>
                l.name === this.state.DRAWING_LAYER_NAME || l.name === 'Calque de dessin'
            );

            const targetCanvas = drawingLayer?.fabricCanvas || this.eventCanvas || this.currentCanvas;
            console.log('🎨 Canvas cible (calque de dessin):', targetCanvas, 'Nom:', drawingLayer?.name);

            // Vérifier que Fabric.js est disponible
            if (typeof fabric === 'undefined') {
                console.error('❌ Fabric.js n\'est pas disponible');
                return;
            }

            // Désactiver temporairement le système undo/redo pour éviter la suppression automatique
            const prevIsLoadingState = this.state.isLoadingState;
            this.state.isLoadingState = true;

            const rect = new fabric.Rect({
                left: this.selectionRect.startX,
                top: this.selectionRect.startY,
                width: 0,
                height: 0,
                fill: 'rgba(76, 175, 80, 0.1)',
                stroke: '#4CAF50',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
                isSelectionRect: true
            });

            targetCanvas.add(rect);
            this.selectionVisual = rect;
            this.selectionCanvas = targetCanvas; // Mémoriser le canvas utilisé
            targetCanvas.renderAll();

            // Réactiver le système undo/redo après un court délai
            setTimeout(() => {
                this.state.isLoadingState = prevIsLoadingState;
                console.log('✅ Système undo/redo réactivé');
            }, 100);

            console.log('✅ Rectangle de sélection créé sur le calque de dessin (undo/redo désactivé temporairement)');
        }

        updateSelectionVisual() {
            if (!this.selectionVisual) return;

            const left = Math.min(this.selectionRect.startX, this.selectionRect.endX);
            const top = Math.min(this.selectionRect.startY, this.selectionRect.endY);
            const width = Math.abs(this.selectionRect.endX - this.selectionRect.startX);
            const height = Math.abs(this.selectionRect.endY - this.selectionRect.startY);

            this.selectionVisual.set({ left, top, width, height });
            const targetCanvas = this.selectionCanvas || this.eventCanvas || this.currentCanvas;
            targetCanvas.renderAll();
        }

        removeSelectionVisual() {
            if (this.selectionVisual) {
                const targetCanvas = this.selectionCanvas || this.eventCanvas || this.currentCanvas;

                // Désactiver temporairement le système undo/redo
                const prevIsLoadingState = this.state.isLoadingState;
                this.state.isLoadingState = true;

                targetCanvas.remove(this.selectionVisual);
                this.selectionVisual = null;
                targetCanvas.renderAll();

                // Réactiver après un court délai
                setTimeout(() => {
                    this.state.isLoadingState = prevIsLoadingState;
                }, 100);
            }
        }

        // ========== DÉTECTION ET ANALYSE ==========

        async analyzeSelectedArea() {
            const startTime = performance.now();

            console.log('🔍 Début de l\'analyse...');

            const backgroundImage = this.findBackgroundImage();
            const imageCanvas = await this.extractImageRegion(backgroundImage);
            const lines = await this.detectLines(imageCanvas);

            if (this.config.enablePostProcessing) {
                console.log('🔧 Post-traitement des lignes...');
                const processedLines = this.postProcessLines(lines);
                this.drawDetectedLines(processedLines);
            } else {
                this.drawDetectedLines(lines);
            }

            this.stopDetection();

            const processingTime = (performance.now() - startTime).toFixed(0);
            console.log(`✅ Analyse terminée en ${processingTime}ms`);
        }

        async extractImageRegion(backgroundImage) {
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');

            const imgBounds = backgroundImage.getBoundingRect();

            const relX1 = (Math.min(this.selectionRect.startX, this.selectionRect.endX) - imgBounds.left) / imgBounds.width;
            const relY1 = (Math.min(this.selectionRect.startY, this.selectionRect.endY) - imgBounds.top) / imgBounds.height;
            const relX2 = (Math.max(this.selectionRect.startX, this.selectionRect.endX) - imgBounds.left) / imgBounds.width;
            const relY2 = (Math.max(this.selectionRect.startY, this.selectionRect.endY) - imgBounds.top) / imgBounds.height;

            const clampedX1 = Math.max(0, Math.min(1, relX1));
            const clampedY1 = Math.max(0, Math.min(1, relY1));
            const clampedX2 = Math.max(0, Math.min(1, relX2));
            const clampedY2 = Math.max(0, Math.min(1, relY2));

            const imgElement = backgroundImage._element || backgroundImage._originalElement;
            if (!imgElement) {
                throw new Error('Impossible d\'accéder à l\'élément image');
            }

            const sourceX = clampedX1 * imgElement.naturalWidth;
            const sourceY = clampedY1 * imgElement.naturalHeight;
            const sourceWidth = (clampedX2 - clampedX1) * imgElement.naturalWidth;
            const sourceHeight = (clampedY2 - clampedY1) * imgElement.naturalHeight;

            tempCanvas.width = sourceWidth;
            tempCanvas.height = sourceHeight;

            ctx.drawImage(imgElement, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);

            console.log(`📐 Région extraite: ${sourceWidth}x${sourceHeight}px`);
            return tempCanvas;
        }

        async detectLines(imageCanvas) {
            console.log('🧠 Détection des lignes avec OpenCV...');

            const src = this.opencv.imread(imageCanvas);
            const gray = new this.opencv.Mat();
            const processed = new this.opencv.Mat();
            const edges = new this.opencv.Mat();
            const lines = new this.opencv.Mat();

            // Conversion en niveaux de gris
            this.opencv.cvtColor(src, gray, this.opencv.COLOR_RGBA2GRAY);

            // Prétraitement
            if (this.config.useGaussianBlur) {
                const kernelSize = this.config.blurKernelSize;
                this.opencv.GaussianBlur(gray, processed, new this.opencv.Size(kernelSize, kernelSize), 0);
            } else {
                gray.copyTo(processed);
            }

            // Morphologie pour épaissir les lignes
            if (this.config.useMorphology) {
                const kernel = this.opencv.getStructuringElement(
                    this.opencv.MORPH_RECT,
                    new this.opencv.Size(this.config.morphKernelSize, this.config.morphKernelSize)
                );
                for (let i = 0; i < this.config.morphIterations; i++) {
                    this.opencv.morphologyEx(processed, processed, this.opencv.MORPH_CLOSE, kernel);
                }
                kernel.delete();
            }

            // Détection de contours
            this.opencv.Canny(processed, edges, this.config.cannyLowThreshold, this.config.cannyHighThreshold);

            // Transformée de Hough
            this.opencv.HoughLinesP(
                edges,
                lines,
                this.config.houghRho,
                this.config.houghTheta,
                this.config.houghThreshold,
                this.config.houghMinLineLength,
                this.config.houghMaxLineGap
            );

            console.log(`📏 ${lines.rows} lignes brutes détectées`);

            // Convertir et filtrer
            const detectedLines = [];
            for (let i = 0; i < lines.rows; i++) {
                const line = lines.data32S.slice(i * 4, i * 4 + 4);
                const [x1, y1, x2, y2] = line;

                const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

                if (this.shouldKeepLine(length, angle)) {
                    detectedLines.push({
                        x1, y1, x2, y2,
                        length,
                        angle,
                        canvasCoords: this.convertToCanvasCoords(x1, y1, x2, y2)
                    });
                }
            }

            // Nettoyage
            src.delete();
            gray.delete();
            processed.delete();
            edges.delete();
            lines.delete();

            console.log(`✅ ${detectedLines.length} lignes conservées`);
            this.stats.totalDetected = detectedLines.length;

            return detectedLines;
        }

        shouldKeepLine(length, angle) {
            // Filtrer par longueur
            if (length < this.config.minLineLength || length > this.config.maxLineLength) {
                return false;
            }

            // Filtrer par orientation
            if (this.config.filterByOrientation && this.config.dominantAngle !== null) {
                const angleDiff = Math.abs(angle - this.config.dominantAngle);
                if (angleDiff > this.config.allowedAngleRange) {
                    return false;
                }
            }

            return true;
        }

        convertToCanvasCoords(x1, y1, x2, y2) {
            const selectionLeft = Math.min(this.selectionRect.startX, this.selectionRect.endX);
            const selectionTop = Math.min(this.selectionRect.startY, this.selectionRect.endY);

            return {
                x1: selectionLeft + x1,
                y1: selectionTop + y1,
                x2: selectionLeft + x2,
                y2: selectionTop + y2
            };
        }

        // ========== POST-TRAITEMENT ==========

        postProcessLines(lines) {
            console.log('🔧 Post-traitement...');

            let processed = [...lines];

            // Calculer l'angle dominant si nécessaire
            if (this.config.filterByOrientation && this.config.dominantAngle === null) {
                this.config.dominantAngle = this.calculateDominantAngle(processed);
                console.log(`📐 Angle dominant: ${this.config.dominantAngle.toFixed(1)}°`);
            }

            // Fusionner les lignes similaires
            if (this.config.mergeSimilarLines) {
                processed = this.mergeSimilarLines(processed);
            }

            // Supprimer les outliers
            if (this.config.removeOutliers) {
                processed = this.removeOutliers(processed);
            }

            console.log(`✅ ${processed.length} lignes après post-traitement`);
            this.stats.totalKept = processed.length;

            return processed;
        }

        calculateDominantAngle(lines) {
            // Histogramme des angles
            const bins = {};
            lines.forEach(line => {
                const bin = Math.round(line.angle / 5) * 5; // Bins de 5°
                bins[bin] = (bins[bin] || 0) + line.length;
            });

            // Trouver l'angle dominant
            let maxCount = 0;
            let dominantAngle = 0;
            for (const [angle, count] of Object.entries(bins)) {
                if (count > maxCount) {
                    maxCount = count;
                    dominantAngle = parseFloat(angle);
                }
            }

            return dominantAngle;
        }

        mergeSimilarLines(lines) {
            const merged = [];
            const used = new Set();

            for (let i = 0; i < lines.length; i++) {
                if (used.has(i)) continue;

                let currentLine = { ...lines[i] };
                used.add(i);

                for (let j = i + 1; j < lines.length; j++) {
                    if (used.has(j)) continue;

                    const line2 = lines[j];
                    const angleDiff = Math.abs(currentLine.angle - line2.angle);
                    const dist = this.lineDistance(currentLine, line2);

                    if (angleDiff < this.config.mergeAngleThreshold && dist < this.config.mergeDistanceThreshold) {
                        // Fusionner les lignes
                        currentLine = this.mergeTwoLines(currentLine, line2);
                        used.add(j);
                    }
                }

                merged.push(currentLine);
            }

            return merged;
        }

        lineDistance(line1, line2) {
            // Distance moyenne entre les lignes
            const d1 = Math.sqrt((line1.x1 - line2.x1) ** 2 + (line1.y1 - line2.y1) ** 2);
            const d2 = Math.sqrt((line1.x2 - line2.x2) ** 2 + (line1.y2 - line2.y2) ** 2);
            return (d1 + d2) / 2;
        }

        mergeTwoLines(line1, line2) {
            // Fusion simple: prendre la ligne la plus longue
            return line1.length > line2.length ? line1 : line2;
        }

        removeOutliers(lines) {
            if (lines.length < 3) return lines;

            // Calculer les distances moyennes
            const avgDist = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
            const stdDev = Math.sqrt(
                lines.reduce((sum, line) => sum + (line.length - avgDist) ** 2, 0) / lines.length
            );

            // Filtrer les outliers
            return lines.filter(line => {
                const zScore = Math.abs(line.length - avgDist) / stdDev;
                return zScore < 2;
            });
        }

        // ========== TRACÉ ==========

        drawDetectedLines(lines) {
            console.log(`🎨 Tracé de ${lines.length} lignes...`);

            const canvas = this.currentCanvas;
            let drawnCount = 0;

            lines.forEach((line, index) => {
                try {
                    const fabricLine = new fabric.Line([
                        line.canvasCoords.x1,
                        line.canvasCoords.y1,
                        line.canvasCoords.x2,
                        line.canvasCoords.y2
                    ], {
                        stroke: this.config.lineColor,
                        strokeWidth: this.config.lineThickness,
                        selectable: true,
                        evented: true,
                        isRoadMarking: true,
                        markingIndex: index
                    });

                    canvas.add(fabricLine);
                    drawnCount++;
                } catch (error) {
                    console.warn(`⚠️ Erreur tracé ligne ${index}:`, error);
                }
            });

            canvas.renderAll();

            // Sauvegarder l'état
            if (this.layerManager.undoRedoManager) {
                this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
            }

            console.log(`✅ ${drawnCount} lignes tracées`);

            // Afficher le panneau de configuration pour ajustements
            document.getElementById('road-marking-config-panel').style.display = 'block';

            alert(`✨ Détection terminée !\n\n${drawnCount} marquages détectés et tracés.\n\nUtilisez le panneau de configuration pour ajuster les paramètres si nécessaire.`);
        }

        // ========== UTILITAIRES ==========

        findBackgroundImage() {
            for (const layer of this.state.layers) {
                if (layer.name === this.state.DRAWING_LAYER_NAME || layer.name === 'Calque de dessin') {
                    continue;
                }

                if (layer.fabricCanvas) {
                    if (layer.fabricCanvas.backgroundImage) {
                        return layer.fabricCanvas.backgroundImage;
                    }

                    const imageObj = layer.fabricCanvas.getObjects().find(obj => obj.type === 'image');
                    if (imageObj) {
                        return imageObj;
                    }
                }
            }
            return null;
        }

        updateCursor(cursor) {
            const canvasContainer = document.getElementById('canvas-container');
            if (canvasContainer) {
                canvasContainer.style.cursor = cursor;
            }
        }

        updateConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
            console.log('⚙️ Configuration mise à jour:', this.config);
        }

        showInstructions() {
            const instructions = document.createElement('div');
            instructions.id = 'road-marking-instructions';
            instructions.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 15px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 10002;
                max-width: 300px;
                border: 1px solid rgba(76, 175, 80, 0.3);
            `;
            instructions.innerHTML = `
                <strong>🛣️ Détection de Marquages</strong><br>
                📝 Tracez un rectangle sur la zone à analyser<br>
                🔍 Les marquages seront détectés automatiquement<br>
                ⚙️ Ajustez les paramètres dans le panneau de configuration<br>
                <br>
                <button onclick="document.dispatchEvent(new CustomEvent('road-marking-stop'))" style="background: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Annuler</button>
            `;

            document.body.appendChild(instructions);

            setTimeout(() => {
                const el = document.getElementById('road-marking-instructions');
                if (el) el.remove();
            }, 10000);
        }

        hideInstructions() {
            const el = document.getElementById('road-marking-instructions');
            if (el) el.remove();
        }

        showLoadingIndicator() {
            const indicator = document.createElement('div');
            indicator.id = 'road-marking-loading';
            indicator.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 30px;
                border-radius: 8px;
                z-index: 10003;
                text-align: center;
            `;
            indicator.innerHTML = `
                <div style="font-size: 24px; margin-bottom: 15px;">⏳</div>
                <div>Chargement d'OpenCV.js...</div>
                <div style="font-size: 12px; margin-top: 10px; color: #888;">Ceci peut prendre quelques secondes</div>
            `;

            document.body.appendChild(indicator);
        }

        hideLoadingIndicator() {
            const el = document.getElementById('road-marking-loading');
            if (el) el.remove();
        }

        getStatus() {
            return {
                isActive: this.isActive,
                isSelecting: this.isSelecting,
                opencvLoaded: !!this.opencv,
                isLoading: this.isLoading,
                config: this.config,
                stats: this.stats
            };
        }
    }

    // Exposer dans le namespace global
    if (typeof window !== 'undefined') {
        window.PlanEditor.RoadMarkingDetector = RoadMarkingDetector;
        console.log('✅ RoadMarkingDetector exposé dans PlanEditor');
    }

})();
