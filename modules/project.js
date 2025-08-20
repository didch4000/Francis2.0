// modules/project.js - Gestionnaire de sauvegarde/chargement de projets
(function() {
    'use strict';
    
    // Gestionnaire de projets
    class ProjectManager {
        constructor(state, layerManager, canvasManager) {
            this.state = state;
            this.layerManager = layerManager;
            this.canvasManager = canvasManager;
            this.currentProjectName = null;
        }

        // Sauvegarder le projet
        async saveProject(projectName = null) {
            try {
                // Si pas de nom fourni, demander à l'utilisateur
                if (!projectName) {
                    projectName = prompt('Nom du projet :', this.currentProjectName || 'Mon_Plan');
                    if (!projectName) return false; // Annulé par l'utilisateur
                }

                // Nettoyer le nom du fichier
                projectName = this.sanitizeFileName(projectName);
                this.currentProjectName = projectName;

                // Sérialiser l'état complet du projet
                const projectData = this.state.serializeForSave();
                
                // Ajouter les métadonnées du projet
                projectData.projectName = projectName;
                projectData.appVersion = '1.0';
                
                // Convertir en JSON
                const jsonData = JSON.stringify(projectData, null, 2);
                
                // Télécharger le fichier
                this.downloadFile(jsonData, `${projectName}.fpj`, 'application/json');
                
                console.log('✅ Téléchargement de projet initié:', projectName);
                
                return true;
            } catch (error) {
                console.error('❌ Erreur lors de la sauvegarde:', error);
                this.showNotification(`Erreur lors de la sauvegarde: ${error.message}`, 'error');
                return false;
            }
        }

        // Charger un projet
        async loadProject(file = null) {
            try {
                let projectData;
                
                if (file) {
                    // Chargement depuis un fichier fourni
                    projectData = await this.readFileAsJson(file);
                } else {
                    // Demander à l'utilisateur de sélectionner un fichier
                    const selectedFile = await this.selectFile('.fpj,application/json');
                    if (!selectedFile) return false; // Annulé par l'utilisateur
                    
                    projectData = await this.readFileAsJson(selectedFile);
                }

                // Vérifier la validité du projet
                if (!this.validateProjectData(projectData)) {
                    throw new Error('Format de projet invalide');
                }

                // Demander confirmation avant de remplacer le projet actuel
                if (this.state.layers.length > 0) {
                    const confirm = window.confirm(
                        'Charger ce projet remplacera le travail actuel. Voulez-vous continuer ?\n\n' +
                        'Conseil : Sauvegardez d\'abord votre travail actuel si nécessaire.'
                    );
                    if (!confirm) return false;
                }

                // Charger le projet
                await this.loadProjectData(projectData);
                
                console.log('✅ Projet chargé:', projectData.projectName);
                this.showNotification(`Projet "${projectData.projectName}" chargé avec succès !`, 'success');
                
                return true;
            } catch (error) {
                console.error('❌ Erreur lors du chargement:', error);
                this.showNotification(`Erreur lors du chargement: ${error.message}`, 'error');
                return false;
            }
        }

        // Charger les données d'un projet
        async loadProjectData(projectData) {
            // Marquer qu'on est en train de charger pour éviter les déclenchements indésirables
            this.state.isLoadingState = true;
            
            // Réinitialiser l'application
            this.resetApplication();
            
            // Restaurer l'état général
            const layersDataArray = this.state.deserializeFromSave(projectData);
            
            // Restaurer les calques dans le bon ordre : fond → supplémentaires → dessin
            // Séparer les calques par type selon la logique de l'interface
            const backgroundLayersData = [];
            const supplementaryLayersData = [];
            const drawingLayersData = [];
            
            layersDataArray.forEach(layerData => {
                if (layerData.name === this.state.DRAWING_LAYER_NAME) {
                    // Calque de dessin principal
                    drawingLayersData.push(layerData);
                } else if (layerData.name === "Plan rogné" || layerData.name === "Image de fond") {
                    // Calques de fond spécifiques
                    backgroundLayersData.push(layerData);
                } else {
                    // Tous les autres calques (supplémentaires, y compris "Image collée")
                    supplementaryLayersData.push(layerData);
                }
            });
            
            // Charger dans l'ordre : fond → supplémentaires → dessin
            console.log(`🎨 [LAYER ORDER] Chargement: ${backgroundLayersData.length} fond, ${supplementaryLayersData.length} supplémentaires, ${drawingLayersData.length} dessin`);
            
            // 1. Calques de fond (en bas de la pile)
            for (const layerData of backgroundLayersData) {
                await this.restoreLayer(layerData, 'background');
            }
            
            // 2. Calques supplémentaires (au milieu)
            for (const layerData of supplementaryLayersData) {
                await this.restoreLayer(layerData, 'supplementary');
            }
            
            // 3. Calques de dessin (au-dessus)
            for (const layerData of drawingLayersData) {
                await this.restoreLayer(layerData, 'drawing');
            }
            
            // Mettre à jour le nom du projet
            this.currentProjectName = projectData.projectName;
            
            // Forcer l'ordre correct des calques avant la mise à jour de l'interface
            this.enforceLayerOrdering();
            
            // Rafraîchir l'interface
            this.refreshInterface();
            
            // Mettre à jour l'état des outils de projet
            document.dispatchEvent(new CustomEvent('update-project-tools-state'));
            
            // Masquer le guide message car le projet a des calques chargés
            const guideMessage = document.getElementById('guide-message');
            if (guideMessage && this.state.layers.length > 0) {
                guideMessage.style.display = 'none';
                console.log('🙈 Guide message masqué - projet chargé avec calques');
            }
            
            // Ajuster le zoom et centrer les calques après un petit délai pour s'assurer que tout est restauré
            setTimeout(() => {
                this.fitAndCenterLayers();
            }, 200);
            
            // Marquer la fin du chargement
            this.state.isLoadingState = false;
            console.log('✅ Chargement de projet terminé - isLoadingState = false');
        }

        // Restaurer un calque individuel
        async restoreLayer(layerData, layerType = 'unknown') {
            return new Promise((resolve) => {
                if (layerData.backgroundImage) {
                    // Calque avec image de fond
                    const img = new Image();
                    img.onload = () => {
                        // Déterminer les options d'insertion selon le type de calque
                        let insertOptions = {};
                        if (layerType === 'background') {
                            insertOptions = { insertBelowDrawing: true }; // Calques de fond en bas
                        } else if (layerType === 'supplementary') {
                            insertOptions = { insertBelowDrawing: true }; // Calques supplémentaires au milieu (mais après les fonds)
                        } else {
                            insertOptions = { insertBelowDrawing: false }; // Calques de dessin au-dessus
                        }
                        
                        const layer = this.layerManager.createLayer(layerData.name, img, insertOptions);
                        this.applyLayerProperties(layer, layerData);
                        this.restoreCanvasObjects(layer, layerData.canvasState);
                        console.log(`🎨 [LAYER ORDER] ${layerType} restauré: ${layerData.name}`);
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn('❌ Impossible de charger l\'image du calque:', layerData.name);
                        resolve();
                    };
                    img.src = layerData.backgroundImage;
                } else {
                    // Calque sans image de fond
                    let insertOptions = {};
                    if (layerType === 'background') {
                        insertOptions = { insertBelowDrawing: true }; // Calques de fond en bas
                    } else if (layerType === 'supplementary') {
                        insertOptions = { insertBelowDrawing: true }; // Calques supplémentaires au milieu (mais après les fonds)
                    } else {
                        insertOptions = { insertBelowDrawing: false }; // Calques de dessin au-dessus
                    }
                    
                    const layer = this.layerManager.createLayer(layerData.name, null, insertOptions);
                    this.applyLayerProperties(layer, layerData);
                    this.restoreCanvasObjects(layer, layerData.canvasState);
                    console.log(`🎨 [LAYER ORDER] ${layerType} restauré: ${layerData.name}`);
                    resolve();
                }
            });
        }

        // Appliquer les propriétés d'un calque
        applyLayerProperties(layer, layerData) {
            layer.id = layerData.id;
            layer.visible = layerData.visible !== false;
            layer.opacity = layerData.opacity !== undefined ? layerData.opacity : 1;
            
            // Restaurer les dimensions si elles existent
            if (layerData.width && layerData.height) {
                layer.fabricCanvas.setDimensions({
                    width: layerData.width,
                    height: layerData.height
                });
                
                // Aussi ajuster le wrapper ET le canvas element
                if (layer.wrapper) {
                    layer.wrapper.style.width = layerData.width + 'px';
                    layer.wrapper.style.height = layerData.height + 'px';
                }
                
                // Ajuster l'élément canvas lui-même
                const canvasElement = layer.fabricCanvas.lowerCanvasEl;
                if (canvasElement) {
                    canvasElement.style.width = layerData.width + 'px';
                    canvasElement.style.height = layerData.height + 'px';
                }
            }
            
            // Restaurer la position et rotation
            if (layerData.x !== undefined) layer.x = layerData.x;
            if (layerData.y !== undefined) layer.y = layerData.y; 
            if (layerData.angle !== undefined) layer.angle = layerData.angle;
            
            // Appliquer la transformation
            if (layer.wrapper) {
                layer.wrapper.style.transform = `translate(${layer.x}px, ${layer.y}px) rotateZ(${layer.angle}deg)`;
                
                // Forcer le z-index selon le type de calque avec renforcement
                if (layerData.backgroundImage) {
                    layer.wrapper.style.setProperty('z-index', '1', 'important'); // Image de fond
                    console.log(`🎨 [Z-INDEX] Calque image "${layer.name}" z-index forcé à 1`);
                } else {
                    layer.wrapper.style.setProperty('z-index', '100', 'important'); // Calque de dessin
                    console.log(`🎨 [Z-INDEX] Calque dessin "${layer.name}" z-index forcé à 100`);
                }
                
                // Force refresh du style pour s'assurer que le navigateur applique le changement
                layer.wrapper.offsetHeight; // Force reflow
            }
            
            // Restaurer autres propriétés
            layer.scaleDenominator = layerData.scaleDenominator;
        }

        // Restaurer les objets d'un canvas
        restoreCanvasObjects(layer, canvasState) {
            if (!canvasState || !layer.fabricCanvas) return;
            
            layer.fabricCanvas.loadFromJSON(canvasState, () => {
                layer.fabricCanvas.renderAll();
                console.log(`📦 Objets restaurés pour le calque: ${layer.name}`);
            });
        }

        // Réinitialiser l'application
        resetApplication() {
            // Supprimer tous les canvas existants
            this.state.layers.forEach(layer => {
                if (layer.fabricCanvas) {
                    layer.fabricCanvas.dispose();
                }
            });
            
            // Réinitialiser l'état
            this.state.reset();
            
            // S'assurer que les états de sélection sont remis à zéro
            this.state.isSelectingArea = false;
            this.state.isDraggingSelection = false;
            
            // Masquer tout élément de sélection de zone qui pourrait être affiché
            const selectionBox = document.getElementById('selection-box');
            if (selectionBox) {
                selectionBox.style.display = 'none';
            }
            
            // Vider le conteneur des canvas
            const zoomWrapper = document.getElementById('zoom-wrapper');
            if (zoomWrapper) {
                zoomWrapper.innerHTML = '';
                // Remettre les dimensions et styles initiaux
                zoomWrapper.style.width = '';
                zoomWrapper.style.height = '';
                zoomWrapper.style.transform = 'scale(1)';
            }
            
            // Réinitialiser le niveau de zoom
            this.state.zoomLevel = 1;
            const zoomDisplay = document.getElementById('zoom-level-display');
            if (zoomDisplay) {
                zoomDisplay.textContent = '100%';
            }
            
            // Réinitialiser le nom du projet
            this.currentProjectName = null;
            
            // Remettre les boutons et interface dans l'état initial
            this.resetUIToInitialState();
            
            // Mettre à jour l'état des outils de projet
            document.dispatchEvent(new CustomEvent('update-project-tools-state'));
        }

        // Rafraîchir l'interface après chargement
        refreshInterface() {
            // Remettre à jour tous les panneaux et contrôles
            document.dispatchEvent(new CustomEvent('update-layers-panel'));
            document.dispatchEvent(new CustomEvent('update-zoom-display'));
            document.dispatchEvent(new CustomEvent('update-ui-tools-state'));
            document.dispatchEvent(new CustomEvent('update-all-projections'));
            
            // Forcer l'ordre correct des calques après toutes les restaurations
            setTimeout(() => {
                this.enforceLayerOrdering();
            }, 200);
            
            // Réactiver le premier calque visible
            const firstVisibleLayer = this.state.layers.find(l => l.visible);
            if (firstVisibleLayer) {
                this.state.setActiveLayer(firstVisibleLayer.id);
            }
        }

        // Fonctions utilitaires
        sanitizeFileName(fileName) {
            // Remplacer les caractères non autorisés par des underscores
            return fileName.replace(/[<>:"/\\|?*]/g, '_').trim();
        }

        validateProjectData(data) {
            return data && 
                   data.version && 
                   data.state && 
                   Array.isArray(data.layers);
        }

        selectFile(accept = '') {
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = accept;
                input.onchange = (e) => {
                    resolve(e.target.files[0] || null);
                };
                input.click();
            });
        }

        readFileAsJson(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        resolve(data);
                    } catch (error) {
                        reject(new Error('Fichier JSON invalide'));
                    }
                };
                reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
                reader.readAsText(file);
            });
        }

        downloadFile(content, fileName, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // Forcer l'ordre correct des calques (fond → supplémentaires → dessin)
        enforceLayerOrdering() {
            console.log('🎨 [Z-INDEX] Application forcée de l\'ordre des calques');
            
            // Séparer les calques par type selon la même logique que lors du chargement
            const backgroundLayers = [];
            const supplementaryLayers = [];
            const drawingLayers = [];
            
            this.state.layers.forEach(layer => {
                if (layer.name === this.state.DRAWING_LAYER_NAME) {
                    // Calque de dessin principal
                    drawingLayers.push(layer);
                } else if (layer.name === "Plan rogné" || layer.name === "Image de fond") {
                    // Calques de fond spécifiques
                    backgroundLayers.push(layer);
                } else {
                    // Tous les autres calques (supplémentaires, y compris "Image collée")
                    supplementaryLayers.push(layer);
                }
            });
            
            console.log(`🎨 [Z-INDEX] ${backgroundLayers.length} fond, ${supplementaryLayers.length} supplémentaires, ${drawingLayers.length} dessin`);
            
            // Appliquer z-index avec échelonnement pour éviter les conflits
            // 1. Calques de fond : z-index 1-10
            backgroundLayers.forEach((layer, index) => {
                if (layer.wrapper) {
                    const zIndex = 1 + index;
                    layer.wrapper.style.setProperty('z-index', zIndex.toString(), 'important');
                    console.log(`🎨 [Z-INDEX] Calque fond "${layer.name}" z-index=${zIndex}`);
                    layer.wrapper.offsetHeight; // Force reflow
                }
            });
            
            // 2. Calques supplémentaires : z-index 50-90
            supplementaryLayers.forEach((layer, index) => {
                if (layer.wrapper) {
                    const zIndex = 50 + index;
                    layer.wrapper.style.setProperty('z-index', zIndex.toString(), 'important');
                    console.log(`🎨 [Z-INDEX] Calque supplémentaire "${layer.name}" z-index=${zIndex}`);
                    layer.wrapper.offsetHeight; // Force reflow
                }
            });
            
            // 3. Calques de dessin : z-index 100+
            drawingLayers.forEach((layer, index) => {
                if (layer.wrapper) {
                    const zIndex = 100 + index;
                    layer.wrapper.style.setProperty('z-index', zIndex.toString(), 'important');
                    console.log(`🎨 [Z-INDEX] Calque dessin "${layer.name}" z-index=${zIndex}`);
                    layer.wrapper.offsetHeight; // Force reflow
                }
            });
            
            console.log('✅ [Z-INDEX] Ordre des calques appliqué : fond (1+) → supplémentaires (50+) → dessin (100+)');
        }

        // Remettre l'interface dans son état initial
        resetUIToInitialState() {
            // Remettre le message de guidage initial et effacer tout contenu d'étape
            const guideMessage = document.getElementById('guide-message');
            if (guideMessage) {
                guideMessage.innerHTML = '<h2>Bienvenue dans l\'éditeur de plans</h2><p><strong>1.</strong> Commencez par lire les <strong>Instructions de départ</strong> en cliquant sur le bouton en haut à droite.</p><p><strong>2.</strong> Ensuite, ajoutez une image de fond en utilisant le bouton 🖼️ dans la barre des calques en bas.</p>';
                guideMessage.style.display = 'block';
            }
            
            // Réinitialiser les boutons undo/redo
            const undoBtn = document.getElementById('btn-undo');
            const redoBtn = document.getElementById('btn-redo');
            if (undoBtn) undoBtn.disabled = true;
            if (redoBtn) redoBtn.disabled = true;
            
            // Réinitialiser le bouton save-project
            const saveBtn = document.getElementById('btn-save-project');
            if (saveBtn) saveBtn.disabled = true;
            
            // Remettre le mode select par défaut
            const selectBtn = document.getElementById('btn-select');
            if (selectBtn) {
                // Désactiver tous les autres boutons d'outils
                document.querySelectorAll('.tool.active').forEach(btn => {
                    btn.classList.remove('active');
                });
                selectBtn.classList.add('active');
            }
            
            // Réinitialiser la liste des calques
            const layersList = document.getElementById('layers-list');
            if (layersList) {
                layersList.innerHTML = '';
            }
            
            // Réinitialiser le bouton start-drawing (il sera affiché quand nécessaire selon le workflow)
            const startDrawingBtn = document.getElementById('start-drawing-btn');
            if (startDrawingBtn) {
                startDrawingBtn.disabled = false;  // Réactiver le bouton
                startDrawingBtn.style.display = 'none';  // Sera géré par updateUIToolsState
            }
            
            console.log('🔄 Interface remise dans l\'état initial');
        }

        // Ajuster le zoom et centrer les calques pour afficher tout le contenu
        fitAndCenterLayers() {
            if (this.state.layers.length === 0) {
                console.log('📏 Aucun calque à ajuster');
                return;
            }

            // Calculer la boîte englobante de tous les calques
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            let hasContent = false;

            this.state.layers.forEach(layer => {
                if (!layer.wrapper || !layer.visible) return;

                // Obtenir les dimensions et position du calque
                const layerWidth = layer.fabricCanvas.width;
                const layerHeight = layer.fabricCanvas.height;
                const layerX = layer.x || 0;
                const layerY = layer.y || 0;

                // Calculer les coins du calque
                const left = layerX;
                const top = layerY;
                const right = layerX + layerWidth;
                const bottom = layerY + layerHeight;

                // Mettre à jour la boîte englobante
                minX = Math.min(minX, left);
                minY = Math.min(minY, top);
                maxX = Math.max(maxX, right);
                maxY = Math.max(maxY, bottom);
                hasContent = true;

                console.log(`📏 Calque "${layer.name}": ${layerWidth}x${layerHeight} à (${layerX}, ${layerY})`);
            });

            if (!hasContent) {
                console.log('📏 Aucun contenu visible à ajuster');
                return;
            }

            // Dimensions totales du contenu
            const contentWidth = maxX - minX;
            const contentHeight = maxY - minY;
            const contentCenterX = minX + contentWidth / 2;
            const contentCenterY = minY + contentHeight / 2;

            console.log(`📏 Contenu total: ${contentWidth}x${contentHeight}, centre: (${contentCenterX}, ${contentCenterY})`);

            // Obtenir les dimensions de la zone d'affichage
            const container = document.getElementById('canvas-container');
            const containerRect = container.getBoundingClientRect();
            const viewportWidth = containerRect.width;
            const viewportHeight = containerRect.height;

            // Calculer le zoom pour afficher tout le contenu avec une marge
            const margin = 50; // Marge en pixels
            const zoomX = (viewportWidth - 2 * margin) / contentWidth;
            const zoomY = (viewportHeight - 2 * margin) / contentHeight;
            const optimalZoom = Math.min(zoomX, zoomY, this.state.MAX_ZOOM || 3);
            const finalZoom = Math.max(optimalZoom, this.state.MIN_ZOOM || 0.1);

            console.log(`📏 Zoom calculé: ${finalZoom} (viewport: ${viewportWidth}x${viewportHeight})`);

            // Appliquer le zoom
            this.state.zoom = finalZoom;
            document.getElementById('zoom-wrapper').style.transform = `scale(${finalZoom})`;

            // Centrer le contenu
            const scaledContentCenterX = contentCenterX * finalZoom;
            const scaledContentCenterY = contentCenterY * finalZoom;
            
            const scrollLeft = scaledContentCenterX - viewportWidth / 2;
            const scrollTop = scaledContentCenterY - viewportHeight / 2;

            container.scrollLeft = Math.max(0, scrollLeft);
            container.scrollTop = Math.max(0, scrollTop);

            // Mettre à jour l'affichage du niveau de zoom
            const eventManager = window.PlanEditor.instances.eventManager;
            if (eventManager) {
                eventManager.updateScrollContentSize();
                eventManager.uiManager.updateZoomDisplay();
            }

            console.log(`✅ Zoom ajusté à ${Math.round(finalZoom * 100)}% et contenu centré`);
        }

        showNotification(message, type = 'info') {
            // Créer une notification temporaire
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                font-weight: bold;
                z-index: 10000;
                transition: opacity 0.3s;
                ${type === 'success' ? 'background-color: #4CAF50;' : ''}
                ${type === 'error' ? 'background-color: #f44336;' : ''}
                ${type === 'info' ? 'background-color: #2196F3;' : ''}
            `;
            
            document.body.appendChild(notification);
            
            // Supprimer après 3 secondes
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }

        // Exporter/Importer depuis/vers le presse-papiers (pour les projets simples)
        async exportToClipboard() {
            try {
                const projectData = this.state.serializeForSave();
                const jsonData = JSON.stringify(projectData);
                
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(jsonData);
                    this.showNotification('Projet copié dans le presse-papiers !', 'success');
                } else {
                    // Fallback pour les navigateurs plus anciens
                    const textArea = document.createElement('textarea');
                    textArea.value = jsonData;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    this.showNotification('Projet copié dans le presse-papiers !', 'success');
                }
                
                return true;
            } catch (error) {
                console.error('❌ Erreur export presse-papiers:', error);
                this.showNotification('Erreur lors de la copie', 'error');
                return false;
            }
        }

        async importFromClipboard() {
            try {
                let clipboardData;
                
                if (navigator.clipboard && navigator.clipboard.readText) {
                    clipboardData = await navigator.clipboard.readText();
                } else {
                    clipboardData = prompt('Collez les données du projet ici :');
                    if (!clipboardData) return false;
                }
                
                const projectData = JSON.parse(clipboardData);
                
                if (!this.validateProjectData(projectData)) {
                    throw new Error('Données de projet invalides');
                }
                
                await this.loadProjectData(projectData);
                this.showNotification('Projet importé depuis le presse-papiers !', 'success');
                
                return true;
            } catch (error) {
                console.error('❌ Erreur import presse-papiers:', error);
                this.showNotification('Erreur lors de l\'importation: ' + error.message, 'error');
                return false;
            }
        }
    }

    // Exposer dans le namespace global
    window.PlanEditor.ProjectManager = ProjectManager;

})();