# Aide — Éditeur de Plans

Ce document explique les outils disponibles dans l’application (barre d’outils, calques, export, raccourcis clavier) et le déroulé recommandé pour produire un plan exploitable.

## Sommaire

- Démarrage rapide (workflow recommandé)
- Barre d’outils
  - Outils (dessin / sélection)
  - Mesures (échelle / mesure)
  - Vue (zoom / plein écran / carte)
  - Projet (sauvegarde / chargement)
  - Ajouter objet (panneaux / véhicules / repères / formes)
  - Options (dessin / formes / texte / remplissage)
- Panneau des calques
- Raccourcis clavier
- Export PNG / PDF
- Dépannage (problèmes courants)

---

## Démarrage rapide (workflow recommandé)

1) **Lire les instructions**  
Cliquez sur **Instructions de départ** (bouton en haut) : un fichier texte s’ouvre dans un nouvel onglet/fenêtre.

2) **Ajouter une image de fond**  
Dans le panneau des calques (en bas), cliquez sur **🖼️** (Ajouter une image de fond) et importez l’image.

3) **Calibrer l’échelle**  
Cliquez sur **📏** (Définir l’échelle).  
- Soit vous choisissez une calibration automatique (1:500 ou 1:250).  
- Soit vous calibrez manuellement en traçant une ligne sur une distance connue et en répondant aux questions.

4) **Orienter le plan**  
Sélectionnez le calque de fond, réglez **Angle** et utilisez **✥ Déplacer Calque / Vue** pour aligner le plan.

5) **Définir la zone de travail et créer le calque de dessin**  
Cliquez sur **✏️** (Créer un calque de dessin), puis **cliquez-glissez** pour définir la zone où vous dessinerez.  
Appuyez sur **Échap** pour annuler la sélection de zone.

6) **Tracer la ligne de base (LB)**  
Dessinez une **Ligne de Base** (LB), puis ajoutez véhicules et repères, et réalisez vos mesures.

---

## Barre d’outils

### 1) Outils (dessin / sélection)

#### ↩️ Annuler / ↪️ Rétablir
- **↩️ Annuler (Ctrl+Z)** : annule la dernière action.
- **↪️ Rétablir (Ctrl+Y)** : réapplique l’action annulée.

#### 🖐️ Sélectionner objet
- Permet de **sélectionner**, **déplacer** et **transformer** les objets (selon leurs propriétés).
- Sert aussi à sélectionner une zone (étape “Définir la zone”) lorsque vous créez le calque de dessin.

#### ✥ Déplacer Calque / Vue
- Sert à **déplacer le calque actif** (si c’est un calque image) ou à **panoramiser la vue** (si vous êtes sur le calque de dessin).
- Recommandé pour aligner un calque importé (plan, vue drone, etc.).

#### 〰️ Dessiner ligne
- Trace un **segment** entre le point de départ (clic) et le point d’arrivée (relâchement).
- Utilise les **Options dessin** (couleur, épaisseur, pointillés).

#### ︵ Dessiner courbe
- Crée une **courbe** avec un **point de contrôle**.
- Après création, l’application passe généralement en **sélection** pour permettre d’ajuster le point de contrôle.

#### ⚪ Dessiner cercle
- Trace un cercle à partir d’un point central (départ) et d’un rayon (distance jusqu’au point d’arrivée).
- Utilise les **Options dessin**.

---

### 2) Mesures

#### 📏 Définir l’échelle graphiquement
Objectif : relier les pixels du plan à une distance réelle.

Deux approches :
- **Calibration automatique** : via la modale “Définir l’échelle” (ex. 1:500 ou 1:250).
- **Calibration manuelle** : tracez une ligne sur une distance connue puis indiquez :
  - la **distance réelle** (m),
  - l’**échelle de base** (ex. 500 pour 1:500),
  - l’**échelle finale** souhaitée (ex. 200 pour 1:200).

Notes :
- Tant que l’échelle n’est pas calibrée, certaines fonctions (ex. “Mesurer”, véhicules, repères) peuvent être indisponibles.
- Après calibration, un **verrouillage de zoom** peut s’appliquer temporairement selon le workflow.

#### Mesurer
- Crée une **mesure** entre deux points : ligne pointillée + flèches + valeur en mètres.
- Nécessite une **échelle calibrée**.

---

### 3) Vue

#### Zoom (- / +) et affichage 100%
- **-** : zoom arrière (si zoom non verrouillé)
- **+** : zoom avant (si zoom non verrouillé)
- Cliquez sur **100%** :
  - en mode pourcentage : peut basculer vers un affichage en **échelle** si une échelle de base est connue,
  - en mode échelle : permet de saisir une valeur (ex. “200” pour viser 1:200).

#### 🌍 Carte interactive
- Ouvre une carte (Géoportail) dans un nouvel onglet/fenêtre.

#### ⛶ Plein écran
- Active un mode où l’interface (barre du haut et panneau des calques) peut s’auto-masquer.
- Déplacez la souris près du haut/bas pour faire réapparaître l’interface.

---

### 4) Projet

#### 💾 Sauvegarder le projet
- Enregistre un fichier **.fpj** (JSON) contenant l’état du projet.
- Le bouton peut être désactivé tant qu’aucun contenu pertinent n’existe (ex. pas de calque de dessin).

#### 📁 Charger un projet
- Recharge un fichier **.fpj**.
- Remplace le travail courant (confirmation demandée si un projet est déjà ouvert).

#### 📄 Nouveau projet
- Réinitialise le projet (avec dialogue “Sauvegarder avant ?”).

---

### 5) Ajouter objet

#### 🚦 Ajouter un panneau
- Ouvre une modale de sélection des panneaux.
- Le panneau est ajouté sur le calque actif.
- Possibilité d’ajouter une image personnalisée via un chargeur dédié (selon la modale).

#### 🚗 Ajouter voiture
- Ouvre une modale (largeur, longueur, lettre, couleur, épaisseur).
- Recommandé après avoir créé une **ligne de base (LB)** et calibré l’échelle.

#### ➡️ Ajouter flèche
- Active le mode **flèche** : trace une flèche (ligne + pointe) en dessinant sur le canvas.

#### T Ajouter texte
- Active le mode texte : un clic sur le plan crée une zone de texte éditable.
- Les contrôles (police, taille, style, couleur) apparaissent pendant l’édition.

#### 🚸 Dessiner passage piéton
- Dessinez un rectangle : l’application crée un groupe de bandes (passage piéton).
- Utilise les **Options formes** (couleur/épaisseur).

#### ▽ Dessiner céder le passage
- Dessinez un rectangle : l’application crée une répétition de triangles.
- Utilise les **Options formes**.

#### 🎨 Remplir une zone fermée
- Cliquez à l’intérieur d’une zone fermée pour la remplir.
- Modes :
  - **Solide**
  - **Rayures** (angle + épaisseur + couleur)
- Réglage important : **Tolérance** (utile si les bords sont anti-aliasés ou si l’image n’est pas “parfaitement” fermée).
- Une zone déjà remplie ne peut pas être re-remplie directement : sélectionnez-la (mode sélection) et modifiez ses paramètres si disponible.

#### LB Dessiner ligne de base
- Crée une **ligne de base** (rouge) + un **point zéro** associé.
- Sert de référence pour :
  - les repères (coordonnées),
  - les véhicules (positionnement),
  - les projections/mesures associées.

Astuce :
- Un **double-clic** sur le **point zéro** peut basculer l’affichage du texte (ex. “0” ↔ “0’”) selon le comportement implémenté.

#### TF Dessiner trace de freinage
- Dessinez un segment : l’application crée une **trace** (polygone) qui s’élargit vers l’extrémité.

#### 📍 Ajouter un point de repère
- Ouvre une modale demandant des coordonnées (en mètres) par rapport à la **ligne de base** et au **point 0**.
- Le bouton peut être désactivé si les prérequis ne sont pas remplis (calque de dessin actif + LB + échelle).

#### 📍 Visible / Coords
- **Visible** : affiche/cache les repères.
- **Coords** : affiche/cache les coordonnées des repères.

---

### 6) Options (groupes contextuels)

Les options visibles changent selon l’outil actif.

#### Options dessin
Pour les outils de dessin (ex. ligne, courbe, cercle, flèche) :
- **Couleur**
- **Épaisseur**
- **Pointillés** + **Espacement**

#### Options formes
Pour certains outils “formes” (passage piéton, céder le passage, etc.) :
- **Couleur**
- **Épaisseur**

#### Texte
Pendant l’édition d’un texte :
- **Couleur**
- **Police**
- **Taille**
- **Gras / Italique / Souligné**

#### Remplissage
Pour l’outil remplissage et la modification d’un objet rempli :
- Couleur, type (solide/rayures)
- Angle et épaisseur des rayures
- Tolérance du remplissage

---

## Panneau des calques (en bas)

### Boutons principaux
- **🖼️ Ajouter une image de fond** : ajoute le plan principal (une seule fois).
- **➕🖼️ Ajouter un calque image** : ajoute des calques supplémentaires (fichiers ou collage presse-papiers selon la modale).
- **🚁 Importer une vue drone** : ajoute une “Vue drone” et lance une calibration spécifique (souvent via l’outil 📏).
- **✏️ Créer un calque de dessin** : déclenche la sélection de zone (cliquez-glissez), puis crée le calque de dessin.

### Contrôles par calque
Chaque calque possède :
- **👁️ / ➖ Visibilité** : afficher/cacher le calque
- **🔒 / 🔓 Verrouillage** : empêche certaines actions (sélection, déplacement, réglages)
- **Opacité (slider)** : utile pour aligner deux images (plan + drone)
- **Angle (degrés)** : rotation du calque (0–360)
- **🗑️ Suppression** : supprime le calque

Conseils :
- Sélectionnez le bon calque avant de dessiner/ajouter des objets.
- Pour aligner un calque, diminuez l’opacité, ajustez l’angle, puis utilisez l’outil **✥**.

---

## Raccourcis clavier (principaux)

- **Ctrl+Z** : Annuler
- **Ctrl+Y** : Rétablir
- **Ctrl+C** : Copier la sélection
- **Ctrl+V** : Coller (décalage automatique pour éviter la superposition parfaite)
- **Suppr / Backspace** : Supprimer la sélection
- **Flèches** : déplacer l’objet sélectionné
  - **Shift + flèches** : déplacement plus grand
- **Ctrl + flèches gauche/droite** : rotation (avec Shift = rotation plus forte)
- **Échap**
  - annule un dessin en cours,
  - annule la sélection de zone (création calque de dessin).

---

## Export PNG / PDF

### Export PNG
- Exporte une image PNG en combinant les calques visibles.
- Utilise un calque de référence pour la taille (souvent “Plan rogné” ou le calque de dessin).

### Export PDF
- Lance une exportation PDF et peut demander une **légende** avant génération.
- Le PDF inclut la composition des calques, et peut inclure des éléments liés à l’échelle (si disponible).

---

## Dépannage (problèmes courants)

### “Mesurer” ne fonctionne pas / demande de calibrer
- Calibrez d’abord l’échelle via **📏**.

### Certains boutons (voiture / repère) sont grisés
Vérifiez :
- vous êtes sur le **calque de dessin**,
- la **ligne de base (LB)** existe,
- l’**échelle** est calibrée.

### Je n’arrive pas à remplir une zone
Essayez :
- augmenter la **Tolérance**,
- vérifier que la zone est bien fermée (lignes continues),
- zoomer pour cliquer clairement dans la zone vide.

### Le zoom est bloqué
Cela peut arriver pendant certaines étapes du workflow (calibrage/alignement). Terminez l’étape en cours (ex. validation alignement drone, création du calque de dessin).

