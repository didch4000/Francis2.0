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
                        
                        // SI LE VÉHICULE ASSOCIÉ VIENT DE BOUGER, ON NE SAUVEGARDE PAS LA POSITION
                        // Cela force la réinitialisation des mesures à leur position par défaut
                        if (!associatedVehicle.hasJustMoved) {
                            // On peut sauvegarder si un AUTRE véhicule a bougé, mais pas celui-ci
                            // Ou si aucun véhicule n'a bougé (rafraîchissement global)
                            customPositions.set(obj.projectionId + '_' + obj.projectionRole, {
                                left: obj.left,
                                top: obj.top,
                                hasBeenMoved: true
                            });
                        } else {
                            // FORCAGE DE LA RÉINITIALISATION :
                            // Si le véhicule a bougé, on ne sauvegarde RIEN dans customPositions pour ses mesures.
                            // Ainsi, lors du redessin (drawProjectionsForVehicle), customPositions.has() renverra false,
                            // et les positions seront recalculées par défaut.
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

            // Liste globale pour collecter toutes les abscisses de tous les véhicules
            const allAbscissaTexts = [];

            // Traiter les véhicules
            canvas.getObjects().forEach(obj => {
                if (obj.isVehicle) {
                    const vehicleAbscissas = this.drawProjectionsForVehicle(obj, baseline, zeroPoint, canvas, customPositions);
                    allAbscissaTexts.push(...vehicleAbscissas);
                } else if (obj.isLandmark && document.getElementById('toggle-landmark-coords-checkbox')?.checked) {
                    // Pour les repères, on peut aussi collecter les abscisses si on veut gérer les conflits avec eux
                    // Pour l'instant on laisse tel quel pour ne pas trop complexifier
                    this.drawProjectionsForLandmark(obj, baseline, zeroPoint, canvas);
                }
            });

            // Résoudre les chevauchements globalement entre tous les véhicules
            this.resolveGlobalOverlaps(allAbscissaTexts);

            // Réorganiser les objets et rendre
            this.reorderObjectsOnCanvas(canvas);
            canvas.renderAll();
        }

        resolveGlobalOverlaps(abscissaTexts) {
            if (abscissaTexts.length <= 1) return;

            // Trier par position X
            abscissaTexts.sort((a, b) => a.x - b.x);

            // Séparer les groupes (dessus / dessous la ligne)
            const topTexts = abscissaTexts.filter(t => t.textObj.originY === 'bottom');
            const bottomTexts = abscissaTexts.filter(t => t.textObj.originY === 'top');

            // Appliquer l'empilement pour chaque groupe
            this.stackTexts(topTexts, 'up');
            this.stackTexts(bottomTexts, 'down');
        }

        stackTexts(texts, direction) {
            if (texts.length === 0) return;

            // rows[i] = position X de fin (droite) du dernier élément sur la ligne i
            const rowsEndX = []; 

            for (const item of texts) {
                // Si déplacé manuellement, on ne touche pas, mais on devrait peut-être le considérer comme obstacle ?
                // Pour simplifier, on l'ignore du calcul automatique
                if (item.hasBeenMoved) continue; 

                if (!item.textObj.width) item.textObj.initDimensions();
                
                // Calculer les bornes horizontales de l'élément
                const width = item.textObj.width * item.textObj.scaleX;
                let left, right;
                
                // On assume originX='center' par défaut (créé comme ça)
                if (item.textObj.originX === 'center') {
                    left = item.x - width / 2;
                    right = item.x + width / 2;
                } else if (item.textObj.originX === 'left') {
                    left = item.x;
                    right = item.x + width;
                } else if (item.textObj.originX === 'right') {
                    left = item.x - width;
                    right = item.x;
                }

                // Marge de sécurité horizontale
                const padding = 2;

                // Trouver la première ligne où ça rentre
                let rowIndex = 0;
                while (true) {
                    // Si la ligne n'existe pas encore, on la crée (fin = -Infinity)
                    if (rowsEndX.length <= rowIndex) {
                        rowsEndX.push(-Infinity);
                    }

                    // Vérifier si on peut placer l'élément ici sans chevauchement
                    if (left > rowsEndX[rowIndex] + padding) {
                        // Ça rentre !
                        break;
                    }
                    // Sinon, on essaie la ligne suivante
                    rowIndex++;
                }

                // Appliquer le décalage vertical
                // Hauteur de ligne ~14px (fontSize 12 + marge)
                const lineHeight = 14;
                const shift = rowIndex * lineHeight;

                if (direction === 'down') {
                    // S'éloigner vers le bas (Y augmente)
                    item.textObj.set({
                        top: item.textObj.top + shift
                    });
                } else {
                    // 'up' -> S'éloigner vers le haut (Y diminue)
                    item.textObj.set({
                        top: item.textObj.top - shift
                    });
                }
                
                item.textObj.setCoords();

                // Mettre à jour la fin de la ligne occupée
                rowsEndX[rowIndex] = right;
            }
        }

        drawProjectionsForVehicle(vehicle, baseline, zeroPoint, canvas, customPositions = new Map()) {
            const baselineY = baseline.top;
            const zeroPointX = zeroPoint.left;
            const projectionColor = vehicle.originalColor || 'rgba(128, 128, 128, 0.8)';
            const generatedAbscissaTexts = [];
            const generatedOrdinateTexts = [];

            vehicle.setCoords();
            const corners = vehicle.aCoords;

            // Détection du parallélisme ou perpendicularité
            // Angle proche de 0 ou 180 modulo 180 (parallèle)
            const isParallel = Math.abs(vehicle.angle % 180) < 5 || Math.abs(vehicle.angle % 180) > 175;
            // Angle proche de 90 ou 270 modulo 180 (perpendiculaire)
            const isPerpendicular = Math.abs((vehicle.angle - 90) % 180) < 5 || Math.abs((vehicle.angle - 90) % 180) > 175;

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
                    let verticalMeters = (verticalPixels / this.state.scaleInfo.ratio / 100).toFixed(1);
                    
                    // Ajouter une flèche directionnelle
                    if (parseFloat(verticalMeters) > 0) {
                        verticalMeters += ' ↑';
                    } else if (parseFloat(verticalMeters) < 0) {
                        verticalMeters += ' ↓';
                    } else {
                        // Pas de flèche pour 0.0
                    }
                    
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
                        backgroundColor: 'rgba(255,255,255,1.0)',
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
                    let abscissaTop, abscissaOriginY;

                    // Si le point est en dessous de la ligne de base (ordonnée négative car Y augmente vers le bas)
                    // On place le texte AU-DESSUS de la ligne de base
                    if (corner.y > baselineY) {
                        abscissaTop = baselineY - 5;
                        abscissaOriginY = 'bottom';
                    } else {
                        // Cas standard : texte EN-DESSOUS de la ligne de base
                        abscissaTop = baselineY + 5;
                        abscissaOriginY = 'top';
                    }

                    let abscissaHasBeenMoved = false;
                    
                    // Vérifier s'il y a une position personnalisée
                    const abscissaKey = projectionId + '_abscissa';
                    if (customPositions.has(abscissaKey)) {
                        const saved = customPositions.get(abscissaKey);
                        abscissaLeft = saved.left;
                        abscissaTop = saved.top;
                        abscissaHasBeenMoved = saved.hasBeenMoved;
                        // On garde l'originY par défaut sauf si on stockait aussi l'origin (ce qui n'est pas le cas ici, mais ce n'est pas grave pour le déplacement manuel)
                    }
                    
                    abscissaText = new fabric.Text(horizontalMeters, {
                        ...commonProps,
                        left: abscissaLeft,
                        top: abscissaTop,
                        fontSize: 12,
                        fill: projectionColor,
                        backgroundColor: 'rgba(255,255,255,1.0)',
                        originX: 'center',
                        originY: abscissaOriginY,
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
                if (ordinateText) {
                    canvas.add(ordinateText);
                    generatedOrdinateTexts.push({
                        textObj: ordinateText,
                        x: corner.x,
                        hasBeenMoved: ordinateText.hasBeenMoved
                    });
                }
                if (abscissaText) {
                    canvas.add(abscissaText);
                    generatedAbscissaTexts.push({
                        textObj: abscissaText,
                        x: corner.x,
                        hasBeenMoved: abscissaText.hasBeenMoved,
                        projectionLine: projectionLine
                    });
                }
            }

            // Gestion spéciale pour les véhicules parallèles OU perpendiculaires : suppression des doublons d'abscisses
            if ((isParallel || isPerpendicular) && generatedAbscissaTexts.length > 1) {
                // Grouper les abscisses très proches (chevauchement des lignes pointillées)
                const uniqueAbscissas = [];
                generatedAbscissaTexts.sort((a, b) => a.x - b.x);

                for (let i = 0; i < generatedAbscissaTexts.length; i++) {
                    const current = generatedAbscissaTexts[i];
                    let isDuplicate = false;

                    for (const unique of uniqueAbscissas) {
                        // N'affiche qu'une mesure pour 2 lignes uniquement si les valeurs de ces deux lignes sont parfaitement égales
                        // On compare le texte affiché (la valeur en mètres) plutôt que les pixels, pour gérer les arrondis
                        if (current.textObj.text === unique.textObj.text) { 
                            isDuplicate = true;
                            // Masquer le texte en doublon
                            canvas.remove(current.textObj);
                            break;
                        }
                    }

                    if (!isDuplicate) {
                        uniqueAbscissas.push(current);
                    }
                }
                
                // Remplacer la liste complète par la liste filtrée pour la suite du traitement
                // Note: on ne modifie pas generatedAbscissaTexts référence, mais on pourrait filtrer
                // Mais pour la suite, on veut juste éviter que le code de décalage ne s'applique sur des textes supprimés
                // Donc on va filtrer la liste originale
                for (let i = generatedAbscissaTexts.length - 1; i >= 0; i--) {
                    if (!canvas.getObjects().includes(generatedAbscissaTexts[i].textObj)) {
                        generatedAbscissaTexts.splice(i, 1);
                    }
                }
            }

            // Harmonisation des ordonnées : toutes du même côté
            if (generatedOrdinateTexts.length > 0) {
                // Forcer toutes les ordonnées à droite de leur ligne respective pour la cohérence
                // Sauf si l'utilisateur a déplacé manuellement
                generatedOrdinateTexts.forEach(item => {
                    if (!item.hasBeenMoved) {
                        item.textObj.set({
                            originX: 'left',
                            left: item.x + 5
                        });
                        item.textObj.setCoords();
                    }
                });
            }

            // Retourner les textes générés pour le traitement global
            return generatedAbscissaTexts;
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
        let verticalMeters = (verticalPixels / this.state.scaleInfo.ratio / 100).toFixed(1);
        
        // Ajouter une flèche directionnelle
        if (parseFloat(verticalMeters) > 0) {
            verticalMeters += ' ↑';
        } else if (parseFloat(verticalMeters) < 0) {
            verticalMeters += ' ↓';
        }

        ordinateText = new fabric.Text(verticalMeters, {
            ...commonProps,
            left: landmark.left + 5,
            top: landmark.top + (baselineY - landmark.top) / 2,
            fontSize: 12,
            fill: projectionColor,
            backgroundColor: 'rgba(255,255,255,1.0)',
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
            backgroundColor: 'rgba(255,255,255,1.0)',
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
                target.set({ backgroundColor: 'rgba(255,255,255,1.0)' }); // Restaurer le fond blanc
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