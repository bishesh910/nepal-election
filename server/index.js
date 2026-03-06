const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// ─── Nepal constituency map ───────────────────────────────────────────────────
// province-slug → districts → constituencies count
const PROVINCES = [
  { id: 1, slug: 'pradesh-1',  name: 'Koshi',         districts: [
    { slug: 'taplejung', name: 'Taplejung', seats: 2 },
    { slug: 'panchthar', name: 'Panchthar', seats: 3 },
    { slug: 'ilam',      name: 'Ilam',      seats: 4 },
    { slug: 'jhapa',     name: 'Jhapa',     seats: 8 },
    { slug: 'morang',    name: 'Morang',    seats: 8 },
    { slug: 'sunsari',   name: 'Sunsari',   seats: 7 },
    { slug: 'dhankuta',  name: 'Dhankuta',  seats: 3 },
    { slug: 'terhathum', name: 'Terhathum', seats: 2 },
    { slug: 'sankhuwasabha', name: 'Sankhuwasabha', seats: 3 },
    { slug: 'bhojpur',   name: 'Bhojpur',   seats: 3 },
    { slug: 'solukhumbu', name: 'Solukhumbu', seats: 2 },
    { slug: 'okhaldhunga', name: 'Okhaldhunga', seats: 2 },
    { slug: 'khotang',   name: 'Khotang',   seats: 3 },
    { slug: 'udayapur',  name: 'Udayapur',  seats: 4 },
  ]},
  { id: 2, slug: 'pradesh-2',  name: 'Madhesh',        districts: [
    { slug: 'saptari',   name: 'Saptari',   seats: 5 },
    { slug: 'siraha',    name: 'Siraha',    seats: 6 },
    { slug: 'dhanusha',  name: 'Dhanusha',  seats: 7 },
    { slug: 'mahottari', name: 'Mahottari', seats: 6 },
    { slug: 'sarlahi',   name: 'Sarlahi',   seats: 7 },
    { slug: 'rautahat',  name: 'Rautahat',  seats: 6 },
    { slug: 'bara',      name: 'Bara',      seats: 6 },
    { slug: 'parsa',     name: 'Parsa',     seats: 5 },
  ]},
  { id: 3, slug: 'pradesh-3',  name: 'Bagmati',        districts: [
    { slug: 'sindhuli',  name: 'Sindhuli',  seats: 4 },
    { slug: 'ramechhap', name: 'Ramechhap', seats: 3 },
    { slug: 'dolakha',   name: 'Dolakha',   seats: 3 },
    { slug: 'sindhupalchok', name: 'Sindhupalchok', seats: 5 },
    { slug: 'kavrepalanchok', name: 'Kavrepalanchok', seats: 5 },
    { slug: 'lalitpur',  name: 'Lalitpur',  seats: 5 },
    { slug: 'bhaktapur', name: 'Bhaktapur', seats: 4 },
    { slug: 'kathmandu', name: 'Kathmandu', seats: 10 },
    { slug: 'nuwakot',   name: 'Nuwakot',   seats: 4 },
    { slug: 'rasuwa',    name: 'Rasuwa',    seats: 1 },
    { slug: 'dhading',   name: 'Dhading',   seats: 4 },
    { slug: 'makwanpur', name: 'Makwanpur', seats: 4 },
    { slug: 'chitwan',   name: 'Chitwan',   seats: 6 },
  ]},
  { id: 4, slug: 'pradesh-4',  name: 'Gandaki',        districts: [
    { slug: 'gorkha',    name: 'Gorkha',    seats: 4 },
    { slug: 'manang',    name: 'Manang',    seats: 1 },
    { slug: 'mustang',   name: 'Mustang',   seats: 1 },
    { slug: 'myagdi',    name: 'Myagdi',    seats: 2 },
    { slug: 'kaski',     name: 'Kaski',     seats: 6 },
    { slug: 'lamjung',   name: 'Lamjung',   seats: 3 },
    { slug: 'tanahu',    name: 'Tanahu',    seats: 4 },
    { slug: 'nawalpur',  name: 'Nawalpur',  seats: 4 },
    { slug: 'syangja',   name: 'Syangja',   seats: 4 },
    { slug: 'parbat',    name: 'Parbat',    seats: 2 },
    { slug: 'baglung',   name: 'Baglung',   seats: 3 },
  ]},
  { id: 5, slug: 'pradesh-5',  name: 'Lumbini',        districts: [
    { slug: 'rukum-east', name: 'Rukum East', seats: 2 },
    { slug: 'rolpa',     name: 'Rolpa',     seats: 3 },
    { slug: 'pyuthan',   name: 'Pyuthan',   seats: 3 },
    { slug: 'gulmi',     name: 'Gulmi',     seats: 4 },
    { slug: 'arghakhanchi', name: 'Arghakhanchi', seats: 3 },
    { slug: 'palpa',     name: 'Palpa',     seats: 4 },
    { slug: 'nawalparasi-east', name: 'Nawalparasi East', seats: 3 },
    { slug: 'rupandehi', name: 'Rupandehi', seats: 8 },
    { slug: 'kapilvastu', name: 'Kapilvastu', seats: 5 },
    { slug: 'dang',      name: 'Dang',      seats: 5 },
    { slug: 'banke',     name: 'Banke',     seats: 5 },
    { slug: 'bardiya',   name: 'Bardiya',   seats: 4 },
  ]},
  { id: 6, slug: 'pradesh-6',  name: 'Karnali',        districts: [
    { slug: 'dolpa',     name: 'Dolpa',     seats: 1 },
    { slug: 'mugu',      name: 'Mugu',      seats: 1 },
    { slug: 'humla',     name: 'Humla',     seats: 1 },
    { slug: 'jumla',     name: 'Jumla',     seats: 2 },
    { slug: 'kalikot',   name: 'Kalikot',   seats: 2 },
    { slug: 'dailekh',   name: 'Dailekh',   seats: 3 },
    { slug: 'jajarkot',  name: 'Jajarkot',  seats: 2 },
    { slug: 'rukum-west', name: 'Rukum West', seats: 2 },
    { slug: 'salyan',    name: 'Salyan',    seats: 3 },
    { slug: 'surkhet',   name: 'Surkhet',   seats: 4 },
  ]},
  { id: 7, slug: 'pradesh-7',  name: 'Sudurpaschim',   districts: [
    { slug: 'bajura',    name: 'Bajura',    seats: 2 },
    { slug: 'bajhang',   name: 'Bajhang',   seats: 3 },
    { slug: 'achham',    name: 'Achham',    seats: 3 },
    { slug: 'doti',      name: 'Doti',      seats: 3 },
    { slug: 'kailali',   name: 'Kailali',   seats: 7 },
    { slug: 'kanchanpur', name: 'Kanchanpur', seats: 5 },
    { slug: 'dadeldhura', name: 'Dadeldhura', seats: 2 },
    { slug: 'baitadi',   name: 'Baitadi',   seats: 4 },
    { slug: 'darchula',  name: 'Darchula',  seats: 2 },
  ]},
];

const BASE = 'https://election.ekantipur.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://election.ekantipur.com/',
};

// ─── Candidate parser ─────────────────────────────────────────────────────────
function parseCandidatesFromHtml(html, meta) {
  const $ = cheerio.load(html);
  const candidates = [];

  // ekantipur renders candidate rows with specific class patterns
  // Try structured selectors first
  $('table tbody tr').each((i, el) => {
    const tds = $(el).find('td');
    if (tds.length < 3) return;
    const name = $(tds[0]).text().trim();
    const party = $(tds[1]).text().trim();
    const votesRaw = $(tds[2]).text().replace(/,/g, '').trim();
    const votes = parseInt(votesRaw) || 0;
    const status = $(tds[3] || tds[2]).text().trim();
    if (name && name.length > 2 && name.length < 80 && !/^\d+$/.test(name)) {
      candidates.push({
        name, party: party || null,
        votes, status: status || '',
        constituency: meta.constituency, district: meta.district, province: meta.province,
      });
    }
  });

  // Try card/div-based layout
  if (candidates.length === 0) {
    $('[class*="candidate"],[class*="result-row"],[class*="cand-row"]').each((i, el) => {
      const name = $(el).find('[class*="name"],[class*="cand-name"],h5,h6').first().text().trim();
      const party = $(el).find('[class*="party"],[class*="party-name"]').first().text().trim();
      const votesRaw = $(el).find('[class*="vote"],[class*="count"],[class*="total"]').first().text().replace(/,/g,'').trim();
      const votes = parseInt(votesRaw) || 0;
      const status = $(el).find('[class*="status"],[class*="win"],[class*="lead"]').first().text().trim();
      if (name && name.length > 2 && name.length < 80) {
        candidates.push({
          name, party: party || null,
          votes, status,
          constituency: meta.constituency, district: meta.district, province: meta.province,
        });
      }
    });
  }

  // Mark as Unknown only if truly no party found (not empty string from wrong selector)
  return candidates.map(c => ({ ...c, party: c.party || 'Unknown' }));
}

// ─── Fetch one constituency page ─────────────────────────────────────────────
async function fetchConstituency(province, district, num) {
  const url = `${BASE}/${province.slug}/district-${district.slug}/constituency-${num}?lng=eng`;
  try {
    const r = await axios.get(url, { headers: HEADERS, timeout: 12000 });
    const candidates = parseCandidatesFromHtml(r.data, {
      constituency: `${district.name}-${num}`,
      district: district.name,
      province: province.name,
    });
    return { url, candidates, ok: true };
  } catch (e) {
    return { url, candidates: [], ok: false, error: e.message };
  }
}

// ─── Also try popular-candidates page ────────────────────────────────────────
async function fetchPopularCandidates() {
  try {
    const r = await axios.get(`${BASE}/popular-candidates?lng=eng`, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(r.data);
    const candidates = [];

    // Parse the popular candidates page more aggressively
    const bodyText = $('body').text().replace(/\s+/g, ' ');
    
    // Find all candidate rows - look for vote number patterns  
    // Common pattern on such pages: Rank | Name | Party | Votes | Lead/Win | Constituency
    $('tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length < 4) return;
      // Popular candidates table: rank | name | party | votes | constituency
      const rank = $(tds[0]).text().trim();
      if (!/^\d+$/.test(rank)) return; // skip header rows
      const name = $(tds[1]).text().trim();
      const party = $(tds[2]).text().trim();
      const votesRaw = $(tds[3]).text().replace(/,/g,'').trim();
      const votes = parseInt(votesRaw) || 0;
      const constituency = $(tds[4] || tds[3]).text().trim();
      if (name && name.length > 2 && name.length < 80 && votes > 0) {
        candidates.push({ name, party: party || 'Unknown', votes, status: '', constituency, district: '', province: '' });
      }
    });
    // Also try card layout
    $('[class*="popular"],[class*="top-cand"],[class*="candidate-card"]').each((i, el) => {
      const name = $(el).find('[class*="name"],h5,h6,strong').first().text().trim();
      const party = $(el).find('[class*="party"]').first().text().trim();
      const votesRaw = $(el).find('[class*="vote"],[class*="count"]').first().text().replace(/,/g,'').trim();
      const votes = parseInt(votesRaw) || 0;
      if (name && name.length > 2 && votes > 0) {
        candidates.push({ name, party: party || 'Unknown', votes, status: '', constituency: '', district: '', province: '' });
      }
    });

    return { candidates, rawHtml: r.data.substring(0, 5000) };
  } catch (e) {
    return { candidates: [], rawHtml: '', error: e.message };
  }
}

// ─── Main data fetch ──────────────────────────────────────────────────────────
let cachedData = null;
let lastFetched = null;
const CACHE_TTL = 60 * 1000; // 60s for heavier scrape

async function fetchAllData() {
  console.log('[scraper] Starting full candidate scrape...');
  
  // First try popular-candidates page
  const popular = await fetchPopularCandidates();
  console.log(`[popular] got ${popular.candidates.length} candidates`);

  // Then try to get per-constituency data for first few provinces
  // Rate-limit: fetch with small delays, max 30 concurrent requests total
  const allCandidates = [...popular.candidates];
  const constituencies = [];

  for (const province of PROVINCES) {
    for (const district of province.districts) {
      for (let n = 1; n <= district.seats; n++) {
        constituencies.push({ province, district, num: n });
      }
    }
  }

  console.log(`[scraper] ${constituencies.length} total constituencies to fetch`);

  // Fetch in batches of 5
  const BATCH = 5;
  let fetchedCount = 0;
  for (let i = 0; i < Math.min(constituencies.length, 100); i += BATCH) {
    const batch = constituencies.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(c => fetchConstituency(c.province, c.district, c.num)));
    for (const r of results) {
      if (r.ok && r.candidates.length > 0) {
        allCandidates.push(...r.candidates);
        fetchedCount++;
      }
    }
    await new Promise(res => setTimeout(res, 300)); // small delay between batches
  }

  console.log(`[scraper] Got ${allCandidates.length} total candidate entries from ${fetchedCount} constituencies`);

  // Clean up messy status fields (raw HTML text blobs)
  for (const c of allCandidates) {
    if (c.status) {
      // Extract just the meaningful part: won/leading/trailing
      const s = c.status.replace(/\s+/g, ' ').trim();
      if (/won|winner/i.test(s)) c.status = 'won';
      else if (/lead/i.test(s)) c.status = 'leading';
      else c.status = '';
    }
    // Clean name too
    if (c.name) c.name = c.name.replace(/\s+/g, ' ').trim();
  }

  // Build a party lookup: name -> best known party (not Unknown)
  const partyLookup = new Map();
  for (const c of allCandidates) {
    if (!c.name || !c.party || c.party === 'Unknown') continue;
    const key = c.name.trim().toLowerCase();
    if (!partyLookup.has(key)) partyLookup.set(key, c.party);
  }

  // Deduplicate by name only — one entry per candidate, keep highest votes.
  // Then reconcile Unknown parties using the lookup above.
  const byName = new Map();
  for (const c of allCandidates) {
    if (!c.name || c.name.length < 2) continue;
    const key = c.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing || (c.votes||0) > (existing.votes||0)) byName.set(key, c);
  }

  // Reconcile: fill in Unknown party from lookup
  for (const [key, c] of byName.entries()) {
    if ((!c.party || c.party === 'Unknown') && partyLookup.has(key)) {
      c.party = partyLookup.get(key);
    }
  }

  const unique = [...byName.values()].sort((a, b) => (b.votes||0) - (a.votes||0));

  // Group by party for summary
  const partyMap = {};
  for (const c of unique) {
    const p = c.party || 'Unknown';
    if (!partyMap[p]) partyMap[p] = { name: p, candidates: 0, totalVotes: 0, won: 0, leading: 0 };
    partyMap[p].candidates++;
    partyMap[p].totalVotes += c.votes || 0;
    if (/won|winner/i.test(c.status)) partyMap[p].won++;
    else if (/lead/i.test(c.status)) partyMap[p].leading++;
  }
  const parties = Object.values(partyMap).sort((a, b) => b.totalVotes - a.totalVotes);

  return {
    fetchedAt: new Date().toISOString(),
    candidates: unique,
    parties,
    totalCandidates: unique.length,
    popularRaw: popular.rawHtml,
  };
}

async function refreshCache() {
  try {
    cachedData = await fetchAllData();
    lastFetched = Date.now();
    console.log(`[cache] Updated — ${cachedData.candidates.length} candidates`);
  } catch (e) {
    console.error('[cache] Error:', e.message);
    if (!cachedData) cachedData = { error: e.message, candidates: [], parties: [], fetchedAt: new Date().toISOString() };
  }
}

refreshCache();
setInterval(refreshCache, CACHE_TTL);

// ─── API routes ───────────────────────────────────────────────────────────────
app.get('/api/candidates', async (req, res) => {
  if (!cachedData) await refreshCache();
  const { search, party, province, page = 1, limit = 100 } = req.query;
  let results = cachedData.candidates || [];
  if (search) results = results.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.constituency.toLowerCase().includes(search.toLowerCase()));
  if (party) results = results.filter(c => c.party?.toLowerCase().includes(party.toLowerCase()));
  if (province) results = results.filter(c => c.province?.toLowerCase().includes(province.toLowerCase()));
  const total = results.length;
  const start = (parseInt(page) - 1) * parseInt(limit);
  res.json({
    candidates: results.slice(start, start + parseInt(limit)),
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    cacheAge: lastFetched ? Math.round((Date.now() - lastFetched) / 1000) : null,
    nextRefresh: lastFetched ? Math.max(0, Math.round((CACHE_TTL - (Date.now() - lastFetched)) / 1000)) : 0,
    fetchedAt: cachedData.fetchedAt,
  });
});

app.get('/api/results', async (req, res) => {
  if (!cachedData) await refreshCache();
  res.json({
    parties: cachedData.parties || [],
    totalCandidates: cachedData.totalCandidates || 0,
    fetchedAt: cachedData.fetchedAt,
    cacheAge: lastFetched ? Math.round((Date.now() - lastFetched) / 1000) : null,
    nextRefresh: lastFetched ? Math.max(0, Math.round((CACHE_TTL - (Date.now() - lastFetched)) / 1000)) : 0,
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, lastFetched, uptime: process.uptime() }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.listen(PORT, () => console.log(`Nepal Election server on port ${PORT}`));
