// modules/projections.js - Gestionnaire des projections (style original)
(function() {
    'use strict';
    
    class ProjectionManager {
        constructor(state) {
            this.state = state;
            this.setupEventListeners();
        }

        setupEventListeners() {
            document.addEventListener('update-all-projections', () => {
                this.updateAllProjections();
            });
            
            document.addEventListener('projections-update-needed', () => {
                this.updateAllProjections();
            });
        }

        updateAllProjections() {
            const drawingLayer = this.state.layers.find(l => l.name === this.state.DRAWING_LAYER_NAME);
            if (!drawingLayer) return;

            const canvas = drawingLayer.fabricCanvas;
            
            // Sauvegarder les positions personnalisées des éléments de projection
            const customPositions = new Map();
            canvas.getObjects().forEach(obj => {
                if (obj.isProjectionElement && obj.projectionId && obj.hasBeenMoved) {
                    // Trouver le véhicule associé
                    const associatedVehicle = canvas.getObjects().find(v => 
                        v.isVehicle && v.id === obj.projectionVehicleId
                    );
                    
                    if (associatedVehicle) {
                        // Sauvegarder la position SEULEMENT si le véhicule n'a pas bougé récemment
                        // OU si cet appel vient d'un ajout de véhicule (pas de véhicule avec hasJustMoved)
                        const hasAnyVehicleJustMoved = canvas.getObjects().some(v => v.isVehicle && v.hasJustMoved);
                        
                        if (!associatedVehicle.hasJustMoved || !hasAnyVehicleJustMoved) {
                            customPositions.set(obj.projectionId + '_' + obj.projectionRole, {
                                left: obj.left,
                                top: obj.top,
                                hasBeenMoved: true
                            });
                        }
                    }
                }
            });
            
            // Nettoyer les anciennes projections (sauf les mesures)
            this.state.isCleaningUpProjections = true;
            canvas.getObjects().filter(o => o.isProjectionElement && !o.isMeasurement).forEach(o => canvas.remove(o));
            this.state.isCleaningUpProjections = false;

            const baseline = canvas.getObjects().find(o => o.isBaseline);
            const zeroPoint = canvas.getObjects().find(o => o.isZeroPoint);

            if (!baseline || !zeroPoint) {
                canvas.renderAll();
                return;
            }

            // Traiter les véhicules
            canvas.getObjects().forEach(obj => {
                if (obj.isVehicle) {
                    this.drawProjectionsForVehicle(obj, baseline, zeroPoint, canvas, customPositions);
                } else if (obj.isLandmark && document.getElementById('toggle-landmark-coords-checkbox')?.checked) {
                    this.drawProjectionsForLandmark(obj, baseline, zeroPoint, canvas);
                }
            });

            // Réorganiser les objets et rendre
            this.reorderObjectsOnCanvas(canvas);
            canvas.renderAll();
        }

        drawProjectionsForVehicle(vehicle, baseline, zeroPoint, canvas, customPositions = new Map()) {
            const baselineY = baseline.top;
            const zeroPointX = zeroPoint.left;
            const projectionColor = vehicle.originalColor || 'rgba(128, 128, 128, 0.8)';

            vehicle.setCoords();
            const corners = vehicle.aCoords;

            for (const cornerKey in corners) {
                // Vérifier si ce coin est supprimé
                if (vehicle.suppressedCorners && vehicle.suppressedCorners.includes(cornerKey)) {
                    continue;
                }

                const corner = corners[cornerKey];
                const projectionId = `proj_${vehicle.id}_${cornerKey}`;
                const vehicleId = vehicle.id;

                const commonProps = {
                    selectable: true,
                    evented: true,
                    isProjectionElement: true,
                    projectionId: projectionId,
                    projectionVehicleId: vehicleId,
                    projectionCorner: cornerKey
                };
                
                // Ligne de projection verticale
                const projectionLine = new fabric.Line(
                    [corner.x, corner.y, corner.x, baselineY],
                    {
                        ...commonProps,
                        stroke: projectionColor,
                        strokeWidth: 1,
                        strokeDashArray: [3, 3],
                        projectionRole: 'line',
                    }
                );
                
                let ordinateText, abscissaText;

                if (this.state.scaleInfo.ratio > 0) {
                    // Calcul de l'ordonnée (distance verticale)
                    const verticalPixels = baselineY - corner.y;
                    const verticalMeters = (verticalPixels / this.state.scaleInfo.ratio / 100).toFixed(1);
                    
                    // Position par défaut de l'ordonnée
                    let ordinateLeft = corner.x + 5;
                    let ordinateTop = corner.y + (baselineY - corner.y) / 2;
                    let ordinateHasBeenMoved = false;
                    
                    // Vérifier s'il y a une position personnalisée
                    const ordinateKey = projectionId + '_ordinate';
                    if (customPositions.has(ordinateKey)) {
                        const saved = customPositions.get(ordinateKey);
                        ordinateLeft = saved.left;
                        ordinateTop = saved.top;
                        ordinateHasBeenMoved = saved.hasBeenMoved;
                    }
                    
                    ordinateText = new fabric.Text(verticalMeters, {
                        ...commonProps,
                        left: ordinateLeft,
                        top: ordinateTop,
                        fontSize: 12,
                        fill: projectionColor,
                        backgroundColor: 'rgba(255,255,255,0.7)',
                        originX: 'left',
                        originY: 'center',
                        projectionRole: 'ordinate',
                        hasControls: false,
                        hasBorders: true, // Permettre la sélection et le déplacement
                        selectable: true,
                        moveable: true,
                        hasBeenMoved: ordinateHasBeenMoved,
                    });

                    // Calcul de l'abscisse (distance horizontale depuis le point zéro)
                    const horizontalPixels = corner.x - zeroPointX;
                    const horizontalMeters = (horizontalPixels / this.state.scaleInfo.ratio / 100).toFixed(1);
                    
                    // Position par défaut de l'abscisse
                    let abscissaLeft = corner.x;
                    let abscissaTop = baselineY + 5;
                    let abscissaHasBeenMoved = false;
                    
                    // Vérifier s'il y a une position personnalisée
                    const abscissaKey = projectionId + '_abscissa';
                    if (customPositions.has(abscissaKey)) {
                        const saved = customPositions.get(abscissaKey);
                        abscissaLeft = saved.left;
                        abscissaTop = saved.top;
                        abscissaHasBeenMoved = saved.hasBeenMoved;
                    }
                    
                    abscissaText = new fabric.Text(horizontalMeters, {
                        ...commonProps,
                        left: abscissaLeft,
                        top: abscissaTop,
                        fontSize: 12,
                        fill: projectionColor,
                        backgroundColor: 'rgba(255,255,255,0.7)',
                        originX: 'center',
                        originY: 'top',
                        projectionRole: 'abscissa',
                        hasControls: false,
                        hasBorders: true, // Permettre la sélection et le déplacement
                        selectable: true,
                        moveable: true,
                        hasBeenMoved: abscissaHasBeenMoved,
                    });
                }

                // Ajouter les éléments au canvas
                canvas.add(projectionLine);
                if (ordinateText) canvas.add(ordinateText);
                if (abscissaText) canvas.add(abscissaText);
            }
        }

  drawProjectionsForLandmark(landmark, baseline, zeroPoint, canvas) {
    const baselineY = baseline.top;
    const zeroPointX = zeroPoint.left;
    const projectionColor = landmark.fill || 'rgba(128, 128, 128, 0.8)';
    const landmarkId = landmark.id;
    const projectionId = `proj_landmark_${landmarkId}`;

    const commonProps = {
        selectable: true,
        evented: true,
        isProjectionElement: true,
        projectionId: projectionId,
        projectionLandmarkId: landmarkId,
    };

    // Ligne de projection verticale
    const projectionLine = new fabric.Line(
        [landmark.left, landmark.top, landmark.left, baselineY],
        {
            ...commonProps,
            stroke: projectionColor,
            strokeWidth: 1,
            strokeDashArray: [3, 3],
            projectionRole: 'line',
        }
    );

    let ordinateText, abscissaText;

    if (this.state.scaleInfo.ratio > 0) {
        // Calcul de l'ordonnée
        const verticalPixels = baselineY - landmark.top;
        const verticalMeters = (verticalPixels / this.state.scaleInfo.ratio / 100).toFixed(1);
        ordinateText = new fabric.Text(verticalMeters, {
            ...commonProps,
            left: landmark.left + 5,
            top: landmark.top + (baselineY - landmark.top) / 2,
            fontSize: 12,
            fill: projectionColor,
            backgroundColor: 'rgba(255,255,255,0.7)',
            originX: 'left',
            originY: 'center',
            projectionRole: 'ordinate',
        });

        // Calcul de l'abscisse
        const horizontalPixels = landmark.left - zeroPointX;
        const horizontalMeters = (horizontalPixels / this.state.scaleInfo.ratio / 100).toFixed(1);
        abscissaText = new fabric.Text(horizontalMeters, {
            ...commonProps,
            left: landmark.left,
            top: baselineY + 5,
            fontSize: 12,
            fill: projectionColor,
            backgroundColor: 'rgba(255,255,255,0.7)',
            originX: 'center',
            originY: 'top',
            projectionRole: 'abscissa',
        });
    }

    // Ajouter les éléments au canvas
    canvas.add(projectionLine);
    if (ordinateText) canvas.add(ordinateText);
    if (abscissaText) canvas.add(abscissaText);
}

        // Méthodes utilitaires reprises du script.js original
        applyMeasurementSelectionStyle(target) {
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
        }

        clearMeasurementSelectionStyle(target) {
            if (target && target.isProjectionElement && target.type === 'text') {
                target.set({ backgroundColor: '' });
            }
        }

        reorderObjectsOnCanvas(canvas) {
            if (!canvas) return;

            const zOrder = {
                'isLandmark': 1,
                'default': 2,
                'isVehicle': 3,
                'isBaseline': 4,
                'isZeroPoint': 4,
                'isProjectionElement': 5,
                'isMeasurement': 5,
                'isScaleBar': 5
            };

            const getZ = (obj) => {
                for (const key in zOrder) {
                    if (obj[key]) return zOrder[key];
                }
                return zOrder.default;
            };

            canvas.getObjects().sort((a, b) => getZ(a) - getZ(b)).forEach(obj => canvas.bringToFront(obj));
            canvas.renderAll();
        }
    }

    // Exposer dans le namespace global
    window.PlanEditor.ProjectionManager = ProjectionManager;
})();