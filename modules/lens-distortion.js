// modules/lens-distortion.js - Correction de distortion d'objectif (lens distortion)
// Version sans modules ES6

(function() {
    'use strict';

    // Correcteur de distortion d'objectif (modèle de Brown-Conrady)
    class LensDistortionCorrector {
        constructor() {
            // Paramètres de distortion radiale (coefficients k1, k2, k3)
            this.k1 = 0;
            this.k2 = 0;
            this.k3 = 0;

            // Paramètres optiques (pour un ajustement plus précis)
            this.focalLength = 1000; // Valeur par défaut
            this.centerX = 0.5;      // Centre de l'image (coord normalisées)
            this.centerY = 0.5;
        }

        getParams() {
            return {
                k1: this.k1,
                k2: this.k2,
                k3: this.k3,
                focalLength: this.focalLength,
                centerX: this.centerX,
                centerY: this.centerY
            };
        }

        setParams(params) {
            // Support à la fois l'objet et les paramètres séparés
            if (typeof params === 'object') {
                if (params.k1 !== undefined) this.k1 = params.k1;
                if (params.k2 !== undefined) this.k2 = params.k2;
                if (params.k3 !== undefined) this.k3 = params.k3;
            } else {
                // Signature legacy: setParams(k1, k2, k3)
                this.k1 = arguments[0];
                this.k2 = arguments[1];
                this.k3 = arguments[2];
            }
        }

        resetToDefaults() {
            this.k1 = 0;
            this.k2 = 0;
            this.k3 = 0;
        }

        setOpticalParams(focalLength, centerX, centerY) {
            this.focalLength = focalLength;
            this.centerX = centerX;
            this.centerY = centerY;
        }

        // Corrige la distortion d'une image
        async correctDistortion(sourceImage) {
            return new Promise((resolve, reject) => {
                try {
                    const width = sourceImage.width;
                    const height = sourceImage.height;

                    // Créer un canvas pour l'image corrigée
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    // Dessiner l'image originale
                    ctx.drawImage(sourceImage, 0, 0);

                    // Obtenir les données de pixels
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const correctedData = ctx.createImageData(width, height);

                    // Si pas de distortion, retourner l'image originale
                    if (this.k1 === 0 && this.k2 === 0 && this.k3 === 0) {
                        resolve(sourceImage);
                        return;
                    }

                    // Centre de l'image en pixels
                    const cx = width * this.centerX;
                    const cy = height * this.centerY;

                    // Distance maximale du centre (coin le plus éloigné)
                    const maxDist = Math.sqrt(cx * cx + cy * cy);

                    // Parcourir chaque pixel de l'image de destination
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            // Coordonnées normalisées par rapport au centre
                            const dx = (x - cx) / maxDist;
                            const dy = (y - cy) / maxDist;

                            // Distance au centre (normalisée)
                            const r2 = dx * dx + dy * dy;
                            const r = Math.sqrt(r2);

                            // Facteur de distortion radiale
                            // rd = ru * (1 + k1*ru^2 + k2*ru^4 + k3*ru^6)
                            const distortionFactor = 1 + this.k1 * r2 + this.k2 * r2 * r2 + this.k3 * r2 * r2 * r2;

                            // Coordonnées dans l'image originale (avec distortion)
                            const srcX = Math.round(cx + dx * distortionFactor * maxDist);
                            const srcY = Math.round(cy + dy * distortionFactor * maxDist);

                            // Copier le pixel si dans les limites
                            const destIndex = (y * width + x) * 4;
                            if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                                const srcIndex = (srcY * width + srcX) * 4;
                                correctedData.data[destIndex] = imageData.data[srcIndex];
                                correctedData.data[destIndex + 1] = imageData.data[srcIndex + 1];
                                correctedData.data[destIndex + 2] = imageData.data[srcIndex + 2];
                                correctedData.data[destIndex + 3] = imageData.data[srcIndex + 3];
                            } else {
                                // Pixel noir (hors limites)
                                correctedData.data[destIndex] = 0;
                                correctedData.data[destIndex + 1] = 0;
                                correctedData.data[destIndex + 2] = 0;
                                correctedData.data[destIndex + 3] = 255;
                            }
                        }
                    }

                    // Mettre les données corrigées dans le canvas
                    ctx.putImageData(correctedData, 0, 0);

                    // Créer une image à partir du canvas
                    const correctedImage = new Image();
                    correctedImage.onload = () => resolve(correctedImage);
                    correctedImage.onerror = () => reject(new Error('Erreur lors de la création de l\'image corrigée'));
                    correctedImage.src = canvas.toDataURL();

                } catch (error) {
                    reject(error);
                }
            });
        }

        // Version optimisée pour la prévisualisation (résolution réduite)
        async correctDistortionPreview(sourceImage, maxSize = 350) {
            // Redimensionner l'image pour la prévisualisation
            const scale = Math.min(maxSize / sourceImage.width, maxSize / sourceImage.height);
            const width = Math.round(sourceImage.width * scale);
            const height = Math.round(sourceImage.height * scale);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(sourceImage, 0, 0, width, height);

            const tempImage = new Image();
            const tempPromise = new Promise((resolve, reject) => {
                tempImage.onload = () => this.correctDistortion(tempImage).then(resolve).catch(reject);
                tempImage.onerror = () => reject(new Error('Erreur lors de la prévisualisation'));
            });
            tempImage.src = tempCanvas.toDataURL();

            return tempPromise;
        }
    }

    // Créer le namespace des modules si nécessaire
    if (!window.PlanEditor.modules) {
        window.PlanEditor.modules = {};
    }

    // Exposer la classe
    window.PlanEditor.modules.LensDistortionCorrector = LensDistortionCorrector;

    console.log('✅ Module lens-distortion.js chargé');

})();
