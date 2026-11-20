# Analyse REA — Inscription chauffeur sur Lalamove

**Date :** 19 novembre 2026
**Source :** REA (JADX 0.7.1) sur `Lalamove-116.5.1.apk`, paquet `hk.easyvan.app.client`.

## 1. Ce que révèle REA

### Classes d'inscription (auth)
| Classe | Rôle |
|---|---|
| `com.deliverysdk.global.ui.auth.signup.SignUpFragment` / **`SignUpViewModel`** | Écran d'inscription (15 méthodes dont `requestPhoneConfirmation`, `handleSnaVerified`) |
| `com.deliverysdk.global.ui.auth.signup.SignUpViewModel$InputField` | Champs du formulaire (nom, téléphone, etc.) |
| `com.deliverysdk.global.ui.auth.signup.zzw` | Modèle de requête : `String, String, String, VerificationMethod, boolean, String, boolean, boolean, String` (9 champs) |
| `com.deliverysdk.global.ui.auth.sms.CodeVerificationViewModel` | Vérification du code SMS (`verifyCodeForRegister`) |
| `com.deliverysdk.global.navigator.common.stream.NavigatorStreamImpl$loginOrRegisterSucceed` | Navigation après succès |
| `com.deliverysdk.module.driver.activity.DriverInfoActivity` | Informations chauffeur (profil) |

### Énumérations (le cœur du parcours)
**`VerificationMethod`** — 5 moyens de vérifier le numéro :
```
SMS · VOICE_CALL · MISSED_CALL · VIBER · EMAIL
```
→ Lalamove s'adapte au réseau dégradé : si le SMS n'arrive pas, **appel vocal, appel manqué, Viber ou e-mail**.

**`VerificationSource`** — 5 origines :
```
ManualSignUp · SocialSignUp · EmailVerification · ChangePassword · ForgetPassword
```

### Types constants
`RegisterResponse`, `RegisterApiInterceptor`, `SocialRegisterApiInterceptor`, `RegisterCorporateResponse`, `SignUpErrorType`, `SignUpPageSourceType`, `SignUpParent`, `SignUpSourceType`, `SocialSignUpSourceType`, `CheckPhoneNumberUseCase`...

## 2. Parcours reconstitué (inscription chauffeur Lalamove)

| Étape | Action | Preuve REA |
|---|---|---|
| **1. Saisie** | Numéro de téléphone + nom + pays (indicatif +213) | `SignUpViewModel$InputField`, modèle `zzw` |
| **2. Vérification téléphone** | Choix du moyen : **SMS / appel vocal / appel manqué / Viber / e-mail** | `VerificationMethod` (5 valeurs) |
| **3. Code OTP** | Saisie du code reçu | `CodeVerificationViewModel.verifyCodeForRegister` |
| **4. Création compte** | `RegisterResponse` + navigation `loginOrRegisterSucceed` | `RegisterApiInterceptor`, `NavigatorStreamImpl` |
| **5. Profil chauffeur** | Informations complémentaires (véhicule, documents) | `DriverInfoActivity`, `OrderDetailDriverInfoModel`, `DriverInfo2` |
| **6. Vérification KYC** | Pièces + conformité | `handleDriverInfoVerification` (OrderDriverFragment) |
| **7. Activation** | Mise en ligne + réception de courses | `MyDriverFragment` |

**Particularité majeure** : Lalamove propose **5 canaux de vérification**, dont l'appel manqué et Viber — pensé pour les marchés où la livraison SMS est incertaine (risque R3 du CDC algérien).

## 3. Comparaison avec MOVEDZ (notre implémentation)

| Étape | Lalamove | MOVEDZ (actuel) |
|---|---|---|
| Saisie | Téléphone + nom + pays | ✅ Téléphone + nom + wilaya |
| Vérification | **5 canaux** (SMS, vocal, manqué, Viber, email) | ⚠️ OTP unique (`00000` en démo) |
| Code OTP | OTP serveur | ✅ OTP configurable |
| Création compte | Register API | ✅ `POST /driver/signup` |
| KYC | Vérification infos chauffeur | ✅ 4 documents déclarés |
| Activation | Mise en ligne | ✅ `/availability` |

**Écart principal : les 5 canaux de vérification.** MOVEDZ n'a qu'un OTP de démonstration. Pour un marché algérien (risque R3 : délivrabilité SMS), ajouter au moins **l'appel vocal / appel manqué** serait un vrai plus fonctionnel.

## 4. Ce que REA ne peut pas donner
Les corps de méthodes sont obfusqués (`zzd`, `zzp`, …) : REA révèle la **structure** (classes, énumérations, champs de requête), pas la logique métier exacte de chaque écran. Les libellés UI précis nécessiteraient une exécution de l'app (hors périmètre statique).
