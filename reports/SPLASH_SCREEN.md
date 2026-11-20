# Splash screen animé MOVEDZ

**Date :** 20 novembre 2026
**Source :** animation extraite de `cran_de_d_marrage_anim_movedz (2).html` (uniquement l'animation, pas le studio ni l'accueil).

## Intégration
- **`src/components/SplashScreen.tsx`** (nouveau) : logo SVG MOVEDZ complet (lettres M V E D Z, roue à 36 crans remplaçant le « O », lapin orange bondissant) + chorégraphie 60 FPS :
  1. roue qui roule (540°) + 3 lignes de vitesse (0–680 ms)
  2. bond parabolique du lapin + micro-rebond de la roue (680–1100 ms)
  3. lettres M, V, E, D, Z en ressort + shimmer diagonal (1100–1500 ms)
  4. slogan « Le transport à la demande, partout en Algérie » + barre de progression bicolore 60 % violet / 40 % orange
- **`App.tsx`** : affiché au chargement, une fois par session (`sessionStorage`), puis fondu (zoom 1,05x) vers l'écran « Qui êtes-vous ? ».
- Respecte `prefers-reduced-motion`.

## Vérifications
- `tsc --noEmit` : 0 erreur · tests **86/86 passent**
- Navigateur : splash visible au chargement (logo + tagline + `69 WILAYAS • ALGÉRIE`), disparition après ~3 s → écran de sélection du rôle, **0 erreur console**
- Serveur : healthcheck 200
