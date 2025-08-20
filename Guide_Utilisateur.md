# Guide Utilisateur - Éditeur de Plans avec Panneaux de Signalisation

## Table des matières

1. [Introduction](#introduction)
2. [Démarrage rapide](#démarrage-rapide)
3. [Interface utilisateur](#interface-utilisateur)
4. [Barre d'outils principale](#barre-doutils-principale)
5. [Options de personnalisation](#options-de-personnalisation)
6. [Panneau des calques](#panneau-des-calques)
7. [Fenêtres modales](#fenêtres-modales)
8. [Raccourcis clavier](#raccourcis-clavier)
9. [Fonctionnalités avancées](#fonctionnalités-avancées)
10. [Export et impression](#export-et-impression)
11. [Conseils et bonnes pratiques](#conseils-et-bonnes-pratiques)

---

## Introduction

**Éditeur de Plans avec Panneaux de Signalisation** est une application web professionnelle conçue pour créer et modifier des plans techniques avec des éléments de signalisation routière. Elle est particulièrement adaptée pour :

- La création de plans d'accidents de circulation
- Le dessin de schémas routiers
- L'ajout de panneaux de signalisation
- La mesure précise sur plans
- La documentation technique avec légendes

### Caractéristiques principales
- Interface intuitive avec outils spécialisés
- Gestion avancée des calques
- Système de mesures précises avec échelle
- Bibliothèque de panneaux de signalisation
- Export en PNG et PDF avec légende
- Support complet des raccourcis clavier

---

## Démarrage rapide

### Étape 1 : Ajouter une image de fond
1. Cliquez sur le bouton **🖼️** dans la barre des calques (en bas)
2. Sélectionnez votre image de plan ou photo aérienne
3. L'image apparaît dans la zone de dessin centrale

### Étape 2 : Définir l'échelle
1. Cliquez sur l'outil **📏 Définir l'échelle**
2. Si vous connaissez l'échelle, entrez-la dans la modale (ex: 1:500)
3. Si l'échelle est inconnue, cochez la case correspondante
4. Validez pour continuer

### Étape 3 : Créer un calque de dessin
1. Le bouton **✏️ Créer un calque de dessin** apparaît
2. Cliquez dessus pour activer les outils de dessin
3. Vous pouvez maintenant dessiner sur votre plan

### Étape 4 : Commencer à dessiner
1. Sélectionnez un outil de dessin (ligne, cercle, courbe)
2. Choisissez vos options (couleur, épaisseur)
3. Dessinez directement sur le plan
4. Utilisez l'outil de sélection pour modifier vos éléments

---

## Interface utilisateur

L'interface est organisée en trois zones principales :

### 1. Barre d'outils (en haut)
Contient tous les outils et options de dessin organisés par catégories

### 2. Zone de dessin (au centre)
- Canvas principal où s'affiche le plan
- Support du zoom et défilement
- Curseurs spécialisés selon l'outil actif

### 3. Panneau des calques (en bas)
- Contrôles de gestion des calques
- Liste des calques avec propriétés
- Aperçus visuels des calques

---

## Barre d'outils principale

### Outils de base
| Outil | Icône | Raccourci | Description |
|-------|-------|-----------|-------------|
| **Annuler** | ↩️ | Ctrl+Z | Annule la dernière action |
| **Rétablir** | ↪️ | Ctrl+Y | Rétablit une action annulée |
| **Sélectionner** | 🖐️ | - | Sélectionne et déplace les objets |
| **Déplacer Calque** | ✥ | - | Déplace la vue ou le calque entier |
| **Dessiner Ligne** | 〰️ | - | Dessine des lignes droites |
| **Dessiner Courbe** | ︵ | - | Dessine des courbes avec point de contrôle |
| **Dessiner Cercle** | ⚪ | - | Dessine des cercles et ellipses |

### Outils de mesure
| Outil | Icône | Description |
|-------|-------|-------------|
| **Définir l'échelle** | 📏 | Configure l'échelle du plan |
| **Mesurer** | Mesurer | Mesure des distances en mètres |

### Contrôles de vue
| Outil | Icône | Description |
|-------|-------|-------------|
| **Zoom arrière** | - | Réduit le niveau de zoom |
| **Affichage zoom** | 100% | Affiche le niveau de zoom actuel |
| **Zoom avant** | + | Augmente le niveau de zoom |
| **Carte interactive** | 🌍 | Ouvre le Géoportail dans un nouvel onglet |
| **Mode Plein Écran** | ⛶ | Bascule en mode plein écran |

### Outils d'objets spécialisés
| Outil | Icône | Description |
|-------|-------|-------------|
| **Ajouter Panneau** | 🚦 | Bibliothèque de panneaux de signalisation |
| **Ajouter Voiture** | 🚗 | Véhicule avec dimensions personnalisables |
| **Ajouter Flèche** | ➡️ | Flèches directionnelles |
| **Ajouter Texte** | T | Texte personnalisé |
| **Passage Piéton** | 🚸 | Marquage passage piéton |
| **Céder le Passage** | ▽ | Marquage céder le passage |
| **Remplir zone** | 🎨 | Remplissage de zones fermées |
| **Ligne de Base** | LB | Ligne de référence pour coordonnées |
| **Trace de Freinage** | TF | Marquage de trace de freinage |
| **Point de Repère** | 📍 | Repère avec coordonnées |

### Ordre des objets
| Outil | Icône | Description |
|-------|-------|-------------|
| **Monter l'objet** | 🔼 | Avance l'objet sélectionné |
| **Descendre l'objet** | 🔽 | Recule l'objet sélectionné |

### Visibilité des repères
- **📍 Visible** : Affiche/masque tous les repères
- **Coords** : Affiche/masque les coordonnées des repères

---

## Options de personnalisation

### Options générales
- **Couleur** : Sélecteur de couleur pour tous les traits
- **Épaisseur** : 5 niveaux (Très fine à Très épaisse)
- **Pointillés** : Active/désactive les traits pointillés
- **Espacement** : 4 niveaux d'espacement pour les pointillés

### Options de texte
- **Police** : 6 polices disponibles (Arial, Times New Roman, Helvetica, Georgia, Verdana, Courier New)
- **Taille** : 10 tailles de 12 à 48 pixels
- **Style** : Boutons Gras (B), Italique (I), Souligné (U)

### Options de remplissage
- **Remplissage solide** : Couleur unie
- **Remplissage rayé** : Motif de rayures
- **Angle des rayures** : Curseur de 0° à 180°

---

## Panneau des calques

### Contrôles de calques
| Bouton | Icône | Description |
|--------|-------|-------------|
| **Ajouter image de fond** | 🖼️ | Ajoute la première image |
| **Ajouter calque image** | ➕🖼️ | Ajoute une image supplémentaire |
| **Créer calque de dessin** | ✏️ | Crée un nouveau calque de dessin |
| **Fusionner** | ⇩ | Fusionne avec le calque inférieur |
| **Monter calque** | ↑ | Remonte le calque |
| **Descendre calque** | ↓ | Descend le calque |

### Propriétés des calques
Chaque calque dispose de :
- **Aperçu visuel** : Miniature du contenu
- **Nom** : Nom du calque et échelle si applicable
- **Visibilité** : Bouton œil pour masquer/afficher
- **Suppression** : Bouton corbeille
- **Verrouillage** : Bouton cadenas
- **Opacité** : Curseur de 0 à 100%
- **Rotation** : Champ numérique de 0 à 360°

---

## Fenêtres modales

### Modale de panneaux de signalisation
- **Grille de panneaux** : Panneaux prédéfinis classés par catégorie
- **Chargement personnalisé** : Bouton + pour charger vos propres images

### Modale d'échelle
- **Échelle connue** : Saisissez le ratio 1:X (ex: 1:500)
- **Échelle inconnue** : Cochez pour définir graphiquement plus tard

### Modale de repère
- **Coordonnées X** : Position horizontale en mètres
- **Coordonnées Y** : Position verticale en mètres
- Coordonnées relatives à la ligne de base

### Modale de véhicule
- **Largeur** : Largeur réelle du véhicule en mètres
- **Longueur** : Longueur réelle du véhicule en mètres
- **Lettre d'identification** : Caractère pour identifier le véhicule

### Autres modales
- **Modale d'alignement** : Instructions pour aligner les calques
- **Modale de légende** : Édition de la légende pour l'export PDF
- **Modale de texte** : Saisie du texte à ajouter

---

## Raccourcis clavier

### Raccourcis principaux
| Raccourci | Action |
|-----------|--------|
| **Ctrl+Z** | Annuler |
| **Ctrl+Y** | Rétablir |
| **Ctrl+C** | Copier l'objet sélectionné |
| **Ctrl+V** | Coller |
| **Suppr** / **Backspace** | Supprimer l'objet sélectionné |
| **Échap** | Annuler l'action en cours |

### Déplacement et rotation
| Raccourci | Action |
|-----------|--------|
| **Flèches** | Déplacer l'objet de 1 pixel |
| **Shift+Flèches** | Déplacer l'objet de 10 pixels |
| **Ctrl+Flèches** | Rotation de 5° |
| **Ctrl+Shift+Flèches** | Rotation de 15° |

---

## Fonctionnalités avancées

### Système de coordonnées
- **Ligne de base** : Référence pour toutes les coordonnées
- **Projections automatiques** : Calcul automatique des coordonnées
- **Repères** : Points avec coordonnées précises
- **Mise à jour dynamique** : Recalcul lors des déplacements

### Mode plein écran
- **Interface auto-masquée** : Barres d'outils cachées automatiquement
- **Réapparition** : Mouvement près des bords pour réafficher
- **Optimisation** : Maximum d'espace pour le travail

### Gestion des états
- **Historique complet** : Undo/Redo pour chaque action
- **Sauvegarde automatique** : États sauvegardés après chaque modification
- **Opérations groupées** : Gestion intelligente des actions multiples

### Curseurs spécialisés
Chaque outil a son curseur spécifique :
- **Sélection** : Curseur par défaut
- **Dessin** : Croix précise
- **Remplissage** : Pot de peinture
- **Mesure** : Règle graduée
- **Texte** : Curseur de saisie

---

## Export et impression

### Export PNG
- **Qualité optimale** : Export en haute résolution
- **Calques visibles** : Seuls les calques visibles sont exportés
- **Transparence** : Fond transparent si aucune image de fond

### Export PDF
- **Avec légende** : Inclut automatiquement une légende
- **Échelle préservée** : Respecte l'échelle définie
- **Mise en page** : Optimisé pour l'impression A4

### Préparation à l'export
1. **Vérifiez la visibilité** des calques
2. **Ajustez l'opacité** si nécessaire
3. **Masquez les éléments** non désirés
4. **Testez l'aperçu** avant l'export final

---

## Conseils et bonnes pratiques

### Organisation du travail
1. **Commencez par l'échelle** : Toujours définir l'échelle en premier
2. **Utilisez les calques** : Séparez les éléments par type
3. **Nommez vos calques** : Facilitez la navigation
4. **Sauvegardez régulièrement** : Utilisez l'export pour sauvegarder

### Optimisation des performances
- **Limitez les calques** : Fusionnez quand c'est possible
- **Gérez l'opacité** : Réduisez si nécessaire
- **Verrouillez les calques** : Évitez les modifications accidentelles

### Qualité du rendu
- **Choisissez les bonnes épaisseurs** : Adaptées à l'échelle
- **Utilisez les couleurs contrastées** : Pour la lisibilité
- **Alignez précisément** : Utilisez les repères et coordonnées

### Workflow recommandé
1. **Image de fond** → **Échelle** → **Calque de dessin**
2. **Ligne de base** → **Repères** → **Éléments principaux**
3. **Panneaux** → **Véhicules** → **Annotations**
4. **Vérification** → **Légende** → **Export**

---

## Résolution de problèmes

### Problèmes courants
- **Outil non disponible** : Vérifiez qu'un calque de dessin est actif
- **Impossible de dessiner** : Assurez-vous que le calque n'est pas verrouillé
- **Échelle incorrecte** : Redéfinissez l'échelle avec l'outil dédié
- **Export vide** : Vérifiez la visibilité des calques

### Performance
- **Zoom lent** : Réduisez le nombre d'objets ou fusionnez les calques
- **Rendu lent** : Diminuez l'opacité des calques image
- **Mémoire insuffisante** : Réduisez la taille des images de fond

---

## Conclusion

Cette application offre tous les outils nécessaires pour créer des plans techniques professionnels avec des éléments de signalisation. La maîtrise des raccourcis clavier et la bonne organisation des calques vous permettront de travailler efficacement et de produire des documents de qualité.

Pour toute question ou suggestion d'amélioration, n'hésitez pas à nous contacter.

---

*Guide utilisateur - Version 1.0*
*© 2024 - Éditeur de Plans avec Panneaux de Signalisation*