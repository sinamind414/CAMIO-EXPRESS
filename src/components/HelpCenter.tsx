import { ArrowRight, ChevronDown, ChevronUp, Phone, RotateCcw, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  filterHelpArticles,
  getCategoryLabel,
  HELP_ARTICLES,
  HELP_CATEGORIES,
  ONBOARDING_SHORTCUTS,
  type HelpAudience,
  type HelpCategory,
} from '../domain/helpCenter';
import type { AppSettings, Locale, WorkspaceRole } from '../domain/types';

interface HelpCenterProps {
  locale: Locale;
  settings: AppSettings;
  onNavigateWorkspace: (workspace: WorkspaceRole) => void;
}

export function HelpCenter({ locale, settings, onNavigateWorkspace }: HelpCenterProps) {
  const isAr = locale === 'ar';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<HelpCategory>('all');
  const [audience, setAudience] = useState<HelpAudience>('all');
  const [expandedIds, setExpandedIds] = useState<string[]>(['faq-book-mover']);

  const results = useMemo(
    () => filterHelpArticles(HELP_ARTICLES, { query, category, audience }),
    [query, category, audience]
  );

  const toggleArticle = (id: string) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const applyShortcut = (shortcutQuery: string) => {
    setCategory('all');
    setAudience('all');
    setQuery(shortcutQuery);
    const matched = filterHelpArticles(HELP_ARTICLES, { query: shortcutQuery });
    if (matched[0]) {
      setExpandedIds([matched[0].article.id]);
    }
  };

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setAudience('all');
    setExpandedIds(['faq-book-mover']);
  };

  const allExpanded =
    results.length > 0 && results.every((r) => expandedIds.includes(r.article.id));

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedIds([]);
    } else {
      setExpandedIds(results.map((r) => r.article.id));
    }
  };

  const audienceLabel = (aud: 'client' | 'driver' | 'both') => {
    if (aud === 'client') return isAr ? 'الزبون' : 'Client';
    if (aud === 'driver') return isAr ? 'السائق' : 'Chauffeur';
    return isAr ? 'الزبون والسائق' : 'Client & Chauffeur';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero & Search Surface */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 sm:p-8 space-y-5">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight text-balance">
            {isAr ? 'مركز المساعدة ودليل البدء السريع' : 'Centre d’aide et guide de démarrage'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {isAr
              ? 'ابحث عن إجابات واضحة حول حجز شاحنة نقل الأثاث، التحقق من هوية السائق، الدفع نقداً بدون عمولة، والنقل بين الولايات.'
              : 'Retrouvez les réponses essentielles pour réserver un déménageur, vérifier l’identité et les documents d’un chauffeur, payer en cash (0 % commission) ou gérer votre activité.'}
          </p>
        </div>

        {/* Guide des prix public (référentiel Bricoram / CDC §20) */}
        <details className="rounded-lg border border-orange-200 dark:border-orange-900/70 bg-orange-50/40 dark:bg-orange-950/20">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-orange-900 dark:text-orange-200">
            {isAr ? 'دليل أسعار النقل في الجزائر 🇩🇿' : 'Guide des prix du transport en Algérie 🇩🇿'}
          </summary>
          <div className="px-4 pb-4 space-y-3">
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              {isAr
                ? 'بيانات مستقاة من مئات المهنيين النشطين (Bricoram). الأسعار تقديرية.'
                : 'Données collectées auprès de centaines de professionnels (Bricoram). Prix indicatifs.'}
            </p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-start text-slate-600 dark:text-slate-300">
                  <th className="py-1.5 text-start font-semibold">{isAr ? 'الخدمة' : 'Prestation'}</th>
                  <th className="py-1.5 text-start font-semibold">{isAr ? 'الأدنى' : 'Minimum'}</th>
                  <th className="py-1.5 text-start font-semibold">{isAr ? 'المتوسط' : 'Moyenne'}</th>
                  <th className="py-1.5 text-start font-semibold">{isAr ? 'الأعلى' : 'Maximum'}</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 dark:text-slate-200">
                <tr className="border-t border-orange-100 dark:border-orange-900/50">
                  <td className="py-1.5">{isAr ? 'نقل داخل الولاية' : 'Déménagement dans la wilaya'}</td>
                  <td className="py-1.5">4 000 DA</td><td className="py-1.5 font-bold">5 000 DA</td><td className="py-1.5">6 000 DA</td>
                </tr>
                <tr className="border-t border-orange-100 dark:border-orange-900/50">
                  <td className="py-1.5">{isAr ? 'نقل بين الولايات' : 'Déménagement hors wilaya'}</td>
                  <td className="py-1.5">50 DA/km</td><td className="py-1.5 font-bold">70 DA/km</td><td className="py-1.5">100 DA/km</td>
                </tr>
                <tr className="border-t border-orange-100 dark:border-orange-900/50">
                  <td className="py-1.5">{isAr ? 'فك وتركيب الأثاث' : 'Démontage / montage meubles'}</td>
                  <td className="py-1.5">1 000 DA</td><td className="py-1.5 font-bold">2 000 DA</td><td className="py-1.5">3 000 DA</td>
                </tr>
              </tbody>
            </table>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isAr ? 'العوامل المؤثرة: المسافة وحجم الأثاث. السعر النهائي هو اتفاق مباشر مع السائق، الدفع نقداً.' : 'Facteurs : distance et volume des meubles. Le prix final est un accord direct avec le chauffeur, paiement en cash.'}
            </p>
          </div>
        </details>

        {/* Search Input */}
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (results[0] && !expandedIds.includes(results[0].article.id)) {
              setExpandedIds((prev) => [results[0].article.id, ...prev]);
            }
          }}
          className="relative"
        >
          <label htmlFor="help-search-input" className="sr-only">
            {isAr ? 'ابحث في الأسئلة الشائعة' : 'Rechercher dans le centre d’aide'}
          </label>
          <Search
            className={`w-4 h-4 text-slate-400 dark:text-slate-500 absolute top-1/2 -translate-y-1/2 pointer-events-none ${
              isAr ? 'right-3.5' : 'left-3.5'
            }`}
          />
          <input
            id="help-search-input"
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (val.trim()) {
                const top = filterHelpArticles(HELP_ARTICLES, { query: val, category, audience })[0];
                if (top) {
                  setExpandedIds((prev) => (prev.includes(top.article.id) ? prev : [top.article.id]));
                }
              }
            }}
            placeholder={
              isAr
                ? 'ابحث مثلاً: حجز شاحنة، هوية السائق، الدفع نقداً، بريدي موب...'
                : 'Rechercher un sujet (ex. How to book a mover, vérifier identité chauffeur, BaridiMob, 300 m)...'
            }
            className={`w-full h-12 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
              isAr ? 'pr-10 pl-10' : 'pl-10 pr-10'
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={isAr ? 'مسح البحث' : 'Effacer la recherche'}
              className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 ${
                isAr ? 'left-2' : 'right-2'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Quick Onboarding Topic Shortcuts */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'مواضيع البدء السريع:' : 'Sujets fréquents d’intégration :'}
          </div>
          <div className="flex flex-wrap gap-2">
            {ONBOARDING_SHORTCUTS.map((sc) => {
              const active = query.toLowerCase() === sc.query.toLowerCase();
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => applyShortcut(sc.query)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/50 text-orange-900 dark:text-orange-200'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isAr ? sc.labelAr : sc.labelFr}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Filter Bar & Controls */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label={isAr ? 'فئات المساعدة' : 'Catégories du centre d’aide'}
          className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto max-w-full"
        >
          {HELP_CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isAr ? cat.ar : cat.fr}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            {(
              [
                { id: 'all', fr: 'Tous', ar: 'الكل' },
                { id: 'client', fr: 'Clients', ar: 'الزبائن' },
                { id: 'driver', fr: 'Chauffeurs', ar: 'السائقون' },
              ] as const
            ).map((aud) => (
              <button
                key={aud.id}
                type="button"
                onClick={() => setAudience(aud.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  audience === aud.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isAr ? aud.ar : aud.fr}
              </button>
            ))}
          </div>

          {results.length > 0 && (
            <button
              type="button"
              onClick={toggleExpandAll}
              className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {allExpanded
                ? isAr
                  ? 'طي الكل'
                  : 'Tout replier'
                : isAr
                ? 'فتح الكل'
                : 'Tout déplier'}
            </button>
          )}
        </div>
      </section>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span className="tabular-nums">
          {results.length}{' '}
          {isAr
            ? results.length === 1
              ? 'مقال مطابق'
              : 'مقالات مطابقة'
            : results.length <= 1
            ? 'article trouvé'
            : 'articles trouvés'}
        </span>
        {(query || category !== 'all' || audience !== 'all') && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-orange-700 dark:text-orange-400 hover:underline font-medium inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? 'إعادة ضبط البحث' : 'Réinitialiser les filtres'}</span>
          </button>
        )}
      </div>

      {/* FAQ Accordion List */}
      {results.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {isAr
              ? `لم يتم العثور على نتائج لـ « ${query} »`
              : `Aucun article trouvé pour « ${query} »`}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {isAr
              ? 'جرّب كلمات أبسط مثل: حجز، السائق، الدفع نقداً، بريدي موب، أو أعد ضبط الفلاتر.'
              : 'Essayez des mots-clés comme « déménageur », « identité », « cash », « voucher » ou réinitialisez les filtres.'}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="h-10 px-4 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? 'عرض جميع الأسئلة' : 'Afficher tous les guides'}</span>
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
          {results.map(({ article }) => {
            const isOpen = expandedIds.includes(article.id);
            const question = isAr ? article.questionAr : article.questionFr;
            const summary = isAr ? article.summaryAr : article.summaryFr;
            const steps = isAr ? article.stepsAr : article.stepsFr;
            const note = isAr ? article.noteAr : article.noteFr;
            const panelId = `faq-panel-${article.id}`;

            return (
              <article key={article.id} className="transition-colors">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleArticle(article.id)}
                  className="w-full text-start px-5 py-4 sm:px-6 sm:py-5 flex items-start justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span className="font-medium text-orange-700 dark:text-orange-400">
                        {getCategoryLabel(article.category, locale)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{audienceLabel(article.audience)}</span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">{question}</h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{summary}</p>
                  </div>
                  <span className="mt-1 p-1.5 rounded-md text-slate-500 dark:text-slate-400 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </button>

                {isOpen && (
                  <div id={panelId} className="px-5 pb-5 sm:px-6 sm:pb-6 pt-1 space-y-4">
                    <ol className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed list-decimal list-inside">
                      {steps.map((step, idx) => (
                        <li key={idx} className="marker:font-mono marker:font-semibold marker:text-orange-700 dark:marker:text-orange-400">
                          {step}
                        </li>
                      ))}
                    </ol>

                    {note && (
                      <p className="p-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {note}
                      </p>
                    )}

                    {article.actionWorkspace && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => onNavigateWorkspace(article.actionWorkspace!)}
                          className="h-9 px-4 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white inline-flex items-center gap-2 whitespace-nowrap"
                        >
                          <span>{isAr ? article.actionLabelAr : article.actionLabelFr}</span>
                          <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Direct Onboarding & Support Footer Card */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {isAr ? 'هل تحتاج إلى مساعدة مباشرة؟' : 'Besoin d’une assistance directe ?'}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {isAr
              ? `فريق الدعم متاح على الرقم ${settings.supportPhone} · رمز الاختبار OTP: 00000`
              : `Équipe support disponible au ${settings.supportPhone} · Code OTP de test : 00000`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={`tel:${settings.supportPhone.replace(/\s+/g, '')}`}
            className="h-10 px-4 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="font-mono">{settings.supportPhone}</span>
          </a>
          <button
            type="button"
            onClick={() => onNavigateWorkspace('client')}
            className="h-10 px-4 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 whitespace-nowrap"
          >
            {isAr ? 'بدء طلب نقل' : 'Démarrer une course'}
          </button>
        </div>
      </section>
    </div>
  );
}
