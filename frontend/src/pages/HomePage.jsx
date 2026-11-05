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

const text = {
  headline: ['K-콘텐츠에서', '실제 경험으로'],
  sub: '좋아하는 K-콘텐츠 속 장면과 맛을 서울에서 찾아보세요.',
  placeholder: '예: "이 드라마 촬영지가 어디야?"',
  attachPhoto: '사진 첨부',
  photoRemove: '첨부 삭제',
  searchLabel: '장면, 분위기, 음식을 입력',
  searchButton: '검색',
  modes: {
    scene: { title: '장소 찾기', line: '"어디서 찍은 장소일까?"' },
    food: { title: '음식 알아보기', line: '"이 음식이 뭐야?"' },
  },
  feedOpen: '피드 열기',
  feedClose: '피드 닫기',
  feedSearch: '게시물, 장소, 해시태그 검색',
  feedTabs: ['내 피드', '탐색', '저장됨'],
  profile: '프로필',
  login: '로그인',
  logout: '로그아웃',
  createFeed: '피드 생성',
  newPost: '새 게시물 만들기',
  dropPhoto: '사진과 동영상을 여기에 끌어다 놓으세요',
  chooseFile: '컴퓨터에서 선택',
  preview: '미리보기',
  next: '다음',
  share: '공유하기',
  caption: '캡션 추가...',
  back: '이전',
  emptyFeed: '아직 게시물이 없어요.',
  email: '이메일',
  password: '비밀번호',
  signup: '회원가입',
  forgot: '비밀번호 찾기',
  loginNote: '피드는 로그인 후 이용할 수 있어요.',
  close: '닫기',
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
};

const feedSlots = Array.from({ length: 12 }, (_, index) => index);

export default function HomePage() {
  const [feedOpen, setFeedOpen] = useState(false);
  const [entry, setEntry] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [session, setSession] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [user, setUser] = useState(() => getUser());
  const [posts, setPosts] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [feedFocus, setFeedFocus] = useState(0);
  const lang = 'ko';

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
          <img src={logoUrl} alt="STOS, Scene to Seoul" className="logo-mark" />
        </header>

        <section className="flex flex-1 flex-col py-4">
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
              <ModeChip
                mode={modes[0]}
                text={text.modes.scene}
                selected={entry === 'scene'}
                onSelect={chooseEntry}
              />
              <ModeChip
                mode={modes[1]}
                text={text.modes.food}
                selected={entry === 'food'}
                onSelect={chooseEntry}
              />
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    setLoginOpen(true);
                    return;
                  }
                  setComposerOpen(true);
                }}
                className="flex items-center gap-3 rounded-full bg-chip py-2.5 pr-5 pl-2 text-left"
              >
                <span className="grid size-11 place-items-center rounded-full bg-white text-ink shadow-[0_2px_8px_rgba(40,30,90,0.06)]">
                  <PlusIcon />
                </span>
                <span className="text-[14px] leading-5 font-semibold text-black">
                  {text.createFeed}
                </span>
              </button>
            </div>

            <form
              className="mt-10 flex h-14 w-[calc(45vw-2.5rem)] shrink-0 items-center gap-2 self-start rounded-full border border-[#e7e7f2] bg-white py-1.5 pr-1.5 pl-1.5 shadow-[0_10px_30px_rgba(55,45,120,0.06)]"
              onSubmit={onSearch}
            >
              <SearchField text={text} photo={photo} onPhotoChange={setPhoto} />
            </form>
          </div>
        </section>
      </div>

      <FeedPanel
        open={feedOpen}
        loggedIn={Boolean(user)}
        posts={posts}
        feedFocus={feedFocus}
        onLogin={() => setLoginOpen(true)}
        onLogout={() => {
          logout();
          setUser(null);
        }}
        onToggle={() => setFeedOpen((open) => !open)}
      />
      {composerOpen ? (
        <CreatePostModal
          onClose={() => setComposerOpen(false)}
          onShare={(post) => {
            setPosts((current) => [post, ...current]);
            setComposerOpen(false);
            setFeedOpen(true);
            setFeedFocus((value) => value + 1);
          }}
        />
      ) : null}
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

function FeedPanel({ open, loggedIn, posts, feedFocus, onLogin, onLogout, onToggle }) {
  const [tab, setTab] = useState(0);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!feedFocus) return;
    setTab(0);
    setSearched(false);
  }, [feedFocus]);
  const currentTab = text.feedTabs[tab];
  const loginGate =
    !loggedIn && searched
      ? '검색'
      : !loggedIn && (currentTab === '내 피드' || currentTab === '저장됨')
        ? currentTab
        : null;

  function chooseTab(index) {
    setTab(index);
    setSearched(false);
  }

  function onFeedSearch(event) {
    event.preventDefault();
    if (loggedIn) return;
    const query = String(new FormData(event.currentTarget).get('query') ?? '').trim();
    if (query) setSearched(true);
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="community-feed"
        aria-label={open ? text.feedClose : text.feedOpen}
        onClick={onToggle}
        className={`absolute top-1/2 z-30 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-[0_8px_24px_rgba(40,30,90,0.18)] transition-[right] duration-500 ease-out ${
          open ? 'right-[calc(50vw-1.375rem)]' : 'right-6'
        }`}
      >
        <PanelChevronIcon point={open ? 'right' : 'left'} />
      </button>
      <aside
        id="community-feed"
        aria-hidden={!open}
        className={`absolute top-6 bottom-6 left-1/2 z-20 flex w-[calc(50vw-1.5rem)] flex-col overflow-hidden rounded-[28px] bg-white px-5 py-5 text-black shadow-[0_18px_50px_rgba(28,18,64,0.18)] transition-transform duration-500 ease-out ${
          open
            ? 'translate-x-0'
            : 'pointer-events-none translate-x-[calc(100%+1.5rem)]'
        }`}
      >
        <form
          className="flex h-11 items-center gap-2 rounded-full bg-[#f4f5fb] px-4"
          onSubmit={onFeedSearch}
        >
          <input
            name="query"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-black outline-none placeholder:text-[#8d8aa3]"
            placeholder={text.feedSearch}
            aria-label={text.feedSearch}
            tabIndex={open ? 0 : -1}
          />
          <button
            type="submit"
            aria-label={text.searchButton}
            tabIndex={open ? 0 : -1}
            className="grid size-7 shrink-0 place-items-center text-[#8d8aa3]"
          >
            <SearchIcon />
          </button>
        </form>
        <div className="mt-4 flex items-end justify-between gap-4 border-b border-[#ececf5]">
          <div role="tablist" aria-label="커뮤니티" className="flex gap-6 px-1">
            {text.feedTabs.map((label, index) => {
              const selected = tab === index;
              return (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={open ? 0 : -1}
                  onClick={() => chooseTab(index)}
                  className={`-mb-px border-b-2 pb-3 text-sm font-semibold ${
                    selected
                      ? 'border-violet text-violet'
                      : 'border-transparent text-[#8d8aa3]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <ProfileMenu
            panelOpen={open}
            loggedIn={loggedIn}
            onLogin={onLogin}
            onLogout={onLogout}
          />
        </div>
        {loginGate ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <p className="text-sm leading-6 font-medium text-black">
              {`"${loginGate}" 기능은 로그인 후 이용하실 수 있습니다.`}
            </p>
          </div>
        ) : currentTab === '내 피드' ? (
          <MyFeed posts={posts} />
        ) : (
          <div className="mt-4 grid flex-1 grid-cols-4 content-start gap-3 overflow-y-auto pr-1">
            {feedSlots.map((slot) => (
              <div
                key={`${tab}-${slot}`}
                className="aspect-[3/4] rounded-2xl bg-[#e7e9f2]"
              />
            ))}
          </div>
        )}
      </aside>
    </>
  );
}

function MyFeed({ posts }) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-sm leading-6 font-medium text-[#8d8aa3]">{text.emptyFeed}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 grid flex-1 grid-cols-4 content-start gap-3 overflow-y-auto pr-1">
      {posts.map((post) => (
        <figure key={post.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#e7e9f2]">
          <img src={post.url} alt="" className="size-full object-cover" />
          {post.caption ? (
            <figcaption className="absolute inset-x-0 bottom-0 line-clamp-2 bg-black/45 px-2 py-1.5 text-[10px] leading-4 font-medium text-white">
              {post.caption}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

function CreatePostModal({ onClose, onShare }) {
  const inputRef = useRef(null);
  const ownedUrl = useRef(null);
  const [draftUrl, setDraftUrl] = useState(null);
  const [step, setStep] = useState('pick');
  const [caption, setCaption] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    };
  }, []);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  function takeFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    const url = URL.createObjectURL(file);
    ownedUrl.current = url;
    setDraftUrl(url);
    setStep('preview');
  }

  function share() {
    if (!draftUrl) return;
    ownedUrl.current = null;
    onShare({
      id: crypto.randomUUID(),
      url: draftUrl,
      caption: caption.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={text.newPost}
        className={`flex max-h-[86vh] flex-col overflow-hidden rounded-2xl bg-white text-black shadow-[0_24px_80px_rgba(20,16,50,0.28)] ${
          step === 'caption' ? 'w-[min(920px,94vw)]' : 'w-[min(440px,94vw)]'
        }`}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#ececf5] px-4">
          {step === 'pick' ? (
            <span className="w-14" />
          ) : (
            <button
              type="button"
              aria-label={text.back}
              onClick={() => setStep(step === 'caption' ? 'preview' : 'pick')}
              className="grid size-9 place-items-center rounded-full text-black"
            >
              <BackIcon />
            </button>
          )}
          <h2 className="text-sm font-semibold">
            {step === 'preview' ? text.preview : text.newPost}
          </h2>
          {step === 'pick' ? (
            <button
              type="button"
              aria-label={text.close}
              onClick={onClose}
              className="grid size-9 place-items-center rounded-full text-xl leading-none text-black"
            >
              ×
            </button>
          ) : step === 'preview' ? (
            <button
              type="button"
              onClick={() => setStep('caption')}
              className="text-sm font-semibold text-violet"
            >
              {text.next}
            </button>
          ) : (
            <button
              type="button"
              onClick={share}
              className="text-sm font-semibold text-violet"
            >
              {text.share}
            </button>
          )}
        </header>

        {step === 'pick' ? (
          <div
            className={`grid min-h-80 place-items-center px-8 py-12 text-center ${
              dragOver ? 'bg-[#f4f0ff]' : ''
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              takeFile(event.dataTransfer.files?.[0]);
            }}
          >
            <div>
              <MediaIcon />
              <p className="mt-4 text-lg font-medium">{text.dropPhoto}</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-5 rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-white"
              >
                {text.chooseFile}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  takeFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </div>
          </div>
        ) : null}

        {step === 'preview' && draftUrl ? (
          <img src={draftUrl} alt="" className="aspect-square w-full object-cover" />
        ) : null}

        {step === 'caption' && draftUrl ? (
          <div className="grid min-h-0 flex-1 grid-cols-2">
            <img
              src={draftUrl}
              alt=""
              className="h-full max-h-[70vh] w-full object-cover"
            />
            <label className="flex min-h-80 flex-col p-4">
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder={text.caption}
                aria-label={text.caption}
                maxLength={200}
                className="min-h-40 flex-1 resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-[#8d8aa3]"
              />
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MediaIcon() {
  return (
    <svg
      className="mx-auto size-16 text-black"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <rect x="6" y="14" width="34" height="28" rx="4" stroke="currentColor" strokeWidth="2.4" />
      <path d="M14 34l7-7 6 6 4-4 7 8" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="16" cy="22" r="2" fill="currentColor" />
      <rect x="28" y="24" width="30" height="24" rx="4" stroke="currentColor" strokeWidth="2.4" />
      <path d="M40 36v8M36 40h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileMenu({ panelOpen, loggedIn, onLogin, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnOutside(event) {
      if (!rootRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!panelOpen) setMenuOpen(false);
  }, [panelOpen]);

  if (!loggedIn) {
    return (
      <button
        type="button"
        tabIndex={panelOpen ? 0 : -1}
        onClick={onLogin}
        className="mb-2 shrink-0 rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white"
      >
        {text.login}
      </button>
    );
  }

  return (
    <div className="relative z-30 mb-2 shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={text.profile}
        tabIndex={panelOpen ? 0 : -1}
        onClick={() => setMenuOpen((value) => !value)}
        className="grid size-9 place-items-center rounded-full bg-[#efeaff] text-violet"
      >
        <ProfileIcon />
      </button>
      {menuOpen ? (
        <div
          role="menu"
          aria-label={text.profile}
          className="absolute top-full right-0 mt-2 w-36 overflow-hidden rounded-2xl border border-[#e6e6f2] bg-white py-1 shadow-[0_16px_40px_rgba(40,30,90,0.12)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onLogout();
              setMenuOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-chip"
          >
            {text.logout}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProfileIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5.5 19.2c1.4-2.8 3.6-4.2 6.5-4.2s5.1 1.4 6.5 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchField({ text, photo = null, onPhotoChange }) {
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
      onClick={() => onSelect?.(mode.id)}
      className={`flex items-center gap-3 rounded-full border-2 py-2.5 pr-5 pl-2 text-left ${selected ? 'border-violet bg-[#efeaff]' : 'border-transparent bg-chip'}`}
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

function PanelChevronIcon({ point }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={point === 'left' ? 'M14 6 8 12l6 6' : 'M10 6l6 6-6 6'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-[#8d8aa3]"
    >
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M16 16l4 4"
        stroke="currentColor"
        strokeWidth="1.6"
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
