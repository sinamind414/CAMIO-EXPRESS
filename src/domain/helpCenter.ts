import type { Locale, WorkspaceRole } from './types';

export type HelpCategory =
  | 'all'
  | 'booking'
  | 'verification'
  | 'pricing_cash'
  | 'intercity'
  | 'driver_ops';

export type HelpAudience = 'all' | 'client' | 'driver';

export interface HelpArticle {
  id: string;
  category: Exclude<HelpCategory, 'all'>;
  audience: Exclude<HelpAudience, 'all'> | 'both';
  questionFr: string;
  questionAr: string;
  summaryFr: string;
  summaryAr: string;
  stepsFr: string[];
  stepsAr: string[];
  noteFr?: string;
  noteAr?: string;
  keywords: string[];
  actionWorkspace?: WorkspaceRole;
  actionLabelFr?: string;
  actionLabelAr?: string;
}

export interface HelpSearchResult {
  article: HelpArticle;
  score: number;
}

export const HELP_CATEGORIES: Array<{
  id: HelpCategory;
  fr: string;
  ar: string;
}> = [
  { id: 'all', fr: 'Toutes les rubriques', ar: 'جميع المواضيع' },
  { id: 'booking', fr: 'Réservation', ar: 'الحجز' },
  { id: 'verification', fr: 'Vérification & Identité', ar: 'التحقق والهوية' },
  { id: 'pricing_cash', fr: 'Tarifs & Cash', ar: 'الأسعار والدفع' },
  { id: 'intercity', fr: 'Entre wilayas', ar: 'بين الولايات' },
  { id: 'driver_ops', fr: 'Espace Chauffeur', ar: 'فضاء السائق' },
];

export const ONBOARDING_SHORTCUTS: Array<{
  id: string;
  query: string;
  labelFr: string;
  labelAr: string;
}> = [
  {
    id: 'book-mover',
    query: 'How to book a mover',
    labelFr: 'Comment réserver un déménageur',
    labelAr: 'كيفية حجز شاحنة نقل أثاث',
  },
  {
    id: 'verify-driver',
    query: "How to verify a driver's ID",
    labelFr: "Vérifier l'identité d'un chauffeur",
    labelAr: 'التحقق من هوية السائق',
  },
  {
    id: 'cash-pricing',
    query: 'cash commission prix',
    labelFr: 'Calcul du prix & cash (0 %)',
    labelAr: 'حساب السعر والدفع نقداً',
  },
  {
    id: 'intercity-quotes',
    query: 'entre wilayas devis',
    labelFr: 'Trajet Entre wilayas (48 h)',
    labelAr: 'النقل بين الولايات (48 ساعة)',
  },
  {
    id: 'voucher-sub',
    query: 'BaridiMob voucher abonnement',
    labelFr: 'Abonnement & code Voucher',
    labelAr: 'الاشتراك وبطاقة التعبئة',
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'faq-book-mover',
    category: 'booking',
    audience: 'client',
    questionFr: 'Comment réserver un déménageur ou un camion (En ville ou Entre wilayas) ?',
    questionAr: 'كيف تحجز شاحنة نقل أثاث (داخل المدينة أو بين الولايات)؟',
    summaryFr:
      'Choisissez le mode En ville (immédiat) ou Entre wilayas (planifié J+1 à J+60), décrivez votre chargement et comparez les offres directes.',
    summaryAr:
      'اختر وضع «في المدينة» (فوري) أو «بين الولايات» (مبرمج من غد إلى 60 يوماً)، أضف تفاصيل الحمولة وقارن العروض المباشرة.',
    stepsFr: [
      'Ouvrez l’Espace Client puis sélectionnez « En ville » (course immédiate dans votre wilaya) ou « Entre wilayas » (trajet longue distance).',
      'Étape 1 — Choisissez votre prestation (Déménagement, Évacuation gravats ou Transport de marchandises) et la catégorie de véhicule (Petit utilitaire 4 m³, Camion moyen 3,5 t / 12 m³, Grand camion 25 m³ ou Benne).',
      'Étape 2 — Indiquez la wilaya et les adresses de départ et d’arrivée, puis vérifiez l’aperçu du trajet et le kilométrage.',
      'Étape 3 — Précisez les étages, l’accès ascenseur, le nombre de manutentionnaires (bras), le démontage et ajoutez au moins 1 photo en ville (2 photos minimum en longue distance) pour recevoir des offres 3× plus précises.',
      'Étape 4 — Consultez le détail transparent de l’estimation, publiez la demande et acceptez l’offre du chauffeur qui vous convient (tarif, note, délai d’arrivée).',
    ],
    stepsAr: [
      'افتح «فضاء الزبون» ثم اختر «في المدينة» (طلب فوري داخل الولاية) أو «بين الولايات» (رحلة مبرمجة لمسافة طويلة).',
      'المرحلة 1 — حدد نوع الخدمة (نقل الأثاث، إخلاء الردوم أو نقل البضائع) وفئة الشاحنة المناسبة لحجم أغراضك.',
      'المرحلة 2 — أدخل الولاية وعنواني الانطلاق والوصول وتحقق من المسار والمسافة على الخريطة.',
      'المرحلة 3 — حدد الطوابق، توفر المصعد، عدد عمال الشحن (البرا) وخيار الفك والتركيب، ثم أرفق صورة واحدة على الأقل (أو صورتين بين الولايات) للحصول على عروض أدق.',
      'المرحلة 4 — راجع تفصيل السعر التقديري، انشر الطلب، ثم اختر العرض الأنسب من السائقين.',
    ],
    noteFr: 'En mode En ville, la fenêtre d’enchères dure 15 minutes. En mode Entre wilayas, les devis sont collectés pendant 48 heures.',
    noteAr: 'في وضع «في المدينة» تستمر مرحلة العروض 15 دقيقة، وفي وضع «بين الولايات» تُجمع العروض خلال 48 ساعة.',
    keywords: [
      'how to book a mover',
      'book a mover',
      'book mover',
      'moving truck',
      'reserver demenageur',
      'demenagement',
      'en ville',
      'etapes reservation',
      'حجز نقل اثاث',
      'شاحنة نقل',
    ],
    actionWorkspace: 'client',
    actionLabelFr: 'Réserver un déménageur',
    actionLabelAr: 'ابدأ الحجز الآن',
  },
  {
    id: 'faq-verify-driver-id',
    category: 'verification',
    audience: 'both',
    questionFr: 'Comment vérifier l’identité et les documents d’un chauffeur ?',
    questionAr: 'كيف يتم التحقق من هوية السائق ووثائقه؟',
    summaryFr:
      'Chaque chauffeur passe un contrôle KYC à 6 pièces avant d’être autorisé à rouler ; côté client, vous vérifiez plaque, profil et assurance avant chargement.',
    summaryAr:
      'يخضع كل سائق لمراجعة إلزامية لـ 6 وثائق قبل اعتماد حسابه، كما يتحقق الزبون من اللوحة والتأمين عند الاستلام.',
    stepsFr: [
      'Contrôle plateforme (KYC obligatoire) : avant toute activation « En ligne », l’équipe Administration contrôle 6 justificatifs — Carte d’identité nationale (CNI), Permis de conduire, Carte grise du véhicule, Attestation d’assurance en cours de validité, Photo du camion et Photo avec plaque d’immatriculation lisible.',
      'Statut bloquant côté système : un chauffeur dont le dossier est « En cours d’examen », « Documents manquants », « Suspendu » ou « Bloqué » reçoit l’erreur DRIVER_NOT_APPROVED et ne peut recevoir aucune demande.',
      'Ce que voit le client sur chaque offre : le nom complet du chauffeur, sa note moyenne vérifiée (urbaine et longue distance séparées), son nombre de courses réalisées, le modèle du véhicule et la plaque masquée (ex. 01892-***-31).',
      'Vérification au point de départ : une fois l’offre acceptée, vous voyez le numéro de téléphone direct du chauffeur. À son arrivée, vérifiez la correspondance entre la plaque du camion, son identité et son attestation d’assurance véhicule avant de charger.',
    ],
    stepsAr: [
      'مراجعة المنصة (ملف KYC إلزامي): قبل السماح لأي سائق بالاتصال، تتحقق الإدارة من 6 وثائق: بطاقة التعريف الوطنية، رخصة السياقة، البطاقة الرمادية، شهادة التأمين سارية المفعول، صورة الشاحنة وصورة واضحة للوحة الترقيم.',
      'قفل تقني صارم: أي سائق ملفه «قيد المراجعة» أو «موقوف» لا يمكنه التبديل إلى وضع «متاح» أو إرسال أي عرض.',
      'ما يراه الزبون في كل عرض: الاسم الكامل للسائق، تقييمه الحقيقي، عدد الرحلات المنجزة، نوع الشاحنة ورقم اللوحة الجزئي للتحقق.',
      'التأكد عند الوصول: بعد قبول العرض يظهر رقم هاتف السائق مباشرة، ويُنصح بمطابقة لوحة الشاحنة والهوية وشهادة التأمين قبل بدء الشحن.',
    ],
    noteFr: 'Les administrateurs peuvent approuver, rejeter avec motif, ou suspendre un chauffeur à tout moment depuis l’onglet « Chauffeurs & KYC ».',
    noteAr: 'يمكن للإدارة اعتماد أو رفض أو إيقاف أي سائق في أي وقت عبر قسم «السائقون والوثائق».',
    keywords: [
      "how to verify a driver's id",
      'how to verify a driver id',
      'verify driver id',
      'driver id',
      'identity verification',
      'kyc',
      'carte nationale',
      'permis de conduire',
      'carte grise',
      'assurance',
      'plaque',
      'هوية السائق',
      'بطاقة التعريف',
      'وثائق',
    ],
    actionWorkspace: 'admin',
    actionLabelFr: 'Voir les dossiers KYC (Admin)',
    actionLabelAr: 'مراجعة ملفات السائقين',
  },
  {
    id: 'faq-otp-phone',
    category: 'verification',
    audience: 'client',
    questionFr: 'Comment fonctionne la vérification téléphonique OTP (+213) ?',
    questionAr: 'كيف يعمل التحقق من رقم الهاتف عبر OTP (+213)؟',
    summaryFr:
      'Un numéro algérien vérifié (+213) sécurise vos demandes, permet l’appel direct avec le chauffeur et prévient les fausses publications.',
    summaryAr:
      'يضمن رقم الهاتف الجزائري المؤكد (+213) جدية الطلبات والتواصل المباشر مع السائق.',
    stepsFr: [
      'Cliquez sur « Vérifier téléphone OTP » en haut de l’Espace Client.',
      'Saisissez votre numéro mobile algérien au format +213 (ex. +213551889900) puis demandez l’envoi du code SMS.',
      'Entrez le code à 5 chiffres reçu (en environnement de recette/démonstration, utilisez le code 00000) puis cliquez sur « Valider OTP ».',
    ],
    stepsAr: [
      'اضغط على «تأكيد الهاتف OTP» في أعلى فضاء الزبون.',
      'أدخل رقم هاتفك الجزائري بصيغة +213 ثم اطلب إرسال رمز التحقق.',
      'أدخل الرمز المكون من 5 أرقام (في بيئة التجربة استخدم الرمز 00000) واضغط «تأكيد».',
    ],
    keywords: ['otp', 'telephone', 'phone', 'sms', '00000', '+213', 'تحقق الهاتف', 'رمز التحقق'],
    actionWorkspace: 'client',
    actionLabelFr: 'Vérifier mon numéro',
    actionLabelAr: 'تأكيد الهاتف الآن',
  },
  {
    id: 'faq-pricing-cash',
    category: 'pricing_cash',
    audience: 'both',
    questionFr: 'Comment sont calculés les prix et comment fonctionne le paiement cash (0 % commission) ?',
    questionAr: 'كيف تُحسب الأسعار وكيف يتم الدفع نقداً (0% عمولة)؟',
    summaryFr:
      'La plateforme affiche une estimation détaillée transparente et borne les offres entre 0,85× et 2,5× ; le règlement se fait 100 % en espèces au chauffeur.',
    summaryAr:
      'تعرض المنصة تقديراً مفصلاً وتضبط العروض بين 0.85× و2.5×؛ الدفع يتم نقداً بالكامل للسائق عند التسليم.',
    stepsFr: [
      'Formule transparente : tarif de base du véhicule + distance (km) + supplément étages sans ascenseur (500 DA/étage) + main-d’œuvre (2 400 DA par manutentionnaire) + forfait décharge agréée (3 000 DA pour gravats). Le total est arrondi aux 500 DA supérieurs.',
      'Fourchette anti-abus : les chauffeurs proposent librement leur prix dans l’intervalle [plancher 0,85×, plafond 2,5×] de l’estimation (ou 1,8× en longue distance).',
      '0 % commission sur les courses : CAMIO EXPRESS ne prélève aucun pourcentage sur vos courses. Vous réglez directement le montant convenu en espèces au chauffeur une fois la livraison terminée.',
    ],
    stepsAr: [
      'معادلة واضحة: التسعيرة الأساسية للشاحنة + تكلفة المسافة + الطوابق بدون مصعد + عدد العمال + رسم التفريغ للردوم، مع تقريب المبلغ لأقرب 500 دج.',
      'نطاق عادل للعروض: يقدّم السائقون أسعارهم ضمن مجال مضبوط (0.85× كحد أدنى إلى 2.5× كحد أقصى في المدينة).',
      '0% عمولة على الرحلات: يدفع الزبون المبلغ المتفق عليه نقداً ومباشرة للسائق عند انتهاء التوصيل.',
    ],
    keywords: [
      'prix',
      'tarif',
      'estimation',
      'cash',
      'especes',
      'commission',
      '0%',
      'fourchette',
      'pricing',
      'دفع نقدي',
      'عمولة',
      'السعر',
    ],
    actionWorkspace: 'client',
    actionLabelFr: 'Simuler un tarif',
    actionLabelAr: 'احسب السعر التقديري',
  },
  {
    id: 'faq-intercity-flow',
    category: 'intercity',
    audience: 'client',
    questionFr: 'Comment réserver un trajet Entre wilayas et choisir la « Meilleure offre » ?',
    questionAr: 'كيف تحجز رحلة بين الولايات وتختار «أفضل عرض»؟',
    summaryFr:
      'Planifiez entre J+1 et J+60, joignez 2 photos minimum et comparez les devis selon le score pondéré Prix (40 %), Note (30 %), Expérience axe (20 %) et Réactivité (10 %).',
    summaryAr:
      'برمج رحلتك بين غد و60 يوماً، أرفق صورتين على الأقل وقارن العروض حسب السعر والتقييم والخبرة على نفس المحور.',
    stepsFr: [
      'Sélectionnez la wilaya de départ et d’arrivée sur la matrice des axes actifs (ex. Oran ↔ Alger 432 km) et une date entre J+1 et J+60 avec votre flexibilité (±1 jour, ±3 jours ou date fixe).',
      'Joignez au moins 2 photos de votre chargement. La plateforme calcule le prix de référence sur l’axe pour éclairer votre budget.',
      'Pendant 48 h, les chauffeurs envoient leurs devis scellés (ils ne voient pas les montants concurrents). La liste met en avant la « Meilleure offre » selon 4 critères : Prix (40 %), Note longue distance (30 %), Expérience sur cet axe (20 %) et Rapidité de réponse (10 %).',
      'Vous pouvez envoyer 1 contre-offre par devis, puis confirmer votre engagement horodaté. Au-delà de 40 000 DA, déclarez votre acompte CCP/BaridiMob directement dans l’écran d’acceptation.',
    ],
    stepsAr: [
      'اختر ولاية الانطلاق والوصول من جدول المحاور المفعلة (مثل وهران ↔ الجزائر 432 كم) وحدد التاريخ من غد حتى 60 يوماً مع مرونة التوقيت.',
      'أرفق صورتين على الأقل للحمولة؛ يظهر السعر المرجعي الرسمي للمساعدة في تحديد ميزانيتك.',
      'خلال 48 ساعة تستقبل عروضاً سرية من السائقين مرتبة حسب «أفضل عرض»: السعر (40%)، التقييم بين الولايات (30%)، الخبرة على نفس المسار (20%) وسرعة الرد (10%).',
      'يمكنك إرسال عرض مضاد واحد لكل عرض، ثم تأكيد الالتزام. للرحلات التي تتجاوز 40,000 دج يتم التصريح بعربون CCP/بريدي موب.',
    ],
    keywords: [
      'entre wilayas',
      'intercity',
      'longue distance',
      'meilleure offre',
      'devis',
      'contre-offre',
      'acompte',
      '40000',
      'بين الولايات',
      'مسافة طويلة',
      'أفضل عرض',
    ],
    actionWorkspace: 'client',
    actionLabelFr: 'Planifier Entre wilayas',
    actionLabelAr: 'برمجة رحلة بين الولايات',
  },
  {
    id: 'faq-revision-insurance',
    category: 'intercity',
    audience: 'both',
    questionFr: 'Que se passe-t-il en cas d’écart de volume (+30 % max) ou de question sur l’assurance ?',
    questionAr: 'ماذا يحدث عند تغير حجم الحمولة (+30% كحد أقصى) أو بخصوص التأمين؟',
    summaryFr:
      'Toute révision de prix par le chauffeur est plafonnée à +30 % et exige votre accord explicite ; la plateforme n’agit pas comme assureur.',
    summaryAr:
      'أي مراجعة للسعر من السائق لا تتجاوز +30% وتستوجب موافقة الزبون؛ المنصة ليست شركة تأمين.',
    stepsFr: [
      'Révision de prix encadrée : si le volume réel sur place dépasse nettement les photos annoncées, le chauffeur peut proposer un ajustement justifié (plafonné à +30 % du prix convenu).',
      'Accord obligatoire du client : le nouveau tarif ne s’applique que si vous l’acceptez dans votre suivi Entre wilayas ; en cas de refus, vous pouvez annuler ou ouvrir un litige tracé.',
      'Responsabilité & assurance : CAMIO EXPRESS est une plateforme de mise en relation et n’est pas assureur des marchandises. Contrôlez les documents d’assurance du transporteur avant le départ et emballez les objets fragiles.',
    ],
    stepsAr: [
      'سقف مراجعة السعر: إذا فاق الحجم الفعلي ما يظهر في الصور بشكل واضح، يمكن للسائق اقتراح تعديل مبرر بحد أقصى +30% من السعر المتفق عليه.',
      'موافقة الزبون إلزامية: لا يُعتمد السعر الجديد إلا بعد قبولك له في تفاصيل الطلب.',
      'التأمين والمسؤولية: المنصة وسيط رقمي وليست شركة تأمين على البضائع؛ تأكد من وثائق تأمين الشاحنة وغلّف الأغراض الحساسة جيداً.',
    ],
    keywords: [
      'revision prix',
      '+30%',
      'assurance',
      'insurance',
      'volume',
      'ecart',
      'مراجعة السعر',
      'التأمين',
    ],
  },
  {
    id: 'faq-dispute-cancel',
    category: 'pricing_cash',
    audience: 'both',
    questionFr: 'Comment annuler une course ou ouvrir un litige tracé ?',
    questionAr: 'كيف تلغي طلباً أو تفتح نزاعاً موثقاً لدى الدعم؟',
    summaryFr:
      'L’annulation avant le chargement est immédiate ; en cas de désaccord sur le prix ou l’exécution, ouvrez un litige horodaté pour intervention de l’Administration.',
    summaryAr:
      'الإلغاء قبل بدء الشحن فوري؛ وفي حال وجود خلاف حول السعر أو التنفيذ يمكن فتح نزاع يراجعه فريق الإدارة.',
    stepsFr: [
      'Avant démarrage du chargement : cliquez sur « Annuler cette demande » ou « Annuler » depuis le suivi de course.',
      'Ouverture de litige : cliquez sur « Litige » dans le panneau de mission, décrivez le motif (prix, retard, dommage, absence) et envoyez le signalement.',
      'Traitement Administrateur : votre historique GPS, les offres acceptées, les photos et les messages du chat sont conservés pour que le support statue et clôture le dossier.',
    ],
    stepsAr: [
      'قبل بدء الشحن: اضغط على «إلغاء الطلب» مباشرة من بطاقة المتابعة.',
      'فتح نزاع: اضغط على «نزاع / بلاغ»، اشرح السبب وأرسل التبليغ.',
      'المعالجة الإدارية: يتم حفظ سجل المحادثات والموقع والصور لمراجعة الدعم واتخاذ القرار المناسب.',
    ],
    keywords: ['litige', 'dispute', 'annuler', 'cancel', 'reclamation', 'support', 'نزاع', 'إلغاء'],
  },
  {
    id: 'faq-driver-onboarding',
    category: 'driver_ops',
    audience: 'driver',
    questionFr: 'Chauffeur : comment passer « En ligne » et recevoir des demandes ?',
    questionAr: 'للسائقين: كيف تفعّل وضع «متاح» وتستقبل الطلبات؟',
    summaryFr:
      'Deux conditions sont requises : un dossier KYC validé par l’Administration et un abonnement mensuel actif (ou en période de grâce de 3 jours).',
    summaryAr:
      'يتطلب الاتصال شرطين: اعتماد ملف الوثائق (KYC) من الإدارة وتوفر اشتراك شهري ساري المفعول.',
    stepsFr: [
      'Complétez votre dossier dans l’onglet « Mon dossier KYC » avec les 6 documents requis (CNI, permis, carte grise, assurance, photos du camion et de la plaque).',
      'Une fois votre statut passé à « Validé », vérifiez que votre abonnement (essai gratuit 30 jours ou mensuel 1 000 DA) est « Actif » ou en « Période de grâce ».',
      'Cliquez sur « Hors ligne · Passer disponible » en haut de l’Espace Chauffeur pour recevoir les demandes urbaines dans un rayon de 15 km.',
    ],
    stepsAr: [
      'أكمل ملفك في تبويب «ملف الوثائق» برفع الوثائق الست المطلوبة.',
      'بعد موافقة الإدارة وتحول الحساب إلى «معتمد»، تأكد من صلاحية اشتراكك الشهري (تجربة مجانية 30 يوماً أو 1000 دج/شهر).',
      'اضغط على زر التبديل أعلى فضاء السائق لتصبح «متاح» وتستقبل الطلبات القريبة ضمن نطاق 15 كم.',
    ],
    noteFr: 'En mode Longue distance, ajoutez également vos axes de couverture (ex. Oran → Alger) dans l’onglet « Longue distance ».',
    noteAr: 'في وضع المسافات الطويلة، أضف أيضاً محاور التغطية التي تعمل عليها في تبويب «بين الولايات».',
    keywords: [
      'devenir chauffeur',
      'driver onboarding',
      'passer en ligne',
      'online',
      'kyc',
      'essai gratuit',
      'سائق',
      'متاح',
    ],
    actionWorkspace: 'driver',
    actionLabelFr: 'Ouvrir l’Espace Chauffeur',
    actionLabelAr: 'فتح فضاء السائق',
  },
  {
    id: 'faq-subscription-voucher',
    category: 'driver_ops',
    audience: 'driver',
    questionFr: 'Chauffeur : comment renouveler son abonnement via BaridiMob, CCP ou code Voucher ?',
    questionAr: 'للسائقين: كيف تجدد الاشتراك الشهري عبر بريدي موب، CCP أو بطاقة تعبئة (Voucher)؟',
    summaryFr:
      'Effectuez un virement de 1 000 DA/mois vers le CCP affiché ou activez instantanément un code de recharge prépayé.',
    summaryAr:
      'حوّل 1000 دج/شهر إلى الحساب البريدي الموضح وأرسل رقم المرجع، أو فعّل رمز تعبئة فوراً.',
    stepsFr: [
      'Option 1 — Code Voucher (instantané) : dans « Abonnement & Voucher », saisissez votre code (ex. LM-2026-ORAN-0001) et cliquez sur « Activer » pour prolonger immédiatement votre abonnement de 30 jours.',
      'Option 2 — Virement BaridiMob ou CCP (1 000 DA) : copiez le numéro CCP affiché, effectuez le paiement avec votre numéro de téléphone en référence, puis soumettez le N° de référence et le reçu.',
      'Validation anti-doublon : l’Administration vérifie la référence unique et active votre prolongation de 30 jours.',
    ],
    stepsAr: [
      'الخيار 1 — بطاقة تعبئة (فوري): أدخل رمز التعبئة في قسم «الاشتراك والتعبئة» واضغط «تفعيل» لإضافة 30 يوماً مباشرة.',
      'الخيار 2 — بريدي موب أو CCP (1000 دج): انسخ رقم الحساب، أجرِ التحويل وأرسل رقم المرجع وصورة الوصل للمراجعة.',
      'تتحقق الإدارة من عدم تكرار المرجع وتفعّل التمديد لمدة 30 يوماً.',
    ],
    keywords: [
      'baridimob',
      'ccp',
      'voucher',
      'abonnement',
      '1000 da',
      'renouveler',
      'LM-2026-ORAN-0001',
      'اشتراك',
      'بريدي موب',
      'تعبئة',
    ],
    actionWorkspace: 'driver',
    actionLabelFr: 'Gérer mon abonnement',
    actionLabelAr: 'تجديد الاشتراك',
  },
  {
    id: 'faq-geofence-empty-return',
    category: 'driver_ops',
    audience: 'driver',
    questionFr: 'Chauffeur : géofencing 300 m, déroulement d’une course et retours à vide (-25 %)',
    questionAr: 'للسائقين: التحقق الجغرافي 300 متر، مراحل التنفيذ والعودة الفارغة (-25%)',
    summaryFr:
      'Le passage au statut « Arrivé au départ » exige d’être à moins de 300 m du point de collecte ; les retours à vide permettent de proposer jusqu’à -25 %.',
    summaryAr:
      'يتطلب تأكيد الوصول لنقطة الانطلاق التواجد ضمن نطاق 300 متر؛ كما تتيح العودة الفارغة تقديم خصم حتى -25% بين الولايات.',
    stepsFr: [
      'Progression à une main : suivez l’ordre « Aller au point de départ » → « Je suis sur place » → « Démarrer le chargement » → « Chargement terminé · En transit » → « Je suis arrivé » → « Encaisser cash & Terminer ».',
      'Contrôle géofencing (300 m) : pour protéger le client, la plateforme bloque le statut « Arrivé au départ » si votre position GPS est à plus de 300 m du point de chargement.',
      'Retours à vide (-25 %) : en longue distance, déclarez votre trajet de retour à vide (wilaya départ → wilaya retour + date) afin d’être autorisé à descendre jusqu’à -25 % sous le prix de référence et remporter le trajet.',
    ],
    stepsAr: [
      'تدرج سهل بيد واحدة: انتقل بالترتيب من الانطلاق نحو الزبون، الوصول، الشحن، التوصيل ثم التحصيل النقدي.',
      'نطاق 300 متر: تمنع المنصة تأكيد «وصلت لنقطة الانطلاق» إذا تجاوزت المسافة 300 متر عن موقع الزبون.',
      'العودة الفارغة (-25%): صرّح برحلة العودة الفارغة بين الولايات للاستفادة من تخفيض يصل إلى -25% عن السعر المرجعي.',
    ],
    keywords: [
      'geofencing',
      '300 m',
      '300m',
      'gps',
      'retour a vide',
      'empty return',
      '-25%',
      'chargement',
      'العودة الفارغة',
      'الموقع',
    ],
    actionWorkspace: 'driver',
    actionLabelFr: 'Voir mes courses chauffeur',
    actionLabelAr: 'عرض لوحة السائق',
  },
];

export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Latin accents
    .replace(/[\u064B-\u065F\u0670]/g, '') // Arabic tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/['’`".,?!:;()[\]{}/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterHelpArticles(
  articles: HelpArticle[],
  options: {
    query?: string;
    category?: HelpCategory;
    audience?: HelpAudience;
  }
): HelpSearchResult[] {
  const category = options.category ?? 'all';
  const audience = options.audience ?? 'all';
  const normalizedQuery = normalizeSearchText(options.query ?? '');
  const terms = normalizedQuery ? normalizedQuery.split(' ').filter(Boolean) : [];

  const results: HelpSearchResult[] = [];

  for (const article of articles) {
    if (category !== 'all' && article.category !== category) {
      continue;
    }
    if (audience !== 'all' && article.audience !== 'both' && article.audience !== audience) {
      continue;
    }

    if (terms.length === 0) {
      results.push({ article, score: 1 });
      continue;
    }

    const questionNorm = normalizeSearchText(`${article.questionFr} ${article.questionAr}`);
    const summaryNorm = normalizeSearchText(`${article.summaryFr} ${article.summaryAr}`);
    const keywordsNorm = normalizeSearchText(article.keywords.join(' '));
    const bodyNorm = normalizeSearchText(
      [...article.stepsFr, ...article.stepsAr, article.noteFr ?? '', article.noteAr ?? ''].join(' ')
    );

    const combined = `${questionNorm} ${summaryNorm} ${keywordsNorm} ${bodyNorm}`;

    // Every query term must match somewhere (ignoring tiny stopwords <= 2 chars unless query is only short words)
    const significantTerms = terms.filter((t) => t.length > 2);
    const activeTerms = significantTerms.length > 0 ? significantTerms : terms;
    const allMatch = activeTerms.every((term) => combined.includes(term));

    if (!allMatch) {
      continue;
    }

    let score = 0;
    if (keywordsNorm.includes(normalizedQuery) || questionNorm.includes(normalizedQuery)) {
      score += 50;
    }
    for (const term of activeTerms) {
      if (questionNorm.includes(term)) score += 12;
      if (keywordsNorm.includes(term)) score += 10;
      if (summaryNorm.includes(term)) score += 6;
      if (bodyNorm.includes(term)) score += 3;
    }

    results.push({ article, score });
  }

  return results.sort((a, b) => b.score - a.score);
}

export function getCategoryLabel(category: HelpCategory, locale: Locale): string {
  const found = HELP_CATEGORIES.find((c) => c.id === category);
  if (!found) return category;
  return locale === 'ar' ? found.ar : found.fr;
}
