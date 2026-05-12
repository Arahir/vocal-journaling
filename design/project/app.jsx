// Journaling — interactive prototype
// Single-user voice journaling app. Editor / history / export.

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ── Defaults that the host can rewrite ─────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#C97B5E",
  "typePair": "serif-newsreader",
  "density": "regular"
}/*EDITMODE-END*/;

// ── Helpers ─────────────────────────────────────────────────────────
const MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const DOWS_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const DOWS_SHORT = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
const DOWS_INITIALS = ['L','M','M','J','V','S','D']; // calendar starts Monday

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function frenchDate(d, opts = {}) {
  const dow = DOWS_FULL[d.getDay()];
  const day = d.getDate();
  const mo = MONTHS[d.getMonth()];
  const y = d.getFullYear();
  if (opts.short) return `${day} ${mo}`;
  return `${dow} ${day} ${mo} ${y}`;
}
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ── Seeded sample entries (history) ────────────────────────────────
function makeSeed() {
  const t = today();
  return {
    // Today: untouched at first
    [toISO(t)]: { raw_text: '', summary: null, meals: [], processed_at: null, dirty: false },
    [toISO(addDays(t, -1))]: {
      raw_text: "Réveil pas terrible, j'ai mis du temps à émerger. Petit-déj : un café, deux tranches de pain au levain avec du beurre demi-sel et un peu de confiture d'abricot. Vers 11h grosse fringale, j'ai grignoté une poignée d'amandes au bureau.\n\nMidi je suis sorti avec Élise, on a pris une salade composée chez le traiteur — quinoa, betterave, feta, noix. Café après. L'aprem j'étais bien.\n\nLe soir on a commandé des sushis. Pas faim au moment de manger mais j'en ai pris quand même. Un peu de chocolat noir vers 22h devant un épisode. Bonne énergie globalement, juste cette fatigue du matin qui me suit.",
      summary: "Journée correcte malgré un réveil difficile. Énergie qui s'est installée doucement, fringale en milieu de matinée probablement liée à un petit-déj trop léger. Repas sociaux agréables. Soir un peu mécanique — manger sans faim devant un écran.",
      meals: [
        { type: 'petit-déj', content: 'Café, pain au levain (beurre, confiture abricot)', time: '08:15' },
        { type: 'snack', content: 'Poignée d\'amandes', time: '11:00' },
        { type: 'déj', content: 'Salade quinoa-betterave-feta-noix, café', time: '13:00' },
        { type: 'dîner', content: 'Sushis livrés', time: '20:30' },
        { type: 'snack', content: 'Carré de chocolat noir', time: '22:00' },
      ],
      processed_at: 'hier',
      dirty: false,
    },
    [toISO(addDays(t, -2))]: {
      raw_text: "Skip le petit-déj, juste un thé. Midi un sandwich poulet-crudités vite fait entre deux réunions. Dîner correct, pâtes au pesto et une salade. Verre de vin rouge avec Marc. Globalement frustré par la journée de boulot, mangé sans plaisir.",
      summary: "Journée tendue côté travail, ça se ressent sur les repas — pris à la va-vite, sans présence. Soir réparateur grâce à du temps avec un ami.",
      meals: [
        { type: 'petit-déj', content: 'Thé, rien d\'autre', time: '08:30' },
        { type: 'déj', content: 'Sandwich poulet-crudités', time: '13:15' },
        { type: 'dîner', content: 'Pâtes au pesto, salade verte, verre de vin rouge', time: '20:00' },
      ],
      processed_at: '2j',
      dirty: false,
    },
    [toISO(addDays(t, -3))]: {
      raw_text: "Tartines beurre miel ce matin. Déj à la cantine — gratin de courgettes, riz, yaourt. Goûter pomme et carré de chocolat. Dîner léger, omelette aux herbes et une part de tarte aux pommes en dessert. Bonne journée, calme.",
      summary: "Journée tranquille, alimentation régulière et plutôt douce. Pas de pics de stress, présence aux repas correcte.",
      meals: [
        { type: 'petit-déj', content: 'Tartines beurre-miel', time: '08:00' },
        { type: 'déj', content: 'Gratin courgettes, riz, yaourt', time: '12:45' },
        { type: 'snack', content: 'Pomme, carré de chocolat', time: '16:30' },
        { type: 'dîner', content: 'Omelette aux herbes, tarte aux pommes', time: '19:45' },
      ],
      processed_at: '3j',
      dirty: false,
    },
    // Unprocessed entry — has raw text but no summary yet
    [toISO(addDays(t, -4))]: {
      raw_text: "Petit-déj sur le pouce, banane et café. Déj entre collègues, plat du jour — un curry de légumes avec du riz basmati. L'aprem j'ai craqué pour un pain au chocolat. Soir gros plat de pâtes carbonara, j'avais faim. Je me sens un peu lourd là.",
      summary: null,
      meals: [],
      processed_at: null,
      dirty: false,
    },
    // Empty day — nothing happened, no entry
    [toISO(addDays(t, -5))]: null,
    [toISO(addDays(t, -6))]: {
      raw_text: "Smoothie banane-épinard-graines de chia au réveil. Déj salade niçoise. Snack vers 17h : crackers et houmous. Dîner soupe maison potimarron-coco, tartine de fromage de chèvre. Bonne journée énergétique, j'ai bien dormi la veille ça aide.",
      summary: "Journée fluide, choix alimentaires plutôt nourrissants. Le sommeil de la nuit précédente a clairement porté.",
      meals: [
        { type: 'petit-déj', content: 'Smoothie banane-épinard-chia', time: '07:45' },
        { type: 'déj', content: 'Salade niçoise', time: '12:30' },
        { type: 'snack', content: 'Crackers et houmous', time: '17:00' },
        { type: 'dîner', content: 'Soupe potimarron-coco, tartine chèvre', time: '19:30' },
      ],
      processed_at: '6j',
      dirty: false,
    },
    [toISO(addDays(t, -8))]: {
      raw_text: "Brunch tardif avec Camille — œufs brouillés, bacon, avocat, pain grillé, jus d'orange. Resté à table longtemps. Pas de déj du coup. Goûter thé et madeleines. Dîner léger, soupe et fruits. Belle journée.",
      summary: "Brunch dominical qui a structuré la journée. Rythme à 2 repas, présence et plaisir aux deux.",
      meals: [
        { type: 'petit-déj', content: 'Brunch : œufs brouillés, bacon, avocat, pain grillé, jus d\'orange', time: '11:30' },
        { type: 'snack', content: 'Thé et madeleines', time: '17:00' },
        { type: 'dîner', content: 'Soupe, fruits', time: '20:30' },
      ],
      processed_at: '8j',
      dirty: false,
    },
  };
}

// ── App root ───────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply tweaks to CSS variables on root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', t.accent);
    // soften the accent for rings/backgrounds
    root.style.setProperty('--accent-soft', t.accent + '1f');
    root.style.setProperty('--accent-ring', t.accent + '47');

    const fontMap = {
      'serif-newsreader': { font: "'Newsreader', Georgia, serif", size: 18, line: 1.7 },
      'serif-source':     { font: "'Source Serif 4', Georgia, serif", size: 18, line: 1.7 },
      'sans-inter':       { font: "'Inter', ui-sans-serif, system-ui, sans-serif", size: 17, line: 1.65 },
    };
    const f = fontMap[t.typePair] || fontMap['serif-newsreader'];
    root.style.setProperty('--font', f.font);

    const dens = t.density || 'regular';
    const sizes = { compact: 16, regular: 18, comfy: 19 };
    const lines = { compact: 1.6, regular: 1.7, comfy: 1.85 };
    root.style.setProperty('--body-size', (t.typePair === 'sans-inter' ? sizes[dens] - 1 : sizes[dens]) + 'px');
    root.style.setProperty('--body-line', String(lines[dens]));
  }, [t.accent, t.typePair, t.density]);

  const [view, setView] = useState('entries');           // entries | history | export
  const [entries, setEntries] = useState(() => makeSeed());
  const [activeDate, setActiveDate] = useState(() => toISO(today()));

  // Ensure entry exists for active date (created on the fly)
  const ensureEntry = useCallback((iso) => {
    setEntries((prev) => {
      if (prev[iso]) return prev;
      return { ...prev, [iso]: { raw_text: '', summary: null, meals: [], processed_at: null, dirty: false } };
    });
  }, []);

  useEffect(() => { ensureEntry(activeDate); }, [activeDate, ensureEntry]);

  const updateEntry = useCallback((iso, patch) => {
    setEntries((prev) => ({ ...prev, [iso]: { ...(prev[iso] || { raw_text: '', summary: null, meals: [], processed_at: null }), ...patch } }));
  }, []);

  return (
    <>
      <Header view={view} setView={setView} />
      {view === 'entries' && (
        <EntriesView
          activeDate={activeDate}
          setActiveDate={setActiveDate}
          entry={entries[activeDate] || { raw_text: '', summary: null, meals: [], processed_at: null }}
          updateEntry={updateEntry}
          entries={entries}
        />
      )}
      {view === 'history' && (
        <HistoryView
          entries={entries}
          onPick={(iso) => { setActiveDate(iso); setView('entries'); }}
        />
      )}
      {view === 'export' && (
        <ExportView entries={entries} />
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Accent" />
        <TweakColor
          label="Couleur"
          value={t.accent}
          options={['#C97B5E', '#7A8B6F', '#C9954B', '#5E7C8C']}
          onChange={(v) => setTweak('accent', v)}
        />
        <TweakSection label="Typographie" />
        <TweakRadio
          label="Pairing"
          value={t.typePair}
          options={[
            { value: 'serif-newsreader', label: 'Serif' },
            { value: 'serif-source',     label: 'Serif 2' },
            { value: 'sans-inter',       label: 'Sans' },
          ]}
          onChange={(v) => setTweak('typePair', v)}
        />
        <TweakRadio
          label="Densité"
          value={t.density}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'regular', label: 'Normal' },
            { value: 'comfy',   label: 'Aéré' },
          ]}
          onChange={(v) => setTweak('density', v)}
        />
      </TweaksPanel>
    </>
  );
}

// ── Header ─────────────────────────────────────────────────────────
function Header({ view, setView }) {
  return (
    <header className="header">
      <a className="wordmark" onClick={(e) => { e.preventDefault(); setView('entries'); }} href="#">
        Carnet
      </a>
      <nav className="nav">
        <a className={view === 'entries' ? 'active' : ''}
           onClick={(e) => { e.preventDefault(); setView('entries'); }} href="#">Aujourd'hui</a>
        <a className={view === 'history' ? 'active' : ''}
           onClick={(e) => { e.preventDefault(); setView('history'); }} href="#">Historique</a>
        <a className={view === 'export' ? 'active' : ''}
           onClick={(e) => { e.preventDefault(); setView('export'); }} href="#">Export</a>
      </nav>
    </header>
  );
}

// ── Entries view (the hero) ────────────────────────────────────────
function EntriesView({ activeDate, setActiveDate, entry, updateEntry, entries }) {
  const [text, setText] = useState(entry.raw_text);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saved
  const [pickerOpen, setPickerOpen] = useState(false);
  const [llmStatus, setLlmStatus] = useState('idle'); // idle | running
  const taRef = useRef(null);

  // When date changes, reload text from entry
  useEffect(() => {
    setText(entry.raw_text || '');
    setSaveStatus('idle');
  }, [activeDate]); // eslint-disable-line

  // Autosave (silent). Show "Sauvegardé" only after 5s of inactivity.
  const saveTimer = useRef(null);
  const hintTimer = useRef(null);
  useEffect(() => {
    if (text === entry.raw_text) return;
    clearTimeout(saveTimer.current);
    clearTimeout(hintTimer.current);
    saveTimer.current = setTimeout(() => {
      updateEntry(activeDate, { raw_text: text, dirty: entry.processed_at ? true : false });
    }, 400);
    hintTimer.current = setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1800);
    }, 5000);
    return () => { clearTimeout(saveTimer.current); clearTimeout(hintTimer.current); };
  }, [text]); // eslint-disable-line

  const d = fromISO(activeDate);
  const isToday = toISO(today()) === activeDate;

  const dateLabel = isToday
    ? `Aujourd'hui, ${frenchDate(d, { short: true })}`
    : frenchDate(d);

  // LLM action: button is primary if there's a change to process
  const hasText = (text || '').trim().length > 0;
  const isDirty = hasText && (!entry.processed_at || text !== entry.raw_text || entry.dirty);
  const llmPrimary = hasText && isDirty;

  const runLLM = async () => {
    if (!hasText || llmStatus === 'running') return;
    setLlmStatus('running');
    // First make sure latest text is saved
    updateEntry(activeDate, { raw_text: text, dirty: false });

    try {
      const prompt = `Tu reçois un journal vocal en français, dicté librement par une personne au sujet de sa journée alimentaire et émotionnelle. Tâche :
1. Produis un "résumé" : 1 à 2 phrases en prose calme, à la 3e personne neutre, sans jugement, qui capture l'humeur et le rythme de la journée. Pas de morale. Pas de conseils.
2. Extrais une liste de repas avec pour chaque entrée : type (parmi "petit-déj", "déj", "dîner", "snack"), content (description brève), time (HH:MM si mentionné, sinon "").

Réponds UNIQUEMENT en JSON strict, sans markdown ni \`\`\`, au format :
{"summary": "...", "meals": [{"type":"...","content":"...","time":"..."}]}

Voici le texte :
"""
${text}
"""`;

      const raw = await window.claude.complete(prompt);
      // Tolerate fenced output just in case
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);

      updateEntry(activeDate, {
        summary: parsed.summary || '',
        meals: Array.isArray(parsed.meals) ? parsed.meals : [],
        processed_at: 'à l\'instant',
        dirty: false,
      });
    } catch (err) {
      console.error('LLM error', err);
      // Soft fallback — derive a tiny summary from the text
      updateEntry(activeDate, {
        summary: 'Le résumé n\'a pas pu être généré. Réessaie dans un instant.',
        meals: [],
        processed_at: 'erreur',
        dirty: true,
      });
    } finally {
      setLlmStatus('idle');
    }
  };

  return (
    <main className="main">
      <div className="date-row">
        <div style={{ position: 'relative' }}>
          <button className="date" onClick={() => setPickerOpen((o) => !o)}>
            <span className="first-cap">{dateLabel}</span>
          </button>
          {pickerOpen && (
            <DatePicker
              selected={activeDate}
              entries={entries}
              onPick={(iso) => { setActiveDate(iso); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
        <div className="date-meta">
          <SaveStatus visible={saveStatus === 'saved'} />
        </div>
      </div>

      <div className="editor-shell">
        <textarea
          ref={taRef}
          className="editor"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isToday
            ? "Appuie sur le micro et raconte ta journée. Ou écris si tu préfères."
            : "Rien noté ce jour-là. Tu peux toujours l'ajouter maintenant."}
          spellCheck="true"
        />
      </div>

      <div className="action-row">
        <div style={{ minWidth: 0 }}>
          {hasText && (
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink-4)', letterSpacing: '0.02em' }}>
              {(text.match(/\S+/g) || []).length} mots
              {entry.processed_at && !isDirty && <> · résumé à jour</>}
              {entry.processed_at && isDirty && <> · modifié depuis le dernier résumé</>}
            </span>
          )}
        </div>
        <button
          className={`btn-llm ${llmPrimary ? 'primary' : ''}`}
          disabled={!hasText || llmStatus === 'running'}
          onClick={runLLM}
        >
          {llmStatus === 'running' ? (
            <>
              <span className="spinner" />
              Résumé en cours…
            </>
          ) : (
            <>
              {entry.processed_at && !isDirty ? 'Régénérer le résumé' : 'Envoyer au résumé'}
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
        </button>
      </div>

      <SummarySection entry={entry} llmStatus={llmStatus} hasText={hasText} />

      <MicButton
        onTranscript={(chunk) => {
          setText((prev) => {
            const sep = prev && !/[\s\n]$/.test(prev) ? ' ' : '';
            return prev + sep + chunk;
          });
        }}
      />
    </main>
  );
}

// ── Save status pill ──────────────────────────────────────────────
function SaveStatus({ visible }) {
  return (
    <span className={`save-status ${visible ? 'visible' : ''}`} aria-live="polite">
      <span className="dot" />
      Sauvegardé
    </span>
  );
}

// ── Date picker ────────────────────────────────────────────────────
function DatePicker({ selected, entries, onPick, onClose }) {
  const sel = fromISO(selected);
  const [view, setView] = useState({ y: sel.getFullYear(), m: sel.getMonth() });
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  const first = new Date(view.y, view.m, 1);
  // Monday-first
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const prevMonthDays = new Date(view.y, view.m, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    const dayNum = prevMonthDays - startOffset + 1 + i;
    cells.push({ day: dayNum, dim: true, m: view.m - 1 });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, dim: false, m: view.m });
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const dayNum = cells.length - startOffset - daysInMonth + 1;
    cells.push({ day: dayNum, dim: true, m: view.m + 1 });
    if (cells.length >= 42) break;
  }

  const todayISO = toISO(today());

  return (
    <div className="picker" ref={ref}>
      <div className="picker-head">
        <button className="picker-nav" onClick={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 })} aria-label="Mois précédent">‹</button>
        <span style={{ textTransform: 'capitalize' }}>{MONTHS[view.m]} {view.y}</span>
        <button className="picker-nav" onClick={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 })} aria-label="Mois suivant">›</button>
      </div>
      <div className="picker-grid">
        {DOWS_INITIALS.map((d, i) => <span key={i} className="picker-dow">{d}</span>)}
        {cells.map((c, i) => {
          const cellDate = new Date(view.y, c.m, c.day);
          const iso = toISO(cellDate);
          const isFuture = cellDate > today();
          const hasEntry = entries[iso] && (entries[iso].raw_text || entries[iso].summary);
          const cls = [
            'picker-day',
            c.dim ? 'dim' : '',
            iso === todayISO ? 'today' : '',
            iso === selected ? 'selected' : '',
            hasEntry ? 'has-entry' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={i}
              className={cls}
              disabled={isFuture}
              style={isFuture ? { opacity: 0.25, cursor: 'not-allowed' } : undefined}
              onClick={() => !isFuture && onPick(iso)}
            >{c.day}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── Summary section ───────────────────────────────────────────────
function SummarySection({ entry, llmStatus, hasText }) {
  if (llmStatus === 'running' && !entry.summary) {
    return (
      <section className="summary" aria-busy="true">
        <div className="summary-label">Résumé</div>
        <p className="summary-prose" style={{ color: 'var(--ink-4)' }}>
          Lecture du texte en cours…
        </p>
      </section>
    );
  }
  if (!entry.summary) return null;
  return (
    <section className="summary">
      <div className="summary-label">
        Résumé
      </div>
      <p className="summary-prose">{entry.summary}</p>
      {entry.meals && entry.meals.length > 0 && (
        <div className="meals">
          {entry.meals.map((m, i) => (
            <div className="meal" key={i}>
              <div className="meal-type">{m.type}</div>
              <div>
                <div className="meal-content">{m.content}</div>
                {m.time && <div className="meal-time">{m.time}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Mic button ────────────────────────────────────────────────────
function MicButton({ onTranscript }) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const fallbackTimerRef = useRef(null);

  // Detect support — also gracefully handle iframe / preview restrictions
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const stop = useCallback(() => {
    setListening(false);
    if (recRef.current) {
      try { recRef.current.stop(); } catch {}
      recRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      // Fallback: simulate dictation for the prototype demo
      simulateDictation();
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'fr-FR';
      rec.interimResults = false;          // brief says "final results only — no jittery interim"
      rec.continuous = true;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) {
            const text = r[0].transcript.trim();
            if (text) onTranscript(text);
          }
        }
      };
      rec.onerror = (e) => {
        console.warn('Speech error', e.error);
        // Permission denied or running inside iframe — fall back to demo
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
          stop();
          simulateDictation();
        }
      };
      rec.onend = () => {
        if (recRef.current === rec) {
          setListening(false);
          recRef.current = null;
        }
      };
      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch (err) {
      console.warn('Speech start failed', err);
      simulateDictation();
    }
  }, [onTranscript, stop]);

  // For the prototype: when real speech isn't available (no permission, iframe,
  // wrong browser) we simulate a dictation by emitting short chunks of demo text.
  const simulateDictation = useCallback(() => {
    setListening(true);
    const chunks = [
      "Ce matin café au lait et deux tartines à la confiture de figue.",
      "Vers onze heures j'ai eu un coup de mou, j'ai grignoté un petit carré de chocolat.",
      "Midi je suis allé déjeuner chez ma sœur — risotto aux champignons, salade, un verre de vin blanc.",
      "L'après-midi tranquille, juste un thé vert vers seize heures.",
      "Le soir je n'avais pas très faim, soupe de poireau et un morceau de fromage avec du pain.",
      "Globalement bonne journée, présent à table, pas de craving.",
    ];
    let i = 0;
    fallbackTimerRef.current = setInterval(() => {
      if (i >= chunks.length) {
        stop();
        return;
      }
      onTranscript(chunks[i]);
      i++;
    }, 1400);
  }, [onTranscript, stop]);

  const toggle = () => {
    if (!supported && !listening) {
      // Disabled state — no-op (tooltip explains)
      return;
    }
    listening ? stop() : start();
  };

  useEffect(() => () => stop(), [stop]);

  return (
    <>
      {listening && (
        <div className="live-hint" aria-hidden>
          <span className="blip" />
          Écoute…
        </div>
      )}
      <div className="mic-wrap" style={{ position: 'fixed', right: 0, bottom: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'relative', pointerEvents: 'auto' }}>
          <button
            className={`mic ${listening ? 'listening' : ''}`}
            disabled={!supported}
            onClick={toggle}
            aria-label={listening ? 'Arrêter la dictée' : 'Commencer la dictée'}
            title=""
          >
            {listening ? (
              // square = stop
              <svg viewBox="0 0 22 22" fill="none">
                <rect x="6" y="6" width="10" height="10" rx="1.5" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 22 22" fill="none">
                <rect x="8" y="3" width="6" height="11" rx="3" fill="currentColor" />
                <path d="M5 11a6 6 0 0 0 12 0M11 17v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            )}
          </button>
          {!supported && (
            <div className="mic-tooltip show">
              Dictée non supportée. Essaie Chrome ou Safari.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── History ────────────────────────────────────────────────────────
function HistoryView({ entries, onPick }) {
  // Build sorted list of all entries that exist (have at least raw_text or summary)
  const rows = useMemo(() => {
    const list = Object.entries(entries)
      .filter(([, e]) => e && (e.raw_text || e.summary))
      .sort((a, b) => a[0] < b[0] ? 1 : -1)
      .map(([iso, e]) => ({ iso, ...e }));
    return list;
  }, [entries]);

  return (
    <main className="main">
      <h1 className="history-title">Historique</h1>
      <p className="history-sub">{rows.length} {rows.length > 1 ? 'jours notés' : 'jour noté'}.</p>

      <div className="history-list">
        {rows.map((r) => {
          const d = fromISO(r.iso);
          const preview = r.summary
            ? (r.summary.split(/(?<=[.!?])\s+/)[0] || '')
            : (r.raw_text ? 'Brouillon, non traité' : '');
          return (
            <a key={r.iso} className="history-row" href="#"
               onClick={(e) => { e.preventDefault(); onPick(r.iso); }}>
              <div className="history-date">
                {d.getDate()} {MONTHS[d.getMonth()]}
                <span className="dow">{DOWS_SHORT[d.getDay()]} {d.getFullYear()}</span>
              </div>
              <div className={`history-preview ${!r.summary ? 'unprocessed' : ''}`}>
                {preview}
              </div>
              <div className="history-meta">
                {!r.summary && <><span className="badge-unprocessed" /> non traité</>}
                {r.summary && <span className="history-arrow">→</span>}
              </div>
            </a>
          );
        })}
      </div>

      <div className="pagination">
        <button>‹ Plus ancien</button>
        <button disabled>Plus récent ›</button>
      </div>
    </main>
  );
}

// ── Export ─────────────────────────────────────────────────────────
function ExportView({ entries }) {
  const t = today();
  const [from, setFrom] = useState(toISO(addDays(t, -30)));
  const [to, setTo]   = useState(toISO(t));

  const preview = useMemo(() => {
    const list = Object.entries(entries)
      .filter(([iso, e]) => e && iso >= from && iso <= to && e.meals && e.meals.length)
      .sort((a, b) => a[0] < b[0] ? 1 : -1);

    if (list.length === 0) return "# Repas\n\n_Aucun repas enregistré sur cette période._\n";

    let md = `# Repas — ${frenchDate(fromISO(from), { short: true })} → ${frenchDate(fromISO(to), { short: true })}\n\n`;
    for (const [iso, e] of list) {
      const d = fromISO(iso);
      md += `## ${frenchDate(d)}\n\n`;
      for (const m of e.meals) {
        md += `- **${m.type}**${m.time ? ` _(${m.time})_` : ''} — ${m.content}\n`;
      }
      md += `\n`;
    }
    return md;
  }, [entries, from, to]);

  const download = () => {
    const blob = new Blob([preview], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repas-${from}_${to}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="main">
      <h1 className="export-title">Exporter les repas</h1>
      <p className="export-sub">
        Télécharge un fichier markdown récapitulant les repas sur la période choisie. Pratique pour partager avec un·e diététicien·ne.
      </p>

      <div className="export-form">
        <div className="export-fields">
          <div className="field-group">
            <label className="field-label" htmlFor="from">Du</label>
            <input id="from" className="field-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to} />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="to">Au</label>
            <input id="to" className="field-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} max={toISO(today())} />
          </div>
        </div>

        <button className="export-btn" onClick={download}>
          Télécharger
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v9m0 0 3-3m-3 3L5 8M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <p className="export-preview-label" style={{ marginTop: 36 }}>Aperçu</p>
      <pre className="export-preview">{preview}</pre>
    </main>
  );
}

// ── Mount ──────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
