/**
 * server/index-puppeteer.js
 *
 * Use this INSTEAD of index.js if election.ekantipur.com renders via JavaScript
 * (React/Next.js). This uses a headless browser to fully render the page first.
 *
 * Install: npm install puppeteer
 * Run: node server/index-puppeteer.js
 */

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_TTL = 30 * 1000;

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

let cachedData = null;
let lastFetched = null;
let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return browser;
}

async function scrapeWithPuppeteer() {
  const b = await getBrowser();
  const page = await b.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
  
  try {
    await page.goto('https://election.ekantipur.com/?lng=eng', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for results to appear
    await page.waitForSelector('table, [class*="result"], [class*="party"]', { timeout: 10000 }).catch(() => {});
    
    // Extra wait for dynamic content
    await new Promise(r => setTimeout(r, 3000));

    const data = await page.evaluate(() => {
      const parties = [];
      const news = [];

      // Try tables
      document.querySelectorAll('table tbody tr').forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const name = cells[0]?.innerText?.trim();
          const won = cells[1]?.innerText?.trim();
          const leading = cells[2]?.innerText?.trim();
          const total = cells[3]?.innerText?.trim();
          if (name && name.length > 1) {
            parties.push({ name, won: won || '0', leading: leading || '0', total: total || '0' });
          }
        }
      });

      // Try news/update elements
      document.querySelectorAll('[class*="news"], [class*="update"], [class*="ticker"], article').forEach(el => {
        const text = el.innerText?.trim().replace(/\s+/g, ' ');
        if (text && text.length > 20 && text.length < 300) news.push(text);
      });

      return {
        parties,
        news: news.slice(0, 20),
        pageTitle: document.title,
        rawText: document.body.innerText.substring(0, 2000),
      };
    });

    return {
      ...data,
      fetchedAt: new Date().toISOString(),
      source: 'https://election.ekantipur.com/?lng=eng',
      summary: {},
      rawBlocks: data.parties.length === 0 ? [data.rawText] : [],
    };
  } finally {
    await page.close();
  }
}

async function refreshCache() {
  console.log('[scraper] Fetching...');
  try {
    cachedData = await scrapeWithPuppeteer();
    lastFetched = Date.now();
    console.log(`[scraper] OK — parties: ${cachedData.parties.length}`);
  } catch (e) {
    console.error('[scraper] Error:', e.message);
    if (!cachedData) cachedData = { error: e.message, parties: [], news: [], rawBlocks: [], fetchedAt: new Date().toISOString() };
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

app.get('/api/health', (req, res) => res.json({ ok: true, lastFetched }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, () => console.log(`Puppeteer election proxy on port ${PORT}`));
process.on('exit', () => browser?.close());
