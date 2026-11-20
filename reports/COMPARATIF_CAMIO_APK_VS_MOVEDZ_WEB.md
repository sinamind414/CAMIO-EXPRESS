# Comparatif détaillé — CAMIO APK v4.5.0 vs MOVEDZ (web)

**Date :** 20 novembre 2026
**Sources :** REA sur `camio-4-5-0.xapk` (`com.camio.camioapp`, Flutter) + analyse static MOVEDZ.

## 1. Vue d'ensemble

| Dimension | **CAMIO APK v4.5.0** | **MOVEDZ (web)** |
|---|---|---|
| Nature | App mobile Flutter native | Application web React/Express |
| Paquet | `com.camio.camioapp` | N/A (web) |
| Version | 4.5.0 (build 10308) | 0.0.0 (démo) |
| SDK | min 32 / target 36 | N/A |
| Échelle | 25 427 classes, 120 composants | ~53 fichiers TS, 20 000 lignes |
| Signature | v2+v3, **certificat debug Android** | N/A |
| Statut | Build de production distribué (XAPK) | Prototype local |
| Données | `data/camio-state.json` (côté serveur) | État JSON idem |

## 2. Stack technique

| Brique | CAMIO APK | MOVEDZ | Écart |
|---|---|---|---|
| UI | **Flutter** (`libapp.so` 18 Mo, `libflutter.so` 11 Mo) | React 19 + Vite | Complet (natif vs web) |
| Cartes | **Mapbox** (`libmapbox-maps.so` 18 Mo) | Carte SVG vectorielle locale | Fonctionnel mais simplifié |
| Paiement | **Stripe Connect + Google Pay + Financial Connections** | Cash (CDC v1) | Conforme au CDC, mais moins riche |
| Auth | **AppAuth OAuth + OTP WhatsApp + biométrie** | OTP `00000` + sessions HMAC | Sécurité améliorée mais OTP simplifié |
| PDF | **PDFium** (4,6 Mo) | absent | Manquant |
| Tracking fond | **transistorsoft background-fetch** | WebSocket seul | Mode dégradé 3G non couvert |
| Analytics | Google Ads Services, Branch | aucun | Manquant |
| Stockage | MMKV (via Flutter) | JSON | Adapté à la démo |

## 3. Fonctionnalités

| Fonction | CAMIO APK | MOVEDZ | Verdict |
|---|---|---|---|
| Demande de service (client) | Flutter UI (non lisible sans décompilation Dart) | Assistant 3 questions ✅ | Équivalent fonctionnel |
| 69 wilayas | Inconnu (Dart) | ✅ 69 wilayas | MOVEDZ à jour |
| Enchères / offres | Inconnu (Dart) | ✅ bidding + auto-bid | MOVEDZ complet |
| Inter-wilaya | Inconnu (Dart) | ✅ devis 48h | MOVEDZ complet |
| KYC chauffeur | Inconnu (Dart) | ✅ 4 documents + validation admin | MOVEDZ complet |
| Abonnement | Stripe (payments réels) | ✅ BaridiMob/CCP/voucher (simulé) | Conforme CDC v1 |
| Suivi GPS | Mapbox + background fetch | ✅ WebSocket + trail | MOVEDZ plus simple |
| Preuve livraison | Inconnu (Dart) | ✅ photo obligatoire | MOVEDZ complet |
| Paiement en ligne | ✅ Stripe | ❌ cash (volontaire) | Différence de périmètre |
| PDF / contrats | ✅ PDFium | ❌ | Manquant |
| OTP WhatsApp | ✅ via receiver | ❌ SMS/OTP démo | Amélioration possible |

## 4. Sécurité

| Aspect | CAMIO APK | MOVEDZ |
|---|---|---|
| Signature | ⚠️ Certificat debug (Google Android) | N/A |
| Transport | HTTPS (attendu) | HTTP local (démo) |
| Autorisation | OAuth Stripe/AppAuth | ✅ Rôles + sessions HMAC |
| WebSocket | Inconnu | ✅ authentifié |
| Rate limiting | Inconnu | ✅ 120/min + 40 mutations |
| Idempotence | Inconnu | ✅ clé par requête |
| Données contact | Inconnu | ✅ masquées avant assignment |

MOVEDZ est **étonnamment compétitif** sur la sécurité applicative (héritage des correctifs REA), mais l'APK a l'avantage d'un vrai provider d'identité OAuth et de paiements certifiés.

## 5. Verdict

**MOVEDZ n'est pas une copie de l'APK CAMIO** — ce sont deux produits distincts :
- L'APK CAMIO v4.5.0 est une app Flutter commerciale avec Stripe, OAuth, Mapbox, PDF.
- MOVEDZ est un prototype web fidèle au **CDC algérien v1** (cash, 0 commission, wilayas, bidding), enrichi par l'analyse REA de Lalamove et de cet APK.

**Points à comber si désiré (hors CDC v1) :**
1. Paiement en ligne (Stripe/BaridiMob réel) — mais le CDC v1 l'exclut explicitement.
2. Export PDF (contrat, reçu) — PDFium → jsPDF côté web.
3. Vraie carte Mapbox (clé API requise).
4. Mode dégradé hors-ligne (file d'attente locale).
5. OTP WhatsApp (contractualisation requise).

**Recommandation : rester aligné sur le CDC v1 pour le marché algérien**, et ne reprendre de l'APK que les idées UI (logos 3D déjà intégrés) et la robustesse (déjà renforcée).
