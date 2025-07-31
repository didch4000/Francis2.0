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
            this.state.layers.forEach(l => l.fabricCanvas.renderAll());

            const firstLayer = this.state.layers[this.state.layers.length - 1];
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = firstLayer.fabricCanvas.width;
            tempCanvas.height = firstLayer.fabricCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');

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
            this.state.layers.forEach(l => l.fabricCanvas.renderAll());

            const firstLayer = this.state.layers[this.state.layers.length - 1];
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = firstLayer.fabricCanvas.width;
            tempCanvas.height = firstLayer.fabricCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');

            // Fond blanc
            tempCtx.fillStyle = 'white';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

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