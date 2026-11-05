import { useEffect, useRef, useState } from 'react';

const modes = [
  { id: 'scene', icon: ClapperIcon },
  { id: 'mood', icon: SmileIcon },
  { id: 'food', icon: FoodIcon },
];

const languages = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'EN' },
];

const copy = {
  ko: {
    headline: ['K-콘텐츠에서', '실제 경험으로'],
    sub: '좋아하는 K-콘텐츠 속 장면, 맛, 분위기를 서울에서 찾아보세요.',
    placeholder: '예: "이 드라마 촬영지가 어디야?"',
    searchLabel: '장면, 분위기, 음식을 입력',
    searchButton: '검색',
    modes: {
      scene: { title: '장면 찾기', line: '"어디서 찍은 장면일까?"' },
      mood: {
        title: '분위기 느끼기',
        line: '"드라마 같은 분위기를 느끼고 싶어"',
      },
      food: { title: '음식 알아보기', line: '"이 음식이 뭐야?"' },
    },
    languageLabel: '언어: 한국어',
  },
  en: {
    headline: ['From K-Content', 'to Real Experience'],
    sub: 'Discover the scenes, flavors, and vibes from your favorite K-content in Seoul.',
    placeholder: 'Try "the filming location of this drama"',
    searchLabel: 'Describe a scene, vibe, or food',
    searchButton: 'Search',
    modes: {
      scene: { title: 'Find a Scene', line: '"Where was this filmed?"' },
      mood: { title: 'Feel the Vibe', line: '"Experience a drama-like vibe"' },
      food: { title: 'Explore Food', line: '"What\'s this food?"' },
    },
    languageLabel: 'Language: English',
  },
};

export default function App() {
  const [lang, setLang] = useState('ko');
  const text = copy[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <img src="/hero.jpeg?v=3" alt="" className="hero-photo" />
      <div className="relative z-10 flex h-full flex-col px-10 py-7 text-black">
        <header className="flex items-center">
          <img
            src="/logo.png"
            alt="STOS, Scene to Seoul"
            className="logo-mark"
          />
          <LanguageToggle
            lang={lang}
            label={text.languageLabel}
            onChange={setLang}
          />
        </header>

        <section className="flex w-[min(720px,62%)] flex-1 flex-col py-4">
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="text-[4rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-black">
              <span className="relative inline-block">
                {text.headline[0]}
                <SparkleIcon />
              </span>
              <br />
              {text.headline[1]}
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-7 font-medium text-black">
              {text.sub}
            </p>

            <form
              className="mt-7 flex h-14 items-center gap-2 rounded-full border border-[#e7e7f2] bg-white py-1.5 pr-1.5 pl-4 shadow-[0_10px_30px_rgba(55,45,120,0.06)]"
              onSubmit={(event) => event.preventDefault()}
            >
              <SearchIcon />
              <input
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-black outline-none placeholder:text-[#3a3a3a]"
                placeholder={text.placeholder}
                aria-label={text.searchLabel}
              />
              <button
                type="button"
                aria-label={text.searchButton}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-violet text-white"
              >
                <ArrowIcon />
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {modes.map((mode) => (
                <ModeChip
                  key={mode.id}
                  mode={mode}
                  text={text.modes[mode.id]}
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      <p className="script pointer-events-none absolute right-12 bottom-12 z-10 text-right text-white">
        Discover Seoul
        <br />
        with STOS <span aria-hidden="true">♡</span>
      </p>
    </div>
  );
}

function LanguageToggle({ lang, label, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = languages.find((item) => item.id === lang);

  useEffect(() => {
    function closeOnOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <div className="relative ml-auto" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 text-sm font-semibold text-black"
      >
        <GlobeIcon />
        {current.label}
        <ChevronIcon className={open ? 'rotate-180' : ''} />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute top-full right-0 z-20 mt-2 w-36 overflow-hidden rounded-2xl border border-[#e6e6f2] bg-white py-1 shadow-[0_16px_40px_rgba(40,30,90,0.12)]"
        >
          {languages.map((option) => {
            const selected = option.id === lang;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-chip ${selected ? 'font-semibold text-ink' : 'text-muted'}`}
                >
                  {option.label}
                  {selected ? (
                    <span className="size-1.5 rounded-full bg-violet" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ModeChip({ mode, text }) {
  const Icon = mode.icon;

  return (
    <button
      type="button"
      data-entry={mode.id}
      className="flex items-center gap-2.5 rounded-full bg-chip py-1.5 pr-4 pl-1.5 text-left"
    >
      <span className="grid size-9 place-items-center rounded-full bg-white text-ink shadow-[0_2px_8px_rgba(40,30,90,0.06)]">
        <Icon />
      </span>
      <span>
        <span className="block text-[13px] leading-4 font-semibold text-black">
          {text.title}
        </span>
        <span className="mt-0.5 block text-[11px] leading-4 font-medium text-black">
          {text.line}
        </span>
      </span>
    </button>
  );
}

function SparkleIcon() {
  return (
    <svg
      className="absolute -top-3 -right-4 size-5 text-[#c4b6ff]"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 0l1.6 6.2L18 8l-6.4 1.8L10 16l-1.6-6.2L2 8l6.4-1.8L10 0Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-black"
    >
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 16.5 20 20.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4 12h16M12 4c2.2 2.4 2.2 13.6 0 16M12 4c-2.2 2.4-2.2 13.6 0 16"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function ChevronIcon({ className = '' }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`transition ${className}`}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClapperIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 10h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 10 8.2 6h4.2L8.4 10M10.6 10 13.8 6h4.6L14.8 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8.5 13.5c.8 1.4 2 2.1 3.5 2.1s2.7-.7 3.5-2.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9 10h.01M15 10h.01"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FoodIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 4v6M6 4v6M10 4v6M8 10v10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16 4c2 2.2 2 13.8 0 16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
