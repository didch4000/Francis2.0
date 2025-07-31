// app.js - Version nettoyée sans forçage de plein écran
(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 Initialisation de l\'application...');

        // Vérifier que tous les modules sont chargés
        if (!window.PlanEditor) {
            console.error('❌ Namespace PlanEditor non trouvé');
            return;
        }

        if (!window.PlanEditor.StateManager) {
            console.error('❌ StateManager non chargé');
            return;
        }
        if (!window.PlanEditor.LayerManager) {
            console.error('❌ LayerManager non chargé');
            return;
        }
        if (!window.PlanEditor.CanvasManager) {
            console.error('❌ CanvasManager non chargé');
            return;
        }
        if (!window.PlanEditor.ToolsManager) {
            console.error('❌ ToolsManager non chargé');
            return;
        }
        if (!window.PlanEditor.UIManager) {
            console.error('❌ UIManager non chargé');
            return;
        }
        if (!window.PlanEditor.ExportManager) {
            console.error('❌ ExportManager non chargé');
            return;
        }
        if (!window.PlanEditor.EventManager) {
            console.error('❌ EventManager non chargé');
            return;
        }
        if (!window.PlanEditor.ProjectionManager) {
            console.error('❌ ProjectionManager non chargé');
            return;
        }
        if (!window.PlanEditor.ProjectManager) {
            console.error('❌ ProjectManager non chargé');
            return;
        }

        console.log('✅ Tous les modules sont chargés');

        // Vérifier que les éléments DOM essentiels existent
        const essentialElements = [
            'signs-grid',
            'canvas-container',
            'layers-list',
            'add-image-btn',
            'guide-message'
        ];

        const missingElements = essentialElements.filter(id => !document.getElementById(id));
        if (missingElements.length > 0) {
            console.error('❌ Éléments DOM manquants:', missingElements);
            return;
        }

        console.log('✅ Éléments DOM trouvés');

        try {
            // Initialisation des managers
            const state = new window.PlanEditor.StateManager();
            const layerManager = new window.PlanEditor.LayerManager(state);
            const canvasManager = new window.PlanEditor.CanvasManager(state, layerManager);
            const toolsManager = new window.PlanEditor.ToolsManager(state, layerManager, canvasManager);
            const uiManager = new window.PlanEditor.UIManager(state, layerManager, canvasManager, toolsManager);
            const exportManager = new window.PlanEditor.ExportManager(state, layerManager);
            const eventManager = new window.PlanEditor.EventManager(state, layerManager, canvasManager, toolsManager, uiManager, exportManager);
            
            const projectionManager = new window.PlanEditor.ProjectionManager(state);
            const projectManager = new window.PlanEditor.ProjectManager(state, layerManager, canvasManager);

            console.log('✅ Managers créés');

            // Exposer les instances pour que les autres modules puissent y accéder
            window.PlanEditor.instances = {
                state,
                layerManager,
                canvasManager,
                toolsManager,
                uiManager,
                exportManager,
                eventManager,
                projectionManager,
                projectManager
            };

            console.log('✅ Instances exposées globalement');

            // Fonction d'initialisation de l'UI
            const initializeUI = () => {
                console.log('📋 Initialisation de l\'UI...');
                
                uiManager.init();
                console.log('✅ UI initialisée');
                
                eventManager.init();
                console.log('✅ Events initialisés');
                
                console.log('✅ Application initialisée avec succès');
            };

            // Vérifier si les panneaux sont déjà chargés
            if (state.areSignsLoaded()) {
                console.log('📋 Panneaux déjà chargés, initialisation immédiate');
                initializeUI();
            } else {
                console.log('📋 En attente du chargement des panneaux...');
                // Attendre que les panneaux soient chargés
                document.addEventListener('signs-data-loaded', () => {
                    console.log('📋 Panneaux chargés, initialisation de l\'UI...');
                    initializeUI();
                });
            }

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
        }
    });

})();