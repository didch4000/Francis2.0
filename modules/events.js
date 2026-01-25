// modules/events.js - Version sans modules ES6
(function() {
    'use strict';
    
    // Gestionnaire des événements
    class EventManager {
        constructor(state, layerManager, canvasManager, toolsManager, uiManager, exportManager) {
            this.state = state;
            this.layerManager = layerManager;
            this.canvasManager = canvasManager;
            this.toolsManager = toolsManager;
            this.uiManager = uiManager;
            this.exportManager = exportManager;
        }

        init() {
            this.setupToolbarEvents();
            this.setupZoomEvents();
            this.setupLayerEvents();
            this.setupModalEvents();
            this.setupKeyboardEvents();
            this.setupMouseEvents();
            this.setupTouchEvents();
            this.setupCustomEvents();
            this.setupProjectionEvents();
            this.setupFullscreenEvents();

            // ✅ FIX : Réinitialiser les options par défaut pour tous les sélecteurs
            this.resetDefaultDrawingOptions();
        }

        // ✅ NOUVELLE MÉTHODE : Réinitialiser les options par défaut (noir, trait fin)
        resetDefaultDrawingOptions() {
            const defaultColor = '#000000'; // Noir
            const defaultThickness = '2'; // Trait fin

            // Sélecteurs de dessin
            const colorPicker = document.getElementById('color-picker');
            const thicknessSelector = document.getElementById('thickness-selector');

            // Sélecteurs de forme
            const colorPickerShape = document.getElementById('color-picker-shape');
            const thicknessSelectorShape = document.getElementById('thickness-selector-shape');

            // Sélecteur de texte
            const colorPickerText = document.getElementById('color-picker-text');

            // Appliquer les valeurs par défaut
            if (colorPicker) colorPicker.value = defaultColor;
            if (thicknessSelector) thicknessSelector.value = defaultThickness;
            if (colorPickerShape) colorPickerShape.value = defaultColor;
            if (thicknessSelectorShape) thicknessSelectorShape.value = defaultThickness;
            if (colorPickerText) colorPickerText.value = defaultColor;

            console.log('✅ Options par défaut réinitialisées: couleur noir, épaisseur 2 (trait fin)');
        }

        setupToolbarEvents() {
            // Boutons d'outils
            const allToolButtons = document.querySelectorAll('.toolbar button.tool');
            allToolButtons.forEach(btn => {
                if (btn.id !== 'btn-add-text' && btn.id !== 'btn-undo' && btn.id !== 'btn-redo') {
                    btn.addEventListener('click', () => {
                        this.toolsManager.setMode(btn.id.replace('btn-', ''));
                    });
                }
            });

            // Boutons spéciaux
            document.getElementById('btn-add-text').addEventListener('click', () => {
                this.toolsManager.setMode('add-text');
            });

            document.getElementById('btn-undo').addEventListener('click', () => {
                this.layerManager.undoRedoManager.undo();
            });

            document.getElementById('btn-redo').addEventListener('click', () => {
                this.layerManager.undoRedoManager.redo();
            });

            // Boutons d'objets
            document.getElementById('btn-add-signs').addEventListener('click', () => {
                this.uiManager.showSignsModal();
            });

            document.getElementById('btn-add-car').addEventListener('click', () => {
                console.log('🚗 CLICK sur btn-add-car détecté');
                this.showVehicleModal();
            });

            document.getElementById('btn-add-arrow').addEventListener('click', () => {
                this.toolsManager.setMode('arrow');
            });

            document.getElementById('btn-add-landmark').addEventListener('click', () => {
                this.showLandmarkModal();
            });


            // Boutons d'export
            document.getElementById('btn-instructions').addEventListener('click', () => {
                this.openInstructionsFile();
            });

            document.getElementById('btn-export-png').addEventListener('click', () => {
                this.exportManager.exportToPNG();
            });

            document.getElementById('btn-export-pdf').addEventListener('click', () => {
                this.exportManager.promptForPDFExport();
            });

            // Boutons de projet - Gestion déléguée au ToolsManager pour éviter les doublons

            // Bouton vue web
            document.getElementById('btn-toggle-webview').addEventListener('click', () => {
                window.open(this.state.GEOPORTAIL_URL, '_blank');
            });

            // Contrôles d'options
            this.setupOptionControls();
        }

        setupOptionControls() {
            // Contrôles de remplissage
            this.uiManager.setupFillTypeRadioListeners();
            this.uiManager.setupStripeAngleSlider();
            this.uiManager.setupStripeThicknessSlider();
            this.uiManager.setupStripeColorPicker();
            this.uiManager.setupFillToleranceSlider();

            // Contrôle d'épaisseur
            const thicknessSelector = document.getElementById('thickness-selector');
            thicknessSelector.addEventListener('change', () => {
                const canvas = this.state.getActiveCanvas();
                if (canvas && canvas.isDrawingMode) {
                    canvas.freeDrawingBrush.width = parseInt(thicknessSelector.value, 10);
                }
            });

            // Contrôles de repères
            this.uiManager.setupLandmarkVisibilityControls();

            // Synchronisation des contrôles shape avec les contrôles drawing
            this.setupShapeControlsSync();
        }

        setupShapeControlsSync() {
            const colorPicker = document.getElementById('color-picker');
            const thicknessSelector = document.getElementById('thickness-selector');
            const colorPickerShape = document.getElementById('color-picker-shape');
            const thicknessSelectorShape = document.getElementById('thickness-selector-shape');
            const colorPickerText = document.getElementById('color-picker-text');
            const colorPickerFill = document.getElementById('color-picker-fill');

            // Synchronisation des couleurs entre tous les groupes d'options
            if (colorPicker && colorPickerShape) {
                // Synchroniser couleur shape -> drawing
                colorPickerShape.addEventListener('change', () => {
                    colorPicker.value = colorPickerShape.value;
                    if (colorPickerText) colorPickerText.value = colorPickerShape.value;
                    if (colorPickerFill) colorPickerFill.value = colorPickerShape.value;
                });
                // Synchroniser couleur drawing -> shape
                colorPicker.addEventListener('change', () => {
                    colorPickerShape.value = colorPicker.value;
                    if (colorPickerText) colorPickerText.value = colorPicker.value;
                    if (colorPickerFill) colorPickerFill.value = colorPicker.value;
                });
            }

            // Synchronisation couleur texte avec les autres
            if (colorPicker && colorPickerText) {
                // Synchroniser couleur text -> drawing
                colorPickerText.addEventListener('change', () => {
                    colorPicker.value = colorPickerText.value;
                    if (colorPickerShape) colorPickerShape.value = colorPickerText.value;
                    if (colorPickerFill) colorPickerFill.value = colorPickerText.value;
                });
            }

            // Synchronisation couleur remplissage avec les autres
            if (colorPicker && colorPickerFill) {
                // Synchroniser couleur fill -> drawing
                colorPickerFill.addEventListener('change', () => {
                    colorPicker.value = colorPickerFill.value;
                    if (colorPickerShape) colorPickerShape.value = colorPickerFill.value;
                    if (colorPickerText) colorPickerText.value = colorPickerFill.value;
                });
            }

            if (thicknessSelector && thicknessSelectorShape) {
                // Synchroniser épaisseur shape -> drawing
                thicknessSelectorShape.addEventListener('change', () => {
                    thicknessSelector.value = thicknessSelectorShape.value;
                    const canvas = this.state.getActiveCanvas();
                    if (canvas && canvas.isDrawingMode) {
                        canvas.freeDrawingBrush.width = parseInt(thicknessSelectorShape.value, 10);
                    }
                });
                // Synchroniser épaisseur drawing -> shape
                thicknessSelector.addEventListener('change', () => {
                    thicknessSelectorShape.value = thicknessSelector.value;
                });
            }
        }

        setupZoomEvents() {
            const btnZoomIn = document.getElementById('btn-zoom-in');
            const btnZoomOut = document.getElementById('btn-zoom-out');

            btnZoomIn.addEventListener('click', () => {
                if (!this.state.isZoomLocked) {
                    this.applyZoom(this.state.zoom * 1.25);
                }
            });

            btnZoomOut.addEventListener('click', () => {
                if (!this.state.isZoomLocked) {
                    this.applyZoom(this.state.zoom / 1.25);
                }
            });

            this.uiManager.setupZoomLevelClickHandler();
        }

        setupLayerEvents() {
            // Boutons de gestion des calques
            document.getElementById('add-image-btn').addEventListener('click', () => {
                this.uiManager.showAddLayerModal('base');
            });

            document.getElementById('add-image-layer-btn').addEventListener('click', () => {
                this.uiManager.showAddLayerModal('subsequent');
            });

            document.getElementById('start-drawing-btn').addEventListener('click', (e) => {
                // Protection supplémentaire - vérifier si le bouton est désactivé ou si on est en cours de chargement
                if (e.target.disabled || this.state.isLoadingState) {
                    console.log('🚫 [START-DRAWING-BTN] Clic bloqué - bouton désactivé ou chargement en cours');
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                // Masquer la bulle de guidage et le message de guidage de l'étape 2 quand on clique sur le bouton
                if (this.uiManager) {
                    this.uiManager.hideDrawingGuideTooltip();
                }
                
                // Masquer le message de guidage de l'étape 2 (orienter le plan)
                if (this.state.workflowState === 'scale_calibrated') {
                    const guideMessage = document.getElementById('guide-message');
                    if (guideMessage) {
                        guideMessage.style.display = 'none';
                    }
                }
                
                this.handleStartDrawing();
            });



            // Gestion des fichiers
            this.setupFileEvents();

            // Gestion du bouton Drone
            const btnImportDrone = document.getElementById('btn-import-drone');
            if (btnImportDrone) {
                btnImportDrone.addEventListener('click', () => {
                    const droneLoader = document.getElementById('drone-layer-loader');
                    if (droneLoader) droneLoader.click();
                });
            }
        }

        setupFileEvents() {
            const imageLoader = document.getElementById('image-loader');
            const imageLayerLoader = document.getElementById('image-layer-loader');
            const droneLayerLoader = document.getElementById('drone-layer-loader');

            imageLoader.addEventListener('change', (e) => {
                this.handleFileLoad(e, 'base');
            });

            imageLayerLoader.addEventListener('change', (e) => {
                this.handleFileLoad(e, 'subsequent');
            });

            if (droneLayerLoader) {
                droneLayerLoader.addEventListener('change', (e) => {
                    this.handleDroneFileLoad(e);
                });
            }

            // Gestion des panneaux personnalisés
            document.body.addEventListener('change', (e) => {
                if (e.target.id === 'custom-sign-loader') {
                    this.handleCustomSignLoad(e);
                }
            });
        }

        setupModalEvents() {
            // Fermeture des modales
            const modals = [
                'signs-modal', 'alignment-guide-modal', 'legend-modal', 'add-layer-modal'
                // NOTE: 'landmark-modal' et 'vehicle-modal' sont gérées par leurs propres systèmes spécialisés
            ];

            modals.forEach(modalId => {
                const modal = document.getElementById(modalId);
                const closeBtn = modal.querySelector('.close-button');
                
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        modal.style.display = 'none';
                    });
                }

                // Fermeture en cliquant à l'extérieur
                window.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                    }
                });
            });

            // Bouton de validation de l'alignement (spécifique Drone)
            const btnValidateAlignment = document.getElementById('btn-validate-alignment');
            if (btnValidateAlignment) {
                btnValidateAlignment.addEventListener('click', () => {
                    this.handleAlignmentValidation();
                });
            }

            // Modal d'ajout de calque
            this.setupAddLayerModalEvents();
        }

        handleAlignmentValidation() {
            if (!this.state.isDroneImport) return;

            console.log('🚁 Validation de l\'alignement Drone');
            this.uiManager.hideAlignmentGuideModal();

            // Fin du mode import drone
            this.state.isDroneImport = false;

            // ✅ FIX : Réinitialiser les options par défaut (noir, trait fin) après l'alignement
            this.resetDefaultDrawingOptions();

            // Trouver le calque drone
            const droneLayer = this.state.layers.find(l => l.name === "Vue Drone");
            if (!droneLayer) {
                console.error("Calque drone introuvable");
                return;
            }

            // Verrouiller le calque drone
            droneLayer.locked = true;
            if (this.uiManager) this.uiManager.updateLayersPanel();

            // Créer le calque de dessin par dessus
            const width = droneLayer.fabricCanvas.width;
            const height = droneLayer.fabricCanvas.height;

            // S'assurer que le calque de dessin n'existe pas déjà
            if (!this.state.layers.some(l => l.name === this.state.DRAWING_LAYER_NAME)) {
                this.layerManager.createLayer(this.state.DRAWING_LAYER_NAME, null, {
                    width: width,
                    height: height,
                    x: 0,
                    y: 0,
                    pixelRatio: window.devicePixelRatio
                });
            }

            const drawingLayer = this.state.getActiveLayer();
            
            // Configurer le canvas du calque de dessin
            this.canvasManager.setupCanvasListeners(drawingLayer.fabricCanvas);

            this.state.setWorkflowState('ready_for_drawing');
            
            // Déverrouiller le zoom
            this.state.isZoomLocked = false;
            
            // Appliquer le zoom final si défini
            if (this.state.scaleInfo.finalScaleDenominator && this.state.scaleInfo.userDefinedScaleDenominator) {
                const finalZoom = this.state.scaleInfo.userDefinedScaleDenominator / this.state.scaleInfo.finalScaleDenominator;
                console.log('🚁 [DRONE] Application du zoom final:', finalZoom);
                this.applyZoom(finalZoom, true);
            }

            // Mettre à jour l'interface
            document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
            
            // Activer l'outil sélection
            this.toolsManager.setMode('select');

            // Cacher le message de guidage
            const guideMessage = document.getElementById('guide-message');
            if (guideMessage) guideMessage.style.display = 'none';
        }

        setupAddLayerModalEvents() {
            const btnLoadFromFile = document.getElementById('btn-load-from-file');
            const btnPasteFromClipboard = document.getElementById('btn-paste-from-clipboard');

            btnLoadFromFile.addEventListener('click', () => {
                const addLayerModal = document.getElementById('add-layer-modal');
                const layerType = addLayerModal.dataset.layerType;
                if (layerType === 'base') {
                    document.getElementById('image-loader').click();
                } else {
                    document.getElementById('image-layer-loader').click();
                }
                this.uiManager.hideAddLayerModal();
            });

            btnPasteFromClipboard.addEventListener('click', async () => {
                this.uiManager.hideAddLayerModal();
                await this.handleClipboardPaste();
            });
        }

        setupKeyboardEvents() {
            window.addEventListener('keydown', (e) => {
                this.handleKeyDown(e);
            });
        }

        setupMouseEvents() {
            const canvasContainer = document.getElementById('canvas-container');
            
            canvasContainer.addEventListener('mousedown', (e) => {
                this.handlePointerDown(e);
            });

            window.addEventListener('mousemove', (e) => {
                this.handlePointerMove(e);
                this.uiManager.handleUIVisibility(e);
            });

            window.addEventListener('mouseup', (e) => {
                this.handlePointerUp(e);
            });
        }

        setupTouchEvents() {
            const canvasContainer = document.getElementById('canvas-container');
            
            canvasContainer.addEventListener('touchstart', (e) => {
                this.handlePointerDown(e);
            }, { passive: false });

            window.addEventListener('touchmove', (e) => {
                this.handlePointerMove(e);
                this.uiManager.handleUIVisibility(e);
            }, { passive: false });

            window.addEventListener('touchend', () => {
                this.handlePointerUp();
            });

            window.addEventListener('touchcancel', () => {
                this.handlePointerUp();
            });
        }

        setupCustomEvents() {
            // Événements de zoom
            document.addEventListener('apply-zoom', (e) => {
                this.applyZoom(e.detail.zoom);
            });

            document.addEventListener('update-zoom-display', () => {
                this.uiManager.updateZoomDisplay();
            });

            document.addEventListener('update-scroll-content-size', () => {
                this.updateScrollContentSize();
            });

            // Événements de légende
            document.addEventListener('show-legend-modal', (e) => {
                this.uiManager.showLegendModal(e.detail.defaultLegend);
                this.setupLegendModalSubmit(e.detail.title);
            });
			// Nouveaux événements pour les curseurs
    document.addEventListener('drawing-state-changed', (e) => {
        this.handleDrawingStateChange(e.detail.isDrawing);
    });
    
    document.addEventListener('loading-state-changed', (e) => {
        this.handleLoadingStateChange(e.detail.isLoading);
    });
    
    document.addEventListener('tool-availability-changed', () => {
        this.toolsManager.updateCursor();
    });
    
    // Événement pour mettre à jour l'état des outils de projet
    document.addEventListener('update-project-tools-state', () => {
        this.toolsManager.updateProjectToolsState();
    });
        }

        setupProjectionEvents() {
            document.addEventListener('update-all-projections', () => {
                this.updateAllProjections();
            });
        }

        setupFullscreenEvents() {
            document.getElementById('btn-fullscreen').addEventListener('click', () => {
                this.uiManager.toggleFullscreen();
            });
        }
		
		updateCursorForState(state) {
    const canvasContainer = document.getElementById('canvas-container');
    const toolsManager = this.toolsManager;
    
    console.log(`🔄 Changement d'état curseur: ${state}`);
    
    // Retirer les états précédents
    const stateClasses = ['area-selecting', 'drawing', 'loading-cursor', 'panning-cursor'];
    canvasContainer.classList.remove(...stateClasses);
    
    switch (state) {
        case 'area-selecting':
            canvasContainer.classList.add('area-selecting');
            break;
        case 'drawing':
            canvasContainer.classList.add('drawing');
            break;
        case 'loading':
            canvasContainer.classList.add('loading-cursor');
            break;
        case 'panning':
            canvasContainer.classList.add('panning-cursor');
            break;
        case 'layer-dragging':
            canvasContainer.style.cursor = 'grabbing';
            break;
        case 'normal':
        default:
            // Remettre le curseur normal selon l'outil actuel
            canvasContainer.style.cursor = '';
            toolsManager.updateCursor();
            break;
    }
}

        // Gestionnaires d'événements spécifiques
        handleKeyDown(e) {
            const canvas = this.state.getActiveCanvas();
            const activeObject = canvas?.getActiveObject();

            // Ignorer les entrées dans les champs de texte
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || 
                e.target.tagName === 'SELECT' || (activeObject && activeObject.isEditing)) {
                return;
            }

            // Raccourcis clavier
            if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                this.layerManager.undoRedoManager.undo();
                return;
            }
            if (e.ctrlKey && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.layerManager.undoRedoManager.redo();
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                this.handleEscapeKey();
                return;
            }

            if (!canvas) return;

            // Copier/Coller
            if (e.ctrlKey && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                this.handlePaste();
                return;
            }

            if (!activeObject) return;

            if (e.ctrlKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                this.handleCopy(activeObject);
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                // Assurer que l'objet actif est bien sélectionné avant suppression
                if (activeObject) {
                    canvas.setActiveObject(activeObject);
                    this.handleDelete(canvas);
                }
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                this.handleArrowKeys(e, canvas, activeObject);
            }
        }

        handleEscapeKey() {
            if (this.state.isDrawing) {
                this.canvasManager.cancelLineDraw();
            }
            if (this.state.isSelectingArea) {
                this.cancelAreaSelection();
            }
        }

        handleCopy(activeObject) {
            activeObject.clone(cloned => {
                this.state.clipboard = cloned;
            });
        }

        handlePaste() {
            if (!this.state.clipboard) return;
            const canvas = this.state.getActiveCanvas();
            if (!canvas) return;

            this.state.clipboard.clone(clonedObj => {
                canvas.discardActiveObject();
                clonedObj.set({
                    left: clonedObj.left + 10,
                    top: clonedObj.top + 10,
                    evented: true,
                });
                if (clonedObj.isVehicle) {
                    clonedObj.id = 'vehicle_' + Date.now();
                }
                if (clonedObj.type === 'activeSelection') {
                    clonedObj.canvas = canvas;
                    clonedObj.forEachObject(obj => canvas.add(obj));
                    clonedObj.setCoords();
                } else {
                    canvas.add(clonedObj);
                }
                this.state.clipboard.top += 10;
                this.state.clipboard.left += 10;
                canvas.setActiveObject(clonedObj);
                canvas.requestRenderAll();
                this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
            });
        }

        handleDelete(canvas) {
            const activeObjects = canvas.getActiveObjects();
            if (activeObjects.length === 0) {
                console.log('🗑️ Aucun objet sélectionné pour suppression');
                return;
            }
            
            const hasLandmarks = activeObjects.some(obj => obj.isLandmark);
            const hasBaseline = activeObjects.some(obj => obj.isBaseline);
            console.log('🗑️ Suppression de', activeObjects.length, 'objet(s)', hasLandmarks ? 'incluant des repères' : '', hasBaseline ? 'incluant la ligne de base' : '');
            
            // Si la ligne de base est sélectionnée, utiliser la logique spéciale de canvas.js
            if (hasBaseline) {
                // Désélectionner d'abord pour éviter les conflits
                canvas.discardActiveObject();
                
                // Trouver la ligne de base et déclencher sa suppression individuelle
                const baseline = activeObjects.find(obj => obj.isBaseline);
                if (baseline) {
                    // Simuler l'événement de suppression d'objet pour déclencher la logique spéciale
                    canvas.remove(baseline);
                    // La logique de handleObjectRemoved dans canvas.js prendra le relais
                }
                
                // Supprimer les autres objets normalement (sauf la ligne de base)
                const otherObjects = activeObjects.filter(obj => !obj.isBaseline);
                if (otherObjects.length > 0) {
                    canvas.remove(...otherObjects);
                }
            } else {
                // Suppression normale pour les autres objets
                canvas.remove(...activeObjects);
                canvas.discardActiveObject();
            }
            
            canvas.renderAll();
            this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
            
            // Mettre à jour l'état des contrôles des repères si un repère a été supprimé
            if (hasLandmarks) {
                this.uiManager.updateLandmarkControlsState();
            }
        }

        handleArrowKeys(e, canvas, activeObject) {
    // Gestion spéciale pour la sélection multiple 
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 1) {
        const hasBaseline = activeObjects.some(obj => obj.isBaseline);
        const hasZeroPoint = activeObjects.some(obj => obj.isZeroPoint);
        
        if (hasBaseline && hasZeroPoint) {
            // Si ligne de base + point zéro sont sélectionnés ensemble, 
            // traiter comme si seule la ligne de base était sélectionnée
            const baseline = activeObjects.find(obj => obj.isBaseline);
            if (baseline) {
                console.log('🔗 Sélection ligne de base + point zéro - mouvement solidaire');
                
                // Désélectionner tout et sélectionner seulement la ligne de base
                canvas.discardActiveObject();
                canvas.setActiveObject(baseline);
                
                // Traiter le mouvement pour la ligne de base (qui entraînera le point zéro)
                this.handleArrowKeys(e, canvas, baseline);
                return;
            }
        }
        
        // Pour les autres sélections multiples, pas de mouvement par flèches
        console.log('🚫 Sélection multiple - mouvement par flèches non supporté');
        return;
    }

    // Empêcher le déplacement des repères et du point zéro avec les flèches
    if (activeObject.isLandmark) {
        console.log('🚫 Déplacement des repères avec les flèches interdit');
        return;
    }
    
    // Empêcher seulement le déplacement vertical du point zéro
    if (activeObject.isZeroPoint && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        console.log('🚫 Déplacement vertical du point zéro interdit - doit rester solidaire de la ligne de base');
        return;
    }

    // ✅ NOUVEAU : Démarrer l'opération flèches au premier mouvement
    if (!this.layerManager.undoRedoManager.isArrowKeyOperation) {
        const layer = this.state.getActiveLayer();
        if (layer) {
            this.layerManager.undoRedoManager.startArrowKeyOperation(canvas, layer);
        }
    }

    let hasMoved = false;
    
    // Gestion spéciale pour le point zéro - seulement déplacement horizontal avec limites
    if (activeObject.isZeroPoint) {
        const baseline = canvas.getObjects().find(o => o.isBaseline);
        if (baseline) {
            if (e.ctrlKey) {
                const angleStep = e.shiftKey ? 15 : 5;
                if (e.key === 'ArrowLeft') {
                    activeObject.angle -= angleStep;
                    hasMoved = true;
                } else if (e.key === 'ArrowRight') {
                    activeObject.angle += angleStep;
                    hasMoved = true;
                }
            } else {
                const nudge = e.shiftKey ? 10 : 1;
                let newLeft = activeObject.left;
                
                switch (e.key) {
                    case 'ArrowLeft': 
                        newLeft -= nudge;
                        // Limiter le déplacement : ne pas aller plus à gauche que le début de la ligne de base
                        if (newLeft < baseline.left) {
                            newLeft = baseline.left;
                            console.log('🚫 Point zéro limité au début de la ligne de base');
                        }
                        hasMoved = true; 
                        break;
                    case 'ArrowRight': 
                        newLeft += nudge;
                        // Limiter le déplacement : ne pas aller plus à droite que la fin de la ligne de base
                        const baselineEnd = baseline.left + baseline.width;
                        if (newLeft > baselineEnd) {
                            newLeft = baselineEnd;
                            console.log('🚫 Point zéro limité à la fin de la ligne de base');
                        }
                        hasMoved = true; 
                        break;
                }
                
                if (hasMoved) {
                    activeObject.set({ left: newLeft });
                    
                    // Mettre à jour la position relative pour maintenir la cohérence
                    const relativePosition = (newLeft - baseline.left) / baseline.width;
                    activeObject.baselineRelativePosition = Math.max(0, Math.min(1, relativePosition));
                }
            }
        }
    } else {
        // Gestion normale pour tous les autres objets
        if (e.ctrlKey) {
            const angleStep = e.shiftKey ? 15 : 5;
            if (e.key === 'ArrowLeft') {
                activeObject.angle -= angleStep;
                hasMoved = true;
            } else if (e.key === 'ArrowRight') {
                activeObject.angle += angleStep;
                hasMoved = true;
            }
        } else {
            const nudge = e.shiftKey ? 10 : 1;
            switch (e.key) {
                case 'ArrowUp': activeObject.top -= nudge; hasMoved = true; break;
                case 'ArrowDown': activeObject.top += nudge; hasMoved = true; break;
                case 'ArrowLeft': activeObject.left -= nudge; hasMoved = true; break;
                case 'ArrowRight': activeObject.left += nudge; hasMoved = true; break;
            }
        }
    }
    
    if(hasMoved) {
        // Si la ligne de base est déplacée, déplacer aussi le point zéro
        if (activeObject.isBaseline) {
            const zeroPoint = canvas.getObjects().find(o => o.isZeroPoint);
            if (zeroPoint) {
                // Calculer la position relative du point zéro s'il n'existe pas
                if (zeroPoint.baselineRelativePosition === undefined) {
                    const currentPosition = (zeroPoint.left - activeObject.left) / activeObject.width;
                    zeroPoint.baselineRelativePosition = Math.max(0, Math.min(1, currentPosition));
                }
                
                // Repositionner le point zéro selon sa position relative
                const newZeroLeft = activeObject.left + (zeroPoint.baselineRelativePosition * activeObject.width);
                zeroPoint.set({
                    left: newZeroLeft,
                    top: activeObject.top
                });
                zeroPoint.setCoords();
            }
        }
        
        if (activeObject.isVehicle || activeObject.isZeroPoint || activeObject.isLandmark || activeObject.isBaseline) {
            this.updateAllProjections();
        }
        activeObject.setCoords();
        canvas.renderAll();
        
        // ✅ MODIFIÉ : Système de debouncing pour les touches flèches
        if (this.arrowKeyTimer) {
            clearTimeout(this.arrowKeyTimer);
        }
        
        this.arrowKeyTimer = setTimeout(() => {
            const layer = this.state.getActiveLayer();
            if (layer && this.layerManager.undoRedoManager.isArrowKeyOperation) {
                this.layerManager.undoRedoManager.endArrowKeyOperation(canvas, layer);
            }
        }, 300); // Attendre 300ms après la dernière touche
    }
}


        // Gestion des pointeurs (souris/touch)
        getPointerCoords(e) {
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        }

       handlePointerDown(e) {
    const coords = this.getPointerCoords(e);

    if (this.state.isSelectingArea) {
        this.startAreaSelection(coords, e);
        this.updateCursorForState('area-selecting');
        return;
    }

    if (this.state.currentMode === 'layer-move') {
        this.startLayerDrag(coords);
        // Changer immédiatement le curseur pour le feedback
        document.getElementById('canvas-container').style.cursor = 'grabbing';
    } else if (this.state.currentMode === 'pan') {
        this.startPanning(coords, e);
        // Changer le curseur pour indiquer le panoramique actif
        document.getElementById('canvas-container').classList.add('panning-cursor');
    } else if (this.state.currentMode === 'draw' || this.state.currentMode === 'curve' || this.state.currentMode === 'arrow') {
        // Rediriger vers le calque de dessin actif pour tous les clics draw/curve
        const activeLayer = this.state.getActiveLayer();
        if (activeLayer && !activeLayer.locked) {
            const canvas = activeLayer.fabricCanvas;
            const rect = canvas.getElement().getBoundingClientRect();
            
            // Calculer les coordonnées relatives au canvas
            let canvasX = coords.x - rect.left;
            let canvasY = coords.y - rect.top;
            
            // CORRECTION ZOOM EN AMONT : Corriger avant d'envoyer à Fabric.js
            console.log(`🔍 [ZOOM DEBUG] EVENTS AVANT - Zoom: ${this.state.zoom}, Coords brutes: ${canvasX}, ${canvasY}`);
            // Corriger en divisant par le zoom pour obtenir les vraies coordonnées dans l'espace canvas
            canvasX = canvasX / this.state.zoom;
            canvasY = canvasY / this.state.zoom;
            console.log(`🔍 [ZOOM DEBUG] EVENTS APRÈS - Coords corrigées: ${canvasX}, ${canvasY}`);
            
            // Contraindre aux limites du canvas
            canvasX = Math.max(0, Math.min(canvasX, canvas.width));
            canvasY = Math.max(0, Math.min(canvasY, canvas.height));
            
            
            // Démarrer le dessin directement sur le bon canvas
            const canvasManager = window.PlanEditor.instances?.canvasManager;
            if (canvasManager) {
                // Forcer le dessin sur le canvas actif
                const pointer = { x: canvasX, y: canvasY };
                canvasManager.startDrawing(canvas, pointer);
            }
        }
    }
}

        handlePointerMove(e) {
            const coords = this.getPointerCoords(e);

            if (this.state.isDraggingLayer) {
                this.updateLayerDrag(coords);
            } else if (this.state.isPanning) {
                this.updatePanning(coords);
            } else if (this.state.isDraggingSelection) {
                this.updateAreaSelection(coords);
            } else if (this.state.isDrawing && (this.state.currentMode === 'draw' || this.state.currentMode === 'curve' || this.state.currentMode === 'arrow')) {
                // Rediriger les mouvements de souris vers le canvas de dessin
                const activeLayer = this.state.getActiveLayer();
                const drawingCanvas = this.state.drawingCanvas;
                
                if (activeLayer && drawingCanvas && this.state.guideShape) {
                    const rect = drawingCanvas.getElement().getBoundingClientRect();
                    let canvasX = coords.x - rect.left;
                    let canvasY = coords.y - rect.top;
                    
                    // CORRECTION ZOOM EN AMONT : Corriger avant d'envoyer à Fabric.js
                    console.log(`🔍 [ZOOM DEBUG] MOVE AVANT - Zoom: ${this.state.zoom}, Coords brutes: ${canvasX}, ${canvasY}`);
                    canvasX = canvasX / this.state.zoom;
                    canvasY = canvasY / this.state.zoom;
                    console.log(`🔍 [ZOOM DEBUG] MOVE APRÈS - Coords corrigées: ${canvasX}, ${canvasY}`);
                    
                    // Contraindre aux limites du canvas
                    canvasX = Math.max(0, Math.min(canvasX, drawingCanvas.width));
                    canvasY = Math.max(0, Math.min(canvasY, drawingCanvas.height));
                    
                    const pointer = { x: canvasX, y: canvasY };
                    const canvasManager = window.PlanEditor.instances?.canvasManager;
                    if (canvasManager) {
                        canvasManager.updateGuideShape(pointer);
                        drawingCanvas.renderAll();
                    }
                }
            }
        }

       handlePointerUp(e) {
    const canvasContainer = document.getElementById('canvas-container');
    
    if (this.state.isDraggingLayer) {
        this.endLayerDrag();
        // Remettre le curseur de déplacement de calque
        canvasContainer.style.cursor = 'move';
    }
    if (this.state.isPanning) {
        this.endPanning();
        // Remettre le curseur de panoramique
        this.toolsManager.updateCursor();
    }
    if (this.state.isDraggingSelection) {
        this.endAreaSelection();
        // Le curseur sera remis à jour dans endAreaSelection
    }
    if (this.state.isDrawing && (this.state.currentMode === 'draw' || this.state.currentMode === 'curve' || this.state.currentMode === 'arrow')) {
        // Finaliser le dessin sur le canvas de dessin
        const activeLayer = this.state.getActiveLayer();
        const drawingCanvas = this.state.drawingCanvas;
        
        if (activeLayer && drawingCanvas) {
            const rect = drawingCanvas.getElement().getBoundingClientRect();
            const coords = this.getPointerCoords(e || { clientX: 0, clientY: 0 });
            let canvasX = coords.x - rect.left;
            let canvasY = coords.y - rect.top;
            
            // Contraindre aux limites du canvas
            canvasX = Math.max(0, Math.min(canvasX, drawingCanvas.width));
            canvasY = Math.max(0, Math.min(canvasY, drawingCanvas.height));
            
            const endPointer = { x: canvasX, y: canvasY };
            const canvasManager = window.PlanEditor.instances?.canvasManager;
            
            if (canvasManager) {
                // Créer un événement simulé pour handleMouseUp
                const fakeEvent = {
                    e: e || {},
                    pointer: endPointer
                };
                
                canvasManager.handleMouseUp(drawingCanvas, fakeEvent, () => {
                    if (window.PlanEditor.instances.layerManager) {
                        window.PlanEditor.instances.layerManager.saveCurrentState();
                    }
                });
            }
        }
    }
}

        // Gestion spécifique des événements
        handleStartDrawing() {
            // Vérifier si on est en train de charger un projet ou de créer un nouveau projet
            if (this.state.isLoadingState || this.state.isCreatingNewProject) {
                console.log('🚫 handleStartDrawing bloqué - chargement/création en cours');
                return;
            }
            
            if (this.state.workflowState !== 'scale_calibrated' && this.state.workflowState !== 'ready_for_drawing') {
                return;
            }
            if (this.state.layers.some(l => l.name === this.state.DRAWING_LAYER_NAME)) {
                alert("Un calque de dessin existe déjà.");
                return;
            }
            if (this.state.isSelectingArea) {
                this.cancelAreaSelection();
                return;
            }
            
            this.startAreaSelectionMode();
        }

       startAreaSelectionMode() {
    // Vérifier si on est dans le bon contexte (pas pendant un chargement/reset)
    if (this.state.isLoadingState || this.state.isCreatingNewProject) {
        console.log('🚫 startAreaSelectionMode bloqué - chargement/création en cours');
        return;
    }
    
    // Vérifier qu'on est bien dans un workflow où la sélection de zone a du sens
    if (this.state.workflowState !== 'scale_calibrated' && this.state.workflowState !== 'ready_for_drawing') {
        console.log('🚫 startAreaSelectionMode bloqué - workflow inapproprié:', this.state.workflowState);
        return;
    }
    
    // Vérification supplémentaire : s'assurer qu'on n'est pas en train de créer un nouveau projet
    // (la vérification des calques sera faite plus tard si nécessaire)
    
    this.state.isSelectingArea = true;
    const guideMessage = document.getElementById('guide-message');
    guideMessage.innerHTML = '<h2>Étape 3/3 : Définir la zone</h2><p>Cliquez et glissez pour sélectionner la zone où vous souhaitez dessiner. Appuyez sur [Échap] pour annuler.</p>';
    guideMessage.style.display = 'block';
    
    // ✅ Mise à jour du curseur pour la sélection de zone
    this.toolsManager.setMode('select');
    // Forcer la mise à jour du curseur après avoir défini l'état isSelectingArea
    setTimeout(() => {
        this.toolsManager.updateCursor();
    }, 10);
    console.log('✅ Mode sélection de zone activé');
	}

        cancelAreaSelection() {
    this.state.isSelectingArea = false;
    this.state.isDraggingSelection = false;
    const selectionBox = document.getElementById('selection-box');
    if (selectionBox) selectionBox.style.display = 'none';
    
    // ✅ Remettre le curseur normal
    this.toolsManager.updateCursor();
    this.uiManager.updateGuideMessage(this.state.workflowState);
}

		// Nouvelle méthode pour gérer les curseurs pendant le dessin
handleDrawingStateChange(isDrawing) {
    if (isDrawing) {
        this.updateCursorForState('drawing');
    } else {
        this.toolsManager.updateCursor();
    }
}
 
handleLoadingStateChange(isLoading) {
    if (isLoading) {
        this.updateCursorForState('loading');
    } else {
        this.toolsManager.updateCursor();
    }
}

// Gestion des fichiers et du presse-papiers
        handleFileLoad(e, layerType) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => this.processPastedImage(event.target.result, layerType);
            reader.readAsDataURL(file);
            e.target.value = '';
        }

        handleDroneFileLoad(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => this.processDroneImage(event.target.result);
            reader.readAsDataURL(file);
            e.target.value = '';
        }

        processDroneImage(dataUrl) {
            const img = new Image();
            img.onload = () => {
                // Créer le calque drone comme un calque supplémentaire
                // Calcul de l'échelle initiale pour qu'il ne soit pas trop grand/petit par rapport à la vue actuelle
                
                // On l'ajoute comme un calque supplémentaire (pas base)
                // On utilise une échelle arbitraire temporaire, elle sera corrigée par la calibration
                this.layerManager.createLayer("Vue drone", img, {
                    insertBelowDrawing: true,
                    opacity: 0.7 // Semi-transparent par défaut pour faciliter l'alignement
                });

                // Mettre à jour les z-index pour s'assurer que le drone est au-dessus du plan rogné
                this.layerManager.updateZIndexes();

                // Configurer pour le contraste élevé
                this.setHighContrastDefaults();

                // Marquer comme import de drone pour la logique de calibration
                this.state.isDroneImport = true;

                // ✅ FIX : Activer explicitement le bouton scale pour la calibration drone
                const btnScale = document.getElementById('btn-scale');
                if (btnScale) {
                    btnScale.disabled = false;
                    console.log('✅ Bouton scale activé pour calibration drone');
                }

                // Alerte spécifique pour le drone
                alert("🚁 Vue Drone importée.\n\nVEUILLEZ CALIBRER L'IMAGE :\nTracez une ligne sur une distance connue sur la photo du drone (ex: entre deux marquages) pour ajuster son échelle à celle du plan.");

                // Forcer le mode calibration manuelle directement
                this.toolsManager.setMode('scale');
            };
            img.src = dataUrl;
        }

        setHighContrastDefaults() {
            // Passer en mode contraste élevé pour une meilleure visibilité sur photo
            console.log('🌓 Activation du mode contraste élevé pour vue drone');

            // 1. Couleur des traits en Jaune vif
            const colorPicker = document.getElementById('color-picker');
            const colorPickerShape = document.getElementById('color-picker-shape');
            const colorPickerText = document.getElementById('color-picker-text');

            const highContrastColor = '#FFFF00'; // Jaune pur

            if (colorPicker) {
                colorPicker.value = highContrastColor;
                // Déclencher l'événement change pour propager aux autres pickers via setupShapeControlsSync
                colorPicker.dispatchEvent(new Event('change'));
            }

            // Au cas où la synchro ne marche pas, forcer les autres
            if (colorPickerShape) colorPickerShape.value = highContrastColor;
            if (colorPickerText) colorPickerText.value = highContrastColor;

            // ✅ FIX : NE PAS changer l'épaisseur - garder le trait fin (2) par défaut
            // L'épaisseur ne doit pas être modifiée par le mode contraste élevé
        }

        handleCustomSignLoad(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                this.toolsManager.addCustomImageToCanvas(event.target.result);
                this.uiManager.hideSignsModal();
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }

        async handleClipboardPaste() {
            if (!navigator.clipboard || !navigator.clipboard.read) {
                alert("Votre navigateur ne supporte pas le collage depuis le presse-papiers ou la page n'est pas sécurisée (HTTPS).");
                return;
            }
            try {
                const clipboardItems = await navigator.clipboard.read();
                let imageBlob = null;
                for (const item of clipboardItems) {
                    const imageType = item.types.find(type => type.startsWith('image/'));
                    if (imageType) {
                        imageBlob = await item.getType(imageType);
                        break;
                    }
                }
                if (imageBlob) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const addLayerModal = document.getElementById('add-layer-modal');
                        const layerType = addLayerModal.dataset.layerType;
                        this.processPastedImage(event.target.result, layerType);
                    };
                    reader.readAsDataURL(imageBlob);
                } else {
                    alert("Aucune image trouvée dans le presse-papiers.");
                }
            } catch (err) {
                console.error("Erreur lors de la lecture du presse-papiers:", err);
                alert("Impossible de lire le presse-papiers. L'utilisateur a peut-être refusé la permission.");
            }
        }

        processPastedImage(dataUrl, layerType) {
            const img = new Image();
            img.onload = () => {
                if (layerType === 'base') {
                    // Réinitialiser le flag drone pour les images standard
                    this.state.isDroneImport = false;

                    this.layerManager.createLayer("Image de fond", img);
                    this.state.setWorkflowState('image_loaded');
                    this.toolsManager.setMode('layer-move');
                    
                    // Proposer le choix de l'échelle (manuel ou preset)
                    if (this.uiManager) {
                        this.uiManager.showScaleChoiceModal();
                    }
                } else {
                    this.handleSubsequentLayerImage(img);
                }
                
            };
            img.src = dataUrl;
        }

        handleSubsequentLayerImage(img) {
            if (!this.state.scaleInfo.userDefinedScaleDenominator) {
                alert("Veuillez d'abord calibrer l'échelle du calque de fond principal avant d'ajouter un autre calque image.");
                return;
            }

            const newLayerScaleStr = prompt("Quelle est l'échelle de ce nouveau calque ? (ex: 500 pour 1:500)");
            const newLayerScale = parseFloat(newLayerScaleStr);
            if (isNaN(newLayerScale) || newLayerScale <= 0) {
                alert("Échelle invalide. L'ajout du calque est annulé.");
                return;
            }

            const baseImageScale = this.state.scaleInfo.userDefinedScaleDenominator;
            const scaleFactor = newLayerScale / baseImageScale;

            const fabricImage = new fabric.Image(img);
            fabricImage.scale(scaleFactor);

            const scaledWidth = fabricImage.getScaledWidth();
            const scaledHeight = fabricImage.getScaledHeight();

            // Trouver l'angle du calque de fond existant pour l'appliquer au nouveau calque
            // Cette logique s'applique aux images chargées par fichier ET par copier-coller
            let initialAngle = 0;
            
            // Stratégie de recherche robuste du calque de fond :
            // 1. Trier les calques par ID croissant (le fond est toujours le premier créé)
            const sortedLayers = [...this.state.layers].sort((a, b) => {
                const idA = parseInt(a.id) || 0;
                const idB = parseInt(b.id) || 0;
                return idA - idB;
            });

            // 2. Chercher dans l'ordre chronologique
            let backgroundLayer = sortedLayers.find(l => l.name === 'Image de fond' || l.name === 'Plan rogné');
            
            // 3. Si non trouvé, prendre le tout premier calque qui a une image de fond (et n'est pas le dessin)
            if (!backgroundLayer) {
                backgroundLayer = sortedLayers.find(l => l.fabricCanvas && l.fabricCanvas.backgroundImage && l.name !== this.state.DRAWING_LAYER_NAME);
            }

            if (backgroundLayer) {
                const currentAngle = parseFloat(backgroundLayer.angle) || 0;
                // Si le plan a été rogné et redressé, on utilise l'angle original qui a servi au redressement
                const originalRotation = parseFloat(backgroundLayer.originalRotation) || 0;
                
                // L'angle total est la somme de l'angle visuel actuel et de l'angle de redressement initial
                initialAngle = currentAngle + originalRotation;
                
                console.log(`🎯 [LAYER] Angle récupéré du fond "${backgroundLayer.name}": ${initialAngle}° (Actuel: ${currentAngle}°, Original: ${originalRotation}°)`);
            } else {
                console.warn('⚠️ [LAYER] Aucun calque de fond trouvé pour récupérer l\'angle');
            }

            this.layerManager.createLayer(`Image collée (1:${newLayerScale})`, fabricImage, { 
                insertBelowDrawing: true,
                width: scaledWidth,
                height: scaledHeight,
                scaleDenominator: newLayerScale,
                angle: initialAngle
            });
            
            this.layerManager.updateZIndexes();
            const newLayer = this.state.layers.find(l => l.fabricCanvas.backgroundImage === fabricImage);
            if (newLayer) {
                this.layerManager.setActiveLayer(newLayer.id);
                this.toolsManager.setMode('layer-move');
                this.uiManager.showAlignmentGuideModal();
            }
        }

        // Modales spécialisées
        showVehicleModal() {
            console.log('🚗 DEBUT showVehicleModal()');
            this.uiManager.showVehicleModal();
            const submitVehicleBtn = document.getElementById('submit-vehicle-btn');
            const btnCloseVehicleModal = document.getElementById('close-vehicle-modal');
            const vehicleWidthInput = document.getElementById('vehicle-width-input');
            const vehicleLengthInput = document.getElementById('vehicle-length-input');
            const vehicleLetterInput = document.getElementById('vehicle-letter-input');
            const vehicleColorInput = document.getElementById('vehicle-color-input');
            const vehicleThicknessInput = document.getElementById('vehicle-thickness-input');
            const vehicleThicknessDisplay = document.getElementById('vehicle-thickness-display');
            const vehicleDashedInput = document.getElementById('vehicle-dashed-input');

            // ✅ CORRECTION FINALE : TOUJOURS supprimer les anciens event listeners avant d'ajouter les nouveaux
            console.log('🚗 État des flags - Submit:', !!submitVehicleBtn._vehicleListenerAdded, 'Close:', !!btnCloseVehicleModal._vehicleListenerAdded);
            
            // TOUJOURS supprimer les anciens event listeners s'ils existent
            if (submitVehicleBtn._handleSubmit) {
                console.log('⚠️ Suppression systématique des anciens event listeners');
                submitVehicleBtn.removeEventListener('click', submitVehicleBtn._handleSubmit);
                submitVehicleBtn._eventListenerCount = Math.max(0, (submitVehicleBtn._eventListenerCount || 1) - 1);
                console.log('🗑️ Ancien event listener submit supprimé, reste:', submitVehicleBtn._eventListenerCount);
            }
            if (btnCloseVehicleModal._handleCleanup) {
                btnCloseVehicleModal.removeEventListener('click', btnCloseVehicleModal._handleCleanup);
                console.log('🗑️ Ancien event listener close supprimé');
            }
            
            // Marquer que les event listeners sont ajoutés
            submitVehicleBtn._vehicleListenerAdded = true;
            btnCloseVehicleModal._vehicleListenerAdded = true;

            const handleKeyDown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                }
            };

            const cleanup = () => {
                console.log('🚗 CLEANUP - Nettoyage des flags et fermeture modal');
                console.log('🚗 Bouton Close cliqué - EVENT LISTENER FONCTIONNE');
                const vehicleModal = document.getElementById('vehicle-modal');
                
                // Diagnostiquer les styles CSS AVANT fermeture
                const computedStyleBefore = window.getComputedStyle(vehicleModal);
                console.log('🚗 Styles CSS AVANT fermeture - display:', computedStyleBefore.display, 'visibility:', computedStyleBefore.visibility);
                
                vehicleModal.style.display = 'none';
                vehicleModal.style.visibility = 'hidden';
                
                // Diagnostiquer les styles CSS APRÈS fermeture
                const computedStyleAfter = window.getComputedStyle(vehicleModal);
                console.log('🚗 Styles CSS APRÈS fermeture - display:', computedStyleAfter.display, 'visibility:', computedStyleAfter.visibility);
                
                // Nettoyer les flags pour permettre la prochaine ouverture
                submitVehicleBtn._vehicleListenerAdded = false;
                btnCloseVehicleModal._vehicleListenerAdded = false;
                console.log('✅ Flags nettoyés, modal fermée');
            };

            const handleSubmit = () => {
                console.log('🚗 DEBUT handleSubmit() - ajout véhicule');
                console.log('🚗 Bouton Submit cliqué - EVENT LISTENER FONCTIONNE');
                
                // ✅ PROTECTION CONTRE DOUBLE EXÉCUTION
                if (handleSubmit._isExecuting) {
                    console.log('⚠️ handleSubmit déjà en cours d\'exécution - ARRÊT');
                    return;
                }
                handleSubmit._isExecuting = true;
                console.log('🔒 Protection double exécution activée');
                
                const canvas = this.state.getActiveCanvas();
                if (!canvas) {
                    console.log('❌ Pas de canvas actif');
                    handleSubmit._isExecuting = false;
                    cleanup();
                    return;
                }

                const widthM = parseFloat(vehicleWidthInput.value.replace(',', '.'));
                const lengthM = parseFloat(vehicleLengthInput.value.replace(',', '.'));
                const letter = vehicleLetterInput.value.trim().toUpperCase();
                const color = vehicleColorInput.value;
                const thickness = parseInt(vehicleThicknessInput.value);
                const dashed = vehicleDashedInput.checked;

                if (isNaN(widthM) || isNaN(lengthM) || widthM <= 0 || lengthM <= 0) {
                    alert("Veuillez entrer des dimensions valides.");
                    handleSubmit._isExecuting = false;
                    return;
                }

                if (!letter || letter.length !== 1) {
                    alert("Veuillez entrer une lettre d'identification valide.");
                    handleSubmit._isExecuting = false;
                    return;
                }

                try {
                    console.log('🚗 Appel toolsManager.addCarToCanvas avec:', widthM, lengthM, letter, color, thickness, dashed);
                    this.toolsManager.addCarToCanvas(widthM, lengthM, letter, color, thickness, dashed);
                    console.log('✅ addCarToCanvas terminé avec succès');
                } catch (error) {
                    console.error('❌ Erreur lors de l\'ajout du véhicule:', error);
                } finally {
                    console.log('🚗 Nettoyage final de la modal');
                    handleSubmit._isExecuting = false;
                    console.log('🔓 Protection double exécution désactivée');
                    cleanup();
                }
            };

            // Ajouter les event listeners sur les éléments originaux ET les stocker pour suppression future
            console.log('🚗 Ajout des event listeners...');
            
            // Stocker les fonctions pour pouvoir les supprimer plus tard
            submitVehicleBtn._handleSubmit = handleSubmit;
            btnCloseVehicleModal._handleCleanup = cleanup;
            
            // Compter les event listeners existants (approximatif)
            const existingCount = submitVehicleBtn._eventListenerCount || 0;
            submitVehicleBtn._eventListenerCount = existingCount + 1;
            console.log('📊 Nombre d\'event listeners submit (approximatif):', submitVehicleBtn._eventListenerCount);
            
            submitVehicleBtn.addEventListener('click', handleSubmit);
            console.log('✅ Event listener submit ajouté');
            btnCloseVehicleModal.addEventListener('click', cleanup);
            console.log('✅ Event listener close ajouté');
            vehicleWidthInput.addEventListener('keydown', handleKeyDown);
            vehicleLengthInput.addEventListener('keydown', handleKeyDown);
            vehicleLetterInput.addEventListener('keydown', handleKeyDown);
            console.log('✅ Event listeners keydown ajoutés');
            
            // Event listener pour mettre à jour l'affichage de l'épaisseur
            const updateThicknessDisplay = () => {
                vehicleThicknessDisplay.textContent = vehicleThicknessInput.value + 'px';
            };
            vehicleThicknessInput.addEventListener('input', updateThicknessDisplay);
            
            // Gestion du clic à l'extérieur de la modal
            const vehicleModal = document.getElementById('vehicle-modal');
            const handleOutsideClick = (e) => {
                if (e.target === vehicleModal) {
                    console.log('🚗 Clic à l\'extérieur de la modal - fermeture');
                    cleanup();
                    window.removeEventListener('click', handleOutsideClick);
                }
            };
            window.addEventListener('click', handleOutsideClick);
        }

        showLandmarkModal() {
            this.uiManager.showLandmarkModal();
            const submitLandmarkBtn = document.getElementById('submit-landmark-btn');
            const btnCloseLandmarkModal = document.getElementById('close-landmark-modal');
            const landmarkXInput = document.getElementById('landmark-x-input');
            const landmarkYInput = document.getElementById('landmark-y-input');

            // ✅ CORRECTION : Utilisation de onclick pour éviter la duplication des événements
            
            const cleanup = () => {
                document.getElementById('landmark-modal').style.display = 'none';
                
                // Nettoyage des handlers
                submitLandmarkBtn.onclick = null;
                btnCloseLandmarkModal.onclick = null;
                // Note: les listeners keydown restent, mais ce n'est pas critique car ils sont légers
                // Idéalement on devrait aussi les nettoyer si on veut être parfait
            };

            const handleSubmit = () => {
                const abscissa = parseFloat(landmarkXInput.value.replace(',', '.'));
                const ordinate = parseFloat(landmarkYInput.value.replace(',', '.'));

                if (isNaN(abscissa) || isNaN(ordinate)) {
                    alert("Veuillez entrer des valeurs numériques valides.");
                    return;
                }

                this.addLandmark(abscissa, ordinate);
                cleanup();
            };

            // Gestionnaires via onclick pour éviter les doublons
            submitLandmarkBtn.onclick = handleSubmit;
            btnCloseLandmarkModal.onclick = cleanup;
            
            // Pour les inputs, on utilise onkeydown pour éviter l'accumulation
            const handleKeyDown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                }
            };
            
            landmarkXInput.onkeydown = handleKeyDown;
            landmarkYInput.onkeydown = handleKeyDown;
            
            // Gestion du clic à l'extérieur
            const landmarkModal = document.getElementById('landmark-modal');
            const handleOutsideClick = (e) => {
                if (e.target === landmarkModal) {
                    cleanup();
                    window.removeEventListener('click', handleOutsideClick);
                }
            };
            window.addEventListener('click', handleOutsideClick);
        }

        setupLegendModalSubmit(title) {
            const submitLegendBtn = document.getElementById('submit-legend-btn');
            const legendTextarea = document.getElementById('legend-textarea');
            
            // ✅ CORRECTION : Utilisation de onclick pour écraser automatiquement les anciens handlers
            // Cela évite la duplication des événements si l'utilisateur annule et recommence
            submitLegendBtn.onclick = () => {
                const legendText = legendTextarea.value;
                this.uiManager.hideLegendModal();
                this.exportManager.exportToPDF(title, legendText);
                
                // Nettoyage après exécution
                submitLegendBtn.onclick = null;
            };
        }

        // Utilitaires de zoom et défilement
        applyZoom(newZoomValue, forceApply = false) {
            // Vérifier si le zoom est verrouillé (sauf si on force l'application)
            if (this.state.isZoomLocked && !forceApply) {
                console.log('🔒 [DEBUG] Tentative de zoom bloquée - échelle verrouillée');
                return;
            }

            // Masquer seulement la modale d'alignement si on est en étape 2/3 (orienter le plan)
            if (this.state.workflowState === 'scale_calibrated') {
                const alignmentModal = document.getElementById('alignment-guide-modal');
                if (alignmentModal) {
                    alignmentModal.style.display = 'none';
                }
            }
            
            const oldZoom = this.state.zoom;
            const newZoom = Math.max(this.state.MIN_ZOOM, Math.min(this.state.MAX_ZOOM, newZoomValue));

            const container = document.getElementById('canvas-container');
            const rect = container.getBoundingClientRect();

            const viewportCenterX = container.scrollLeft + rect.width / 2;
            const viewportCenterY = container.scrollTop + rect.height / 2;

            const contentCenterX = viewportCenterX / oldZoom;
            const contentCenterY = viewportCenterY / oldZoom;

            this.state.zoom = newZoom;
            document.getElementById('zoom-wrapper').style.transform = `scale(${newZoom})`;
            this.updateScrollContentSize();

            const newScrollLeft = contentCenterX * newZoom - rect.width / 2;
            const newScrollTop = contentCenterY * newZoom - rect.height / 2;

            container.scrollLeft = newScrollLeft;
            container.scrollTop = newScrollTop;

            this.uiManager.updateZoomDisplay();

            // ✅ Mettre à jour la position des poignées après le zoom
            if (window.PlanEditor.instances?.layerTransformManager) {
                this.state.layers.forEach(layer => {
                    if (layer.resizeHandles && layer.resizeHandles.length > 0) {
                        window.PlanEditor.instances.layerTransformManager.updateHandlePositions(layer);
                    }
                });
            }
        }

        updateScrollContentSize() {
            const baseLayer = this.state.layers.find(l => l.fabricCanvas.backgroundImage || l.name === 'Plan rogné');
            const scrollContent = document.getElementById('scroll-content');
            
            if (baseLayer) {
                const baseWidth = baseLayer.fabricCanvas.width;
                const baseHeight = baseLayer.fabricCanvas.height;
                scrollContent.style.width = `${baseWidth * this.state.zoom}px`;
                scrollContent.style.height = `${baseHeight * this.state.zoom}px`;
            } else {
                scrollContent.style.width = 'auto';
                scrollContent.style.height = 'auto';
            }
        }

        // Fonctions de projection et repères
        addLandmark(abscissa, ordinate) {
            const drawingLayer = this.state.getActiveLayer();
            if (!drawingLayer) {
                alert("Le calque de dessin n'existe pas. Impossible d'ajouter un repère.");
                return;
            }
            
            const canvas = drawingLayer.fabricCanvas;
            const baseline = canvas.getObjects().find(o => o.isBaseline);
            const zeroPoint = canvas.getObjects().find(o => o.isZeroPoint);
            
            const pixelsPerMeter = this.state.scaleInfo.ratio * 100;
            const landmarkX = zeroPoint.left + (abscissa * pixelsPerMeter);
            const landmarkY = baseline.top - (ordinate * pixelsPerMeter);
            
            const colorPicker = document.getElementById('color-picker');
            const toggleLandmarksCheckbox = document.getElementById('toggle-landmarks-checkbox');
            
            const landmark = new fabric.Circle({
                left: landmarkX,
                top: landmarkY,
                radius: 4,
                fill: colorPicker.value,
                opacity: 0.65,
                strokeWidth: 0,
                originX: 'center',
                originY: 'center',
                isLandmark: true,
                selectable: true,
                lockMovementX: true,
                lockMovementY: true,
                hasControls: true,
                visible: toggleLandmarksCheckbox.checked,
                id: 'landmark_' + Date.now()
            });

            // Configurer les contrôles pour afficher seulement la croix de suppression
            landmark.setControlsVisibility({
                mtr: false, // rotation
                ml: false, mr: false, mt: false, mb: false, // redimensionnement
                tl: false, tr: false, bl: false, br: false, // coins
                deleteControl: true // croix de suppression
            });

            canvas.add(landmark);
            this.layerManager.undoRedoManager.saveState(canvas, drawingLayer);
            this.updateAllProjections();
            this.uiManager.updateLayersPanel();
            
            // Mettre à jour l'état des contrôles des repères
            this.uiManager.updateLandmarkControlsState();
            
            // Basculer sur l'outil sélection après ajout du repère
            this.toolsManager.setMode('select');
        }

        updateAllProjections() {
    // Utiliser le nouveau ProjectionManager
    if (window.PlanEditor.instances && window.PlanEditor.instances.projectionManager) {
        window.PlanEditor.instances.projectionManager.updateAllProjections();
    } else {
        // Fallback : émettre l'événement
        document.dispatchEvent(new CustomEvent('projections-update-needed'));
    }
}

        // Méthodes de gestion des interactions pointeur (simplifiées)
        startLayerDrag(coords) {
            const activeLayer = this.state.getActiveLayer();
            if (!activeLayer || activeLayer.locked) return;
            
            // Masquer seulement la modale d'alignement si on est en étape 2/3 (orienter le plan)
            if (this.state.workflowState === 'scale_calibrated') {
                const alignmentModal = document.getElementById('alignment-guide-modal');
                if (alignmentModal) {
                    alignmentModal.style.display = 'none';
                }
            }
            
            this.state.isDraggingLayer = true;
            this.state.startPoint = { x: coords.x, y: coords.y, layer: activeLayer };
            document.getElementById('canvas-container').style.cursor = 'grabbing';
        }

        updateLayerDrag(coords) {
            if (!this.state.isDraggingLayer) return;

            const activeLayer = this.state.startPoint.layer;
            if (!activeLayer) return;
            const dx = coords.x - this.state.startPoint.x;
            const dy = coords.y - this.state.startPoint.y;
            activeLayer.x += dx / this.state.zoom;
            activeLayer.y += dy / this.state.zoom;
            activeLayer.wrapper.style.transform = `translate(${activeLayer.x}px, ${activeLayer.y}px) rotateZ(${activeLayer.angle}deg)`;
            this.state.startPoint.x = coords.x;
            this.state.startPoint.y = coords.y;

            // ✅ Mettre à jour la position des poignées si le calque en a
            if (window.PlanEditor.instances?.layerTransformManager && activeLayer.resizeHandles) {
                window.PlanEditor.instances.layerTransformManager.updateHandlePositions(activeLayer);
            }
        }

        endLayerDrag() {
            // ✅ Mettre à jour la position finale des poignées
            const activeLayer = this.state.getActiveLayer();
            if (window.PlanEditor.instances?.layerTransformManager && activeLayer && activeLayer.resizeHandles) {
                window.PlanEditor.instances.layerTransformManager.updateHandlePositions(activeLayer);
            }

            this.state.isDraggingLayer = false;
            document.getElementById('canvas-container').style.cursor = 'move';
        }

        startPanning(coords, e) {
            // Masquer seulement la modale d'alignement si on est en étape 2/3 (orienter le plan)
            if (this.state.workflowState === 'scale_calibrated') {
                const alignmentModal = document.getElementById('alignment-guide-modal');
                if (alignmentModal) {
                    alignmentModal.style.display = 'none';
                }
            }
            
            this.state.isPanning = true;
            const canvasContainer = document.getElementById('canvas-container');
            this.state.startPoint = { 
                x: coords.x, 
                y: coords.y, 
                scrollLeft: canvasContainer.scrollLeft, 
                scrollTop: canvasContainer.scrollTop 
            };
            canvasContainer.classList.add('panning-cursor');
            e.preventDefault();
        }

        updatePanning(coords) {
            if (!this.state.isPanning) return;
            
            const dx = coords.x - this.state.startPoint.x;
            const dy = coords.y - this.state.startPoint.y;
            const canvasContainer = document.getElementById('canvas-container');
            canvasContainer.scrollLeft = this.state.startPoint.scrollLeft - dx;
            canvasContainer.scrollTop = this.state.startPoint.scrollTop - dy;
        }

        endPanning() {
            this.state.isPanning = false;
            document.getElementById('canvas-container').classList.remove('panning-cursor');
        }

        startAreaSelection(coords, e) {
            
            this.state.isDraggingSelection = true;
            this.state.selectionStartPoint = { x: coords.x, y: coords.y };
            
            if (!this.state.selectionBox) {
                this.state.selectionBox = document.createElement('div');
                this.state.selectionBox.id = 'selection-box';
                document.getElementById('canvas-container').appendChild(this.state.selectionBox);
            }
            
            const canvasContainer = document.getElementById('canvas-container');
            const rect = canvasContainer.getBoundingClientRect();
            const startX = coords.x - rect.left + canvasContainer.scrollLeft;
            const startY = coords.y - rect.top + canvasContainer.scrollTop;
            
            this.state.selectionBox.style.left = `${startX}px`;
            this.state.selectionBox.style.top = `${startY}px`;
            this.state.selectionBox.style.width = '0px';
            this.state.selectionBox.style.height = '0px';
            this.state.selectionBox.style.display = 'block';
            e.preventDefault();
        }

        updateAreaSelection(coords) {
            if (!this.state.isDraggingSelection || !this.state.selectionBox) {
                return;
            }
            
            const canvasContainer = document.getElementById('canvas-container');
            const rect = canvasContainer.getBoundingClientRect();
            const currentX = coords.x - rect.left + canvasContainer.scrollLeft;
            const currentY = coords.y - rect.top + canvasContainer.scrollTop;
            const startX = parseFloat(this.state.selectionBox.style.left);
            const startY = parseFloat(this.state.selectionBox.style.top);
            const width = currentX - startX;
            const height = currentY - startY;
            
            if (width < 0) {
                this.state.selectionBox.style.left = `${currentX}px`;
                this.state.selectionBox.style.width = `${-width}px`;
            } else {
                this.state.selectionBox.style.width = `${width}px`;
            }
            if (height < 0) {
                this.state.selectionBox.style.top = `${currentY}px`;
                this.state.selectionBox.style.height = `${-height}px`;
            } else {
                this.state.selectionBox.style.height = `${height}px`;
            }
        }

        endAreaSelection() {
            this.state.isDraggingSelection = false;
            this.state.isSelectingArea = false;
            document.getElementById('canvas-container').style.cursor = 'default';
            
            if (!this.state.selectionBox) return;
            
            const boxWidth = parseFloat(this.state.selectionBox.style.width);
            const boxHeight = parseFloat(this.state.selectionBox.style.height);

            if (boxWidth < 10 || boxHeight < 10) {
                this.state.selectionBox.style.display = 'none';
                this.uiManager.updateGuideMessage(this.state.workflowState);
                return;
            }

            this.processAreaSelection();
        }


        processAreaSelection() {
            const baseLayer = this.state.layers.find(l => l.fabricCanvas.backgroundImage);
            if (!baseLayer) {
                alert("Erreur : Impossible de trouver le calque d'image de base.");
                if(this.state.selectionBox) this.state.selectionBox.style.display = 'none';
                return;
            }

            const boxRect = this.state.selectionBox.getBoundingClientRect();
            const zoomWrapper = document.getElementById('zoom-wrapper');
            const wrapperRect = zoomWrapper.getBoundingClientRect();
            const oldZoom = this.state.zoom;
            this.state.scaleInfo.cropZoomFactor = oldZoom;

            if(this.state.selectionBox) this.state.selectionBox.style.display = 'none';

            const newCanvasWidth = boxRect.width;
            const newCanvasHeight = boxRect.height;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = newCanvasWidth;
            tempCanvas.height = newCanvasHeight;
            const tempCtx = tempCanvas.getContext('2d');

            const selX_in_wrapper = boxRect.left - wrapperRect.left;
            const selY_in_wrapper = boxRect.top - wrapperRect.top;

            // Capturer l'angle original avant la transformation
            const originalAngle = baseLayer.angle || 0;

            tempCtx.translate(-selX_in_wrapper, -selY_in_wrapper);
            tempCtx.scale(oldZoom, oldZoom);
            tempCtx.translate(baseLayer.x, baseLayer.y);
            
            const centerX = baseLayer.fabricCanvas.width / 2;
            const centerY = baseLayer.fabricCanvas.height / 2;
            tempCtx.translate(centerX, centerY);
            tempCtx.rotate(baseLayer.angle * Math.PI / 180);
            tempCtx.translate(-centerX, -centerY);
            
            tempCtx.drawImage(baseLayer.fabricCanvas.getElement(), 0, 0);

            const croppedImageDataUrl = tempCanvas.toDataURL();

            // Ajuster les informations d'échelle
            if(this.state.scaleInfo.ratio > 0) {
                this.state.scaleInfo.ratio *= oldZoom;
            }
            if(this.state.scaleInfo.userDefinedScaleDenominator) {
                this.state.scaleInfo.userDefinedScaleDenominator /= oldZoom;
            }

            const img = new Image();
            img.onload = () => {
                // Nettoyer les calques existants
                this.state.layers.forEach(layer => zoomWrapper.removeChild(layer.wrapper));
                this.state.layers = [];
                this.state.activeLayerId = null;
                this.state.layerCounter = 0;

                this.applyZoom(1, true); // forceApply = true pour permettre la réinitialisation

                // Créer le nouveau calque de base
                this.layerManager.createLayer('Plan rogné', img, { 
                    scaleDenominator: this.state.scaleInfo.userDefinedScaleDenominator,
                    originalRotation: originalAngle,
                    insertBelowDrawing: true
                });
                const newBaseLayer = this.state.getActiveLayer();
                newBaseLayer.locked = true;
                
                // Créer le calque de dessin
                this.layerManager.createLayer(this.state.DRAWING_LAYER_NAME, null, {
                    width: img.width,
                    height: img.height,
                    x: 0,
                    y: 0,
                    pixelRatio: window.devicePixelRatio
                });
                const drawingLayer = this.state.getActiveLayer();

                // Configurer le canvas du calque de dessin
                this.canvasManager.setupCanvasListeners(drawingLayer.fabricCanvas);

                this.layerManager.setActiveLayer(drawingLayer.id);
                
                // Remettre le zoom à l'échelle finale demandée par l'utilisateur
                if (this.state.scaleInfo.finalScaleDenominator && this.state.scaleInfo.userDefinedScaleDenominator) {
                    const finalZoom = this.state.scaleInfo.userDefinedScaleDenominator / this.state.scaleInfo.finalScaleDenominator;
                    console.log('🔧 [DEBUG] Remise du zoom à l\'échelle finale:', finalZoom, 'pour échelle 1:', this.state.scaleInfo.finalScaleDenominator);
                    this.applyZoom(finalZoom, true); // forceApply = true pour contourner le verrouillage
                }
                
                this.state.setWorkflowState('ready_for_drawing');
                
                // Déverrouiller le zoom maintenant que le calque dessin est créé
                this.state.isZoomLocked = false;
                console.log('🔓 [DEBUG] Zoom déverrouillé après création du calque dessin');
                
                // Mettre à jour l'interface pour refléter le déverrouillage
                document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
                
                // Cacher le message de guidage de l'étape 3 maintenant que le calque dessin est créé
                const guideMessage = document.getElementById('guide-message');
                if (guideMessage) {
                    guideMessage.style.display = 'none';
                }
                
                this.toolsManager.setMode('select');
            };
            img.src = croppedImageDataUrl;
        }

        // Créer un nouveau projet
        createNewProject() {
            try {
                const projectManager = window.PlanEditor.instances.projectManager;
                if (projectManager) {
                    // isLoadingState est maintenant défini plus tôt dans tools.js
                    console.log('🔄 createNewProject appelé, isLoadingState:', this.state.isLoadingState);
                    
                    // Réinitialiser complètement l'application (inclut la remise à l'état initial de l'UI)
                    projectManager.resetApplication();
                    
                    // Remettre explicitement le mode select
                    this.toolsManager.setMode('select');
                    
                    // Déclencher tous les événements de mise à jour de l'interface
                    document.dispatchEvent(new CustomEvent('update-layers-panel'));
                    document.dispatchEvent(new CustomEvent('update-zoom-display'));
                    document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
                    document.dispatchEvent(new CustomEvent('update-all-projections'));
                    
                    console.log('✅ Nouveau projet créé - Interface remise à l\'état initial');
                    
                    // Marquer la fin de la création du nouveau projet avec un délai plus long pour s'assurer que tous les événements sont traités
                    setTimeout(() => {
                        this.state.isLoadingState = false;
                        this.state.isCreatingNewProject = false;
                        // Double vérification - s'assurer qu'aucun mode de sélection n'est actif
                        this.state.isSelectingArea = false;
                        console.log('🔓 États de chargement remis à false après création nouveau projet');
                    }, 300);
                }
            } catch (error) {
                console.error('❌ Erreur lors de la création du nouveau projet:', error);
                alert('Erreur lors de la création du nouveau projet: ' + error.message);
            }
        }

        openInstructionsFile() {
            try {
                // Ouvrir le fichier instructions dans une nouvelle fenêtre
                window.open('instruction départ.txt', '_blank');
            } catch (error) {
                console.error('❌ Erreur lors de l\'ouverture du fichier instructions:', error);
                alert('Impossible d\'ouvrir le fichier instructions: ' + error.message);
            }
        }
    }

    // Exposer dans le namespace global
    window.PlanEditor.EventManager = EventManager;

})();