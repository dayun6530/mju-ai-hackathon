import { createClient } from '@supabase/supabase-js'
import { supabasePublishableKey, supabaseUrl } from './supabasePublic.js'

const url = import.meta.env.VITE_SUPABASE_URL || supabaseUrl
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || supabasePublishableKey

export const supabase = url && key ? createClient(url, key) : null
