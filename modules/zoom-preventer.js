// Module pour empêcher le zoom du navigateur
export function preventBrowserZoom() {
    // Empêcher Ctrl + / Ctrl - (zoom clavier)
    document.addEventListener('keydown', function(e) {
        // Vérifier si Ctrl ou Cmd est pressé avec + ou -
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '0' || e.key === '=')) {
            e.preventDefault();
            return false;
        }
    }, { passive: false });

    // Empêcher Ctrl + Molette (zoom souris)
    document.addEventListener('wheel', function(e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            return false;
        }
    }, { passive: false });

    console.log('✅ Zoom du navigateur bloqué');
}
