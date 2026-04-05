// api/visions.js
// Vercel Serverless Function — Vision CRUD + Voting via Supabase

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

  // GET /api/visions — fetch all visions sorted by votes
  if (req.method === 'GET') {
    const result = await supabase('/visions?order=votes.desc&select=*');
    if (!result.ok) return res.status(500).json({ error: 'Failed to fetch visions' });
    return res.status(200).json(result.data);
  }

  // POST /api/visions — create a new vision
  if (req.method === 'POST') {
    const { action } = req.body;

    // Vote on a vision
    if (action === 'vote') {
      const { visionId, voterId } = req.body;
      if (!visionId || !voterId) return res.status(400).json({ error: 'Missing visionId or voterId' });

      // Check if already voted
      const checkResult = await supabase(
        `/votes?vision_id=eq.${visionId}&voter_id=eq.${encodeURIComponent(voterId)}&select=id`
      );
      if (checkResult.data && checkResult.data.length > 0) {
        return res.status(409).json({ error: 'Already voted' });
      }

      // Insert vote record
      const voteResult = await supabase('/votes', {
        method: 'POST',
        prefer: 'return=minimal',
        body: JSON.stringify({ vision_id: visionId, voter_id: voterId }),
      });
      if (!voteResult.ok) return res.status(500).json({ error: 'Failed to record vote' });

      // Increment vote count on vision
      const visionResult = await supabase(
        `/visions?id=eq.${visionId}&select=votes,activated`,
      );
      const vision = visionResult.data?.[0];
      if (!vision) return res.status(404).json({ error: 'Vision not found' });

      const newVotes = vision.votes + 1;
      const nowActivated = newVotes >= 15;

      await supabase(`/visions?id=eq.${visionId}`, {
        method: 'PATCH',
        prefer: 'return=representation',
        body: JSON.stringify({ votes: newVotes, activated: nowActivated }),
      });

      return res.status(200).json({ votes: newVotes, activated: nowActivated });
    }

    // Create a new vision
    const { title, location, meaning, category, mode, emoji, bg, image_url, submitted_by, lat, lng } = req.body;
    if (!title || !location || !meaning) return res.status(400).json({ error: 'Missing required fields' });

    const result = await supabase('/visions', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify({ title, location, meaning, category, mode, emoji, bg, image_url, submitted_by, lat, lng }),
    });

    if (!result.ok) return res.status(500).json({ error: 'Failed to create vision', details: result.data });
    return res.status(201).json(result.data?.[0] || result.data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
