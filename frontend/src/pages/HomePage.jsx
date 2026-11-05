import { useEffect, useRef, useState } from 'react';
import logoUrl from '../../../logo/서울을 담은 STOS 로고.png';
import StosApp from '@/stos/StosApp.jsx';
import { fileToDataUrl } from '@/stos/image.js';
import LoginModal from '@/components/LoginModal.jsx';
import { getUser, logout } from '@/auth.js';

const modes = [
  { id: 'scene', icon: ClapperIcon },
  { id: 'food', icon: FoodIcon },
];

const languages = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'EN' },
  { id: 'zh', label: '中文' },
  { id: 'ja', label: '日本語' },
];

const copy = {
  ko: {
    headline: ['K-콘텐츠에서', '실제 경험으로'],
    sub: '좋아하는 K-콘텐츠 속 장면과 맛을 서울에서 찾아보세요.',
    placeholder: '예: "이 드라마 촬영지가 어디야?"',
    attachPhoto: '사진 첨부',
    photoRemove: '첨부 삭제',
    searchLabel: '장면, 분위기, 음식을 입력',
    searchButton: '검색',
    login: '로그인',
    email: '이메일',
    password: '비밀번호',
    signup: '회원가입',
    forgot: '비밀번호 찾기',
    loginNote: '피드는 로그인 후 이용할 수 있어요.',
    close: '닫기',
    logout: '로그아웃',
    confirmPassword: '비밀번호 확인',
    signupSubmit: '가입하기',
    forgotNext: '다음',
    resetTitle: '새 비밀번호',
    resetSubmit: '변경하기',
    backToLogin: '로그인으로',
    errorRequired: '필요한 항목을 입력해 주세요.',
    errorEmail: '이메일 형식을 확인해 주세요.',
    errorShort: '비밀번호는 8자 이상이어야 해요.',
    errorMismatch: '비밀번호가 서로 달라요.',
    errorExists: '이미 가입된 이메일이에요.',
    errorInvalid: '이메일 또는 비밀번호가 올바르지 않아요.',
    errorMissing: '가입되지 않은 이메일이에요.',
    resetDone: '비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.',
    modes: {
      scene: { title: '장소 찾기', line: '"어디서 찍은 장소일까?"' },
      food: { title: '음식 알아보기', line: '"이 음식이 뭐야?"' },
    },
    languageLabel: '언어: 한국어',
  },
  en: {
    headline: ['From K-Content', 'to Real Experience'],
    sub: 'Discover the scenes and flavors from your favorite K-content in Seoul.',
    placeholder: 'Try "the filming location of this drama"',
    attachPhoto: 'Add a photo',
    photoRemove: 'Remove photo',
    searchLabel: 'Describe a scene, vibe, or food',
    searchButton: 'Search',
    login: 'Log in',
    email: 'Email',
    password: 'Password',
    signup: 'Sign up',
    forgot: 'Forgot password',
    loginNote: 'You can use the feed after logging in.',
    close: 'Close',
    logout: 'Log out',
    confirmPassword: 'Confirm password',
    signupSubmit: 'Create account',
    forgotNext: 'Continue',
    resetTitle: 'New password',
    resetSubmit: 'Update',
    backToLogin: 'Back to log in',
    errorRequired: 'Fill in the required fields.',
    errorEmail: 'Check the email format.',
    errorShort: 'Use at least 8 characters.',
    errorMismatch: 'Passwords do not match.',
    errorExists: 'That email is already registered.',
    errorInvalid: 'Email or password is incorrect.',
    errorMissing: 'No account uses that email.',
    resetDone: 'Password updated. Log in with the new password.',
    modes: {
      scene: { title: 'Find a Scene', line: '"Where was this filmed?"' },
      food: { title: 'Explore Food', line: '"What\'s this food?"' },
    },
    languageLabel: 'Language: English',
  },
  zh: {
    headline: ['从K-内容', '到真实体验'],
    sub: '在首尔找到你喜欢的K-内容中的场景和味道。',
    placeholder: '例："这部剧的拍摄地在哪里？"',
    attachPhoto: '添加照片',
    photoRemove: '移除照片',
    searchLabel: '输入场景或美食',
    searchButton: '搜索',
    login: '登录',
    email: '邮箱',
    password: '密码',
    signup: '注册',
    forgot: '找回密码',
    loginNote: '登录后可以使用动态。',
    close: '关闭',
    logout: '退出',
    confirmPassword: '确认密码',
    signupSubmit: '注册',
    forgotNext: '下一步',
    resetTitle: '新密码',
    resetSubmit: '更改',
    backToLogin: '返回登录',
    errorRequired: '请填写必填项。',
    errorEmail: '请检查邮箱格式。',
    errorShort: '密码至少需要 8 个字符。',
    errorMismatch: '两次输入的密码不一致。',
    errorExists: '这个邮箱已经注册过了。',
    errorInvalid: '邮箱或密码不正确。',
    errorMissing: '没有使用这个邮箱的账号。',
    resetDone: '密码已更改。请用新密码登录。',
    modes: {
      scene: { title: '查找地点', line: '"这是在哪里拍的？"' },
      food: { title: '了解美食', line: '"这是什么食物？"' },
    },
    languageLabel: '语言：中文',
  },
  ja: {
    headline: ['Kコンテンツから', '本物の体験へ'],
    sub: '好きなKコンテンツのシーンと味を、ソウルで見つけてください。',
    placeholder: '例：「このドラマのロケ地はどこ？」',
    attachPhoto: '写真を添付',
    photoRemove: '添付を削除',
    searchLabel: 'シーンや食べ物を入力',
    searchButton: '検索',
    login: 'ログイン',
    email: 'メール',
    password: 'パスワード',
    signup: '会員登録',
    forgot: 'パスワードを探す',
    loginNote: 'フィードはログイン後に利用できます。',
    close: '閉じる',
    logout: 'ログアウト',
    confirmPassword: 'パスワード確認',
    signupSubmit: '登録する',
    forgotNext: '次へ',
    resetTitle: '新しいパスワード',
    resetSubmit: '変更する',
    backToLogin: 'ログインへ',
    errorRequired: '必要な項目を入力してください。',
    errorEmail: 'メールアドレスの形式を確認してください。',
    errorShort: 'パスワードは8文字以上にしてください。',
    errorMismatch: 'パスワードが一致しません。',
    errorExists: 'このメールアドレスはすでに登録されています。',
    errorInvalid: 'メールアドレスまたはパスワードが正しくありません。',
    errorMissing: 'このメールアドレスのアカウントはありません。',
    resetDone: 'パスワードを変更しました。新しいパスワードでログインしてください。',
    modes: {
      scene: { title: '場所を探す', line: '"どこで撮った場所？"' },
      food: { title: '食べ物を知る', line: '"この食べ物は何？"' },
    },
    languageLabel: '言語：日本語',
  },
};

export default function HomePage() {
  const [lang, setLang] = useState('ko');
  const [entry, setEntry] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [session, setSession] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [user, setUser] = useState(() => getUser());
  const text = copy[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  function chooseEntry(id) {
    setEntry((current) => (current === id ? null : id));
  }

  async function onSearch(event) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('query') ?? '').trim();
    let image = '';
    if (photo?.file) {
      try {
        image = await fileToDataUrl(photo.file);
      } catch {
        image = '';
      }
    }
    if (!query && !image) return;
    setSession({
      id: crypto.randomUUID(),
      text: query,
      mode: entry === 'food' ? 'restaurant' : 'place',
      image,
      lang,
    });
  }

  if (session) {
    return <StosApp session={session} onHome={() => setSession(null)} />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <img src="/hero.jpeg?v=3" alt="" className="hero-photo" />
      <div className="relative z-10 flex h-full flex-col px-10 py-7 text-black">
        <header className="flex items-center">
          <img
            src={logoUrl}
            alt="STOS, Scene to Seoul"
            className="logo-mark"
          />
          <div className="ml-auto flex origin-top-right scale-[1.3] items-center gap-5">
            {user ? (
              <>
                <span className="max-w-36 truncate text-sm font-semibold text-black" title={user.email}>
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setUser(null);
                  }}
                  className="text-sm font-semibold text-black"
                >
                  {text.logout}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="text-sm font-semibold text-black"
              >
                {text.login}
              </button>
            )}
            <LanguageToggle
              lang={lang}
              label={text.languageLabel}
              onChange={setLang}
            />
          </div>
        </header>

        <section className="flex w-[min(720px,62%)] flex-1 flex-col py-4">
          <div className="flex flex-1 flex-col justify-start pt-5">
            <h1 className="text-[4rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-black">
              <span className="relative inline-block">
                {text.headline[0]}
                <SparkleIcon />
              </span>
              <br />
              {text.headline[1]}
            </h1>
            <p className="mt-10 max-w-md text-[18px] leading-7 font-medium text-black">
              {text.sub}
            </p>

            <div className="mt-10 flex flex-wrap gap-2">
              {modes.map((mode) => (
                <ModeChip
                  key={mode.id}
                  mode={mode}
                  text={text.modes[mode.id]}
                  selected={entry === mode.id}
                  onSelect={chooseEntry}
                />
              ))}
            </div>

            <form
              className="mt-10 flex h-14 items-center gap-2 rounded-full border border-[#e7e7f2] bg-white py-1.5 pr-1.5 pl-1.5 shadow-[0_10px_30px_rgba(55,45,120,0.06)]"
              onSubmit={onSearch}
            >
              <SearchField text={text} photo={photo} onPhotoChange={setPhoto} />
            </form>
          </div>
        </section>
      </div>

      {loginOpen ? (
        <LoginModal
          text={text}
          logoUrl={logoUrl}
          onClose={() => setLoginOpen(false)}
          onSuccess={setUser}
        />
      ) : null}

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
    <div
      className="relative"
      ref={rootRef}
    >
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

function SearchField({ text, photo, onPhotoChange }) {
  const inputRef = useRef(null);

  function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onPhotoChange((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { url, file };
    });
  }

  function clearPhoto() {
    onPhotoChange((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onFile}
      />
      <button
        type="button"
        aria-label={text.attachPhoto}
        onClick={() => inputRef.current?.click()}
        className="grid size-10 shrink-0 place-items-center rounded-full text-black"
      >
        <PlusIcon />
      </button>
      {photo ? (
        <span className="relative shrink-0">
          <img src={photo.url} alt="" className="size-8 rounded-lg object-cover" />
          <button
            type="button"
            aria-label={text.photoRemove}
            onClick={clearPhoto}
            className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-black text-[10px] leading-none text-white"
          >
            ×
          </button>
        </span>
      ) : null}
      <input
        name="query"
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-black outline-none placeholder:text-[#3a3a3a]"
        placeholder={text.placeholder}
        aria-label={text.searchLabel}
      />
      <button
        type="submit"
        aria-label={text.searchButton}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-violet text-white"
      >
        <ArrowIcon />
      </button>
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ModeChip({ mode, text, selected, onSelect }) {
  const Icon = mode.icon;

  return (
    <button
      type="button"
      data-entry={mode.id}
      aria-pressed={selected}
      onClick={() => onSelect(mode.id)}
      className={`flex items-center gap-3 rounded-full py-2.5 pr-5 pl-2 text-left ${selected ? 'bg-[#efeaff] ring-2 ring-violet' : 'bg-chip'}`}
    >
      <span className="grid size-11 place-items-center rounded-full bg-white text-ink shadow-[0_2px_8px_rgba(40,30,90,0.06)] [&_svg]:size-6">
        <Icon />
      </span>
      <span>
        <span className="block text-[14px] leading-5 font-semibold text-black">
          {text.title}
        </span>
        <span className="mt-0.5 block text-[10px] leading-4 font-medium text-black">
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
