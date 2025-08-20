// modules/state.js - Version sans modules ES6
(function() {
    'use strict';
    
    // Gestionnaire d'état global
    class StateManager {
        constructor() {
            // État global de l'application
            this.layers = [];
            this.activeLayerId = null;
            this.currentMode = 'select';
            this.layerCounter = 0;
            this.isDrawing = false;
            this.startPoint = null;
            this.guideShape = null;
            this.guideMeasureText = null;
            this.isDraggingLayer = false;
            this.isPanning = false;
            this.isCleaningUpProjections = false;
            this.isCleaningUpMeasure = false;
            this.clipboard = null;
            this.workflowState = 'start';
            this.isLoadingState = false;
            this.isCreatingNewProject = false;
            this.isSelectingArea = false;
            this.isDraggingSelection = false;
            this.isCreatingCurve = false;
            this.isModifyingControlPoint = false;
            this.hasPendingCurveSave = false;
            this.selectionStartPoint = { x: 0, y: 0 };
            this.selectionBox = null;
            this.isFullscreenMode = false;
            this.uiHideTimeout = null;
            this.isManualOrderChange = false;

            // Configuration
            this.fabricPropertiesToInclude = [
                'isBaseline', 'isZeroPoint', 'isProjectionElement', 'isLandmark', 'isVehicle',
                'isMeasurement', 'isScaleBar', 'isControlPoint', 'isStriped', 'stripeAngle',
                'stripeColor', 'stripeThickness', 'originalColor', 'id', 'measureId', 'projectionId',
                'projectionVehicleId', 'projectionLandmarkId', 'projectionCorner', 'projectionRole',
                'suppressedCorners', 'name', 'backgroundImage'
            ];

            // Informations d'échelle
            this.scaleInfo = { 
                ratio: 0, 
                userDefinedScaleDenominator: null,
                finalScaleDenominator: null,
                cropZoomFactor: 1
            };

            // Zoom
            this.zoom = 1;
            this.zoomDisplayMode = 'percent';
            this.MIN_ZOOM = 0.1;
            this.MAX_ZOOM = 10;
            this.isEditingZoom = false;
            this.isZoomLocked = false;

            // Constantes
            this.DRAWING_LAYER_NAME = "Calque de dessin";
            this.GEOPORTAIL_URL = "https://geoportail.wallonie.be/walonmap#SHARE=393E6849BD620D95E0630CB6A49D065D";
            
            // Données des panneaux (chargées depuis fichier externe)
            this.signsData = [];
            this.signsDataLoaded = false;
            this.loadSignsData();
        }

        // Getters pour l'état
        getActiveLayer() {
            return this.layers.find(l => l.id === this.activeLayerId);
        }

        getActiveCanvas() {
            const layer = this.getActiveLayer();
            return layer ? layer.fabricCanvas : null;
        }

        // Setters avec validation
        setCurrentMode(mode) {
            this.currentMode = mode;
            this.notifyModeChange(mode);
        }

        setWorkflowState(state) {
            this.workflowState = state;
            this.notifyWorkflowStateChange(state);
        }

        setActiveLayer(id) {
            this.activeLayerId = id;
            this.notifyActiveLayerChange(id);
        }

        // Système de notifications pour les changements d'état
        notifyModeChange(mode) {
            document.dispatchEvent(new CustomEvent('mode-changed', { detail: { mode } }));
        }

        notifyWorkflowStateChange(state) {
            document.dispatchEvent(new CustomEvent('workflow-state-changed', { detail: { state } }));
        }

        notifyActiveLayerChange(id) {
            document.dispatchEvent(new CustomEvent('active-layer-changed', { detail: { id } }));
        }

        notifyLayersUpdated() {
            document.dispatchEvent(new CustomEvent('layers-updated'));
        }

        // Méthodes utilitaires
        incrementLayerCounter() {
            return ++this.layerCounter;
        }

        reset() {
            this.layers = [];
            this.activeLayerId = null;
            this.currentMode = 'select';
            this.layerCounter = 0;
            this.workflowState = 'start';
            this.isCreatingNewProject = false;
            this.scaleInfo = { 
                ratio: 0, 
                userDefinedScaleDenominator: null,
                finalScaleDenominator: null,
                cropZoomFactor: 1
            };
            this.zoom = 1;
            this.zoomDisplayMode = 'percent';
        }

        // Méthodes de sérialisation pour la sauvegarde/chargement
        serializeForSave() {
            return {
                version: '1.0',
                timestamp: new Date().toISOString(),
                state: {
                    layerCounter: this.layerCounter,
                    workflowState: this.workflowState,
                    scaleInfo: this.scaleInfo,
                    zoom: this.zoom,
                    zoomDisplayMode: this.zoomDisplayMode,
                    isZoomLocked: this.isZoomLocked
                },
                layers: this.layers.map(layer => ({
                    id: layer.id,
                    name: layer.name,
                    visible: layer.visible,
                    opacity: layer.opacity,
                    x: layer.x,
                    y: layer.y,
                    angle: layer.angle,
                    scaleDenominator: layer.scaleDenominator,
                    backgroundImage: layer.backgroundImage,
                    // Ajouter les dimensions du canvas
                    width: layer.fabricCanvas ? layer.fabricCanvas.width : null,
                    height: layer.fabricCanvas ? layer.fabricCanvas.height : null,
                    canvasState: layer.fabricCanvas ? layer.fabricCanvas.toJSON(this.fabricPropertiesToInclude) : null
                }))
            };
        }

        deserializeFromSave(saveData) {
            if (!saveData || !saveData.version) {
                throw new Error('Format de sauvegarde invalide');
            }

            // Restaurer l'état général
            this.layerCounter = saveData.state.layerCounter || 0;
            this.workflowState = saveData.state.workflowState || 'start';
            this.scaleInfo = saveData.state.scaleInfo || { 
                ratio: 0, 
                userDefinedScaleDenominator: null,
                finalScaleDenominator: null,
                cropZoomFactor: 1
            };
            this.zoom = saveData.state.zoom || 1;
            this.zoomDisplayMode = saveData.state.zoomDisplayMode || 'percent';
            this.isZoomLocked = saveData.state.isZoomLocked || false;

            return saveData.layers;
        }

        // Charger les données des panneaux depuis le fichier externe
        async loadSignsData() {
            try {
                // Créer un script pour charger le fichier signs.txt
                const script = document.createElement('script');
                script.src = './signs.txt';
                
                // Promesse pour attendre le chargement du script
                const scriptLoadPromise = new Promise((resolve, reject) => {
                    script.onload = () => {
                        // Le fichier signs.txt définit une variable globale signsData
                        if (window.signsData && Array.isArray(window.signsData)) {
                            this.signsData = window.signsData;
                            this.signsDataLoaded = true;
                            console.log('✅ Panneaux chargés depuis signs.txt:', this.signsData.length, 'panneau(x)');
                            
                            // Nettoyer la variable globale
                            delete window.signsData;
                            
                            resolve();
                        } else {
                            reject(new Error('Variable signsData non trouvée dans signs.txt'));
                        }
                    };
                    
                    script.onerror = () => {
                        reject(new Error('Erreur lors du chargement de signs.txt'));
                    };
                });
                
                // Ajouter le script au document
                document.head.appendChild(script);
                
                // Attendre le chargement
                await scriptLoadPromise;
                
                // Supprimer le script du DOM
                document.head.removeChild(script);
                
                // Déclencher un événement pour notifier que les panneaux sont chargés
                document.dispatchEvent(new CustomEvent('signs-data-loaded'));
                
            } catch (error) {
                console.warn('⚠️ Impossible de charger signs.txt, utilisation du panneau par défaut:', error);
                // Panneau par défaut en cas d'erreur
                this.signsData = [
                    {
                        name: "Stop",
                        dataUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBvbHlnb24gcG9pbnRzPSIzMiwyIDUyLDEyIDYyLDMyIDUyLDUyIDMyLDYyIDEyLDUyIDIsIDMyIDEyLDEyIiBmaWxsPSIjREEwMDAwIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSIzMiIgeT0iMzgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IndoaXRlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSJib2xkIj5TVE9QPC90ZXh0Pgo8L3N2Zz4K"
                    }
                ];
                this.signsDataLoaded = true;
                document.dispatchEvent(new CustomEvent('signs-data-loaded'));
            }
        }

        // Vérifier si les panneaux sont déjà chargés
        areSignsLoaded() {
            return this.signsDataLoaded;
        }
    }

    // Exposer dans le namespace global
    window.PlanEditor.StateManager = StateManager;

})();