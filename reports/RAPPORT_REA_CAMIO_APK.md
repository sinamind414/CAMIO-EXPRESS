# Analyse REA — APK CAMIO (`camio-4-5-0.xapk`)

**Date :** 20 novembre 2026
**Cible :** `C:\Users\zakaria\Downloads\camio-4-5-0.xapk` (51,44 Mo, SHA-256 `59762F74…BE851`)
**Méthode :** REA 6.9.0 + JADX 0.7.1 — analyse **statique** (APK jamais exécuté).

---

## 1. Identification

| Champ | Valeur |
|---|---|
| Conteneur | XAPK = 4 APK : base + `config.arm64_v8a` + `config.en` + `config.xxhdpi` |
| Base | `com.camio.camioapp.apk` (44,48 Mo), SHA-256 `45D4568D…F1DB` |
| **Paquet** | **`com.camio.camioapp`** |
| Version | **4.5.0** (code 10308) |
| SDK | min **32** (Android 12) / target **36** |
| Classes / ressources | **25 427** / 1 862 |
| Composants | **120** (58 activities, 29 services, 24 receivers, 9 providers) |
| **Stack** | **Flutter** (pas React Native) — `libapp.so` de 18 Mo |

> ⚠️ Ce n'est **pas le même paquet** que notre application web MOVEDZ (`hk.easyvan` = Lalamove, `com.uptodown` = store). C'est une app distincte nommée CAMIO.

## 2. Signature

| Propriété | Valeur |
|---|---|
| Schémas | **v2 + v3** (pas de v1) |
| Signataire | `C=US · ST=California · L=Mountain View · O=Google Inc. · OU=Android · CN=Android` |
| Empreinte | `798a4f9540d289b60bc0578fee4b89d834ec74255962ac086d706fb1e4053867` |
| Validité | 2023-05-01 → 2053-05-01 |
| Posture | `self_consistent=true`, source stamp présent, strongest=v3 |

> Le certificat « Android / Google Inc. » est le **certificat de debug Android standard** (`androiddebugkey`). Cela suggère un build **non signé avec une clé de production** (ou ré-signé pour analyse). À vérifier avant toute distribution.

## 3. Permissions (38)

Catégories notables :
- **Localisation** : `ACCESS_FINE/COARSE/BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION` → suivi en arrière-plan
- **Téléphone** : `CALL_PHONE`, `READ_PHONE_STATE`, `READ_PHONE_NUMBERS`
- **Médias** : `CAMERA`, `RECORD_AUDIO`, `READ/WRITE_EXTERNAL_STORAGE`
- **Sécurité** : `USE_BIOMETRIC`, `USE_FINGERPRINT`, `NFC`
- **Notifications / réveil** : `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`
- **Analytics / pub / store** : `AD_ID`, `ACCESS_ADSERVICES_*`, `CHECK_LICENSE`, `BIND_GET_INSTALL_REFERRER_SERVICE`
- **Spécifiques OEM** : OPPO, Huawei, Google Activity Recognition

## 4. Composants exposés (34)

Points d'entrée et intégrations :
- `com.camio.camioapp.MainActivity` (MAIN/VIEW)
- **Stripe** (paiements) : `StripeConnectDeepLinkInterceptorActivity`, `FinancialConnectionsSheet*`, `LinkRedirectHandlerActivity`, `StripeGooglePayPaymentDataCallbacksService` → **paiement en ligne réel** (contrairement à notre CDC v1 cash)
- **AppAuth** (OAuth) : `net.openid.appauth.RedirectUriReceiverActivity`
- **Firebase / Flutter** : messaging, notifications
- **Branch** (liens profonds), **SharePlus**, **WhatsApp OTP** (`com.dashtoon.whatsapp_zero_tap.WhatsappOtpCodeReceiver`)
- **transistorsoft background-fetch** (positions en fond)

## 5. Stack technique (REA)

| Brique | Preuve |
|---|---|
| **Flutter** | `libapp.so` (18 Mo, code Dart), `libflutter.so` (11 Mo), `MainActivity` quasi vide |
| **Mapbox** | `libmapbox-maps.so` (18 Mo), `libmapbox-common.so` (6,8 Mo) |
| **PDFium** | `libpdfium.cr.so` (4,6 Mo) → génération/affichage PDF (contrats, factures ?) |
| **Background location** | `libtslocationmanager.so` (892 Ko) |
| **Paiements** | Stripe Connect + Google Pay + Financial Connections |
| **Auth** | AppAuth/OAuth + **OTP WhatsApp** + biométrie |
| **Tracking** | 278 classes Flutter plugins (notifications locales, partage, etc.) |

### Bibliothèques natives (split arm64) — 16
`libapp.so`, `libflutter.so`, `libmapbox-*.so`, `libpdfium*.so`, `libdartjni.so`, `libtslocationmanager.so`, `libc++_shared.so`, `libimagepipeline.so`, `libsurface_util_jni.so`, `libnative-filters.so`…

## 6. Contenu de `libapp.so` — révélé par scan de chaînes (sans décompilation Dart)

Bien que le code Dart AOT ne soit pas décompilable ici, **50 226 chaînes uniques** extraites de `libapp.so` révèlent l'architecture applicative complète :

### Infrastructure backend (URLs)
| Environnement | URL |
|---|---|
| Dev (global) | `https://app-camio-api-dev.azurewebsites.net/` |
| Staging / Prod (global) | `app-camio-api-staging/prd.azurewebsites.net` |
| **Par pays** | `app-camio-api-{fr,eg,ma}-{dev,staging,prd}.azurewebsites.net` |
| Storage | `https://stcamioprd01.blob.core.windows.net/` |
| Site | `https://camio.app/` · WhatsApp `https://wa.me/` |
| IP check | `/app/common/public/ip/check` |
| Bug tracking | Azure DevOps `CAMIO-Factory/CAMIO` |
| Temps réel | `socket.io` (références migration v3) |
| Analytics | Microsoft Clarity (`clarity.ms`) |

→ L'app **détecte le pays** (FR, EG, MA, + global) et route vers un backend dédié. Modularité bien plus avancée que notre monolithe web.

### Architecture Dart (structure interne)
- **77 écrans** (`package:camio/screens/`) : `role_selection`, `shipper_dashboard/dashboard`, `driver_dashboard/home`, `owner_dashboard/dashboard`, `identity_verification`, `selfie_scan`, `trip_bids`, `trip_completed`, `rating`, `e_payment_summary`, `payment_cards`, `wallet`, `camioner_promo_*`, `reliability_score`…
- **110 providers** : `auth`, `live_tracking`, `stripe`, `e_payment`, `wallet`, `trucks`, `truck_families`, `brands`, `cities`, `drivers`, `shipper_trips`, `driver_trips`, `azure_devops`, `app_config`, `recaptcha`, `language`, `branch`…
- **177 modèles** : `trip`, `cargo_info`, `weight_band`, `truck_type`, `capacity_scale`, `promo_estimation`, `stripe_payment_init/result`, `wallet`, `forms/create_edit_trip_form`…

### Parcours métier révélés (libellés FR extraits)
- **« Changer le camionneur »**, « Camion incompatible », « Type de camion »
- **« Facture de … »**, « Payer la facture », « Paiement exempt »
- **« Incident pendant la livraison »**, « Le livreur a atteint le point de livraison », « Livraison effectuée »
- **« Nous avons besoin de la localisation du colis… »**, « Pour suivre le colis… »
- Statuts temps réel : `driver_confirmed`, `driver_in_way_to_pickup_at`, `driver_in_way_to_dropoff_at`, `trip_live_location_`, `order_nearby_drivers`, `order_submitted_`, `cancelled_bids`, `incidentReported`

→ Les 3 rôles de notre CDC (Client/Chauffeur/Admin) correspondent ici à **shipper / camionneur (driver) / owner**, avec un module **promotions camionneur** et un **score de fiabilité** (`reliability_score`) en plus.

## 7. Comparaison éclair avec notre MOVEDZ (web)

| Aspect | CAMIO APK | MOVEDZ (web) |
|---|---|---|
| Plateforme | Flutter mobile natif | React web |
| Paiement | **Stripe / Google Pay** | Cash (conforme CDC v1) |
| Cartes | Mapbox | Carte vectorielle locale |
| OTP | WhatsApp + SMS | OTP démo |
| PDF | PDFium | absent |
| Signature | debug cert | N/A (web) |

Notre application reste alignée sur le **CDC algérien v1** (cash, 0 commission) ; l'APK CAMIO semble être une version **commerciale plus avancée** (paiements en ligne, OAuth, PDF).

## Preuves
- `camio-4-5-0.xapk`, `camio-apk/` (4 APK)
- `camio-signature.json`, `camio-inventory.json`, `camio-inv-arm.json`
- `camio-package.json`, `camio-package-evidence.json`
- `camio-s-*.json`, `camio-extract.mjs`
