import { fileURLToPath } from 'node:url'
import { handleAnalyze } from '../server/groq.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

export const maxDuration = 60

export default function handler(req, res) {
  const root = fileURLToPath(new URL('..', import.meta.url))
  return handleAnalyze(req, res, root)
}
