// api/generate.js
// Vercel Serverless Function — AI Vision Generation
// Keeps your Anthropic API key safe on the server

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers so your frontend can call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { prompt, imageBase64, mimeType } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const messageContent = [];

    // If user uploaded a photo of the space, include it
    if (imageBase64 && mimeType) {
      messageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: imageBase64,
        },
      });
      messageContent.push({
        type: 'text',
        text: `You are an expert visual artist and urban muralist. The user has uploaded a photo of a real space in their affordable housing community. Generate a vivid, detailed description of what this space would look like transformed by the following community vision: "${prompt}".

Describe the transformation in painterly detail — colors, textures, the emotional atmosphere, what residents would see and feel walking past. Make it feel real and alive. Focus on the human impact. Keep your response to 3-4 sentences, rich and specific.

Do not include any preamble or explanation. Just describe the transformed vision directly as if you are seeing it.`,
      });
    } else {
      messageContent.push({
        type: 'text',
        text: `You are an expert visual artist and urban muralist creating community art visions for affordable housing residents. Describe in vivid, painterly detail what this community vision would look like as public art: "${prompt}".

Describe colors, textures, scale, the emotional atmosphere, and what residents would experience. Make it feel alive and real. Keep your response to 3-4 sentences, rich and specific.

Do not include any preamble or explanation. Just describe the vision directly.`,
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: messageContent }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API error:', errorData);
      return res.status(response.status).json({ error: 'AI generation failed', details: errorData });
    }

    const data = await response.json();
    const description = data.content?.[0]?.text || '';

    return res.status(200).json({ description });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
