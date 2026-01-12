// modules/export.js - Version sans modules ES6
(function() {
    'use strict';
    
    // Gestionnaire d'exportation
    class ExportManager {
        constructor(state, layerManager) {
            this.state = state;
            this.layerManager = layerManager;
        }

        async exportToPNG() {
            if (this.state.layers.length === 0) {
                alert("Il n'y a rien à exporter.");
                return;
            }

            // Forcer le rendu de tous les calques avant l'exportation
            this.state.layers.forEach(l => {
                l.fabricCanvas.calcOffset(); // Recalculer les offsets pour assurer un rendu correct
                l.fabricCanvas.renderAll();
            });

            // Stratégie de détermination des dimensions de l'export :
            // 1. "Plan rogné" : C'est la référence absolue de la zone de travail si elle existe.
            // On utilise une recherche souple pour éviter les problèmes d'encodage (é)
            let referenceLayer = this.state.layers.find(l => l.name && (l.name === "Plan rogné" || l.name.indexOf('rogn') !== -1));

            // 2. "Calque de dessin" : Si pas de plan rogné, on utilise le calque de dessin.
            if (!referenceLayer) {
                referenceLayer = this.state.layers.find(l => l.name === this.state.DRAWING_LAYER_NAME);
            }

            // 3. Fallback : Le premier calque de la liste (Top Layer).
            if (!referenceLayer && this.state.layers.length > 0) {
                referenceLayer = this.state.layers[0];
            }

            // 4. Dernier recours
            if (!referenceLayer) {
                referenceLayer = this.state.layers[this.state.layers.length - 1];
            }

            console.log(`🖨️ [EXPORT] Dimensions basées sur le calque : "${referenceLayer ? referenceLayer.name : 'Aucun'}" (${referenceLayer ? referenceLayer.fabricCanvas.width : 0}x${referenceLayer ? referenceLayer.fabricCanvas.height : 0})`);

            if (referenceLayer) {
                // Vérification de cohérence : si les dimensions semblent aberrantes (> 4000px) alors que c'est un plan rogné,
                // il y a peut-être un problème de restauration.
                if (referenceLayer.fabricCanvas.width > 4000 && referenceLayer.name && referenceLayer.name.indexOf('rogn') !== -1) {
                     console.warn('⚠️ [EXPORT] Attention : Le plan rogné semble très grand. Vérifiez que le rognage a bien été appliqué.');
                }
            }

            // Calculer les dimensions finales
            let exportWidth = referenceLayer ? referenceLayer.fabricCanvas.width : 800;
            let exportHeight = referenceLayer ? referenceLayer.fabricCanvas.height : 600;

            // Si le calque de référence a une image de fond, on peut aussi vérifier ses dimensions naturelles
            if (referenceLayer && referenceLayer.fabricCanvas.backgroundImage) {
                const bgImage = referenceLayer.fabricCanvas.backgroundImage;
                const bgScaledWidth = bgImage.width * bgImage.scaleX;
                const bgScaledHeight = bgImage.height * bgImage.scaleY;
                
                if (exportWidth > bgScaledWidth + 5 && exportWidth > 2000) {
                    console.log(`🖨️ [EXPORT] Correction des dimensions basée sur l'image de fond: ${bgScaledWidth}x${bgScaledHeight} (Canvas: ${exportWidth}x${exportHeight})`);
                    exportWidth = Math.floor(bgScaledWidth);
                    exportHeight = Math.floor(bgScaledHeight);
                }
            }

            // Stratégie de secours ultime : Si le canvas reste immense (> 2000px), 
            // on regarde si le contenu du dessin est localisé et on rogne dessus.
            let contentBounds = null;
            if (exportWidth > 2000) {
                const drawingLayer = this.state.layers.find(l => l.name === this.state.DRAWING_LAYER_NAME);
                if (drawingLayer && drawingLayer.fabricCanvas.getObjects().length > 0) {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    let hasVisibleObjects = false;

                    drawingLayer.fabricCanvas.getObjects().forEach(obj => {
                        if (!obj.visible) return;
                        // getBoundingRect retourne les coordonnées absolues sur le canvas
                        const rect = obj.getBoundingRect();
                        if (rect.left < minX) minX = rect.left;
                        if (rect.top < minY) minY = rect.top;
                        if (rect.left + rect.width > maxX) maxX = rect.left + rect.width;
                        if (rect.top + rect.height > maxY) maxY = rect.top + rect.height;
                        hasVisibleObjects = true;
                    });

                    if (hasVisibleObjects) {
                        // Ajouter une marge confortable
                        const margin = 100;
                        minX = Math.max(0, minX - margin);
                        minY = Math.max(0, minY - margin);
                        // On ne dépasse pas les dimensions originales
                        maxX = Math.min(exportWidth, maxX + margin);
                        maxY = Math.min(exportHeight, maxY + margin);
                        
                        const boundsWidth = maxX - minX;
                        const boundsHeight = maxY - minY;

                        // Si la zone de dessin est significativement plus petite que le canvas géant (< 80%)
                        if (boundsWidth < exportWidth * 0.8) {
                            console.log(`✂️ [EXPORT] Rognage automatique sur le contenu du dessin: ${boundsWidth}x${boundsHeight} à (${minX},${minY})`);
                            exportWidth = Math.floor(boundsWidth);
                            exportHeight = Math.floor(boundsHeight);
                            contentBounds = { x: minX, y: minY };
                        }
                    }
                }
            }

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = exportWidth;
            tempCanvas.height = exportHeight;
            const tempCtx = tempCanvas.getContext('2d');

            // Appliquer le décalage si on a rogné sur le contenu
            if (contentBounds) {
                tempCtx.translate(-contentBounds.x, -contentBounds.y);
            }

            // Dessiner les calques du bas vers le haut, de manière asynchrone
            for (const layer of [...this.state.layers].reverse()) {
                if (layer.visible) {
                    // 1. Rendre le calque en data URL pour intégrer toutes les transformations internes
                    const dataUrl = layer.fabricCanvas.toDataURL({ format: 'png' });
                    
                    // 2. Charger cette data URL dans un objet image
                    const layerImage = await new Promise(resolve => {
                        const img = new Image();
                        img.onload = () => resolve(img);
                        img.onerror = () => resolve(null);
                        img.src = dataUrl;
                    });

                    if (layerImage) {
                        // 3. Dessiner l'image correctement rendue sur le canvas d'exportation
                        tempCtx.save();
                        tempCtx.globalAlpha = layer.opacity;

                        // Calculer le centre du calque pour une rotation correcte
                        const centerX = layer.x + layerImage.width / 2;
                        const centerY = layer.y + layerImage.height / 2;

                        // a. Déplacer l'origine du canvas au centre du calque
                        tempCtx.translate(centerX, centerY);
                        // b. Faire la rotation du canvas
                        tempCtx.rotate(layer.angle * Math.PI / 180);
                        // c. Remettre l'origine en place
                        tempCtx.translate(-centerX, -centerY);
                        
                        // d. Dessiner l'image à sa position en haut à gauche
                        tempCtx.drawImage(layerImage, layer.x, layer.y);
                        
                        tempCtx.restore();
                    }
                }
            }

            // Dessiner la barre d'échelle si disponible
            if (this.state.scaleInfo.ratio > 0) {
                this.drawScaleBar(tempCtx, tempCanvas);
            }

            this.downloadCanvas(tempCanvas, 'plan_export.png');
        }

        async exportToPDF(title, legendText) {
            if (this.state.layers.length === 0) {
                alert("Il n'y a rien à exporter.");
                return;
            }

            // Forcer le rendu de tous les calques avant l'exportation
            this.state.layers.forEach(l => {
                l.fabricCanvas.calcOffset();
                l.fabricCanvas.renderAll();
            });

            // --- REUTILISATION DE LA LOGIQUE ROBUSTE DE DETERMINATION DES DIMENSIONS (COPIÉ DE EXPORTTOPNG) ---

            // 1. "Plan rogné" : C'est la référence absolue de la zone de travail si elle existe.
            let referenceLayer = this.state.layers.find(l => l.name && (l.name === "Plan rogné" || l.name.indexOf('rogn') !== -1));

            // 2. "Calque de dessin" : Si pas de plan rogné, on utilise le calque de dessin.
            if (!referenceLayer) {
                referenceLayer = this.state.layers.find(l => l.name === this.state.DRAWING_LAYER_NAME);
            }

            // 3. Fallback : Le premier calque de la liste (Top Layer).
            if (!referenceLayer && this.state.layers.length > 0) {
                referenceLayer = this.state.layers[0];
            }

            // 4. Dernier recours
            if (!referenceLayer) {
                referenceLayer = this.state.layers[this.state.layers.length - 1];
            }

            console.log(`🖨️ [EXPORT PDF] Dimensions basées sur le calque : "${referenceLayer ? referenceLayer.name : 'Aucun'}" (${referenceLayer ? referenceLayer.fabricCanvas.width : 0}x${referenceLayer ? referenceLayer.fabricCanvas.height : 0})`);

            // Calculer les dimensions finales
            let exportWidth = referenceLayer ? referenceLayer.fabricCanvas.width : 800;
            let exportHeight = referenceLayer ? referenceLayer.fabricCanvas.height : 600;

            // Si le calque de référence a une image de fond, on peut aussi vérifier ses dimensions naturelles
            if (referenceLayer && referenceLayer.fabricCanvas.backgroundImage) {
                const bgImage = referenceLayer.fabricCanvas.backgroundImage;
                const bgScaledWidth = bgImage.width * bgImage.scaleX;
                const bgScaledHeight = bgImage.height * bgImage.scaleY;
                
                if (exportWidth > bgScaledWidth + 5 && exportWidth > 2000) {
                    console.log(`🖨️ [EXPORT PDF] Correction des dimensions basée sur l'image de fond: ${bgScaledWidth}x${bgScaledHeight} (Canvas: ${exportWidth}x${exportHeight})`);
                    exportWidth = Math.floor(bgScaledWidth);
                    exportHeight = Math.floor(bgScaledHeight);
                }
            }

            // Stratégie de secours ultime : Si le canvas reste immense (> 2000px), 
            // on regarde si le contenu du dessin est localisé et on rogne dessus.
            let contentBounds = null;
            if (exportWidth > 2000) {
                const drawingLayer = this.state.layers.find(l => l.name === this.state.DRAWING_LAYER_NAME);
                if (drawingLayer && drawingLayer.fabricCanvas.getObjects().length > 0) {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    let hasVisibleObjects = false;

                    drawingLayer.fabricCanvas.getObjects().forEach(obj => {
                        if (!obj.visible) return;
                        const rect = obj.getBoundingRect();
                        if (rect.left < minX) minX = rect.left;
                        if (rect.top < minY) minY = rect.top;
                        if (rect.left + rect.width > maxX) maxX = rect.left + rect.width;
                        if (rect.top + rect.height > maxY) maxY = rect.top + rect.height;
                        hasVisibleObjects = true;
                    });

                    if (hasVisibleObjects) {
                        const margin = 100;
                        minX = Math.max(0, minX - margin);
                        minY = Math.max(0, minY - margin);
                        maxX = Math.min(exportWidth, maxX + margin);
                        maxY = Math.min(exportHeight, maxY + margin);
                        
                        const boundsWidth = maxX - minX;
                        const boundsHeight = maxY - minY;

                        if (boundsWidth < exportWidth * 0.8) {
                            console.log(`✂️ [EXPORT PDF] Rognage automatique sur le contenu du dessin: ${boundsWidth}x${boundsHeight} à (${minX},${minY})`);
                            exportWidth = Math.floor(boundsWidth);
                            exportHeight = Math.floor(boundsHeight);
                            contentBounds = { x: minX, y: minY };
                        }
                    }
                }
            }

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = exportWidth;
            tempCanvas.height = exportHeight;
            const tempCtx = tempCanvas.getContext('2d');

            // Fond blanc
            tempCtx.fillStyle = 'white';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            // Appliquer le décalage si on a rogné sur le contenu
            if (contentBounds) {
                tempCtx.translate(-contentBounds.x, -contentBounds.y);
            }

            // Rendu des calques
            for (const layer of [...this.state.layers].reverse()) {
                if (layer.visible) {
                    const dataUrl = layer.fabricCanvas.toDataURL({ format: 'png' });
                    const layerImage = await new Promise(resolve => {
                        const img = new Image();
                        img.onload = () => resolve(img);
                        img.onerror = () => resolve(null);
                        img.src = dataUrl;
                    });

                    if (layerImage) {
                        tempCtx.save();
                        tempCtx.globalAlpha = layer.opacity;

                        const centerX = layer.x + layerImage.width / 2;
                        const centerY = layer.y + layerImage.height / 2;

                        tempCtx.translate(centerX, centerY);
                        tempCtx.rotate(layer.angle * Math.PI / 180);
                        tempCtx.translate(-centerX, -centerY);
                        
                        tempCtx.drawImage(layerImage, layer.x, layer.y);
                        tempCtx.restore();
                    }
                }
            }

            // Barre d'échelle avec fond blanc
            if (this.state.scaleInfo.ratio > 0) {
                this.drawScaleBarForPDF(tempCtx, tempCanvas);
            }

            // Génération du PDF
            this.generatePDF(tempCanvas, title, legendText);
        }

        drawScaleBar(ctx, canvas) {
            const pixelsPerMeter = this.state.scaleInfo.ratio * 100;
            const barLengthMeters = 10;
            const barWidthPixels = barLengthMeters * pixelsPerMeter;
            const tickHeight = 10;
            const x = 40;
            const y = canvas.height - 40;
            
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = 'black';
            ctx.fillStyle = 'black';
            ctx.lineWidth = 2;
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';

            ctx.fillText(`${barLengthMeters} m`, x + barWidthPixels / 2, y - 15);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + barWidthPixels, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y - tickHeight / 2);
            ctx.lineTo(x, y + tickHeight / 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + barWidthPixels, y - tickHeight / 2);
            ctx.lineTo(x + barWidthPixels, y + tickHeight / 2);
            ctx.stroke();

            if (this.state.scaleInfo.userDefinedScaleDenominator) {
                const scaleText = `Échelle 1:${Math.round(this.state.scaleInfo.userDefinedScaleDenominator)}`;
                ctx.textAlign = 'left';
                ctx.font = '14px sans-serif';
                ctx.fillText(scaleText, x, y + 25);
            }
        }

        drawScaleBarForPDF(ctx, canvas) {
            const pixelsPerMeter = this.state.scaleInfo.ratio * 100;
            const barLengthMeters = 10;
            const barWidthPixels = barLengthMeters * pixelsPerMeter;
            const tickHeight = 10;
            const x = 40;
            const y = canvas.height - 40;
            
            // Fond blanc pour la barre d'échelle
            const rectX = x - 10;
            const rectY = y - 40; 
            const rectWidth = barWidthPixels + 20;
            const rectHeight = 80; 
            ctx.fillStyle = 'white';
            ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = 'black';
            ctx.fillStyle = 'black';
            ctx.lineWidth = 2;
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${barLengthMeters} m`, x + barWidthPixels / 2, y - 15);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + barWidthPixels, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y - tickHeight / 2);
            ctx.lineTo(x, y + tickHeight / 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + barWidthPixels, y - tickHeight / 2);
            ctx.lineTo(x + barWidthPixels, y + tickHeight / 2);
            ctx.stroke();
            
            if (this.state.scaleInfo.userDefinedScaleDenominator) {
                const scaleText = `Échelle 1:${Math.round(this.state.scaleInfo.userDefinedScaleDenominator)}`;
                ctx.textAlign = 'left';
                ctx.font = '14px sans-serif';
                ctx.fillText(scaleText, x, y + 25);
            }
        }

        generatePDF(canvas, title, legendText) {
            const imgData = canvas.toDataURL('image/jpeg', 0.9);

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 10;

            // Titre
            doc.setFontSize(18);
            doc.text(title, pageWidth / 2, margin + 5, { align: 'center' });

            // Calcul des dimensions de l'image
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const availableWidth = pageWidth - 2 * margin;
            const availableHeight = pageHeight - 2 * margin - 30;

            let newImgWidth, newImgHeight;
            const aspectRatio = imgWidth / imgHeight;

            if (availableWidth / aspectRatio <= availableHeight) {
                newImgWidth = availableWidth;
                newImgHeight = availableWidth / aspectRatio;
            } else {
                newImgHeight = availableHeight;
                newImgWidth = availableHeight * aspectRatio;
            }

            const x_pdf = (pageWidth - newImgWidth) / 2;
            const y_pdf = margin + 15;

            // Ajout de l'image
            doc.addImage(imgData, 'JPEG', x_pdf, y_pdf, newImgWidth, newImgHeight);

            // Légende
            if (legendText) {
                doc.setFontSize(8);
                const legendY = y_pdf + newImgHeight + 5;
                doc.text(legendText, x_pdf, legendY, { 
                    align: 'left', 
                    baseline: 'top',
                    maxWidth: newImgWidth / 2
                });
            }

            // Signature
            doc.setFontSize(10);
            doc.text("Dont acte", pageWidth - margin, pageHeight - margin, { 
                align: 'right', 
                baseline: 'bottom' 
            });

            // Téléchargement
            const filename = (title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'plan') + '.pdf';
            doc.save(filename);
        }

        downloadCanvas(canvas, filename) {
            const dataURL = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataURL;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        promptForPDFExport() {
            const title = prompt("Veuillez entrer un titre pour le document PDF :", 
                "Croquis approximatif accident survenu le ...... à....");
            if (title === null) return;

            const defaultLegend = `Légende:
Ligne de base : Ligne imaginaire parallèle à .......
Point Zéro : 
Véhicule A : marque _- immatriculation -conduit par
Autres véhicules....`;
            
            // Déclencher l'événement pour afficher la modale de légende
            document.dispatchEvent(new CustomEvent('show-legend-modal', { 
                detail: { title, defaultLegend } 
            }));
        }
    }

    // Exposer dans le namespace global
    window.PlanEditor.ExportManager = ExportManager;

})();