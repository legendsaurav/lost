import { NextApiRequest, NextApiResponse } from 'next';

// This endpoint is private: it uses process.env.GOOGLE_API_KEY (not exposed to frontend)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { query, max } = req.body;
  if (!query) {
    res.status(400).json({ error: 'Missing query' });
    return;
  }
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;
  if (!apiKey || !cx) {
    res.status(500).json({ error: 'API key or CX not configured' });
    return;
  }
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=${max || 10}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message || 'Search failed' });
      return;
    }
    // Transform results for frontend
    const results = (data.items || []).map(item => ({
      name: item.title,
      snippet: item.snippet,
      url: item.link
    }));
    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
