// modules/ui.js - Version sans modules ES6
(function() {
    'use strict';
    
    // Gestionnaire de l'interface utilisateur
    class UIManager {
        constructor(state, layerManager, canvasManager, toolsManager) {
            this.state = state;
            this.layerManager = layerManager;
            this.canvasManager = canvasManager;
            this.toolsManager = toolsManager;
            this.setupEventListeners();
        }

        init() {
            console.log('🔧 Initialisation UIManager...');
            
            // Écouter le chargement des panneaux depuis le fichier externe
            document.addEventListener('signs-data-loaded', () => {
                console.log('🔄 Rechargement des panneaux suite au chargement du fichier externe');
                this.populateSignsModal();
            });
            
            try {
                this.populateSignsModal();
                console.log('✅ SignsModal peuplée');
            } catch (error) {
                console.error('❌ Erreur populateSignsModal:', error);
            }

            try {
                this.updateUIToolsState();
                console.log('✅ UI Tools State mis à jour');
            } catch (error) {
                console.error('❌ Erreur updateUIToolsState:', error);
            }

            try {
                this.updateFillOptionsUI();
                console.log('✅ Fill Options UI mis à jour');
            } catch (error) {
                console.error('❌ Erreur updateFillOptionsUI:', error);
            }

            try {
                this.updateGuideMessage(this.state.workflowState);
                console.log('✅ Guide Message mis à jour');
            } catch (error) {
                console.error('❌ Erreur updateGuideMessage:', error);
            }

            try {
                this.updateUndoRedoButtons();
                console.log('✅ Undo/Redo Buttons mis à jour');
            } catch (error) {
                console.error('❌ Erreur updateUndoRedoButtons:', error);
            }


            try {
                this.initializeColorPicker();
                console.log('✅ Color Picker initialisé');
            } catch (error) {
                console.error('❌ Erreur initializeColorPicker:', error);
            }

            try {
                this.setupDashedCheckboxListener();
                console.log('✅ Dashed Checkbox configuré');
            } catch (error) {
                console.error('❌ Erreur setupDashedCheckboxListener:', error);
            }

            try {
                // Initialiser l'état des outils de projet
                document.dispatchEvent(new CustomEvent('update-project-tools-state'));
                
                // Démarrer le surveillant de styles pour forcer l'affichage correct
                setTimeout(() => {
                    if (this.toolsManager && this.toolsManager.startProjectToolsWatcher) {
                        this.toolsManager.startProjectToolsWatcher();
                    }
                }, 100);
                
                console.log('✅ Project Tools State et surveillant initialisés');
            } catch (error) {
                console.error('❌ Erreur update-project-tools-state:', error);
            }

            console.log('✅ UIManager initialisé');
        }

        setupEventListeners() {
            // Écouter les événements d'état
            document.addEventListener('workflow-state-changed', (e) => {
                this.updateGuideMessage(e.detail.state);
                this.updateUIToolsState();
            });

            document.addEventListener('layers-updated', () => {
                this.updateLayersPanel();
            });

            document.addEventListener('update-ui-tools-state', () => {
                this.updateUIToolsState();
            });

            document.addEventListener('update-layers-panel', () => {
                this.updateLayersPanel();
            });

            document.addEventListener('update-fill-options-ui', () => {
                this.updateFillOptionsUI();
            });

            document.addEventListener('update-undo-redo-buttons', () => {
                this.updateUndoRedoButtons();
            });
            
            this.setupScaleChoiceEvents();
        }

        setupScaleChoiceEvents() {
            const btn1_500 = document.getElementById('scale-choice-1-500');
            const btn1_250 = document.getElementById('scale-choice-1-250');
            const btnManual = document.getElementById('btn-manual-calibration');

            if (btn1_500) {
                btn1_500.addEventListener('click', () => {
                    this.hideScaleChoiceModal();
                    // Calibration automatique basée sur la largeur TOTALE visuelle (traits inclus)
                    // Largeur interne (72px) + Bordure gauche (2px) + Bordure droite (2px) = 76px
                    this.toolsManager.handleAutoCalibration({
                        realDistanceMeters: 10,
                        scaleDenominator: 500,
                        pixels: 76 
                    });
                });
            }

            if (btn1_250) {
                btn1_250.addEventListener('click', () => {
                    this.hideScaleChoiceModal();
                    // Calibration automatique basée sur la largeur TOTALE visuelle (traits inclus)
                    // Largeur interne (86px) + Bordure gauche (2px) + Bordure droite (2px) = 90px
                    this.toolsManager.handleAutoCalibration({
                        realDistanceMeters: 6,
                        scaleDenominator: 250,
                        pixels: 90
                    });
                });
            }

            if (btnManual) {
                btnManual.addEventListener('click', () => {
                    this.state.scaleInfo.calibrationPreset = null;
                    this.hideScaleChoiceModal();
                    // Activer l'outil règle pour la calibration manuelle
                    this.toolsManager.setMode('scale'); 
                });
            }
        }

        updateGuideMessage(state) {
            const guideMessage = document.getElementById('guide-message');
            
            switch (state) {
                case 'start':
                    guideMessage.innerHTML = '<h2>Bienvenue dans l\'éditeur de plans</h2><p><strong>1.</strong> Commencez par lire les <strong>Instructions de départ</strong> en cliquant sur le bouton en haut à droite.</p><p><strong>2.</strong> Ensuite, ajoutez une image de fond en utilisant le bouton 🖼️ dans la barre des calques en bas.</p>';
                    guideMessage.style.display = 'block';
                    break;
                case 'image_loaded':
                    guideMessage.innerHTML = '<h2>Étape 1/3 : Calibrer l\'échelle</h2><p>Utilisez l\'outil Règle (📏) pour tracer une ligne sur une distance connue du plan.</p>';
                    guideMessage.style.display = 'block';
                    break;
                case 'scale_calibrated':
                    if (this.state.isDroneImport) {
                        guideMessage.innerHTML = '<h2>Étape 2/3 : Orienter la vue drone</h2><p>Orientez et positionnez la vue. Validez via la fenêtre modale une fois terminé.</p>';
                    } else {
                        guideMessage.innerHTML = '<h2>Étape 2/3 : Orienter le plan</h2><p>Utilisez les contrôles de rotation du calque (angle) et l\'outil de déplacement (✥) pour placer horizontalement ce qui vous sert de repère pour la ligne de base. Cliquez sur ✏️ quand vous avez terminé.</p>';
                    }
                    guideMessage.style.display = 'block';
                    break;
                case 'ready_for_drawing':
                    guideMessage.innerHTML = '<h2>Étape 3/3 : Définir la zone</h2><p>Cliquez et faites glisser pour sélectionner la zone de travail où vous souhaitez dessiner.</p>';
                    guideMessage.style.display = 'block';
                    // Masquer la bulle de guidage si elle est affichée
                    this.hideDrawingGuideTooltip();
                    break;
            }
        }

        updateUIToolsState() {
            const hasLayers = this.state.layers.length > 0;
            const activeLayer = this.state.getActiveLayer();
            const isDrawingLayerActive = activeLayer && activeLayer.name === this.state.DRAWING_LAYER_NAME;
            const drawingLayerExists = this.state.layers.some(l => l.name === this.state.DRAWING_LAYER_NAME);

            // Désactiver tous les groupes d'outils par défaut, sauf le groupe instructions
            document.querySelectorAll('.tool-group:not(.instructions-group)').forEach(group => group.classList.add('disabled'));
            document.getElementById('zoom-tools').classList.remove('disabled');
            document.getElementById('project-tools').classList.remove('disabled');
            
            // Gérer le verrouillage des boutons de zoom
            const btnZoomIn = document.getElementById('btn-zoom-in');
            const btnZoomOut = document.getElementById('btn-zoom-out');
            if (this.state.isZoomLocked) {
                btnZoomIn.disabled = true;
                btnZoomOut.disabled = true;
                btnZoomIn.title = 'Zoom verrouillé à l\'échelle finale';
                btnZoomOut.title = 'Zoom verrouillé à l\'échelle finale';
            } else {
                btnZoomIn.disabled = false;
                btnZoomOut.disabled = false;
                btnZoomIn.title = 'Zoomer';
                btnZoomOut.title = 'Dézoomer';
            }
            
            if (hasLayers) {
                document.getElementById('export-tools').classList.remove('disabled');
            }

            // Boutons de gestion des calques
            // Le bouton d'ajout de calque de fond est désactivé définitivement dès qu'un calque de fond existe
            const hasBackgroundLayer = this.state.layers.some(l => l.fabricCanvas.backgroundImage || l.name.includes('fond') || l.name.includes('Image'));
            document.getElementById('add-image-btn').disabled = hasBackgroundLayer || (this.state.workflowState !== 'start');
            document.getElementById('add-image-layer-btn').disabled = (this.state.workflowState !== 'ready_for_drawing');
            
            // Le bouton d'import drone est désactivé au démarrage et ne s'active que si le workflow est prêt
            // Il agit comme un calque supplémentaire
            const btnImportDrone = document.getElementById('btn-import-drone');
            if (btnImportDrone) {
                btnImportDrone.disabled = (this.state.workflowState !== 'ready_for_drawing');
                // Ajout d'une classe pour le style visuel si nécessaire
                if (btnImportDrone.disabled) {
                    btnImportDrone.classList.add('disabled');
                } else {
                    btnImportDrone.classList.remove('disabled');
                }
            }

            const i = hasLayers ? this.state.layers.findIndex(l => l.id === this.state.activeLayerId) : -1;
            
            const startDrawingBtn = document.getElementById('start-drawing-btn');
            
            switch (this.state.workflowState) {
                case 'start':
                    startDrawingBtn.style.display = 'none';
                    break;

                case 'image_loaded':
                    startDrawingBtn.style.display = 'none';
                    document.getElementById('measure-tools').classList.remove('disabled');
                    document.getElementById('btn-scale').disabled = false;
                    document.getElementById('btn-measure').disabled = true;
                    document.getElementById('main-tools').classList.remove('disabled');
                    document.getElementById('btn-layer-move').disabled = false;
                    this.disableAllToolsExcept(['btn-scale', 'btn-layer-move']);
                    break;

                case 'scale_calibrated':
                    startDrawingBtn.style.display = drawingLayerExists ? 'none' : 'inline-block';
                    document.getElementById('main-tools').classList.remove('disabled');
                    document.getElementById('btn-layer-move').disabled = false;
                    this.disableAllToolsExcept(['btn-layer-move']);
                    break;
                
                case 'ready_for_drawing':
                    startDrawingBtn.style.display = 'none';

                    if (isDrawingLayerActive) {
                        this.enableAllDrawingTools();
                    } else {
                        // Quand un autre calque que le calque dessin est sélectionné
                        this.disableAllToolsAndGroupsExcept(['btn-layer-move']);
                        if (activeLayer) {
                            this.toolsManager.setMode('layer-move');
                        }
                    }

                    this.updateSpecialToolsAvailability();
                    break;
            }

            // ✅ FIX : Ne pas désactiver le bouton scale lors d'un import drone
            // Le bouton scale doit rester actif pour calibrer la vue drone
            if (this.state.scaleInfo.ratio > 0 && !this.state.isDroneImport) {
                document.getElementById('btn-scale').disabled = true;
            }
        }

        disableAllToolsExcept(exceptions) {
            const allToolButtons = document.querySelectorAll('.toolbar button.tool');
            allToolButtons.forEach(btn => {
                btn.disabled = !exceptions.includes(btn.id);
            });
        }

        disableAllToolsAndGroupsExcept(exceptions) {
            // Désactiver tous les groupes d'outils, sauf le groupe instructions
            document.querySelectorAll('.tool-group:not(.instructions-group)').forEach(group => {
                group.classList.add('disabled');
            });
            
            // Réactiver seulement le groupe principal et désactiver tous ses boutons sauf les exceptions
            document.getElementById('main-tools').classList.remove('disabled');
            
            // Désactiver tous les boutons d'outils individuels
            const allToolButtons = document.querySelectorAll('.toolbar button.tool');
            allToolButtons.forEach(btn => {
                btn.disabled = !exceptions.includes(btn.id);
            });
            
            // S'assurer que les boutons d'ajout d'image restent disponibles selon leur logique spécifique
            // Le bouton d'ajout de calque de fond ne doit jamais être réactivé s'il existe déjà un calque de fond
            const hasBackgroundLayer = this.state.layers.some(l => l.fabricCanvas.backgroundImage || l.name.includes('fond') || l.name.includes('Image'));
            document.getElementById('add-image-btn').disabled = hasBackgroundLayer || (this.state.workflowState !== 'start');
            document.getElementById('add-image-layer-btn').disabled = (this.state.workflowState !== 'ready_for_drawing');
            
            const btnImportDrone = document.getElementById('btn-import-drone');
            if (btnImportDrone) {
                btnImportDrone.disabled = (this.state.workflowState !== 'ready_for_drawing');
            }
            
            // Garder les outils de zoom disponibles
            document.getElementById('zoom-tools').classList.remove('disabled');
            
            // Garder les outils d'export disponibles si il y a des calques
            if (this.state.layers.length > 0) {
                document.getElementById('export-tools').classList.remove('disabled');
            }
        }

        enableAllDrawingTools() {
            document.getElementById('main-tools').classList.remove('disabled');
            document.getElementById('measure-tools').classList.remove('disabled');
            document.getElementById('object-tools').classList.remove('disabled');
            document.getElementById('drawing-options-tools').classList.remove('disabled');
            document.getElementById('shape-options-tools').classList.remove('disabled');
            document.getElementById('fill-options-tools').classList.remove('disabled');
            document.getElementById('text-options-tools').classList.remove('disabled');
            
            // Activer tous les boutons d'outils, SAUF ceux qui ont des règles spécifiques
            const allToolButtons = document.querySelectorAll('.toolbar button.tool');
            allToolButtons.forEach(btn => {
                // Ne pas toucher aux boutons qui ont des règles spécifiques
                if (btn.id !== 'btn-scale' && btn.id !== 'add-image-btn' && btn.id !== 'add-image-layer-btn') {
                    btn.disabled = false;
                }
            });
        }

        updateSpecialToolsAvailability() {
            const activeLayer = this.state.getActiveLayer();
            const isDrawingLayerActive = activeLayer && activeLayer.name === this.state.DRAWING_LAYER_NAME;
            const drawingLayer = this.state.layers.find(l => l.name === this.state.DRAWING_LAYER_NAME);
            const baselineExists = drawingLayer ? drawingLayer.fabricCanvas.getObjects().some(o => o.isBaseline) : false;
            const scaleCalibrated = this.state.scaleInfo.ratio > 0;

            const btnAddCar = document.getElementById('btn-add-car');
            btnAddCar.disabled = !isDrawingLayerActive || !baselineExists || !scaleCalibrated;

            // Mettre à jour le tooltip si la ligne de base n'existe pas
            if (!baselineExists) {
                btnAddCar.title = "Ajouter une LB avant de pouvoir ajouter un véhicule";
            } else {
                btnAddCar.title = "Ajouter Voiture";
            }

            document.getElementById('btn-add-landmark').disabled = !isDrawingLayerActive || !baselineExists || !scaleCalibrated;
        }

        updateLayersPanel() {
            const layersList = document.getElementById('layers-list');
            layersList.innerHTML = '';
            
            // Séparer les calques par type pour afficher dans l'ordre correct (de haut en bas dans l'UI)
            const backgroundLayers = [];
            const supplementaryLayers = [];
            const drawingLayers = [];
            
            this.state.layers.forEach(layer => {
                if (layer.name === this.state.DRAWING_LAYER_NAME) {
                    drawingLayers.push(layer);
                } else if (layer.name === "Plan rogné" || layer.name === "Image de fond") {
                    backgroundLayers.push(layer);
                } else if (layer.name.startsWith("Vue drone")) {
                    // Les vues drone sont traitées comme des calques supplémentaires
                    supplementaryLayers.push(layer);
                } else {
                    supplementaryLayers.push(layer);
                }
            });
            
            // Afficher dans l'ordre z-index croissant : fond en haut, dessin en bas (pour correspondre à l'attente utilisateur)
            [...backgroundLayers, ...supplementaryLayers, ...drawingLayers].forEach(layer => {
                const li = this.createLayerItem(layer);
                layersList.appendChild(li);
            });
        }

        createLayerItem(layer) {
            const li = document.createElement('li');
            li.className = `layer-item ${layer.id === this.state.activeLayerId ? 'active' : ''}`;
            li.dataset.id = layer.id;

            const previewUrl = layer.fabricCanvas.toDataURL({format: 'png', quality: 0.1});
            const scaleText = layer.scaleDenominator ? ` (1:${layer.scaleDenominator})` : '';

            // Déterminer le nom d'affichage selon le type de calque
            let displayName;
            if (layer.name === this.state.DRAWING_LAYER_NAME) {
                displayName = "Calque Dessin";
            } else if (layer.name === "Plan rogné" || layer.name === "Image de fond") {
                // Seulement les calques de fond originaux
                displayName = "Calque Fond";
            } else {
                // Pour les vues drone et images collées, utiliser le nom réel
                if (layer.name.startsWith("Vue drone")) {
                    displayName = layer.name;
                } else {
                    // Pour tous les autres calques (supplémentaires), compter combien il y en a déjà
                    const allSupplementaryLayers = this.state.layers.filter(l =>
                        l.name !== this.state.DRAWING_LAYER_NAME &&
                        l.name !== "Plan rogné" &&
                        l.name !== "Image de fond" &&
                        !l.name.startsWith("Vue drone")
                    );
                    const layerNumber = allSupplementaryLayers.indexOf(layer) + 1;
                    displayName = `Calque supplémentaire ${layerNumber}`;
                }
            }

            const deleteIconHTML = `<span class="layer-icon" data-action="delete" title="Supprimer le calque">🗑️</span>`;
            const lockIconHTML = `<span class="layer-icon" data-action="lock" title="Verrouiller/Déverrouiller">${layer.locked ? '🔒' : '🔓'}</span>`;

            // 🚁 NOUVEAU : Permettre la rotation des vues drone même quand elles sont verrouillées
            const isDroneLayer = layer.name.startsWith("Vue drone");
            const rotationDisabled = layer.locked && !isDroneLayer;

            const rotationControlHTML =
                `<div class="rotation-control">
                        <label>Angle:</label>
                        <input type="number" class="rotation-input" min="-360" max="360" step="1" value="${layer.angle}" ${rotationDisabled ? 'disabled' : ''}> °
                   </div>`;

            // 🟦 NOUVEAU : Case à cocher pour le fond blanc (uniquement pour le calque de dessin)
            const whiteBackgroundControlHTML = layer.name === this.state.DRAWING_LAYER_NAME ?
                `<div class="white-background-control">
                    <label for="white-bg-checkbox-${layer.id}" style="cursor:pointer;" title="Activer/Désactiver le fond blanc">Fond blanc:</label>
                    <input type="checkbox" id="white-bg-checkbox-${layer.id}" class="white-bg-checkbox" ${layer.hasWhiteBackground ? 'checked' : ''} ${layer.locked ? 'disabled' : ''}>
                </div>` : '';

            li.innerHTML = `
                <div class="layer-preview" style="background-image: url(${previewUrl})">
                    <div class="layer-controls-icons">
                        ${deleteIconHTML}
                        ${lockIconHTML}
                    </div>
                </div>
                <div class="layer-info">
                    <div class="layer-meta">
                        <span class="visibility">${layer.visible ? '👁️' : '➖'}</span>
                        <span class="name" title="${displayName}${scaleText}">${displayName}${scaleText}</span>
                    </div>
                    <div class="opacity-control">
                        <label>Opacité: ${Math.round(layer.opacity * 100)}%</label>
                        <input type="range" class="opacity-slider" min="0" max="1" step="0.01" value="${layer.opacity}" ${layer.locked ? 'disabled' : ''}>
                    </div>
                    ${rotationControlHTML}
                    ${whiteBackgroundControlHTML}
                </div>`;

            this.setupLayerItemEventListeners(li, layer);
            return li;
        }

        setupLayerItemEventListeners(li, layer) {
            // Événement de visibilité
            li.querySelector('.visibility').addEventListener('click', e => {
                e.stopPropagation();
                this.layerManager.toggleVisibility(layer.id);
            });
            
            // Événement de verrouillage
            const lockBtn = li.querySelector('[data-action="lock"]');
            if (lockBtn) {
                lockBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    this.layerManager.toggleLock(layer.id);
                });
            }
            
            // Événement de suppression
            const deleteBtn = li.querySelector('[data-action="delete"]');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    this.layerManager.deleteLayer(layer.id);
                });
            }

            // Contrôle d'opacité
            li.querySelector('.opacity-slider').addEventListener('input', e => {
                e.stopPropagation();
                this.layerManager.setOpacity(layer.id, e.target.value);
                li.querySelector('.opacity-control label').textContent = `Opacité: ${Math.round(e.target.value * 100)}%`;
            });
            
            // Contrôle de rotation
            const rotationInput = li.querySelector('.rotation-input');
            if (rotationInput) {
                rotationInput.addEventListener('change', e => {
                    e.stopPropagation();

                    // Masquer seulement la modale d'alignement si on est en étape 2/3 (orienter le plan)
                    if (this.state.workflowState === 'scale_calibrated') {
                        const alignmentModal = document.getElementById('alignment-guide-modal');
                        if (alignmentModal) {
                            alignmentModal.style.display = 'none';
                        }
                    }

                    let angle = parseFloat(e.target.value);
                    if (isNaN(angle)) angle = 0;
                    angle = Math.max(-360, Math.min(360, angle));
                    e.target.value = angle;
                    this.layerManager.setLayerAngle(layer.id, angle);
                });
                rotationInput.addEventListener('click', e => e.stopPropagation());
            }

            // 🟦 NOUVEAU : Contrôle du fond blanc (uniquement pour le calque de dessin)
            const whiteBgCheckbox = li.querySelector('.white-bg-checkbox');
            if (whiteBgCheckbox) {
                whiteBgCheckbox.addEventListener('change', e => {
                    e.stopPropagation();
                    this.layerManager.toggleDrawingLayerWhiteBackground();
                });
                whiteBgCheckbox.addEventListener('click', e => e.stopPropagation());
            }

            // Sélection du calque
            li.addEventListener('click', () => {
                if(layer.locked) return;
                this.layerManager.setActiveLayer(layer.id);
            });
        }

        updateFillOptionsUI() {
            const canvas = this.state.getActiveCanvas();
            const activeObject = canvas?.getActiveObject();
            const stripeAngleContainer = document.getElementById('stripe-angle-container');
            const stripeAngleSlider = document.getElementById('stripe-angle-slider');
            const stripeAngleDisplay = document.getElementById('stripe-angle-display');
            const stripeThicknessSlider = document.getElementById('stripe-thickness-slider');
            const stripeThicknessDisplay = document.getElementById('stripe-thickness-display');
            const colorPickerFill = document.getElementById('color-picker-fill');
            const fillTypeSolid = document.getElementById('fill-type-solid');
            const fillTypeStripes = document.getElementById('fill-type-stripes');

            // Détecter si l'objet sélectionné contient des rayures (direct ou dans un groupe)
            let hasStripes = false;
            let hasFilled = false;
            let stripeAngle = 30; // valeur par défaut
            let stripeThickness = 2; // valeur par défaut
            let stripeColor = '#000000'; // valeur par défaut
            
            if (activeObject && activeObject.isFilled) {
                hasFilled = true;
                if (activeObject.isStriped) {
                    // Objet rayé direct
                    hasStripes = true;
                    stripeAngle = activeObject.stripeAngle || 30;
                    stripeThickness = activeObject.stripeThickness || 2;
                    stripeColor = activeObject.stripeColor || '#000000';
                }
            } else if (activeObject && activeObject.type === 'group' && activeObject.isFilled) {
                hasFilled = true;
                if (activeObject.isStriped) {
                    // Groupe contenant des rayures
                    hasStripes = true;
                    stripeAngle = activeObject.stripeAngle || 30;
                    stripeThickness = activeObject.stripeThickness || 2;
                    stripeColor = activeObject.stripeColor || '#000000';
                }
            }
            
            // Synchroniser les boutons radio avec l'objet sélectionné
            if (hasFilled) {
                if (hasStripes) {
                    if (fillTypeStripes) fillTypeStripes.checked = true;
                } else {
                    if (fillTypeSolid) fillTypeSolid.checked = true;
                }
                
                // Mettre à jour la couleur du color picker avec la couleur de l'objet
                if (colorPickerFill) {
                    if (hasStripes) {
                        colorPickerFill.value = stripeColor;
                    } else {
                        // Pour les objets solides, récupérer la couleur de remplissage
                        let fillColor = '#000000';
                        let filledObject = activeObject;
                        if (activeObject.type === 'group' && activeObject.isFilled) {
                            const objects = activeObject.getObjects();
                            filledObject = objects.find(obj => obj.isFilled && obj.type === 'path');
                        }
                        if (filledObject && filledObject.fill && typeof filledObject.fill === 'string') {
                            fillColor = filledObject.fill;
                        }
                        colorPickerFill.value = fillColor;
                    }
                }
            }
            
            // Gérer l'affichage des options de rayures
            const selectedFillType = document.querySelector('input[name="fill-type"]:checked')?.value || 'solid';
            const currentMode = this.toolsManager ? this.toolsManager.state.currentMode : 'select';
            
            if (hasStripes || (currentMode === 'fill' && selectedFillType === 'stripes')) {
                // Afficher les contrôles de rayures
                stripeAngleContainer.style.display = 'inline-flex';
                
                // Mettre à jour les valeurs des contrôles
                if (stripeAngleSlider) {
                    stripeAngleSlider.value = stripeAngle;
                }
                if (stripeAngleDisplay) {
                    stripeAngleDisplay.textContent = `${stripeAngle}°`;
                }
                if (stripeThicknessSlider) {
                    stripeThicknessSlider.value = stripeThickness;
                }
                if (stripeThicknessDisplay) {
                    stripeThicknessDisplay.textContent = `${stripeThickness}px`;
                }
            } else {
                // Masquer les contrôles de rayures
                stripeAngleContainer.style.display = 'none';
            }
        }

        updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const layer = this.state.getActiveLayer();
    
    if (layer && this.layerManager.undoRedoManager) {
        const historyInfo = this.layerManager.undoRedoManager.getHistoryInfo(layer);
        
        // Utiliser les nouvelles vérifications cohérentes
        btnUndo.disabled = !historyInfo.canUndo;
        btnRedo.disabled = !historyInfo.canRedo;
        
        // Mise à jour des tooltips avec informations précises
        btnUndo.title = historyInfo.canUndo 
            ? `Annuler (${historyInfo.undo} action${historyInfo.undo > 1 ? 's' : ''} disponible${historyInfo.undo > 1 ? 's' : ''})` 
            : 'Annuler (aucune action à annuler)';
            
        btnRedo.title = historyInfo.canRedo 
            ? `Rétablir (${historyInfo.redo} action${historyInfo.redo > 1 ? 's' : ''} disponible${historyInfo.redo > 1 ? 's' : ''})` 
            : 'Rétablir (aucune action à rétablir)';
            
        console.log(`🔄 Historique: ${historyInfo.undo} undo (${historyInfo.canUndo ? 'activé' : 'désactivé'}), ${historyInfo.redo} redo (${historyInfo.canRedo ? 'activé' : 'désactivé'})`);
    } else {
        btnUndo.disabled = true;
        btnRedo.disabled = true;
        btnUndo.title = 'Annuler (Ctrl+Z)';
        btnRedo.title = 'Rétablir (Ctrl+Y)';
        console.log('🔄 Aucun calque actif - boutons undo/redo désactivés');
    }
}


        // Gestion des modales
        populateSignsModal() {
            const signsGrid = document.getElementById('signs-grid');
            
            if (!signsGrid) {
                console.error('❌ Élément signs-grid non trouvé');
                return;
            }

            signsGrid.innerHTML = '';

            const customSignItem = document.createElement('div');
            customSignItem.className = 'sign-item add-custom-sign';
            customSignItem.innerHTML = `
                <label for="custom-sign-loader" title="Charger une image personnalisée">+</label>
                <input type="file" id="custom-sign-loader" accept="image/*" style="display:none;">
            `;
            signsGrid.appendChild(customSignItem);

            if (this.state.signsData.length === 0) {
                signsGrid.insertAdjacentHTML('beforeend', `<p style="color: #ffc107;">Aucun panneau n'est défini dans le code (variable signsData).</p>`);
                return;
            }

            this.state.signsData.forEach(sign => {
                const signContainer = document.createElement('div');
                signContainer.className = 'sign-item';
                const signImg = document.createElement('img');
                signImg.src = sign.dataUrl;
                signImg.alt = sign.name;
                signImg.title = `Ajouter le panneau ${sign.name}`;
                signContainer.appendChild(signImg);
                signContainer.addEventListener('click', () => {
                    this.toolsManager.addSignToCanvas(sign.dataUrl, sign.name);
                    this.hideSignsModal();
                });
                signsGrid.appendChild(signContainer);
            });
        }

        showSignsModal() {
            document.getElementById('signs-modal').style.display = 'block';
        }

        hideSignsModal() {
            document.getElementById('signs-modal').style.display = 'none';
        }

        showLandmarkModal() {
            const landmarkModal = document.getElementById('landmark-modal');
            const landmarkXInput = document.getElementById('landmark-x-input');
            const landmarkYInput = document.getElementById('landmark-y-input');
            
            landmarkXInput.value = '0';
            landmarkYInput.value = '0';
            landmarkModal.style.display = 'block';
            landmarkXInput.focus();
        }

        showVehicleModal() {
            console.log('🚗 UI showVehicleModal() - ouverture de la modal');
            const vehicleModal = document.getElementById('vehicle-modal');
            const vehicleWidthInput = document.getElementById('vehicle-width-input');
            const vehicleLengthInput = document.getElementById('vehicle-length-input');
            const vehicleLetterInput = document.getElementById('vehicle-letter-input');
            const vehicleColorInput = document.getElementById('vehicle-color-input');
            const vehicleThicknessInput = document.getElementById('vehicle-thickness-input');
            const vehicleThicknessDisplay = document.getElementById('vehicle-thickness-display');

            console.log('🚗 Éléments modal trouvés:', !!vehicleModal, !!vehicleWidthInput, !!vehicleLengthInput, !!vehicleLetterInput, !!vehicleColorInput, !!vehicleThicknessInput);

            // Diagnostiquer les styles CSS AVANT modification
            const computedStyle = window.getComputedStyle(vehicleModal);
            console.log('🚗 Styles CSS AVANT - display:', computedStyle.display, 'visibility:', computedStyle.visibility, 'z-index:', computedStyle.zIndex);

            // 🚗 NOUVEAU : Calculer la lettre automatiquement basée sur les véhicules existants
            const nextVehicleLetter = this.getNextVehicleLetter();
            console.log('🚗 Lettre véhicule proposée:', nextVehicleLetter);

            // Initialiser les valeurs par défaut
            vehicleWidthInput.value = '1.8';
            vehicleLengthInput.value = '4.5';
            vehicleLetterInput.value = nextVehicleLetter;
            vehicleColorInput.value = '#000000';
            vehicleThicknessInput.value = '2';
            vehicleThicknessDisplay.textContent = '2px';

            vehicleModal.style.display = 'block';
            vehicleModal.style.visibility = 'visible';
            vehicleModal.style.zIndex = '9999';
            vehicleWidthInput.focus();

            // Diagnostiquer les styles CSS APRÈS modification
            const computedStyleAfter = window.getComputedStyle(vehicleModal);
            console.log('🚗 Styles CSS APRÈS - display:', computedStyleAfter.display, 'visibility:', computedStyleAfter.visibility, 'z-index:', computedStyleAfter.zIndex);

            console.log('✅ Modal véhicule affichée');
        }

        // 🚗 NOUVEAU : Trouver la prochaine lettre de véhicule disponible
        getNextVehicleLetter() {
            const usedLetters = new Set();

            // Parcourir tous les calques pour trouver les lettres utilisées
            this.state.layers.forEach(layer => {
                const canvas = layer.fabricCanvas;
                if (canvas) {
                    canvas.getObjects().forEach(obj => {
                        if (obj.isVehicle && obj.isVehicle) {
                            // La lettre est dans le premier objet texte du groupe (lettre d'identification)
                            obj.getObjects().forEach(child => {
                                if (child.type === 'text' && child.text && child.text.length === 1) {
                                    usedLetters.add(child.text.toUpperCase());
                                }
                            });
                        }
                    });
                }
            });

            console.log('🚗 Lettres déjà utilisées:', Array.from(usedLetters));

            // Trouver la prochaine lettre disponible
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            for (let i = 0; i < alphabet.length; i++) {
                if (!usedLetters.has(alphabet[i])) {
                    return alphabet[i];
                }
            }

            // Si toutes les lettres A-Z sont utilisées, revenir à A
            console.log('🚗 Toutes les lettres A-Z sont utilisées, retour à A');
            return 'A';
        }

        showAddLayerModal(layerType) {
            const addLayerModal = document.getElementById('add-layer-modal');
            addLayerModal.dataset.layerType = layerType;
            addLayerModal.style.display = 'block';
        }

        hideAddLayerModal() {
            document.getElementById('add-layer-modal').style.display = 'none';
        }

        showScaleChoiceModal() {
            document.getElementById('scale-choice-modal').style.display = 'block';
        }

        hideScaleChoiceModal() {
            document.getElementById('scale-choice-modal').style.display = 'none';
        }

        showAlignmentGuideModal() {
            const modal = document.getElementById('alignment-guide-modal');
            const validateBtn = document.getElementById('btn-validate-alignment');
            
            if (validateBtn) {
                // Afficher le bouton de validation uniquement pour l'import drone
                validateBtn.style.display = this.state.isDroneImport ? 'block' : 'none';
            }
            
            modal.style.display = 'block';
        }

        hideAlignmentGuideModal() {
            document.getElementById('alignment-guide-modal').style.display = 'none';
        }

        showDrawingGuideTooltip() {
            const tooltip = document.getElementById('drawing-guide-tooltip');
            const targetButton = document.getElementById('start-drawing-btn');
            
            if (!tooltip || !targetButton) return;
            
            // Calculer la position de la bulle par rapport au bouton
            const buttonRect = targetButton.getBoundingClientRect();
            const tooltipWidth = 280; // max-width from CSS
            
            // Positionner la bulle au-dessus du bouton, centrée
            const left = buttonRect.left + (buttonRect.width / 2) - (tooltipWidth / 2);
            const top = buttonRect.top - 80; // 80px au-dessus du bouton
            
            // Contraindre la position de la bulle aux bords de l'écran
            const finalLeft = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));
            
            tooltip.style.left = `${finalLeft}px`;
            tooltip.style.top = `${Math.max(10, top)}px`;
            tooltip.style.display = 'block';
            
            // Calculer la position de la flèche pour qu'elle pointe vers le centre du bouton
            const buttonCenter = buttonRect.left + (buttonRect.width / 2);
            const arrowPosition = buttonCenter - finalLeft; // Position relative à la bulle
            const arrow = tooltip.querySelector('.tooltip-arrow');
            if (arrow) {
                arrow.style.left = `${Math.max(20, Math.min(arrowPosition, tooltipWidth - 20))}px`;
                arrow.style.transform = 'translateX(-50%)';
            }
            
            // Animation d'entrée
            setTimeout(() => {
                tooltip.classList.add('show');
            }, 10);
        }
        
        hideDrawingGuideTooltip() {
            const tooltip = document.getElementById('drawing-guide-tooltip');
            if (!tooltip) return;
            
            tooltip.classList.remove('show');
            setTimeout(() => {
                tooltip.style.display = 'none';
            }, 300);
        }

        showLegendModal(defaultLegend) {
            const legendModal = document.getElementById('legend-modal');
            const legendTextarea = document.getElementById('legend-textarea');
            
            legendTextarea.value = defaultLegend;
            legendModal.style.display = 'block';
        }

        hideLegendModal() {
            document.getElementById('legend-modal').style.display = 'none';
        }

        // Gestion du zoom
        updateZoomDisplay() {
            const zoomLevelDisplay = document.getElementById('zoom-level-display');
            if (this.state.isEditingZoom) return;

            if (this.state.zoomDisplayMode === 'scale' && this.state.scaleInfo.userDefinedScaleDenominator) {
                const currentScaleDenominator = this.state.scaleInfo.userDefinedScaleDenominator / this.state.zoom;
                zoomLevelDisplay.innerHTML = `1:${Math.round(currentScaleDenominator)}`;
                zoomLevelDisplay.title = "Affichage en échelle (cliquer pour changer ou entrer une nouvelle échelle)";
                zoomLevelDisplay.classList.add('switchable');
            } else {
                this.state.zoomDisplayMode = 'percent';
                zoomLevelDisplay.innerHTML = `${Math.round(this.state.zoom * 100)}%`;
                if (this.state.scaleInfo.userDefinedScaleDenominator) {
                    zoomLevelDisplay.title = "Affichage en pourcentage (cliquer pour changer ou entrer une échelle)";
                    zoomLevelDisplay.classList.add('switchable');
                } else {
                    zoomLevelDisplay.title = "Affichage en pourcentage";
                    zoomLevelDisplay.classList.remove('switchable');
                }
            }
        }

        setupZoomLevelClickHandler() {
            const zoomLevelDisplay = document.getElementById('zoom-level-display');
            
            zoomLevelDisplay.addEventListener('click', () => {
                if (this.state.isEditingZoom) return;

                if (this.state.zoomDisplayMode === 'percent') {
                    if (this.state.scaleInfo.userDefinedScaleDenominator) {
                        this.state.zoomDisplayMode = 'scale';
                        this.updateZoomDisplay();
                    }
                } else {
                    if (!this.state.scaleInfo.userDefinedScaleDenominator) {
                        alert("Pour utiliser cette fonctionnalité, l'échelle de base du plan doit être connue.\n\nVous pouvez la définir :\n1. À l'importation de l'image.\n2. En utilisant l'outil règle (📏) et en répondant à la question sur l'échelle de base.");
                        return;
                    }
                    this.showZoomEditMode();
                }
            });
        }

        showZoomEditMode() {
            const zoomLevelDisplay = document.getElementById('zoom-level-display');
            this.state.isEditingZoom = true;
            const currentDenominator = Math.round(this.state.scaleInfo.userDefinedScaleDenominator / this.state.zoom);
            zoomLevelDisplay.innerHTML = `<input type="text" value="${currentDenominator}" />`;
            const input = zoomLevelDisplay.querySelector('input');
            input.focus();
            input.select();

            const endEdit = (validate = false) => {
                if (!this.state.isEditingZoom) return;
                this.state.isEditingZoom = false;

                if (validate) {
                    const y = parseFloat(input.value);
                    if (!isNaN(y) && y > 0) {
                        const newZoom = this.state.scaleInfo.userDefinedScaleDenominator / y;
                        document.dispatchEvent(new CustomEvent('apply-zoom', { detail: { zoom: newZoom } }));
                    } else {
                        alert("Veuillez entrer un nombre valide.");
                    }
                }
                input.remove();
                this.updateZoomDisplay();
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    endEdit(true);
                } else if (e.key === 'Escape') {
                    endEdit(false);
                }
            });
            input.addEventListener('blur', () => endEdit(true));
        }

        // Mode plein écran
        toggleFullscreen() {
            this.state.isFullscreenMode = !this.state.isFullscreenMode;
            document.body.classList.toggle('fullscreen-active', this.state.isFullscreenMode);
            
            const toolbar = document.querySelector('.toolbar');
            const layersPanel = document.querySelector('.layers-panel');
            const btnFullscreen = document.getElementById('btn-fullscreen');

            if (this.state.isFullscreenMode) {
                btnFullscreen.innerHTML = 'EXIT';
                btnFullscreen.title = "Quitter le mode Plein Écran";
                if (this.state.uiHideTimeout) clearTimeout(this.state.uiHideTimeout);
                this.state.uiHideTimeout = setTimeout(() => {
                    toolbar.classList.add('hidden');
                    layersPanel.classList.add('hidden');
                }, 2500);
            } else {
                btnFullscreen.innerHTML = '⛶';
                btnFullscreen.title = "Mode Plein Écran";
                // Forcer la réapparition de l'interface en sortant du mode plein écran
                toolbar.classList.remove('hidden');
                layersPanel.classList.remove('hidden');
                if (this.state.uiHideTimeout) clearTimeout(this.state.uiHideTimeout);
                this.state.uiHideTimeout = null;
            }
        }

        handleUIVisibility(e) {
            if (!this.state.isFullscreenMode) return;

            const toolbar = document.querySelector('.toolbar');
            const layersPanel = document.querySelector('.layers-panel');
            const getPointerCoords = (e) => {
                if (e.touches && e.touches.length > 0) {
                    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
                return { x: e.clientX, y: e.clientY };
            };
            
            const coords = getPointerCoords(e);
            const y = coords.y;
            const windowHeight = window.innerHeight;

            if (y < 80 || y > windowHeight - 80) {
                // L'utilisateur est près des bords - afficher l'interface
                toolbar.classList.remove('hidden');
                layersPanel.classList.remove('hidden');
                
                // FORCE: Réappliquer les styles inline pour s'assurer que l'interface est visible
                toolbar.style.opacity = '1';
                toolbar.style.transform = 'none';
                toolbar.style.visibility = 'visible';
                toolbar.style.pointerEvents = 'auto';
                toolbar.style.zIndex = '1010'; // Plus élevé que guide-message (1005)
                layersPanel.style.opacity = '1';
                layersPanel.style.transform = 'none';
                layersPanel.style.visibility = 'visible';
                layersPanel.style.pointerEvents = 'auto';
                layersPanel.style.zIndex = '1010'; // Plus élevé que guide-message (1005)
                
                
                if (this.state.uiHideTimeout) {
                    clearTimeout(this.state.uiHideTimeout);
                    this.state.uiHideTimeout = null;
                }
            } else {
                // L'utilisateur est au centre - programmer le masquage si pas déjà fait
                if (!toolbar.classList.contains('hidden') && !this.state.uiHideTimeout) {
                    this.state.uiHideTimeout = setTimeout(() => {
                        toolbar.classList.add('hidden');
                        layersPanel.classList.add('hidden');
                        
                        // Supprimer les styles inline pour permettre au CSS de prendre le contrôle
                        toolbar.style.opacity = '';
                        toolbar.style.transform = '';
                        toolbar.style.visibility = '';
                        toolbar.style.pointerEvents = '';
                        toolbar.style.zIndex = '';
                        layersPanel.style.opacity = '';
                        layersPanel.style.transform = '';
                        layersPanel.style.visibility = '';
                        layersPanel.style.pointerEvents = '';
                        layersPanel.style.zIndex = '';
                        
                        this.state.uiHideTimeout = null;
                    }, 1500);
                }
            }
        }

        // Initialisation des composants
        initializeColorPicker() {
            const colorPicker = document.getElementById('color-picker');
            colorPicker.value = '#000000';
        }

        setupDashedCheckboxListener() {
            const dashedCheckbox = document.getElementById('dashed-checkbox');
            const dashSpacingContainer = document.getElementById('dash-spacing-container');
            
            dashedCheckbox.addEventListener('change', () => {
                dashSpacingContainer.style.display = dashedCheckbox.checked ? 'inline-flex' : 'none';
            });
        }

        setupFillTypeRadioListeners() {
            const fillTypeRadios = document.querySelectorAll('input[name="fill-type"]');
            fillTypeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    // Appliquer le changement de type à l'objet sélectionné
                    const newFillType = e.target.value;
                    this.applyFillTypeChange(newFillType);
                    
                    // Mettre à jour l'UI pour afficher/masquer les options de rayures
                    this.updateFillOptionsUI();
                });
            });
        }

        applyFillTypeChange(newFillType) {
            const canvas = this.state.getActiveCanvas();
            if (!canvas) return;
            
            const activeObject = canvas.getActiveObject();
            if (!activeObject || !activeObject.isFilled) return;
            
            // Trouver l'objet rempli (peut être direct ou dans un groupe)
            let filledObject = null;
            if (activeObject.isFilled && activeObject.type === 'path') {
                filledObject = activeObject;
            } else if (activeObject.type === 'group' && activeObject.isFilled) {
                // Trouver l'objet de remplissage dans le groupe
                const objects = activeObject.getObjects();
                filledObject = objects.find(obj => obj.isFilled && obj.type === 'path');
            }
            
            if (!filledObject) return;
            
            const colorPickerFill = document.getElementById('color-picker-fill');
            const selectedColor = colorPickerFill ? colorPickerFill.value : '#000000';
            
            if (newFillType === 'stripes') {
                // Convertir vers rayures
                const stripeAngleSlider = document.getElementById('stripe-angle-slider');
                const stripeThicknessSlider = document.getElementById('stripe-thickness-slider');
                const angle = stripeAngleSlider ? parseInt(stripeAngleSlider.value, 10) : 30;
                const thickness = stripeThicknessSlider ? parseInt(stripeThicknessSlider.value, 10) : 2;
                
                const toolsManager = this.state.toolsManager || window.PlanEditor?.instances?.toolsManager;
                if (toolsManager) {
                    const stripePattern = toolsManager.createStripePattern(selectedColor, angle, thickness);
                    
                    // Appliquer les propriétés rayées
                    filledObject.set({
                        fill: stripePattern,
                        isStriped: true,
                        stripeAngle: angle,
                        stripeColor: selectedColor,
                        stripeThickness: thickness
                    });
                    
                    // Mettre à jour les propriétés du groupe si nécessaire
                    if (activeObject.type === 'group') {
                        activeObject.isStriped = true;
                        activeObject.stripeAngle = angle;
                        activeObject.stripeColor = selectedColor;
                        activeObject.stripeThickness = thickness;
                    }
                }
            } else {
                // Convertir vers solide
                filledObject.set({
                    fill: selectedColor,
                    isStriped: false
                });
                
                // Supprimer les propriétés de rayures
                delete filledObject.stripeAngle;
                delete filledObject.stripeColor;
                delete filledObject.stripeThickness;
                
                // Mettre à jour les propriétés du groupe si nécessaire
                if (activeObject.type === 'group') {
                    activeObject.isStriped = false;
                    delete activeObject.stripeAngle;
                    delete activeObject.stripeColor;
                    delete activeObject.stripeThickness;
                }
            }
            
            canvas.renderAll();
            
            // Mettre à jour directement l'affichage des options de rayures
            this.updateStripeControlsDisplay(newFillType === 'stripes');
            
            // Mettre à jour l'UI complète après un très court délai
            requestAnimationFrame(() => {
                this.updateFillOptionsUI();
            });
        }

        updateStripeControlsDisplay(showStripes) {
            const stripeAngleContainer = document.getElementById('stripe-angle-container');
            if (stripeAngleContainer) {
                stripeAngleContainer.style.display = showStripes ? 'inline-flex' : 'none';
            }
        }

        setupStripeAngleSlider() {
            const stripeAngleSlider = document.getElementById('stripe-angle-slider');
            const stripeAngleDisplay = document.getElementById('stripe-angle-display');
            
            stripeAngleSlider.addEventListener('input', (e) => {
                const newAngle = parseInt(e.target.value, 10);
                stripeAngleDisplay.textContent = `${newAngle}°`;

                const canvas = this.state.getActiveCanvas();
                if (!canvas) return;
                const activeObject = canvas.getActiveObject();

                // Gérer les objets rayés individuels ET les groupes contenant des rayures
                let stripedObject = null;
                
                if (activeObject && activeObject.isStriped && activeObject.fill && activeObject.fill.patternTransform) {
                    // Objet rayé direct
                    stripedObject = activeObject;
                } else if (activeObject && activeObject.type === 'group' && activeObject.isStriped) {
                    // Groupe contenant des rayures - trouver l'objet rayé dans le groupe
                    const objects = activeObject.getObjects();
                    stripedObject = objects.find(obj => obj.isStriped && obj.fill && obj.fill.patternTransform);
                }
                
                if (stripedObject) {
                    // Recréer le pattern avec le nouvel angle
                    const toolsManager = window.PlanEditor.instances.toolsManager;
                    const newPattern = toolsManager.createStripePattern(stripedObject.stripeColor, newAngle, stripedObject.stripeThickness || 2);
                    
                    // Appliquer le nouveau pattern
                    stripedObject.set({
                        fill: newPattern,
                        stripeAngle: newAngle
                    });
                    
                    // Mettre à jour les propriétés du groupe si c'est un groupe
                    if (activeObject.type === 'group') {
                        activeObject.stripeAngle = newAngle;
                    }
                    
                    canvas.renderAll();
                }
            });
        }

        setupStripeThicknessSlider() {
            const stripeThicknessSlider = document.getElementById('stripe-thickness-slider');
            const stripeThicknessDisplay = document.getElementById('stripe-thickness-display');
            
            stripeThicknessSlider.addEventListener('input', (e) => {
                const newThickness = parseInt(e.target.value, 10);
                stripeThicknessDisplay.textContent = `${newThickness}px`;

                const canvas = this.state.getActiveCanvas();
                if (!canvas) return;
                const activeObject = canvas.getActiveObject();

                // Gérer les objets rayés individuels ET les groupes contenant des rayures
                let stripedObject = null;
                
                if (activeObject && activeObject.isStriped && activeObject.fill && activeObject.fill.patternTransform) {
                    // Objet rayé direct
                    stripedObject = activeObject;
                } else if (activeObject && activeObject.type === 'group' && activeObject.isStriped) {
                    // Groupe contenant des rayures - trouver l'objet rayé dans le groupe
                    const objects = activeObject.getObjects();
                    stripedObject = objects.find(obj => obj.isStriped && obj.fill && obj.fill.patternTransform);
                }
                
                if (stripedObject) {
                    // Recréer le pattern avec la nouvelle épaisseur
                    const toolsManager = window.PlanEditor.instances.toolsManager;
                    const newPattern = toolsManager.createStripePattern(stripedObject.stripeColor, stripedObject.stripeAngle || 30, newThickness);
                    
                    // Appliquer le nouveau pattern
                    stripedObject.set({
                        fill: newPattern,
                        stripeThickness: newThickness
                    });
                    
                    // Mettre à jour les propriétés du groupe si c'est un groupe
                    if (activeObject.type === 'group') {
                        activeObject.stripeThickness = newThickness;
                    }
                    
                    canvas.renderAll();
                }
            });
        }

        setupStripeColorPicker() {
            const colorPickerFill = document.getElementById('color-picker-fill');
            
            colorPickerFill.addEventListener('input', (e) => {
                const newColor = e.target.value;

                const canvas = this.state.getActiveCanvas();
                if (!canvas) return;
                const activeObject = canvas.getActiveObject();

                if (!activeObject || !activeObject.isFilled) return;

                // Trouver l'objet rempli (peut être direct ou dans un groupe)
                let filledObject = null;
                if (activeObject.isFilled && activeObject.type === 'path') {
                    filledObject = activeObject;
                } else if (activeObject.type === 'group' && activeObject.isFilled) {
                    // Trouver l'objet de remplissage dans le groupe
                    const objects = activeObject.getObjects();
                    filledObject = objects.find(obj => obj.isFilled && obj.type === 'path');
                }
                
                if (filledObject) {
                    if (filledObject.isStriped) {
                        // Objet rayé : recréer le pattern avec la nouvelle couleur
                        const currentAngle = filledObject.stripeAngle || 30;
                        const currentThickness = filledObject.stripeThickness || 2;
                        
                        const toolsManager = this.state.toolsManager || window.PlanEditor?.instances?.toolsManager;
                        if (toolsManager) {
                            const newPattern = toolsManager.createStripePattern(newColor, currentAngle, currentThickness);
                            
                            // Appliquer le nouveau pattern
                            filledObject.set({
                                fill: newPattern,
                                stripeColor: newColor
                            });
                            
                            // Mettre à jour les propriétés du groupe si nécessaire
                            if (activeObject.type === 'group') {
                                activeObject.stripeColor = newColor;
                            }
                        }
                    } else {
                        // Objet solide : changer directement la couleur
                        filledObject.set({
                            fill: newColor
                        });
                    }
                    
                    canvas.renderAll();
                }
            });
        }

        setupFillToleranceSlider() {
            const toleranceSlider = document.getElementById('fill-tolerance-slider');
            const toleranceDisplay = document.getElementById('fill-tolerance-display');
            
            if (toleranceSlider && toleranceDisplay) {
                toleranceSlider.addEventListener('input', (e) => {
                    const newTolerance = parseInt(e.target.value, 10);
                    toleranceDisplay.textContent = newTolerance;
                });
            }
        }

        // Gestion des repères
        setupLandmarkVisibilityControls() {
            const toggleLandmarksCheckbox = document.getElementById('toggle-landmarks-checkbox');
            const toggleLandmarkCoordsCheckbox = document.getElementById('toggle-landmark-coords-checkbox');
            
            // Mettre à jour l'état initial
            this.updateLandmarkControlsState();

            toggleLandmarksCheckbox.addEventListener('change', (e) => {
                const isVisible = e.target.checked;
                this.state.layers.forEach(layer => {
                    layer.fabricCanvas.getObjects().forEach(obj => {
                        if (obj.isLandmark) {
                            obj.set('visible', isVisible);
                        }
                    });
                    layer.fabricCanvas.renderAll();
                });
            });

            toggleLandmarkCoordsCheckbox.addEventListener('change', (e) => {
                const canvas = this.state.getActiveCanvas();
                if (!canvas) return;

                const isVisible = e.target.checked;
                const objectsToRemove = canvas.getObjects().filter(o => 
                    o.isProjectionElement && o.projectionId && o.projectionId.startsWith('proj_landmark_')
                );
                canvas.remove(...objectsToRemove);

                if (isVisible) {
                    document.dispatchEvent(new CustomEvent('update-all-projections'));
                }
                canvas.renderAll();
            });
        }

        // Mettre à jour l'état des contrôles des repères selon leur présence
        updateLandmarkControlsState() {
            const toggleLandmarksCheckbox = document.getElementById('toggle-landmarks-checkbox');
            const toggleLandmarkCoordsCheckbox = document.getElementById('toggle-landmark-coords-checkbox');
            const landmarkVisibilityControl = document.querySelector('.landmark-visibility-control');
            
            // Compter les repères présents sur tous les calques
            let landmarkCount = 0;
            this.state.layers.forEach(layer => {
                layer.fabricCanvas.getObjects().forEach(obj => {
                    if (obj.isLandmark) {
                        landmarkCount++;
                    }
                });
            });
            
            const hasLandmarks = landmarkCount > 0;
            
            // Activer/désactiver les contrôles selon la présence de repères
            toggleLandmarksCheckbox.disabled = !hasLandmarks;
            toggleLandmarkCoordsCheckbox.disabled = !hasLandmarks;
            
            // Changer le style visuel
            if (hasLandmarks) {
                landmarkVisibilityControl.style.opacity = '1';
                landmarkVisibilityControl.style.color = '';
            } else {
                landmarkVisibilityControl.style.opacity = '0.5';
                landmarkVisibilityControl.style.color = '#999';
            }
        }
    }

    // Exposer dans le namespace global
    window.PlanEditor.UIManager = UIManager;

})();