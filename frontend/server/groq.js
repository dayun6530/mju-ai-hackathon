import fs from 'node:fs'
import path from 'node:path'
import { supabasePublishableKey, supabaseUrl } from '../src/supabasePublic.js'

const VISION_MODEL = 'qwen/qwen3.8-27b'
const SEARCH_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']

let remoteKey = ''
let remoteLookup = null

function envValue(root, name) {
  const fromEnv = String(process.env[name] || '').trim()
  if (fromEnv) return fromEnv
  const file = path.join(root, '.env')
  if (!fs.existsSync(file)) return ''
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`))
    if (!match) continue
    return match[1].replace(/^["']|["']$/g, '').trim()
  }
  return ''
}

function readRemoteKey(root) {
  if (remoteKey) return Promise.resolve(remoteKey)
  if (remoteLookup) return remoteLookup
  const url = (envValue(root, 'VITE_SUPABASE_URL') || supabaseUrl).replace(/\/$/, '')
  const publishable = envValue(root, 'VITE_SUPABASE_PUBLISHABLE_KEY') || supabasePublishableKey
  if (!url || !publishable) return Promise.resolve('')
  remoteLookup = fetch(`${url}/functions/v1/groq-key`, {
    headers: {
      apikey: publishable,
      Authorization: `Bearer ${publishable}`,
    },
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}))
      const key = response.ok ? String(payload.key || '').trim() : ''
      if (key) remoteKey = key
      return key
    })
    .catch(() => '')
    .finally(() => {
      remoteLookup = null
    })
  return remoteLookup
}

async function readKey(root) {
  return envValue(root, 'GROQ_API_KEY') || readRemoteKey(root)
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString() || '{}')
}

function isFood(value) {
  return Boolean(
    value &&
    (value.order_ko || value.order_romanization || value.romanization || value.what_ko || value.what_en || value.ingredients || value.eaten_with),
  )
}

function isPlace(value) {
  return Boolean(value?.address_ko || value?.address_en || value?.why_ko || value?.why_en || value?.source_url)
}

function extractJson(text) {
  const source = String(text || '')
  let found = null
  let food = null
  const places = []
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== '{') continue
    const parsed = readObject(source, i)
    if (!parsed) continue
    if (Array.isArray(parsed.value?.places)) {
      found = parsed.value
      if (isFood(parsed.value.food)) food = parsed.value.food
    } else if (isFood(parsed.value) && !isPlace(parsed.value)) food = parsed.value
    else if (isPlace(parsed.value)) places.push(parsed.value)
    i = parsed.end
  }
  if (found?.places?.length) return { ...found, food: food || found.food || null }
  if (places.length) return { found: true, food: food || found?.food || null, places }
  if (found) return { ...found, food: food || found.food || null }
  throw new Error('The search did not return a place.')
}

function readObject(source, start) {
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < source.length; i += 1) {
    const char = source[i]
    if (inString) {
      if (escape) escape = false
      else if (char === '\\') escape = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          return { value: JSON.parse(source.slice(start, i + 1)), end: i }
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function messageText(message) {
  const content = message?.content
  if (typeof content === 'string' && content.trim()) return content
  if (Array.isArray(content)) {
    const text = content.map((part) => part?.text || '').join('\n').trim()
    if (text) return text
  }
  return typeof message?.reasoning === 'string' ? message.reasoning : ''
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseDuration(value) {
  const text = String(value || '')
  const minutes = text.match(/(\d+(?:\.\d+)?)m/)
  const seconds = text.match(/(\d+(?:\.\d+)?)s/)
  return (minutes ? Number(minutes[1]) * 60000 : 0) + (seconds ? Number(seconds[1]) * 1000 : 0)
}

function waitFromMessage(message) {
  const match = String(message || '').match(/try again in (?:(\d+(?:\.\d+)?)m)?(\d+(?:\.\d+)?)s/i)
  if (!match) return 0
  return (match[1] ? Number(match[1]) * 60000 : 0) + Number(match[2]) * 1000
}

function retryDelay(response, payload) {
  const header = Number(response.headers.get('retry-after'))
  const fromHeader = Number.isFinite(header) && header > 0 ? header * 1000 : 0
  const fromReset = parseDuration(response.headers.get('x-ratelimit-reset-tokens'))
  const fromMessage = waitFromMessage(payload?.error?.message)
  return Math.max(fromHeader, fromReset, fromMessage, 5000) + 800
}

async function groq(key, body) {
  const models = body.tools ? SEARCH_MODELS : [body.model]
  const started = Date.now()
  let lastError = 'Groq request failed'
  let modelIndex = Math.max(0, models.indexOf(body.model))
  while (Date.now() - started < 130000) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, model: models[modelIndex] }),
    })
    const payload = await response.json().catch(() => ({}))
    if (response.status === 429) {
      lastError = payload?.error?.message || lastError
      const daily = /per day/i.test(lastError)
      const delay = retryDelay(response, payload)
      if ((daily || delay > 90000) && modelIndex < models.length - 1) {
        modelIndex += 1
        continue
      }
      if (Date.now() + delay - started > 135000) break
      await wait(delay)
      continue
    }
    if (!response.ok) {
      const error = new Error(payload?.error?.message || 'Groq request failed')
      error.rateLimit = false
      throw error
    }
    return messageText(payload.choices?.[0]?.message)
  }
  const error = new Error(lastError)
  error.rateLimit = true
  error.daily = /per day/i.test(lastError)
  throw error
}

async function describeImage(key, image) {
  return groq(key, {
    model: VISION_MODEL,
    temperature: 0.2,
    max_completion_tokens: 400,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe this image for a Seoul place search. Mention visible food, street, building, sign text, and atmosphere. Do not invent a restaurant name or address. Keep it under 80 words.',
          },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ],
  })
}

async function searchSeoul(key, { kind, text, imageNotes }) {
  const content = await groq(key, {
    model: SEARCH_MODELS[0],
    temperature: 0.2,
    max_completion_tokens: 1800,
    reasoning_effort: 'low',
    tool_choice: 'required',
    tools: [{ type: 'browser_search' }],
    messages: [
      {
        role: 'system',
        content: 'You search the live web for real places in Seoul. Use only places and addresses you find in search results. Never invent an address. When a source explicitly names where a drama, movie, variety show, or webtoon was filmed, that place is a confirmed filming location and must be marked match "same".',
      },
      {
        role: 'user',
        content: [
          `Mode: ${kind === 'restaurant' ? 'find a restaurant' : 'find a place'}`,
          `Visitor request: ${text || '(no text)'}`,
          `Photo notes: ${imageNotes || '(no photo)'}`,
          'If the request names a drama, movie, variety show, or webtoon, search that exact title with "촬영지" and "filming location" before looking for similar places. Published filming locations are common, so do not skip them.',
          'A place is match "same" when a source names both the title and that place. Put every confirmed place first. Use match "similar" only for places the source does not confirm. Never replace a confirmed filming location with a similar one.',
          'Return 4 different real Seoul places in the places array, best match first. Do not stop after one place.',
          'When the visitor shows a dish or a food photo, recommend different shops that serve it. At most one branch of any chain. Do not fill the list with one franchise such as several Sinjeon Tteokbokki stores.',
          'Write every visitor-facing string in all four languages: ko Korean, en English, zh Simplified Chinese, ja Japanese. Do not leave a language blank and do not copy Korean into the English, Chinese, or Japanese fields.',
          'Each why is one sentence under 16 words. address_ko is the Korean address from the source, and address_en, address_zh, address_ja translate that same address. Do not invent a place to fill the list.',
          kind === 'restaurant'
            ? 'Restaurant mode: food is required and must not be null. Write food before the places array. ingredients.ko, ingredients.en, ingredients.zh, and ingredients.ja must each contain at least 4 usual ingredients. order_ko is one spoken Korean sentence. order_romanization is that sentence in roman letters only, such as "tteokbokki hana juseyo." Do not leave order_ko, order_romanization, or ingredients empty.'
            : 'Set food to null.',
          'After searching, end your reply with one JSON object and no markdown:',
          kind === 'restaurant'
            ? '{"found":true,"food":{"name_ko":"","name_en":"","name_zh":"","name_ja":"","romanization":"","what_ko":"","what_en":"","what_zh":"","what_ja":"","eaten_with":{"ko":[],"en":[],"zh":[],"ja":[]},"ingredients":{"ko":[],"en":[],"zh":[],"ja":[]},"order_ko":"","order_romanization":"","order_en":"","order_zh":"","order_ja":"","diet":[]},"places":[{"match":"similar","name_ko":"","name_en":"","name_zh":"","name_ja":"","address_ko":"","address_en":"","address_zh":"","address_ja":"","source_title_ko":"","source_title_en":"","source_title_zh":"","source_title_ja":"","source_url":"","why_ko":"","why_en":"","why_zh":"","why_ja":""}]}'
            : '{"found":true,"food":null,"places":[{"match":"similar","name_ko":"","name_en":"","name_zh":"","name_ja":"","address_ko":"","address_en":"","address_zh":"","address_ja":"","source_title_ko":"","source_title_en":"","source_title_zh":"","source_title_ja":"","source_url":"","why_ko":"","why_en":"","why_zh":"","why_ja":""}]}',
          'If search does not support a real Seoul place, return {"found":false,"places":[]}.',
        ].join('\n'),
      },
    ],
  })
  return extractJson(content)
}

function extractLoose(text) {
  const source = String(text || '')
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== '{') continue
    const parsed = readObject(source, i)
    if (!parsed?.value || typeof parsed.value !== 'object') continue
    const value = parsed.value.food && typeof parsed.value.food === 'object' ? parsed.value.food : parsed.value
    if (value.order_ko || value.name_ko || value.ingredients) return value
    i = parsed.end
  }
  return null
}

async function describeDish(key, hint) {
  let lastError = null
  for (const model of [SEARCH_MODELS[1], SEARCH_MODELS[0]]) {
    try {
      const content = await groq(key, {
        model,
        temperature: 0.2,
        max_completion_tokens: 900,
        messages: [
      {
        role: 'system',
        content: 'You explain one Korean dish for a visitor in Seoul. Return only one JSON object.',
      },
      {
        role: 'user',
        content: [
          `The visitor asked: ${hint || 'a Korean dish from a scene'}`,
          'Explain the dish they want. If the places mostly serve one food, explain that food.',
          'Fill every field. Do not leave order_ko, order_romanization, ingredients, or eaten_with empty.',
          'what_ko, what_en, what_zh, and what_ja are each one full sentence about the dish, not only its name.',
          'romanization is Revised Romanization of the Korean dish name.',
          'order_ko is one short sentence the visitor says, such as "김치찌개 하나 주세요."',
          'order_romanization is that same sentence in roman letters, such as "gimchi-jjigae hana juseyo."',
          'order_en, order_zh, and order_ja translate that sentence.',
          'ingredients are the usual items cooked into the dish. eaten_with is what is served beside it.',
          'diet who is only Vegan, Halal, or Hindu. Always include Vegan. If pork, beef, or fish sauce is usual, also include Halal and Hindu. Each note says "often includes".',
          '{"name_ko":"","name_en":"","name_zh":"","name_ja":"","romanization":"","what_ko":"","what_en":"","what_zh":"","what_ja":"","eaten_with":{"ko":[""],"en":[""],"zh":[""],"ja":[""]},"ingredients":{"ko":[""],"en":[""],"zh":[""],"ja":[""]},"order_ko":"","order_romanization":"","order_en":"","order_zh":"","order_ja":"","diet":[{"who":"Vegan","note_ko":"","note_en":"","note_zh":"","note_ja":""}]}',
        ].join('\n'),
      },
    ],
      })
      const food = normalizeFood(extractLoose(content))
      if (food?.order_ko && food?.order_romanization && food.ingredients?.ko?.length) return food
      if (food) lastError = food
    } catch (error) {
      lastError = error
    }
  }
  if (lastError?.order_ko || lastError?.name_ko) return lastError
  if (lastError) throw lastError
  return null
}

const WIKI_HEADERS = {
  'User-Agent': 'STOS-hackathon/1.0 (school project)',
  Accept: 'application/json',
}

function usablePhoto(url) {
  if (!url || !/^https?:\/\//i.test(url)) return ''
  if (/\.svg(\?|$)/i.test(url)) return ''
  if (/portrait|headshot|profile|mugshot|actor|actress|인물|얼굴/i.test(url)) return ''
  return url
}

function nameTokens(names) {
  return [...new Set(names.flatMap((name) => String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !/^(서울|seoul|the|and|of|맛집|식당|카페|분식|음식점)$/u.test(word))))]
}

function titleScore(title, names) {
  const page = String(title || '').toLowerCase().replace(/_/g, ' ')
  if (!page) return 0
  let best = 0
  for (const name of names) {
    const words = nameTokens([name])
    const hits = words.filter((word) => page.includes(word))
    if (hits.length) {
      const exact = page === String(name || '').toLowerCase() ? 1 : 0
      best = Math.max(best, hits.join('').length / words.join('').length + exact)
    }
    const pageWord = nameTokens([page])
    const generic = /^(서울|한국|대한민국|음식|요리|seoul|korea)$/u
    if (pageWord.length === 1 && pageWord[0].length >= 2 && String(name || '').toLowerCase().includes(pageWord[0]) && !generic.test(pageWord[0])) {
      best = Math.max(best, 0.5)
    }
  }
  return best
}

function isPersonPage(title, categories) {
  const text = `${title} ${(categories || []).join(' ')}`
  return /인물|출생|사망|배우|가수|정치인|작가|기업인|교수|운동선수|people|births|deaths|actors|actresses|singers|writers|politicians/i.test(text)
}

function readSize(bytes) {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes.length >= 10) {
    return { width: bytes[6] + bytes[7] * 256, height: bytes[8] + bytes[9] * 256 }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let index = 2
    while (index + 9 < bytes.length) {
      if (bytes[index] !== 0xff) {
        index += 1
        continue
      }
      const marker = bytes[index + 1]
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return {
          height: bytes[index + 5] * 256 + bytes[index + 6],
          width: bytes[index + 7] * 256 + bytes[index + 8],
        }
      }
      const size = bytes[index + 2] * 256 + bytes[index + 3]
      if (size < 2) break
      index += 2 + size
    }
  }
  return null
}

function wideEnough(size) {
  return Boolean(size?.width && size?.height && size.width >= size.height * 0.92)
}

async function imageSize(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Range: 'bytes=0-65535',
        'User-Agent': 'STOS-hackathon/1.0 (school project)',
        Accept: 'image/*',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok && response.status !== 206) return null
    return readSize(new Uint8Array(await response.arrayBuffer()))
  } catch {
    return null
  }
}

let lastWikiAt = 0
const wikiCache = new Map()

async function wikiPhoto(host, names, attempt = 0) {
  const query = names.find(Boolean)
  if (!query) return ''
  const cacheKey = `${host}|${query}`
  if (wikiCache.has(cacheKey)) return wikiCache.get(cacheKey)
  const gap = 700 - (Date.now() - lastWikiAt)
  if (gap > 0) await wait(gap)
  lastWikiAt = Date.now()
  try {
    const url = new URL(`https://${host}/w/api.php`)
    url.searchParams.set('action', 'query')
    url.searchParams.set('format', 'json')
    url.searchParams.set('generator', 'search')
    url.searchParams.set('gsrsearch', query)
    url.searchParams.set('gsrlimit', '5')
    url.searchParams.set('gsrnamespace', '0')
    url.searchParams.set('prop', 'pageimages|categories')
    url.searchParams.set('piprop', 'thumbnail')
    url.searchParams.set('pithumbsize', '480')
    url.searchParams.set('cllimit', '20')
    url.searchParams.set('clshow', '!hidden')
    const response = await fetch(url, {
      headers: WIKI_HEADERS,
      signal: AbortSignal.timeout(5000),
    })
    if (response.status === 429 && attempt < 1) {
      await wait(2000)
      return wikiPhoto(host, names, attempt + 1)
    }
    if (!response.ok) {
      wikiCache.set(cacheKey, '')
      return ''
    }
    const data = await response.json()
    const chosen = Object.values(data.query?.pages || {})
      .map((page) => ({
        title: page.title || '',
        thumb: page.thumbnail,
        categories: (page.categories || []).map((item) => item.title),
        score: titleScore(page.title, names),
      }))
      .filter((page) => page.score >= 0.45 && page.thumb?.source)
      .filter((page) => !isPersonPage(page.title, page.categories))
      .filter((page) => wideEnough(page.thumb))
      .sort((a, b) => b.score - a.score)
    const photo = usablePhoto(chosen[0]?.thumb?.source || '')
    wikiCache.set(cacheKey, photo)
    return photo
  } catch {
    return ''
  }
}

async function sourceImage(pageUrl) {
  if (!/^https?:\/\//i.test(pageUrl)) return ''
  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    })
    if (!response.ok) return ''
    const type = response.headers.get('content-type') || ''
    if (type.startsWith('image/')) return usablePhoto(response.url)
    const html = (await response.text()).slice(0, 180000)
    const patterns = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ]
    for (const pattern of patterns) {
      const found = usablePhoto(html.match(pattern)?.[1] || '')
      if (found) return found
    }
  } catch {
    return ''
  }
  return ''
}

function shorterName(name) {
  return String(name || '')
    .replace(/\s*(본점|지점|\d+호점|점|센터|center|branch|store)$/i, '')
    .replace(/\s+(노량진|왕십리|이태원|신당|홍대|강남|명동|건대|신촌|noryangjin|wangsimni|itaewon|sindang|hongdae|gangnam|myeongdong).*$/i, '')
    .trim()
}

function photoQueries(names) {
  return [...new Set(names.flatMap((name) => [shorterName(name), name]).filter(Boolean))].slice(0, 3)
}

async function isPersonImage(url) {
  if (!url) return true
  if (/portrait|headshot|profile|mugshot|actor|actress|인물|얼굴/i.test(url)) return true
  const size = await imageSize(url)
  if (!size) return false
  return size.height > size.width * 1.05
}

function wikiHost(query) {
  return /[가-힣]/.test(query) ? 'ko.wikipedia.org' : 'en.wikipedia.org'
}

const FOOD_WORD = /^(떡볶이|tteokbokki|치킨|chicken|칼국수|분식|김밥|라면|국수|고기|찌개|국밥|냉면|비빔밥|삼겹살|순대|튀김|만두|카페|식당|음식점|맛집)$/u

function distinctiveTokens(names) {
  return nameTokens(names).filter((word) => !FOOD_WORD.test(word))
}

function matchesPlace(title, names) {
  const tokens = distinctiveTokens(names)
  const page = String(title || '').toLowerCase().replace(/[_\-.]/g, ' ')
  if (tokens.length) return tokens.some((word) => page.includes(word))
  return titleScore(title, names) >= 0.8
}

async function wikiRequest(host, params) {
  const gap = 700 - (Date.now() - lastWikiAt)
  if (gap > 0) await wait(gap)
  lastWikiAt = Date.now()
  const url = new URL(`https://${host}/w/api.php`)
  url.searchParams.set('action', 'query')
  url.searchParams.set('format', 'json')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  let response = await fetch(url, {
    headers: WIKI_HEADERS,
    signal: AbortSignal.timeout(6000),
  })
  if (response.status === 429) {
    await wait(2500)
    response = await fetch(url, {
      headers: WIKI_HEADERS,
      signal: AbortSignal.timeout(6000),
    })
  }
  if (!response.ok) return null
  return response.json()
}

function imageFileUrl(page) {
  const info = page?.imageinfo?.[0]
  const mime = String(info?.mime || '')
  if (mime && !/^image\/(jpeg|png|webp)$/i.test(mime)) return ''
  return usablePhoto(info?.thumburl || info?.url || '')
}

async function commonsCandidates(query, names) {
  const data = await wikiRequest('commons.wikimedia.org', {
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '640',
  })
  return Object.values(data?.query?.pages || {})
    .map((page) => ({ title: page.title || '', url: imageFileUrl(page) }))
    .filter((page) => page.url && matchesPlace(page.title, names) && !isPersonPage(page.title, []))
    .filter((page) => !/map|locator|diagram|logo|icon|flag|지도|문장|깃발/i.test(page.title))
    .map((page) => page.url)
}

async function nearbyCandidates(lat, lng, names) {
  if (!lat || !lng) return []
  const data = await wikiRequest('commons.wikimedia.org', {
    generator: 'geosearch',
    ggscoord: `${lat}|${lng}`,
    ggsradius: '180',
    ggslimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '640',
  })
  const pages = Object.values(data?.query?.pages || {})
    .map((page) => ({ title: page.title || '', url: imageFileUrl(page) }))
    .filter((page) => page.url && !isPersonPage(page.title, []))
    .filter((page) => !/map|locator|diagram|logo|icon|flag|지도|문장|깃발/i.test(page.title))
  const named = pages.filter((page) => matchesPlace(page.title, names)).map((page) => page.url)
  const nearby = pages.filter((page) => !matchesPlace(page.title, names)).map((page) => page.url)
  return [...named, ...nearby]
}

async function wikiPlaceCandidates(host, query, names) {
  const data = await wikiRequest(host, {
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '5',
    gsrnamespace: '0',
    prop: 'pageimages|categories',
    piprop: 'thumbnail',
    pithumbsize: '640',
    cllimit: '20',
    clshow: '!hidden',
  })
  return Object.values(data?.query?.pages || {})
    .filter((page) => {
      const categories = (page.categories || []).map((item) => item.title)
      return matchesPlace(page.title, names) && !isPersonPage(page.title, categories)
    })
    .map((page) => usablePhoto(page.thumbnail?.source || ''))
    .filter(Boolean)
}

export const articleCache = new Map()

function pushPhoto(found, pageUrl, value) {
  const raw = String(value || '').trim()
  if (!raw) return
  let url = ''
  try {
    url = usablePhoto(new URL(raw, pageUrl).href)
  } catch {
    url = ''
  }
  if (!url || genericSiteImage(url) || found.includes(url)) return
  if (/\b(logo|icon|sprite|emoji|avatar|profile|banner|button|btn)\b/i.test(url)) return
  if (/(\/|_)(1x1|pixel|blank|spacer)/i.test(url)) return
  found.push(url)
}

async function articleImages(pageUrl) {
  if (!/^https?:\/\//i.test(pageUrl || '')) return []
  if (articleCache.has(pageUrl)) return articleCache.get(pageUrl)
  const found = []
  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    })
    if (response.ok) {
      const html = (await response.text()).slice(0, 220000)
      const og = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i)
      if (og) pushPhoto(found, response.url, og[1])
      for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
        const width = Number(tag.match(/\bwidth=["']?(\d+)/i)?.[1] || 0)
        if (width && width < 180) continue
        const src = tag.match(/\b(?:data-src|data-lazy-src|data-original|src)=["']([^"']+)["']/i)?.[1]
        pushPhoto(found, response.url, src)
      }
    }
  } catch {
    found.length = 0
  }
  const images = found.slice(0, 8)
  articleCache.set(pageUrl, images)
  return images
}

function firstFresh(urls, used) {
  return urls.find((url) => url && !used.has(url) && !genericSiteImage(url)) || ''
}

function brandPrefix(name) {
  const compact = String(name || '').replace(/\s/g, '')
  const cut = compact.split(/떡볶기|떡볶이|치킨|분식|카페|국수|김밥|냉면|국밥|찌개/)[0]
  return (cut || compact).slice(0, 8)
}

function naverQueries(name) {
  const compact = String(name || '').replace(/\s/g, '')
  const split = compact.match(/^(.*?)(떡볶기|떡볶이|치킨|분식|카페|국수|김밥|냉면|국밥|찌개)/)
  const spaced = split?.[1] && split[2] ? `${split[1]} ${split[2]}` : ''
  return [...new Set([compact, spaced].filter((query) => query.length >= 2))]
}

function addressHints(address) {
  return String(address || '').match(/[가-힣]{2,}(?:로|길|대로)\d*(?:번길)?/g) || []
}

const NAVER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://map.naver.com/',
}
const SEOUL_COORDS = '37.5665,126.9780'

async function naverRows(query, coords) {
  const url = new URL('https://map.naver.com/p/api/search/instant-search')
  url.searchParams.set('query', query)
  url.searchParams.set('coords', coords)
  const response = await fetch(url, { headers: NAVER_HEADERS, signal: AbortSignal.timeout(5000) })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data.place) ? data.place : []
}

function naverScore(row, prefix, hints) {
  const title = String(row.title || '').replace(/\s/g, '')
  if (!row.id || prefix.length < 2 || !title.includes(prefix)) return 0
  const blob = `${row.title || ''} ${row.roadAddress || ''} ${row.jibunAddress || ''}`.replace(/\s/g, '')
  let score = 1
  for (const hint of hints) {
    if (blob.includes(hint.replace(/\s/g, ''))) score += 5
  }
  const dist = Number(row.dist)
  if (Number.isFinite(dist)) score += Math.max(0, 2 - dist / 4)
  return score
}

async function naverPlacePhoto(place) {
  const name = place.name_ko || place.name_en
  if (!name) return ''
  const coords = place.lat && place.lng ? `${place.lat},${place.lng}` : SEOUL_COORDS
  const prefix = brandPrefix(name)
  const hints = addressHints(place.address_ko)
  try {
    const rows = []
    for (const query of naverQueries(name)) {
      rows.push(...await naverRows(query, coords))
    }
    let best = null
    let bestScore = 0
    const seen = new Set()
    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      const score = naverScore(row, prefix, hints)
      if (score > bestScore) {
        best = row
        bestScore = score
      }
    }
    if (!best?.id) return ''
    const summary = await fetch(`https://map.naver.com/p/api/place/summary/${best.id}`, {
      headers: NAVER_HEADERS,
      signal: AbortSignal.timeout(5000),
    })
    if (!summary.ok) return ''
    const body = await summary.json()
    const images = body?.data?.placeDetail?.images?.images || []
    return usablePhoto(images[0]?.origin || images[0]?.originalUrl || '')
  } catch {
    return ''
  }
}

export async function placePhoto(place, used = new Set()) {
  const naver = await naverPlacePhoto(place)
  if (naver && !used.has(naver)) return naver
  const names = [place.name_ko, place.name_en].filter(Boolean)
  for (const query of photoQueries(names).slice(0, 1)) {
    const named = firstFresh(await wikiPlaceCandidates(wikiHost(query), query, names), used)
    if (named) return named
  }
  const fromArticle = firstFresh(await articleImages(place.source_url), used)
  if (fromArticle) return fromArticle
  return firstFresh(await nearbyCandidates(place.lat, place.lng, names), used)
}

function genericSiteImage(url) {
  return /og-default|og_default|default\.(png|jpe?g|webp)|logo|banner|sns_|share\.|placeholder|favicon|sprite|icon-|opengraph/i.test(url)
}

async function dishPhoto(food) {
  const names = [food?.name_ko, food?.name_en].filter(Boolean)
  if (!names.length) return ''
  return wikiPhoto('ko.wikipedia.org', names) || wikiPhoto('en.wikipedia.org', names)
}

async function geocode(query, language) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '5')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'kr')
  url.searchParams.set('q', query)
  let response = await fetch(url, {
    headers: {
      'User-Agent': 'STOS-hackathon/1.0 (school project)',
      'Accept-Language': language,
    },
  })
  if (response.status === 429 || response.status === 503) {
    await wait(1500)
    response = await fetch(url, {
      headers: {
        'User-Agent': 'STOS-hackathon/1.0 (school project)',
        'Accept-Language': language,
      },
    })
  }
  if (!response.ok) return []
  const rows = await response.json()
  return Array.isArray(rows) ? rows : []
}

function roadToken(address) {
  return String(address || '').match(/[가-힣A-Za-z0-9]+(?:로|길|대로)\d*(?:번길)?/)?.[0] || ''
}

function houseNumber(address) {
  return String(address || '').match(/(\d+(?:-\d+)?)/)?.[1] || ''
}

function looksLikeStreet(address) {
  return /[가-힣]{2,}(?:로|길|대로)/.test(address) && /\d/.test(address)
}

function locateScore(row, name, address) {
  const display = `${row.display_name || ''} ${row.name || ''}`.toLowerCase().replace(/\s/g, '')
  const tokens = nameTokens([name]).filter((word) => word.length >= 2 && !/^(떡볶이|치킨|카페|식당|서울)$/u.test(word))
  let score = 0
  if (tokens.some((word) => display.includes(word.toLowerCase().replace(/\s/g, '')))) score += 3
  const road = roadToken(address).replace(/\s/g, '')
  if (road && display.includes(road.toLowerCase())) score += 2
  const house = houseNumber(address)
  const foundHouse = String(row.address?.house_number || '')
  if (house && foundHouse && (foundHouse === house || foundHouse.startsWith(`${house}-`) || house.startsWith(foundHouse))) score += 2
  return score
}

async function locatePlace(name, address) {
  const nameQuery = [name, '서울'].filter(Boolean).join(' ')
  let rows = nameQuery.trim() ? await geocode(nameQuery, 'ko') : []
  await wait(1100)
  if (looksLikeStreet(address)) {
    rows = rows.concat(await geocode(address, 'ko'))
    await wait(1100)
  }
  let best = null
  let bestScore = 0
  for (const row of rows) {
    const score = locateScore(row, name, address)
    if (score > bestScore) {
      best = row
      bestScore = score
    }
  }
  if (!best || bestScore < 2) return { lat: null, lng: null, display: '' }
  return {
    lat: Number(best.lat),
    lng: Number(best.lon),
    display: String(best.display_name || ''),
  }
}

function brandKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/본점|지점|분점|\d+호점|점|센터|center|branch|store|main/g, '')
    .replace(/노량진|왕십리|이태원|신당|홍대|강남|명동|건대|신촌|종로|잠실|서울|noryangjin|wangsimni|itaewon|sindang|hongdae|gangnam|myeongdong|sinchon|jamsil/g, '')
    .replace(/[^a-z0-9가-힣]/g, '')
}

async function reverseGeocode(lat, lng, language) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('zoom', '18')
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'STOS-hackathon/1.0 (school project)',
        'Accept-Language': language,
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return ''
    const data = await response.json()
    return String(data.display_name || '')
  } catch {
    return ''
  }
}

function textField(raw, key, lang) {
  const nested = raw?.[key]
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return String(nested[lang] || '').trim()
  return String(raw?.[`${key}_${lang}`] || '').trim()
}

function asList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(/[,、，]/).map((item) => item.trim()).filter(Boolean)
  return []
}

function localizedList(source, key, lang) {
  const value = source?.[key]
  const direct = asList(source?.[`${key}_${lang}`])
  if (Array.isArray(value) || typeof value === 'string') return direct.length ? direct : (lang === 'ko' ? asList(value) : [])
  if (value && typeof value === 'object') {
    const nested = asList(value[lang])
    if (nested.length) return nested
  }
  return direct
}

function normalizeFood(raw) {
  if (!raw || typeof raw !== 'object') return null
  const source = raw.food && typeof raw.food === 'object' ? raw.food : raw
  const dishLike = source.order_ko || source.order_romanization || source.romanization || source.what_ko || source.what_en || source.ingredients || source.eaten_with
  if (!dishLike) return null
  const diet = Array.isArray(source.diet) ? source.diet : []
  const food = {
    name_ko: textField(source, 'name', 'ko'),
    name_en: textField(source, 'name', 'en'),
    name_zh: textField(source, 'name', 'zh'),
    name_ja: textField(source, 'name', 'ja'),
    romanization: String(source.romanization || source.name_romanization || '').trim(),
    what_ko: textField(source, 'what', 'ko'),
    what_en: textField(source, 'what', 'en'),
    what_zh: textField(source, 'what', 'zh'),
    what_ja: textField(source, 'what', 'ja'),
    eaten_with: {
      ko: localizedList(source, 'eaten_with', 'ko'),
      en: localizedList(source, 'eaten_with', 'en'),
      zh: localizedList(source, 'eaten_with', 'zh'),
      ja: localizedList(source, 'eaten_with', 'ja'),
    },
    ingredients: {
      ko: localizedList(source, 'ingredients', 'ko'),
      en: localizedList(source, 'ingredients', 'en'),
      zh: localizedList(source, 'ingredients', 'zh'),
      ja: localizedList(source, 'ingredients', 'ja'),
    },
    order_ko: String(source.order_ko || '').trim(),
    order_romanization: String(source.order_romanization || '').trim(),
    order_en: textField(source, 'order', 'en'),
    order_zh: textField(source, 'order', 'zh'),
    order_ja: textField(source, 'order', 'ja'),
    diet: diet
      .map((item) => ({
        who: String(item?.who || '').trim(),
        note_ko: textField(item, 'note', 'ko'),
        note_en: textField(item, 'note', 'en'),
        note_zh: textField(item, 'note', 'zh'),
        note_ja: textField(item, 'note', 'ja'),
      }))
      .filter((item) => item.who && (item.note_ko || item.note_en || item.note_zh || item.note_ja)),
  }
  const hasContent = food.name_ko || food.name_en || food.what_ko || food.what_en || food.order_ko || food.ingredients.ko.length || food.eaten_with.ko.length
  return hasContent ? food : null
}

const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
const JONG = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'p', 'l', 'l', 'p', 'l', 'h', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 'h']

function romanizeHangul(text) {
  let out = ''
  for (const char of String(text || '')) {
    const code = char.codePointAt(0)
    if (code < 0xac00 || code > 0xd7a3) {
      out += char
      continue
    }
    const syllable = code - 0xac00
    out += CHO[Math.floor(syllable / 588)] + JUNG[Math.floor((syllable % 588) / 28)] + JONG[syllable % 28]
  }
  return out.replace(/[ ]+/g, ' ').trim()
}

function dish(fields) {
  return fields
}

const DISH_GUIDES = [
  dish({
    keys: ['김치찌개', 'kimchi stew', 'kimchi jjigae', 'kimchi-jjigae'],
    name_ko: '김치찌개', name_en: 'Kimchi Stew', name_zh: '泡菜汤', name_ja: 'キムチチゲ',
    romanization: 'gimchi-jjigae',
    what_ko: '잘 익은 김치와 돼지고기를 끓여 내는 매콤한 찌개입니다.',
    what_en: 'A spicy stew simmered with aged kimchi and pork.',
    what_zh: '用熟泡菜和猪肉熬成的辣汤。',
    what_ja: 'よく漬かったキムチと豚肉を煮込んだ辛いチゲです。',
    eaten_with: { ko: ['밥', '계란후라이'], en: ['rice', 'fried egg'], zh: ['米饭', '煎蛋'], ja: ['ご飯', '目玉焼き'] },
    ingredients: { ko: ['김치', '돼지고기', '두부', '대파', '마늘', '고춧가루'], en: ['kimchi', 'pork', 'tofu', 'green onion', 'garlic', 'chili powder'], zh: ['泡菜', '猪肉', '豆腐', '葱', '蒜', '辣椒粉'], ja: ['キムチ', '豚肉', '豆腐', 'ねぎ', 'にんにく', '唐辛子粉'] },
    order_ko: '김치찌개 하나 주세요.',
    order_romanization: 'gimchi-jjigae hana juseyo.',
    order_en: 'One kimchi stew, please.', order_zh: '泡菜汤请来一份。', order_ja: 'キムチチゲを一つください。',
    diet: [
      { who: 'Vegan', note_ko: '보통 돼지고기와 육수가 들어갑니다.', note_en: 'It often includes pork and meat broth.', note_zh: '通常含有猪肉和高汤。', note_ja: '通常豚肉と出汁が入ります。' },
      { who: 'Halal', note_ko: '보통 돼지고기가 들어갑니다.', note_en: 'It often includes pork.', note_zh: '通常含有猪肉。', note_ja: '通常豚肉が入ります。' },
      { who: 'Hindu', note_ko: '보통 돼지고기가 들어갑니다.', note_en: 'It often includes pork.', note_zh: '通常含有猪肉。', note_ja: '通常豚肉が入ります。' },
    ],
  }),
  dish({
    keys: ['떡볶이', 'tteokbokki', 'topokki', 'ddukbokki'],
    name_ko: '떡볶이', name_en: 'Tteokbokki', name_zh: '炒年糕', name_ja: 'トッポッキ',
    romanization: 'tteokbokki',
    what_ko: '떡을 고추장 양념에 졸인 매콤달콤한 분식입니다.',
    what_en: 'Rice cakes simmered in a sweet and spicy gochujang sauce.',
    what_zh: '用辣椒酱把年糕煮到甜辣的小吃。',
    what_ja: 'コチュジャンだれで煮た甘辛い餅の屋台料理です。',
    eaten_with: { ko: ['순대', '튀김', '김밥'], en: ['sundae', 'fried vegetables', 'gimbap'], zh: ['米肠', '油炸蔬菜', '紫菜包饭'], ja: ['スンデ', 'かき揚げ', 'キンパ'] },
    ingredients: { ko: ['떡', '어묵', '고추장', '고춧가루', '설탕', '대파'], en: ['rice cakes', 'fish cake', 'gochujang', 'chili powder', 'sugar', 'green onion'], zh: ['年糕', '鱼饼', '辣椒酱', '辣椒粉', '糖', '葱'], ja: ['餅', 'さつま揚げ', 'コチュジャン', '唐辛子粉', '砂糖', 'ねぎ'] },
    order_ko: '떡볶이 하나 주세요.',
    order_romanization: 'tteokbokki hana juseyo.',
    order_en: 'One tteokbokki, please.', order_zh: '炒年糕请来一份。', order_ja: 'トッポッキを一つください。',
    diet: [
      { who: 'Vegan', note_ko: '보통 어묵과 멸치 육수가 들어갑니다.', note_en: 'It often includes fish cake and anchovy broth.', note_zh: '通常含有鱼饼和鳀鱼高汤。', note_ja: '通常さつま揚げといわし出汁が入ります。' },
      { who: 'Halal', note_ko: '보통 어묵이 들어갑니다.', note_en: 'It often includes fish cake.', note_zh: '通常含有鱼饼。', note_ja: '通常さつま揚げが入ります。' },
      { who: 'Hindu', note_ko: '보통 어묵이 들어갑니다.', note_en: 'It often includes fish cake.', note_zh: '通常含有鱼饼。', note_ja: '通常さつま揚げが入ります。' },
    ],
  }),
  dish({
    keys: ['비빔밥', 'bibimbap'],
    name_ko: '비빔밥', name_en: 'Bibimbap', name_zh: '拌饭', name_ja: 'ビビンバ',
    romanization: 'bibimbap',
    what_ko: '밥 위에 나물과 고추장을 올리고 비벼 먹는 음식입니다.',
    what_en: 'Rice mixed with vegetables and gochujang.',
    what_zh: '米饭拌上蔬菜和辣椒酱的料理。',
    what_ja: 'ご飯にナムルとコチュジャンをのせて混ぜて食べる料理です。',
    eaten_with: { ko: ['된장국', '김치'], en: ['soybean paste soup', 'kimchi'], zh: ['大酱汤', '泡菜'], ja: ['味噌汁', 'キムチ'] },
    ingredients: { ko: ['밥', '나물', '고추장', '계란', '참기름', '소고기'], en: ['rice', 'seasoned vegetables', 'gochujang', 'egg', 'sesame oil', 'beef'], zh: ['米饭', '蔬菜', '辣椒酱', '鸡蛋', '香油', '牛肉'], ja: ['ご飯', 'ナムル', 'コチュジャン', '卵', 'ごま油', '牛肉'] },
    order_ko: '비빔밥 하나 주세요.',
    order_romanization: 'bibimbap hana juseyo.',
    order_en: 'One bibimbap, please.', order_zh: '拌饭请来一份。', order_ja: 'ビビンバを一つください。',
    diet: [
      { who: 'Vegan', note_ko: '보통 계란과 소고기가 올라갑니다.', note_en: 'It often includes egg and beef.', note_zh: '通常有鸡蛋和牛肉。', note_ja: '通常卵と牛肉がのります。' },
      { who: 'Hindu', note_ko: '보통 소고기가 들어갑니다.', note_en: 'It often includes beef.', note_zh: '通常含有牛肉。', note_ja: '通常牛肉が入ります。' },
    ],
  }),
  dish({
    keys: ['삼겹살', 'samgyeopsal'],
    name_ko: '삼겹살', name_en: 'Grilled pork belly', name_zh: '烤五花肉', name_ja: 'サムギョプサル',
    romanization: 'samgyeopsal',
    what_ko: '돼지고기 삼겹살을 구워 쌈과 함께 먹는 음식입니다.',
    what_en: 'Grilled pork belly eaten with lettuce wraps.',
    what_zh: '烤五花肉，配生菜包着吃。',
    what_ja: '豚バラを焼いてサンチュで包んで食べる料理です。',
    eaten_with: { ko: ['상추', '마늘', '쌈장', '밥'], en: ['lettuce', 'garlic', 'ssamjang', 'rice'], zh: ['生菜', '蒜', '包饭酱', '米饭'], ja: ['サンチュ', 'にんにく', 'サムジャン', 'ご飯'] },
    ingredients: { ko: ['돼지고기 삼겹살', '소금', '참기름'], en: ['pork belly', 'salt', 'sesame oil'], zh: ['五花肉', '盐', '香油'], ja: ['豚バラ肉', '塩', 'ごま油'] },
    order_ko: '삼겹살 1인분 주세요.',
    order_romanization: 'samgyeopsal il-inbun juseyo.',
    order_en: 'One serving of pork belly, please.', order_zh: '五花肉请来一份。', order_ja: 'サムギョプサルを一人前ください。',
    diet: [
      { who: 'Vegan', note_ko: '돼지고기 요리입니다.', note_en: 'This dish is pork.', note_zh: '这是猪肉料理。', note_ja: '豚肉の料理です。' },
      { who: 'Halal', note_ko: '돼지고기 요리입니다.', note_en: 'This dish is pork.', note_zh: '这是猪肉料理。', note_ja: '豚肉の料理です。' },
      { who: 'Hindu', note_ko: '돼지고기 요리입니다.', note_en: 'This dish is pork.', note_zh: '这是猪肉料理。', note_ja: '豚肉の料理です。' },
    ],
  }),
  dish({
    keys: ['순두부찌개', 'sundubu'],
    name_ko: '순두부찌개', name_en: 'Soft tofu stew', name_zh: '嫩豆腐汤', name_ja: 'スンドゥブチゲ',
    romanization: 'sundubu-jjigae',
    what_ko: '부드러운 순두부를 매콤한 국물에 끓인 찌개입니다.',
    what_en: 'A spicy stew of soft tofu.',
    what_zh: '用嫩豆腐煮成的辣汤。',
    what_ja: '柔らかい豆腐を辛いスープで煮たチゲです。',
    eaten_with: { ko: ['밥', '계란'], en: ['rice', 'egg'], zh: ['米饭', '鸡蛋'], ja: ['ご飯', '卵'] },
    ingredients: { ko: ['순두부', '계란', '고춧가루', '대파', '마늘', '해물 또는 돼지고기'], en: ['soft tofu', 'egg', 'chili powder', 'green onion', 'garlic', 'seafood or pork'], zh: ['嫩豆腐', '鸡蛋', '辣椒粉', '葱', '蒜', '海鲜或猪肉'], ja: ['スンドゥブ', '卵', '唐辛子粉', 'ねぎ', 'にんにく', '魚介または豚肉'] },
    order_ko: '순두부찌개 하나 주세요.',
    order_romanization: 'sundubu-jjigae hana juseyo.',
    order_en: 'One soft tofu stew, please.', order_zh: '嫩豆腐汤请来一份。', order_ja: 'スンドゥブチゲを一つください。',
    diet: [
      { who: 'Vegan', note_ko: '보통 계란과 해물 또는 돼지고기가 들어갑니다.', note_en: 'It often includes egg and seafood or pork.', note_zh: '通常含有鸡蛋和海鲜或猪肉。', note_ja: '通常卵と魚介または豚肉が入ります。' },
      { who: 'Halal', note_ko: '보통 돼지고기나 해물이 들어갈 수 있습니다.', note_en: 'It often includes pork or seafood.', note_zh: '通常可能含有猪肉或海鲜。', note_ja: '通常豚肉か魚介が入ることがあります。' },
    ],
  }),
  dish({
    keys: ['불고기', 'bulgogi'],
    name_ko: '불고기', name_en: 'Bulgogi', name_zh: '烤肉', name_ja: 'プルコギ',
    romanization: 'bulgogi',
    what_ko: '얇게 썬 소고기를 간장 양념에 재워 구운 음식입니다.',
    what_en: 'Thin beef marinated in soy sauce and grilled.',
    what_zh: '用酱油腌好的薄牛肉烤制而成。',
    what_ja: '薄切り牛肉を醤油だれに漬けて焼いた料理です。',
    eaten_with: { ko: ['밥', '상추', '마늘'], en: ['rice', 'lettuce', 'garlic'], zh: ['米饭', '生菜', '蒜'], ja: ['ご飯', 'サンチュ', 'にんにく'] },
    ingredients: { ko: ['소고기', '간장', '배', '마늘', '양파', '설탕', '참기름'], en: ['beef', 'soy sauce', 'pear', 'garlic', 'onion', 'sugar', 'sesame oil'], zh: ['牛肉', '酱油', '梨', '蒜', '洋葱', '糖', '香油'], ja: ['牛肉', '醤油', '梨', 'にんにく', '玉ねぎ', '砂糖', 'ごま油'] },
    order_ko: '불고기 1인분 주세요.',
    order_romanization: 'bulgogi il-inbun juseyo.',
    order_en: 'One serving of bulgogi, please.', order_zh: '烤肉请来一份。', order_ja: 'プルコギを一人前ください。',
    diet: [
      { who: 'Vegan', note_ko: '소고기 요리입니다.', note_en: 'This dish is beef.', note_zh: '这是牛肉料理。', note_ja: '牛肉の料理です。' },
      { who: 'Hindu', note_ko: '소고기 요리입니다.', note_en: 'This dish is beef.', note_zh: '这是牛肉料理。', note_ja: '牛肉の料理です。' },
    ],
  }),
  dish({
    keys: ['김밥', 'gimbap', 'kimbap'],
    name_ko: '김밥', name_en: 'Gimbap', name_zh: '紫菜包饭', name_ja: 'キンパ',
    romanization: 'gimbap',
    what_ko: '김에 밥과 속재료를 말아 썬 음식입니다.',
    what_en: 'Rice and fillings rolled in seaweed and sliced.',
    what_zh: '用紫菜卷上米饭和馅料再切成段。',
    what_ja: 'のりでご飯と具を巻いて切った料理です。',
    eaten_with: { ko: ['단무지', '라면'], en: ['pickled radish', 'ramyeon'], zh: ['黄萝卜', '拉面'], ja: ['たくあん', 'ラーメン'] },
    ingredients: { ko: ['밥', '김', '계란', '단무지', '시금치', '햄', '참기름'], en: ['rice', 'seaweed', 'egg', 'pickled radish', 'spinach', 'ham', 'sesame oil'], zh: ['米饭', '紫菜', '鸡蛋', '黄萝卜', '菠菜', '火腿', '香油'], ja: ['ご飯', 'のり', '卵', 'たくあん', 'ほうれん草', 'ハム', 'ごま油'] },
    order_ko: '김밥 하나 주세요.',
    order_romanization: 'gimbap hana juseyo.',
    order_en: 'One gimbap, please.', order_zh: '紫菜包饭请来一份。', order_ja: 'キンパを一つください。',
    diet: [
      { who: 'Vegan', note_ko: '보통 계란과 햄이 들어갑니다.', note_en: 'It often includes egg and ham.', note_zh: '通常含有鸡蛋和火腿。', note_ja: '通常卵とハムが入ります。' },
      { who: 'Halal', note_ko: '보통 햄이 들어갑니다.', note_en: 'It often includes ham.', note_zh: '通常含有火腿。', note_ja: '通常ハムが入ります。' },
    ],
  }),
  dish({
    keys: ['냉면', 'naengmyeon'],
    name_ko: '냉면', name_en: 'Naengmyeon', name_zh: '冷面', name_ja: '冷麺',
    romanization: 'naengmyeon',
    what_ko: '차가운 육수나 비빔 양념에 메밀면을 말아 먹는 음식입니다.',
    what_en: 'Buckwheat noodles in cold broth or a spicy sauce.',
    what_zh: '荞麦面配冰汤或拌酱的料理。',
    what_ja: '冷たいスープ、またはピビンだれで食べるそば麺です。',
    eaten_with: { ko: ['식초', '겨자', '김치'], en: ['vinegar', 'mustard', 'kimchi'], zh: ['醋', '芥末', '泡菜'], ja: ['酢', 'からし', 'キムチ'] },
    ingredients: { ko: ['메밀면', '육수', '계란', '오이', '배', '식초'], en: ['buckwheat noodles', 'broth', 'egg', 'cucumber', 'pear', 'vinegar'], zh: ['荞麦面', '高汤', '鸡蛋', '黄瓜', '梨', '醋'], ja: ['そば麺', '出汁', '卵', 'きゅうり', '梨', '酢'] },
    order_ko: '물냉면 하나 주세요.',
    order_romanization: 'mul-naengmyeon hana juseyo.',
    order_en: 'One cold noodle soup, please.', order_zh: '冷面请来一份。', order_ja: '水冷麺を一つください。',
    diet: [
      { who: 'Vegan', note_ko: '보통 고기 육수와 계란이 들어갑니다.', note_en: 'It often includes meat broth and egg.', note_zh: '通常含有肉汤和鸡蛋。', note_ja: '通常肉の出汁と卵が入ります。' },
      { who: 'Halal', note_ko: '보통 고기 육수가 들어갑니다.', note_en: 'It often includes meat broth.', note_zh: '通常含有肉汤。', note_ja: '通常肉の出汁が入ります。' },
    ],
  }),
  dish({
    keys: ['부대찌개', 'budae'],
    name_ko: '부대찌개', name_en: 'Army stew', name_zh: '部队汤', name_ja: 'プデチゲ',
    romanization: 'budae-jjigae',
    what_ko: '김치찌개에 햄, 소시지, 라면을 넣어 끓인 음식입니다.',
    what_en: 'A kimchi stew loaded with ham, sausage, and ramyeon.',
    what_zh: '泡菜汤里加入火腿、香肠和拉面。',
    what_ja: 'キムチチゲにハム、ソーセージ、ラーメンを入れて煮た料理です。',
    eaten_with: { ko: ['밥', '라면'], en: ['rice', 'ramyeon'], zh: ['米饭', '拉面'], ja: ['ご飯', 'ラーメン'] },
    ingredients: { ko: ['김치', '햄', '소시지', '라면', '두부', '돼지고기', '고추장'], en: ['kimchi', 'ham', 'sausage', 'ramyeon noodles', 'tofu', 'pork', 'gochujang'], zh: ['泡菜', '火腿', '香肠', '拉面', '豆腐', '猪肉', '辣椒酱'], ja: ['キムチ', 'ハム', 'ソーセージ', 'ラーメン', '豆腐', '豚肉', 'コチュジャン'] },
    order_ko: '부대찌개 하나 주세요.',
    order_romanization: 'budae-jjigae hana juseyo.',
    order_en: 'One army stew, please.', order_zh: '部队汤请来一份。', order_ja: 'プデチゲを一つください。',
    diet: [
      { who: 'Vegan', note_ko: '보통 햄, 소시지, 돼지고기가 들어갑니다.', note_en: 'It often includes ham, sausage, and pork.', note_zh: '通常含有火腿、香肠和猪肉。', note_ja: '通常ハム、ソーセージ、豚肉が入ります。' },
      { who: 'Halal', note_ko: '보통 햄과 돼지고기가 들어갑니다.', note_en: 'It often includes ham and pork.', note_zh: '通常含有火腿和猪肉。', note_ja: '通常ハムと豚肉が入ります。' },
      { who: 'Hindu', note_ko: '보통 돼지고기가 들어갑니다.', note_en: 'It often includes pork.', note_zh: '通常含有猪肉。', note_ja: '通常豚肉が入ります。' },
    ],
  }),
  dish({
    keys: ['치킨', 'fried chicken', 'chimaek'],
    name_ko: '치킨', name_en: 'Korean fried chicken', name_zh: '韩式炸鸡', name_ja: 'チキン',
    romanization: 'chikin',
    what_ko: '닭을 바삭하게 튀긴 음식입니다.',
    what_en: 'Crispy fried chicken.',
    what_zh: '炸得酥脆的鸡肉。',
    what_ja: 'カリッと揚げた鶏肉です。',
    eaten_with: { ko: ['무', '맥주', '피클'], en: ['pickled radish', 'beer', 'pickles'], zh: ['萝卜', '啤酒', '腌菜'], ja: ['大根', 'ビール', 'ピクルス'] },
    ingredients: { ko: ['닭고기', '튀김옷', '소금', '마늘', '간장'], en: ['chicken', 'batter', 'salt', 'garlic', 'soy sauce'], zh: ['鸡肉', '面糊', '盐', '蒜', '酱油'], ja: ['鶏肉', '衣', '塩', 'にんにく', '醤油'] },
    order_ko: '후라이드 치킨 하나 주세요.',
    order_romanization: 'fried chikin hana juseyo.',
    order_en: 'One fried chicken, please.', order_zh: '炸鸡请来一份。', order_ja: 'フライドチキンを一つください。',
    diet: [
      { who: 'Vegan', note_ko: '닭고기 요리입니다.', note_en: 'This dish is chicken.', note_zh: '这是鸡肉料理。', note_ja: '鶏肉の料理です。' },
      { who: 'Halal', note_ko: '보통 맥주와 함께 나오고, 튀김에 술이 들어갈 수 있습니다.', note_en: 'It is often served with beer, and the batter can include alcohol.', note_zh: '通常配啤酒，面糊里可能有酒。', note_ja: '通常ビールと一緒に出され、衣に酒が入ることがあります。' },
    ],
  }),
  dish({
    keys: ['라면', 'ramyeon', 'ramen'],
    name_ko: '라면', name_en: 'Ramyeon', name_zh: '拉面', name_ja: 'ラーメン',
    romanization: 'ramyeon',
    what_ko: '면과 매콤한 국물로 끓인 즉석 면 요리입니다.',
    what_en: 'Instant noodles in a spicy broth.',
    what_zh: '用辣汤煮的方便面。',
    what_ja: '辛いスープで煮る即席麺です。',
    eaten_with: { ko: ['김치', '김밥'], en: ['kimchi', 'gimbap'], zh: ['泡菜', '紫菜包饭'], ja: ['キムチ', 'キンパ'] },
    ingredients: { ko: ['면', '분말 스프', '계란', '대파'], en: ['noodles', 'soup powder', 'egg', 'green onion'], zh: ['面条', '汤料', '鸡蛋', '葱'], ja: ['麺', '粉末スープ', '卵', 'ねぎ'] },
    order_ko: '라면 하나 주세요.',
    order_romanization: 'ramyeon hana juseyo.',
    order_en: 'One ramyeon, please.', order_zh: '拉面请来一份。', order_ja: 'ラーメンを一つください。',
    diet: [
      { who: 'Vegan', note_ko: '보통 계란과 고기 분말 스프가 들어갑니다.', note_en: 'It often includes egg and a meat-based soup powder.', note_zh: '通常含有鸡蛋和肉类汤料。', note_ja: '通常卵と肉系の粉末スープが入ります。' },
      { who: 'Halal', note_ko: '보통 고기 분말 스프가 들어갑니다.', note_en: 'It often includes a meat-based soup powder.', note_zh: '通常含有肉类汤料。', note_ja: '通常肉系の粉末スープが入ります。' },
    ],
  }),
]

function guideFor(hint) {
  const hay = String(hint || '').toLowerCase()
  let best = null
  let bestLength = 0
  for (const guide of DISH_GUIDES) {
    for (const key of guide.keys) {
      if (hay.includes(key.toLowerCase()) && key.length > bestLength) {
        best = guide
        bestLength = key.length
      }
    }
  }
  return best
}

function preferText(primary, extra) {
  const value = String(primary || '').trim()
  return value || String(extra || '').trim()
}

function preferList(primary, extra) {
  return primary?.length ? primary : (extra || [])
}

function unionList(primary, extra) {
  const seen = new Set()
  const items = []
  for (const item of [...(primary || []), ...(extra || [])]) {
    const key = item.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }
  return items
}

function copyFood(food) {
  if (!food) return null
  return {
    ...food,
    eaten_with: { ...(food.eaten_with || {}) },
    ingredients: { ...(food.ingredients || {}) },
    diet: [...(food.diet || [])],
  }
}

function mergeFood(primary, extra) {
  const over = copyFood(primary)
  const base = copyFood(extra)
  if (!over) return base
  if (!base) return over
  const langs = ['ko', 'en', 'zh', 'ja']
  const food = {}
  for (const key of ['name_ko', 'name_en', 'name_zh', 'name_ja', 'romanization', 'what_ko', 'what_en', 'what_zh', 'what_ja', 'order_ko', 'order_romanization', 'order_en', 'order_zh', 'order_ja']) {
    food[key] = preferText(primary[key], extra[key])
  }
  food.eaten_with = {}
  food.ingredients = {}
  for (const lang of langs) {
    food.eaten_with[lang] = preferList(primary.eaten_with?.[lang], extra.eaten_with?.[lang])
    food.ingredients[lang] = unionList(primary.ingredients?.[lang], extra.ingredients?.[lang])
  }
  food.diet = primary.diet?.length ? primary.diet : (extra.diet || [])
  return food
}

function finishFood(food) {
  if (!food) return null
  if ((!food.order_ko || /[가-힣]/.test(food.order_romanization || '')) && food.name_ko && !food.order_ko) {
    food.order_ko = `${food.name_ko} 하나 주세요.`
  }
  if (food.order_ko && (!food.order_romanization || /[가-힣]/.test(food.order_romanization))) {
    food.order_romanization = romanizeHangul(food.order_ko)
  }
  if (food.name_ko && (!food.romanization || /[가-힣]/.test(food.romanization))) {
    food.romanization = romanizeHangul(food.name_ko)
  }
  const ready = food.order_ko || food.order_romanization || food.ingredients?.ko?.length || food.name_ko
  return ready ? food : null
}

export function foodNotesFor(kind, hint, modelFood) {
  const model = normalizeFood(modelFood)
  const guide = kind === 'restaurant' ? guideFor(hint) : null
  return finishFood(mergeFood(model, guide))
}

export async function handleAnalyze(req, res, root) {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        try {
          const body = await readBody(req)
          const kind = body.mode === 'restaurant' ? 'restaurant' : 'place'
          const text = String(body.text || '').slice(0, 1000)
          const image = typeof body.image === 'string' && body.image.startsWith('data:image/')
            ? body.image.slice(0, 7_000_000)
            : ''
          if (!text && !image) {
            send(res, 400, { error: 'empty' })
            return
          }
          const key = await readKey(root)
          if (!key) {
            send(res, 503, { error: 'missing_key' })
            return
          }
          const imageNotes = image ? await describeImage(key, image) : ''
          const found = await searchSeoul(key, { kind, text, imageNotes })
          const rawPlaces = Array.isArray(found?.places)
            ? found.places
            : (found?.name_ko || found?.name_en ? [found] : [])
          const places = []
          const seen = new Set()
          const brands = new Set()
          const usedImages = new Set()
          for (const raw of rawPlaces) {
            const nameKo = textField(raw, 'name', 'ko')
            const nameEn = textField(raw, 'name', 'en')
            const nameZh = textField(raw, 'name', 'zh')
            const nameJa = textField(raw, 'name', 'ja')
            const keyName = (nameKo || nameEn || nameZh || nameJa).toLowerCase()
            const brandKeys = [brandKey(nameKo), brandKey(nameEn)].filter(Boolean)
            if (!keyName || seen.has(keyName) || brandKeys.some((key) => brands.has(key))) continue
            seen.add(keyName)
            brandKeys.forEach((key) => brands.add(key))
            const sourceAddress = textField(raw, 'address', 'ko') || String(raw?.address || '').trim()
            const point = await locatePlace(nameKo || nameEn, sourceAddress)
            const road = roadToken(sourceAddress).toLowerCase()
            const pointText = (point.display || '').replace(/\s/g, '').toLowerCase()
            const agrees = !road || !point.display || pointText.includes(road)
            const koAddress = agrees && looksLikeStreet(sourceAddress) ? sourceAddress : (point.display || sourceAddress)
            const addresses = {
              ko: koAddress,
              en: textField(raw, 'address', 'en'),
              zh: textField(raw, 'address', 'zh'),
              ja: textField(raw, 'address', 'ja'),
            }
            if (point.lat) {
              for (const language of ['en', 'zh', 'ja']) {
                const display = await reverseGeocode(point.lat, point.lng, language)
                await wait(1100)
                if (display) addresses[language] = display
              }
            }
            const directions = [nameKo || nameEn, koAddress, koAddress.includes('서울') ? '' : '서울'].filter(Boolean).join(' ')
            const place = {
              match: raw?.match === 'same' ? 'same' : 'similar',
              name_ko: nameKo,
              name_en: nameEn,
              name_zh: nameZh,
              name_ja: nameJa,
              address_ko: addresses.ko,
              address_en: addresses.en,
              address_zh: addresses.zh,
              address_ja: addresses.ja,
              directions,
              lat: point.lat,
              lng: point.lng,
              source_url: String(raw?.source_url || ''),
              source_title_ko: textField(raw, 'source_title', 'ko'),
              source_title_en: textField(raw, 'source_title', 'en'),
              source_title_zh: textField(raw, 'source_title', 'zh'),
              source_title_ja: textField(raw, 'source_title', 'ja'),
              why_ko: textField(raw, 'why', 'ko'),
              why_en: textField(raw, 'why', 'en'),
              why_zh: textField(raw, 'why', 'zh'),
              why_ja: textField(raw, 'why', 'ja'),
            }
            place.image = await placePhoto(place, usedImages)
            if (place.image) usedImages.add(place.image)
            places.push(place)
            if (places.length === 4) break
          }
          if (!places.length) {
            send(res, 404, { error: 'not_found' })
            return
          }
          const asked = [text, imageNotes].filter(Boolean).join('\n')
          const clue = places
            .map((place) => [place.name_ko, place.why_ko, place.why_en].filter(Boolean).join(' '))
            .join('\n')
          let food = foodNotesFor(kind, asked, found?.food)
          if (kind === 'restaurant' && !food?.ingredients?.ko?.length) {
            food = foodNotesFor(kind, `${asked}\n${clue}`, found?.food)
          }
          const needsDish = kind === 'restaurant' && !(food?.order_romanization && food?.ingredients?.ko?.length)
          if (needsDish) {
            try {
              food = foodNotesFor(kind, `${asked}\n${clue}`, await describeDish(key, `${asked}\n${clue}`)) || food
            } catch (error) {
              console.error('dish notes failed', error?.message)
            }
          }
          send(res, 200, {
            kind,
            food,
            places,
          })
        } catch (error) {
          send(res, 502, {
            error: error.daily ? 'daily_limit' : error.rateLimit ? 'rate_limit' : 'groq_failed',
            detail: error.message,
          })
        }
}

export function groqApi(root) {
  return {
    name: 'stos-groq',
    configureServer(server) {
      server.middlewares.use('/api/analyze', (req, res) => {
        void handleAnalyze(req, res, root)
      })
    },
  }
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
