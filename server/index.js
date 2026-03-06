const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

let cachedData = null;
let lastFetched = null;
const CACHE_TTL = 30 * 1000;

const BASE_URL = 'https://election.ekantipur.com/?lng=eng';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://ekantipur.com/',
};

function parsePartyBlock(block) {
  const parties = [];
  const lineRegex = /^(.+?)\s+(\d+)\s+(\d+)\s*$/gm;
  let m;
  while ((m = lineRegex.exec(block)) !== null) {
    const name = m[1].trim();
    if (name === 'Party' || name === 'Winner' || name === 'Lead') continue;
    const won = parseInt(m[2]);
    const leading = parseInt(m[3]);
    parties.push({ name, won, leading, total: won + leading });
  }
  return parties;
}

function parseRawText(rawText) {
  const districts = [];
  const globalPartyTotals = {};

  const districtRegex = /([A-Za-z\s\-]+District\s*\d*)\s+Seats:\s*(\d+)\s+Party\s+Winner\s+Lead\s+([\s\S]*?)(?=(?:[A-Za-z\s\-]+District\s*\d*\s+Seats:)|$)/gi;

  let match;
  while ((match = districtRegex.exec(rawText)) !== null) {
    const districtName = match[1].trim();
    const totalSeats = parseInt(match[2]);
    const partyBlock = match[3].trim();
    const parties = parsePartyBlock(partyBlock);

    if (parties.length > 0) {
      const distSeats = parties.reduce((s, p) => s + p.total, 0);
      districts.push({ name: districtName, totalSeats, seatsReported: distSeats, parties });

      for (const p of parties) {
        if (p.name === 'Others') continue;
        if (!globalPartyTotals[p.name]) {
          globalPartyTotals[p.name] = { name: p.name, won: 0, leading: 0 };
        }
        globalPartyTotals[p.name].won += p.won;
        globalPartyTotals[p.name].leading += p.leading;
      }
    }
  }

  const globalParties = Object.values(globalPartyTotals)
    .map(p => ({ ...p, total: p.won + p.leading }))
    .sort((a, b) => b.total - a.total || b.won - a.won);

  return { districts, globalParties };
}

async function scrapeElectionData() {
  const response = await axios.get(BASE_URL, { headers: HEADERS, timeout: 20000 });
  const $ = cheerio.load(response.data);

  // Get the biggest text block containing "Seats:"
  let fullText = '';
  let maxLen = 0;
  $('body *').each((i, el) => {
    if (['script','style','noscript'].includes(el.tagName)) return;
    const text = $(el).text().replace(/\t/g, ' ').replace(/[ ]{2,}/g, ' ').trim();
    if (text.includes('Seats:') && text.length > maxLen) {
      maxLen = text.length;
      fullText = text;
    }
  });
  if (!fullText) fullText = $('body').text();

  const { districts, globalParties } = parseRawText(fullText);

  const news = [];
  $('[class*="news"],[class*="ticker"],[class*="update"],[class*="flash"],[class*="alert"]').each((i, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t.length > 20 && t.length < 400) news.push(t);
  });

  return {
    fetchedAt: new Date().toISOString(),
    pageTitle: $('title').text().trim(),
    districts,
    globalParties,
    news: [...new Set(news)].slice(0, 15),
    totalDistricts: districts.length,
    totalSeatsReported: districts.reduce((s, d) => s + d.seatsReported, 0),
  };
}

async function refreshCache() {
  console.log('[scraper] Fetching...');
  try {
    cachedData = await scrapeElectionData();
    lastFetched = Date.now();
    console.log(`[scraper] OK — districts: ${cachedData.districts.length}, global parties: ${cachedData.globalParties.length}`);
  } catch (e) {
    console.error('[scraper] Error:', e.message);
    if (!cachedData) {
      cachedData = { error: e.message, fetchedAt: new Date().toISOString(), districts: [], globalParties: [], news: [] };
    }
  }
}

refreshCache();
setInterval(refreshCache, CACHE_TTL);

app.get('/api/results', async (req, res) => {
  if (!cachedData) await refreshCache();
  res.json({
    ...cachedData,
    cacheAge: lastFetched ? Math.round((Date.now() - lastFetched) / 1000) : null,
    nextRefresh: lastFetched ? Math.max(0, Math.round((CACHE_TTL - (Date.now() - lastFetched)) / 1000)) : 0,
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, lastFetched, uptime: process.uptime() }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, () => console.log(`Nepal Election proxy on port ${PORT}`));
