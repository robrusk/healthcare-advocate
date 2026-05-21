/**
 * Cloudflare Worker — healthcareadvocate.org API proxy
 *
 * This Worker is a stateless passthrough between the browser and
 * the Anthropic API. It exists so the Anthropic API key is never
 * exposed to the client.
 *
 * WHAT THIS WORKER DOES:
 *   - Receives POST requests from the healthcareadvocate.org frontend
 *   - Validates the request shape (basic schema check)
 *   - Adds the Anthropic API key from environment variables
 *   - Forwards the request to Anthropic's API
 *   - Returns the response to the browser
 *
 * WHAT THIS WORKER DOES NOT DO:
 *   - Does NOT log request bodies (no console.log of request contents)
 *   - Does NOT log response bodies
 *   - Does NOT write to any database, KV store, R2 bucket, or D1 table
 *   - Does NOT call any third-party service other than api.anthropic.com
 *   - Does NOT track users
 *
 * Note: Cloudflare itself logs standard request metadata at the edge
 * (timestamp, IP address, URL, response code) as part of normal CDN
 * operation. This Worker has no control over that and does not enhance
 * or supplement that logging.
 *
 * Source of truth: this file is the deployed Worker. If you suspect a
 * privacy issue, read this code.
 */

const ALLOWED_ORIGINS = [
  'https://healthcareadvocate.org',
  'https://www.healthcareadvocate.org',
  'https://ruskracing.com',
  'http://localhost:5173',
]

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const allowed = ALLOWED_ORIGINS.includes(origin)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: allowed ? corsHeaders(origin) : {},
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    if (!allowed) {
      return new Response('Forbidden', { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    // Basic schema guard — must have model and messages
    if (!body.model || !Array.isArray(body.messages)) {
      return new Response('Missing required fields: model, messages', { status: 400 })
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify(body),
    })

    const data = await anthropicRes.json()

    return new Response(JSON.stringify(data), {
      status: anthropicRes.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    })
  },
}
