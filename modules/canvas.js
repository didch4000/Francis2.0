// modules/canvas.js - Version sans modules ES6
(function() {
    'use strict';
    
    // Gestionnaire des canvas Fabric.js
    class CanvasManager {
        constructor(state, layerManager) {
            this.state = state;
            this.layerManager = layerManager;
            this.setupFabricCustomization();
        }

        // APPROCHE CORRIGÉE : La correction est faite en amont dans events.js
        getCorrectedPointer(canvas, event) {
            const rawPointer = canvas.getPointer(event);
            console.log(`🔍 [ZOOM DEBUG] CANVAS NATIF - Zoom: ${this.state.zoom}, Coordonnées Fabric.js: ${rawPointer.x}, ${rawPointer.y}`);
            // Les coordonnées sont déjà corrigées par events.js, pas de double correction
            return rawPointer;
        }

        setupFabricCustomization() {
            // Configuration des contrôles Fabric.js
            const deleteIcon = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBmaWxsPSJub25lIiBkPSJNMCAwaDI0djI0SDB6Ii8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNlNzRjM2MiLz48cGF0aCBkPSJNMTQuNSAxMGwtNSA1TTkuNSAxMGw1IDUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=";
            this.deleteImg = document.createElement('img');
            this.deleteImg.src = deleteIcon;

            // Rendre la fonction accessible comme méthode de la classe
            this.renderDeleteIcon = this.renderDeleteIcon.bind(this);

            const deleteSelectedObjects = (eventData, transform) => {
                const target = transform.target;
                const canvas = target.canvas;
                
                console.log('🗑️ [DELETE DEBUG] Tentative de suppression, target:', target.type, 'isBaseline:', target.isBaseline, 'isZeroPoint:', target.isZeroPoint);
                
                // Vérifier si c'est une activeSelection avec baseline et zeroPoint
                if (target.type === 'activeSelection' && target._objects) {
                    const baseline = target._objects.find(obj => obj.isBaseline);
                    const zeroPoint = target._objects.find(obj => obj.isZeroPoint);
                    
                    if (baseline && zeroPoint) {
                        console.log('🗑️ [DELETE DEBUG] Suppression activeSelection avec baseline + zeroPoint');
                        
                        // Vérifier s'il y a des objets liés (véhicules, repères)
                        const linkedObjects = canvas.getObjects().filter(o => 
                            o.isLandmark || o.isVehicle
                        );
                        
                        if (linkedObjects.length > 0) {
                            const confirmed = confirm("Cette action supprimera la ligne de base existante ainsi que tous les véhicules, repères et mesures associés. Voulez-vous continuer ?");
                            if (!confirmed) {
                                return false;
                            }
                            
                            // Supprimer tous les objets liés
                            const objectsToRemove = canvas.getObjects().filter(o => 
                                o.isBaseline || o.isZeroPoint || o.isProjectionElement || o.isLandmark || o.isVehicle
                            );
                            canvas.remove(...objectsToRemove);
                        } else {
                            // Supprimer baseline, zeroPoint et éléments de projection
                            const objectsToRemove = canvas.getObjects().filter(o => 
                                o.isBaseline || o.isZeroPoint || o.isProjectionElement
                            );
                            canvas.remove(...objectsToRemove);
                        }
                        
                        canvas.discardActiveObject();
                        canvas.requestRenderAll();
                        
                        // Mettre à jour l'interface
                        document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
                        
                        if (window.PlanEditor.instances && window.PlanEditor.instances.uiManager) {
                            setTimeout(() => {
                                window.PlanEditor.instances.uiManager.updateLandmarkControlsState();
                            }, 100);
                        }
                        
                        // Sauvegarder l'état pour l'undo/redo
                        this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
                        
                        return true;
                    }
                }
                
                // Empêcher la suppression d'objets individuels baseline/zeroPoint
                if (target.isBaseline || target.isZeroPoint) {
                    console.log('🚫 [DELETE DEBUG] Suppression via croix empêchée pour objet individuel:', target.isBaseline ? 'ligne de base' : 'point zéro');
                    eventData.preventDefault && eventData.preventDefault();
                    eventData.stopPropagation && eventData.stopPropagation();
                    return false;
                }
                
                // Code mort - jamais exécuté maintenant
                if (target.isBaseline) {
                    const linkedObjects = canvas.getObjects().filter(o => 
                        o.isLandmark || o.isVehicle
                    );
                    
                    if (linkedObjects.length > 0) {
                        const confirmed = confirm("Cette action supprimera la ligne de base existante ainsi que tous les véhicules, repères et mesures associés. Voulez-vous continuer ?");
                        if (!confirmed) {
                            // Annuler la suppression
                            return false;
                        }
                        
                        // Supprimer tous les objets liés
                        const objectsToRemove = canvas.getObjects().filter(o => 
                            o.isZeroPoint || o.isProjectionElement || o.isLandmark || o.isVehicle
                        );
                        canvas.remove(...objectsToRemove);
                        
                        document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
                        
                        if (window.PlanEditor.instances && window.PlanEditor.instances.uiManager) {
                            setTimeout(() => {
                                window.PlanEditor.instances.uiManager.updateLandmarkControlsState();
                            }, 100);
                        }
                    } else {
                        // Supprimer le point zéro et les éléments de projection
                        const objectsToRemove = canvas.getObjects().filter(o => 
                            o.isZeroPoint || o.isProjectionElement
                        );
                        canvas.remove(...objectsToRemove);
                        
                        document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
                        
                        if (window.PlanEditor.instances && window.PlanEditor.instances.uiManager) {
                            setTimeout(() => {
                                window.PlanEditor.instances.uiManager.updateLandmarkControlsState();
                            }, 100);
                        }
                    }
                }
                
                // Suppression normale
                canvas.remove(target);
                canvas.discardActiveObject();
                canvas.requestRenderAll();
                
                // Sauvegarder l'état pour l'undo/redo
                this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
            };

            // Intercepter la création du contrôle de suppression pour l'exclure de certains objets
            const originalDeleteControl = new fabric.Control({
                x: 0.5, y: -0.5, offsetX: 16, offsetY: -16,
                cursorStyle: 'pointer',
                mouseUpHandler: deleteSelectedObjects,
                render: (ctx, left, top, styleOverride, fabricObject) => {
                    // Ne pas afficher pour la ligne de base et le point zéro
                    if (fabricObject && (fabricObject.isBaseline || fabricObject.isZeroPoint)) {
                        return;
                    }
                    this.renderDeleteIcon(ctx, left, top, styleOverride, fabricObject);
                }
            });
            
            fabric.Object.prototype.controls.deleteControl = originalDeleteControl;

            fabric.Object.prototype.transparentCorners = false;
            fabric.Object.prototype.cornerColor = '#007aff';
            fabric.Object.prototype.cornerStyle = 'circle';
            fabric.Object.prototype.borderColor = '#007aff';
        }
        
        renderDeleteIcon(ctx, left, top, styleOverride, fabricObject) {
            console.log('🎨 [RENDER DEBUG] renderDeleteIcon appelé pour:', fabricObject ? fabricObject.type : 'inconnu', 'isBaseline:', fabricObject?.isBaseline, 'isZeroPoint:', fabricObject?.isZeroPoint);
            
            // Vérifier les objets individuels - ne pas afficher pour objets seuls
            if (fabricObject && (fabricObject.isBaseline || fabricObject.isZeroPoint)) {
                console.log('🚫 [RENDER DEBUG] Rendu de la croix bloqué pour objet individuel:', fabricObject.isBaseline ? 'baseline' : 'zeroPoint');
                return; // Ne rien dessiner
            }
            
            // Pour activeSelection, afficher la croix (on veut pouvoir supprimer)
            console.log('✅ [RENDER DEBUG] Rendu normal de la croix');
            const size = 24;
            ctx.save();
            ctx.translate(left, top);
            ctx.rotate(fabric.util.degreesToRadians(this.angle));
            ctx.drawImage(this.deleteImg, -size / 2, -size / 2, size, size);
            ctx.restore();
        }

        setupCanvasListeners(canvas) {
            // CORRECTION: Supprimer tous les anciens gestionnaires pour éviter la duplication
            canvas.off('mouse:down');
            canvas.off('mouse:move');  
            canvas.off('mouse:up');
            console.log('DEBUG: Anciens gestionnaires supprimés pour éviter duplication');
            
            const saveCurrentState = () => {
                const layer = this.state.layers.find(l => l.fabricCanvas === canvas);
                this.layerManager.undoRedoManager.saveState(canvas, layer);
            };

            // Mouse down event - Ne pas sauvegarder automatiquement pour les modes de dessin
            canvas.on('mouse:down', (o) => {
                // Gestion manuelle du double clic (fallback)
                const currentTime = new Date().getTime();
                const lastClickTime = this.lastClickTime || 0;
                const timeDiff = currentTime - lastClickTime;
                
                // Détecter si c'est le même objet ou groupe
                let isSameTarget = false;
                if (o.target && this.lastClickTarget) {
                    if (o.target === this.lastClickTarget) isSameTarget = true;
                    // Vérifier si c'est le même groupe parent
                    if (o.target.group && this.lastClickTarget.group && o.target.group === this.lastClickTarget.group) isSameTarget = true;
                    // Vérifier si l'un est le parent de l'autre
                    if (o.target.group === this.lastClickTarget) isSameTarget = true;
                    if (this.lastClickTarget.group === o.target) isSameTarget = true;
                }

                if (timeDiff < 300 && timeDiff > 50 && isSameTarget) {
                    console.log('⚡ [MANUAL DBLCLICK] Double clic manuel détecté via mouse:down');
                    this.handleZeroPointDoubleClick(o.target, canvas);
                }
                
                this.lastClickTime = currentTime;
                this.lastClickTarget = o.target;

                if (this.state.isLoadingState || this.state.isSelectingArea) return;
                
                // Marquer le début de création de courbe pour bloquer toutes les sauvegardes
                if (this.state.currentMode === 'curve') {
                    this.state.isCreatingCurve = true;
                    // ✅ NOUVEAU : Nettoyer tout flag de courbe en attente précédent
                    if (this.state.hasPendingCurveSave) {
                        console.log('🎯 [CURVE DEBUG] Nettoyage courbe en attente précédente');
                        this.state.hasPendingCurveSave = false;
                    }
                    console.log('🎯 [CURVE DEBUG] Début création courbe - sauvegardes bloquées');
                }
                
                // Ne pas sauvegarder automatiquement pour les modes qui créent des objets
                const isDrawingMode = ['draw', 'arrow', 'circle', 'curve', 'measure', 'baseline'].includes(this.state.currentMode);
                const isSpecialMode = ['scale'].includes(this.state.currentMode);
                
                if (isDrawingMode) {
                    // Modes de dessin : pas de sauvegarde automatique
                    this.handleMouseDown(canvas, o, null);
                } else if (isSpecialMode) {
                    // Modes spéciaux : fonction vide pour compatibilité
                    this.handleMouseDown(canvas, o, () => {});
                } else {
                    // Autres modes : sauvegarde normale
                    this.handleMouseDown(canvas, o, saveCurrentState);
                }
            });

            // Mouse move event  
            canvas.on('mouse:move', (o) => {
                if (this.state.isLoadingState || !this.state.isDrawing || !this.state.guideShape) return;
                // Utiliser le canvas de dessin si différent du canvas actuel
                const drawingCanvas = this.state.drawingCanvas || canvas;
                this.handleMouseMove(drawingCanvas, o);
            });

            // Mouse up event
            canvas.on('mouse:up', (o) => {
                if (this.state.isLoadingState || !this.state.isDrawing) return;
                // Utiliser le canvas de dessin si différent du canvas actuel
                const drawingCanvas = this.state.drawingCanvas || canvas;
                // Même logique pour mouse:up
                const isDrawingMode = ['draw', 'arrow', 'circle', 'curve', 'measure', 'baseline'].includes(this.state.currentMode);
                const isSpecialMode = ['scale'].includes(this.state.currentMode);
                
                if (isDrawingMode) {
                    this.handleMouseUp(drawingCanvas, o, null);
                } else if (isSpecialMode) {
                    this.handleMouseUp(drawingCanvas, o, () => {});
                } else {
                    this.handleMouseUp(drawingCanvas, o, saveCurrentState);
                }
            });

            // Double click event for Zero Point
            canvas.on('mouse:dblclick', (o) => {
                console.log('⚡ [EVENT DEBUG] Canvas double click fired!', o);
                this.handleZeroPointDoubleClick(o.target, canvas);
            });

            // Object events
            canvas.on('object:moving', (e) => {
                if (this.state.isLoadingState) return;
                const obj = e.target;
                
                // Marquer les points de contrôle comme étant déplacés
                if (obj.isControlPoint) {
                    obj.isBeingDragged = true;
                    this.state.isModifyingControlPoint = true;
                    console.log('🎯 [CONTROL POINT DEBUG] Début modification point de contrôle');
                }
                
                // Marquer les éléments de projection comme ayant été déplacés dès qu'ils bougent
                if (obj.isProjectionElement && (obj.projectionRole === 'ordinate' || obj.projectionRole === 'abscissa')) {
                    obj.hasBeenMoved = true;
                }
                
                this.handleObjectMoving(canvas, e);
            });

            canvas.on('object:modified', (e) => {
                if (this.state.isLoadingState || this.state.isCreatingCurve) return;
                
                const obj = e.target;
                // Ne pas sauvegarder automatiquement pour les points de contrôle de courbe ET les courbes liées
                if (obj.isControlPoint) {
                    console.log('🎯 [CURVE DEBUG] Modification point de contrôle - finalisation de la courbe');
                    this.handleObjectModified(canvas, e, null); // Supprime le point de contrôle
                    
                    // Sauvegarder APRÈS que le point de contrôle soit supprimé
                    setTimeout(() => {
                        if (!this.state.isCreatingCurve) {
                            console.log('🎯 [CURVE DEBUG] Sauvegarde finale après suppression point de contrôle');
                            const layer = this.state.layers.find(l => l.fabricCanvas === canvas);
                            if (layer && this.layerManager.undoRedoManager) {
                                this.layerManager.undoRedoManager.saveState(canvas, layer);
                                // Nettoyer le flag de courbe en attente
                                this.state.hasPendingCurveSave = false;
                            }
                        }
                    }, 50); // Délai plus court pour éviter les problèmes de timing
                } else if (obj.type === 'path' && obj.controlHandle) {
                    console.log('🎯 [CURVE DEBUG] Modification courbe liée - pas de sauvegarde automatique');
                    this.handleObjectModified(canvas, e, null); // Pas de sauvegarde pour les courbes
                } else {
                    this.handleObjectModified(canvas, e, saveCurrentState);
                }
            });

            canvas.on('object:moved', (e) => {
                if (this.state.isLoadingState) return;
                const obj = e.target;
                
                // Marquer la fin du déplacement pour les points de contrôle
                if (obj.isControlPoint) {
                    obj.isBeingDragged = false;
                    this.state.isModifyingControlPoint = false;
                    console.log('🎯 [CONTROL POINT DEBUG] Fin modification point de contrôle - sauvegarde gérée par object:modified');
                    // Ne pas sauvegarder ici car c'est géré par object:modified pour éviter les doublons
                }
                
                console.log(`🔄 object:moved détecté - Type: ${obj.type}, isVehicle: ${!!obj.isVehicle}, isProjectionElement: ${!!obj.isProjectionElement}, projectionRole: ${obj.projectionRole || 'none'}`);
                
                if (obj.isVehicle) {
                    // Marquer le véhicule comme venant de bouger
                    obj.hasJustMoved = true;
                    console.log(`🚗 Véhicule ${obj.id} marqué comme ayant bougé`);
                    // Déclencher la mise à jour des projections
                    document.dispatchEvent(new CustomEvent('update-all-projections'));
                    // Réinitialiser le flag après un court délai
                    setTimeout(() => {
                        obj.hasJustMoved = false;
                        console.log(`🚗 Flag hasJustMoved réinitialisé pour ${obj.id}`);
                    }, 100);
                } else if (obj.isProjectionElement && (obj.projectionRole === 'ordinate' || obj.projectionRole === 'abscissa')) {
                    // Marquer les éléments de projection comme ayant été déplacés manuellement
                    obj.hasBeenMoved = true;
                    console.log(`📏 Projection ${obj.projectionRole} marquée comme déplacée pour ${obj.projectionId}`);
                } else {
                    console.log(`❓ Objet déplacé non reconnu - properties:`, {
                        type: obj.type,
                        isProjectionElement: obj.isProjectionElement,
                        projectionRole: obj.projectionRole,
                        projectionId: obj.projectionId
                    });
                }
            });

            canvas.on('object:removed', (e) => {
                if (this.state.isLoadingState || this.state.isCleaningUpProjections || this.state.isCleaningUpMeasure) return;
                this.handleObjectRemoved(canvas, e, saveCurrentState);
            });
			
			 // ✅ NOUVEAU : Configurer les curseurs Fabric.js
    		this.setupFabricCursors(canvas);

            // Selection events - handled in script.js
            this.setupSelectionEvents(canvas);
            
            // Ajouter l'écouteur pour les nouveaux objets
            this.setupObjectAddedListener(canvas);
        }

        setupObjectAddedListener(canvas) {
            canvas.on('object:added', (e) => {
                // S'assurer que le curseur reste au-dessus de tout
                this.ensureCursorOnTop();
            });
        }

        ensureCursorOnTop() {
            // Mettre à jour les z-index CSS pour s'assurer que le curseur reste visible
            const canvasContainer = document.getElementById('canvas-container');
            if (canvasContainer) {
                canvasContainer.style.position = 'relative';
                canvasContainer.style.zIndex = '1000';
            }
        }


        handleZeroPointDoubleClick(target, canvas) {
            if (!target) return;

            console.log('⚡ [DBLCLICK HANDLER] Target:', target.type, target.isZeroPoint ? 'isZeroPoint' : 'notZeroPoint');

            // Remonter vers le groupe parent si la cible n'est pas le point zéro elle-même
            let group = target;
            
            // 1. Vérifier si c'est directement le groupe point zéro
            if (!group.isZeroPoint) {
                // 2. Vérifier si c'est un objet DANS le groupe (via .group)
                if (group.group && group.group.isZeroPoint) {
                    group = group.group;
                }
                // 3. Vérifier si c'est le texte "0" spécifiquement (via isZeroText)
                else if (group.isZeroText && group.group) {
                    // Si on a cliqué sur le texte mais que group.group n'a pas isZeroPoint (cas bizarre), on vérifie le nom
                    if (group.group.name === 'Zero' || group.group.isZeroPoint) {
                        group = group.group;
                    }
                }
            }

            if (group && group.isZeroPoint) {
                console.log('🎯 [ZERO POINT] Valid ZeroPoint target found for double click');
                
                // Trouver l'objet texte dans le groupe
                // On cherche soit par le marqueur isZeroText, soit par le type text
                const objects = group.getObjects();
                const textObj = objects.find(obj => obj.isZeroText || obj.name === 'zeroText' || obj.type === 'text');
                
                if (textObj) {
                    const currentText = textObj.text;
                    // Basculer entre 0 et 0'
                    // Gérer aussi les cas où il y aurait des espaces ou autres
                    const cleanText = currentText.trim();
                    const newText = (cleanText === '0') ? "0'" : '0';
                    
                    console.log(`🎯 [ZERO POINT] Toggling text from "${currentText}" to "${newText}"`);
                    
                    try {
                        // Méthode robuste pour mettre à jour un objet dans un groupe Fabric.js :
                        // 1. Retirer l'objet avec mise à jour du groupe
                        group.removeWithUpdate(textObj);
                        
                        // 2. Modifier l'objet
                        textObj.set('text', newText);
                        
                        // 3. Réajouter l'objet avec mise à jour du groupe
                        // Note : addWithUpdate gère le recalcul des dimensions et la position relative
                        group.addWithUpdate(textObj);
                        
                        // S'assurer que le groupe conserve ses propriétés critiques
                        group.set({
                            isZeroPoint: true,
                            hasControls: false,
                            selectable: true,
                            name: 'Zero',
                            dirty: true
                        });
                        
                        canvas.requestRenderAll();
                        
                        // Sauvegarder l'état
                        const layer = this.state.layers.find(l => l.fabricCanvas === canvas);
                        if (layer && this.layerManager.undoRedoManager) {
                            this.layerManager.undoRedoManager.saveState(canvas, layer);
                        }
                    } catch (e) {
                        console.error('❌ [ZERO POINT] Error updating text:', e);
                    }
                } else {
                    console.warn('⚠️ [ZERO POINT] Text object not found in group');
                }
            } else {
                console.log('❌ [DBLCLICK HANDLER] Target is not ZeroPoint');
            }
        }

      handleMouseDown(canvas, o, saveCurrentState) {
    const pointer = this.getCorrectedPointer(canvas, o.e);
    
    console.log(`🖱️ [DEBUG] Mouse down - Mode: ${this.state.currentMode}, Target:`, o.target?.type || 'none');
    
    if (this.state.currentMode === 'add-text') {
        console.log('DEBUG: Appel de createTextZone');
        this.createTextZone(canvas, pointer, saveCurrentState);
        o.e.stopPropagation(); // Empêcher autres gestionnaires d'événements
        return;
    }

    if (this.state.currentMode === 'fill') {
        document.dispatchEvent(new CustomEvent('handle-fill', { detail: { pointer, target: o.target } }));
        return;
    }

    // Pas de dessin en mode layer-move, pan ou select
    if (this.state.currentMode === 'layer-move' || this.state.currentMode === 'pan' || this.state.currentMode === 'select') {
        console.log(`🖱️ [DEBUG] Mode ${this.state.currentMode} - pas de dessin`);
        return;
    }

    const currentLayer = this.state.layers.find(l => l.fabricCanvas === canvas);
    
    // Si on clique en dehors du calque de dessin, rediriger vers le calque de dessin actif
    let targetCanvas = canvas;
    let targetLayer = currentLayer;
    
    if (!currentLayer || currentLayer.locked) {
        // Chercher le calque de dessin actif
        const activeLayer = this.state.getActiveLayer();
        if (activeLayer && !activeLayer.locked && (this.state.currentMode === 'draw' || this.state.currentMode === 'curve' || this.state.currentMode === 'arrow')) {
            targetCanvas = activeLayer.fabricCanvas;
            targetLayer = activeLayer;
            console.log(`🖱️ [DEBUG] Redirection vers le calque de dessin actif: ${activeLayer.name}`);
        } else {
            console.log(`🖱️ [DEBUG] Calque verrouillé ou inexistant`);
            return;
        }
    }
    
    if (o.target && this.state.currentMode === 'select') return;
    
    // Recalculer le pointer pour le canvas cible si nécessaire
    let targetPointer = pointer;
    if (targetCanvas !== canvas) {
        targetPointer = this.getCorrectedPointer(targetCanvas, o.e);
    }
    
    console.log(`🖱️ [DEBUG] Démarrage du dessin`);
    this.startDrawing(targetCanvas, targetPointer);
}


        handleMouseMove(canvas, o) {
            const pointer = this.getCorrectedPointer(canvas, o.e);
            this.updateGuideShape(pointer);
            canvas.renderAll();
        }

        handleMouseUp(canvas, o, saveCurrentState) {
            this.state.isDrawing = false;
            this.state.drawingCanvas = null; // Nettoyer la référence au canvas de dessin
            const endPoint = this.getCorrectedPointer(canvas, o.e);
            
            if (this.state.guideShape) canvas.remove(this.state.guideShape);
            if (this.state.guideMeasureText) canvas.remove(this.state.guideMeasureText);

            // Validation spécifique pour le mode échelle
            const distance = Math.hypot(endPoint.x - this.state.startPoint.x, endPoint.y - this.state.startPoint.y);
            
            if (this.state.currentMode === 'scale') {
                if (distance < 10) {
                    console.log('📏 [DEBUG] Trait d\'échelle trop court:', distance, 'pixels');
                    alert("Pour calibrer l'échelle, veuillez tracer une ligne d'au moins 10 pixels de long sur une distance connue du plan.");
                    this.resetDrawingState();
                    return;
                }
            } else {
                // Pour les autres modes, seuil normal de 5 pixels
                if (distance < 5) {
                    this.resetDrawingState();
                    return;
                }
            }
            
            // Appeler la bonne méthode selon le mode
            const isDrawingMode = ['draw', 'arrow', 'circle', 'measure', 'baseline'].includes(this.state.currentMode);
            
            if (isDrawingMode) {
                this.finishDrawing(canvas, endPoint, null);
            } else {
                this.finishDrawing(canvas, endPoint, saveCurrentState);
            }
        }

        // MÉTHODE CORRIGÉE : startDrawing avec debug curseur
startDrawing(canvas, pointer) {
    this.state.isDrawing = true;
    this.state.startPoint = pointer;
    this.state.drawingCanvas = canvas; // Mémoriser le canvas de dessin
    
    console.log('🎯 [DEBUG] Début du dessin, mode:', this.state.currentMode);
    
    // Émettre l'événement de changement d'état de dessin
    document.dispatchEvent(new CustomEvent('drawing-state-changed', { 
        detail: { isDrawing: true } 
    }));
    
    // Utiliser la même épaisseur que le trait final pour un alignement parfait
    const finalOptions = this.getDrawOptions();
    const guideOptions = { 
        selectable: false, 
        evented: false, 
        stroke: 'rgba(0,0,0,0.5)', 
        strokeDashArray: [5, 5],
        strokeWidth: finalOptions.strokeWidth
    };
    
    // Créer le guide selon le mode
    switch (this.state.currentMode) {
        case 'measure':
            if (this.state.scaleInfo.ratio === 0) {
                alert("Veuillez d'abord calibrer l'échelle avec l'outil règle (📏) !");
                this.state.isDrawing = false;
                this.state.drawingCanvas = null; // Nettoyer la référence au canvas de dessin
                document.dispatchEvent(new CustomEvent('drawing-state-changed', { 
                    detail: { isDrawing: false } 
                }));
                return;
            }
            // Centrer le trait sur la croix du curseur en ajustant la position Y
            const halfStroke = finalOptions.strokeWidth / 2;
            const adjustedY = pointer.y - halfStroke;
            this.state.guideShape = new fabric.Line([pointer.x, adjustedY, pointer.x, adjustedY], guideOptions);
            canvas.add(this.state.guideShape);
            break;
        case 'scale':
            console.log('📏 [DEBUG] Mode échelle activé');
            this.state.guideShape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], guideOptions);
            canvas.add(this.state.guideShape);
            break;
        case 'circle':
            this.state.guideShape = new fabric.Circle({
                left: pointer.x, top: pointer.y, radius: 0, 
                fill: 'transparent', originX: 'center', originY: 'center', 
                ...guideOptions
            });
            canvas.add(this.state.guideShape);
            break;
        case 'crossing':
        case 'yield':
            this.state.guideShape = new fabric.Rect({
                left: pointer.x, top: pointer.y, width: 0, height: 0, 
                fill: 'transparent', ...guideOptions
            });
            canvas.add(this.state.guideShape);
            break;
        case 'curve':
            // Ajuster le point de départ pour correspondre au début de la courbe dans le curseur
            // Dans le curseur SVG 24x24 centré à (12,12), la courbe commence à (3,17)
            // Donc décalage: x = 3-12 = -9, y = 17-12 = +5
            const adjustedStartX = pointer.x - 9; // Décalage vers la gauche pour correspondre au début de la courbe
            const adjustedStartY = pointer.y + 5; // Décalage vers le bas pour correspondre au début de la courbe
            this.state.startPoint = { x: adjustedStartX, y: adjustedStartY };
            this.state.guideShape = new fabric.Line([adjustedStartX, adjustedStartY, adjustedStartX, adjustedStartY], guideOptions);
            canvas.add(this.state.guideShape);
            break;
        case 'draw':
        case 'arrow':
            // Ajuster le point de départ pour centrer parfaitement avec le curseur en croix
            // Le curseur est centré à (12,12) dans un SVG 24x24, donc aucun ajustement théoriquement nécessaire
            // Mais on teste un petit ajustement pour compenser les arrondis de rendu
            const drawAdjustedX = pointer.x;
            const drawAdjustedY = pointer.y; 
            this.state.startPoint = { x: drawAdjustedX, y: drawAdjustedY };
            this.state.guideShape = new fabric.Line([drawAdjustedX, drawAdjustedY, drawAdjustedX, drawAdjustedY], guideOptions);
            canvas.add(this.state.guideShape);
            break;
        default:
            this.state.guideShape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], guideOptions);
            canvas.add(this.state.guideShape);
            break;
    }
    
    console.log('✅ [DEBUG] Guide créé pour mode:', this.state.currentMode);
}

        createMeasureGuide(canvas, pointer, guideOptions) {
    // ✅ MODIFIÉ : Créer seulement la ligne, pas le texte
    this.state.guideShape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], guideOptions);
    canvas.add(this.state.guideShape);
    // ✅ SUPPRIMÉ : Plus de guideMeasureText
}

updateGuideShape(pointer) {
    const { guideShape, startPoint, currentMode } = this.state;
    
    if (currentMode === 'circle') {
        const radius = Math.hypot(pointer.x - startPoint.x, pointer.y - startPoint.y);
        guideShape.set({ radius: radius });
    } else if (guideShape.type === 'line') {
        if (currentMode === 'baseline') {
            guideShape.set({ x2: pointer.x, y2: startPoint.y });
        } else {
            // Centrer le trait sur la croix du curseur
            const finalOptions = this.getDrawOptions();
            const halfStroke = finalOptions.strokeWidth / 2;
            const adjustedY = pointer.y - halfStroke;
            guideShape.set({ x2: pointer.x, y2: adjustedY });
        }
    } else {
        guideShape.set({ width: pointer.x - startPoint.x, height: pointer.y - startPoint.y });
    }

    // ✅ SUPPRIMÉ : Plus de mise à jour du guideMeasureText pour l'outil mesure
}

        // MÉTHODE CORRIGÉE : finishDrawing avec debug
finishDrawing(canvas, endPoint, saveCurrentState) {
    const { currentMode, startPoint } = this.state;
    
    console.log('🏁 [DEBUG] Fin du dessin, mode:', currentMode);
    
    // Émettre l'événement de fin de dessin
    document.dispatchEvent(new CustomEvent('drawing-state-changed', { 
        detail: { isDrawing: false } 
    }));
    
    // Traitement selon le mode (code existant...)
    switch (currentMode) {
        case 'draw':
            this.createLine(canvas, startPoint, endPoint);
            break;
        case 'arrow':
            this.createArrow(canvas, startPoint, endPoint);
            break;
        case 'circle':
            this.createCircle(canvas, startPoint, endPoint);
            break;
        case 'curve':
            document.dispatchEvent(new CustomEvent('create-curved-path', { 
                detail: { start: startPoint, end: endPoint } 
            }));
            this.state.setCurrentMode('select');
            break;
        case 'crossing':
            document.dispatchEvent(new CustomEvent('handle-crossing-draw', { 
                detail: { rect: this.state.guideShape } 
            }));
            break;
        case 'yield':
            document.dispatchEvent(new CustomEvent('handle-yield-draw', { 
                detail: { rect: this.state.guideShape } 
            }));
            break;
        case 'scale':
            console.log('📏 [DEBUG] Traitement de l\'échelle');
            const pixels = Math.hypot(startPoint.x - endPoint.x, startPoint.y - endPoint.y);
            document.dispatchEvent(new CustomEvent('handle-scale', { 
                detail: { pixels: pixels } 
            }));
            break;
        case 'measure':
            this.createMeasurement(canvas, startPoint, endPoint);
            break;
        case 'baseline':
            document.dispatchEvent(new CustomEvent('handle-baseline-draw', { 
                detail: { start: startPoint, end: { x: endPoint.x, y: startPoint.y } } 
            }));
            break;
        case 'skid-mark':
            document.dispatchEvent(new CustomEvent('handle-skid-mark-draw', { 
                detail: { start: startPoint, end: endPoint } 
            }));
            break;
    }

    if (currentMode !== 'scale') {
        this.reorderObjectsOnCanvas(canvas);
    }
    
    this.resetDrawingState();
    
    // Sauvegarde gérée individuellement par chaque méthode de création
    // Ne plus sauvegarder automatiquement ici pour éviter les doublons

    const persistentTools = ['draw', 'circle', 'arrow'];
    if (!persistentTools.includes(currentMode)) {
        // Pour le mode 'scale', retarder le changement de mode pour permettre 
        // à handleScale() de gérer les erreurs et maintenir le mode si nécessaire
        if (currentMode === 'scale') {
            // Le changement de mode sera géré par handleScale() en cas de succès
            // ou resetScaleDrawingState() en cas d'erreur
            console.log('🔄 [DEBUG] Mode scale - changement de mode différé');
        } else {
            this.state.setCurrentMode('select');
        }
    }
    
    console.log('✅ [DEBUG] Fin du dessin terminée');
}

        createLine(canvas, start, end) {
            // S'assurer que le guide est complètement supprimé
            if (this.state.guideShape) {
                canvas.remove(this.state.guideShape);
                this.state.guideShape = null;
                canvas.renderAll(); // Forcer le rendu pour supprimer visuellement le guide
            }
            
            const options = this.getDrawOptions();
            
            // Calculer l'extension pour recouvrir le trait de prévisualisation
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.hypot(dx, dy);
            
            // Respecter exactement la longueur tracée par l'utilisateur
            // Centrer le trait sur la croix du curseur
            const halfStroke = options.strokeWidth / 2;
            const adjustedStartY = start.y - halfStroke;
            const adjustedEndY = end.y - halfStroke;
            
            const line = new fabric.Line([start.x, adjustedStartY, end.x, adjustedEndY], {
                ...options,
                strokeLineCap: 'round'
            });
            canvas.add(line);
            
            // Sauvegarder l'état APRÈS la création de la ligne
            const layer = this.state.layers.find(l => l.fabricCanvas === canvas);
            this.layerManager.undoRedoManager.saveState(canvas, layer);
        }

        createArrow(canvas, start, end) {
            // S'assurer que le guide est complètement supprimé
            if (this.state.guideShape) {
                canvas.remove(this.state.guideShape);
                this.state.guideShape = null;
                canvas.renderAll(); // Forcer le rendu pour supprimer visuellement le guide
            }
            
            const options = this.getDrawOptions();
            
            // Calculer l'angle et la longueur de la flèche
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            
            // Taille de la pointe de flèche (proportionnelle à l'épaisseur)
            const headLength = Math.max(15, options.strokeWidth * 5);
            const headAngle = Math.PI / 6; // 30 degrés
            
            // Centrer la flèche sur la croix du curseur
            const halfStroke = options.strokeWidth / 2;
            const adjustedStartY = start.y - halfStroke;
            const adjustedEndY = end.y - halfStroke;
            
            // Créer la ligne principale
            const shaft = new fabric.Line([start.x, adjustedStartY, end.x, adjustedEndY], {
                ...options,
                strokeLineCap: 'round'
            });
            
            // Créer les deux lignes de la pointe (ajustées)
            const headLeft = new fabric.Line([
                end.x,
                adjustedEndY,
                end.x - headLength * Math.cos(angle - headAngle),
                adjustedEndY - headLength * Math.sin(angle - headAngle)
            ], {
                ...options,
                strokeLineCap: 'round'
            });
            
            const headRight = new fabric.Line([
                end.x,
                adjustedEndY,
                end.x - headLength * Math.cos(angle + headAngle),
                adjustedEndY - headLength * Math.sin(angle + headAngle)
            ], {
                ...options,
                strokeLineCap: 'round'
            });
            
            // Grouper tous les éléments de la flèche
            const arrow = new fabric.Group([shaft, headLeft, headRight], {
                selectable: true,
                evented: true
            });
            
            canvas.add(arrow);
            
            // Sauvegarder l'état APRÈS la création de la flèche
            const layer = this.state.layers.find(l => l.fabricCanvas === canvas);
            this.layerManager.undoRedoManager.saveState(canvas, layer);
        }

        createCircle(canvas, start, end) {
            const radius = Math.hypot(end.x - start.x, end.y - start.y);
            const options = this.getDrawOptions();
            const circle = new fabric.Circle({
                left: start.x, top: start.y, radius: radius,
                originX: 'center', originY: 'center',
                ...options
            });
            canvas.add(circle);
            
            // Sauvegarder l'état APRÈS la création du cercle
            const layer = this.state.layers.find(l => l.fabricCanvas === canvas);
            this.layerManager.undoRedoManager.saveState(canvas, layer);
            
            // Sélectionner automatiquement l'outil sélectionner objet
            document.dispatchEvent(new CustomEvent('auto-select-tool'));
        }

        createMeasurement(canvas, start, end) {
            const finalMeasureLine = new fabric.Line([start.x, start.y, end.x, end.y]);
            document.dispatchEvent(new CustomEvent('handle-measure', { 
                detail: { start, end, line: finalMeasureLine } 
            }));
        }

        createTextZone(canvas, pointer, saveCurrentState) {
            console.log('DEBUG: Début de createTextZone');
            const colorPicker = document.getElementById('color-picker-text');
            
            try {
                const text = new fabric.Textbox('Ecris ici', {
                    left: pointer.x,
                    top: pointer.y,
                    width: 150,
                    fontSize: 20,
                    fill: colorPicker.value,
                    fontFamily: 'sans-serif',
                    padding: 10,
                    originX: 'left',
                    originY: 'top',
                    selectable: true,
                    evented: true,
                    editable: true,
                    hasControls: true,
                    hasBorders: true,
                    lockMovementX: false,
                    lockMovementY: false,
                    moveCursor: 'move',
                    hoverCursor: 'move',
                    movingCursor: 'move',
                    // Propriétés additionnelles pour assurer la sélection
                    lockScalingX: false,
                    lockScalingY: false,
                    lockRotation: false,
                    transparentCorners: false,
                    cornerColor: '#007aff',
                    cornerStyle: 'circle',
                    borderColor: '#007aff',
                    borderScaleFactor: 1.5
                });
                console.log('DEBUG: Textbox créé avec succès');
                
                console.log('DEBUG: Ajout du contrôle de suppression');
                text.controls.deleteControl = new fabric.Control({
                    x: 0.5, 
                    y: -0.5, 
                    offsetX: 16, 
                    offsetY: -16,
                    cursorStyle: 'pointer',
                    mouseUpHandler: (eventData, transform) => {
                        const target = transform.target;
                        const canvas = target.canvas;
                        canvas.remove(target);
                        canvas.requestRenderAll();
                        return true;
                    },
                    render: this.renderDeleteIcon
                });
                console.log('DEBUG: Contrôle de suppression ajouté');
                
                console.log('DEBUG: Ajout des événements modified');
                text.on('modified', () => {
                    saveCurrentState();
                });
                console.log('DEBUG: Événement modified ajouté');
                
                console.log('DEBUG: Ajout des événements editing:entered');
                // Gérer l'entrée en édition pour afficher les contrôles de texte
                text.on('editing:entered', () => {
                    this.showTextControls(text);
                });
                console.log('DEBUG: Événement editing:entered ajouté');

                console.log('DEBUG: Ajout des événements editing:exited');
                // Gérer la sortie d'édition pour changer de mode et cacher les contrôles
                text.on('editing:exited', () => {
                    // Délai avant de masquer les contrôles pour permettre les clics sur les boutons
                    setTimeout(() => {
                        this.hideTextControls();
                        
                        // Ne changer le mode que si on n'est pas déjà en mode select
                        const currentMode = this.state.toolsManager?.currentMode || 
                                         window.PlanEditor?.instances?.toolsManager?.currentMode;
                        
                        if (currentMode !== 'select') {
                            if (this.state.toolsManager) {
                                this.state.toolsManager.setMode('select');
                            } else {
                                const globalToolsManager = window.PlanEditor?.instances?.toolsManager;
                                if (globalToolsManager) {
                                    globalToolsManager.setMode('select');
                                }
                            }
                        }
                    }, 100);
                });
                console.log('DEBUG: Événement editing:exited ajouté');
            
                console.log('DEBUG: Ajout du texte au canvas');
                canvas.add(text);
                console.log('DEBUG: Texte ajouté au canvas');
                
                console.log('DEBUG: Rendu du canvas');
                canvas.requestRenderAll();
                console.log('DEBUG: Canvas rendu');
                
                // Définir l'objet actif après le rendu
                console.log('DEBUG: Définition de l\'objet actif');
                try {
                    // S'assurer que le texte est correctement ajouté avant de le sélectionner
                    if (canvas.getObjects().includes(text)) {
                        canvas.setActiveObject(text);
                        console.log('DEBUG: Objet actif défini avec succès');
                    } else {
                        console.log('DEBUG: Texte non trouvé dans les objets du canvas');
                    }
                } catch (error) {
                    console.error('DEBUG: Erreur lors de la définition de l\'objet actif:', error);
                    console.log('DEBUG: Tentative de sélection sans setActiveObject');
                }
            
            // Changer vers le mode select après création, mais les options de texte resteront visibles pendant l'édition
            console.log('DEBUG: Changement de mode vers select après création');
            if (this.state.toolsManager) {
                this.state.toolsManager.setMode('select');
            } else {
                const globalToolsManager = window.PlanEditor?.instances?.toolsManager;
                if (globalToolsManager) {
                    globalToolsManager.setMode('select');
                }
            }
            
            // Entrer automatiquement en mode édition et sélectionner tout le texte
            console.log('DEBUG: Début du setTimeout pour enterEditing');
            setTimeout(() => {
                console.log('DEBUG: Appel de enterEditing');
                text.enterEditing();
                console.log('DEBUG: enterEditing terminé');
                
                // Sélectionner tout le texte
                setTimeout(() => {
                    console.log('DEBUG: Sélection du texte');
                    text.selectionStart = 0;
                    text.selectionEnd = text.text.length;
                    text.selectAll();
                    canvas.requestRenderAll();
                    console.log('DEBUG: Sélection du texte terminée');
                }, 50);
            }, 100);
            
            console.log('DEBUG: Sauvegarde de l\'état après création du texte');
            saveCurrentState();
            console.log('DEBUG: Sauvegarde terminée, fin de createTextZone');
            
            } catch (error) {
                console.error('Erreur lors de la création du texte:', error);
            }
        }

        // Ancienne fonction addTextAtPointer supprimée - remplacée par createTextZone

        getDrawOptions() {
            // ✅ FIX : Selon le mode actif, utiliser les bons sélecteurs
            const isShapeTool = ['crossing', 'yield', 'skid-mark'].includes(this.state.currentMode);
            const isBaseline = this.state.currentMode === 'baseline';

            // Pour les outils formes, utiliser les sélecteurs de forme
            const colorPickerId = isShapeTool ? 'color-picker-shape' : 'color-picker';
            const thicknessSelectorId = isShapeTool ? 'thickness-selector-shape' : 'thickness-selector';

            const colorPicker = document.getElementById(colorPickerId);
            const thicknessSelector = document.getElementById(thicknessSelectorId);
            const dashedCheckbox = document.getElementById('dashed-checkbox');
            const dashSpacingSelector = document.getElementById('dash-spacing-selector');

            // ✅ FIX : Pour baseline, utiliser le rouge par défaut
            let color = colorPicker ? colorPicker.value : '#000000';
            if (isBaseline) {
                color = '#ff0000'; // Rouge pour la ligne de base
            }

            // ✅ FIX : S'assurer que l'épaisseur par défaut est bien définie (trait fin = 2)
            let strokeWidth = 2; // Valeur par défaut
            if (thicknessSelector) {
                strokeWidth = parseInt(thicknessSelector.value, 10);
            }

            const desiredStrokeWidth = strokeWidth;
            const normalizedStrokeWidth = desiredStrokeWidth;

            let dashArray = [];
            if (dashedCheckbox && dashedCheckbox.checked) {
                const spacingMultiplier = parseInt(dashSpacingSelector.value, 10);
                dashArray = [normalizedStrokeWidth * spacingMultiplier, normalizedStrokeWidth * spacingMultiplier];
            }

            return {
                stroke: color,
                strokeWidth: normalizedStrokeWidth,
                strokeDashArray: dashArray,
                objectCaching: false,
                selectable: true,
                evented: true,
                fill: 'transparent'
            };
        }

        resetDrawingState() {
    this.state.guideShape = null;
    this.state.guideMeasureText = null; // ✅ S'assurer que c'est bien réinitialisé
    this.state.isDrawing = false; // ✅ Réinitialiser l'état de dessin
    this.state.startPoint = null; // ✅ Nettoyer le point de départ
}

        // MÉTHODE CORRIGÉE : cancelLineDraw avec debug
cancelLineDraw() {
    console.log('❌ [DEBUG] Annulation du dessin');
    
    const canvas = this.state.getActiveCanvas();
    if (this.state.guideShape && canvas) {
        canvas.remove(this.state.guideShape);
    }
    if (this.state.guideMeasureText && canvas) {
        canvas.remove(this.state.guideMeasureText);
    }
    this.state.isDrawing = false;
    this.state.drawingCanvas = null; // Nettoyer la référence au canvas de dessin
    
    // Émettre l'événement d'annulation du dessin
    document.dispatchEvent(new CustomEvent('drawing-state-changed', { 
        detail: { isDrawing: false } 
    }));
    
    this.resetDrawingState();
    console.log('✅ [DEBUG] Annulation terminée');
}
		
setupFabricCursors(canvas) {
    if (!canvas) return;
    
    console.log('🎨 [DEBUG] Configuration curseurs Fabric.js - Mode CSS uniquement');
    
    // Forcer TOUS les curseurs Fabric.js à 'inherit' pour utiliser le CSS
    canvas.defaultCursor = 'inherit';
    canvas.freeDrawingCursor = 'inherit';
    canvas.moveCursor = 'inherit';
    canvas.rotationCursor = 'inherit';
    canvas.hoverCursor = 'inherit';
    
    // Ne PAS mettre de logique de curseurs - laisser le CSS tout gérer
    
    // Appliquer immédiatement
    canvas.setCursor('inherit');
    
    console.log('✅ [DEBUG] Tous les curseurs Fabric forcés à inherit');
}

setupSelectionEvents(canvas) {
    // Intercepter la création d'activeSelection au niveau global
    const originalActiveSelection = fabric.ActiveSelection;
    fabric.ActiveSelection = class extends originalActiveSelection {
        constructor(objects, options) {
            super(objects, options);
            
            // Vérifier si cette activeSelection contient baseline et zeroPoint
            const hasBaseline = objects.some(obj => obj.isBaseline);
            const hasZeroPoint = objects.some(obj => obj.isZeroPoint);
            
            if (hasBaseline && hasZeroPoint) {
                console.log('🎯 [GLOBAL INTERCEPT] ActiveSelection avec baseline+zeroPoint créée');
                
                // Forcer hasControls à false et ne garder que deleteControl
                this.hasControls = true;
                this.controls = { deleteControl: this.controls.deleteControl };
                this.setControlsVisibility({
                    bl: false, br: false, mb: false, ml: false, mr: false, mt: false, tl: false, tr: false,
                    mtr: false,
                    deleteControl: true
                });
                
                // Intercepter drawControls
                this.drawControls = function(ctx, styleOverride) {
                    console.log('🎯 [GLOBAL INTERCEPT] drawControls intercepté');
                    if (this.controls && this.controls.deleteControl) {
                        const deleteControl = this.controls.deleteControl;
                        const wh = this._calculateCurrentDimensions();
                        const width = wh.x;
                        const height = wh.y;
                        const left = -width / 2;
                        const top = -height / 2;
                        deleteControl.render(ctx, left + width + 16, top - 16, styleOverride, this);
                    }
                };
            }
        }
    };
    
    console.log('🎯 [GLOBAL INTERCEPT] ActiveSelection interceptée globalement');
    // Appliquer les styles personnalisés pour les éléments de projection
    const applyMeasurementSelectionStyle = (target) => {
        if (target && target.isProjectionElement && target.type === 'text') {
            target.set({
                backgroundColor: 'rgba(255, 255, 0, 0.6)',
                hasBorders: false,
            });
            target.setControlsVisibility({
                mtr: false, ml: false, mr: false, mt: false, mb: false, 
                tl: false, tr: false, bl: false, br: false
            });
        }
    };

    const clearMeasurementSelectionStyle = (target) => {
        if (target && target.isProjectionElement && target.type === 'text') {
            target.set({ backgroundColor: 'rgba(255,255,255,1.0)' });
        }
    };

    // Événements de sélection
    canvas.on('selection:created', (e) => {
        if (this.state.isLoadingState) return;
        
        // Vérifier si c'est une activeSelection avec baseline/zeroPoint
        const target = e.target;
        if (target && target.type === 'activeSelection' && target._objects) {
            const hasSpecialObjects = target._objects.some(obj => obj.isBaseline || obj.isZeroPoint);
            if (hasSpecialObjects) {
                console.log('🎯 [ACTIVE SELECTION DEBUG] ActiveSelection avec objets spéciaux détectée');
                console.log('🎯 [ACTIVE SELECTION DEBUG] hasControls avant:', target.hasControls);
                
                // Masquer tous les contrôles sauf la croix - nouvelle approche
                target.hasControls = true; // Garder les contrôles activés
                target.setControlsVisibility({
                    bl: false, br: false, mb: false, ml: false, mr: false, mt: false, tl: false, tr: false,
                    mtr: false, // rotation
                    deleteControl: true // Garder seulement la croix
                });
                
                // Supprimer physiquement les contrôles indésirables
                const controlsToKeep = { deleteControl: target.controls.deleteControl };
                target.controls = controlsToKeep;
                
                // Méthode radicale : intercepter le rendu des contrôles
                const originalDrawControls = target.drawControls;
                target.drawControls = function(ctx, styleOverride) {
                    console.log('🎯 [RENDER INTERCEPT] Intercept drawControls pour activeSelection');
                    // Ne rendre que le deleteControl
                    if (this.controls && this.controls.deleteControl) {
                        const deleteControl = this.controls.deleteControl;
                        // Calculer la position du deleteControl
                        const wh = this._calculateCurrentDimensions();
                        const width = wh.x;
                        const height = wh.y;
                        const left = -width / 2;
                        const top = -height / 2;
                        
                        // Rendre seulement le deleteControl
                        deleteControl.render(ctx, left + width + 16, top - 16, styleOverride, this);
                    }
                };
                
                // Forcer le rendu du canvas pour appliquer les changements
                canvas.requestRenderAll();
                
                console.log('🎯 [ACTIVE SELECTION DEBUG] hasControls après:', target.hasControls);
                console.log('🎯 [ACTIVE SELECTION DEBUG] Contrôles masqués pour activeSelection');
            }
        }
        
        if (e.selected) {
            e.selected.forEach(obj => {
                applyMeasurementSelectionStyle(obj);
                // Forcer la suppression des contrôles pour la ligne de base et le point zéro individuels
                if (obj.isBaseline || obj.isZeroPoint) {
                    console.log('🎯 [SELECTION DEBUG] Objet spécial sélectionné:', obj.isBaseline ? 'baseline' : 'zeroPoint');
                    console.log('🎯 [SELECTION DEBUG] hasControls avant:', obj.hasControls);
                    console.log('🎯 [SELECTION DEBUG] Controls avant:', Object.keys(obj.controls || {}));
                    
                    obj.hasControls = false;
                    obj.controls = {};
                    obj.setControlsVisibility({
                        bl: false, br: false, mb: false, ml: false, mr: false, mt: false, tl: false, tr: false,
                        deleteControl: false
                    });
                    
                    console.log('🎯 [SELECTION DEBUG] hasControls après:', obj.hasControls);
                    console.log('🎯 [SELECTION DEBUG] Controls après:', Object.keys(obj.controls || {}));
                }
            });
        }
        document.dispatchEvent(new CustomEvent('object-selection-changed'));
    });

    canvas.on('selection:updated', (e) => {
        if (this.state.isLoadingState) return;
        if (e.deselected) e.deselected.forEach(clearMeasurementSelectionStyle);
        
        // Vérifier si c'est une activeSelection avec baseline/zeroPoint
        const target = e.target;
        if (target && target.type === 'activeSelection' && target._objects) {
            const hasSpecialObjects = target._objects.some(obj => obj.isBaseline || obj.isZeroPoint);
            if (hasSpecialObjects) {
                console.log('🎯 [ACTIVE SELECTION DEBUG] ActiveSelection avec objets spéciaux détectée (updated)');
                console.log('🎯 [ACTIVE SELECTION DEBUG] hasControls avant:', target.hasControls);
                
                // Masquer tous les contrôles sauf la croix - nouvelle approche
                target.hasControls = true; // Garder les contrôles activés
                target.setControlsVisibility({
                    bl: false, br: false, mb: false, ml: false, mr: false, mt: false, tl: false, tr: false,
                    mtr: false, // rotation
                    deleteControl: true // Garder seulement la croix
                });
                
                // Supprimer physiquement les contrôles indésirables
                const controlsToKeep = { deleteControl: target.controls.deleteControl };
                target.controls = controlsToKeep;
                
                // Méthode radicale : intercepter le rendu des contrôles
                const originalDrawControls = target.drawControls;
                target.drawControls = function(ctx, styleOverride) {
                    console.log('🎯 [RENDER INTERCEPT] Intercept drawControls pour activeSelection (updated)');
                    // Ne rendre que le deleteControl
                    if (this.controls && this.controls.deleteControl) {
                        const deleteControl = this.controls.deleteControl;
                        // Calculer la position du deleteControl
                        const wh = this._calculateCurrentDimensions();
                        const width = wh.x;
                        const height = wh.y;
                        const left = -width / 2;
                        const top = -height / 2;
                        
                        // Rendre seulement le deleteControl
                        deleteControl.render(ctx, left + width + 16, top - 16, styleOverride, this);
                    }
                };
                
                // Forcer le rendu du canvas pour appliquer les changements
                canvas.requestRenderAll();
                
                console.log('🎯 [ACTIVE SELECTION DEBUG] hasControls après:', target.hasControls);
                console.log('🎯 [ACTIVE SELECTION DEBUG] Contrôles masqués pour activeSelection (updated)');
            }
        }
        
        if (e.selected) {
            e.selected.forEach(obj => {
                applyMeasurementSelectionStyle(obj);
                // Forcer la suppression des contrôles pour la ligne de base et le point zéro individuels
                if (obj.isBaseline || obj.isZeroPoint) {
                    console.log('🎯 [SELECTION DEBUG] Objet spécial sélectionné:', obj.isBaseline ? 'baseline' : 'zeroPoint');
                    console.log('🎯 [SELECTION DEBUG] hasControls avant:', obj.hasControls);
                    console.log('🎯 [SELECTION DEBUG] Controls avant:', Object.keys(obj.controls || {}));
                    
                    obj.hasControls = false;
                    obj.controls = {};
                    obj.setControlsVisibility({
                        bl: false, br: false, mb: false, ml: false, mr: false, mt: false, tl: false, tr: false,
                        deleteControl: false
                    });
                    
                    console.log('🎯 [SELECTION DEBUG] hasControls après:', obj.hasControls);
                    console.log('🎯 [SELECTION DEBUG] Controls après:', Object.keys(obj.controls || {}));
                }
            });
        }
        document.dispatchEvent(new CustomEvent('object-selection-changed'));
    });

    canvas.on('selection:cleared', (e) => {
        if (this.state.isLoadingState) return;
        if (e.deselected) e.deselected.forEach(clearMeasurementSelectionStyle);
        document.dispatchEvent(new CustomEvent('object-selection-changed'));
    });
}


 		
        // Gestion des événements d'objets
        handleObjectMoving(canvas, e) {
            const obj = e.target;
            if (obj.isControlPoint && obj.path) {
                obj.path.path[1][1] = obj.left;
                obj.path.path[1][2] = obj.top;
            }
            if (obj.isZeroPoint) {
                // Marquer que le point zéro est déplacé par l'utilisateur
                obj.isBeingMovedByUser = true;
                
                const baseline = canvas.getObjects().find(o => o.isBaseline);
                if (baseline) {
                    // Forcer le point zéro à rester sur la ligne de base (même hauteur)
                    obj.set('top', baseline.top);
                    
                    // Limiter le déplacement horizontal aux limites de la ligne de base
                    let newLeft = obj.left;
                    const baselineLeft = baseline.left;
                    const baselineRight = baseline.left + baseline.width;
                    
                    if (newLeft < baselineLeft) {
                        newLeft = baselineLeft;
                        console.log('🚫 Point zéro limité au début de la ligne de base (souris)');
                    } else if (newLeft > baselineRight) {
                        newLeft = baselineRight;
                        console.log('🚫 Point zéro limité à la fin de la ligne de base (souris)');
                    }
                    
                    if (newLeft !== obj.left) {
                        obj.set('left', newLeft);
                    }
                    
                    // Mettre à jour la position relative du point zéro quand il est déplacé
                    const currentPosition = (newLeft - baselineLeft) / baseline.width;
                    obj.baselineRelativePosition = Math.max(0, Math.min(1, currentPosition));
                }
            }
            if (obj.isBaseline) {
                const zeroPoint = canvas.getObjects().find(o => o.isZeroPoint);
                if (zeroPoint && !zeroPoint.isBeingMovedByUser) {
                    // Maintenir le point zéro sur la ligne de base pendant le déplacement
                    // Calculer la position relative du point zéro sur la ligne de base
                    const baselineLeft = obj.left;
                    const baselineRight = obj.left + obj.width;
                    
                    // Si le point zéro n'a pas de position relative stockée, la calculer
                    if (zeroPoint.baselineRelativePosition === undefined) {
                        const currentPosition = (zeroPoint.left - baselineLeft) / obj.width;
                        zeroPoint.baselineRelativePosition = Math.max(0, Math.min(1, currentPosition));
                    }
                    
                    // Repositionner le point zéro selon sa position relative
                    const newZeroLeft = baselineLeft + (zeroPoint.baselineRelativePosition * obj.width);
                    zeroPoint.set({
                        left: newZeroLeft,
                        top: obj.top
                    });
                }
            }
            
        }

        handleObjectModified(canvas, e, saveCurrentState) {
    const obj = e.target;
    console.log('🔍 [UNDO DEBUG] object:modified appelé pour objet:', obj.type);
    
    if (obj && obj.isControlPoint) {
        if (obj.path) {
            canvas.remove(obj.path.controlHandle);
            obj.path.controlHandle = null;
            canvas.remove(obj);
            canvas.renderAll();
        }
    } else if (obj && (obj.isVehicle || obj.isBaseline || obj.isZeroPoint || obj.isLandmark)) {
        // Réinitialiser le flag de déplacement utilisateur pour le point zéro
        if (obj.isZeroPoint) {
            obj.isBeingMovedByUser = false;
        }
        
        // Si c'est un véhicule, on s'assure que le flag hasJustMoved est actif
        // pour que update-all-projections sache qu'il faut réinitialiser les mesures
        if (obj.isVehicle) {
            obj.hasJustMoved = true;
            setTimeout(() => {
                obj.hasJustMoved = false;
            }, 200);
        }
        
        document.dispatchEvent(new CustomEvent('update-all-projections'));
    }
    this.reorderObjectsOnCanvas(canvas);
    canvas.renderAll();
    
    // ✅ MODIFIÉ : Forcer la sauvegarde pour les modifications importantes
    // MAIS pas pendant que nous sommes en train de dessiner OU dans un mode de dessin (pour éviter les doublons)
    const isInDrawingMode = ['draw', 'arrow', 'circle', 'curve', 'scale', 'measure', 'baseline'].includes(this.state.currentMode);
    const isControlPointModification = obj && obj.isControlPoint;
    const isCurvePathModification = obj && obj.type === 'path' && obj.controlHandle;
    
    console.log('🎯 [FORCE SAVE DEBUG] Vérification conditions:', {
        isDrawing: this.state.isDrawing,
        isInDrawingMode,
        isCreatingCurve: this.state.isCreatingCurve,
        isControlPointModification,
        isCurvePathModification,
        objectType: obj?.type,
        objectIsControlPoint: obj?.isControlPoint
    });
    
    if (!this.state.isDrawing && !isInDrawingMode && !this.state.isCreatingCurve && !isControlPointModification && !isCurvePathModification) {
        console.log('🎯 [FORCE SAVE DEBUG] Conditions remplies - ForceSave déclenché');
        const layer = this.state.layers.find(l => l.fabricCanvas === canvas);
        if (layer && this.layerManager.undoRedoManager) {
            this.layerManager.undoRedoManager.forceSave(canvas, layer);
        }
    } else {
        console.log('🎯 [FORCE SAVE DEBUG] Conditions NOT remplies - ForceSave bloqué');
    }
}
        handleObjectRemoved(canvas, e, saveCurrentState) {
    const removedObj = e.target;
    let objectsToRemove = [];

    if (removedObj.isBaseline) {
        // Vérifier s'il y a des objets liés à la ligne de base (seulement véhicules et repères)
        const linkedObjects = canvas.getObjects().filter(o => 
            o.isLandmark || o.isVehicle
        );
        
        
        if (linkedObjects.length > 0) {
            const confirmed = confirm("Cette action supprimera la ligne de base existante ainsi que tous les véhicules, repères et mesures associés. Voulez-vous continuer ?");
            if (confirmed) {
                // Inclure tous les objets liés pour la suppression
                objectsToRemove = canvas.getObjects().filter(o => 
                    o.isZeroPoint || o.isProjectionElement || o.isLandmark || o.isVehicle
                );
                document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
                
                // Mettre à jour l'état des contrôles des repères après suppression de la ligne de base
                if (window.PlanEditor.instances && window.PlanEditor.instances.uiManager) {
                    setTimeout(() => {
                        window.PlanEditor.instances.uiManager.updateLandmarkControlsState();
                    }, 100);
                }
            } else {
                // Annuler la suppression en réajoutant l'objet
                setTimeout(() => {
                    canvas.add(removedObj);
                    canvas.renderAll();
                }, 10);
                return; // Arrêter le traitement
            }
        } else {
            // Si aucun objet lié, supprimer quand même le point zéro et les éléments de projection
            objectsToRemove = canvas.getObjects().filter(o => 
                o.isZeroPoint || o.isProjectionElement
            );
            
            // Déclencher la mise à jour de l'interface même s'il n'y a pas d'objets liés
            document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
            
            // Mettre à jour l'état des contrôles des repères après suppression de la ligne de base
            if (window.PlanEditor.instances && window.PlanEditor.instances.uiManager) {
                setTimeout(() => {
                    window.PlanEditor.instances.uiManager.updateLandmarkControlsState();
                }, 100);
            }
        }
    }
    else if (removedObj.isVehicle && removedObj.id) {
        objectsToRemove = canvas.getObjects().filter(
            obj => obj.isProjectionElement && obj.projectionVehicleId === removedObj.id
        );
    }
    else if (removedObj.isLandmark && removedObj.id) {
        objectsToRemove = canvas.getObjects().filter(
            obj => obj.isProjectionElement && obj.projectionLandmarkId === removedObj.id
        );
    }
    else if (removedObj.isProjectionElement && removedObj.projectionId) {
        // ✅ MODIFIÉ : Gestion spécifique selon le type de projection supprimée
        
        if (removedObj.projectionRole === 'ordinate' || removedObj.projectionRole === 'abscissa') {
            // Si c'est un texte de mesure spécifique, ne supprimer que ce texte
            // Ne pas supprimer les autres éléments de la projection
            console.log(`🗑️ Suppression uniquement du texte ${removedObj.projectionRole}`);
            
            // Marquer le coin comme supprimé pour les véhicules
            if (removedObj.projectionVehicleId && removedObj.projectionCorner) {
                const vehicle = canvas.getObjects().find(o => o.id === removedObj.projectionVehicleId);
                if (vehicle) {
                    if (!vehicle.suppressedCorners) {
                        vehicle.suppressedCorners = [];
                    }
                    // Ajouter le rôle spécifique au coin supprimé
                    const suppressedKey = `${removedObj.projectionCorner}_${removedObj.projectionRole}`;
                    if (!vehicle.suppressedCorners.includes(suppressedKey)) {
                        vehicle.suppressedCorners.push(suppressedKey);
                    }
                }
            }
        } else {
            // Si c'est la ligne ou la projection complète, supprimer tout
            const idToRemove = removedObj.projectionId;
            objectsToRemove = canvas.getObjects().filter(
                obj => obj.projectionId === idToRemove && obj !== removedObj
            );
            
            if (removedObj.projectionVehicleId && removedObj.projectionCorner) {
                const vehicle = canvas.getObjects().find(o => o.id === removedObj.projectionVehicleId);
                if (vehicle) {
                    if (!vehicle.suppressedCorners) {
                        vehicle.suppressedCorners = [];
                    }
                    if (!vehicle.suppressedCorners.includes(removedObj.projectionCorner)) {
                        vehicle.suppressedCorners.push(removedObj.projectionCorner);
                    }
                }
            }
        }
    }
    else if (removedObj.isMeasurement && removedObj.measureId) {
        if (this.state.isCleaningUpMeasure) return;
        this.state.isCleaningUpMeasure = true;
        const siblings = canvas.getObjects().filter(obj => obj.measureId === removedObj.measureId && obj !== removedObj);
        if (siblings.length > 0) {
            canvas.remove(...siblings);
        }
        this.state.isCleaningUpMeasure = false;
    }

    if (objectsToRemove.length > 0) {
        this.state.isCleaningUpProjections = true;
        const uniqueObjectsToRemove = [...new Set(objectsToRemove)];
        canvas.remove(...uniqueObjectsToRemove);
        this.state.isCleaningUpProjections = false;
    }

    this.reorderObjectsOnCanvas(canvas);
    
    // Forcer la sauvegarde pour les suppressions importantes
    // MAIS pas pendant que nous sommes en train de dessiner OU dans un mode de dessin (pour éviter les doublons)
    const isInDrawingMode = ['draw', 'arrow', 'circle', 'curve', 'scale', 'measure', 'baseline'].includes(this.state.currentMode);
    const layer = this.state.layers.find(l => l.fabricCanvas === canvas);
    if (layer && this.layerManager.undoRedoManager && !this.state.isDrawing && !isInDrawingMode && !this.state.isCreatingCurve && !this.state.isModifyingControlPoint) {
        console.log('🎯 [REMOVE DEBUG] ForceSave après suppression');
        this.layerManager.undoRedoManager.forceSave(canvas, layer);
    } else {
        console.log('🎯 [REMOVE DEBUG] ForceSave suppression bloqué - création courbe, mode dessin ou modification point contrôle');
    }
    
    // Mettre à jour l'état des contrôles des repères si un repère a été supprimé
    if (removedObj.isLandmark && this.uiManager) {
        this.uiManager.updateLandmarkControlsState();
    }
    }

        reorderObjectsOnCanvas(canvas) {
            if (!canvas) return;
            
            // DÉSACTIVÉ : La réorganisation automatique interfère avec les changements d'ordre manuels
            // Ne réorganiser que les objets spéciaux qui doivent vraiment être dans un ordre spécifique
            const specialObjects = canvas.getObjects().filter(obj => 
                obj.isProjectionElement || obj.isMeasurement || obj.isScaleBar
            );
            
            // Remettre seulement les objets spéciaux au premier plan
            specialObjects.forEach(obj => canvas.bringToFront(obj));
            
            // Rendu léger sans réorganisation complète
            canvas.renderAll();
        }

        showTextControls(textObject) {
            // Cacher les autres options d'outils pendant l'édition de texte
            const drawingOptions = document.getElementById('drawing-options-tools');
            const shapeOptions = document.getElementById('shape-options-tools');
            const fillOptions = document.getElementById('fill-options-tools');
            
            if (drawingOptions) drawingOptions.style.display = 'none';
            if (shapeOptions) shapeOptions.style.display = 'none';
            if (fillOptions) fillOptions.style.display = 'none';
            
            // Afficher les contrôles de texte
            const textOptionsTools = document.getElementById('text-options-tools');
            if (textOptionsTools) {
                textOptionsTools.style.display = 'flex';
                
                // Réactiver les contrôles (supprimer les classes disabled)
                textOptionsTools.classList.remove('disabled');
                const allControls = textOptionsTools.querySelectorAll('select, button, input');
                allControls.forEach(control => {
                    control.disabled = false;
                    control.style.pointerEvents = 'auto';
                    control.style.opacity = '1';
                });
                
                // Configurer les valeurs initiales
                const fontFamilySelector = document.getElementById('font-family-selector');
                const fontSizeSelector = document.getElementById('font-size-selector');
                const fontBoldBtn = document.getElementById('font-bold-btn');
                const fontItalicBtn = document.getElementById('font-italic-btn');
                const fontUnderlineBtn = document.getElementById('font-underline-btn');
                const colorPickerText = document.getElementById('color-picker-text');
                
                if (fontFamilySelector) fontFamilySelector.value = textObject.fontFamily || 'Arial';
                if (fontSizeSelector) fontSizeSelector.value = textObject.fontSize || 20;
                if (fontBoldBtn) fontBoldBtn.classList.toggle('active', textObject.fontWeight === 'bold');
                if (fontItalicBtn) fontItalicBtn.classList.toggle('active', textObject.fontStyle === 'italic');
                if (fontUnderlineBtn) fontUnderlineBtn.classList.toggle('active', textObject.underline);
                if (colorPickerText) colorPickerText.value = textObject.fill || '#000000';
                
                this.setupTextControlEvents(textObject);
                
                console.log('DEBUG: Contrôles de texte affichés et réactivés');
            }
        }

        hideTextControls() {
            // Nettoyer les événements avant de masquer
            this.cleanupTextControlEvents();
            
            // Masquer les contrôles de texte
            const textOptionsTools = document.getElementById('text-options-tools');
            if (textOptionsTools) {
                textOptionsTools.style.display = 'none';
            }
            
            // Restaurer les options appropriées selon le mode actuel
            if (this.state.toolsManager) {
                this.state.toolsManager.updateContextualUI(this.state.toolsManager.getCurrentMode());
            }
        }

        setupTextControlEvents(textObject) {
            // Nettoyer les anciens événements
            this.cleanupTextControlEvents();
            
            // Configurer les événements des contrôles de texte
            const fontFamilySelector = document.getElementById('font-family-selector');
            const fontSizeSelector = document.getElementById('font-size-selector');
            const fontBoldBtn = document.getElementById('font-bold-btn');
            const fontItalicBtn = document.getElementById('font-italic-btn');
            const fontUnderlineBtn = document.getElementById('font-underline-btn');
            const colorPickerText = document.getElementById('color-picker-text');
            
            // Créer les fonctions d'événements et les stocker pour pouvoir les supprimer
            this.textControlHandlers = {};
            
            if (fontFamilySelector) {
                this.textControlHandlers.fontFamily = () => {
                    console.log('DEBUG: Changement de police:', fontFamilySelector.value);
                    textObject.set('fontFamily', fontFamilySelector.value);
                    textObject.canvas.renderAll();
                };
                fontFamilySelector.addEventListener('change', this.textControlHandlers.fontFamily);
            }
            
            if (fontSizeSelector) {
                this.textControlHandlers.fontSize = () => {
                    console.log('DEBUG: Changement de taille:', fontSizeSelector.value);
                    textObject.set('fontSize', parseInt(fontSizeSelector.value));
                    textObject.canvas.renderAll();
                };
                fontSizeSelector.addEventListener('change', this.textControlHandlers.fontSize);
            }
            
            if (fontBoldBtn) {
                this.textControlHandlers.fontBold = () => {
                    const isBold = textObject.fontWeight === 'bold';
                    console.log('DEBUG: Toggle gras, était:', isBold);
                    textObject.set('fontWeight', isBold ? 'normal' : 'bold');
                    fontBoldBtn.classList.toggle('active', !isBold);
                    textObject.canvas.renderAll();
                };
                fontBoldBtn.addEventListener('click', this.textControlHandlers.fontBold);
            }
            
            if (fontItalicBtn) {
                this.textControlHandlers.fontItalic = () => {
                    const isItalic = textObject.fontStyle === 'italic';
                    console.log('DEBUG: Toggle italique, était:', isItalic);
                    textObject.set('fontStyle', isItalic ? 'normal' : 'italic');
                    fontItalicBtn.classList.toggle('active', !isItalic);
                    textObject.canvas.renderAll();
                };
                fontItalicBtn.addEventListener('click', this.textControlHandlers.fontItalic);
            }
            
            if (fontUnderlineBtn) {
                this.textControlHandlers.fontUnderline = () => {
                    const isUnderline = textObject.underline;
                    console.log('DEBUG: Toggle souligné, était:', isUnderline);
                    textObject.set('underline', !isUnderline);
                    fontUnderlineBtn.classList.toggle('active', !isUnderline);
                    textObject.canvas.renderAll();
                };
                fontUnderlineBtn.addEventListener('click', this.textControlHandlers.fontUnderline);
            }
            
            if (colorPickerText) {
                this.textControlHandlers.textColor = () => {
                    console.log('DEBUG: Changement de couleur de texte:', colorPickerText.value);
                    textObject.set('fill', colorPickerText.value);
                    textObject.canvas.renderAll();
                };
                colorPickerText.addEventListener('input', this.textControlHandlers.textColor);
            }
            
            console.log('DEBUG: Événements des contrôles de texte configurés pour:', textObject);
        }

        cleanupTextControlEvents() {
            // Supprimer les anciens événements
            if (this.textControlHandlers) {
                const fontFamilySelector = document.getElementById('font-family-selector');
                const fontSizeSelector = document.getElementById('font-size-selector');
                const fontBoldBtn = document.getElementById('font-bold-btn');
                const fontItalicBtn = document.getElementById('font-italic-btn');
                const fontUnderlineBtn = document.getElementById('font-underline-btn');
                const colorPickerText = document.getElementById('color-picker-text');
                
                if (fontFamilySelector && this.textControlHandlers.fontFamily) {
                    fontFamilySelector.removeEventListener('change', this.textControlHandlers.fontFamily);
                }
                if (fontSizeSelector && this.textControlHandlers.fontSize) {
                    fontSizeSelector.removeEventListener('change', this.textControlHandlers.fontSize);
                }
                if (fontBoldBtn && this.textControlHandlers.fontBold) {
                    fontBoldBtn.removeEventListener('click', this.textControlHandlers.fontBold);
                }
                if (fontItalicBtn && this.textControlHandlers.fontItalic) {
                    fontItalicBtn.removeEventListener('click', this.textControlHandlers.fontItalic);
                }
                if (fontUnderlineBtn && this.textControlHandlers.fontUnderline) {
                    fontUnderlineBtn.removeEventListener('click', this.textControlHandlers.fontUnderline);
                }
                if (colorPickerText && this.textControlHandlers.textColor) {
                    colorPickerText.removeEventListener('input', this.textControlHandlers.textColor);
                }
                
                this.textControlHandlers = null;
            }
        }


    }

    // Exposer dans le namespace global
    if (typeof window !== 'undefined') {
        window.PlanEditor.CanvasManager = CanvasManager;
    }

})();

