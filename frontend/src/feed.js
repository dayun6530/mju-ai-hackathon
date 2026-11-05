import { supabase } from '@/supabase.js'

const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function cardFrom(post, url, saved, author, userId = '') {
  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
  const name = author || profile?.display_name || profile?.username || ''
  const likes = post.post_likes || []
  const comments = [...(post.comments || [])]
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    .map((comment) => {
      const commenter = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles
      return {
        id: comment.id,
        text: comment.content,
        author: commenter?.display_name || commenter?.username || '',
      }
    })
  return {
    id: post.id,
    userId: post.user_id,
    caption: post.caption || '',
    url,
    saved,
    bookmarked: saved,
    author: name,
    liked: Boolean(userId) && likes.some((like) => like.user_id === userId),
    likeCount: likes.length,
    comments,
  }
}

async function signedUrl(path) {
  const { data } = await supabase.storage.from('post-media').createSignedUrl(path, 60 * 60 * 6)
  return data?.signedUrl || ''
}

function uploadableType(file) {
  const type = file.type === 'image/jpg' ? 'image/jpeg' : file.type
  return IMAGE_TYPES[type] ? { type, ext: IMAGE_TYPES[type] } : null
}

function asJpeg(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      canvas.getContext('2d').drawImage(image, 0, 0)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        resolve(blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : null)
      }, 'image/jpeg', 0.9)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

async function prepareImage(file) {
  const ready = uploadableType(file)
  if (ready) return { file, ...ready }
  const jpeg = await asJpeg(file)
  return jpeg ? { file: jpeg, type: 'image/jpeg', ext: 'jpg' } : null
}

export async function loadFeed(userId) {
  const postsQuery = supabase
    .from('posts')
    .select('id, user_id, caption, created_at, profiles!posts_user_id_fkey(username, display_name), post_media(storage_path, sort_order), post_likes(user_id), comments(id, content, created_at, profiles!comments_user_id_fkey(username, display_name))')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  const savesQuery = userId
    ? supabase.from('post_saves').select('post_id')
    : Promise.resolve({ data: [] })
  const [postsResult, savesResult] = await Promise.all([postsQuery, savesQuery])
  if (postsResult.error) return null
  const posts = postsResult.data
  const saves = savesResult.data
  const savedIds = new Set((saves || []).map((item) => item.post_id))
  const cards = await Promise.all((posts || []).map(async (post) => {
    const media = [...(post.post_media || [])].sort((a, b) => a.sort_order - b.sort_order)[0]
    if (!media?.storage_path) return null
    return cardFrom(post, await signedUrl(media.storage_path), savedIds.has(post.id), '', userId)
  }))
  const visible = cards.filter((post) => post?.url)
  return {
    mine: visible.filter((post) => post.userId === userId),
    explore: shuffleByAccount(visible.filter((post) => post.userId !== userId), userId),
    saved: visible.filter((post) => post.saved && post.userId !== userId),
  }
}

function hashSeed(value) {
  let hash = 2166136261
  const text = value || 'guest'
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function shuffleByAccount(list, userId) {
  const next = [...list]
  let state = hashSeed(userId) || 1
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const swapIndex = state % (index + 1)
    const current = next[index]
    next[index] = next[swapIndex]
    next[swapIndex] = current
  }
  return next
}

export async function publishPost({ file, caption, author }) {
  const prepared = await prepareImage(file)
  if (!prepared || !supabase) return null
  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user
  if (!user) return null
  const { data: post, error } = await supabase
    .from('posts')
    .insert({ caption: caption || '', status: 'published' })
    .select('id, user_id, caption')
    .single()
  if (error || !post) return null
  const path = `${user.id}/${post.id}.${prepared.ext}`
  const uploaded = await supabase.storage.from('post-media').upload(path, prepared.file, {
    contentType: prepared.type,
    upsert: false,
  })
  if (uploaded.error) {
    await supabase.from('posts').delete().eq('id', post.id)
    return null
  }
  const media = await supabase.from('post_media').insert({
    post_id: post.id,
    storage_path: path,
    media_type: 'image',
    sort_order: 0,
  })
  if (media.error) {
    await supabase.storage.from('post-media').remove([path])
    await supabase.from('posts').delete().eq('id', post.id)
    return null
  }
  return cardFrom(post, await signedUrl(path), false, author)
}

export async function toggleSave(postId, saved) {
  if (!supabase) return false
  const result = saved
    ? await supabase.from('post_saves').delete().eq('post_id', postId)
    : await supabase.from('post_saves').insert({ post_id: postId })
  return !result.error
}

export async function toggleLike(postId, liked) {
  if (!supabase) return false
  const result = liked
    ? await supabase.from('post_likes').delete().eq('post_id', postId)
    : await supabase.from('post_likes').insert({ post_id: postId })
  return !result.error
}

export async function addComment(postId, content) {
  if (!supabase) return null
  const text = String(content || '').trim().slice(0, 1000)
  if (!text) return null
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, content: text })
    .select('id, content, created_at, profiles!comments_user_id_fkey(username, display_name)')
    .single()
  if (error || !data) return null
  const commenter = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
  return {
    id: data.id,
    text: data.content,
    author: commenter?.display_name || commenter?.username || '',
  }
}
