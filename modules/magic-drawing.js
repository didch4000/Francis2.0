// modules/magic-drawing.js - Outil de dessin magique avec OpenCV
// 
// 🎨 GUIDE D'UTILISATION:
// =====================
// 
// 1. Bouton dans la toolbar: Cliquer sur le bouton ✨ "Dessin Magique"
// 2. Sélection: Tracer un rectangle sur la zone à analyser
// 3. Détection: L'outil utilise OpenCV.js pour détecter les lignes blanches
// 4. Tracé: Les marquages sont automatiquement dessinés avec Fabric.js
//
// 🔧 FONCTIONNALITÉS:
// ===================
// • Détection automatique des lignes de marquage routier
// • Sélection de zone d'intérêt par rectangle
// • Filtrage des lignes selon l'orientation et la longueur
// • Tracé automatique en superposition avec Fabric.js
// • Paramètres ajustables (sensibilité, épaisseur, couleur)
//
(function() {
    'use strict';
    
    // Gestionnaire de l'outil de dessin magique avec OpenCV
    class MagicDrawingManager {
        constructor(state, layerManager, canvasManager) {
            this.state = state;
            this.layerManager = layerManager;
            this.canvasManager = canvasManager;
            
            // Configuration par défaut
            this.config = {
                lineColor: '#FFFFFF',          // Couleur des lignes tracées
                lineThickness: 2,              // Épaisseur des lignes
                minLineLength: 30,             // Longueur minimale des lignes détectées
                cannyLow: 50,                  // Seuil bas pour Canny
                cannyHigh: 150,                // Seuil haut pour Canny
                houghThreshold: 50,            // Seuil pour HoughLinesP
                houghMinLineLength: 30,        // Longueur minimale pour Hough
                houghMaxLineGap: 10,           // Espacement maximal pour Hough
                filterVertical: true,          // Filtrer les lignes verticales
                filterHorizontal: true,        // Filtrer les lignes horizontales
                preprocess: true               // Préprocessing avancé de l'image
            };
            
            // État de l'outil
            this.isActive = false;
            this.isSelecting = false;
            this.selectionRect = null;
            this.currentCanvas = null;
            this.opencv = null; // Référence à OpenCV.js
        }

        // Initialisation du module
        async init() {
            console.log('✨ Initialisation du Magic Drawing Manager...');
            
            // Charger OpenCV.js si pas déjà chargé
            await this.loadOpenCV();
            
            this.setupEventListeners();
            console.log('✅ Magic Drawing Manager initialisé');
        }

        // Chargement d'OpenCV.js
        async loadOpenCV() {
            return new Promise((resolve, reject) => {
                // Vérifier si OpenCV est déjà chargé
                if (typeof cv !== 'undefined') {
                    this.opencv = cv;
                    console.log('✅ OpenCV.js déjà disponible');
                    resolve();
                    return;
                }

                console.log('⏳ Chargement d\'OpenCV.js...');
                
                // Charger le script OpenCV.js
                const script = document.createElement('script');
                script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
                script.async = true;
                
                script.onload = () => {
                    // Attendre que OpenCV soit initialisé
                    const checkOpenCV = () => {
                        if (typeof cv !== 'undefined' && cv.Mat) {
                            this.opencv = cv;
                            console.log('✅ OpenCV.js chargé et initialisé');
                            resolve();
                        } else {
                            setTimeout(checkOpenCV, 100);
                        }
                    };
                    checkOpenCV();
                };
                
                script.onerror = () => {
                    console.error('❌ Erreur lors du chargement d\'OpenCV.js');
                    reject(new Error('Impossible de charger OpenCV.js'));
                };
                
                document.head.appendChild(script);
            });
        }

        // Configuration des écouteurs d'événements
        setupEventListeners() {
            // Écouter l'activation de l'outil magique
            document.addEventListener('magic-drawing-start', () => {
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
            document.addEventListener('magic-drawing-config-update', (e) => {
                this.updateConfig(e.detail);
            });

            // Écouter l'arrêt de l'outil
            document.addEventListener('magic-drawing-stop', () => {
                this.stopMagicDrawing();
            });
        }

        // Démarrer l'outil de dessin magique
        startMagicDrawing() {
            if (!this.opencv) {
                alert('❌ OpenCV.js n\'est pas encore chargé. Veuillez patienter...');
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

            this.isActive = true;
            this.currentCanvas = canvas;
            
            // Changer le curseur pour indiquer le mode sélection
            this.updateCursor('crosshair');
            
            console.log('✨ Outil de dessin magique activé');
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
                console.log('🔍 Analyse de la zone sélectionnée...', this.selectionRect);
                await this.analyzeSelectedArea();
            } catch (error) {
                console.error('❌ Erreur lors de l\'analyse:', error);
                alert('Erreur lors de l\'analyse: ' + error.message);
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

        // Analyser la zone sélectionnée avec OpenCV
        async analyzeSelectedArea() {
            console.log('🔍 Début de l\'analyse OpenCV...');
            
            // Obtenir l'image de fond
            const backgroundImage = this.findBackgroundImage();
            if (!backgroundImage) {
                throw new Error('Image de fond introuvable');
            }

            // Extraire la région d'intérêt de l'image
            const imageCanvas = await this.extractImageRegion(backgroundImage);
            
            // Traiter l'image avec OpenCV
            const lines = await this.detectLinesWithOpenCV(imageCanvas);
            
            // Tracer les lignes détectées
            this.drawDetectedLines(lines);
            
            // Désactiver l'outil
            this.stopMagicDrawing();
            
            console.log(`✅ Analyse terminée: ${lines.length} lignes détectées et tracées`);
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
            
            // Configurer le canvas temporaire
            tempCanvas.width = sourceWidth;
            tempCanvas.height = sourceHeight;
            
            // Extraire la région
            ctx.drawImage(
                imgElement,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, sourceWidth, sourceHeight
            );
            
            console.log(`📐 Région extraite: ${sourceWidth}x${sourceHeight}px`);
            return tempCanvas;
        }

        // Détecter les lignes avec OpenCV
        async detectLinesWithOpenCV(imageCanvas) {
            console.log('🧠 Détection des lignes avec OpenCV...');
            
            try {
                // Charger l'image dans OpenCV
                const src = this.opencv.imread(imageCanvas);
                
                // Créer les matrices de travail
                const gray = new this.opencv.Mat();
                const blur = new this.opencv.Mat();
                const edges = new this.opencv.Mat();
                const lines = new this.opencv.Mat();
                
                // Étape 1: Conversion en niveaux de gris
                this.opencv.cvtColor(src, gray, this.opencv.COLOR_RGBA2GRAY);
                
                // Étape 2: Préprocessing pour améliorer la détection des lignes blanches
                if (this.config.preprocess) {
                    // Flouter légèrement pour réduire le bruit
                    this.opencv.GaussianBlur(gray, blur, new this.opencv.Size(3, 3), 0);
                    
                    // Améliorer le contraste pour les lignes blanches
                    this.opencv.threshold(blur, blur, 180, 255, this.opencv.THRESH_BINARY);
                } else {
                    gray.copyTo(blur);
                }
                
                // Étape 3: Détection des contours avec Canny
                this.opencv.Canny(blur, edges, this.config.cannyLow, this.config.cannyHigh);
                
                // Étape 4: Détection des lignes avec HoughLinesP
                this.opencv.HoughLinesP(
                    edges, 
                    lines, 
                    1,                              // Résolution rho (pixels)
                    Math.PI / 180,                  // Résolution theta (radians)
                    this.config.houghThreshold,     // Seuil de votes
                    this.config.houghMinLineLength, // Longueur minimale
                    this.config.houghMaxLineGap     // Espacement maximal
                );
                
                console.log(`📏 ${lines.rows} lignes détectées par OpenCV`);
                
                // Convertir les résultats en format utilisable
                const detectedLines = [];
                for (let i = 0; i < lines.rows; i++) {
                    const line = lines.data32S.slice(i * 4, i * 4 + 4);
                    const [x1, y1, x2, y2] = line;
                    
                    // Calculer les propriétés de la ligne
                    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                    
                    // Filtrer selon les critères
                    if (this.shouldKeepLine(length, angle)) {
                        detectedLines.push({
                            x1, y1, x2, y2,
                            length,
                            angle,
                            canvasCoords: this.convertToCanvasCoords(x1, y1, x2, y2)
                        });
                    }
                }
                
                // Nettoyer les matrices OpenCV
                src.delete();
                gray.delete();
                blur.delete();
                edges.delete();
                lines.delete();
                
                console.log(`✅ ${detectedLines.length} lignes conservées après filtrage`);
                return detectedLines;
                
            } catch (error) {
                console.error('❌ Erreur OpenCV:', error);
                throw new Error('Erreur lors de la détection OpenCV: ' + error.message);
            }
        }

        // Filtrer les lignes selon les critères
        shouldKeepLine(length, angle) {
            // Filtrer par longueur minimale
            if (length < this.config.minLineLength) {
                return false;
            }
            
            // Filtrer par orientation si demandé
            const absAngle = Math.abs(angle);
            
            // Ligne horizontale (±15°)
            const isHorizontal = absAngle < 15 || absAngle > 165;
            // Ligne verticale (±15° autour de 90°)
            const isVertical = (absAngle > 75 && absAngle < 105);
            
            if (!this.config.filterHorizontal && isHorizontal) {
                return false;
            }
            
            if (!this.config.filterVertical && isVertical) {
                return false;
            }
            
            return true;
        }

        // Convertir les coordonnées détectées vers les coordonnées canvas
        convertToCanvasCoords(x1, y1, x2, y2) {
            // Calculer les coordonnées dans le canvas principal
            const selectionLeft = Math.min(this.selectionRect.startX, this.selectionRect.endX);
            const selectionTop = Math.min(this.selectionRect.startY, this.selectionRect.endY);
            const selectionWidth = Math.abs(this.selectionRect.endX - this.selectionRect.startX);
            const selectionHeight = Math.abs(this.selectionRect.endY - this.selectionRect.startY);
            
            // Obtenir les dimensions de l'image extraite pour le calcul du ratio
            const backgroundImage = this.findBackgroundImage();
            if (!backgroundImage) {
                // Fallback: conversion directe
                return {
                    x1: selectionLeft + x1,
                    y1: selectionTop + y1,
                    x2: selectionLeft + x2,
                    y2: selectionTop + y2
                };
            }
            
            // Les coordonnées x1,y1,x2,y2 sont en pixels de l'image extraite
            // Nous devons les re-projeter dans la zone de sélection
            return {
                x1: selectionLeft + x1,
                y1: selectionTop + y1,
                x2: selectionLeft + x2,
                y2: selectionTop + y2
            };
        }

        // Tracer les lignes détectées sur le canvas
        drawDetectedLines(lines) {
            console.log(`🎨 Tracé de ${lines.length} lignes sur le canvas...`);
            
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
                        isMagicDrawn: true,
                        magicDrawIndex: index,
                        originalLength: line.length,
                        originalAngle: line.angle
                    });
                    
                    canvas.add(fabricLine);
                    drawnCount++;
                    
                } catch (error) {
                    console.warn(`⚠️ Erreur lors du tracé de la ligne ${index}:`, error);
                }
            });
            
            canvas.renderAll();
            
            // Sauvegarder l'état pour undo/redo
            this.layerManager.undoRedoManager.saveState(canvas, this.state.getActiveLayer());
            
            console.log(`✅ ${drawnCount} lignes tracées avec succès`);
            
            // Notifier l'utilisateur
            if (drawnCount > 0) {
                alert(`✨ Dessin magique terminé !\\n\\n${drawnCount} marquages routiers détectés et tracés.`);
            } else {
                alert(`ℹ️ Aucun marquage routier détecté dans la zone sélectionnée.\\n\\nEssayez avec une zone différente ou ajustez les paramètres.`);
            }
        }

        // Arrêter l'outil de dessin magique
        stopMagicDrawing() {
            this.isActive = false;
            this.isSelecting = false;
            this.selectionRect = null;
            this.removeSelectionVisual();
            this.updateCursor('default');
            
            // Retourner en mode sélection
            document.dispatchEvent(new CustomEvent('auto-select-tool'));
            
            console.log('✅ Outil de dessin magique désactivé');
        }

        // Mettre à jour le curseur
        updateCursor(cursor) {
            const canvasContainer = document.getElementById('canvas-container');
            if (canvasContainer) {
                canvasContainer.style.cursor = cursor;
            }
        }

        // Afficher les instructions
        showInstructions() {
            const instructions = document.createElement('div');
            instructions.id = 'magic-drawing-instructions';
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
                backdrop-filter: blur(3px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            `;
            instructions.innerHTML = `
                <strong>✨ Dessin Magique Actif</strong><br>
                📝 Tracez un rectangle sur la zone à analyser<br>
                🔍 Les marquages routiers seront détectés automatiquement<br>
                <br>
                <button onclick="document.dispatchEvent(new CustomEvent('magic-drawing-stop'))" style="background: #ff3b30; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Annuler</button>
            `;
            
            document.body.appendChild(instructions);
            
            // Supprimer automatiquement après 10 secondes
            setTimeout(() => {
                const el = document.getElementById('magic-drawing-instructions');
                if (el) el.remove();
            }, 10000);
        }

        // Mettre à jour la configuration
        updateConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
            console.log('⚙️ Configuration mise à jour:', this.config);
        }

        // Obtenir le statut de l'outil
        getStatus() {
            return {
                isActive: this.isActive,
                isSelecting: this.isSelecting,
                opencvLoaded: !!this.opencv,
                config: this.config
            };
        }
    }

    // Exposer dans le namespace global
    if (typeof window !== 'undefined') {
        window.PlanEditor.MagicDrawingManager = MagicDrawingManager;
        console.log('✅ MagicDrawingManager exposé dans PlanEditor');
    }

})();