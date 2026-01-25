// modules/layer-transform.js - Gestion des contrôles de transformation des calques d'images
(function() {
    'use strict';

    // Gestionnaire des transformations de calques
    class LayerTransformManager {
        constructor(state, layerManager, eventManager) {
            this.state = state;
            this.layerManager = layerManager;
            this.eventManager = eventManager;

            // État du drag
            this.isDragging = false;
            this.activeHandle = null;
            this.startPoint = { x: 0, y: 0 };
            this.startDimensions = { width: 0, height: 0 };
            this.startLayerPos = { x: 0, y: 0 };

            this.init();
        }

        init() {
            console.log('🔍 [DEBUG] LayerTransformManager.init() appelé - configuration des écouteurs');

            // ✅ FIX : Supprimer toutes les poignées au démarrage pour être sûr
            this.removeAllResizeHandles();

            // Écouter les changements de calque actif
            document.addEventListener('active-layer-changed', (e) => {
                console.log('🔄 active-layer-changed:', e.detail.id, 'workflow state:', this.state.workflowState);
                this.updateResizeHandles(e.detail.id);
            });

            // ✅ FIX : Écouter la calibration du drone pour afficher les poignées
            document.addEventListener('drone-scale-calibrated', () => {
                console.log('🚁 drone-scale-calibrated - tentative d\'affichage des poignées');
                this.showDroneHandles();
            });

            // ✅ FIX : Écouter les changements d'état du workflow pour afficher les poignées
            // Les poignées ne doivent apparaître qu'APRÈS que l'échelle a été calibrée (ready_for_drawing)
            document.addEventListener('workflow-state-changed', (e) => {
                console.log('🔄 workflow-state-changed:', e.detail.state);
                if (e.detail.state === 'ready_for_drawing') {
                    console.log('🚁 Workflow ready_for_drawing - vérification des poignées de drone');
                    this.showDroneHandles();
                }
            });

            // Écouter les mises à jour de l'interface pour mettre à jour les positions des poignées existantes
            document.addEventListener('update-ui-tools-state', () => {
                this.updateExistingHandlePositions();
            });

            // ✅ FIX : Écouter les changements d'angle pour mettre à jour les positions des poignées
            document.addEventListener('update-handles-positions', (e) => {
                const layer = this.state.layers.find(l => l.id === e.detail.layerId);
                if (layer && layer.resizeHandles && layer.resizeHandles.length > 0) {
                    this.updateHandlePositions(layer);
                }
            });

            // Écouter les événements de souris pour le drag (mousemove et mouseup uniquement)
            // mousedown est géré directement par les poignées
            window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            window.addEventListener('mouseup', (e) => this.handleMouseUp(e));

            // Écouter les événements tactiles pour le drag
            // touchstart est géré directement par les poignées
            window.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            window.addEventListener('touchend', (e) => this.handleMouseUp(e));
        }

        // ✅ NOUVELLE MÉTHODE : Afficher les poignées du drone après calibration
        showDroneHandles() {
            console.log('🔍 [DEBUG] showDroneHandles() appelée');

            // ✅ FIX : Chercher TOUS les calques drone calibrés, pas seulement le calque actif
            const droneLayers = this.state.layers.filter(l =>
                l.name.toLowerCase().includes('drone') &&
                l.droneScaleCalibrated &&
                l.fabricCanvas.backgroundImage
            );

            console.log('🔍 [DEBUG] Calques trouvés:', droneLayers.map(l => ({ name: l.name, calibrated: l.droneScaleCalibrated, hasBg: !!l.fabricCanvas.backgroundImage })));

            if (droneLayers.length === 0) {
                console.log('⏸️ Pas de calque drone calibré trouvé');
                console.log('🔍 [DEBUG] Tous les calques:', this.state.layers.map(l => ({ name: l.name, hasDrone: l.name.toLowerCase().includes('drone'), calibrated: l.droneScaleCalibrated })));
                return;
            }

            // Ajouter les poignées à tous les calques drone calibrés
            droneLayers.forEach(layer => {
                const hasHandles = layer.resizeHandles && layer.resizeHandles.length > 0;
                console.log('🔍 [DEBUG] Calque:', layer.name, '- hasHandles:', hasHandles, '- resizeHandles.length:', layer.resizeHandles?.length);
                if (!hasHandles) {
                    console.log('🔍 [DEBUG] Ajout des poignées à:', layer.name);
                    this.addResizeHandles(layer);
                    console.log('🚁 Poignées de transformation ajoutées au calque drone calibré:', layer.name);
                } else {
                    console.log('✅ Poignées déjà présentes sur:', layer.name);
                }
            });
        }

        // ✅ NOUVELLE MÉTHODE : Mettre à jour les positions des poignées existantes
        updateExistingHandlePositions() {
            this.state.layers.forEach(layer => {
                if (layer.resizeHandles && layer.resizeHandles.length > 0) {
                    this.updateHandlePositions(layer);
                }
            });
        }

        // ✅ SUPPRIMÉ : ensureDroneHandlesVisible() - remplacée par showDroneHandles()

        // Mettre à jour les poignées de redimensionnement pour un calque
        updateResizeHandles(layerId) {
            if (!layerId) {
                // ✅ FIX : Quand aucun calque n'est actif, supprimer toutes les poignées
                this.removeAllResizeHandles();
                return;
            }

            const layer = this.state.layers.find(l => l.id === layerId);
            if (!layer) return;

            // IMPORTANT : Ne pas ajouter de poignées pour le calque de dessin
            if (layer.name === this.state.DRAWING_LAYER_NAME) {
                // Supprimer les poignées existantes
                this.removeAllResizeHandles();
                return;
            }

            // IMPORTANT : Ajouter les poignées UNIQUEMENT pour le calque "Vue Drone"
            if (!layer.name.toLowerCase().includes('drone')) {
                return;
            }

            // ✅ FIX CRITIQUE : Vérifier que le calque drone a été calibré
            // Les poignées ne doivent apparaître qu'APRÈS la calibration de l'échelle du drone
            if (!layer.droneScaleCalibrated) {
                console.log('⏸️ Calque drone pas encore calibré - pas de poignées pour le moment');
                this.removeAllResizeHandles();
                return;
            }

            // Ajouter les poignées uniquement pour les calques qui ont une image de fond
            if (!layer.fabricCanvas.backgroundImage) return;

            // ✅ FIX : Supprimer d'abord les poignées des autres calques
            this.state.layers.forEach(l => {
                if (l.id !== layerId && l.resizeHandles) {
                    l.resizeHandles.forEach(handle => handle.remove());
                    l.resizeHandles = [];
                }
            });

            // Ajouter les poignées au calque actif si elles n'existent pas déjà
            if (!layer.resizeHandles || layer.resizeHandles.length === 0) {
                this.addResizeHandles(layer);
                console.log('✅ Poignées ajoutées au calque drone calibré:', layer.name);
            }
        }

        removeAllResizeHandles() {
            // Supprimer les poignées de tous les calques
            this.state.layers.forEach(layer => {
                if (layer.resizeHandles) {
                    layer.resizeHandles.forEach(handle => {
                        handle.remove();
                    });
                    layer.resizeHandles = [];
                }
            });

            // Nettoyer toutes les poignées restantes dans le DOM
            const existingHandles = document.querySelectorAll('.resize-handle');
            existingHandles.forEach(handle => handle.remove());
        }

        addResizeHandles(layer) {
            console.log('🔍 [DEBUG] addResizeHandles appelé pour:', layer.name);

            const wrapper = layer.wrapper;
            if (!wrapper) {
                console.error('❌ Wrapper non trouvé pour:', layer.name);
                return;
            }

            wrapper.classList.add('resizable');

            // ✅ FIX CORRECT : Attacher les poignées au zoom-wrapper au lieu du canvas-wrapper
            // Cela résout le problème de stacking context - les poignées seront au même niveau
            // que tous les wrappers et leur z-index 999999 fonctionnera correctement
            const zoomWrapper = document.getElementById('zoom-wrapper');
            if (!zoomWrapper) {
                console.error('❌ zoom-wrapper non trouvé');
                return;
            }

            console.log('✅ zoom-wrapper trouvé, ajout des poignées...');

            // Créer les 4 poignées de redimensionnement + 1 poignée de rotation
            const handles = ['ml', 'mr', 'mt', 'mb', 'rotate'];
            layer.resizeHandles = []; // Stocker les références des poignées sur le layer

            handles.forEach(type => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${type}`;
                handle.dataset.handleType = type;
                handle.dataset.layerId = layer.id;

                if (type === 'rotate') {
                    // Poignée de rotation : cercle avec une flèche
                    handle.innerHTML = '↻';
                    handle.style.display = 'flex';
                    handle.style.alignItems = 'center';
                    handle.style.justifyContent = 'center';
                    handle.style.fontSize = '16px';
                    handle.style.fontWeight = 'bold';
                    handle.style.color = '#fff';
                    handle.style.textShadow = '0 0 2px #000';
                }

                // Attacher directement les événements aux poignées
                handle.addEventListener('mousedown', (e) => {
                    console.log('🎯 Poignée cliquée:', type, 'target:', e.target.className);
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    if (type === 'rotate') {
                        this.startRotation(e, handle);
                    } else {
                        this.startDrag(e, handle);
                    }
                });

                handle.addEventListener('touchstart', (e) => {
                    console.log('🎯 Poignée touchée:', type);
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    if (type === 'rotate') {
                        this.startRotation(e, handle);
                    } else {
                        this.startDrag(e, handle);
                    }
                }, { passive: false });

                // Attacher au zoom-wrapper au lieu du canvas-wrapper
                zoomWrapper.appendChild(handle);
                layer.resizeHandles.push(handle);
            });

            // Positionner les poignées initialement
            this.updateHandlePositions(layer);

            console.log('🚁 Poignées de transformation ajoutées au calque:', layer.name);
        }

        // Nouvelle méthode pour mettre à jour la position des poignées quand le calque bouge
        updateHandlePositions(layer) {
            if (!layer.resizeHandles || layer.resizeHandles.length === 0) return;

            const wrapper = layer.wrapper;
            const zoomWrapper = document.getElementById('zoom-wrapper');

            // ✅ FIX : Utiliser les dimensions du canvas (non-rotatées) au lieu de getBoundingClientRect
            const canvas = layer.fabricCanvas;
            const width = canvas.width;
            const height = canvas.height;

            // Position du centre du calque (non-rotaté) dans le zoom-wrapper
            const centerX = layer.x + width / 2;
            const centerY = layer.y + height / 2;

            // Angle de rotation en radians
            const angleRad = (layer.angle || 0) * Math.PI / 180;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);

            // ✅ FIX : Fonction pour calculer la position d'un point après rotation autour du centre
            const rotatePoint = (localX, localY) => {
                // localX et localY sont les coordonnées relatives au centre du calque (non-rotaté)
                const rotatedX = localX * cos - localY * sin;
                const rotatedY = localX * sin + localY * cos;
                return {
                    x: centerX + rotatedX,
                    y: centerY + rotatedY
                };
            };

            // Mettre à jour chaque poignée avec sa position rotative
            layer.resizeHandles.forEach(handle => {
                const type = handle.dataset.handleType;
                let localX, localY;

                // Position de la poignée relative au centre du calque (non-rotaté)
                switch (type) {
                    case 'ml': // milieu gauche
                        localX = -width / 2;
                        localY = 0;
                        break;
                    case 'mr': // milieu droit
                        localX = width / 2;
                        localY = 0;
                        break;
                    case 'mt': // milieu haut
                        localX = 0;
                        localY = -height / 2;
                        break;
                    case 'mb': // milieu bas
                        localX = 0;
                        localY = height / 2;
                        break;
                    case 'rotate': // poignée de rotation - au-dessus du calque
                        localX = 0;
                        localY = -height / 2 - 30; // 30px au-dessus du bord supérieur
                        break;
                }

                // Calculer la position après rotation
                const pos = rotatePoint(localX, localY);

                // Appliquer la position (le zoom est déjà appliqué au zoom-wrapper)
                handle.style.left = pos.x + 'px';
                handle.style.top = pos.y + 'px';

                // ✅ FIX : Faire tourner la poignée pour qu'elle reste alignée avec le côté du calque
                // Utiliser CSS custom property pour combiner rotation et scale au survol
                handle.style.setProperty('--rotation', `${layer.angle || 0}deg`);
                handle.style.transform = `rotate(var(--rotation))`;
            });
        }

        getPointerCoords(e) {
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        }

        // ✅ NOUVELLE MÉTHODE : Initialiser la rotation du calque
        startRotation(e, handle) {
            const coords = this.getPointerCoords(e);
            const layerId = parseInt(handle.dataset.layerId);
            const layer = this.state.layers.find(l => l.id === layerId);

            if (!layer) return;

            this.isRotating = true;
            this.activeHandle = handle;
            this.activeLayer = layer;
            this.startPoint = coords;
            this.startAngle = layer.angle || 0;

            // Calculer le centre du calque
            const canvas = layer.fabricCanvas;
            this.centerX = layer.x + canvas.width / 2;
            this.centerY = layer.y + canvas.height / 2;

            // Calculer l'angle initial depuis le centre jusqu'à la souris
            const dx = coords.x - this.centerX;
            const dy = coords.y - this.centerY;
            this.startMouseAngle = Math.atan2(dy, dx) * 180 / Math.PI;

            // Marquer le wrapper comme actif
            layer.wrapper.classList.add('active');
        }

        // ✅ NOUVELLE MÉTHODE : Gérer le mouvement pendant la rotation
        handleRotationMove(e) {
            if (!this.isRotating) return;

            const coords = this.getPointerCoords(e);

            // Calculer l'angle actuel depuis le centre jusqu'à la souris
            const dx = coords.x - this.centerX;
            const dy = coords.y - this.centerY;
            const currentMouseAngle = Math.atan2(dy, dx) * 180 / Math.PI;

            // Calculer la différence d'angle
            let angleDelta = currentMouseAngle - this.startMouseAngle;

            // Nouvel angle du calque
            let newAngle = this.startAngle + angleDelta;

            // Normaliser l'angle entre 0 et 360
            while (newAngle < 0) newAngle += 360;
            while (newAngle >= 360) newAngle -= 360;

            // Appliquer la nouvelle rotation
            this.activeLayer.angle = newAngle;
            this.activeLayer.wrapper.style.transform = `translate(${this.activeLayer.x}px, ${this.activeLayer.y}px) rotateZ(${newAngle}deg)`;

            // Mettre à jour la position des poignées
            this.updateHandlePositions(this.activeLayer);
        }

        // ✅ NOUVELLE MÉTHODE : Terminer la rotation
        handleRotationEnd() {
            if (!this.isRotating) return;

            // Sauvegarder l'état pour undo/redo
            this.layerManager.undoRedoManager.forceSave(
                this.activeLayer.fabricCanvas,
                this.activeLayer
            );

            // Nettoyer
            if (this.activeLayer) {
                this.activeLayer.wrapper.classList.remove('active');
            }

            this.isRotating = false;
            this.activeHandle = null;
            this.activeLayer = null;
            this.startAngle = null;
            this.startMouseAngle = null;
            this.centerX = null;
            this.centerY = null;
        }

        handleMouseDown(e) {
            const handle = e.target.closest('.resize-handle');
            if (!handle) return;

            // Arrêter complètement la propagation de l'événement
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            console.log('🎯 Poignée de redimensionnement cliquée:', handle.dataset.handleType);
            this.startDrag(e, handle);
        }

        handleTouchStart(e) {
            const handle = e.target.closest('.resize-handle');
            if (!handle) return;

            // Arrêter complètement la propagation de l'événement
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            console.log('🎯 Poignée de redimensionnement touchée:', handle.dataset.handleType);
            this.startDrag(e, handle);
        }

        startDrag(e, handle) {
            const coords = this.getPointerCoords(e);
            const layerId = parseInt(handle.dataset.layerId);
            const handleType = handle.dataset.handleType;
            const layer = this.state.layers.find(l => l.id === layerId);

            if (!layer) return;

            this.isDragging = true;
            this.activeHandle = handle;
            this.activeLayer = layer;
            this.handleType = handleType;
            this.startPoint = coords;

            // Dimensions initiales du canvas
            const canvas = layer.fabricCanvas;
            this.startDimensions = {
                width: canvas.width,
                height: canvas.height
            };

            // Position initiale du calque
            this.startLayerPos = {
                x: layer.x,
                y: layer.y
            };

            // Sauvegarder l'état initial de l'image de fond
            const bgImage = canvas.backgroundImage;
            if (bgImage) {
                this.startBgImageProps = {
                    scaleX: bgImage.scaleX || 1,
                    scaleY: bgImage.scaleY || 1,
                    imgWidth: bgImage.width,
                    imgHeight: bgImage.height
                };
            }

            // Marquer le wrapper comme actif
            layer.wrapper.classList.add('active');
        }

        handleMouseMove(e) {
            if (this.isDragging) {
                const coords = this.getPointerCoords(e);
                this.updateDrag(coords);
            } else if (this.isRotating) {
                this.handleRotationMove(e);
            }
        }

        handleTouchMove(e) {
            if (this.isDragging) {
                e.preventDefault();
                const coords = this.getPointerCoords(e);
                this.updateDrag(coords);
            } else if (this.isRotating) {
                e.preventDefault();
                this.handleRotationMove(e);
            }
        }

        updateDrag(coords) {
            const dx = coords.x - this.startPoint.x;
            const dy = coords.y - this.startPoint.y;

            // Corriger par le zoom
            const correctedDx = dx / this.state.zoom;
            const correctedDy = dy / this.state.zoom;

            // ✅ FIX : Projeter le mouvement sur l'axe de redimensionnement du calque tourné
            const angleRad = (this.activeLayer.angle || 0) * Math.PI / 180;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);

            // Projection du mouvement sur les axes du calque tourné
            // Pour l'axe horizontal du calque (tourné): projX = dx * cos(θ) + dy * sin(θ)
            // Pour l'axe vertical du calque (tourné): projY = -dx * sin(θ) + dy * cos(θ)
            const projectedDx = correctedDx * cos + correctedDy * sin;
            const projectedDy = -correctedDx * sin + correctedDy * cos;

            const canvas = this.activeLayer.fabricCanvas;
            let newWidth = this.startDimensions.width;
            let newHeight = this.startDimensions.height;
            let newX = this.startLayerPos.x;
            let newY = this.startLayerPos.y;

            switch (this.handleType) {
                case 'mr': // milieu droit - étirement horizontal
                    newWidth = Math.max(100, this.startDimensions.width + projectedDx);
                    break;
                case 'ml': // milieu gauche - étirement horizontal
                    newWidth = Math.max(100, this.startDimensions.width - projectedDx);
                    // Le centre se décale de la moitié du changement de largeur dans la direction du côté gauche
                    // La direction du côté gauche est l'opposé de l'axe horizontal: (-cos, -sin)
                    newX = this.startLayerPos.x - (projectedDx / 2) * cos;
                    newY = this.startLayerPos.y - (projectedDx / 2) * sin;
                    break;
                case 'mb': // milieu bas - étirement vertical
                    newHeight = Math.max(100, this.startDimensions.height + projectedDy);
                    break;
                case 'mt': // milieu haut - étirement vertical
                    newHeight = Math.max(100, this.startDimensions.height - projectedDy);
                    // Le centre se décale de la moitié du changement de hauteur dans la direction du côté haut
                    // La direction du côté haut est: (-sin, cos)
                    newX = this.startLayerPos.x - (projectedDy / 2) * sin;
                    newY = this.startLayerPos.y + (projectedDy / 2) * cos;
                    break;
            }

            // Appliquer les nouvelles dimensions au canvas
            canvas.setWidth(newWidth);
            canvas.setHeight(newHeight);

            // Mettre à jour la position du calque
            this.activeLayer.x = newX;
            this.activeLayer.y = newY;
            this.activeLayer.wrapper.style.transform = `translate(${newX}px, ${newY}px) rotateZ(${this.activeLayer.angle}deg)`;

            // Redimensionner l'image de fond proportionnellement
            const bgImage = canvas.backgroundImage;
            if (bgImage && this.startBgImageProps) {
                const props = this.startBgImageProps;
                let newScaleX = props.scaleX;
                let newScaleY = props.scaleY;

                // Calculer les ratios de changement
                const widthRatio = newWidth / this.startDimensions.width;
                const heightRatio = newHeight / this.startDimensions.height;

                if (this.handleType === 'mr' || this.handleType === 'ml') {
                    // Étirement horizontal : ajuster scaleX uniquement
                    newScaleX = props.scaleX * widthRatio;
                } else if (this.handleType === 'mt' || this.handleType === 'mb') {
                    // Étirement vertical : ajuster scaleY uniquement
                    newScaleY = props.scaleY * heightRatio;
                }

                // Appliquer les nouvelles échelles
                bgImage.set({
                    scaleX: newScaleX,
                    scaleY: newScaleY
                });

                canvas.setBackgroundImage(bgImage, canvas.renderAll.bind(canvas));
            }

            canvas.renderAll();

            // ✅ Mettre à jour la position des poignées pendant le redimensionnement
            this.updateHandlePositions(this.activeLayer);

            // ✅ FIX : NE PAS déclencher update-scroll-content-size PENDANT le redimensionnement
            // Cela cause un basculement de la vue à chaque mouvement
            // L'événement sera déclenché une seule fois à la fin (dans handleMouseUp)
        }

        handleMouseUp(e) {
            if (this.isDragging) {
                // ✅ Mettre à jour la position finale des poignées
                this.updateHandlePositions(this.activeLayer);

                // Sauvegarder l'état pour undo/redo
                this.layerManager.undoRedoManager.forceSave(
                    this.activeLayer.fabricCanvas,
                    this.activeLayer
                );

                // Nettoyer
                if (this.activeLayer) {
                    this.activeLayer.wrapper.classList.remove('active');
                }

                this.isDragging = false;
                this.activeHandle = null;
                this.activeLayer = null;
                this.handleType = null;
                this.startBgImageProps = null;
            } else if (this.isRotating) {
                this.handleRotationEnd();
            }
        }
    }

    // Exposer dans le namespace global
    window.PlanEditor.LayerTransformManager = LayerTransformManager;

})();
