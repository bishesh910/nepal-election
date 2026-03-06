# 🗳️ Nepal Election 2082 — Live Dashboard

A self-hosted election results dashboard that scrapes live data from **election.ekantipur.com** every 30 seconds.

## Why a backend server?

Ekantipur blocks direct browser requests (CORS + 403). This proxy server fetches the page server-side (bypassing CORS) and serves clean data to your frontend.

## Stack

- **Backend**: Node.js + Express + Cheerio (HTML scraping) + Axios
- **Frontend**: Vanilla HTML/CSS/JS (served by the same Express app)

## Quick Start (Local)

```bash
npm install
npm start
# Open http://localhost:3000
```

## Deploy to Railway (Free tier)

1. Push this folder to a GitHub repo
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select your repo — Railway auto-detects Node.js
4. Done! Your live URL will appear in the dashboard.

## Deploy to Render (Free tier)

1. Push to GitHub
2. Go to https://render.com → New Web Service
3. Connect repo, set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Deploy — free tier works fine for this.

## Deploy to a VPS (DigitalOcean, Linode, etc.)

```bash
# On your server:
git clone <your-repo>
cd nepal-election
npm install
npm install -g pm2
pm2 start server/index.js --name election
pm2 save
```

## Notes

- The scraper uses CSS selectors that match ekantipur's current HTML. If they redesign their site, selectors may need updating.
- If the site uses heavy JavaScript rendering (React/Next.js), you may need to switch to Puppeteer for headless browser scraping. The raw data panel in the UI will show you what's being captured.
- Refresh interval: 30 seconds (configurable via `CACHE_TTL` in `server/index.js`)

## Troubleshooting

- **Empty party data + raw blocks showing**: The site may render via JS. Switch to Puppeteer.
- **403 errors**: Ekantipur may have updated their bot detection. Try rotating User-Agent strings.
- **No data at all**: Check server logs with `npm start` and look for scrape errors.
