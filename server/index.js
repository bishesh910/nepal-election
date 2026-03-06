const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Cache
let cachedData = null;
let lastFetched = null;
const CACHE_TTL = 30 * 1000; // 30 seconds

const BASE_URL = 'https://election.ekantipur.com/?lng=eng';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Referer': 'https://ekantipur.com/',
};

async function scrapeElectionData() {
  try {
    const response = await axios.get(BASE_URL, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(response.data);

    // --- Party Summary ---
    const parties = [];
    // Try multiple selectors since the site may change structure
    $('[class*="party"], [class*="Party"], .result-row, .party-row, tr').each((i, el) => {
      const row = $(el);
      const name = row.find('[class*="name"], [class*="party-name"], td:nth-child(1)').first().text().trim();
      const won = row.find('[class*="won"], [class*="Win"], td:nth-child(2)').first().text().trim();
      const leading = row.find('[class*="lead"], [class*="Leading"], td:nth-child(3)').first().text().trim();
      const total = row.find('[class*="total"], [class*="Total"], td:nth-child(4)').first().text().trim();

      if (name && (won || leading)) {
        parties.push({ name, won: won || '0', leading: leading || '0', total: total || '0' });
      }
    });

    // --- Headlines / News Ticker ---
    const news = [];
    $('[class*="news"], [class*="ticker"], [class*="update"], [class*="headline"], article, .news-item').each((i, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text && text.length > 20 && text.length < 300) {
        news.push(text);
      }
    });

    // --- Try to get totals (seats won/leading overall) ---
    const summary = {
      totalSeats: $('[class*="total-seat"], [class*="totalSeat"]').first().text().trim() || null,
      counted: $('[class*="counted"], [class*="result"]').first().text().trim() || null,
      pending: $('[class*="pending"], [class*="remain"]').first().text().trim() || null,
    };

    // Fallback: extract raw meaningful text blocks if structured data is sparse
    const rawBlocks = [];
    if (parties.length === 0) {
      $('table, [class*="result"], [class*="board"], [class*="tally"], [class*="count"]').each((i, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text.length > 30) rawBlocks.push(text.substring(0, 500));
      });
    }

    return {
      fetchedAt: new Date().toISOString(),
      source: BASE_URL,
      parties,
      news: news.slice(0, 20),
      summary,
      rawBlocks: rawBlocks.slice(0, 5),
      pageTitle: $('title').text().trim(),
      metaDescription: $('meta[name="description"]').attr('content') || '',
    };
  } catch (err) {
    console.error('Scrape error:', err.message);
    throw err;
  }
}

async function refreshCache() {
  console.log('[scraper] Fetching fresh data...');
  try {
    cachedData = await scrapeElectionData();
    lastFetched = Date.now();
    console.log(`[scraper] OK — parties: ${cachedData.parties.length}, news: ${cachedData.news.length}`);
  } catch (e) {
    console.error('[scraper] Failed:', e.message);
    if (!cachedData) {
      cachedData = { error: e.message, fetchedAt: new Date().toISOString(), parties: [], news: [], summary: {}, rawBlocks: [] };
    }
  }
}

// Initial fetch + periodic refresh
refreshCache();
setInterval(refreshCache, CACHE_TTL);

// API route
app.get('/api/results', async (req, res) => {
  if (!cachedData || (Date.now() - lastFetched > CACHE_TTL * 2)) {
    await refreshCache();
  }
  res.json({
    ...cachedData,
    cacheAge: lastFetched ? Math.round((Date.now() - lastFetched) / 1000) : null,
    nextRefresh: lastFetched ? Math.max(0, Math.round((CACHE_TTL - (Date.now() - lastFetched)) / 1000)) : 0,
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, lastFetched, uptime: process.uptime() }));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, () => console.log(`Nepal Election Proxy running on port ${PORT}`));
