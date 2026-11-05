import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import logo from '../../../logo/서울을 담은 STOS 로고.png'
import heroPhoto from '../../../logo/Gemini_Generated_Image_gbc3cbgbc3cbgbc3.png'
import './stos.css'
import { fileToDataUrl } from './image.js'

const LANGS = [
  ['en', 'EN'],
  ['ko', 'KO'],
  ['zh', '中文'],
  ['ja', '日本語'],
]

const EXAMPLES = {
  en: {
    place: 'I want the feeling of friends hanging out on a campus street in a drama',
    restaurant: 'What is the red food in this scene? I want to try it in Seoul',
  },
  ko: {
    place: '드라마에서 친구들이 대학가에서 놀던 분위기를 느껴보고 싶어',
    restaurant: '이 장면에 나온 빨간 음식이 뭐야? 서울에서 먹어보고 싶어',
  },
  zh: {
    place: '想体验剧里朋友们在大学街玩耍的氛围',
    restaurant: '这一幕里的红色食物是什么？想在首尔尝尝',
  },
  ja: {
    place: 'ドラマで友達が大学街で遊んでいた雰囲気を味わいたい',
    restaurant: 'この場面の赤い食べ物は何？ソウルで食べてみたい',
  },
}

const CHIPS = {
  en: [
    { mode: 'place', text: EXAMPLES.en.place },
    { mode: 'restaurant', text: EXAMPLES.en.restaurant },
    { mode: 'place', text: 'I want a quiet scene with a night view of Seoul' },
  ],
  ko: [
    { mode: 'place', text: EXAMPLES.ko.place },
    { mode: 'restaurant', text: EXAMPLES.ko.restaurant },
    { mode: 'place', text: '조용하고 서울 야경이 보이는 장면을 경험하고 싶어' },
  ],
  zh: [
    { mode: 'place', text: EXAMPLES.zh.place },
    { mode: 'restaurant', text: EXAMPLES.zh.restaurant },
    { mode: 'place', text: '想体验安静、能看到首尔夜景的场景' },
  ],
  ja: [
    { mode: 'place', text: EXAMPLES.ja.place },
    { mode: 'restaurant', text: EXAMPLES.ja.restaurant },
    { mode: 'place', text: '静かでソウルの夜景が見える場面を体験したい' },
  ],
}

function textOf(item, lang, key) {
  if (!item) return ''
  const nested = item[key]
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return String(nested[lang] || '')
  return String(item[`${key}_${lang}`] || '')
}

function listOf(item, lang, key) {
  const value = item?.[key]
  if (!value) return []
  if (Array.isArray(value)) return value
  return Array.isArray(value[lang]) ? value[lang] : []
}

function addressOf(place, lang) {
  if (!place) return ''
  return place[`address_${lang}`] || ''
}

const DIET_LABEL = {
  en: { Vegan: 'Vegan', Halal: 'Halal', Hindu: 'Hindu' },
  ko: { Vegan: '비건', Halal: '할랄', Hindu: '힌두' },
  zh: { Vegan: '纯素', Halal: '清真', Hindu: '印度教' },
  ja: { Vegan: 'ビーガン', Halal: 'ハラール', Hindu: 'ヒンドゥー' },
}

const AVOID = {
  Vegan: /돼지고기|돼지|소고기|쇠고기|닭고기|닭|고기|어묵|오뎅|멸치|액젓|젓갈|해물|새우|오징어|생선|햄|소시지|계란|달걀|우유|치즈|버터|꿀|육수|fish\s*cake|odeng|eomuk|pork|beef|chicken|meat|anchovy|shrimp|seafood|fish|ham|sausage|\begg\b|milk|cheese|butter|honey|broth|lard/i,
  Halal: /돼지고기|돼지|햄|베이컨|소시지|라드|술|맥주|소주|와인|미림|pork|ham|bacon|sausage|lard|alcohol|beer|wine|mirin/i,
  Hindu: /소고기|쇠고기|\bbeef\b/i,
}

function dietWarnings(food, lang) {
  const lists = ['ko', 'en', 'zh', 'ja'].map((code) => food?.ingredients?.[code] || [])
  const current = food?.ingredients?.[lang]?.length ? food.ingredients[lang] : (food?.ingredients?.ko || [])
  return Object.entries(AVOID).flatMap(([who, pattern]) => {
    const items = current.filter((item, index) => {
      const versions = [item, ...lists.map((list) => list[index] || '')]
      return versions.some((value) => pattern.test(value))
    })
    return items.length ? [{ who, items }] : []
  })
}

const UI = {
  en: {
    home: 'Home',
    explore: 'Explore',
    about: 'About',
    back: 'Back',
    headlineA: 'From K-Content',
    headlineB: 'to Real Experience',
    lead: 'Find a Seoul place that feels like the scene, or a restaurant for the food you saw.',
    searchPlaceholder: 'Try "a lively campus street from a drama"',
    place: 'Find a Place',
    placeHint: '"Somewhere with this vibe"',
    restaurant: 'Find a Restaurant',
    restaurantHint: '"What was that food?"',
    script: 'Discover Seoul\nwith STOS',
    exploreTitle: 'What would you like to explore?',
    exploreLead: 'Add a sentence, a photo, or both.',
    upload: 'Add a photo of the scene or food',
    removeImage: 'Remove photo',
    tryThese: 'Try these:',
    howTitle: 'From a scene to a visit',
    how: [
      ['Describe it', 'Write the scene or food, and add a photo when you have one.'],
      ['We find similar places', 'You get about four Seoul places with a similar feeling, not a guessed filming location.'],
      ['Go there', 'Read the food notes, then open directions.'],
    ],
    aboutTitle: 'Scene to Seoul',
    aboutBody:
      'STOS recommends a Seoul place that feels like a K-content scene, or a restaurant where you can try the food from that scene. It explains the dish, how to read the name, what people eat with it, and which ingredients may matter for vegan, halal, or Hindu diets.',
    searching: 'Finding places similar to the image...',
    picks: (count) => (count === 1 ? '1 close match' : `${count} close matches`),
    view: 'View Details',
    directions: 'Get Directions',
    saved: 'Saved',
    save: 'Save',
    with: 'Often eaten with',
    ingredients: 'What is usually in it',
    diet: 'Check before you eat',
    avoid: (items) => `Usually contains ${items}, which they do not eat.`,
    say: 'Say this',
    read: 'Read it as',
    orderRead: 'Read the order as',
    means: 'It means',
    foodTitle: 'About this food',
    similarNote: 'A similar experience, not a confirmed filming location.',
    needKey: 'The Groq key could not be loaded from Supabase. Restart the dev server.',
    empty: 'Add a sentence or a photo first.',
    failed: 'Groq could not read that yet. Try again in a moment.',
    rateLimit: 'The free search limit is full right now. Wait about a minute, then try once.',
    dailyLimit: 'Today’s free Groq search allowance is used up. It returns gradually over the day, so searching again right now shows this message.',
    notFound: 'The search did not find a reliable Seoul place for that request.',
    retry: 'Back to search',
    samePlace: 'Same place',
    similarPlace: 'Similar place',
    sameRestaurant: 'Same restaurant',
    similarRestaurant: 'Similar restaurant',
    source: 'Source',
    noPhoto: 'Photo\nunavailable',
  },
  ko: {
    home: '홈',
    explore: '탐색',
    about: '소개',
    back: '뒤로',
    headlineA: 'K-콘텐츠에서',
    headlineB: '서울의 경험으로',
    lead: '장면에 나온 곳과 비슷한 서울 장소, 또는 그 음식을 먹을 식당을 찾습니다.',
    searchPlaceholder: '예: "드라마 속 대학가 같은 곳"',
    place: '장소 찾기',
    placeHint: '"이 분위기와 비슷한 곳"',
    restaurant: '식당 찾기',
    restaurantHint: '"이 음식이 뭐야?"',
    script: 'Discover Seoul\nwith STOS',
    exploreTitle: '무엇을 찾아볼까요?',
    exploreLead: '문장, 사진, 또는 둘 다 넣을 수 있습니다.',
    upload: '장면이나 음식 사진을 넣어 주세요',
    removeImage: '사진 빼기',
    tryThese: '이렇게 물어보세요:',
    howTitle: '장면에서 방문까지',
    how: [
      ['이야기하기', '장면이나 음식을 적고, 사진이 있으면 함께 올립니다.'],
      ['비슷한 곳 찾기', '촬영지를 추측하지 않고, 느낌이 비슷한 서울 장소 4곳을 고릅니다.'],
      ['찾아가기', '음식 설명을 읽고 길 안내를 엽니다.'],
    ],
    aboutTitle: 'Scene to Seoul',
    aboutBody:
      'STOS는 드라마 장면과 비슷한 서울 장소, 또는 그 장면에 나온 음식을 먹을 수 있는 식당을 추천합니다. 음식이 무엇인지, 로마자로 어떻게 읽는지, 함께 먹는 음식, 그리고 비건·할랄·힌두 식단에 걸릴 수 있는 재료를 함께 보여 줍니다.',
    searching: '이미지와 유사한 장소 찾는 중...',
    picks: (count) => `비슷한 곳 ${count}곳`,
    view: '자세히 보기',
    directions: '길 안내',
    saved: '저장됨',
    save: '저장',
    with: '함께 자주 먹는 것',
    ingredients: '보통 들어가는 재료',
    diet: '먹으면 주의',
    avoid: (items) => `보통 ${items}이(가) 들어가서, 먹지 않는 재료입니다.`,
    say: '이렇게 주문',
    read: '이렇게 읽어요',
    orderRead: '주문은 이렇게 읽어요',
    means: '뜻',
    foodTitle: '이 음식',
    similarNote: '확인된 촬영지가 아니라 비슷한 경험입니다.',
    needKey: 'Groq 키를 Supabase에서 불러오지 못했습니다. 개발 서버를 다시 시작해 주세요.',
    empty: '문장이나 사진을 먼저 넣어 주세요.',
    failed: '지금은 Groq가 읽지 못했습니다. 잠시 후 다시 시도해 주세요.',
    rateLimit: '무료 검색 한도가 방금 찼습니다. 1분 정도 뒤에 한 번만 다시 검색해 주세요.',
    dailyLimit: '오늘 쓸 수 있는 무료 검색량을 다 썼습니다. 사용량은 하루 동안 조금씩 돌아오니, 지금 다시 누르면 이 문구가 계속 나옵니다.',
    notFound: '이 요청으로 확인할 수 있는 서울 장소를 찾지 못했습니다.',
    retry: '검색으로 돌아가기',
    samePlace: '같은 장소',
    similarPlace: '비슷한 장소',
    sameRestaurant: '같은 식당',
    similarRestaurant: '비슷한 식당',
    source: '출처',
    noPhoto: '사진을\n못 불러왔어요',
  },
  zh: {
    home: '首页',
    explore: '探索',
    about: '介绍',
    back: '返回',
    headlineA: '从 K-内容',
    headlineB: '到首尔体验',
    lead: '找到和画面感觉相近的首尔地点，或能吃到那个食物的餐厅。',
    searchPlaceholder: '例如「剧里那种热闹的大学街」',
    place: '找地点',
    placeHint: '「和这个氛围相近的地方」',
    restaurant: '找餐厅',
    restaurantHint: '「这是什么食物？」',
    script: 'Discover Seoul\nwith STOS',
    exploreTitle: '想找什么？',
    exploreLead: '可以写一句话、放一张照片，或两者都有。',
    upload: '请放入场景或食物的照片',
    removeImage: '移除照片',
    tryThese: '可以这样问：',
    howTitle: '从画面到实地',
    how: [
      ['描述一下', '写下场景或食物，有照片就一起上传。'],
      ['找出相近的地方', '不会猜拍摄地，而是选出大约 4 个感觉相近的首尔地点。'],
      ['前往那里', '先看食物说明，再打开路线。'],
    ],
    aboutTitle: 'Scene to Seoul',
    aboutBody:
      'STOS 会推荐和韩流画面感觉相近的首尔地点，或能尝到画面中食物的餐厅。它会说明这道菜是什么、韩文名怎么读、通常和什么一起吃，以及素食、清真或印度教饮食可能需要注意的食材。',
    searching: '正在寻找和图片相似的地点...',
    picks: (count) => `${count} 个相近的地方`,
    view: '查看详情',
    directions: '路线',
    saved: '已保存',
    save: '保存',
    with: '经常一起吃的',
    ingredients: '通常包含的食材',
    diet: '食用前请注意',
    avoid: (items) => `通常含有${items}，这类饮食一般不吃。`,
    say: '可以这样点',
    read: '这样读',
    orderRead: '点餐罗马字',
    means: '意思是',
    foodTitle: '这道菜',
    similarNote: '这是相近的体验，不是已确认的拍摄地。',
    needKey: '无法从 Supabase 读取 Groq 密钥。请重启开发服务器。',
    empty: '请先输入一句话或添加照片。',
    failed: 'Groq 这次没有读成功。请稍后再试。',
    rateLimit: '免费搜索额度刚用完。请过大约 1 分钟后再搜索一次。',
    dailyLimit: '今天的免费搜索额度已经用完。额度会在一天内慢慢恢复，现在反复搜索还会看到这句话。',
    notFound: '没有为这个请求找到可以确认的首尔地点。',
    retry: '返回搜索',
    samePlace: '同一地点',
    similarPlace: '相似地点',
    sameRestaurant: '同一家餐厅',
    similarRestaurant: '相似餐厅',
    source: '来源',
    noPhoto: '图片\n未能加载',
  },
  ja: {
    home: 'ホーム',
    explore: '探す',
    about: '紹介',
    back: '戻る',
    headlineA: 'Kコンテンツから',
    headlineB: 'ソウルの体験へ',
    lead: '場面に近いソウルの場所、またはその料理を食べられる店を見つけます。',
    searchPlaceholder: '例「ドラマの賑やかな大学街」',
    place: '場所を探す',
    placeHint: '「この雰囲気に近い場所」',
    restaurant: '店を探す',
    restaurantHint: '「この料理は何？」',
    script: 'Discover Seoul\nwith STOS',
    exploreTitle: '何を探しますか？',
    exploreLead: '文章、写真、または両方を入れられます。',
    upload: '場面や料理の写真を入れてください',
    removeImage: '写真を外す',
    tryThese: 'このように聞いてみてください：',
    howTitle: '場面から訪問まで',
    how: [
      ['伝えてみる', '場面や料理を書き、写真があれば一緒に入れます。'],
      ['近い場所を探す', 'ロケ地を推測せず、雰囲気の近いソウルの場所を4件選びます。'],
      ['行ってみる', '料理の説明を読んでから経路を開きます。'],
    ],
    aboutTitle: 'Scene to Seoul',
    aboutBody:
      'STOSは、韓国コンテンツの場面に近いソウルの場所、またはその料理を食べられる店をすすめます。料理の内容、韓国語の読み方、一緒に食べるもの、ビーガン・ハラール・ヒンドゥーの食事で気になる材料も示します。',
    searching: '画像に似た場所を探しています...',
    picks: (count) => `近い場所 ${count}件`,
    view: '詳しく見る',
    directions: '経路案内',
    saved: '保存済み',
    save: '保存',
    with: '一緒によく食べるもの',
    ingredients: 'ふつう入っている材料',
    diet: '食べる前に注意',
    avoid: (items) => `通常${items}が入っているので、食べない材料です。`,
    say: 'こう注文',
    read: 'こう読みます',
    orderRead: '注文はこう読みます',
    means: '意味',
    foodTitle: 'この料理',
    similarNote: '確認されたロケ地ではなく、近い体験です。',
    needKey: 'SupabaseからGroqキーを読み込めませんでした。開発サーバーを再起動してください。',
    empty: '先に文章か写真を入れてください。',
    failed: '今はGroqが読み取れませんでした。しばらくしてからもう一度試してください。',
    rateLimit: '無料検索の上限に達しました。1分ほど待ってから、もう一度だけ検索してください。',
    dailyLimit: '今日の無料検索量を使い切りました。使用量は1日かけて少しずつ戻るので、今続けて検索するとこの表示が繰り返されます。',
    notFound: 'この依頼で確認できるソウルの場所は見つかりませんでした。',
    retry: '検索に戻る',
    samePlace: '同じ場所',
    similarPlace: '似た場所',
    sameRestaurant: '同じ店',
    similarRestaurant: '似た店',
    source: '出典',
    noPhoto: '画像を\n読み込めません',
  },
}

function Brand({ onClick }) {
  return (
    <button className="brand" type="button" onClick={onClick} aria-label="STOS, Scene to Seoul">
      <img className="brand-logo" src={logo} alt="" />
    </button>
  )
}

function ModeIcon({ name }) {
  if (name === 'place') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="11" r="2" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 14c0 4 2.4 6 6 6s6-2 6-6c0-3-2-4.5-3-8-1.2 2-2 2.4-3 2.4S10.2 8 9 6c-1 3.5-3 5-3 8Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function MissingPhoto({ className, label }) {
  return (
    <span className={`${className} photo-missing`} role="img" aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 15.5l3.2-3.2 2.2 2.1 2.4-2.6 2.7 3.7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="9" cy="9.2" r="1.1" fill="currentColor" />
        <path d="M4 4.5l16 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </span>
  )
}

function PlacePhoto({ src, alt, className, fallback = '', missingLabel = '' }) {
  const [current, setCurrent] = useState(src || fallback)
  const [failed, setFailed] = useState(!src && !fallback)
  useEffect(() => {
    setCurrent(src || fallback)
    setFailed(!src && !fallback)
  }, [src, fallback])
  if (failed || !current) return <MissingPhoto className={className} label={missingLabel || alt} />
  return (
    <img
      className={className}
      src={current}
      alt={alt}
      onError={() => {
        if (fallback && current !== fallback) setCurrent(fallback)
        else setFailed(true)
      }}
    />
  )
}

function RouteMap({ places, selected, onSelect }) {
  const node = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const element = node.current
    if (!element) return undefined
    const mapped = places
      .map((place, index) => ({ place, index }))
      .filter((item) => item.place.lat)
    if (!mapped.length) return undefined
    const map = L.map(element, { zoomControl: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    const markers = mapped.map(({ place, index }) => {
      const icon = L.divIcon({
        className: 'pin-wrap',
        html: `<div class="map-num${index === selected ? ' on' : ''}">${index + 1}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      return L.marker([place.lat, place.lng], { icon })
        .on('click', () => onSelectRef.current(index))
        .addTo(map)
    })
    if (markers.length === 1) map.setView(markers[0].getLatLng(), 15)
    else map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25))
    const frame = requestAnimationFrame(() => map.invalidateSize())
    return () => {
      cancelAnimationFrame(frame)
      map.remove()
    }
  }, [places, selected])

  return <div ref={node} className="map-canvas" />
}

function FoodNotes({ food, copy, lang }) {
  if (!food) return null
  const what = textOf(food, lang, 'what')
  const eaten = listOf(food, lang, 'eaten_with')
  const ingredients = listOf(food, lang, 'ingredients')
  const warnings = dietWarnings(food, lang)
  const dish = textOf(food, lang, 'name') || food.name_ko
  const meaning = lang === 'ko' ? '' : textOf(food, lang, 'order')
  if (!dish && !what && !food.order_ko && !eaten.length && !ingredients.length) return null
  return (
    <section className="food-notes">
      <p className="food-kicker">{copy.foodTitle}</p>
      <h2>{dish}</h2>
      {food.romanization && <p className="read-as">{copy.read}: {food.romanization}</p>}
      {what && <p>{what}</p>}
      {(food.order_ko || food.order_romanization) && (
        <div className="order">
          <h3>{copy.say}</h3>
          {food.order_ko && <p className="order-ko">“{food.order_ko}”</p>}
          {food.order_romanization && <p className="order-read">{copy.orderRead}: {food.order_romanization}</p>}
          {meaning && <p className="order-mean">{copy.means}: {meaning}</p>}
        </div>
      )}
      {eaten.length > 0 && (
        <>
          <h3>{copy.with}</h3>
          <p>{eaten.join(', ')}</p>
        </>
      )}
      {ingredients.length > 0 && (
        <>
          <h3>{copy.ingredients}</h3>
          <p>{ingredients.join(', ')}</p>
        </>
      )}
      {warnings.length > 0 && (
        <>
          <h3>{copy.diet}</h3>
          <ul>
            {warnings.map((item) => (
              <li key={item.who}>
                <strong>{DIET_LABEL[lang]?.[item.who] || item.who}.</strong> {copy.avoid(item.items.join(', '))}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export default function App({ session = null, onHome = null }) {
  const [screen, setScreen] = useState(session ? 'searching' : 'home')
  const [mode, setMode] = useState(session?.mode || 'place')
  const [query, setQuery] = useState(session?.text || '')
  const [lang, setLang] = useState(session?.lang || 'en')
  const [langOpen, setLangOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [photo, setPhoto] = useState(session?.image || '')
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState(0)
  const [error, setError] = useState('')
  const copy = UI[lang]
  const places = result?.places || []
  const current = places[selected] || places[0]
  const langLabel = LANGS.find(([id]) => id === lang)?.[1] || 'EN'
  const placeName = textOf(current, lang, 'name')
  const why = textOf(current, lang, 'why')
  function badgeFor(place) {
    if (!place) return ''
    if (result?.kind === 'restaurant') {
      return place.match === 'same' ? copy.sameRestaurant : copy.similarRestaurant
    }
    return place.match === 'same' ? copy.samePlace : copy.similarPlace
  }
  const badge = badgeFor(current)

  useEffect(() => {
    function close() {
      setLangOpen(false)
      setMenuOpen(false)
    }
    window.addEventListener('scroll', close)
    return () => window.removeEventListener('scroll', close)
  }, [])

  function goHome() {
    setMenuOpen(false)
    if (onHome) {
      onHome()
      return
    }
    setScreen('home')
  }

  function openExplore(nextMode = mode) {
    setMode(nextMode)
    setQuery(EXAMPLES[lang][nextMode])
    setMenuOpen(false)
    setScreen('explore')
  }

  async function runSearch(textValue, nextMode, image = photo) {
    const chosen = nextMode || mode
    if (!textValue.trim() && !image) {
      setError('empty')
      setScreen('error')
      return
    }
    setMode(chosen)
    setQuery(textValue)
    setError('')
    setScreen('searching')
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: chosen, text: textValue, image, lang }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'groq_failed')
        setScreen('error')
        return
      }
      setResult(data)
      setSelected(0)
      setSaved(false)
      setScreen('results')
    } catch {
      setError('groq_failed')
      setScreen('error')
    }
  }

  useEffect(() => {
    if (!session) return undefined
    let active = true
    const chosen = session.mode
    const textValue = session.text
    const image = session.image
    ;(async () => {
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: chosen, text: textValue, image, lang: session.lang }),
        })
        const data = await response.json()
        if (!active) return
        if (!response.ok) {
          setError(data.error || 'groq_failed')
          setScreen('error')
          return
        }
        setResult(data)
        setSelected(0)
        setSaved(false)
        setScreen('results')
      } catch {
        if (!active) return
        setError('groq_failed')
        setScreen('error')
      }
    })()
    return () => {
      active = false
    }
  }, [session])

  function submitExplore(event) {
    event.preventDefault()
    runSearch(query.trim(), mode)
  }

  function submitHome(event) {
    event.preventDefault()
    if (!query.trim()) {
      openExplore(mode)
      return
    }
    runSearch(query.trim(), mode)
  }

  function openDirections() {
    const name = textOf(current, 'ko', 'name') || placeName
    const address = addressOf(current, 'ko')
    const destination = current?.directions || [name, address].filter(Boolean).join(' ')
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function onPhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setPhoto(await fileToDataUrl(file))
    } catch {
      setPhoto('')
    }
  }

  const modes = [
    ['place', copy.place, copy.placeHint],
    ['restaurant', copy.restaurant, copy.restaurantHint],
  ]
  const errorText = error === 'missing_key'
    ? copy.needKey
    : error === 'empty'
      ? copy.empty
      : error === 'not_found'
        ? copy.notFound
        : error === 'rate_limit'
          ? copy.rateLimit
          : error === 'daily_limit'
            ? copy.dailyLimit
            : copy.failed

  return (
    <div className={`stos app screen-${screen}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left">
            <Brand onClick={goHome} />
            {(screen === 'results' || screen === 'detail') && (
              <button className="back" type="button" onClick={() => {
                if (screen === 'detail') setScreen('results')
                else if (onHome) onHome()
                else setScreen('explore')
              }}>
                <span aria-hidden="true">‹</span> {copy.back}
              </button>
            )}
          </div>
          {screen === 'home' && (
            <nav className="main-nav">
              <button type="button" className="active" onClick={goHome}>{copy.home}</button>
              <button type="button" onClick={() => openExplore('place')}>{copy.explore}</button>
              <button type="button" onClick={() => setScreen('about')}>{copy.about}</button>
            </nav>
          )}
          <div className="topbar-right">
            <div className="menu">
              <button
                className="lang"
                type="button"
                aria-expanded={langOpen}
                onClick={() => {
                  setLangOpen((open) => !open)
                  setMenuOpen(false)
                }}
              >
                <span className="globe" aria-hidden="true" />
                {langLabel}
                <span aria-hidden="true">▾</span>
              </button>
              {langOpen && (
                <div className="dropdown">
                  {LANGS.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setQuery((current) => {
                          for (const chips of Object.values(CHIPS)) {
                            const index = chips.findIndex((chip) => chip.text === current)
                            if (index >= 0) return CHIPS[id][index].text
                          }
                          return current
                        })
                        setLang(id)
                        setLangOpen(false)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="menu home-menu">
              <button
                className="hamburger"
                type="button"
                aria-label="Menu"
                aria-expanded={menuOpen}
                onClick={() => {
                  setMenuOpen((open) => !open)
                  setLangOpen(false)
                }}
              >
                <span /><span /><span />
              </button>
              {menuOpen && (
                <div className="dropdown right">
                  <button type="button" onClick={goHome}>{copy.home}</button>
                  <button type="button" onClick={() => openExplore('place')}>{copy.explore}</button>
                  <button type="button" onClick={() => { setMenuOpen(false); setScreen('about') }}>{copy.about}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {screen === 'home' && (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <h1>
                {copy.headlineA}
                <br />
                {copy.headlineB}
                <span className="spark" aria-hidden="true">✦</span>
              </h1>
              <p className="lead">{copy.lead}</p>
              <form className="search" onSubmit={submitHome}>
                <span className="search-icon" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                  aria-label={copy.searchPlaceholder}
                />
                <button className="go" type="submit" aria-label={copy.explore}>→</button>
              </form>
              <div className="pills">
                {modes.map(([id, label, hint]) => (
                  <button key={id} type="button" onClick={() => openExplore(id)}>
                    <ModeIcon name={id} />
                    <span>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="hero-photo">
              <img src={heroPhoto} alt="남산타워와 한옥이 보이는 서울 야경" />
              <p className="script">{copy.script} ♥</p>
            </div>
          </section>
          <section className="how" id="how">
            <h2>{copy.howTitle}</h2>
            <div className="how-grid">
              {copy.how.map(([title, body], index) => (
                <article key={title}>
                  <span>{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
      )}

      {screen === 'explore' && (
        <main className="explore">
          <h1>{copy.exploreTitle}</h1>
          <p className="lead center">{copy.exploreLead}</p>
          <div className="mode-grid">
            {modes.map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                className={mode === id ? 'mode-card selected' : 'mode-card'}
                onClick={() => {
                  setMode(id)
                  setQuery(EXAMPLES[lang][id])
                }}
              >
                {mode === id && <span className="check" aria-hidden="true">✓</span>}
                <ModeIcon name={id} />
                <strong>{label}</strong>
                <small>{hint}</small>
              </button>
            ))}
          </div>
          <form className="ask" onSubmit={submitExplore}>
            <label className="image-slot">
              <input type="file" accept="image/*" onChange={onPhoto} />
              {photo ? <img src={photo} alt="" /> : <span>{copy.upload}</span>}
            </label>
            {photo && (
              <button className="remove-photo" type="button" onClick={() => setPhoto('')}>
                {copy.removeImage}
              </button>
            )}
            <div className="composer">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={copy.exploreLead}
              />
              <button className="go" type="submit" aria-label={copy.explore}>→</button>
            </div>
          </form>
          <div className="tries">
            <span>✦ {copy.tryThese}</span>
            {CHIPS[lang].map((chip) => (
              <button
                key={chip.text}
                type="button"
                onClick={() => runSearch(chip.text, chip.mode)}
              >
                {chip.text}
              </button>
            ))}
          </div>
        </main>
      )}

      {screen === 'searching' && (
        <main className="searching">
          <div className="pulse" />
          <h1>{copy.searching}</h1>
          <p>{query}</p>
        </main>
      )}

      {screen === 'error' && (
        <main className="searching">
          <h1>{errorText}</h1>
          <button type="button" className="solid" onClick={() => (onHome ? onHome() : setScreen('explore'))}>{copy.retry}</button>
        </main>
      )}

      {screen === 'results' && current && (
        <main className="results">
          <aside className="recommend">
            <FoodNotes food={result.food} copy={copy} lang={lang} />
            <h2>{copy.picks(places.length)}</h2>
            {places.map((place, index) => {
              const name = textOf(place, lang, 'name')
              const reason = textOf(place, lang, 'why')
              return (
                <button
                  key={`${place.name_ko}-${index}`}
                  type="button"
                  className={index === selected ? 'pick on' : 'pick'}
                  onClick={() => setSelected(index)}
                >
                  <PlacePhoto className="pick-photo" src={place.image} alt={name} missingLabel={copy.noPhoto} />
                  <span className="pick-copy">
                    <span className="pick-top">
                      <span className="rank">{index + 1}</span>
                      <span className="badge">{badgeFor(place)}</span>
                    </span>
                    <strong>{name}</strong>
                    <small>{addressOf(place, lang)}</small>
                    <p>{reason}</p>
                  </span>
                </button>
              )
            })}
            {current.match !== 'same' && <p className="similar">{copy.similarNote}</p>}
            {current.source_url && (
              <p className="source-link">
                {copy.source}: <a href={current.source_url} target="_blank" rel="noreferrer">{textOf(current, lang, 'source_title') || copy.source}</a>
              </p>
            )}
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setScreen('detail')}>{copy.view} ↗</button>
              <button type="button" className="solid" onClick={openDirections}>{copy.directions}</button>
            </div>
          </aside>
          {places.some((place) => place.lat) && (
            <section className="map-wrap">
              <RouteMap places={places} selected={selected} onSelect={setSelected} />
            </section>
          )}
        </main>
      )}

      {screen === 'detail' && current && (
        <main className="detail">
          <PlacePhoto className="cover" src={current.image || photo || heroPhoto} fallback={heroPhoto} alt={placeName} />
          <section className="detail-copy">
            <span className="badge">{badge}</span>
            <h1>{placeName}</h1>
            <p className="area"><span aria-hidden="true">⌖</span> {addressOf(current, lang)}</p>
            <p>{why || copy.similarNote}</p>
            <FoodNotes food={result.food} copy={copy} lang={lang} />
            <div className="detail-actions">
              <button type="button" className="solid wide" onClick={openDirections}>{copy.directions} →</button>
              <button
                type="button"
                className={saved ? 'bookmark on' : 'bookmark'}
                aria-pressed={saved}
                onClick={() => setSaved((value) => !value)}
              >
                {saved ? copy.saved : copy.save}
              </button>
            </div>
          </section>
          {current.source_url && (
            <aside className="tip">
              <div>
                <h2>{copy.source}</h2>
                <p><a href={current.source_url} target="_blank" rel="noreferrer">{textOf(current, lang, 'source_title') || copy.source}</a></p>
              </div>
            </aside>
          )}
        </main>
      )}

      {screen === 'about' && (
        <main className="about">
          <h1>{copy.aboutTitle}</h1>
          <p>{copy.aboutBody}</p>
          <button type="button" className="solid" onClick={() => openExplore('place')}>{copy.explore} →</button>
        </main>
      )}
    </div>
  )
}
