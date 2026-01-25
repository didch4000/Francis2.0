// modules/tools.js - Version sans modules ES6
(function() {
    'use strict';
    
    // Gestionnaire des outils de dessin
    class ToolsManager {
        constructor(state, layerManager, canvasManager) {
            this.state = state;
            this.layerManager = layerManager;
            this.canvasManager = canvasManager;
            this.lastUsedTool = null; // Garde en mémoire le dernier outil utilisé
            this.projectEventsAttached = false; // Flag pour éviter les attachements multiples
            this.setupEventListeners();
        }

        setupEventListeners() {
            // Écouter les événements personnalisés
            document.addEventListener('create-curved-path', (e) => {
                this.createCurvedPath(e.detail.start, e.detail.end);
            });

            document.addEventListener('handle-crossing-draw', (e) => {
                this.handleCrossingDraw(e.detail.rect);
            });

            document.addEventListener('handle-yield-draw', (e) => {
                this.handleYieldDraw(e.detail.rect);
            });

            document.addEventListener('handle-scale', (e) => {
                this.handleScale(e.detail.pixels);
            });

            document.addEventListener('handle-measure', (e) => {
                this.handleMeasure(e.detail.start, e.detail.end, e.detail.line);
            });

            document.addEventListener('handle-baseline-draw', (e) => {
                this.handleBaselineDraw(e.detail.start, e.detail.end);
            });

            document.addEventListener('handle-skid-mark-draw', (e) => {
                this.handleSkidMarkDraw(e.detail.start, e.detail.end);
            });

            document.addEventListener('handle-fill', (e) => {
                this.handleFill(e.detail.pointer, e.detail.target);
            });

            document.addEventListener('auto-select-tool', () => {
                this.setMode('select');
            });

            // Écouter les événements de sélection d'objets pour mettre à jour les options de rayures
            document.addEventListener('object-selection-changed', () => {
                // Mettre à jour la visibilité des options seulement si on est dans un mode qui permet la sélection
                const isSelectionAllowed = this.state.currentMode === 'select' || this.state.currentMode === 'add-text';
                if (isSelectionAllowed) {
                    this.updateSelectionOptionsVisibility();
                }
            });
        }

        setMode(newMode) {
            this.canvasManager.cancelLineDraw();

            const canvas = this.state.getActiveCanvas();
            if (canvas) {
                canvas.isDrawingMode = false;
                
                // CORRECTION: Forcer la sortie d'édition si changement de mode manuel
                const activeObject = canvas.getActiveObject();
                if (activeObject && activeObject.type === 'textbox' && activeObject.isEditing) {
                    console.log('DEBUG: Sortie forcée d\'édition lors du changement de mode');
                    activeObject.exitEditing();
                    canvas.requestRenderAll();
                }
            }
            
            // ✅ NOUVEAU : Nettoyer le flag de courbe en attente lors du changement de mode
            if (this.state.hasPendingCurveSave && newMode !== 'select') {
                console.log('🎯 [CURVE DEBUG] Nettoyage flag hasPendingCurveSave lors changement mode');
                this.state.hasPendingCurveSave = false;
            }
            
            const activeLayer = this.state.getActiveLayer();
            if (newMode === 'layer-move') {
                if (activeLayer && activeLayer.name === this.state.DRAWING_LAYER_NAME) {
                    newMode = 'pan'; 
                } else {
                    newMode = 'layer-move';
                }
            }

            // Sauvegarder l'outil précédent seulement si on passe automatiquement en 'select'
            // Si l'utilisateur clique manuellement sur un outil, réinitialiser lastUsedTool
            if (this.state.currentMode !== 'select' && newMode === 'select') {
                this.lastUsedTool = this.state.currentMode;
            } else if (newMode !== 'select') {
                this.lastUsedTool = null; // Reset si changement manuel d'outil
            }

            this.state.setCurrentMode(newMode);
            this.updateToolButtons();
            this.updateContextualUI(newMode);
            
            // Mettre à jour la sélectabilité des objets remplis selon le mode
            this.updateFilledObjectsSelectability(newMode);
            
            this.updateCanvasInteraction(canvas);
            this.updateCursor();
            this.updateProjectToolsState();
        }

        updateFilledObjectsSelectability(mode) {
            // Rendre les objets remplis sélectionnables uniquement en mode 'select'
            const isSelectMode = mode === 'select';
            
            this.state.layers.forEach(layer => {
                if (layer.fabricCanvas) {
                    layer.fabricCanvas.getObjects().forEach(obj => {
                        // Ne modifier que les objets explicitement marqués comme remplis
                        if (obj.isFilled === true || (obj.type === 'group' && obj.isFilled === true)) {
                            obj.set({
                                selectable: isSelectMode,
                                evented: isSelectMode
                            });
                        }
                        // S'assurer que les objets normaux restent sélectionnables en mode select
                        else if (isSelectMode && !obj.isBaseline && !obj.isZeroPoint && 
                                !obj.isProjectionElement && !obj.isMeasurement && !obj.isScaleBar &&
                                obj.selectable !== false) {
                            obj.set({
                                selectable: true,
                                evented: true
                            });
                        }
                    });
                    layer.fabricCanvas.renderAll();
                }
            });
        }

        updateToolButtons() {
            const allToolButtons = document.querySelectorAll('.toolbar button.tool');
            allToolButtons.forEach(btn => btn.classList.remove('active'));
            
            document.getElementById('btn-add-text').classList.remove('active');
            document.getElementById('btn-undo').classList.remove('active');
            document.getElementById('btn-redo').classList.remove('active');

            if (this.state.currentMode === 'add-text') {
                document.getElementById('btn-add-text').classList.add('active');
            } else if (this.state.currentMode === 'pan' || this.state.currentMode === 'layer-move') {
                document.getElementById('btn-layer-move').classList.add('active');
            } else if (this.state.currentMode === 'select') {
                document.getElementById('btn-select').classList.add('active');
            } else {
                const activeButton = document.getElementById(`btn-${this.state.currentMode.replace('_', '-')}`);
                if (activeButton) activeButton.classList.add('active');
            }
        }

        updateContextualUI(currentMode) {
            // Hide all option groups first, but keep project tools always visible
            const allOptionGroups = document.querySelectorAll('.options-group');
            allOptionGroups.forEach(group => {
                // Ne pas masquer le groupe des outils de projet
                if (group.id !== 'project-tools') {
                    group.style.display = 'none';
                }
            });

            // Show appropriate option groups based on current tool
            const drawingTools = ['draw', 'curve', 'circle', 'arrow']; // Outils avec toutes les options (y compris pointillés)
            const shapeTools = ['crossing', 'yield', 'skid-mark']; // Outils formes avec couleur et épaisseur seulement
            const textTools = ['add-text'];
            const fillTools = ['fill'];
            const noOptionsTools = ['layer-move', 'pan', 'scale', 'measure', 'baseline']; // Outils sans options
            // baseline n'a pas d'options configurables (propriétés fixes)

            if (drawingTools.includes(currentMode)) {
                // Outils de dessin : afficher les options de dessin complètes (avec pointillés)
                const drawingOptions = document.getElementById('drawing-options-tools');
                if (drawingOptions) {
                    drawingOptions.style.display = 'flex';
                }
            } else if (shapeTools.includes(currentMode)) {
                // Outils formes : afficher seulement couleur et épaisseur (sans pointillés)
                const shapeOptions = document.getElementById('shape-options-tools');
                if (shapeOptions) {
                    shapeOptions.style.display = 'flex';
                }
            } else if (textTools.includes(currentMode)) {
                // Outil texte : afficher SEULEMENT les options de texte (pas les options de traits par défaut)
                const textOptions = document.getElementById('text-options-tools');
                if (textOptions) {
                    textOptions.style.display = 'flex';
                }
                // Ne pas afficher les options de traits par défaut pour le texte
            } else if (fillTools.includes(currentMode)) {
                // Outil remplissage : afficher les options de remplissage
                const fillOptions = document.getElementById('fill-options-tools');
                if (fillOptions) {
                    fillOptions.style.display = 'flex';
                }
                // Mettre à jour l'affichage des options de rayures
                if (this.uiManager) {
                    this.uiManager.updateFillOptionsUI();
                }
            } else if (currentMode === 'select') {
                // Outil sélection : laisser updateSelectionOptionsVisibility gérer l'affichage
                this.updateSelectionOptionsVisibility();
            } else if (noOptionsTools.includes(currentMode)) {
                // Outils sans options : ne rien afficher
                // Les options restent masquées
            } else {
                // Pour tous les autres outils : afficher les options de traits par défaut
                const drawingOptions = document.getElementById('drawing-options-tools');
                if (drawingOptions) {
                    drawingOptions.style.display = 'flex';
                }
            }
        }

        updateSelectionOptionsVisibility() {
            const canvas = this.state.getActiveCanvas();
            const fillOptions = document.getElementById('fill-options-tools');
            const drawingOptions = document.getElementById('drawing-options-tools');
            const shapeOptions = document.getElementById('shape-options-tools');
            const textOptions = document.getElementById('text-options-tools');
            
            if (!canvas || !fillOptions) return;

            const activeObject = canvas.getActiveObject();
            
            // Vérifier si l'objet sélectionné peut être modifié dynamiquement
            let hasFilledObject = false;
            let hasStripedObject = false;
            let isTextInEditing = false;
            
            // Vérifier si c'est un objet texte en cours d'édition
            if (activeObject && activeObject.type === 'textbox' && activeObject.isEditing) {
                isTextInEditing = true;
            }
            
            // Vérifier si c'est un objet rempli
            if (activeObject && activeObject.isFilled) {
                // Objet rempli direct
                hasFilledObject = true;
                if (activeObject.isStriped) {
                    hasStripedObject = true;
                }
            } else if (activeObject && activeObject.type === 'group' && activeObject.isFilled) {
                // Groupe contenant un objet rempli
                hasFilledObject = true;
                if (activeObject.isStriped) {
                    hasStripedObject = true;
                }
            }
            
            if (isTextInEditing) {
                // Texte en édition : les options de texte sont gérées par showTextControls()
                // Ne pas interférer avec ce système
                return;
            } else if (hasFilledObject) {
                // Objet rempli : afficher seulement les options de remplissage
                if (drawingOptions) drawingOptions.style.display = 'none';
                if (shapeOptions) shapeOptions.style.display = 'none';
                if (textOptions) textOptions.style.display = 'none';
                fillOptions.style.display = 'flex';
                
                // Mettre à jour les valeurs des contrôles si c'est un objet rayé
                if (hasStripedObject) {
                    document.dispatchEvent(new CustomEvent('update-fill-options-ui'));
                }
            } else {
                // Aucun objet modifiable sélectionné ou aucun objet sélectionné : masquer toutes les options
                if (drawingOptions) drawingOptions.style.display = 'none';
                if (shapeOptions) shapeOptions.style.display = 'none';
                if (textOptions) textOptions.style.display = 'none';
                fillOptions.style.display = 'none';
            }
        }

        showActionToolOptions(toolType) {
            // Afficher les options appropriées pour les outils d'action directe
            const allOptionGroups = document.querySelectorAll('.options-group');
            allOptionGroups.forEach(group => {
                group.style.display = 'none';
            });

            if (toolType === 'arrow') {
                // Flèche : afficher options de dessin sans pointillés
                const shapeOptions = document.getElementById('shape-options-tools');
                if (shapeOptions) {
                    shapeOptions.style.display = 'flex';
                }
            }
        }

        updateCanvasInteraction(canvas) {
            if (!canvas) return;

            // Empêcher la sélection d'objets quand les outils de dessin sont actifs
            const isSelectionMode = this.state.currentMode === 'select';
            const isDrawingTool = ['draw', 'curve', 'circle', 'arrow', 'measure', 'scale'].includes(this.state.currentMode);
            // Empêcher la sélection si on est en mode dessin, sinon utiliser la logique normale
            const allowSelection = isDrawingTool ? false : isSelectionMode;
            
            canvas.selection = allowSelection;
            // En mode dessin, empêcher complètement la détection d'objets pour éviter l'affichage des contrôles
            canvas.skipTargetFind = isDrawingTool;
            canvas.getObjects().forEach(obj => {
                obj.set('selectable', allowSelection);
                // En mode dessin, désactiver les événements pour empêcher l'affichage des contrôles de sélection
                obj.set('evented', !isDrawingTool);
            });
            canvas.renderAll();
            
            document.dispatchEvent(new CustomEvent('update-object-order-buttons-state'));
        }

      // Corrections dans modules/tools.js - Méthodes à remplacer/ajouter

// MÉTHODE CORRIGÉE : updateCursor avec debug et force
updateCursor() {
    const canvasContainer = document.getElementById('canvas-container');
    const canvas = this.state.getActiveCanvas();
    
    console.log(`🎯 [DEBUG] Mise à jour curseur pour mode: ${this.state.currentMode}`);
    
    // Vérifier si nous sommes en mode édition de texte
    const activeObject = canvas && canvas.getActiveObject();
    const isEditingText = activeObject && activeObject.type === 'textbox' && activeObject.isEditing;
    
    if (isEditingText) {
        console.log('✏️ [DEBUG] Édition de texte en cours - curseur délégué à Fabric.js');
        // Laisser Fabric.js gérer le curseur pendant l'édition de texte
        canvasContainer.style.cursor = '';
        return;
    }
    
    // Retirer TOUTES les classes de curseur existantes
    const allCursorClasses = [
        'layer-move-cursor', 'fill-cursor', 'text-cursor', 'pan-cursor',
        'draw-cursor', 'circle-cursor', 'curve-cursor', 'measure-cursor',
        'scale-cursor', 'baseline-cursor', 'crossing-cursor', 'yield-cursor',
        'skid-mark-cursor', 'select-cursor', 'tool-disabled-cursor',
        'area-selecting', 'drawing', 'loading-cursor', 'panning-cursor'
    ];
    
    canvasContainer.classList.remove(...allCursorClasses);
    
    // Forcer le curseur par défaut d'abord
    canvasContainer.style.cursor = '';
    
    // PRIORITÉ 1: États spéciaux
    if (this.state.isSelectingArea) {
        canvasContainer.classList.remove(...allCursorClasses);
        canvasContainer.classList.add('area-selecting');
        console.log('🎯 [DEBUG] Mode sélection de zone actif (priorité haute)');
        return;
    }
    
    if (this.state.isPanning) {
        canvasContainer.classList.remove(...allCursorClasses);
        canvasContainer.classList.add('panning-cursor');
        console.log('🤏 [DEBUG] Mode panoramique actif (priorité haute)');
        return;
    }
    
    // Vérifier si l'outil est disponible
    if (this.isToolDisabled()) {
        console.log('⚠️ [DEBUG] Outil désactivé, curseur interdit');
        canvasContainer.classList.add('tool-disabled-cursor');
        return;
    }
    
    // Déterminer le curseur selon le mode actuel
    let cursorClass = 'select-cursor'; // Par défaut
    
    switch (this.state.currentMode) {
        case 'select':
            cursorClass = 'select-cursor';
            break;
        case 'layer-move':
            cursorClass = 'layer-move-cursor';
            break;
        case 'pan':
            cursorClass = 'pan-cursor';
            break;
        case 'draw':
            cursorClass = 'draw-cursor';
            break;
        case 'circle':
            cursorClass = 'circle-cursor';
            break;
        case 'curve':
            cursorClass = 'curve-cursor';
            break;
        case 'arrow':
            cursorClass = 'draw-cursor';
            break;
        case 'fill':
            cursorClass = 'fill-cursor';
            break;
        case 'add-text':
            cursorClass = 'text-cursor';
            break;
        case 'measure':
            cursorClass = 'measure-cursor';
            break;
        case 'scale':
            cursorClass = 'scale-cursor';
            break;
        case 'baseline':
            cursorClass = 'baseline-cursor';
            break;
        case 'crossing':
            cursorClass = 'crossing-cursor';
            break;
        case 'yield':
            cursorClass = 'yield-cursor';
            break;
        case 'skid-mark':
            cursorClass = 'skid-mark-cursor';
            break;
    }
    
    console.log(`✅ [DEBUG] Application curseur: ${cursorClass}`);
    canvasContainer.classList.add(cursorClass);
    
    // Désactiver les curseurs Fabric.js qui pourraient interférer
    this.disableFabricCursors();
    
    // États spéciaux qui peuvent surcharger le curseur de base
    if (this.state.isDrawing) {
        canvasContainer.classList.add('drawing');
        console.log('✏️ [DEBUG] Mode dessin actif');
    }
    
    // Log final pour debug
    console.log(`📋 [DEBUG] Classes CSS appliquées:`, canvasContainer.className);
}

	   // Nouvelle méthode pour vérifier si un outil est désactivé
isToolDisabled() {
    // Vérifier si le bouton correspondant au mode actuel est désactivé
    let buttonId = `btn-${this.state.currentMode.replace('_', '-')}`;
    
    // Cas spéciaux pour certains outils
    if (this.state.currentMode === 'add-text') {
        buttonId = 'btn-add-text';
    }
    
    const currentButton = document.getElementById(buttonId);
    const isDisabled = currentButton && currentButton.disabled;
    
    if (isDisabled) {
        console.log(`⚠️ Outil ${this.state.currentMode} désactivé`);
    }
    
    return isDisabled;
}
// NOUVELLE MÉTHODE : Désactiver les curseurs Fabric.js (sauf pour l'édition de texte)
disableFabricCursors() {
    const canvas = this.state.getActiveCanvas();
    if (canvas) {
        // Vérifier si nous sommes en mode édition de texte
        const activeObject = canvas.getActiveObject();
        const isEditingText = activeObject && activeObject.type === 'textbox' && activeObject.isEditing;
        
        if (isEditingText) {
            console.log('✏️ [DEBUG] Édition de texte en cours - curseurs Fabric.js conservés');
            // Ne pas désactiver les curseurs pendant l'édition de texte
            return;
        }
        
        // Forcer les curseurs Fabric.js à 'inherit' pour qu'ils utilisent le CSS
        canvas.defaultCursor = 'inherit';
        canvas.hoverCursor = 'inherit';
        canvas.moveCursor = 'inherit';
        canvas.rotationCursor = 'inherit';
        
        // Appliquer immédiatement
        canvas.setCursor('inherit');
        
        console.log('🚫 [DEBUG] Curseurs Fabric.js désactivés');
    }
}


// Méthode pour mettre à jour le curseur pendant les opérations
updateCursorForOperation(operation) {
    const canvasContainer = document.getElementById('canvas-container');
    
    switch (operation) {
        case 'loading':
            canvasContainer.classList.add('loading-cursor');
            break;
        case 'drawing':
            canvasContainer.classList.add('drawing');
            break;
        case 'area-selecting':
            canvasContainer.classList.add('area-selecting');
            break;
        case 'disabled':
            canvasContainer.classList.add('tool-disabled-cursor');
            break;
        default:
            // Retirer les états spéciaux et revenir au curseur normal
            const specialClasses = ['loading-cursor', 'drawing', 'area-selecting', 'tool-disabled-cursor'];
            canvasContainer.classList.remove(...specialClasses);
            this.updateCursor();
            break;
    }
}

// Méthode pour gérer les curseurs pendant les interactions avec les objets Fabric.js
setupFabricCursors(canvas) {
    if (!canvas) return;
    
    console.log('🎨 [DEBUG] Configuration curseurs Fabric.js - Mode passif');
    
    // Configuration de base - tous les curseurs en 'inherit'
    canvas.defaultCursor = 'inherit';
    canvas.freeDrawingCursor = 'inherit';
    canvas.moveCursor = 'inherit';
    canvas.rotationCursor = 'inherit';
    canvas.hoverCursor = 'inherit';
    
    // Ne PAS écouter les changements de mode pour éviter les conflits
    // Laisser le CSS gérer tous les curseurs
    
    // Seuls les événements de sélection/interaction restent
    canvas.on('selection:created', () => {
        if (this.state.currentMode === 'select') {
            // Laisser le CSS gérer le curseur
            console.log('✅ [DEBUG] Sélection créée - CSS gère le curseur');
        }
    });
    
    canvas.on('selection:cleared', () => {
        console.log('✅ [DEBUG] Sélection effacée - CSS gère le curseur');
    });
    
    // Forcer l'application immédiate
    canvas.setCursor('inherit');
}

// NOUVELLE MÉTHODE : Debug des curseurs
debugCursor() {
    const canvasContainer = document.getElementById('canvas-container');
    const canvas = this.state.getActiveCanvas();
    
    console.log('🔍 [DEBUG] === ÉTAT DES CURSEURS ===');
    console.log('Mode actuel:', this.state.currentMode);
    console.log('Classes CSS:', canvasContainer.className);
    console.log('Style cursor:', canvasContainer.style.cursor);
    
    if (canvas) {
        console.log('Fabric defaultCursor:', canvas.defaultCursor);
        console.log('Fabric hoverCursor:', canvas.hoverCursor);
        console.log('Fabric moveCursor:', canvas.moveCursor);
    }
    
    console.log('isDrawing:', this.state.isDrawing);
    console.log('isSelectingArea:', this.state.isSelectingArea);
    console.log('isPanning:', this.state.isPanning);
    console.log('🔍 [DEBUG] === FIN ÉTAT CURSEURS ===');
}
        // Outils de dessin spécifiques
        createCurvedPath(start, end) {
    const canvas = this.state.getActiveCanvas();
    if (!canvas) return;
    
    console.log('🎯 [CURVE DEBUG] Création courbe - flag bloquage actif:', !!this.state.isCreatingCurve);
    
    const options = this.canvasManager.getDrawOptions();
    const control = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const path = new fabric.Path(`M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`, 
        { ...options, fill: 'transparent' });

    const controlHandle = new fabric.Circle({
        radius: 8,
        fill: 'rgba(0,122,255,0.8)',
        stroke: 'white',
        strokeWidth: 2,
        left: control.x,
        top: control.y,
        originX: 'center',
        originY: 'center',
        hasBorders: false,
        hasControls: false,
        isControlPoint: true,
        path: path,
        isBeingDragged: false
    });

    path.controlHandle = controlHandle;
    canvas.add(path, controlHandle);
    
    // ✅ CORRECTION : Passer en mode select automatiquement
    this.setMode('select');
    canvas.setActiveObject(controlHandle); // Sélectionner le point de contrôle
    canvas.renderAll();
    
    // Marquer la fin du processus de création de courbe mais pas de sauvegarde immédiate
    this.state.isCreatingCurve = false;
    console.log('🎯 [CURVE DEBUG] Fin création courbe - sauvegardes réactivées');
    
    // NE PAS sauvegarder immédiatement - attendre que l'utilisateur termine l'ajustement
    console.log('🎯 [CURVE DEBUG] Pas de sauvegarde immédiate - attente ajustement utilisateur');
    
    // Marquer que nous avons une courbe en attente de sauvegarde
    this.state.hasPendingCurveSave = true;
    
    // ✅ NOUVEAU : Sauvegarde de secours au cas où l'utilisateur ne bouge pas le point de contrôle
    setTimeout(() => {
        if (this.state.hasPendingCurveSave) {
            console.log('🎯 [CURVE DEBUG] Sauvegarde de secours - utilisateur n\'a pas ajusté le point de contrôle');
            const layer = this.state.getActiveLayer();
            if (layer && this.layerManager.undoRedoManager) {
                this.layerManager.undoRedoManager.forceSave(canvas, layer);
                this.state.hasPendingCurveSave = false;
                console.log('✅ [CURVE DEBUG] Courbe sauvegardée via timeout de secours');
            }
        }
    }, 2000); // 2 secondes de délai
    
    document.dispatchEvent(new CustomEvent('update-layers-panel'));
}

        handleYieldDraw(rect) {
            const canvas = this.state.getActiveCanvas();
            if (!canvas) return;
            
            const width = Math.abs(rect.width);
            if (width < 20) return;
            
            const left = rect.left, top = rect.top;
            const options = this.canvasManager.getDrawOptions();
            const triangleWidth = 12; 
            const triangleHeight = 15;
            const gap = 5;
            const triangles = [];
            
            const commonProps = { 
                width: triangleWidth, 
                height: triangleHeight, 
                fill: 'transparent', 
                stroke: options.stroke, 
                strokeWidth: options.strokeWidth, 
                angle: 180, 
                originX: 'center', 
                originY: 'center' 
            };
            
            let currentX = triangleWidth / 2;
            while (currentX < width) { 
                triangles.push(new fabric.Triangle({ 
                    ...commonProps, 
                    left: currentX, 
                    top: triangleHeight / 2 
                })); 
                currentX += triangleWidth + gap; 
            }
            
            const yieldGroup = new fabric.Group(triangles, { 
                left: left, 
                top: top, 
                originX: rect.width < 0 ? 'right' : 'left', 
                originY: rect.height < 0 ? 'bottom' : 'top' 
            });
            
            canvas.add(yieldGroup);
            
            // Sauvegarder l'état après création du STOP
            this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
            
            this.setMode('select');
        }

        handleCrossingDraw(rect) {
            const canvas = this.state.getActiveCanvas();
            if (!canvas) return;
            
            const width = Math.abs(rect.width), height = Math.abs(rect.height);
            if (width < 10 || height < 10) return;
            
            const left = rect.left, top = rect.top;
            const options = this.canvasManager.getDrawOptions();
            const stripeThickness = 15, gap = 12;
            const stripes = [], isVertical = height > width;
            
            const commonProps = { 
                fill: 'transparent', 
                stroke: options.stroke, 
                strokeWidth: options.strokeWidth, 
                originX: 'left', 
                originY: 'top' 
            };
            
            if (isVertical) {
                // Calculer le nombre de rectangles complets possibles
                const totalAvailable = height;
                const stripeSpacing = stripeThickness + gap;
                const maxCompleteStripes = Math.floor((totalAvailable + gap) / stripeSpacing);
                
                // Ajuster la hauteur pour centrer les rectangles complets
                const totalUsedHeight = (maxCompleteStripes * stripeSpacing) - gap;
                const offsetY = (height - totalUsedHeight) / 2;
                
                let currentY = offsetY;
                for (let i = 0; i < maxCompleteStripes && currentY + stripeThickness <= height; i++) {
                    stripes.push(new fabric.Rect({ 
                        ...commonProps, 
                        width: width, 
                        height: stripeThickness, 
                        top: currentY 
                    }));
                    currentY += stripeSpacing;
                }
            } else {
                // Calculer le nombre de rectangles complets possibles
                const totalAvailable = width;
                const stripeSpacing = stripeThickness + gap;
                const maxCompleteStripes = Math.floor((totalAvailable + gap) / stripeSpacing);
                
                // Ajuster la largeur pour centrer les rectangles complets
                const totalUsedWidth = (maxCompleteStripes * stripeSpacing) - gap;
                const offsetX = (width - totalUsedWidth) / 2;
                
                let currentX = offsetX;
                for (let i = 0; i < maxCompleteStripes && currentX + stripeThickness <= width; i++) {
                    stripes.push(new fabric.Rect({ 
                        ...commonProps, 
                        width: stripeThickness, 
                        height: height, 
                        left: currentX 
                    }));
                    currentX += stripeSpacing;
                }
            }
            
            const crossingGroup = new fabric.Group(stripes, { 
                left: left, 
                top: top, 
                originX: rect.width < 0 ? 'right' : 'left', 
                originY: rect.height < 0 ? 'bottom' : 'top' 
            });
            
            canvas.add(crossingGroup);
            
            // Sauvegarder l'état après création du passage piéton
            this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
            
            this.setMode('select');
        }

        handleSkidMarkDraw(start, end) {
            const canvas = this.state.getActiveCanvas();
            if (!canvas) return;

            const colorPicker = document.getElementById('color-picker');
            const thicknessSelector = document.getElementById('thickness-selector');
            
            const color = colorPicker.value;
            const startWidth = parseInt(thicknessSelector.value, 10) / this.state.zoom;
            const endWidth = startWidth * 4;

            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const len = Math.hypot(dx, dy);
            if (len === 0) return;

            const nx = dx / len;
            const ny = dy / len;
            const px = -ny;
            const py = nx;

            const p1 = { x: start.x + px * startWidth / 2, y: start.y + py * startWidth / 2 };
            const p2 = { x: start.x - px * startWidth / 2, y: start.y - py * startWidth / 2 };
            const p3 = { x: end.x - px * endWidth / 2, y: end.y - py * endWidth / 2 };
            const p4 = { x: end.x + px * endWidth / 2, y: end.y + py * endWidth / 2 };

            const skidMark = new fabric.Polygon([p1, p2, p3, p4], {
                fill: color,
                strokeWidth: 0,
                selectable: true,
                evented: true,
            });
            canvas.add(skidMark);
            
            // Sauvegarder l'état après création de la trace de pneu
            this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
            
            this.setMode('select');
        }

        handleBaselineDraw(start, end) {
            const canvas = this.state.getActiveCanvas();
            if (!canvas) return;

            const existingBaseline = canvas.getObjects().find(o => o.isBaseline);
            if (existingBaseline) {
                const confirmed = confirm("Cette action supprimera la ligne de base existante ainsi que tous les véhicules, repères et mesures associés. Voulez-vous continuer ?");
                if (confirmed) {
                    const objectsToRemove = canvas.getObjects().filter(o => 
                        o.isBaseline || o.isZeroPoint || o.isProjectionElement || o.isLandmark || o.isVehicle
                    );
                    canvas.remove(...objectsToRemove);
                } else {
                    return;
                }
            }

            const width = Math.abs(end.x - start.x);
            const lineY = start.y;
            const lineX = Math.min(start.x, end.x);

            const baseline = new fabric.Line([lineX, lineY, lineX + width, lineY], {
                stroke: 'red',
                strokeWidth: 2,
                isBaseline: true,
                selectable: true,
                hasControls: false,
                hasBorders: true,
                lockMovementX: true,
                lockMovementY: true,
                lockRotation: true,
                lockScalingX: true,
                lockScalingY: true,
                lockUniScaling: true,
                name: 'LB'
            });
            
            // Override complet des méthodes de contrôles pour la ligne de base
            baseline.hasControls = false;
            baseline.hasBorders = true;
            baseline.selectable = true;
            baseline.evented = true;
            baseline.controls = {};
            
            // Override radical : empêcher complètement le dessin des contrôles
            baseline.drawControls = function() { return this; };
            baseline._renderControls = function() { return this; };
            baseline.drawBorders = function(ctx) {
                // Dessiner seulement les bordures, pas les contrôles
                if (!this.hasBorders || !this.isMoving && !this.isActive) return this;
                ctx.save();
                ctx.strokeStyle = this.borderColor;
                ctx.lineWidth = this.borderScaleFactor;
                ctx.setLineDash(this.borderDashArray || []);
                this._setLineDash(ctx, this.borderDashArray);
                ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
                ctx.restore();
                return this;
            };

            // Ajout d'un trait au-dessus du point zéro pour visualiser le début de la mesure
            const topIndicator = new fabric.Line([0, -25, 0, -12], { stroke: 'red', strokeWidth: 2 });
            
            const zeroText = new fabric.Text('0', {
                left: 2, top: 0, originX: 'left', originY: 'center',
                fontSize: 16, fill: 'red', backgroundColor: 'white',
                textBaseline: 'middle', // Corriger explicitement la baseline
                name: 'zeroText', // Identifier l'objet texte
                isZeroText: true // Marqueur explicite
            });
            const zeroPointGroup = new fabric.Group([zeroText, topIndicator], {
                left: lineX,
                top: lineY,
                isZeroPoint: true,
                selectable: true,
                hasControls: false,
                name: 'Zero'
            });
            
            // Override complet des méthodes de contrôles pour le point zéro
            zeroPointGroup.hasControls = false;
            zeroPointGroup.hasBorders = true;
            zeroPointGroup.selectable = true;
            zeroPointGroup.evented = true;
            zeroPointGroup.controls = {};
            
            // Override radical : empêcher complètement le dessin des contrôles
            zeroPointGroup.drawControls = function() { return this; };
            zeroPointGroup._renderControls = function() { return this; };
            zeroPointGroup.drawBorders = function(ctx) {
                // Dessiner seulement les bordures, pas les contrôles
                if (!this.hasBorders || !this.isMoving && !this.isActive) return this;
                ctx.save();
                ctx.strokeStyle = this.borderColor;
                ctx.lineWidth = this.borderScaleFactor;
                ctx.setLineDash(this.borderDashArray || []);
                this._setLineDash(ctx, this.borderDashArray);
                ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
                ctx.restore();
                return this;
            };

            canvas.add(baseline, zeroPointGroup);
            
            // Forcer immédiatement après l'ajout au canvas et surveiller constamment
            const forceNoControls = () => {
                console.log('🔧 [BASELINE DEBUG] Tentative de suppression des contrôles...');
                
                if (baseline && baseline.canvas) {
                    console.log('🔧 [BASELINE DEBUG] Baseline trouvée, hasControls avant:', baseline.hasControls);
                    console.log('🔧 [BASELINE DEBUG] Controls avant:', Object.keys(baseline.controls || {}));
                    
                    baseline.hasControls = false;
                    baseline.controls = {};
                    baseline.setControlsVisibility({
                        bl: false, br: false, mb: false, ml: false, mr: false, mt: false, tl: false, tr: false,
                        deleteControl: false
                    });
                    
                    console.log('🔧 [BASELINE DEBUG] Baseline après, hasControls:', baseline.hasControls);
                    console.log('🔧 [BASELINE DEBUG] Controls après:', Object.keys(baseline.controls || {}));
                } else {
                    console.log('❌ [BASELINE DEBUG] Baseline non trouvée ou pas sur canvas');
                }
                
                if (zeroPointGroup && zeroPointGroup.canvas) {
                    console.log('🔧 [ZERO DEBUG] ZeroPoint trouvé, hasControls avant:', zeroPointGroup.hasControls);
                    console.log('🔧 [ZERO DEBUG] Controls avant:', Object.keys(zeroPointGroup.controls || {}));
                    
                    zeroPointGroup.hasControls = false;
                    zeroPointGroup.controls = {};
                    zeroPointGroup.setControlsVisibility({
                        bl: false, br: false, mb: false, ml: false, mr: false, mt: false, tl: false, tr: false,
                        deleteControl: false
                    });
                    
                    console.log('🔧 [ZERO DEBUG] ZeroPoint après, hasControls:', zeroPointGroup.hasControls);
                    console.log('🔧 [ZERO DEBUG] Controls après:', Object.keys(zeroPointGroup.controls || {}));
                } else {
                    console.log('❌ [ZERO DEBUG] ZeroPoint non trouvé ou pas sur canvas');
                }
                
                console.log('🔧 [DEBUG] Forçage des contrôles terminé, rendu du canvas...');
                canvas.renderAll();
            };
            
            // Appliquer immédiatement et à intervalles réguliers
            setTimeout(forceNoControls, 10);
            setTimeout(forceNoControls, 100);
            setTimeout(forceNoControls, 500);
            
            // Surveiller en continu
            const controlWatcher = setInterval(() => {
                forceNoControls();
            }, 1000);
            
            // Arrêter la surveillance après 10 secondes
            setTimeout(() => clearInterval(controlWatcher), 10000);
            
            // Sauvegarder l'état après création de la ligne de base
            this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
            
            this.setMode('select');
            document.dispatchEvent(new CustomEvent('update-all-projections'));
            document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
        }

        handleAutoCalibration(preset) {
            const { realDistanceMeters, scaleDenominator } = preset;
            console.log('📏 [SCALE] Auto-calibration started:', preset);
            
            let pixels;

            if (preset.pixels) {
                // Utiliser la valeur de pixels fournie directement (basée sur la représentation graphique)
                pixels = preset.pixels;
                console.log(`📏 [SCALE] Utilisation des pixels fournis: ${pixels}px pour ${realDistanceMeters}m`);
            } else {
                // Fallback: Calculer les pixels basés sur une résolution standard de 96 DPI
                const pixelsPerCm = 37.7952755906;
                const realDistanceCm = realDistanceMeters * 100;
                const planDistanceCm = realDistanceCm / scaleDenominator;
                pixels = planDistanceCm * pixelsPerCm;
                console.log(`📏 [SCALE] Auto-calc (96 DPI): ${realDistanceMeters}m @ 1:${scaleDenominator} -> ${planDistanceCm}cm on plan -> ${pixels}px`);
            }
            
            // Demander uniquement l'échelle finale
            const finalScaleDenominatorStr = prompt("Quelle sera l'échelle finale de votre plan (ex: 200 pour 1:200) ?", "200");
            const finalScaleDenominator = parseFloat(finalScaleDenominatorStr);
            
            if (isNaN(finalScaleDenominator) || finalScaleDenominator <= 0) {
                alert("Entrée invalide pour l'échelle finale.");
                return;
            }

            // Appliquer la calibration
            this.state.scaleInfo.ratio = pixels / (realDistanceMeters * 100);
            this.state.scaleInfo.userDefinedScaleDenominator = scaleDenominator;
            this.state.scaleInfo.finalScaleDenominator = finalScaleDenominator;

            console.log('📏 [SCALE] Ratio calculé:', this.state.scaleInfo.ratio);

            // Calculer et appliquer le zoom
            const newZoom = scaleDenominator / finalScaleDenominator;
            console.log(`🔍 [SCALE] Application du zoom: ${newZoom} (Base: 1:${scaleDenominator}, Finale: 1:${finalScaleDenominator})`);
            
            document.dispatchEvent(new CustomEvent('apply-zoom', { detail: { zoom: newZoom } }));
            
            // Passer à l'étape suivante : Verrouiller et mettre à jour l'état
            this.state.isZoomLocked = true;
            this.state.setWorkflowState('scale_calibrated');
            
            // Sélectionner automatiquement l'outil déplacer calque/vue
            setTimeout(() => {
                this.setMode('layer-move');
                
                // Si c'est un import de drone, afficher la modale d'alignement avec le bouton de validation
                if (this.state.isDroneImport && this.uiManager) {
                    this.uiManager.showAlignmentGuideModal();
                }
            }, 100);
            
            document.dispatchEvent(new CustomEvent('update-all-projections'));
            document.dispatchEvent(new CustomEvent('update-layers-panel'));
            document.dispatchEvent(new CustomEvent('update-zoom-display'));
            document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
        }

        handleScale(pixels) {
            let realDistanceMeters;

            // Logique manuelle existante
            const realDistanceMetersStr = prompt("Distance réelle en mètres pour cette ligne ?");
            realDistanceMeters = parseFloat(realDistanceMetersStr);
            if (isNaN(realDistanceMeters) || realDistanceMeters <= 0) {
                alert("Entrée invalide pour la distance réelle.");
                this.resetScaleDrawingState();
                return;
            }

            if (this.state.isDroneImport) {
                // LOGIQUE SPÉCIFIQUE DRONE (CALQUE SUPPLÉMENTAIRE)
                // 1. Calculer la résolution de l'image drone actuelle (pixels / mètre)
                const dronePixelsPerMeter = pixels / realDistanceMeters;
                
                // 2. Récupérer la résolution du projet (pixels / mètre)
                // state.scaleInfo.ratio est en pixels/cm, donc on multiplie par 100
                const projectPixelsPerMeter = this.state.scaleInfo.ratio * 100;
                
                if (!projectPixelsPerMeter) {
                    alert("Erreur: L'échelle du projet n'est pas définie. Impossible de calibrer le drone.");
                    return;
                }

                // 3. Calculer le facteur d'échelle nécessaire pour que l'image drone matche le projet
                // Si le drone a 10 px/m et le projet 100 px/m, il faut grossir l'image drone par 10 (100/10)
                const scaleFactor = projectPixelsPerMeter / dronePixelsPerMeter;
                
                console.log(`🚁 [DRONE CALIBRATION]
                    - Distance mesurée: ${realDistanceMeters}m (${pixels}px)
                    - Résolution Drone: ${dronePixelsPerMeter.toFixed(2)} px/m
                    - Résolution Projet: ${projectPixelsPerMeter.toFixed(2)} px/m
                    - Facteur d'échelle à appliquer: ${scaleFactor.toFixed(4)}
                `);

                // 4. Appliquer l'échelle au calque actif (qui est le calque drone)
                const activeLayer = this.state.getActiveLayer();
                if (activeLayer && activeLayer.fabricCanvas) {
                    // On applique le scale factor à l'image de fond du canvas du calque
                    // Note: layerManager.createLayer met l'image en backgroundImage
                    const bgImage = activeLayer.fabricCanvas.backgroundImage;
                    if (bgImage) {
                        // Multiplier l'échelle actuelle par le nouveau facteur
                        // (Important car l'image peut déjà être redimensionnée)
                        const currentScaleX = bgImage.scaleX || 1;
                        const currentScaleY = bgImage.scaleY || 1;
                        
                        bgImage.scaleX = currentScaleX * scaleFactor;
                        bgImage.scaleY = currentScaleY * scaleFactor;
                        
                        // Recentrer l'image si nécessaire ou laisser tel quel
                        activeLayer.fabricCanvas.requestRenderAll();
                        
                        // Mettre à jour la taille du wrapper du calque si nécessaire ?
                        // En général createLayer fixe la taille du canvas à la taille de l'image.
                        // Si on scale l'image, le canvas risque d'être trop petit ou trop grand.
                        // Pour les calques supplémentaires, le canvas a généralement la taille de l'image scalée.
                        // On devrait peut-être redimensionner le canvas du calque.
                        
                        const newWidth = bgImage.width * bgImage.scaleX;
                        const newHeight = bgImage.height * bgImage.scaleY;
                        
                        activeLayer.fabricCanvas.setWidth(newWidth);
                        activeLayer.fabricCanvas.setHeight(newHeight);

                        console.log(`🚁 [DRONE CALIBRATION] Nouvelle taille image: ${newWidth}x${newHeight}`);

                        // ✅ FIX : Marquer le calque drone comme calibré pour activer les poignées
                        activeLayer.droneScaleCalibrated = true;
                        console.log('✅ Calque drone marqué comme calibré - poignées activées');
                        console.log('🔍 [DEBUG] activeLayer.droneScaleCalibrated:', activeLayer.droneScaleCalibrated);
                        console.log('🔍 [DEBUG] activeLayer.name:', activeLayer.name);

                        // ✅ FIX : Déclencher l'affichage des poignées
                        console.log('🔍 [DEBUG] Dispatch événement drone-scale-calibrated');
                        document.dispatchEvent(new CustomEvent('drone-scale-calibrated'));
                        console.log('✅ Événement drone-scale-calibrated dispatché');
                    }
                }

                this.state.isDroneImport = false;
                this.resetScaleDrawingState();
                this.setMode('layer-move'); // Mode déplacement de calque pour pouvoir déplacer/roter la vue drone

                // ✅ FIX : S'assurer que l'UI est correctement mise à jour après le changement de mode
                document.dispatchEvent(new CustomEvent('update-ui-tools-state'));

                alert("Vue drone calibrée ! Vous pouvez maintenant la déplacer et la faire pivoter pour l'aligner avec le plan.");
                return;
            }

            // ... Suite de la logique standard pour le calque de base ...
            const currentRatio = pixels / (realDistanceMeters * 100);
            
            const baseScaleDenominatorStr = prompt("Veuillez entrer l'échelle de base de votre plan (ex: 500 pour 1:500).\nCeci est nécessaire pour le calibrage.", "500");
            const baseScaleDenominator = parseFloat(baseScaleDenominatorStr);
            if (isNaN(baseScaleDenominator) || baseScaleDenominator <= 0) {
                alert("Entrée invalide pour l'échelle de base.");
                this.resetScaleDrawingState();
                return;
            }

            const finalScaleDenominatorStr = prompt("Quelle sera l'échelle finale de votre plan (ex: 200 pour 1:200) ?", "200");
            const finalScaleDenominator = parseFloat(finalScaleDenominatorStr);
            if (isNaN(finalScaleDenominator) || finalScaleDenominator <= 0) {
                alert("Entrée invalide pour l'échelle finale.");
                this.resetScaleDrawingState();
                return;
            }

            // Calculer le ratio fondamental basé sur la ligne tracée
            this.state.scaleInfo.ratio = currentRatio;
            this.state.scaleInfo.userDefinedScaleDenominator = baseScaleDenominator;
            this.state.scaleInfo.finalScaleDenominator = finalScaleDenominator;
            
            this.state.layers.forEach(l => {
                if (l.fabricCanvas.backgroundImage) {
                    l.scaleDenominator = this.state.scaleInfo.userDefinedScaleDenominator;
                }
            });
            
            // Calculer le zoom requis pour atteindre l'échelle finale
            const newZoom = baseScaleDenominator / finalScaleDenominator;
            document.dispatchEvent(new CustomEvent('apply-zoom', { detail: { zoom: newZoom } }));

            // Verrouiller le zoom à cette échelle jusqu'à la création du calque dessin
            this.state.isZoomLocked = true;
            console.log('🔒 [DEBUG] Zoom verrouillé à l\'échelle finale:', finalScaleDenominator);
            
            // Mettre à jour l'interface pour refléter le verrouillage
            document.dispatchEvent(new CustomEvent('update-ui-tools-state'));

            // Mettre à jour l'interface
            this.state.zoomDisplayMode = 'scale';
            this.state.setWorkflowState('scale_calibrated');
            
            // Sélectionner automatiquement l'outil déplacer calque/vue
            setTimeout(() => {
                this.setMode('layer-move');
            }, 100);
            
            document.dispatchEvent(new CustomEvent('update-all-projections'));
            document.dispatchEvent(new CustomEvent('update-layers-panel'));
            document.dispatchEvent(new CustomEvent('update-zoom-display'));
        }

        resetScaleDrawingState() {
            // Réinitialiser l'état du dessin dans le canvas manager
            if (this.canvasManager && this.canvasManager.resetDrawingState) {
                this.canvasManager.resetDrawingState();
            }
            
            // Nettoyer les objets guides temporaires du canvas
            const canvas = this.state.getActiveCanvas();
            if (canvas) {
                const objects = canvas.getObjects().filter(obj => 
                    obj.name === 'guide-line' || 
                    obj.name === 'measure-text' || 
                    obj.isGuide
                );
                objects.forEach(obj => canvas.remove(obj));
                canvas.renderAll();
            }
            
            // Le mode 'scale' est maintenu car finishDrawing() ne le change plus
            console.log('🔄 [DEBUG] État de dessin réinitialisé, mode scale maintenu');
        }

        handleMeasure(start, end, line) {
            if (this.state.scaleInfo.ratio === 0) {
                alert("Veuillez d'abord calibrer l'échelle avec l'outil règle (📏) !");
                if(this.state.getActiveCanvas()) this.state.getActiveCanvas().remove(line);
                return;
            }
            
            const pixels = Math.hypot(end.x - start.x, end.y - start.y);
            const measuredCm = pixels / this.state.scaleInfo.ratio;
            const measuredMeters = measuredCm / 100;
            const uniqueId = 'measure_' + Date.now();

            // Calcul de l'angle pour les flèches
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;

            line.set({
                stroke: 'black',
                strokeDashArray: [5, 5], // Ligne pointillée
                selectable: true,
                evented: true,
                isMeasurement: true,
                measureId: uniqueId
            });

            // Création des flèches
            const arrowSize = 10;
            // Calcul du décalage pour que la pointe soit exactement sur le point
            // Le triangle a son origine au centre. La hauteur est arrowSize.
            // La distance du centre à la pointe est arrowSize / 2
            
            // Pour la flèche de départ (pointe vers l'extérieur = vers start)
            // L'angle est angle - 90. La pointe est en haut du triangle (dans son repère local).
            // On doit décaler le centre du triangle "vers l'intérieur" de la ligne
            const offsetStartX = (arrowSize / 2) * Math.cos(angle * Math.PI / 180);
            const offsetStartY = (arrowSize / 2) * Math.sin(angle * Math.PI / 180);

            const arrowHead1 = new fabric.Triangle({
                left: start.x + offsetStartX,
                top: start.y + offsetStartY,
                originX: 'center',
                originY: 'center',
                width: arrowSize,
                height: arrowSize,
                fill: 'black',
                angle: angle - 90, 
                selectable: true,
                evented: true,
                isMeasurement: true,
                measureId: uniqueId,
                hasControls: false,
                lockMovementX: true,
                lockMovementY: true,
                name: 'measure-arrow-start'
            });

            // Pour la flèche de fin (pointe vers l'extérieur = vers end)
            // On doit décaler le centre du triangle "vers l'intérieur" de la ligne (direction opposée)
            const offsetEndX = -(arrowSize / 2) * Math.cos(angle * Math.PI / 180);
            const offsetEndY = -(arrowSize / 2) * Math.sin(angle * Math.PI / 180);

            const arrowHead2 = new fabric.Triangle({
                left: end.x + offsetEndX,
                top: end.y + offsetEndY,
                originX: 'center',
                originY: 'center',
                width: arrowSize,
                height: arrowSize,
                fill: 'black',
                angle: angle + 90, 
                selectable: true,
                evented: true,
                isMeasurement: true,
                measureId: uniqueId,
                hasControls: false,
                lockMovementX: true,
                lockMovementY: true,
                name: 'measure-arrow-end'
            });

            const text = new fabric.Text(measuredMeters.toFixed(1), {
                left: (start.x + end.x) / 2,
                top: (start.y + end.y) / 2 - 15,
                fontSize: 12,
                fill: 'black',
                backgroundColor: 'rgba(255,255,255,1.0)',
                selectable: true,
                evented: true,
                isMeasurement: true,
                measureId: uniqueId,
                isProjectionElement: true
            });

            const canvas = this.state.getActiveCanvas();
            if (canvas) {
                canvas.add(line, arrowHead1, arrowHead2, text);
                
                // Sauvegarder l'état après création de la mesure
                this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
                
                this.setMode('select');
            }
        }

        // Outils de remplissage
        handleFill(pointer, clickedTarget = null) {
            const canvas = this.state.getActiveCanvas();
            if (!canvas) return;
            
            // Vérifier si on clique sur une zone déjà remplie
            const objectAtPoint = canvas.findTarget(pointer, false);
            if (objectAtPoint && (objectAtPoint.isFilled || (objectAtPoint.type === 'group' && objectAtPoint.isFilled))) {
                // Vérifier si le point cliqué est réellement à l'intérieur de l'objet rempli
                const localPointer = objectAtPoint.toLocalPoint(pointer, 'center', 'center');
                if (objectAtPoint.containsPoint(localPointer)) {
                    alert("Cette zone est déjà remplie. Impossible de remplir une zone déjà remplie.\n\nSi vous voulez modifier une zone déjà remplie, sélectionnez-la et modifiez ses caractéristiques.");
                    return;
                }
            }

            const x = Math.floor(pointer.x);
            const y = Math.floor(pointer.y);
            const width = canvas.width;
            const height = canvas.height;
            
            // Récupérer la tolérance depuis le curseur de l'interface
            const toleranceSlider = document.getElementById('fill-tolerance-slider');
            let tolerance = toleranceSlider ? parseInt(toleranceSlider.value) : 30;

            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = width;
            offscreenCanvas.height = height;
            const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
            
            // Nouvelle approche: modifier les objets puis copier les canvas entiers
            
            let totalObjects = 0;
            const allOriginalProps = [];
            
            // Première passe: modifier tous les objets et sauvegarder leurs propriétés
            this.state.layers.forEach((layer, layerIndex) => {
                if (layer.visible && this.isBackgroundOrDrawingLayer(layer)) {
                    const layerCanvas = layer.fabricCanvas;
                    const objects = layerCanvas.getObjects();
                    const visibleObjects = objects.filter(obj => obj.visible && !obj.isProjectionElement);
                    
                    
                    const layerOriginalProps = [];
                    
                    visibleObjects.forEach((obj, objIndex) => {
                        
                        // Sauvegarder les propriétés originales
                        layerOriginalProps.push({
                            obj: obj,
                            fill: obj.fill,
                            stroke: obj.stroke,
                            strokeWidth: obj.strokeWidth
                        });
                        
                        // Modifier temporairement pour le rendu
                        obj.set({ fill: 'transparent', stroke: 'black', strokeWidth: 1 });
                        totalObjects++;
                    });
                    
                    allOriginalProps.push({
                        layer: layer,
                        props: layerOriginalProps
                    });
                    
                    // Forcer le re-rendu du calque
                    layerCanvas.renderAll();
                    
                }
            });
            
            // Deuxième passe: copier tous les canvas sur le canvas temporaire (ordre inverse pour rendu correct)
            this.state.layers.slice().reverse().forEach((layer, layerIndex) => {
                if (layer.visible && this.isBackgroundOrDrawingLayer(layer)) {
                    const layerCanvas = layer.fabricCanvas;
                    
                    // Appliquer les transformations du calque
                    offscreenCtx.save();
                    offscreenCtx.translate(layer.x || 0, layer.y || 0);
                    if (layer.angle) {
                        offscreenCtx.rotate((layer.angle * Math.PI) / 180);
                    }
                    if (layer.opacity !== undefined && layer.opacity < 1) {
                        offscreenCtx.globalAlpha = layer.opacity;
                    }
                    
                    // Copier le canvas entier
                    try {
                        const canvasElement = layerCanvas.getElement();
                        
                        // S'assurer que le mode de composition est correct
                        offscreenCtx.globalCompositeOperation = 'source-over';
                        offscreenCtx.drawImage(canvasElement, 0, 0);
                    } catch (e) {
                        console.error(`Erreur copie calque ${layerIndex}:`, e);
                    }
                    
                    offscreenCtx.restore();
                }
            });
            
            // Troisième passe: restaurer toutes les propriétés originales
            allOriginalProps.forEach(layerData => {
                layerData.props.forEach(propData => {
                    propData.obj.set({
                        fill: propData.fill,
                        stroke: propData.stroke,
                        strokeWidth: propData.strokeWidth
                    });
                });
                layerData.layer.fabricCanvas.renderAll();
            });
            
            canvas.renderAll();

            const maskColor = { r: 255, g: 0, b: 255, a: 255 };
            
            // Vérifier la couleur au point de clic avant le flood fill
            const preFloodData = offscreenCtx.getImageData(x, y, 1, 1).data;
            
            const filled = this.floodFill(offscreenCtx, x, y, maskColor, tolerance);

            if (!filled) {
                alert("Impossible de remplir cette zone. Assurez-vous de cliquer dans une zone vide et non sur une ligne.\n\nSi c'est le cas, ajustez le curseur de tolérance.");
                return;
            }

            const imageData = offscreenCtx.getImageData(0, 0, width, height);
            
            
            // Désactivé: permet aux bords du calque de fermer les formes
            // const escapeResult = this.checkFillEscape(imageData, maskColor);
            // console.log(`Vérification échappement: ${escapeResult}`);
            // 
            // if (escapeResult) {
            //     alert("La zone de remplissage n'est pas fermée. Le remplissage a été annulé.");
            //     return;
            // }

            const boundaryPoints = this.traceBoundary(offscreenCtx, maskColor);
            if (boundaryPoints.length < 3) {
                console.error("Erreur de traçage de contour.");
                return;
            }

            // Vérifier si seuls les bords du canvas sont détectés
            if (this.isOnlyCanvasEdges(boundaryPoints, width, height)) {
                console.warn("Aucune ligne interne détectée - remplissage annulé.");
                return;
            }

            const simplifiedPoints = this.simplifyPolygonRDP(boundaryPoints, 2.5);
            const pathData = this.createSharpPathFromPoints(simplifiedPoints);

            const fillType = document.querySelector('input[name="fill-type"]:checked').value;
            const colorPicker = document.getElementById('color-picker-fill');
            const selectedColor = colorPicker.value;
            let fillProperty;
            
            const pathProps = {
                strokeWidth: 0,
                selectable: false,  // Empêcher la sélection par défaut
                evented: false,     // Empêcher les événements par défaut
                objectCaching: false,
                isFilled: true  // Marquer tous les objets remplis
            };

            if (fillType === 'stripes') {
                const stripeAngleSlider = document.getElementById('stripe-angle-slider');
                const stripeThicknessSlider = document.getElementById('stripe-thickness-slider');
                const angle = parseInt(stripeAngleSlider.value, 10);
                const thickness = parseInt(stripeThicknessSlider.value, 10);
                fillProperty = this.createStripePattern(selectedColor, angle, thickness);
                pathProps.isStriped = true;
                pathProps.stripeAngle = angle;
                pathProps.stripeColor = selectedColor;
                pathProps.stripeThickness = thickness;
            } else {
                fillProperty = selectedColor;
            }
            
            pathProps.fill = fillProperty;

            const fillShape = new fabric.Path(pathData, pathProps);

            // Identifier les objets de contour qui forment cette zone sur tous les calques visibles
            const contourObjects = [];
            this.state.layers.forEach(layer => {
                if (layer.visible) {
                    const layerContourObjects = layer.fabricCanvas.getObjects().filter(obj => {
                        if (obj.isProjectionElement || !obj.visible) return false;
                        
                        // Vérifier si l'objet contribue au contour de la zone remplie
                        return this.isObjectPartOfContour(obj, boundaryPoints);
                    });
                    contourObjects.push(...layerContourObjects);
                }
            });

            // Utiliser un algorithme simple: tous les objets dans une zone autour du clic
            const currentLayerContourObjects = canvas.getObjects().filter(obj => {
                if (obj.isProjectionElement || !obj.visible || obj.isFilled) return false;
                
                // Définir une zone de sélection autour du point de clic
                const zoneSize = 100; // Zone de 100px autour du clic
                const objBounds = obj.getBoundingRect();
                const clickZone = {
                    left: pointer.x - zoneSize/2,
                    top: pointer.y - zoneSize/2,
                    right: pointer.x + zoneSize/2,
                    bottom: pointer.y + zoneSize/2
                };
                
                // Vérifier si l'objet intersecte avec la zone de clic
                return !(objBounds.left > clickZone.right || 
                        objBounds.left + objBounds.width < clickZone.left ||
                        objBounds.top > clickZone.bottom ||
                        objBounds.top + objBounds.height < clickZone.top);
            });

            // ✅ SAUVEGARDER L'ÉTAT AVANT toute modification du canvas
            // Cela permet à l'undo de restaurer l'état avec tous les contours séparés
            // Sauvegarde manuelle car le remplissage va faire des modifications destructives
            const layer = this.state.layers.find(l => l.fabricCanvas === canvas);
            if (layer && this.layerManager.undoRedoManager) {
                console.log('🎨 [FILL DEBUG] Sauvegarde MANUELLE avant remplissage - objets actuels:', canvas.getObjects().length);
                canvas.getObjects().forEach((obj, i) => {
                    console.log(`  [${i}] ${obj.type} - visible:${obj.visible} - isProjection:${obj.isProjectionElement}`);
                });
                
                // Sauvegarde manuelle directe (bypass de toute logique)
                const state = canvas.toJSON(this.state.fabricPropertiesToInclude);
                const filteredObjects = state.objects.filter(obj => {
                    if (obj.selectable === false && !obj.isBaseline && !obj.isZeroPoint && 
                        !obj.isProjectionElement && !obj.isMeasurement && !obj.isScaleBar && 
                        !obj.isLandmark && !obj.isVehicle) {
                        return false;
                    }
                    return true;
                });
                const cleanState = { ...state, objects: filteredObjects };
                
                // Vérifier si l'état est différent du précédent pour éviter les doublons
                const lastState = layer.undoStack[layer.undoStack.length - 1];
                const isDifferent = !lastState || lastState.objects.length !== cleanState.objects.length;
                
                if (isDifferent) {
                    layer.undoStack.push(cleanState);
                    layer.redoStack = []; // Vider redo
                    console.log('💾 [MANUAL SAVE] Sauvegarde manuelle - pile:', layer.undoStack.length, 'états');
                    document.dispatchEvent(new CustomEvent('update-undo-redo-buttons'));
                } else {
                    console.log('⏭️ [MANUAL SAVE] État identique au précédent, sauvegarde ignorée');
                }
            }

            // Si des objets de contour sont trouvés, les rendre non-sélectionnables et ajouter le remplissage
            if (currentLayerContourObjects.length > 0) {
                console.log('🎨 [FILL DEBUG] Objets de contour trouvés:', currentLayerContourObjects.length);
                currentLayerContourObjects.forEach((obj, i) => {
                    console.log(`  Contour[${i}] ${obj.type} - left:${obj.left} top:${obj.top}`);
                });
                
                // Rendre les objets de contour non-sélectionnables
                currentLayerContourObjects.forEach(obj => {
                    obj.set({
                        selectable: false,
                        evented: false
                    });
                });
                
                // Ajouter seulement le remplissage comme objet sélectionnable
                canvas.add(fillShape);
                
                console.log('🎨 [FILL DEBUG] Ajout du remplissage sélectionnable au canvas');
                
                // Forcer la désélection après ajout
                canvas.discardActiveObject();
                canvas.renderAll();
            } else {
                // Si pas d'objets de contour trouvés sur le calque actuel, ajouter juste le remplissage
                console.log('🎨 [FILL DEBUG] Aucun contour trouvé, ajout du remplissage seul');
                canvas.add(fillShape);
                
                // Forcer la désélection après ajout du remplissage
                canvas.discardActiveObject();
                canvas.renderAll();
                // Ne pas sélectionner automatiquement l'objet de remplissage
            }
            
            console.log('🎨 [FILL DEBUG] Après remplissage - objets finaux:', canvas.getObjects().length);
            canvas.getObjects().forEach((obj, i) => {
                console.log(`  [${i}] ${obj.type} - isFilled:${obj.isFilled} - isGroup:${obj.type === 'group'}`);
            });
            
            canvas.renderAll();
            
            // ✅ SAUVEGARDER L'ÉTAT APRÈS le remplissage pour que le redo fonctionne
            if (layer && this.layerManager.undoRedoManager) {
                const finalState = canvas.toJSON(this.state.fabricPropertiesToInclude);
                const finalFilteredObjects = finalState.objects.filter(obj => {
                    if (obj.selectable === false && !obj.isBaseline && !obj.isZeroPoint && 
                        !obj.isProjectionElement && !obj.isMeasurement && !obj.isScaleBar && 
                        !obj.isLandmark && !obj.isVehicle) {
                        return false;
                    }
                    return true;
                });
                const finalCleanState = { ...finalState, objects: finalFilteredObjects };
                layer.undoStack.push(finalCleanState);
                
                console.log('💾 [MANUAL SAVE] Sauvegarde après remplissage - pile:', layer.undoStack.length, 'états');
                document.dispatchEvent(new CustomEvent('update-undo-redo-buttons'));
            }
            document.dispatchEvent(new CustomEvent('update-layers-panel'));
            this.setMode('select');
        }

        // Fonctions utilitaires pour le remplissage
        isBackgroundOrDrawingLayer(layer) {
            // Ne considérer QUE le calque de fond (Plan rogné) et le calque de dessin
            return layer.name === this.state.DRAWING_LAYER_NAME || 
                   layer.name === 'Calque de dessin' ||
                   layer.name === 'Plan rogné';
        }

        isObjectPartOfContour(obj, boundaryPoints) {
            // Vérifier si l'objet intersecte avec les points de contour
            const objBounds = obj.getBoundingRect();
            const tolerance = 5; // Tolérance en pixels
            
            // Compter combien de points de contour sont proches de l'objet
            let nearPoints = 0;
            for (let i = 0; i < boundaryPoints.length; i += 10) { // Échantillonner pour performance
                const point = boundaryPoints[i];
                
                if (point.x >= objBounds.left - tolerance && 
                    point.x <= objBounds.left + objBounds.width + tolerance &&
                    point.y >= objBounds.top - tolerance && 
                    point.y <= objBounds.top + objBounds.height + tolerance) {
                    nearPoints++;
                    if (nearPoints > 5) return true; // Suffisant pour considérer que l'objet fait partie du contour
                }
            }
            
            return false;
        }

        createStripePattern(color, angleDegrees, thickness) {
            const stripeCanvas = fabric.util.createCanvasElement();
            const ctx = stripeCanvas.getContext('2d');
            const size = 20;
            stripeCanvas.width = stripeCanvas.height = size;

            ctx.strokeStyle = color;
            ctx.lineWidth = thickness;
            ctx.beginPath();
            const offset = thickness / 2;
            ctx.moveTo(-offset, size / 2);
            ctx.lineTo(size + offset, size / 2);
            ctx.stroke();

            const angleRad = fabric.util.degreesToRadians(angleDegrees);
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const transformMatrix = [cos, sin, -sin, cos, 0, 0];

            return new fabric.Pattern({
                source: stripeCanvas,
                repeat: 'repeat',
                patternTransform: transformMatrix
            });
        }

        checkFillEscape(imageData, maskColor) {
            const { width, height, data } = imageData;
            const { r, g, b } = maskColor;

            for (let x = 0; x < width; x++) {
                let topIdx = x * 4;
                let bottomIdx = ((height - 1) * width + x) * 4;
                if ((data[topIdx] === r && data[topIdx + 1] === g && data[topIdx + 2] === b) ||
                    (data[bottomIdx] === r && data[bottomIdx + 1] === g && data[bottomIdx + 2] === b)) {
                    return true;
                }
            }
            for (let y = 0; y < height; y++) {
                let leftIdx = (y * width) * 4;
                let rightIdx = (y * width + (width - 1)) * 4;
                if ((data[leftIdx] === r && data[leftIdx + 1] === g && data[leftIdx + 2] === b) ||
                    (data[rightIdx] === r && data[rightIdx + 1] === g && data[rightIdx + 2] === b)) {
                    return true;
                }
            }
            return false;
        }

        createSharpPathFromPoints(points) {
            if (points.length < 2) {
                return '';
            }
            
            let pathData = `M ${points[0].x} ${points[0].y}`;
            
            for (let i = 1; i < points.length; i++) {
                pathData += ` L ${points[i].x} ${points[i].y}`;
            }
            
            pathData += ' Z';
            return pathData;
        }

        createSmoothPathFromPoints(points, tension = 0.2) {
            if (points.length < 3) {
                return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
            }

            let pathData = `M ${points[0].x} ${points[0].y}`;
            const len = points.length;

            for (let i = 0; i < len; i++) {
                const p0 = points[(i - 1 + len) % len];
                const p1 = points[i];
                const p2 = points[(i + 1) % len];
                const p3 = points[(i + 2) % len];

                const cp1x = p1.x + (p2.x - p0.x) * tension;
                const cp1y = p1.y + (p2.y - p0.y) * tension;

                const cp2x = p2.x - (p3.x - p1.x) * tension;
                const cp2y = p2.y - (p3.y - p1.y) * tension;

                pathData += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
            }
            pathData += ' Z';
            return pathData;
        }

        floodFill(ctx, startX, startY, fillColor, tolerance = 30) {
            const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
            const { width, height, data } = imageData;
            const startIdx = (startY * width + startX) * 4;

            const targetColor = [data[startIdx], data[startIdx + 1], data[startIdx + 2], data[startIdx + 3]];
            
            // Fonction pour vérifier si un pixel est "remplissable" (blanc ou presque blanc)
            const isPixelFillable = (r, g, b, a) => {
                // Accepter les pixels transparents (alpha = 0)
                if (a === 0) return true;
                
                // Accepter les pixels presque blancs (tolérance pour l'antialiasing)
                const threshold = tolerance; // Tolérance dynamique
                return (r >= 255 - threshold && g >= 255 - threshold && b >= 255 - threshold);
            };
            
            // Vérifier si le pixel de départ est remplissable
            if (!isPixelFillable(targetColor[0], targetColor[1], targetColor[2], targetColor[3])) {
                return false;
            }

            const queue = [[startX, startY]];
            
            while (queue.length > 0) {
                const [x, y] = queue.shift();
                if (x < 0 || x >= width || y < 0 || y >= height) continue;

                const idx = (y * width + x) * 4;
                
                // Skip si déjà rempli avec la couleur magenta
                if (data[idx] === fillColor.r && data[idx + 1] === fillColor.g && data[idx + 2] === fillColor.b) continue;

                // Vérifier si le pixel actuel est remplissable
                if (isPixelFillable(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
                    
                    data[idx] = fillColor.r;
                    data[idx + 1] = fillColor.g;
                    data[idx + 2] = fillColor.b;
                    data[idx + 3] = fillColor.a;

                    queue.push([x + 1, y]);
                    queue.push([x - 1, y]);
                    queue.push([x, y + 1]);
                    queue.push([x, y - 1]);
                }
            }
            ctx.putImageData(imageData, 0, 0);
            return true;
        }

        traceBoundary(ctx, maskColor) {
            const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
            const { width, height, data } = imageData;
            let startPoint = null;

            for (let y = 0; y < height && !startPoint; y++) {
                for (let x = 0; x < width && !startPoint; x++) {
                    const idx = (y * width + x) * 4;
                    if (data[idx] === maskColor.r && data[idx + 1] === maskColor.g && data[idx + 2] === maskColor.b) {
                        startPoint = { x, y };
                    }
                }
            }

            if (!startPoint) return [];

            const boundary = [startPoint];
            let currentPoint = startPoint;
            let direction = 0;

            const dx = [1, 1, 0, -1, -1, -1, 0, 1];
            const dy = [0, -1, -1, -1, 0, 1, 1, 1];

            do {
                let foundNext = false;
                for (let i = 0; i < 8; i++) {
                    const lookDir = (direction + 6 + i) % 8;
                    const nextX = currentPoint.x + dx[lookDir];
                    const nextY = currentPoint.y + dy[lookDir];

                    if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
                        const idx = (nextY * width + nextX) * 4;
                        if (data[idx] === maskColor.r) {
                            currentPoint = { x: nextX, y: nextY };
                            direction = lookDir;
                            if(currentPoint.x !== boundary[boundary.length - 1].x || currentPoint.y !== boundary[boundary.length - 1].y) {
                                boundary.push(currentPoint);
                            }
                            foundNext = true;
                            break;
                        }
                    }
                }
                if (!foundNext) break;
            } while (currentPoint.x !== startPoint.x || currentPoint.y !== startPoint.y);
            
            return boundary;
        }

        isOnlyCanvasEdges(boundary, canvasWidth, canvasHeight) {
            if (boundary.length < 4) return false;
            
            // Marges de tolérance pour les bords du canvas (en pixels)
            const edgeTolerance = 3;
            
            // Vérifier si tous les points du contour sont proches des 4 bords du canvas
            const pointsOnEdges = {
                top: 0, bottom: 0, left: 0, right: 0
            };
            
            let pointsOnAnyEdge = 0;
            
            boundary.forEach(point => {
                let onEdge = false;
                if (point.y <= edgeTolerance) {
                    pointsOnEdges.top++;
                    onEdge = true;
                }
                if (point.y >= canvasHeight - edgeTolerance) {
                    pointsOnEdges.bottom++;
                    onEdge = true;
                }
                if (point.x <= edgeTolerance) {
                    pointsOnEdges.left++;
                    onEdge = true;
                }
                if (point.x >= canvasWidth - edgeTolerance) {
                    pointsOnEdges.right++;
                    onEdge = true;
                }
                if (onEdge) pointsOnAnyEdge++;
            });
            
            // Considérer que c'est un contour de canvas si :
            // 1. Au moins 75% des points sont sur les bords
            // 2. Et qu'il y a des points sur au moins 3 côtés (cas d'une forme proche des bords)
            const percentageOnEdges = pointsOnAnyEdge / boundary.length;
            const edgeCount = (pointsOnEdges.top > 0 ? 1 : 0) + (pointsOnEdges.bottom > 0 ? 1 : 0) + 
                             (pointsOnEdges.left > 0 ? 1 : 0) + (pointsOnEdges.right > 0 ? 1 : 0);
            
            return percentageOnEdges > 0.75 && edgeCount >= 3;
        }

        simplifyPolygonRDP(points, epsilon) {
            const d2 = (p1, p2) => (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
            const d_line_p = (l1, l2, p) => {
                const l2_d2 = d2(l1, l2);
                if (l2_d2 === 0) return d2(p, l1);
                let t = ((p.x - l1.x) * (l2.x - l1.x) + (p.y - l1.y) * (l2.y - l1.y)) / l2_d2;
                t = Math.max(0, Math.min(1, t));
                return d2(p, {x: l1.x + t * (l2.x - l1.x), y: l1.y + t * (l2.y - l1.y)});
            };
            let max_d2 = 0;
            let idx = 0;
            const last = points.length - 1;
            for (let i = 1; i < last; i++) {
                const d = d_line_p(points[0], points[last], points[i]);
                if (d > max_d2) {
                    idx = i;
                    max_d2 = d;
                }
            }
            if (max_d2 > epsilon**2) {
                const res1 = this.simplifyPolygonRDP(points.slice(0, idx + 1), epsilon);
                const res2 = this.simplifyPolygonRDP(points.slice(idx), epsilon);
                return res1.slice(0, -1).concat(res2);
            } else {
                return [points[0], points[last]];
            }
        }

        // Outils d'ajout d'objets
        addSignToCanvas(dataUrl, signName) {
            const canvas = this.state.getActiveCanvas();
            if (!canvas) { 
                alert("Veuillez d'abord sélectionner un calque."); 
                return; 
            }
            
            fabric.loadSVGFromURL(dataUrl, (objects, options) => {
                if (!objects || objects.length === 0) {
                    console.error("Fabric.js n'a pas pu parser le SVG depuis la Data URL:", signName);
                    alert(`Erreur lors de l'interprétation du panneau : ${signName}. La Data URL est peut-être invalide.`);
                    return;
                }
                const signGroup = fabric.util.groupSVGElements(objects, options);
                signGroup.scaleToWidth(80);
                signGroup.set({
                    left: canvas.getCenter().left,
                    top: canvas.getCenter().top,
                    originX: 'center',
                    originY: 'center'
                });
                canvas.add(signGroup).setActiveObject(signGroup).renderAll();
                this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
                document.dispatchEvent(new CustomEvent('update-layers-panel'));
                this.setMode('select');
            });
        }

        addCustomImageToCanvas(dataUrl) {
            const canvas = this.state.getActiveCanvas();
            if (!canvas) { 
                alert("Veuillez d'abord sélectionner un calque."); 
                return; 
            }
            
            fabric.Image.fromURL(dataUrl, (img) => {
                img.scaleToWidth(80);
                img.set({
                    left: canvas.getCenter().left,
                    top: canvas.getCenter().top,
                    originX: 'center',
                    originY: 'center'
                });
                canvas.add(img).setActiveObject(img).renderAll();
                this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
                document.dispatchEvent(new CustomEvent('update-layers-panel'));
                this.setMode('select');
            });
        }

        addCarToCanvas(widthM, lengthM, letter, color = '#000000', thickness = 2, dashed = false) {
            console.log('🚗 DEBUT addCarToCanvas - widthM:', widthM, 'lengthM:', lengthM, 'letter:', letter, 'color:', color, 'thickness:', thickness, 'dashed:', dashed);
            const canvas = this.state.getActiveCanvas();
            if(!canvas) {
                console.log('❌ Pas de canvas actif dans addCarToCanvas');
                return;
            }
            console.log('✅ Canvas actif trouvé:', canvas.id || 'canvas principal');

            // CORRECTION: Soustraire l'épaisseur du trait pour que la dimension VISUELLE (trait inclus) soit exacte
            const widthPx = (widthM * 100 * this.state.scaleInfo.ratio) - thickness;
            const lengthPx = (lengthM * 100 * this.state.scaleInfo.ratio) - thickness;

            const commonProps = {
                stroke: color,
                strokeWidth: thickness,
                originX: 'left',
                originY: 'top',
                ...(dashed ? { strokeDashArray: [10, 5] } : {})
            };
            const vehicleId = 'vehicle_' + Date.now();

            const vehicleBody = new fabric.Rect({ width: lengthPx, height: widthPx, fill: 'rgba(255,255,255,1.0)', ...commonProps });
            const windshield = new fabric.Line([lengthPx * (2/3), 0, lengthPx * (2/3), widthPx], commonProps);
            const frontLeft = new fabric.Line([lengthPx * (2/3), 0, lengthPx, widthPx/2], commonProps);
            const frontRight = new fabric.Line([lengthPx * (2/3), widthPx, lengthPx, widthPx/2], commonProps);
            
            const letterText = new fabric.Text(letter, {
                fontSize: widthPx * 0.5,
                fill: color,
                backgroundColor: 'rgba(255,255,255,1.0)',
                left: lengthPx * 0.15,
                top: widthPx / 2,
                originX: 'center',
                originY: 'center'
            });

            // Calculer la position selon les spécifications
            const position = this.calculateVehiclePosition(canvas);
            
            const car = new fabric.Group([vehicleBody, windshield, frontLeft, frontRight, letterText], {
                left: position.x,
                top: position.y,
                angle: position.angle,
                isVehicle: true,
                originalColor: color,
                id: vehicleId,
                suppressedCorners: []
            });
            
            console.log('🚗 Ajout du véhicule au canvas...');
            canvas.add(car).setActiveObject(car);
            console.log('✅ Véhicule ajouté au canvas');
            
            console.log('🚗 Sauvegarde état pour undo/redo...');
            this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
            
            
            console.log('🚗 Dispatch des événements...');
            document.dispatchEvent(new CustomEvent('update-all-projections'));
            document.dispatchEvent(new CustomEvent('update-layers-panel'));
            
            console.log('🚗 Retour en mode select...');
            this.setMode('select');
            
            console.log('✅ addCarToCanvas TERMINÉ avec succès');
        }

        calculateVehiclePosition(canvas) {
            // Trouver la ligne de base
            let baseline = null;
            this.state.layers.forEach(layer => {
                if (layer.visible) {
                    const objects = layer.fabricCanvas.getObjects();
                    const found = objects.find(obj => obj.isBaseline);
                    if (found) baseline = found;
                }
            });

            if (!baseline) {
                // Fallback : centre du canvas si pas de ligne de base
                return {
                    x: canvas.getCenter().left,
                    y: canvas.getCenter().top,
                    angle: -90
                };
            }

            // Calculer le vrai milieu de la ligne de base sur le canvas
            const baselineCenter = {
                x: baseline.left + (baseline.x2 - baseline.x1) / 2,
                y: baseline.top + (baseline.y2 - baseline.y1) / 2
            };

            // Calculer l'angle de la ligne de base (en radians)
            const baselineAngle = Math.atan2(baseline.y2 - baseline.y1, baseline.x2 - baseline.x1);
            
            // Angle perpendiculaire à la ligne de base (pour aller "au-dessus")
            const perpAngle = baselineAngle - Math.PI / 2;
            
            // Distance de 5 mètres en pixels
            const distance5m = 5 * 100 * this.state.scaleInfo.ratio;
            
            // Trouver la position du dernier véhicule ajouté
            let lastVehiclePosition = null;
            let maxTimestamp = 0;
            
            this.state.layers.forEach(layer => {
                if (layer.visible) {
                    const objects = layer.fabricCanvas.getObjects();
                    objects.filter(obj => obj.isVehicle).forEach(vehicle => {
                        const timestamp = parseInt(vehicle.id.replace('vehicle_', ''));
                        if (timestamp > maxTimestamp) {
                            maxTimestamp = timestamp;
                            lastVehiclePosition = { x: vehicle.left, y: vehicle.top };
                        }
                    });
                }
            });

            let vehicleX, vehicleY;

            if (lastVehiclePosition) {
                // Placer le nouveau véhicule 6m à droite du dernier
                const distance3m = 6 * 100 * this.state.scaleInfo.ratio;
                vehicleX = lastVehiclePosition.x + distance3m;
                vehicleY = lastVehiclePosition.y;
            } else {
                // Premier véhicule : 5m au-dessus du milieu de la ligne de base
                vehicleX = baselineCenter.x + Math.cos(perpAngle) * distance5m;
                vehicleY = baselineCenter.y + Math.sin(perpAngle) * distance5m;
            }

            // Angle du véhicule : avant pointant 45° vers la droite depuis le haut
            const vehicleAngle = -45;

            return {
                x: vehicleX,
                y: vehicleY,
                angle: vehicleAngle
            };
        }

        // Nettoyer les anciens styles inline d'un bouton
        clearInlineStyles(button) {
            if (button) {
                button.style.cssText = '';
                button.removeAttribute('style');
                console.log('🧹 [PROJECT TOOLS] Styles inline nettoyés pour', button.id);
            }
        }

        // FORCER les propriétés anti-curseur directement sur les boutons
        forceButtonProperties() {
            const buttons = [
                document.getElementById('btn-save-project'),
                document.getElementById('btn-load-project'),
                document.getElementById('btn-new-project')
            ];
            
            buttons.forEach(button => {
                if (button) {
                    // Forcer les propriétés directement via JavaScript
                    button.style.setProperty('cursor', 'pointer', 'important');
                    button.style.setProperty('pointer-events', 'auto', 'important');
                    button.style.setProperty('z-index', '10001', 'important');
                    button.style.setProperty('position', 'relative', 'important');
                    
                    // Supprimer toutes les classes de curseur personnalisé
                    button.classList.remove('layer-move-cursor', 'scale-cursor', 'draw-cursor', 'select-cursor');
                    
                    console.log(`🛡️ [PROJECT TOOLS] Propriétés anti-curseur forcées sur ${button.id}`);
                }
            });
        }

        // SOLUTION ULTIME : Injecter du CSS directement dans le document (FORCE REFRESH)
        injectProjectButtonsCSS() {
            // FORCER la suppression et réinjection pour corriger les problèmes de curseur
            const existingStyle = document.getElementById('project-buttons-ultimate-style');
            if (existingStyle) {
                existingStyle.remove();
                console.log('💉 [PROJECT TOOLS] CSS existant supprimé, réinjection forcée');
            }

            // Créer un nouveau style element avec une spécificité maximale
            const style = document.createElement('style');
            style.id = 'project-buttons-ultimate-style';
            style.innerHTML = `
                /* SOLUTION ULTIME - Spécificité maximale pour les boutons projet */
                #btn-save-project.project-btn-active,
                #btn-load-project.project-btn-active,
                #btn-new-project.project-btn-active,
                #project-tools .project-btn-active {
                    background: #3c3c3c !important;
                    border: 1px solid #555 !important;
                    color: #eee !important;
                    cursor: pointer !important;
                    opacity: 1 !important;
                    padding: 5px 10px !important;
                    border-radius: 4px !important;
                    font-size: 14px !important;
                    transition: background-color 0.2s ease !important;
                }

                #btn-save-project.project-btn-active:hover,
                #btn-load-project.project-btn-active:hover,
                #btn-new-project.project-btn-active:hover,
                #project-tools .project-btn-active:hover {
                    background: #4a4a4a !important;
                    border-color: #666 !important;
                }

                #btn-save-project.project-btn-disabled,
                #project-tools .project-btn-disabled {
                    background: #2a2a2a !important;
                    border: 1px solid #333 !important;
                    color: #666 !important;
                    cursor: not-allowed !important;
                    opacity: 0.6 !important;
                    padding: 5px 10px !important;
                    border-radius: 4px !important;
                    font-size: 14px !important;
                }

                /* Force la visibilité des boutons projet */
                #project-tools {
                    display: flex !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    position: relative !important;
                    z-index: 9999 !important;
                    order: 1 !important;
                    margin-left: 0 !important;
                    margin-right: auto !important;
                }

                #project-tools button {
                    display: inline-block !important;
                    visibility: visible !important;
                    pointer-events: auto !important;
                    cursor: pointer !important;
                    position: relative !important;
                    z-index: 10000 !important;
                }

                /* FORCER les boutons projet à ignorer les curseurs personnalisés */
                #btn-save-project,
                #btn-load-project, 
                #btn-new-project {
                    cursor: pointer !important;
                    pointer-events: auto !important;
                    z-index: 10001 !important;
                    position: relative !important;
                }

                /* Supprimer TOUS les curseurs personnalisés sur les boutons projet */
                #btn-save-project *,
                #btn-load-project *,
                #btn-new-project * {
                    cursor: inherit !important;
                    pointer-events: none !important;
                }

                /* Force le titre Projet en blanc - RÈGLE FINALE POUR PRIORITÉ MAXIMALE */
                html body header.toolbar div.permanent-tools#project-tools > strong,
                html body .toolbar .tool-group > strong,
                #project-tools > strong,
                .toolbar .tool-group strong {
                    color: #ffffff !important;
                }
            `;

            // Injecter dans le head pour une priorité maximale
            document.head.appendChild(style);
            console.log('💉 [PROJECT TOOLS] CSS ultime injecté dans le document');

            // Forcer une recalculation du style en modifiant temporairement la display
            const projectTools = document.getElementById('project-tools');
            if (projectTools) {
                const originalDisplay = projectTools.style.display;
                projectTools.style.display = 'none';
                projectTools.offsetHeight; // Force reflow
                projectTools.style.display = originalDisplay || 'flex';
                console.log('🔄 [PROJECT TOOLS] Recalculation forcée du style');
            }
        }

        // Test rapide des événements (DÉSACTIVÉ)
        addTestEventListeners() {
            // Méthode désactivée pour éviter les doubles activations
            console.log('🧪 [PROJECT TOOLS] Event listeners de test désactivés');
        }

        // Attacher les événements des boutons projet (UNE SEULE FOIS)
        attachProjectEventsOnce() {
            // Vérifier si les événements sont déjà attachés
            if (this.projectEventsAttached) {
                console.log('🔗 [PROJECT TOOLS] Événements déjà attachés, ignorer');
                return;
            }
            
            console.log('🔗 [PROJECT TOOLS] Attachement INITIAL des événements projet');
            
            const saveButton = document.getElementById('btn-save-project');
            const loadButton = document.getElementById('btn-load-project');
            const newButton = document.getElementById('btn-new-project');
            
            // NETTOYER COMPLÈTEMENT les anciens événements (au cas où)
            if (saveButton) {
                saveButton.onclick = null;
                saveButton.onmousedown = null;
                saveButton.onmouseup = null;
                
                // Utiliser onclick UNIQUEMENT
                saveButton.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('💾 [PROJECT CLICK] SAVE clicked!');
                    
                    if (!saveButton.disabled && !saveButton.hasAttribute('disabled')) {
                        const projectManager = window.PlanEditor.instances.projectManager;
                        if (projectManager) {
                            projectManager.saveProject();
                        }
                    }
                };
                console.log('🔗 [PROJECT TOOLS] SAVE événement attaché');
            }
            
            if (loadButton) {
                loadButton.onclick = null;
                loadButton.onmousedown = null;
                loadButton.onmouseup = null;
                
                loadButton.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('📁 [PROJECT CLICK] LOAD clicked!');
                    
                    const projectManager = window.PlanEditor.instances.projectManager;
                    if (projectManager) {
                        projectManager.loadProject();
                    }
                };
                console.log('🔗 [PROJECT TOOLS] LOAD événement attaché');
            }
            
            if (newButton) {
                newButton.onclick = null;
                newButton.onmousedown = null;
                newButton.onmouseup = null;
                
                newButton.onclick = async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('📄 [PROJECT CLICK] NEW clicked!');
                    
                    const toolsManager = window.PlanEditor.instances.toolsManager;
                    const result = await toolsManager.showThreeButtonDialog(
                        'Nouveau projet',
                        'Créer un nouveau projet supprimera le travail actuel.\n\nVoulez-vous sauvegarder le projet actuel avant de continuer ?'
                    );
                    
                    if (result === 'yes') {
                        // Oui - Sauvegarder puis créer nouveau projet
                        const projectManager = window.PlanEditor.instances.projectManager;
                        const eventManager = window.PlanEditor.instances.eventManager;
                        if (projectManager && eventManager) {
                            // Marquer immédiatement le début du processus et désactiver le bouton
                            eventManager.state.isLoadingState = true;
                            eventManager.state.isCreatingNewProject = true;
                            const startDrawingBtn = document.getElementById('start-drawing-btn');
                            if (startDrawingBtn) {
                                startDrawingBtn.disabled = true;
                                startDrawingBtn.style.display = 'none';
                            }
                            projectManager.saveProject().then(() => {
                                eventManager.createNewProject();
                            });
                        }
                    } else if (result === 'no') {
                        // Non - Créer nouveau projet sans sauvegarder
                        const eventManager = window.PlanEditor.instances.eventManager;
                        if (eventManager) {
                            // Marquer immédiatement le début du processus et désactiver le bouton
                            eventManager.state.isLoadingState = true;
                            eventManager.state.isCreatingNewProject = true;
                            const startDrawingBtn = document.getElementById('start-drawing-btn');
                            if (startDrawingBtn) {
                                startDrawingBtn.disabled = true;
                                startDrawingBtn.style.display = 'none';
                            }
                            eventManager.createNewProject();
                        }
                    }
                    // Si result === 'cancel', on ne fait rien (annulation)
                };
                console.log('🔗 [PROJECT TOOLS] NEW événement attaché');
            }
            
            // Marquer les événements comme attachés
            this.projectEventsAttached = true;
            console.log('✅ [PROJECT TOOLS] Événements projet attachés avec succès');
        }

        // Test DIRECT de clic sur les boutons (DÉSACTIVÉ)
        testDirectClick() {
            // Tests désactivés pour éviter les doubles activations
            console.log('🧪 [DIRECT TEST] Tests directs désactivés');
        }

        // DIAGNOSTIC: Méthode de diagnostic (désactivée pour éviter les doublons)
        addMultipleEventListeners() {
            // Méthode désactivée pour éviter les doubles exécutions
            console.log('🔍 [DIAGNOSTIC] Listeners de diagnostic désactivés');
        }

        // Afficher une boîte de dialogue personnalisée avec trois options
        showThreeButtonDialog(title, message, yesText = 'Oui', noText = 'Non', cancelText = 'Annuler') {
            return new Promise((resolve) => {
                // Créer la structure HTML de la modale
                const modal = document.createElement('div');
                modal.className = 'custom-dialog-modal';
                modal.innerHTML = `
                    <div class="custom-dialog-content">
                        <h3>${title}</h3>
                        <p>${message}</p>
                        <div class="custom-dialog-buttons">
                            <button class="custom-dialog-btn custom-dialog-yes">${yesText}</button>
                            <button class="custom-dialog-btn custom-dialog-no">${noText}</button>
                            <button class="custom-dialog-btn custom-dialog-cancel">${cancelText}</button>
                        </div>
                    </div>
                `;
                
                // Ajouter les styles CSS directement
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                `;
                
                const content = modal.querySelector('.custom-dialog-content');
                content.style.cssText = `
                    background: #2d2d30;
                    color: #cccccc;
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                    max-width: 500px;
                    text-align: center;
                `;
                
                const buttons = modal.querySelector('.custom-dialog-buttons');
                buttons.style.cssText = `
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    margin-top: 25px;
                `;
                
                modal.querySelectorAll('.custom-dialog-btn').forEach(btn => {
                    btn.style.cssText = `
                        padding: 10px 20px;
                        border: 1px solid #555;
                        background: #3c3c3c;
                        color: #eee;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        min-width: 80px;
                    `;
                    
                    btn.addEventListener('mouseenter', () => {
                        btn.style.backgroundColor = '#4a4a4a';
                    });
                    
                    btn.addEventListener('mouseleave', () => {
                        btn.style.backgroundColor = '#3c3c3c';
                    });
                });
                
                // Gestion des clics
                modal.querySelector('.custom-dialog-yes').addEventListener('click', () => {
                    document.body.removeChild(modal);
                    resolve('yes');
                });
                
                modal.querySelector('.custom-dialog-no').addEventListener('click', () => {
                    document.body.removeChild(modal);
                    resolve('no');
                });
                
                modal.querySelector('.custom-dialog-cancel').addEventListener('click', () => {
                    document.body.removeChild(modal);
                    resolve('cancel');
                });
                
                // Fermer avec Escape
                const handleEscape = (e) => {
                    if (e.key === 'Escape') {
                        document.body.removeChild(modal);
                        document.removeEventListener('keydown', handleEscape);
                        resolve('cancel');
                    }
                };
                document.addEventListener('keydown', handleEscape);
                
                // Ajouter au DOM
                document.body.appendChild(modal);
            });
        }

        // Test pour vérifier si les événements fonctionnent
        testProjectButtonsEvents() {
            console.log('🧪 [PROJECT TOOLS] Test des événements des boutons projet');
            
            const saveButton = document.getElementById('btn-save-project');
            const loadButton = document.getElementById('btn-load-project');  
            const newButton = document.getElementById('btn-new-project');
            
            // Test bouton charger
            if (loadButton) {
                console.log('🔍 [TEST] Bouton charger:', {
                    id: loadButton.id,
                    disabled: loadButton.disabled,
                    hasDisabledAttr: loadButton.hasAttribute('disabled'),
                    className: loadButton.className,
                    style: loadButton.style.cssText,
                    onclick: !!loadButton.onclick,
                    tagName: loadButton.tagName,
                    type: loadButton.type,
                    offsetWidth: loadButton.offsetWidth,
                    offsetHeight: loadButton.offsetHeight,
                    computedStyle: window.getComputedStyle(loadButton).pointerEvents
                });
                
                // Test si on peut ajouter un event listener simple
                try {
                    const testListener = () => console.log('🧪 [TEST] Event listener test fonctionne!');
                    loadButton.addEventListener('click', testListener);
                    console.log('🧪 [TEST] Event listener ajouté avec succès');
                } catch (error) {
                    console.error('🧪 [TEST] Erreur ajout event listener:', error);
                }
            }
            
            // Test bouton nouveau
            if (newButton) {
                console.log('🔍 [TEST] Bouton nouveau:', {
                    id: newButton.id,
                    disabled: newButton.disabled,
                    hasDisabledAttr: newButton.hasAttribute('disabled'), 
                    className: newButton.className,
                    style: newButton.style.cssText,
                    onclick: !!newButton.onclick,
                    tagName: newButton.tagName,
                    type: newButton.type,
                    offsetWidth: newButton.offsetWidth,
                    offsetHeight: newButton.offsetHeight,
                    computedStyle: window.getComputedStyle(newButton).pointerEvents
                });
            }
            
            // Test bouton sauvegarder
            if (saveButton) {
                console.log('🔍 [TEST] Bouton sauvegarder:', {
                    id: saveButton.id,
                    disabled: saveButton.disabled,
                    hasDisabledAttr: saveButton.hasAttribute('disabled'),
                    className: saveButton.className,
                    style: saveButton.style.cssText,
                    onclick: !!saveButton.onclick,
                    tagName: saveButton.tagName,
                    type: saveButton.type,
                    offsetWidth: saveButton.offsetWidth,
                    offsetHeight: saveButton.offsetHeight,
                    computedStyle: window.getComputedStyle(saveButton).pointerEvents
                });
            }
            
            // Test des instances globales
            console.log('🔍 [TEST] Instances globales:', {
                PlanEditor: !!window.PlanEditor,
                instances: !!window.PlanEditor?.instances,
                projectManager: !!window.PlanEditor?.instances?.projectManager
            });
        }

        // Mettre à jour l'état des outils de projet
        updateProjectToolsState() {
            const saveButton = document.getElementById('btn-save-project');
            const loadButton = document.getElementById('btn-load-project');
            const newButton = document.getElementById('btn-new-project');
            
            if (saveButton && loadButton && newButton) {
                // Le bouton de sauvegarde est disponible dès qu'il y a un calque de dessin
                const hasDrawingLayer = this.state.layers.some(layer => 
                    layer.name === this.state.DRAWING_LAYER_NAME || 
                    layer.name === 'Calque de dessin' ||
                    (!layer.backgroundImage && layer.fabricCanvas) // Calque sans image de fond = calque de dessin
                );
                
                // Seulement si l'état a changé
                const currentState = `${hasDrawingLayer}`;
                if (this.lastProjectToolsState !== currentState) {
                    console.log('🔧 [PROJECT TOOLS] Mise à jour état des outils de projet');
                    console.log('🔍 [PROJECT TOOLS] Calques disponibles:', this.state.layers.map(l => l.name));
                    console.log('🔍 [PROJECT TOOLS] Calque de dessin trouvé:', hasDrawingLayer);
                    
                    // SOLUTION ULTIME : Injecter du CSS directement dans le document (une seule fois)
                    this.injectProjectButtonsCSS();
                    
                    // Nettoyer les anciens styles inline pour éviter les conflits
                    this.clearInlineStyles(saveButton);
                    this.clearInlineStyles(loadButton);
                    this.clearInlineStyles(newButton);
                    
                    this.lastProjectToolsState = currentState;
                    
                    // NE PAS réattacher les événements à chaque changement !
                    // this.reattachProjectEvents(); // SUPPRIMÉ
                    
                    // FORCER les propriétés anti-curseur sur les boutons
                    this.forceButtonProperties();
                }
                
                // Mise à jour simple des états (sans log si pas de changement)
                // Bouton de chargement - toujours actif
                loadButton.disabled = false;
                loadButton.removeAttribute('disabled');
                loadButton.className = 'project-btn-active';
                
                // Bouton nouveau - toujours actif
                newButton.disabled = false;
                newButton.removeAttribute('disabled');
                newButton.className = 'project-btn-active';
                
                // Bouton sauvegarde - selon les calques
                if (hasDrawingLayer) {
                    saveButton.disabled = false;
                    saveButton.removeAttribute('disabled');
                    saveButton.className = 'project-btn-active';
                } else {
                    saveButton.disabled = true;
                    saveButton.setAttribute('disabled', 'true');
                    saveButton.className = 'project-btn-disabled';
                }
                
            } else {
                console.error('❌ [PROJECT TOOLS] Boutons non trouvés:', {
                    saveButton: !!saveButton,
                    loadButton: !!loadButton,
                    newButton: !!newButton
                });
            }
        }

        // Fonction qui force périodiquement la mise à jour des styles
        startProjectToolsWatcher() {
            console.log('👀 [PROJECT TOOLS] Démarrage du surveillant des styles');
            
            // Fonction qui force les styles
            const forceStyles = () => {
                this.updateProjectToolsState();
            };
            
            // Première exécution immédiate
            forceStyles();
            
            // Attacher les événements au démarrage (une seule fois)
            setTimeout(() => {
                this.attachProjectEventsOnce();
                console.log('🔗 [PROJECT TOOLS] Événements projet initialisés');
            }, 1000);
            
            // Puis toutes les 10 secondes pour s'assurer que les styles restent corrects (moins fréquent)
            const watcherInterval = setInterval(forceStyles, 10000);
            
            // Sauvegarder l'interval pour pouvoir l'arrêter si nécessaire
            this.projectToolsWatcher = watcherInterval;
            
            return watcherInterval;
        }

        // Arrêter le surveillant
        stopProjectToolsWatcher() {
            if (this.projectToolsWatcher) {
                clearInterval(this.projectToolsWatcher);
                this.projectToolsWatcher = null;
                console.log('🛑 [PROJECT TOOLS] Surveillant des styles arrêté');
            }
        }

        // Fonction de diagnostic complète
        diagnoseProjectButtons() {
            console.log('🔍 [DIAGNOSTIC] === DÉBUT DIAGNOSTIC BOUTONS PROJET ===');
            
            const saveButton = document.getElementById('btn-save-project');
            const loadButton = document.getElementById('btn-load-project');
            const newButton = document.getElementById('btn-new-project');
            
            console.log('🔍 [DIAGNOSTIC] Éléments trouvés:', {
                saveButton: !!saveButton,
                loadButton: !!loadButton,
                newButton: !!newButton
            });
            
            [
                { name: 'SAVE', btn: saveButton },
                { name: 'LOAD', btn: loadButton },
                { name: 'NEW', btn: newButton }
            ].forEach(({ name, btn }) => {
                if (btn) {
                    console.log(`🔍 [DIAGNOSTIC] ${name} Button:`);
                    console.log('  - disabled:', btn.disabled);
                    console.log('  - style.color:', btn.style.color);
                    console.log('  - style.background:', btn.style.background);
                    console.log('  - style.opacity:', btn.style.opacity);
                    console.log('  - computed color:', window.getComputedStyle(btn).color);
                    console.log('  - computed background:', window.getComputedStyle(btn).backgroundColor);
                    console.log('  - computed opacity:', window.getComputedStyle(btn).opacity);
                    console.log('  - classList:', Array.from(btn.classList));
                    console.log('  - HTML:', btn.outerHTML);
                } else {
                    console.error(`❌ [DIAGNOSTIC] ${name} Button non trouvé!`);
                }
            });
            
            console.log('🔍 [DIAGNOSTIC] === FIN DIAGNOSTIC ===');
        }

        // Test manuel ultra-simple
        testProjectButtonsManual() {
            console.log('🧪 [TEST MANUEL] Démarrage test ultra-simple...');
            
            // Test 1: Trouver les boutons
            const buttons = {
                save: document.getElementById('btn-save-project'),
                load: document.getElementById('btn-load-project'),
                new: document.getElementById('btn-new-project')
            };
            
            console.log('🧪 [TEST MANUEL] Boutons trouvés:', Object.keys(buttons).filter(key => buttons[key]));
            
            // Test 2: Forcer couleur rouge pour voir si ça marche
            Object.entries(buttons).forEach(([name, btn]) => {
                if (btn) {
                    console.log(`🧪 [TEST MANUEL] Test couleur ROUGE sur ${name}...`);
                    btn.style.setProperty('color', 'red', 'important');
                    btn.style.setProperty('background-color', 'yellow', 'important');
                    btn.style.setProperty('border', '2px solid blue', 'important');
                    
                    setTimeout(() => {
                        console.log(`🧪 [TEST MANUEL] Couleur après 1s sur ${name}:`, window.getComputedStyle(btn).color);
                    }, 1000);
                }
            });
            
            // Test 3: Après 3 secondes, appliquer les vrais styles
            setTimeout(() => {
                console.log('🧪 [TEST MANUEL] Application des vrais styles...');
                Object.entries(buttons).forEach(([name, btn]) => {
                    if (btn) {
                        btn.disabled = false;
                        btn.style.setProperty('color', '#eee', 'important');
                        btn.style.setProperty('background-color', '#3c3c3c', 'important');
                        btn.style.setProperty('border', '1px solid #555', 'important');
                        btn.style.setProperty('opacity', '1', 'important');
                        btn.style.setProperty('cursor', 'pointer', 'important');
                    }
                });
            }, 3000);
        }

    }

    // Exposer dans le namespace global
    window.PlanEditor.ToolsManager = ToolsManager;
    
    // Exposer les fonctions de test globalement pour debug
    window.diagnoseProjectButtons = function() {
        const toolsManager = window.PlanEditor.instances?.toolsManager;
        if (toolsManager && toolsManager.diagnoseProjectButtons) {
            toolsManager.diagnoseProjectButtons();
        } else {
            console.error('❌ ToolsManager non disponible');
        }
    };
    
    window.testProjectButtonsManual = function() {
        const toolsManager = window.PlanEditor.instances?.toolsManager;
        if (toolsManager && toolsManager.testProjectButtonsManual) {
            toolsManager.testProjectButtonsManual();
        } else {
            console.error('❌ ToolsManager non disponible');
        }
    };
    
    // Test ultra-direct sans dépendances
    window.testProjectButtonsDirect = function() {
        console.log('🔥 [TEST DIRECT] Test sans framework...');
        
        const saveButton = document.getElementById('btn-save-project');
        const loadButton = document.getElementById('btn-load-project');
        const newButton = document.getElementById('btn-new-project');
        
        console.log('🔥 [TEST DIRECT] Boutons trouvés:', {
            save: !!saveButton,
            load: !!loadButton,
            new: !!newButton
        });
        
        [saveButton, loadButton, newButton].forEach((btn, i) => {
            if (btn) {
                console.log(`🔥 [TEST DIRECT] Forçage bouton ${i}...`);
                
                // Méthode BRUTALE : cloner et remplacer l'élément
                const parent = btn.parentNode;
                const clone = btn.cloneNode(true);
                
                // Supprimer tous les styles et classes sur le clone
                clone.removeAttribute('style');
                clone.removeAttribute('class');
                clone.disabled = false;
                
                // Appliquer les styles directement via setProperty
                clone.style.setProperty('background-color', '#3c3c3c', 'important');
                clone.style.setProperty('border', '1px solid #555', 'important');
                clone.style.setProperty('color', '#eee', 'important');
                clone.style.setProperty('cursor', 'pointer', 'important');
                clone.style.setProperty('opacity', '1', 'important');
                clone.style.setProperty('padding', '5px 10px', 'important');
                clone.style.setProperty('border-radius', '4px', 'important');
                clone.style.setProperty('font-size', '14px', 'important');
                clone.style.setProperty('display', 'flex', 'important');
                clone.style.setProperty('align-items', 'center', 'important');
                clone.style.setProperty('justify-content', 'center', 'important');
                
                // Remplacer l'ancien par le nouveau
                parent.replaceChild(clone, btn);
                
                console.log(`✅ [TEST DIRECT] Bouton ${i} remplacé`);
                
                setTimeout(() => {
                    console.log(`🔥 [TEST DIRECT] Bouton ${i} couleur finale:`, window.getComputedStyle(clone).color);
                }, 100);
            }
        });
    };
    
    // Fonction qui force un recalcul visuel complet
    window.forceVisualRefresh = function() {
        console.log('🔄 [VISUAL REFRESH] Forçage recalcul visuel...');
        
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
            // Forcer un reflow en changeant temporairement la propriété
            toolbar.style.display = 'none';
            toolbar.offsetHeight; // Force reflow
            toolbar.style.display = 'flex';
        }
        
        // Forcer aussi sur les boutons individuellement
        ['btn-save-project', 'btn-load-project', 'btn-new-project'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.style.display = 'none';
                btn.offsetHeight; // Force reflow
                btn.style.display = 'flex';
            }
        });
        
        console.log('✅ [VISUAL REFRESH] Recalcul terminé');
    };

})();