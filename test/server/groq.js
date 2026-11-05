import fs from 'node:fs'
import path from 'node:path'

const VISION_MODEL = 'qwen/qwen3.8-27b'
const SEARCH_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']

function readKey(root) {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY
  const file = path.join(root, '.env')
  if (!fs.existsSync(file)) return ''
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*GROQ_API_KEY\s*=\s*(.*)\s*$/)
    if (match) return match[1].replace(/^["']|["']$/g, '')
  }
  return ''
}

function extractJson(text) {
  const source = String(text || '')
  let found = null
  const places = []
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== '{') continue
    const parsed = readObject(source, i)
    if (!parsed) continue
    if (Array.isArray(parsed.value?.places)) found = parsed.value
    else if (parsed.value?.name_ko || parsed.value?.name_en) places.push(parsed.value)
    i = parsed.end
  }
  if (found?.places?.length) return found
  if (places.length) return { found: true, food: found?.food || null, places }
  if (found) return found
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
        content: 'You search the live web for real places in Seoul. Use only places and addresses you find in search results. Never invent an address. Never call a place a confirmed filming location unless a source explicitly says so.',
      },
      {
        role: 'user',
        content: [
          `Mode: ${kind === 'restaurant' ? 'find a restaurant' : 'find a similar place'}`,
          `Visitor request: ${text || '(no text)'}`,
          `Photo notes: ${imageNotes || '(no photo)'}`,
          'Return 4 different real Seoul places in the places array, best match first. Do not stop after one place.',
          'If a source confirms the exact drama restaurant or place, put that place first with match "same". Every other place uses match "similar".',
          'Write every visitor-facing string in all four languages: ko Korean, en English, zh Simplified Chinese, ja Japanese. Do not leave a language blank and do not copy Korean into the English, Chinese, or Japanese fields.',
          'Each why is one sentence under 16 words. address_ko is the Korean address from the source, and address_en, address_zh, address_ja translate that same address. Do not invent a place to fill the list.',
          'After searching, end your reply with one JSON object and no markdown:',
          '{"found":true,"food":null,"places":[{"match":"similar","name_ko":"","name_en":"","name_zh":"","name_ja":"","address_ko":"","address_en":"","address_zh":"","address_ja":"","source_title_ko":"","source_title_en":"","source_title_zh":"","source_title_ja":"","source_url":"","why_ko":"","why_en":"","why_zh":"","why_ja":""}]}',
          'The places array must contain 4 objects with those fields.',
          kind === 'restaurant'
            ? 'food describes the dish once: {"name_ko":"","name_en":"","name_zh":"","name_ja":"","romanization":"","what_ko":"","what_en":"","what_zh":"","what_ja":"","eaten_with":{"ko":[""],"en":[""],"zh":[""],"ja":[""]},"ingredients":{"ko":[""],"en":[""],"zh":[""],"ja":[""]},"order_ko":"","diet":[{"who":"Vegan","note_ko":"","note_en":"","note_zh":"","note_ja":""}]}. romanization is how to read the Korean dish name. order_ko stays Korean, such as "김치찌개 하나 주세요." diet notes say "often includes".'
            : 'Set food to null unless a specific dish is part of the request.',
          'If search does not support a real Seoul place, return {"found":false,"places":[]}.',
        ].join('\n'),
      },
    ],
  })
  return extractJson(content)
}

const WIKI_HEADERS = {
  'User-Agent': 'STOS-hackathon/1.0 (school project)',
  Accept: 'application/json',
}

function usablePhoto(url) {
  if (!url || !/^https?:\/\//i.test(url)) return ''
  if (/\.svg(\?|$)/i.test(url)) return ''
  return url
}

let lastWikiAt = 0

async function wikiPhoto(host, title) {
  if (!title) return ''
  const gap = 400 - (Date.now() - lastWikiAt)
  if (gap > 0) await wait(gap)
  lastWikiAt = Date.now()
  try {
    const url = new URL(`https://${host}/w/api.php`)
    url.searchParams.set('action', 'query')
    url.searchParams.set('format', 'json')
    url.searchParams.set('generator', 'search')
    url.searchParams.set('gsrsearch', title)
    url.searchParams.set('gsrlimit', '1')
    url.searchParams.set('prop', 'pageimages')
    url.searchParams.set('piprop', 'thumbnail')
    url.searchParams.set('pithumbsize', '480')
    const response = await fetch(url, {
      headers: WIKI_HEADERS,
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return ''
    const data = await response.json()
    const page = Object.values(data.query?.pages || {})[0]
    return usablePhoto(page?.thumbnail?.source || '')
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

async function placePhoto(place) {
  const korean = await wikiPhoto('ko.wikipedia.org', place.name_ko)
  if (korean) return korean
  if (place.name_en && place.name_en !== place.name_ko) {
    const english = await wikiPhoto('en.wikipedia.org', place.name_en)
    if (english) return english
  }
  return sourceImage(place.source_url)
}

async function geocode(query, language) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'kr')
  url.searchParams.set('q', query)
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'STOS-hackathon/1.0 (school project)',
      'Accept-Language': language,
    },
  })
  if (!response.ok) return null
  const rows = await response.json()
  if (!rows?.[0]) return null
  return {
    lat: Number(rows[0].lat),
    lng: Number(rows[0].lon),
    display: String(rows[0].display_name || ''),
  }
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

export function groqApi(root) {
  return {
    name: 'stos-groq',
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
          const kind = body.mode === 'restaurant' ? 'restaurant' : 'place'
          const text = String(body.text || '').slice(0, 1000)
          const image = typeof body.image === 'string' && body.image.startsWith('data:image/')
            ? body.image.slice(0, 7_000_000)
            : ''
          if (!text && !image) {
            send(res, 400, { error: 'empty' })
            return
          }
          const key = readKey(root)
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
          for (const raw of rawPlaces) {
            const nameKo = textField(raw, 'name', 'ko')
            const nameEn = textField(raw, 'name', 'en')
            const nameZh = textField(raw, 'name', 'zh')
            const nameJa = textField(raw, 'name', 'ja')
            const keyName = (nameKo || nameEn || nameZh || nameJa).toLowerCase()
            if (!keyName || seen.has(keyName)) continue
            seen.add(keyName)
            const addressKo = textField(raw, 'address', 'ko') || String(raw?.address || '').trim()
            const queries = [
              [addressKo, nameKo, '서울'].filter(Boolean).join(' '),
              [nameKo || nameEn, '서울'].filter(Boolean).join(' '),
            ]
            let point = null
            for (const query of queries) {
              point = await geocode(query, 'ko')
              await wait(1100)
              if (point) break
            }
            const addresses = {
              ko: point?.display || addressKo,
              en: textField(raw, 'address', 'en'),
              zh: textField(raw, 'address', 'zh'),
              ja: textField(raw, 'address', 'ja'),
            }
            if (point) {
              for (const language of ['en', 'zh', 'ja']) {
                const display = await reverseGeocode(point.lat, point.lng, language)
                await wait(1100)
                if (display) addresses[language] = display
              }
            }
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
              lat: point?.lat ?? null,
              lng: point?.lng ?? null,
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
            place.image = await placePhoto(place)
            places.push(place)
            if (places.length === 4) break
          }
          if (!places.length) {
            send(res, 404, { error: 'not_found' })
            return
          }
          send(res, 200, {
            kind,
            food: found?.food || null,
            places,
          })
        } catch (error) {
          send(res, 502, {
            error: error.daily ? 'daily_limit' : error.rateLimit ? 'rate_limit' : 'groq_failed',
            detail: error.message,
          })
        }
      })
    },
  }
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
