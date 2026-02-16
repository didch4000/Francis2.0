// modules/layers.js - Version sans modules ES6
(function() {
    'use strict';
    
    // Gestionnaire Undo/Redo
    class UndoRedoManager {
    constructor(state) {
        this.state = state;
        this.maxHistorySize = 50;
        this.debounceTimeout = null;
        this.lastSaveTime = 0;
        this.minSaveInterval = 100;
        this.pendingSave = false;
        this.arrowKeyStartState = null; // ✅ NOUVEAU : État de départ pour les flèches
        this.isArrowKeyOperation = false; // ✅ NOUVEAU : Flag pour déplacement flèches
    }

    saveState(canvas, layer, forceImmediate = false) {
        if (!canvas || !layer || this.state.isLoadingState) return;

        // ✅ NOUVEAU : Ne pas sauvegarder pendant la création de courbe
        if (this.state.isCreatingCurve && !forceImmediate) {
            console.log('🎯 [CURVE DEBUG] Sauvegarde bloquée - création courbe en cours');
            return;
        }

        // ✅ MODIFIÉ : Ne pas sauvegarder pendant le dessin SAUF si c'est forcé
        if (this.state.isDrawing && !forceImmediate) {
            this.pendingSave = true;
            return;
        }

        // ✅ NOUVEAU : Pendant un déplacement aux flèches, ne pas sauvegarder
        if (this.isArrowKeyOperation && !forceImmediate) {
            return;
        }

        // ✅ NOUVEAU : Ne pas sauvegarder pendant la mise à jour des projections des véhicules
        if (this.state.isUpdatingProjections && !forceImmediate) {
            console.log('🚗 [PROJECTIONS] Sauvegarde bloquée - mise à jour des projections en cours');
            return;
        }

        // 🚗 NOUVEAU : Ne pas sauvegarder pendant la modification de véhicules (déplacement/rotation)
        if (this.state.isModifyingVehicle && !forceImmediate) {
            console.log('🚗 [VEHICLE] Sauvegarde bloquée - modification véhicule en cours');
            return;
        }
        
        // Debouncing pour éviter trop de sauvegardes rapprochées
        const now = Date.now();
        if (!forceImmediate && (now - this.lastSaveTime) < this.minSaveInterval) {
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }
            
            this.debounceTimeout = setTimeout(() => {
                this.performSave(canvas, layer);
                this.debounceTimeout = null;
            }, this.minSaveInterval);
            return;
        }
        
        this.performSave(canvas, layer);
    }

    performSave(canvas, layer) {
        if (!canvas || !layer || this.state.isLoadingState) return;

        this.lastSaveTime = Date.now();
        this.pendingSave = false;

        // Debug détaillé avec stack trace
        const stack = new Error().stack.split('\n').slice(1, 4).map(line => line.trim()).join(' → ');
        console.log('🔍 [UNDO DEBUG] ═══ SAUVEGARDE PERFORM ═══');
        console.log('🔍 [UNDO DEBUG] Stack:', stack);
        console.log('🔍 [UNDO DEBUG] isDrawing:', this.state.isDrawing);
        console.log('🔍 [UNDO DEBUG] isModifyingVehicle:', this.state.isModifyingVehicle);
        console.log('🔍 [UNDO DEBUG] isUpdatingProjections:', this.state.isUpdatingProjections);
        console.log('🔍 [UNDO DEBUG] isSavingVehicle:', this.state.isSavingVehicle);
        console.log('🔍 [UNDO DEBUG] Pile undo avant:', layer.undoStack.length);
        console.log('🔍 [UNDO DEBUG] currentMode:', this.state.currentMode);
        
        // Vider la pile redo quand on fait une nouvelle action
        layer.redoStack = [];
        
        const state = canvas.toJSON(this.state.fabricPropertiesToInclude);
        
        // ✅ MODIFIÉ : Filtrage plus simple et efficace
        const filteredObjects = state.objects.filter(obj => {
            // Exclure les guides temporaires (objets non-sélectionnables sans propriétés spéciales)
            if (obj.selectable === false && !obj.isBaseline && !obj.isZeroPoint && 
                !obj.isProjectionElement && !obj.isMeasurement && !obj.isScaleBar && 
                !obj.isLandmark && !obj.isVehicle) {
                return false;
            }
            return true;
        });
        
        const cleanState = { ...state, objects: filteredObjects };
        
        // Éviter de sauvegarder des états identiques (comparaison optimisée)
        const lastState = layer.undoStack[layer.undoStack.length - 1];
        if (lastState && this.statesAreEqual(lastState, cleanState)) {
            console.log('⏭️ État identique au précédent, sauvegarde ignorée');
            return;
        }
        
        layer.undoStack.push(cleanState);
        
        if (layer.undoStack.length > this.maxHistorySize) {
            layer.undoStack.shift();
        }
        
        // Debug détaillé de la pile
        console.log(`💾 État sauvegardé - Pile undo: ${layer.undoStack.length} états`);
        layer.undoStack.forEach((state, index) => {
            console.log(`  [${index}] ${state.objects.length} objets`);
        });
        console.log(`  Pile redo: ${layer.redoStack.length} états`);
        
        document.dispatchEvent(new CustomEvent('update-undo-redo-buttons'));
    }

    // ✅ NOUVEAU : Gestion spéciale pour les déplacements aux flèches
    startArrowKeyOperation(canvas, layer) {
        if (!this.isArrowKeyOperation) {
            this.isArrowKeyOperation = true;
            this.arrowKeyStartState = canvas.toJSON(this.state.fabricPropertiesToInclude);
            console.log('🎯 Début déplacement flèches - état sauvegardé');
        }
    }

    endArrowKeyOperation(canvas, layer) {
        if (this.isArrowKeyOperation) {
            this.isArrowKeyOperation = false;
            
            // Sauvegarder l'état final seulement
            this.forceSave(canvas, layer);
            console.log('✅ Fin déplacement flèches - état final sauvegardé');
        }
    }

    // Sauvegarder à la fin du dessin
    saveStateAfterDrawing(canvas, layer) {
        if (this.pendingSave && !this.state.isCreatingCurve) {
            console.log('🎯 [CURVE DEBUG] SaveStateAfterDrawing - forceSave autorisé');
            this.forceSave(canvas, layer);
        } else if (this.pendingSave && this.state.isCreatingCurve) {
            console.log('🎯 [CURVE DEBUG] SaveStateAfterDrawing bloqué - création courbe en cours');
        }
    }

    forceSave(canvas, layer, allowDuringVehicleSave = false) {
        // BYPASS complet de la logique de comparaison pour forcer la sauvegarde
        // MAIS pas pendant le remplissage pour éviter les sauvegardes multiples
        if (!canvas || !layer || this.state.isLoadingState) return;

        // Ne pas forcer pendant le mode fill pour éviter les sauvegardes multiples
        if (this.state.currentMode === 'fill') return;

        // ✅ NOUVEAU : Ne pas forcer pendant la création de courbe
        if (this.state.isCreatingCurve) {
            console.log('🎯 [CURVE DEBUG] ForceSave bloquée - création courbe en cours');
            return;
        }

        // 🚗 NOUVEAU : Ne pas forcer pendant la modification de véhicules
        if (this.state.isModifyingVehicle) {
            console.log('🚗 [VEHICLE] ForceSave bloquée - modification véhicule en cours');
            return;
        }

        // 🚗 NOUVEAU : Ne pas forcer pendant la mise à jour des projections
        if (this.state.isUpdatingProjections) {
            console.log('🚗 [PROJECTIONS] ForceSave bloquée - mise à jour projections en cours');
            return;
        }

        // 🚗 NOUVEAU : Si une sauvegarde de véhicule est déjà en cours, ne pas en ajouter une autre
        // SAUF si allowDuringVehicleSave est true (appel autorisé)
        if (this.state.isSavingVehicle && !allowDuringVehicleSave) {
            console.log('🚗 [VEHICLE] ForceSave bloquée - sauvegarde de véhicule déjà en cours');
            return;
        }

        console.log('💪 [FORCE SAVE] ForceSave exécuté - isModifyingVehicle:', this.state.isModifyingVehicle, 'isUpdatingProjections:', this.state.isUpdatingProjections, 'isSavingVehicle:', this.state.isSavingVehicle, 'allowDuringVehicleSave:', allowDuringVehicleSave);
        const stack = new Error().stack.split('\n').slice(1, 4).map(line => line.trim()).join(' → ');
        console.log('💪 [FORCE SAVE] Stack:', stack);
        
        this.lastSaveTime = Date.now();
        this.pendingSave = false;
        
        // Vider la pile redo quand on fait une nouvelle action
        layer.redoStack = [];
        
        const state = canvas.toJSON(this.state.fabricPropertiesToInclude);
        
        // Filtrage des objets (comme dans performSave)
        const filteredObjects = state.objects.filter(obj => {
            if (obj.selectable === false && !obj.isBaseline && !obj.isZeroPoint && 
                !obj.isProjectionElement && !obj.isMeasurement && !obj.isScaleBar && 
                !obj.isLandmark && !obj.isVehicle) {
                return false;
            }
            return true;
        });
        
        const cleanState = { ...state, objects: filteredObjects };

        // FORCER la sauvegarde SANS comparaison
        console.log(`💾 [FORCE SAVE] AJOUT à la pile undo - taille avant: ${layer.undoStack.length}`);
        layer.undoStack.push(cleanState);
        console.log(`💾 [FORCE SAVE] AJOUT effectué - taille après: ${layer.undoStack.length}`);

        if (layer.undoStack.length > this.maxHistorySize) {
            layer.undoStack.shift();
        }

        console.log(`💾 [FORCE SAVE] État forcé - Pile undo: ${layer.undoStack.length} états`);
        layer.undoStack.forEach((state, index) => {
            console.log(`  [${index}] ${state.objects.length} objets`);
        });
        
        document.dispatchEvent(new CustomEvent('update-undo-redo-buttons'));
    }

    // ... (resto des méthodes undo, redo, etc. inchangées)
    undo() {
        const layer = this.state.getActiveLayer();
        if (!layer || !this.canUndo(layer)) {
            console.log('❌ Impossible d\'annuler : pas d\'état précédent valide');
            return false;
        }

        console.log(`↩️ Annulation (${layer.undoStack.length} → ${layer.undoStack.length - 1})`);
        
        // Debug pour comprendre ce qui est restauré
        const debugCurrentState = layer.undoStack[layer.undoStack.length - 1];
        const debugPrevState = layer.undoStack[layer.undoStack.length - 2];
        console.log('🔄 [UNDO DEBUG] État actuel avant undo:', debugCurrentState?.objects?.length || 0, 'objets');
        console.log('🔄 [UNDO DEBUG] État à restaurer:', debugPrevState?.objects?.length || 0, 'objets');
        
        // Bloquer les nouvelles sauvegardes pendant l'opération
        this.state.isLoadingState = true;
        const canvas = layer.fabricCanvas;
        
        // Prendre l'état actuel et le mettre dans la pile redo
        const currentState = layer.undoStack.pop();
        layer.redoStack.push(currentState);
        
        // Récupérer l'état précédent (qui devient l'état actuel)
        const prevState = layer.undoStack[layer.undoStack.length - 1];
        
        if (!prevState) {
            console.error('❌ État précédent introuvable, restauration impossible');
            // Restaurer l'état dans la pile undo
            layer.undoStack.push(layer.redoStack.pop());
            this.state.isLoadingState = false;
            return false;
        }
        
        console.log('🔄 [UNDO DEBUG] Contenu de l\'état à restaurer:');
        prevState.objects?.forEach((obj, i) => {
            console.log(`  État[${i}] ${obj.type} - visible:${obj.visible} - left:${obj.left} top:${obj.top}`);
        });

        // 🎯 NOUVEAU : Sauvegarder les objets de mesure déplacés manuellement AVANT loadFromJSON
        // loadFromJSON va vider le canvas, on doit donc garder les objets réels pour les remettre après
        const manuallyMovedProjections = [];
        canvas.getObjects().forEach(obj => {
            if (obj.isProjectionElement && obj.hasBeenMoved && obj.projectionId) {
                const key = obj.projectionId + '_' + obj.projectionRole;
                console.log(`🔒 [UNDO] Sauvegarde de la mesure déplacée: ${key} à (${obj.left.toFixed(1)}, ${obj.top.toFixed(1)})`);
                // Cloner l'objet pour le remettre après loadFromJSON
                const cloned = fabric.util.object.clone(obj);
                cloned.hasBeenMoved = true; // S'assurer que le flag est conservé
                manuallyMovedProjections.push(cloned);
            }
        });

        canvas.loadFromJSON(prevState, () => {
            console.log('🔄 [UNDO DEBUG] Après restauration - objets restaurés:', canvas.getObjects().length);

            // 🎯 NOUVEAU : Remettre les mesures déplacées manuellement sur le canvas
            manuallyMovedProjections.forEach(cloned => {
                const key = cloned.projectionId + '_' + cloned.projectionRole;
                console.log(`🔄 [UNDO] Restauration de la mesure déplacée: ${key} à (${cloned.left.toFixed(1)}, ${cloned.top.toFixed(1)})`);
                canvas.add(cloned);
            });

            canvas.getObjects().forEach((obj, i) => {
                console.log(`  Restauré[${i}] ${obj.type} - visible:${obj.visible} - left:${obj.left} top:${obj.top}`);
            });
            canvas.renderAll();
            this.finishUndoRedoOperation();
        });

        return true;
    }

    redo() {
        const layer = this.state.getActiveLayer();
        if (!layer || !this.canRedo(layer)) {
            console.log('❌ Impossible de rétablir : pas d\'état suivant valide');
            return false;
        }

        console.log(`↪️ Rétablissement (pile redo: ${layer.redoStack.length} → ${layer.redoStack.length - 1})`);
        
        // Bloquer les nouvelles sauvegardes pendant l'opération
        this.state.isLoadingState = true;
        const canvas = layer.fabricCanvas;
        
        // Prendre l'état suivant depuis la pile redo
        const nextState = layer.redoStack.pop();
        
        if (!nextState) {
            console.error('❌ État suivant introuvable, restauration impossible');
            this.state.isLoadingState = false;
            return false;
        }
        
        // L'ajouter à la pile undo
        layer.undoStack.push(nextState);

        // 🎯 NOUVEAU : Sauvegarder les objets de mesure déplacés manuellement AVANT loadFromJSON
        // loadFromJSON va vider le canvas, on doit donc garder les objets réels pour les remettre après
        const manuallyMovedProjections = [];
        canvas.getObjects().forEach(obj => {
            if (obj.isProjectionElement && obj.hasBeenMoved && obj.projectionId) {
                const key = obj.projectionId + '_' + obj.projectionRole;
                console.log(`🔒 [REDO] Sauvegarde de la mesure déplacée: ${key} à (${obj.left.toFixed(1)}, ${obj.top.toFixed(1)})`);
                // Cloner l'objet pour le remettre après loadFromJSON
                const cloned = fabric.util.object.clone(obj);
                cloned.hasBeenMoved = true; // S'assurer que le flag est conservé
                manuallyMovedProjections.push(cloned);
            }
        });

        canvas.loadFromJSON(nextState, () => {
            // 🎯 NOUVEAU : Remettre les mesures déplacées manuellement sur le canvas
            manuallyMovedProjections.forEach(cloned => {
                const key = cloned.projectionId + '_' + cloned.projectionRole;
                console.log(`🔄 [REDO] Restauration de la mesure déplacée: ${key} à (${cloned.left.toFixed(1)}, ${cloned.top.toFixed(1)})`);
                canvas.add(cloned);
            });

            canvas.renderAll();
            this.finishUndoRedoOperation();
        });

        return true;
    }

    // Nouvelles méthodes utilitaires pour vérifications cohérentes
    canUndo(layer) {
        return layer && layer.undoStack && layer.undoStack.length > 1;
    }
    
    
    canRedo(layer) {
        return layer && layer.redoStack && layer.redoStack.length > 0;
    }
    
    // Méthode unifiée pour finaliser les opérations undo/redo
    finishUndoRedoOperation() {
        // Utiliser requestAnimationFrame pour s'assurer que le rendu est terminé
        requestAnimationFrame(() => {
            // Vérifier les changements d'état critiques après undo/redo
            this.checkStateChangesAfterUndoRedo();
            
            // Mettre à jour les projections et l'interface
            document.dispatchEvent(new CustomEvent('update-all-projections'));
            
            // Libérer le verrou de chargement
            this.state.isLoadingState = false;
            
            // Mettre à jour l'interface utilisateur
            document.dispatchEvent(new CustomEvent('update-undo-redo-buttons'));
            document.dispatchEvent(new CustomEvent('update-layers-panel'));
            
            // Mettre à jour l'état des contrôles des repères
            if (window.PlanEditor.instances?.uiManager) {
                window.PlanEditor.instances.uiManager.updateLandmarkControlsState();
                window.PlanEditor.instances.uiManager.updateSpecialToolsAvailability();
            }
            
            console.log('✅ Opération undo/redo terminée');
        });
    }

    // Vérifier les changements d'état critiques après undo/redo
    checkStateChangesAfterUndoRedo() {
        const activeLayer = this.state.getActiveLayer();
        if (!activeLayer) return;
        
        const canvas = activeLayer.fabricCanvas;
        const objects = canvas.getObjects();
        
        // Debug détaillé des objets après undo/redo
        console.log('🔍 [UNDO/REDO] Objets après undo/redo:', objects.length);
        objects.forEach((obj, i) => {
            console.log(`  [${i}] ${obj.type} - isBaseline: ${obj.isBaseline} - isZeroPoint: ${obj.isZeroPoint}`);
        });
        
        // Vérifier la présence de ligne de base
        const baseline = objects.find(o => o.isBaseline);
        const zeroPoint = objects.find(o => o.isZeroPoint);
        
        // Note: Pas de message d'avertissement pour undo car l'utilisateur remonte 
        // l'historique étape par étape et a déjà supprimé les objets dépendants avant
        
        // Déclencher une mise à jour de l'état des outils selon la présence de ligne de base
        document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
        
        console.log('🔍 [UNDO/REDO] Ligne de base:', baseline ? 'TROUVÉE' : 'ABSENTE');
        console.log('🔍 [UNDO/REDO] Point zéro:', zeroPoint ? 'TROUVÉ' : 'ABSENT');
        
        if (baseline) {
            console.log('🔍 [UNDO/REDO] Position ligne de base:', { x1: baseline.x1, y1: baseline.y1, x2: baseline.x2, y2: baseline.y2 });
        }
    }


    // Comparaison optimisée d'états pour éviter les sauvegardes redondantes
    statesAreEqual(state1, state2) {
        if (!state1 || !state2) return false;
        
        // Comparaison rapide par taille d'objets
        if (state1.objects.length !== state2.objects.length) return false;
        
        // Comparaison des propriétés de base du canvas
        if (state1.width !== state2.width || state1.height !== state2.height) return false;
        
        // Comparaison JSON pour les petits états (< 10 objets)
        if (state1.objects.length < 10) {
            return JSON.stringify(state1) === JSON.stringify(state2);
        }
        
        // Pour les états plus complexes, comparaison par hash des objets
        const hash1 = this.getStateHash(state1);
        const hash2 = this.getStateHash(state2);
        return hash1 === hash2;
    }
    
    // Génère un hash simple pour comparaison rapide d'états
    getStateHash(state) {
        let hash = 0;
        const str = JSON.stringify({
            objects: state.objects.map(obj => ({
                type: obj.type,
                left: obj.left,
                top: obj.top,
                width: obj.width,
                height: obj.height,
                fill: obj.fill,
                stroke: obj.stroke
            }))
        });
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

    clearHistory(layer) {
        if (!layer) {
            console.warn('⚠️ Tentative de vider l\'historique d\'un calque inexistant');
            return false;
        }
        
        const undoCount = layer.undoStack?.length || 0;
        const redoCount = layer.redoStack?.length || 0;
        
        // Initialiser les piles si elles n'existent pas
        layer.undoStack = [];
        layer.redoStack = [];
        
        document.dispatchEvent(new CustomEvent('update-undo-redo-buttons'));
        console.log(`🗑️ Historique vidé (${undoCount} undo, ${redoCount} redo supprimés)`);
        
        return true;
    }

    getHistoryInfo(layer) {
        if (!layer) return { undo: 0, redo: 0, canUndo: false, canRedo: false };
        
        // Logique simple : nombre d'actions = états - 1
        const totalStates = layer.undoStack?.length || 0;
        const undoCount = Math.max(0, totalStates - 1);
        const redoCount = layer.redoStack?.length || 0;
        
        console.log('📊 [UNDO DEBUG] getHistoryInfo:', layer.name, 'undoStack.length:', totalStates, 'undoCount:', undoCount, 'redoCount:', redoCount);
        
        return {
            undo: undoCount,
            redo: redoCount,
            canUndo: this.canUndo(layer),
            canRedo: this.canRedo(layer)
        };
    }
}



    // Gestionnaire des calques
    class LayerManager {
        constructor(state) {
            this.state = state;
            this.undoRedoManager = new UndoRedoManager(state);
        }

        createLayer(name, image = null, options = {}) {
            const { insertBelowDrawing = false } = options;
            const isFirstImageLayer = this.state.layers.length === 0 && image;
            
            if (isFirstImageLayer) {
                const guideMessage = document.getElementById('guide-message');
                const zoomWrapper = document.getElementById('zoom-wrapper');
                guideMessage.style.display = 'none';
                zoomWrapper.style.width = `${image.width}px`;
                zoomWrapper.style.height = `${image.height}px`;
            }

            const layerId = this.state.incrementLayerCounter();
            const canvasEl = document.createElement('canvas');
            const wrapper = document.createElement('div');
            wrapper.className = 'canvas-wrapper';
            wrapper.appendChild(canvasEl);
            document.getElementById('zoom-wrapper').appendChild(wrapper);

            let canvasWidth = options.width || (image ? image.width : 
                (this.state.layers.length > 0 ? this.state.layers[0].fabricCanvas.width : 800));
            let canvasHeight = options.height || (image ? image.height : 
                (this.state.layers.length > 0 ? this.state.layers[0].fabricCanvas.height : 600));

            const fabricCanvas = new fabric.Canvas(canvasEl, {
                width: canvasWidth,
                height: canvasHeight,
                stopContextMenu: true,
                devicePixelRatio: options.pixelRatio || 1
            });

            const newLayer = {
                id: layerId,
                name: name || `Calque ${layerId}`,
                fabricCanvas,
                wrapper,
                x: options.x || 0,
                y: options.y || 0,
                angle: options.angle || 0,
                originalRotation: options.originalRotation || 0, // Stocker l'angle original avant rognage
                visible: true,
                opacity: 1.0,
                locked: false,
                scaleDenominator: options.scaleDenominator || null,
                pixelRatio: options.pixelRatio || 1,
                backgroundImage: image ? image.src : null, // Sauvegarder la source de l'image de fond
                undoStack: [],
                redoStack: []
            };

            wrapper.style.transform = `translate(${newLayer.x}px, ${newLayer.y}px) rotateZ(${newLayer.angle}deg)`;
            
            if (image) {
                const backgroundImage = (image instanceof fabric.Image) ? image : new fabric.Image(image);
                fabricCanvas.setBackgroundImage(backgroundImage, fabricCanvas.renderAll.bind(fabricCanvas));
            }

            // Gestion de l'ordre et du z-index avec renforcement
            if (insertBelowDrawing) {
                // Image de fond - au-dessous
                const drawingLayerIndex = this.state.layers.findIndex(l => l.name === this.state.DRAWING_LAYER_NAME);
                if (drawingLayerIndex !== -1) {
                    this.state.layers.splice(drawingLayerIndex + 1, 0, newLayer);
                } else {
                    this.state.layers.push(newLayer);
                }
                wrapper.style.setProperty('z-index', '1', 'important'); // Z-index bas pour les images
                console.log(`🎨 [Z-INDEX] Calque image "${name}" créé avec z-index=1`);
            } else {
                // Calque de dessin - au-dessus
                this.state.layers.unshift(newLayer);
                wrapper.style.setProperty('z-index', '100', 'important'); // Z-index élevé pour le dessin
                console.log(`🎨 [Z-INDEX] Calque dessin "${name}" créé avec z-index=100`);
            }
            
            this.ensureDrawingLayerOnTop();
            
            // IMPORTANT: Configurer les listeners du canvas AVANT de sauvegarder l'état
            // Récupérer le canvasManager depuis le namespace global
            if (window.PlanEditor && window.PlanEditor.instances && window.PlanEditor.instances.canvasManager) {
                window.PlanEditor.instances.canvasManager.setupCanvasListeners(fabricCanvas);
                console.log('✅ Canvas listeners configurés pour le calque', name);
            } else {
                console.warn('⚠️ CanvasManager non disponible, listeners non configurés');
            }
            
            // Sauvegarder l'état initial pour initialiser la pile undo
            // Mais s'assurer qu'il n'y a pas de sauvegarde redondante ensuite
            this.undoRedoManager.saveState(fabricCanvas, newLayer);
            console.log('📝 [UNDO DEBUG] Calque créé avec sauvegarde initiale:', name);
            
            // Plus besoin de marquer l'état initial

            if (isFirstImageLayer) {
                this.fitImageToView();
            }
            
            this.setActiveLayer(layerId);
            
            // Déclencher la mise à jour de l'état des outils de projet
            document.dispatchEvent(new CustomEvent('update-project-tools-state'));
            
            return newLayer;
        }

        setActiveLayer(id) {
            this.state.setActiveLayer(id);
            
            this.state.layers.forEach(layer => {
                const isActive = layer.id === this.state.activeLayerId;
                const targetCanvas = layer.fabricCanvas;
                targetCanvas.selection = isActive && this.state.currentMode === 'select';
                targetCanvas.getObjects().forEach(obj => { obj.evented = isActive; });
                targetCanvas.renderAll();
            });
            
            const activeLayer = this.state.getActiveLayer();
            if (activeLayer) {
                if (activeLayer.name === this.state.DRAWING_LAYER_NAME) {
                    // Pour le calque de dessin, passer en mode select si on était en layer-move
                    if (this.state.currentMode === 'layer-move') {
                        this.state.setCurrentMode('select');
                    }
                } else {
                    // ✅ FIX : Pour les autres calques (drone, image), passer en mode layer-move
                    // Cela permet de déplacer le calque immédiatement après l'avoir sélectionné
                    // Vérifier aussi si le calque a des poignées de redimensionnement (calque drone calibré)
                    const hasResizeHandles = activeLayer.resizeHandles && activeLayer.resizeHandles.length > 0;
                    const isDroneLayer = activeLayer.name.toLowerCase().includes('drone');

                    if ((this.state.workflowState === 'ready_for_drawing' || hasResizeHandles || isDroneLayer) && this.state.currentMode !== 'layer-move') {
                        this.state.setCurrentMode('layer-move');
                        console.log('🔄 Mode changé vers layer-move pour le calque:', activeLayer.name);
                    }
                }
            }
            
            // Mettre à jour l'interface utilisateur après changement de calque
            document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
            
            this.state.notifyActiveLayerChange(id);
            this.state.notifyLayersUpdated();
        }

        deleteLayer(id) {
            if (!confirm("Êtes-vous sûr de vouloir supprimer ce calque ? Cette action est irréversible.")) return;
            
            const index = this.state.layers.findIndex(l => l.id === id);
            if (index === -1) return;

            const layerToDelete = this.state.layers[index];
            document.getElementById('zoom-wrapper').removeChild(layerToDelete.wrapper);
            this.state.layers.splice(index, 1);

            if (layerToDelete.name === this.state.DRAWING_LAYER_NAME) {
                this.state.setWorkflowState('scale_calibrated');
            }

            if (this.state.layers.length === 0) {
                this.resetToInitialState();
            } else if (id === this.state.activeLayerId) {
                const newActiveIndex = Math.max(0, index - 1);
                this.setActiveLayer(this.state.layers[newActiveIndex].id);
            }
            
            this.updateZIndexes();
            this.state.notifyLayersUpdated();
        }

        toggleVisibility(id) {
            const layer = this.state.layers.find(l => l.id === id);
            if (layer) {
                layer.visible = !layer.visible;
                layer.wrapper.style.display = layer.visible ? 'block' : 'none';
                this.state.notifyLayersUpdated();
            }
        }

        toggleLock(id) {
            const layer = this.state.layers.find(l => l.id === id);
            if (layer) {
                layer.locked = !layer.locked;
                this.state.notifyLayersUpdated();
            }
        }

        setOpacity(id, opacity) {
            const layer = this.state.layers.find(l => l.id === id);
            if (layer) {
                layer.opacity = parseFloat(opacity);
                layer.wrapper.style.opacity = layer.opacity;
            }
        }

        setLayerAngle(id, angle) {
            const layer = this.state.layers.find(l => l.id === id);
            if (layer) {
                layer.angle = angle;
                layer.wrapper.style.transform = `translate(${layer.x}px, ${layer.y}px) rotateZ(${layer.angle}deg)`;

                // ✅ FIX : Mettre à jour les positions des poignées lors de la rotation
                if (layer.resizeHandles && layer.resizeHandles.length > 0) {
                    document.dispatchEvent(new CustomEvent('update-handles-positions', { detail: { layerId: id } }));
                }
            }
        }



        ensureDrawingLayerOnTop() {
            const drawingLayerIndex = this.state.layers.findIndex(l => l.name === this.state.DRAWING_LAYER_NAME);
            if (drawingLayerIndex > 0) {
                const drawingLayer = this.state.layers.splice(drawingLayerIndex, 1)[0];
                this.state.layers.unshift(drawingLayer);
            }
        }

        updateZIndexes() {
            const len = this.state.layers.length;
            this.state.layers.forEach((layer, index) => {
                // Si c'est le calque de dessin, on force toujours un z-index élevé
                if (layer.name === this.state.DRAWING_LAYER_NAME) {
                    layer.wrapper.style.setProperty('z-index', '100', 'important');
                } else {
                    // Pour les autres calques, on calcule dynamiquement
                    // len - 1 - index donne l'ordre inverse : premier élément (dessin) = len-1, dernier élément (fond) = 0
                    const zIndex = len - 1 - index;
                    layer.wrapper.style.setProperty('z-index', zIndex.toString(), 'important');
                }
            });
        }

        fitImageToView() {
            const imageLayer = this.state.layers.find(l => l.fabricCanvas.backgroundImage || l.name === 'Plan rogné');
            if (!imageLayer) return;
            
            const canvasContainer = document.getElementById('canvas-container');
            const canvasWidth = imageLayer.fabricCanvas.width;
            const canvasHeight = imageLayer.fabricCanvas.height;
            const containerWidth = canvasContainer.clientWidth - 40;
            const containerHeight = canvasContainer.clientHeight - 40;
            const scaleX = containerWidth / canvasWidth;
            const scaleY = containerHeight / canvasHeight;
            const newZoom = Math.min(scaleX, scaleY, 1);
            
            // Appeler la méthode de zoom via un événement
            document.dispatchEvent(new CustomEvent('apply-zoom', { detail: { zoom: newZoom } }));
        }

        resetToInitialState() {
            const guideMessage = document.getElementById('guide-message');
            const zoomWrapper = document.getElementById('zoom-wrapper');
            
            guideMessage.style.display = 'block';
            zoomWrapper.style.width = 'auto';
            zoomWrapper.style.height = 'auto';
            
            this.state.reset();
            
            // Déclencher les événements de mise à jour
            document.dispatchEvent(new CustomEvent('update-scroll-content-size'));
            document.dispatchEvent(new CustomEvent('update-zoom-display'));
            document.dispatchEvent(new CustomEvent('apply-zoom', { detail: { zoom: 1 } }));
        }
    }

    // Exposer dans le namespace global
    window.PlanEditor.LayerManager = LayerManager;
    window.PlanEditor.UndoRedoManager = UndoRedoManager;

})();