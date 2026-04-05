// api/profiles.js
// Vercel Serverless Function — User Profiles via Supabase

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function supabase(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': options.prefer || '',
      ...options.headers,
    },
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/profiles?username=xxx
  if (req.method === 'GET') {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username required' });
    const result = await supabase(`/profiles?username=eq.${encodeURIComponent(username)}&select=*`);
    return res.status(200).json(result.data?.[0] || null);
  }

  // POST /api/profiles — create or get profile
  if (req.method === 'POST') {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    // Try to find existing
    const existing = await supabase(`/profiles?username=eq.${encodeURIComponent(username)}&select=*`);
    if (existing.data?.length > 0) return res.status(200).json(existing.data[0]);

    // Create new profile
    const result = await supabase('/profiles', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify({ username }),
    });
    if (!result.ok) return res.status(500).json({ error: 'Failed to create profile' });
    return res.status(201).json(result.data?.[0] || result.data);
  }

  // PATCH /api/profiles — update stats
  if (req.method === 'PATCH') {
    const { username, vision_count, vote_count } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    const updates = {};
    if (vision_count !== undefined) updates.vision_count = vision_count;
    if (vote_count !== undefined) updates.vote_count = vote_count;
    const result = await supabase(`/profiles?username=eq.${encodeURIComponent(username)}`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: JSON.stringify(updates),
    });
    return res.status(200).json(result.data?.[0] || result.data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
