import { Mic, Send } from 'lucide-react';
import { useState } from 'react';
import { formatTimeDz } from '../domain/i18n';
import type { ChatMessage, Locale } from '../domain/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  senderRole: 'client' | 'driver';
  senderName: string;
  locale: Locale;
  onSend: (body: string, kind: 'text' | 'voice') => Promise<void>;
}

export function ChatPanel({ messages, senderRole, locale, onSend }: ChatPanelProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const isAr = locale === 'ar';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend(text.trim(), 'text');
      setText('');
    } finally {
      setSending(false);
    }
  };

  const handleVoiceNote = async () => {
    if (sending) return;
    setSending(true);
    try {
      const sample =
        senderRole === 'driver'
          ? isAr
            ? 'رسالة صوتية (14 ثا): أنا قريب من مدخل الحي.'
            : 'Note vocale (14 s) : Je suis devant la station, j’arrive dans 3 minutes.'
          : isAr
          ? 'رسالة صوتية (11 ثا): المدخل على اليمين قرب المخبزة.'
          : 'Note vocale (11 s) : L’entrée de l’immeuble est juste à droite de la boulangerie.';
      await onSend(sample, 'voice');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {isAr ? 'المحادثة والرسائل الصوتية' : 'Chat & notes vocales'}
        </h4>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {messages.length} {isAr ? 'رسائل' : 'msg'}
        </span>
      </div>

      <div className="p-3 space-y-2.5 max-h-56 overflow-y-auto bg-slate-50/60 dark:bg-slate-950/60">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
            {isAr ? 'لا توجد رسائل بعد.' : 'Aucun message pour cette mission.'}
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderRole === senderRole;
            return (
              <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                    isMine
                      ? 'bg-slate-900 dark:bg-orange-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <div
                    className={`text-[11px] mb-0.5 ${
                      isMine ? 'text-slate-300 dark:text-orange-100' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {m.senderName} · {formatTimeDz(m.createdAt, locale)}
                  </div>
                  <p className="flex items-center gap-1.5">
                    {m.kind === 'voice' && <Mic className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-300" />}
                    <span>{m.body}</span>
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900 rounded-b-lg"
      >
        <button
          type="button"
          onClick={handleVoiceNote}
          disabled={sending}
          aria-label={isAr ? 'إرسال رسالة صوتية' : 'Envoyer une note vocale'}
          title={isAr ? 'رسالة صوتية (≤ 60 ثا)' : 'Note vocale (≤ 60 s)'}
          className="min-h-[40px] min-w-[40px] px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0"
        >
          <Mic className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isAr ? 'اكتب رسالة أو ملاحظة...' : 'Écrire un message au chauffeur/client...'}
          className="flex-1 min-w-0 h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label={isAr ? 'إرسال' : 'Envoyer'}
          className="min-h-[40px] px-3.5 rounded-md bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Send className="w-4 h-4" />
          <span>{isAr ? 'إرسال' : 'Envoyer'}</span>
        </button>
      </form>
    </div>
  );
}
