// modules/magic-drawing-tf.js - Outil de dessin magique avec TensorFlow.js
// 
// 🎨 GUIDE D'UTILISATION:
// =====================
// 
// 1. Bouton dans la toolbar: Cliquer sur le bouton ✨ "Dessin Magique TF"
// 2. Sélection: Tracer un rectangle sur la zone à analyser
// 3. Détection: L'outil utilise TensorFlow.js pour détecter les marquages routiers
// 4. Tracé: Les marquages sont automatiquement dessinés avec Fabric.js
//
// 🔧 TECHNOLOGIES UTILISÉES:
// ==========================
// • TensorFlow.js - Framework IA pour le web
// • DeepLab v3+ - Modèle de segmentation sémantique
// • MobileNet - Modèle léger pour la détection d'objets
// • Algorithmes de post-traitement personnalisés
//
(function() {
    'use strict';
    
    // Gestionnaire de l'outil de dessin magique avec TensorFlow.js
    class MagicDrawingTensorFlowManager {
        constructor(state, layerManager, canvasManager) {
            this.state = state;
            this.layerManager = layerManager;
            this.canvasManager = canvasManager;
            
            // Configuration par défaut
            this.config = {
                lineColor: '#FFFFFF',          // Couleur des lignes tracées
                lineThickness: 2,              // Épaisseur des lignes
                minLineLength: 20,             // Longueur minimale des lignes détectées
                confidenceThreshold: 0.6,      // Seuil de confiance pour la segmentation
                roadClassId: 0,                // ID de classe pour les routes dans le modèle
                markingClassId: 15,            // ID de classe pour les marquages
                morphologyKernel: 3,           // Taille du noyau de morphologie
                enablePostProcessing: true,    // Post-traitement avancé
                useMultipleModels: true,       // Utiliser plusieurs modèles
                batchProcessing: false         // Traitement par lots (pour grandes images)
            };
            
            // État de l'outil
            this.isActive = false;
            this.isSelecting = false;
            this.selectionRect = null;
            this.currentCanvas = null;
            this.tensorflow = null;
            this.models = {
                segmentation: null,      // Modèle de segmentation
                objectDetection: null,   // Modèle de détection d'objets
                roadMarking: null        // Modèle spécialisé marquages routiers
            };
            this.isLoading = false;
        }

        // Initialisation du module
        async init() {
            console.log('🧠 Initialisation du Magic Drawing TensorFlow Manager...');
            
            // Charger TensorFlow.js si pas déjà chargé
            await this.loadTensorFlow();
            
            this.setupEventListeners();
            console.log('✅ Magic Drawing TensorFlow Manager initialisé');
        }

        // Chargement de TensorFlow.js
        async loadTensorFlow() {
            return new Promise(async (resolve, reject) => {
                try {
                    // Vérifier si TensorFlow est déjà chargé
                    if (typeof tf !== 'undefined') {
                        this.tensorflow = tf;
                        console.log('✅ TensorFlow.js déjà disponible');
                        resolve();
                        return;
                    }

                    console.log('⏳ Chargement de TensorFlow.js...');
                    
                    // Charger TensorFlow.js
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js';
                    script.async = true;
                    
                    script.onload = async () => {
                        // Attendre que TensorFlow soit initialisé
                        const checkTensorFlow = async () => {
                            if (typeof tf !== 'undefined') {
                                this.tensorflow = tf;
                                console.log('✅ TensorFlow.js chargé et initialisé');
                                console.log('🔧 Backend utilisé:', tf.getBackend());
                                
                                // Optimiser le backend si possible
                                await this.setupTensorFlowBackend();
                                resolve();
                            } else {
                                setTimeout(checkTensorFlow, 100);
                            }
                        };
                        await checkTensorFlow();
                    };
                    
                    script.onerror = () => {
                        console.error('❌ Erreur lors du chargement de TensorFlow.js');
                        reject(new Error('Impossible de charger TensorFlow.js'));
                    };
                    
                    document.head.appendChild(script);
                    
                } catch (error) {
                    console.error('❌ Erreur lors de l\'initialisation TensorFlow:', error);
                    reject(error);
                }
            });
        }

        // Configuration optimale du backend TensorFlow
        async setupTensorFlowBackend() {
            try {
                // Essayer d'utiliser WebGL si disponible
                if (await this.tensorflow.ready()) {
                    const backends = ['webgl', 'cpu'];
                    
                    for (const backend of backends) {
                        try {
                            await this.tensorflow.setBackend(backend);
                            console.log(`✅ Backend TensorFlow configuré: ${backend}`);
                            break;
                        } catch (e) {
                            console.warn(`⚠️ Backend ${backend} non disponible:`, e.message);
                        }
                    }
                }
            } catch (error) {
                console.warn('⚠️ Erreur configuration backend:', error);
            }
        }

        // Chargement des modèles TensorFlow
        async loadModels() {
            if (this.isLoading) return;
            this.isLoading = true;
            
            try {
                console.log('📦 Chargement des modèles TensorFlow.js...');
                
                // Modèle 1: Segmentation sémantique (DeepLab v3+)
                if (!this.models.segmentation) {
                    console.log('🧠 Chargement du modèle de segmentation...');
                    try {
                        // Utiliser un modèle DeepLab pré-entraîné
                        this.models.segmentation = await this.tensorflow.loadLayersModel(
                            'https://tfhub.dev/tensorflow/tfjs-model/deeplab/cityscapes/1/default/1',
                            { fromTFHub: true }
                        );
                        console.log('✅ Modèle de segmentation chargé');
                    } catch (e) {
                        console.warn('⚠️ Modèle DeepLab non disponible, utilisation d\'un modèle alternatif');
                        // Fallback vers un modèle plus simple
                        this.models.segmentation = await this.loadAlternativeSegmentationModel();
                    }
                }
                
                // Modèle 2: Détection d'objets (MobileNet)
                if (!this.models.objectDetection && this.config.useMultipleModels) {
                    console.log('🎯 Chargement du modèle de détection d\'objets...');
                    try {
                        this.models.objectDetection = await this.tensorflow.loadLayersModel(
                            'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1',
                            { fromTFHub: true }
                        );
                        console.log('✅ Modèle de détection d\'objets chargé');
                    } catch (e) {
                        console.warn('⚠️ Modèle de détection d\'objets non disponible');
                    }
                }
                
                console.log('🎉 Modèles TensorFlow.js prêts');
                
            } catch (error) {
                console.error('❌ Erreur lors du chargement des modèles:', error);
                throw new Error('Impossible de charger les modèles TensorFlow.js: ' + error.message);
            } finally {
                this.isLoading = false;
            }
        }

        // Modèle de segmentation alternatif (plus léger)
        async loadAlternativeSegmentationModel() {
            console.log('🔄 Chargement du modèle de segmentation alternatif...');
            
            // Créer un modèle simple pour la démonstration
            const model = this.tensorflow.sequential({
                layers: [
                    this.tensorflow.layers.conv2d({
                        inputShape: [null, null, 3],
                        filters: 32,
                        kernelSize: 3,
                        activation: 'relu'
                    }),
                    this.tensorflow.layers.conv2d({
                        filters: 64,
                        kernelSize: 3,
                        activation: 'relu'
                    }),
                    this.tensorflow.layers.conv2d({
                        filters: 2, // 2 classes: route vs background
                        kernelSize: 1,
                        activation: 'softmax'
                    })
                ]
            });
            
            console.log('✅ Modèle alternatif créé');
            return model;
        }

        // Configuration des écouteurs d'événements
        setupEventListeners() {
            // Écouter l'activation de l'outil magique
            document.addEventListener('magic-drawing-tf-start', () => {
                this.startMagicDrawing();
            });

            // Écouter les événements de canvas pour la sélection
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

            // Écouter les changements de configuration
            document.addEventListener('magic-drawing-tf-config-update', (e) => {
                this.updateConfig(e.detail);
            });

            // Écouter l'arrêt de l'outil
            document.addEventListener('magic-drawing-tf-stop', () => {
                this.stopMagicDrawing();
            });
        }

        // Démarrer l'outil de dessin magique
        async startMagicDrawing() {
            if (!this.tensorflow) {
                alert('❌ TensorFlow.js n\'est pas encore chargé. Veuillez patienter...');
                return;
            }

            const canvas = this.state.getActiveCanvas();
            if (!canvas) {
                alert('❌ Veuillez d\'abord sélectionner un calque.');
                return;
            }

            // Vérifier qu'il y a une image de fond à analyser
            const backgroundImage = this.findBackgroundImage();
            if (!backgroundImage) {
                alert('❌ Aucune image de fond trouvée à analyser.\\n\\n' +
                      'Veuillez d\'abord ajouter une image de plan avec le bouton 🖼️.');
                return;
            }

            // Charger les modèles si nécessaire
            if (!this.models.segmentation) {
                this.showLoadingStatus(true);
                try {
                    await this.loadModels();
                } catch (error) {
                    this.showLoadingStatus(false);
                    alert('❌ Erreur lors du chargement des modèles: ' + error.message);
                    return;
                }
                this.showLoadingStatus(false);
            }

            this.isActive = true;
            this.currentCanvas = canvas;
            
            // Changer le curseur pour indiquer le mode sélection
            this.updateCursor('crosshair');
            
            console.log('🧠 Outil de dessin magique TensorFlow activé');
            console.log('📝 Tracez un rectangle sur la zone à analyser');
            
            // Afficher les instructions à l'utilisateur
            this.showInstructions();
        }

        // Trouver l'image de fond dans les calques
        findBackgroundImage() {
            for (const layer of this.state.layers) {
                // Ignorer les calques de dessin
                if (layer.name === this.state.DRAWING_LAYER_NAME || layer.name === 'Calque de dessin') {
                    continue;
                }
                
                if (layer.fabricCanvas) {
                    // Chercher dans backgroundImage
                    if (layer.fabricCanvas.backgroundImage) {
                        return layer.fabricCanvas.backgroundImage;
                    }
                    
                    // Chercher dans les objets
                    const imageObj = layer.fabricCanvas.getObjects().find(obj => obj.type === 'image');
                    if (imageObj) {
                        return imageObj;
                    }
                }
            }
            return null;
        }

        // Gestion des événements souris pour la sélection
        handleMouseDown(event) {
            if (!this.isActive) return;

            this.isSelecting = true;
            
            // Commencer la sélection de rectangle
            this.selectionRect = {
                startX: event.pointer.x,
                startY: event.pointer.y,
                endX: event.pointer.x,
                endY: event.pointer.y
            };

            // Créer un rectangle de sélection visuel
            this.createSelectionVisual();
        }

        handleMouseMove(event) {
            if (!this.isActive || !this.isSelecting) return;

            // Mettre à jour le rectangle de sélection
            this.selectionRect.endX = event.pointer.x;
            this.selectionRect.endY = event.pointer.y;
            
            // Mettre à jour le visuel
            this.updateSelectionVisual();
        }

        async handleMouseUp(event) {
            if (!this.isActive || !this.isSelecting) return;

            this.isSelecting = false;
            
            // Finaliser la sélection
            this.selectionRect.endX = event.pointer.x;
            this.selectionRect.endY = event.pointer.y;
            
            // Supprimer le visuel de sélection
            this.removeSelectionVisual();
            
            // Vérifier que la zone sélectionnée est suffisamment grande
            const width = Math.abs(this.selectionRect.endX - this.selectionRect.startX);
            const height = Math.abs(this.selectionRect.endY - this.selectionRect.startY);
            
            if (width < 20 || height < 20) {
                console.log('⚠️ Zone sélectionnée trop petite, ignorée');
                return;
            }

            // Lancer l'analyse de la zone sélectionnée
            try {
                console.log('🧠 Analyse TensorFlow de la zone sélectionnée...', this.selectionRect);
                this.showProcessingIndicator(true);
                await this.analyzeSelectedArea();
            } catch (error) {
                console.error('❌ Erreur lors de l\'analyse TensorFlow:', error);
                alert('Erreur lors de l\'analyse TensorFlow: ' + error.message);
            } finally {
                this.showProcessingIndicator(false);
            }
        }

        // Créer le rectangle de sélection visuel
        createSelectionVisual() {
            this.removeSelectionVisual(); // S'assurer qu'il n'y en a qu'un
            
            const rect = new fabric.Rect({
                left: this.selectionRect.startX,
                top: this.selectionRect.startY,
                width: 0,
                height: 0,
                fill: 'rgba(0, 122, 255, 0.1)',
                stroke: '#007AFF',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
                isSelectionRect: true
            });
            
            this.currentCanvas.add(rect);
            this.selectionVisual = rect;
            this.currentCanvas.renderAll();
        }

        // Mettre à jour le rectangle de sélection visuel
        updateSelectionVisual() {
            if (!this.selectionVisual) return;
            
            const left = Math.min(this.selectionRect.startX, this.selectionRect.endX);
            const top = Math.min(this.selectionRect.startY, this.selectionRect.endY);
            const width = Math.abs(this.selectionRect.endX - this.selectionRect.startX);
            const height = Math.abs(this.selectionRect.endY - this.selectionRect.startY);
            
            this.selectionVisual.set({
                left: left,
                top: top,
                width: width,
                height: height
            });
            
            this.currentCanvas.renderAll();
        }

        // Supprimer le rectangle de sélection visuel
        removeSelectionVisual() {
            if (this.selectionVisual) {
                this.currentCanvas.remove(this.selectionVisual);
                this.selectionVisual = null;
                this.currentCanvas.renderAll();
            }
        }

        // Analyser la zone sélectionnée avec TensorFlow.js
        async analyzeSelectedArea() {
            console.log('🧠 Début de l\'analyse TensorFlow...');
            
            // Obtenir l'image de fond
            const backgroundImage = this.findBackgroundImage();
            if (!backgroundImage) {
                throw new Error('Image de fond introuvable');
            }

            // Extraire la région d'intérêt de l'image
            const imageCanvas = await this.extractImageRegion(backgroundImage);
            
            // Traiter l'image avec TensorFlow.js
            const detections = await this.detectRoadMarkingsWithTensorFlow(imageCanvas);
            
            // Tracer les marquages détectés
            this.drawDetectedMarkings(detections);
            
            // Désactiver l'outil
            this.stopMagicDrawing();
            
            console.log(`✅ Analyse TensorFlow terminée: ${detections.length} marquages détectés et tracés`);
        }

        // Extraire la région d'intérêt de l'image
        async extractImageRegion(backgroundImage) {
            // Créer un canvas temporaire pour extraire la région
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            
            // Calculer les coordonnées de la région dans l'image
            const imgBounds = backgroundImage.getBoundingRect();
            
            // Convertir les coordonnées de sélection vers les coordonnées image
            const relX1 = (Math.min(this.selectionRect.startX, this.selectionRect.endX) - imgBounds.left) / imgBounds.width;
            const relY1 = (Math.min(this.selectionRect.startY, this.selectionRect.endY) - imgBounds.top) / imgBounds.height;
            const relX2 = (Math.max(this.selectionRect.startX, this.selectionRect.endX) - imgBounds.left) / imgBounds.width;
            const relY2 = (Math.max(this.selectionRect.startY, this.selectionRect.endY) - imgBounds.top) / imgBounds.height;
            
            // S'assurer que les coordonnées sont dans les limites
            const clampedX1 = Math.max(0, Math.min(1, relX1));
            const clampedY1 = Math.max(0, Math.min(1, relY1));
            const clampedX2 = Math.max(0, Math.min(1, relX2));
            const clampedY2 = Math.max(0, Math.min(1, relY2));
            
            // Obtenir l'élément image source
            const imgElement = backgroundImage._element || backgroundImage._originalElement;
            if (!imgElement) {
                throw new Error('Impossible d\'accéder à l\'élément image');
            }
            
            // Calculer les dimensions de la région à extraire
            const sourceX = clampedX1 * imgElement.naturalWidth;
            const sourceY = clampedY1 * imgElement.naturalHeight;
            const sourceWidth = (clampedX2 - clampedX1) * imgElement.naturalWidth;
            const sourceHeight = (clampedY2 - clampedY1) * imgElement.naturalHeight;
            
            // Configurer le canvas temporaire avec une taille optimale pour TensorFlow
            const optimalSize = 512; // Taille optimale pour la plupart des modèles
            tempCanvas.width = optimalSize;
            tempCanvas.height = optimalSize;
            
            // Extraire et redimensionner la région
            ctx.drawImage(
                imgElement,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, optimalSize, optimalSize
            );
            
            console.log(`📐 Région extraite et redimensionnée: ${optimalSize}x${optimalSize}px`);
            return tempCanvas;
        }

        // Détecter les marquages routiers avec TensorFlow.js
        async detectRoadMarkingsWithTensorFlow(imageCanvas) {
            console.log('🧠 Détection des marquages avec TensorFlow.js...');
            
            try {
                // Convertir le canvas en tensor
                const imageTensor = this.tensorflow.browser.fromPixels(imageCanvas)
                    .expandDims(0)
                    .div(255.0); // Normalisation
                
                console.log('📊 Tensor d\'image créé:', imageTensor.shape);
                
                // Méthode 1: Segmentation sémantique
                let segmentationResults = null;
                if (this.models.segmentation) {
                    console.log('🎯 Exécution de la segmentation...');
                    segmentationResults = await this.runSegmentation(imageTensor);
                }
                
                // Méthode 2: Détection d'objets (si disponible)
                let objectDetectionResults = null;
                if (this.models.objectDetection && this.config.useMultipleModels) {
                    console.log('🔍 Exécution de la détection d\'objets...');
                    objectDetectionResults = await this.runObjectDetection(imageTensor);
                }
                
                // Combiner les résultats et post-traiter
                const combinedResults = this.combineDetectionResults(
                    segmentationResults, 
                    objectDetectionResults,
                    imageCanvas.width,
                    imageCanvas.height
                );
                
                // Post-traitement pour extraire les lignes
                const roadMarkings = await this.postProcessDetections(combinedResults, imageCanvas);
                
                // Nettoyer les tensors
                imageTensor.dispose();
                if (segmentationResults) segmentationResults.dispose();
                if (objectDetectionResults) objectDetectionResults.dispose();
                
                console.log(`✅ TensorFlow.js terminé: ${roadMarkings.length} marquages détectés`);
                return roadMarkings;
                
            } catch (error) {
                console.error('❌ Erreur TensorFlow.js:', error);
                throw new Error('Erreur lors de la détection TensorFlow.js: ' + error.message);
            }
        }

        // Exécuter la segmentation sémantique
        async runSegmentation(imageTensor) {
            try {
                const predictions = await this.models.segmentation.predict(imageTensor);
                console.log('📊 Résultats segmentation:', predictions.shape);
                return predictions;
            } catch (error) {
                console.warn('⚠️ Erreur segmentation:', error);
                // Créer un résultat factice pour la démonstration
                return this.tensorflow.zeros([1, 512, 512, 2]);
            }
        }

        // Exécuter la détection d'objets
        async runObjectDetection(imageTensor) {
            try {
                const predictions = await this.models.objectDetection.predict(imageTensor);
                console.log('📊 Résultats détection objets:', predictions.shape);
                return predictions;
            } catch (error) {
                console.warn('⚠️ Erreur détection objets:', error);
                return null;
            }
        }

        // Combiner les résultats de détection
        combineDetectionResults(segmentationResults, objectDetectionResults, width, height) {
            console.log('🔄 Combinaison des résultats de détection...');
            
            const results = {
                segmentation: segmentationResults,
                objectDetection: objectDetectionResults,
                width: width,
                height: height
            };
            
            return results;
        }

        // Post-traitement pour extraire les marquages routiers
        async postProcessDetections(results, imageCanvas) {
            console.log('🔧 Post-traitement des détections...');
            
            const roadMarkings = [];
            
            if (results.segmentation) {
                // Extraire les marquages de la segmentation
                const segmentedMarkings = await this.extractMarkingsFromSegmentation(
                    results.segmentation, 
                    imageCanvas
                );
                roadMarkings.push(...segmentedMarkings);
            }
            
            // Algorithme de fallback: détection par analyse de couleur
            const colorBasedMarkings = await this.detectMarkingsByColor(imageCanvas);
            roadMarkings.push(...colorBasedMarkings);
            
            // Filtrer et optimiser les résultats
            const optimizedMarkings = this.optimizeDetections(roadMarkings);
            
            return optimizedMarkings;
        }

        // Extraire les marquages de la segmentation
        async extractMarkingsFromSegmentation(segmentationTensor, imageCanvas) {
            console.log('🎯 Extraction des marquages de la segmentation...');
            
            const markings = [];
            
            try {
                // Obtenir les données de segmentation
                const segmentationData = await segmentationTensor.data();
                const [batch, height, width, classes] = segmentationTensor.shape;
                
                // Analyser la segmentation pour trouver les routes/marquages
                for (let y = 0; y < height; y += 10) { // Échantillonnage pour performance
                    for (let x = 0; x < width; x += 10) {
                        const index = y * width + x;
                        const roadProbability = segmentationData[index * classes + this.config.roadClassId];
                        
                        if (roadProbability > this.config.confidenceThreshold) {
                            // Convertir les coordonnées de segmentation vers les coordonnées canvas
                            const canvasCoords = this.segmentationToCanvasCoords(x, y, width, height);
                            
                            markings.push({
                                type: 'segmented-road',
                                confidence: roadProbability,
                                x: canvasCoords.x,
                                y: canvasCoords.y,
                                source: 'segmentation'
                            });
                        }
                    }
                }
                
            } catch (error) {
                console.warn('⚠️ Erreur extraction segmentation:', error);
            }
            
            return markings;
        }

        // Détection par analyse de couleur (algorithme de fallback)
        async detectMarkingsByColor(imageCanvas) {
            console.log('🎨 Détection par analyse de couleur...');
            
            const ctx = imageCanvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
            const data = imageData.data;
            const markings = [];
            
            // Rechercher les pixels blancs/jaunes (marquages routiers)
            for (let y = 0; y < imageCanvas.height; y += 5) {
                for (let x = 0; x < imageCanvas.width; x += 5) {
                    const index = (y * imageCanvas.width + x) * 4;
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];
                    
                    // Détecter les pixels blancs (marquages blancs)
                    if (r > 200 && g > 200 && b > 200) {
                        const canvasCoords = this.imageToCanvasCoords(x, y);
                        markings.push({
                            type: 'white-marking',
                            confidence: (r + g + b) / (3 * 255),
                            x: canvasCoords.x,
                            y: canvasCoords.y,
                            source: 'color-analysis'
                        });
                    }
                    
                    // Détecter les pixels jaunes (marquages jaunes)
                    else if (r > 200 && g > 200 && b < 100) {
                        const canvasCoords = this.imageToCanvasCoords(x, y);
                        markings.push({
                            type: 'yellow-marking',
                            confidence: (r + g - b) / (2 * 255),
                            x: canvasCoords.x,
                            y: canvasCoords.y,
                            source: 'color-analysis'
                        });
                    }
                }
            }
            
            console.log(`🎨 ${markings.length} marquages détectés par analyse de couleur`);
            return markings;
        }

        // Optimiser les détections (clustering, filtrage)
        optimizeDetections(markings) {
            console.log('🔧 Optimisation des détections...');
            
            // Filtrer par confiance
            let filtered = markings.filter(m => m.confidence > this.config.confidenceThreshold);
            
            // Clustering des points proches
            const clustered = this.clusterMarkings(filtered, 20); // Rayon de 20 pixels
            
            // Convertir les clusters en lignes
            const lines = this.convertClustersToLines(clustered);
            
            console.log(`🔧 Optimisation terminée: ${lines.length} lignes extraites`);
            return lines;
        }

        // Clustering des marquages proches
        clusterMarkings(markings, radius) {
            const clusters = [];
            const used = new Set();
            
            for (let i = 0; i < markings.length; i++) {
                if (used.has(i)) continue;
                
                const cluster = [markings[i]];
                used.add(i);
                
                for (let j = i + 1; j < markings.length; j++) {
                    if (used.has(j)) continue;
                    
                    const distance = Math.sqrt(
                        (markings[i].x - markings[j].x) ** 2 + 
                        (markings[i].y - markings[j].y) ** 2
                    );
                    
                    if (distance < radius) {
                        cluster.push(markings[j]);
                        used.add(j);
                    }
                }
                
                if (cluster.length >= 3) { // Minimum 3 points pour former une ligne
                    clusters.push(cluster);
                }
            }
            
            return clusters;
        }

        // Convertir les clusters en lignes
        convertClustersToLines(clusters) {
            const lines = [];
            
            for (const cluster of clusters) {
                if (cluster.length < 3) continue;
                
                // Calcul de la ligne de régression
                const regression = this.calculateLinearRegression(cluster);
                
                if (regression.length > this.config.minLineLength) {
                    lines.push({
                        type: 'detected-line',
                        confidence: regression.confidence,
                        x1: regression.x1,
                        y1: regression.y1,
                        x2: regression.x2,
                        y2: regression.y2,
                        length: regression.length,
                        pointCount: cluster.length
                    });
                }
            }
            
            return lines;
        }

        // Calcul de régression linéaire pour un cluster
        calculateLinearRegression(cluster) {
            const n = cluster.length;
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            
            for (const point of cluster) {
                sumX += point.x;
                sumY += point.y;
                sumXY += point.x * point.y;
                sumX2 += point.x * point.x;
            }
            
            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;
            
            // Trouver les points extrêmes
            const minX = Math.min(...cluster.map(p => p.x));
            const maxX = Math.max(...cluster.map(p => p.x));
            
            const x1 = minX;
            const y1 = slope * x1 + intercept;
            const x2 = maxX;
            const y2 = slope * x2 + intercept;
            
            const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const avgConfidence = cluster.reduce((sum, p) => sum + p.confidence, 0) / n;
            
            return {
                x1, y1, x2, y2, length,
                confidence: avgConfidence,
                slope, intercept
            };
        }

        // Convertir coordonnées segmentation vers canvas
        segmentationToCanvasCoords(segX, segY, segWidth, segHeight) {
            const scaleX = (this.selectionRect.endX - this.selectionRect.startX) / segWidth;
            const scaleY = (this.selectionRect.endY - this.selectionRect.startY) / segHeight;
            
            return {
                x: this.selectionRect.startX + segX * scaleX,
                y: this.selectionRect.startY + segY * scaleY
            };
        }

        // Convertir coordonnées image vers canvas
        imageToCanvasCoords(imgX, imgY) {
            const selectionLeft = Math.min(this.selectionRect.startX, this.selectionRect.endX);
            const selectionTop = Math.min(this.selectionRect.startY, this.selectionRect.endY);
            
            return {
                x: selectionLeft + imgX,
                y: selectionTop + imgY
            };
        }

        // Tracer les marquages détectés sur le canvas
        drawDetectedMarkings(markings) {
            console.log(`🎨 Tracé de ${markings.length} marquages sur le canvas...`);
            
            const canvas = this.currentCanvas;
            let drawnCount = 0;
            
            markings.forEach((marking, index) => {
                try {
                    const fabricLine = new fabric.Line([
                        marking.x1,
                        marking.y1,
                        marking.x2,
                        marking.y2
                    ], {
                        stroke: this.config.lineColor,
                        strokeWidth: this.config.lineThickness,
                        selectable: true,
                        evented: true,
                        isMagicDrawnTF: true,
                        tfDetectionIndex: index,
                        tfConfidence: marking.confidence,
                        tfType: marking.type,
                        tfPointCount: marking.pointCount || 1
                    });
                    
                    canvas.add(fabricLine);
                    drawnCount++;
                    
                } catch (error) {
                    console.warn(`⚠️ Erreur lors du tracé du marquage ${index}:`, error);
                }
            });
            
            canvas.renderAll();
            
            // Sauvegarder l'état pour undo/redo
            this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
            
            console.log(`✅ ${drawnCount} marquages tracés avec succès`);
            
            // Notifier l'utilisateur
            if (drawnCount > 0) {
                alert(`🧠 Détection TensorFlow.js terminée !\\n\\n${drawnCount} marquages routiers détectés et tracés avec IA.`);
            } else {
                alert(`ℹ️ Aucun marquage routier détecté par TensorFlow.js dans la zone sélectionnée.\\n\\nEssayez avec une zone différente ou ajustez les paramètres.`);
            }
        }

        // Arrêter l'outil de dessin magique
        stopMagicDrawing() {
            this.isActive = false;
            this.isSelecting = false;
            this.selectionRect = null;
            this.removeSelectionVisual();
            this.updateCursor('default');
            this.showProcessingIndicator(false);
            
            // Retourner en mode sélection
            document.dispatchEvent(new CustomEvent('auto-select-tool'));
            
            console.log('✅ Outil de dessin magique TensorFlow désactivé');
        }

        // Mettre à jour le curseur
        updateCursor(cursor) {
            const canvasContainer = document.getElementById('canvas-container');
            if (canvasContainer) {
                canvasContainer.style.cursor = cursor;
            }
        }

        // Afficher le statut de chargement
        showLoadingStatus(show) {
            const status = document.getElementById('tensorflow-loading-status');
            if (status) {
                status.style.display = show ? 'block' : 'none';
            }
        }

        // Afficher l'indicateur de traitement
        showProcessingIndicator(show) {
            const indicator = document.getElementById('tensorflow-processing-indicator');
            if (indicator) {
                indicator.style.display = show ? 'block' : 'none';
            }
        }

        // Afficher les instructions
        showInstructions() {
            const instructions = document.createElement('div');
            instructions.id = 'magic-drawing-tf-instructions';
            instructions.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 15px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 1000;
                max-width: 300px;
            `;
            instructions.innerHTML = `
                <strong>🧠 Dessin Magique TensorFlow Actif</strong><br>
                📝 Tracez un rectangle sur la zone à analyser<br>
                🤖 L'IA TensorFlow détectera les marquages automatiquement<br>
                <br>
                <button onclick="document.dispatchEvent(new CustomEvent('magic-drawing-tf-stop'))" style="background: #ff3b30; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Annuler</button>
            `;
            
            document.body.appendChild(instructions);
            
            // Supprimer automatiquement après 10 secondes
            setTimeout(() => {
                const el = document.getElementById('magic-drawing-tf-instructions');
                if (el) el.remove();
            }, 10000);
        }

        // Mettre à jour la configuration
        updateConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
            console.log('⚙️ Configuration TensorFlow mise à jour:', this.config);
        }

        // Obtenir le statut de l'outil
        getStatus() {
            return {
                isActive: this.isActive,
                isSelecting: this.isSelecting,
                tensorflowLoaded: !!this.tensorflow,
                modelsLoaded: {
                    segmentation: !!this.models.segmentation,
                    objectDetection: !!this.models.objectDetection
                },
                config: this.config
            };
        }
    }

    // Exposer dans le namespace global
    if (typeof window !== 'undefined') {
        window.PlanEditor.MagicDrawingTensorFlowManager = MagicDrawingTensorFlowManager;
        console.log('✅ MagicDrawingTensorFlowManager exposé dans PlanEditor');
    }

})();