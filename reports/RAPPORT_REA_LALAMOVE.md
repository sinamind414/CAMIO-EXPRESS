# Analyse REA — Application Lalamove (EasyVan)

**Date :** 19 novembre 2026
**Cible :** `C:\Users\zakaria\Downloads\Lalamove.zip` → `Lalamove-116.5.1.apk` (base) + 3 splits
**Méthode :** REA 6.9.0 + JADX headless 0.7.1. Analyse **statique** : l'APK n'est jamais exécuté.

---

## 1. Identification

| Champ | Valeur |
|---|---|
| Archive | `Lalamove.zip` (96,47 Mo), SHA-256 `93FF91BB…E9D`, 4 entrées |
| Split APKs | `Lalamove-116.5.1.apk` (67,02 Mo, SHA-256 `F147D523…80D`), `config.en.apk` (2,81 Mo), `config.xxhdpi.apk` (1,01 Mo), `config.arm64_v8a.apk` (25,63 Mo) |
| **Paquet** | **`hk.easyvan.app.client`** (ancien nom EasyVan = Lalamove) |
| Version | **116.5.1** (code 116502) |
| SDK | min **23** (Android 6) / target **35** — conforme au CDC §3.2 (minSdk 23, targetSdk 35) |
| Classes / ressources | **41 278** / **3 169** |
| DEX | **8 fichiers** (~60 Mo) |
| Moteur | JADX 0.7.1 (JAR vérifié `6e5eacf5…`) |

> **Confirmation :** c'est la **vraie application Lalamove/EasyVan**. Le paquet `hk.easyvan.app.client` correspond exactement au « easyvan » du nom du fichier Uptodown précédent — qui était bien le client Uptodown mal nommé, distinct de celui-ci.

## 2. Signature

| Propriété | Valeur |
|---|---|
| Schémas | v1 + v2 + v3 |
| Signataire | **C=CN · ST=China · L=Hong Kong S.A.R. · O=EasyVan Holdings Limited · OU=MIS Department · CN=Matthew Tam** |
| Empreinte SHA-256 | `2407a2fa4b78f69fb10c0301c24e91b9a23ba131278a7f28cf39870804e216a4` |
| Validité | 2013-10-23 → 2063-10-11 (≈ 50 ans) |
| Posture | signataires cohérents, `strongest=v3`, `self_consistent=true`, source stamp présent, pas de rotation |

`CN=Matthew Tam` = Matthew Tam (Chow Shing-yuk), fondateur de Lalamove/EasyVan. Le certificat date de **2013**, année de fondation (→ [Wikipedia](https://en.wikipedia.org/wiki/Lalamove)). *Lecture structurelle : aucune vérification cryptographique effectuée.*

## 3. Permissions (44)

Catégories observées :

- **Localisation** : `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` (suivi GPS et recherche de chauffeurs à proximité).
- **Réseau / notifications** : `INTERNET`, `ACCESS_NETWORK_STATE`, `CHANGE_NETWORK_STATE`, `CHANGE_WIFI_STATE`, `WAKE_LOCK`, `POST_NOTIFICATIONS`, `VIBRATE`, `FOREGROUND_SERVICE`, `SCHEDULE_EXACT_ALARM`.
- **Médias / appareil** : `CAMERA` (photos de courses et KYC), `RECORD_AUDIO` (notes vocales), `READ/WRITE_EXTERNAL_STORAGE`, `READ_CONTACTS`, `BLUETOOTH`/`BLUETOOTH_CONNECT`, `LOCAL_MAC_ADDRESS`.
- **Sécurité / biométrie** : `USE_BIOMETRIC`, `USE_FINGERPRINT`, `DISABLE_GUARD`, `SYSTEM_OVERLAY_WINDOW`, `READ_PRIVILEGED_PHONE_STATE`, `WRITE_SETTINGS`, `MANAGE_OWN_CALLS`, `FOREGROUND_SERVICE_MICROPHONE`, `FOREGROUND_SERVICE_PHONE_CALL`.
- **Analytics / pub / store** : `com.google.android.gms.permission.AD_ID`, `ACCESS_ADSERVICES_*` (attribution, audience, topics), `com.google.android.c2dm.permission.RECEIVE`, `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`, `com.samsung.android.mapsagent.permission.READ_APP_INFO`, `com.huawei.appmarket...GET_COMMON_DATA`.

> La permission `SYSTEM_OVERLAY_WINDOW` et `DISABLE_GUARD` méritent une attention en recette sécurité (overlay = risque de tap-jacking, disable guard = contournement de verrouillage — typiquement lié à la sécurité « chauffeur en conduite »).

## 4. Composants du manifeste

| Type | Nombre |
|---|---:|
| activity | 46 |
| service | 23 |
| receiver | 16 |
| provider | 9 |
| **Total** | **94** |

**21 composants exposés**, dont les points d'entrée métier :

| Composant | Rôle apparent |
|---|---|
| `com.deliverysdk.app.launcherrouter.LauncherRouterActivity` | Launcher principal (MAIN + VIEW) |
| `com.deliverysdk.global.ui.home.GlobalHomeActivity` | Accueil global |
| `com.deliverysdk.global.base.single.MasterSingleActivity` | Conteneur d'écrans (deep links) |
| `com.deliverysdk.module.webview.WebViewActivity` | Contenu WebView |
| `hk.easyvan.app.client.wxapi.WXPayEntryActivity` | **Paiement WeChat Pay** |
| `com.deliverysdk.app.push.GlobalMessagingService` | Notifications push Firebase |
| `com.facebook.*`, `com.google.firebase.*`, `androidx.work.*` | Login social, push, tâches différées |

Le manifeste déclare 8 DEX et aucun `.so` dans le base APK (les bibliothèques natives sont dans le split `config.arm64_v8a.apk`).

## 5. Stack technique révélée

| Brique | Classes observées |
|---|---|
| **Delivery SDK** (cœur) | `com.deliverysdk.*` — launcher, home, auth, confirmation, webview, push |
| **Kotlin Multiplatform (KMP)** | `com.deliverysdk.kmp.data.network.{team,user}.*ServiceGenerated` — API générées (coroutines `Continuation`) |
| **Commandes / order** | `com.delivery.post.mb.global_order.*` (`MapOrderBusiness`, `IMapOrderBusiness`, `OrderStatusSources`) |
| **Paiement** | `com.adyen.checkout.components.*` (Adyen), WeChat Pay |
| **Cartographie** | `com.dmk.map.kmp.common.core.delagate.net.KMPMapApiServiceDelegate` |
| **IM / messagerie** | `com.deliverysdk.im.network.IMApiService`, DTO `IM*RawResponse` |
| **Réseau** | OkHttp (`MultipartBody$Part`), Retrofit-style services `suspend` |
| **Social / push / analytics** | Facebook, Firebase Messaging/IID, Google Ads Services |

Recherches REA : `Order` → **1 049 classes** ; `ApiService` → 11 classes ; `BuildConfig` (recherche interrompue).

### Exemple : `com.deliverysdk.im.network.IMApiService`

Interface `suspend` (6 méthodes, DTO typés) :

- `getIMChannels(Map<String,String>) → IMChannelsRawResponse`
- `getIMConfig(...) → IMConfigRawResponse`
- `getIMLunaToken(String, Map) → IMLunaConfigRawResponse`
- `getIMOrderInfo(Map) → IMOrderInfoRawResponse`
- `getRiskWasher(Map) → IMRiskWasherRawResponse` ← **module de lutte anti-fraude / scoring de risque**
- `uploadImageFileByLuna(MultipartBody.Part, ...) → IMLunaRawResponse` ← **stockage d'images via « Luna »** (service interne Lalamove)

Cela confirme une architecture **API-first, modulaire, Kotlin Multiplatform**, avec des services générés et un composant de scoring de risque notable — très éloigné du prototype MOVEDZ.

## 6. Ce que REA a couvert / limites

- ✅ Couvert : signature structurelle, manifeste complet, 44 permissions, 94 composants, 41 278 classes inventoriées, recherche de classes, décompilation d'une interface réseau (signatures + descripteurs DEX).
- ⚠️ Non couvert : décompilation de corps de méthodes natives (les `.so` sont dans le split arm64, non analysé ici) ; aucune vérification cryptographique de signature ; aucun test d'exécution.
- Note : les corps de méthodes `suspend` sont des interfaces sans implémentation dans cette classe — seul le contrat est visible.

## 7. Preuves

- `Lalamove.zip`, `lalamove-apk/` (4 APK extraits)
- `lalamove-signature.json` — signature
- `lalamove-inventory.json` — inventaire (3 170 occurrences, 8 DEX)
- `lalamove-package.json` + `lalamove-package-evidence.json` — manifeste, permissions, composants
- `lalamove-search-ApiService.json`, `lalamove-search-Order.json` — recherches de classes
- `lalamove-class-imapi.json` — décompilation de l'interface API IM

---

## Bilan rapide

Lalamove 116.5.1 est une application **industrielle** : 41 k classes, SDK maison, KMP, Adyen + WeChat Pay, scoring de risque, IM propriétaire, 8 DEX, targetSdk 35, signée par EasyVan Holdings depuis 2013. Elle contraste fortement avec **MOVEDZ**, prototype web (55 fichiers, état JSON, OTP `00000`) pourtant inspiré du CDC « Lalamove Algérie ». Le fossé porte sur l'échelle, la stack mobile native, les paiements et la sécurité — pas sur l'intention métier.
