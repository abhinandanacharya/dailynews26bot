/**
 * ╔══════════════════════════════════════════════════════╗
 * ║    📰  @DailyNews26Bot  —  Express Edition           ║
 * ║        Render-ready  •  Node.js + Express            ║
 * ╚══════════════════════════════════════════════════════╝
 *
 *  Fixes:
 *  ✅ Express HTTP server → satisfies Render's port requirement
 *  ✅ Single polling instance → no more 409 Conflict
 *  ✅ Health check endpoint → Render knows service is alive
 *  ✅ Status dashboard at GET /
 *
 *  Install : npm install
 *  Run     : node bot.js
 *  Dev     : npm run dev
 * add express js
 */

"use strict";

const express     = require("express");
const TelegramBot = require("node-telegram-bot-api");
const axios       = require("axios");
const xml2js      = require("xml2js");
require('dotenv').config();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TOKEN    = process.env.TELEGRAM_TOKEN;
const PORT     = process.env.PORT ;
const RSS_BASE = process.env.RSS_BASE;
const MAX      = 6;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  EXPRESS APP  — Render requires an open HTTP port
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const app = express();
app.use(express.json());

// Track bot stats for dashboard
const stats = {
  startTime:     Date.now(),
  totalRequests: 0,
  lastCommand:   "—",
  lastUser:      "—",
  cacheSize:     0,
};

// GET /  →  Status dashboard (visible in browser)
app.get("/", (req, res) => {
  const uptime  = Math.floor((Date.now() - stats.startTime) / 1000);
  const hours   = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>@DailyNews26Bot — Status</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          font-family: 'Segoe UI', sans-serif;
          background: #0f0f1a;
          color: #e0e0f0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: #1a1a2e;
          border: 1px solid #2a2a4a;
          border-radius: 16px;
          padding: 40px;
          max-width: 520px;
          width: 100%;
          box-shadow: 0 0 40px rgba(0,245,212,0.08);
        }
        .header { text-align: center; margin-bottom: 32px; }
        .emoji  { font-size: 48px; display: block; margin-bottom: 12px; }
        h1      { font-size: 24px; color: #00f5d4; letter-spacing: -0.5px; }
        .sub    { color: #666; font-size: 13px; margin-top: 4px; }
        .badge  {
          display: inline-block;
          background: rgba(0,245,212,0.12);
          border: 1px solid rgba(0,245,212,0.3);
          color: #00f5d4;
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 12px;
          margin-top: 10px;
        }
        .stats  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
        .stat   {
          background: #0f0f1a;
          border: 1px solid #2a2a4a;
          border-radius: 10px;
          padding: 16px;
          text-align: center;
        }
        .stat-value { font-size: 22px; font-weight: 700; color: #00f5d4; }
        .stat-label { font-size: 11px; color: #555; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; }
        .info   { font-size: 12px; color: #555; margin-top: 4px; }
        .row    { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #1f1f3a; font-size: 13px; }
        .row:last-child { border-bottom: none; }
        .row-label { color: #666; }
        .row-value { color: #ccc; font-family: monospace; }
        .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #444; }
        .dot { width:8px; height:8px; border-radius:50%; background:#00f5d4; display:inline-block; margin-right:6px; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="emoji">📰</span>
          <h1>@DailyNews26Bot</h1>
          <div class="sub">Telegram News Bot • Powered by Google News RSS</div>
          <div class="badge"><span class="dot"></span>ONLINE</div>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="stat-value">${hours}h ${minutes}m</div>
            <div class="stat-label">Uptime</div>
          </div>
          <div class="stat">
            <div class="stat-value">${stats.totalRequests}</div>
            <div class="stat-label">Commands Served</div>
          </div>
          <div class="stat">
            <div class="stat-value">${stats.cacheSize}</div>
            <div class="stat-label">Cached Articles</div>
          </div>
          <div class="stat">
            <div class="stat-value">22+</div>
            <div class="stat-label">News Categories</div>
          </div>
        </div>

        <div>
          <div class="row">
            <span class="row-label">Last Command</span>
            <span class="row-value">${stats.lastCommand}</span>
          </div>
          <div class="row">
            <span class="row-label">Last User</span>
            <span class="row-value">@${stats.lastUser}</span>
          </div>
          <div class="row">
            <span class="row-label">Node Version</span>
            <span class="row-value">${process.version}</span>
          </div>
          <div class="row">
            <span class="row-label">Environment</span>
            <span class="row-value">${process.env.NODE_ENV || "production"}</span>
          </div>
          <div class="row">
            <span class="row-label">RSS Source</span>
            <span class="row-value">Google News RSS</span>
          </div>
        </div>

        <div class="footer">
          Deployed on Render • Built with Node.js + Express<br>
          <a href="https://t.me/DailyNews26Bot" style="color:#00f5d4;text-decoration:none;">
            Open in Telegram →
          </a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// GET /health  →  Render health check ping
app.get("/health", (req, res) => {
  res.status(200).json({
    status:   "ok",
    bot:      "@DailyNews26Bot",
    uptime:   Math.floor((Date.now() - stats.startTime) / 1000),
    requests: stats.totalRequests,
    cache:    stats.cacheSize,
    time:     new Date().toISOString(),
  });
});

// Start HTTP server FIRST
app.listen(PORT, () => {
  log("info", `🌐  Express server running on port ${PORT}`);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  IN-MEMORY ARTICLE CACHE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const articleCache = new Map();
const CACHE_TTL    = 30 * 60 * 1000;
let   cacheSeq     = 0;

function storeArticle(art) {
  const id = `a${++cacheSeq}`;
  articleCache.set(id, { ...art, cachedAt: Date.now() });
  setTimeout(() => articleCache.delete(id), CACHE_TTL);
  stats.cacheSize = articleCache.size;
  return id;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, a] of articleCache) {
    if (now - a.cachedAt > CACHE_TTL) articleCache.delete(id);
  }
  stats.cacheSize = articleCache.size;
}, 10 * 60 * 1000);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BOT INIT  (polling — single instance only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const bot = new TelegramBot(TOKEN, {
  polling: {
    interval:          1000,   // Poll every 1 second
    autoStart:         true,
    params: {
      timeout:         10,     // Long-poll timeout (seconds)
      allowed_updates: ["message", "callback_query"],
    },
  },
});

log("info", "🤖  @DailyNews26Bot polling started!");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LOGGER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function log(level, ...args) {
  const ts  = new Date().toISOString().replace("T", " ").slice(0, 19);
  const tag = { info: "ℹ️", warn: "⚠️", error: "❌" }[level] ?? "▸";
  console.log(`[${ts}]  ${tag}  `, ...args);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RSS FEED CATALOG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FEEDS = {
  top_headlines:       `${RSS_BASE}?hl=en-IN&gl=IN&ceid=IN:en`,
  world:               `${RSS_BASE}/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en`,
  india:               `${RSS_BASE}/headlines/section/geo/IN?hl=en-IN&gl=IN&ceid=IN:en`,
  tech:                `${RSS_BASE}/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en`,
  business:            `${RSS_BASE}/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en`,
  entertainment:       `${RSS_BASE}/headlines/section/topic/ENTERTAINMENT?hl=en-IN&gl=IN&ceid=IN:en`,
  sports:              `${RSS_BASE}/headlines/section/topic/SPORTS?hl=en-IN&gl=IN&ceid=IN:en`,
  science:             `${RSS_BASE}/headlines/section/topic/SCIENCE?hl=en-IN&gl=IN&ceid=IN:en`,
  health:              `${RSS_BASE}/headlines/section/topic/HEALTH?hl=en-IN&gl=IN&ceid=IN:en`,
  india_business:      `${RSS_BASE}/search?q=india+business&hl=en-IN&gl=IN&ceid=IN:en`,
  india_tech:          `${RSS_BASE}/search?q=india+technology&hl=en-IN&gl=IN&ceid=IN:en`,
  india_entertainment: `${RSS_BASE}/search?q=india+entertainment+bollywood&hl=en-IN&gl=IN&ceid=IN:en`,
  india_sports:        `${RSS_BASE}/search?q=india+sports&hl=en-IN&gl=IN&ceid=IN:en`,
  cricket:             `${RSS_BASE}/search?q=cricket&hl=en-IN&gl=IN&ceid=IN:en`,
  bollywood:           `${RSS_BASE}/search?q=bollywood&hl=en-IN&gl=IN&ceid=IN:en`,
  stock_market:        `${RSS_BASE}/search?q=stock+market+sensex+nifty&hl=en-IN&gl=IN&ceid=IN:en`,
  startups:            `${RSS_BASE}/search?q=india+startups+funding&hl=en-IN&gl=IN&ceid=IN:en`,
  ai_news:             `${RSS_BASE}/search?q=artificial+intelligence+AI&hl=en-IN&gl=IN&ceid=IN:en`,
  space:               `${RSS_BASE}/search?q=space+ISRO+NASA&hl=en-IN&gl=IN&ceid=IN:en`,
  politics:            `${RSS_BASE}/search?q=india+politics&hl=en-IN&gl=IN&ceid=IN:en`,
  economy:             `${RSS_BASE}/search?q=india+economy+GDP&hl=en-IN&gl=IN&ceid=IN:en`,
};

const CATEGORY_META = {
  top_headlines:       { emoji: "🌐", label: "Top Headlines",        accent: "🔥 BREAKING"   },
  world:               { emoji: "🌍", label: "World News",            accent: "🌐 GLOBAL"     },
  india:               { emoji: "🇮🇳", label: "India Headlines",      accent: "🇮🇳 INDIA"     },
  tech:                { emoji: "💻", label: "Technology",            accent: "⚡ TECH"       },
  business:            { emoji: "📈", label: "Business & Markets",    accent: "💼 BUSINESS"   },
  entertainment:       { emoji: "🎬", label: "Entertainment",         accent: "🎭 SHOWBIZ"    },
  sports:              { emoji: "⚽", label: "Sports",                accent: "🏆 SPORTS"     },
  science:             { emoji: "🔬", label: "Science",               accent: "🧪 SCIENCE"    },
  health:              { emoji: "💊", label: "Health",                accent: "❤️ HEALTH"    },
  india_business:      { emoji: "🇮🇳📈", label: "India Business",     accent: "💼 INDIA BIZ"  },
  india_tech:          { emoji: "🇮🇳💻", label: "India Technology",   accent: "⚡ INDIA TECH" },
  india_entertainment: { emoji: "🇮🇳🎬", label: "India Entertainment",accent: "🎥 BOLLYWOOD"  },
  india_sports:        { emoji: "🇮🇳⚽", label: "India Sports",       accent: "🏏 INDIA"      },
  cricket:             { emoji: "🏏", label: "Cricket",               accent: "🏆 CRICKET"    },
  bollywood:           { emoji: "🎥", label: "Bollywood",             accent: "⭐ FILMI"      },
  stock_market:        { emoji: "📊", label: "Stock Market",          accent: "📉 MARKETS"    },
  startups:            { emoji: "🚀", label: "Startups",              accent: "💡 STARTUPS"   },
  ai_news:             { emoji: "🤖", label: "AI & Tech",             accent: "🧠 AI"         },
  space:               { emoji: "🌌", label: "Space",                 accent: "🚀 COSMOS"     },
  politics:            { emoji: "🏛️", label: "Politics",             accent: "🗳️ POLITICS"   },
  economy:             { emoji: "💹", label: "Economy",               accent: "💰 ECONOMY"    },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RSS FETCH & PARSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function fetchRSS(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 14_000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept":     "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    const parsed = await xml2js.parseStringPromise(data, {
      trim: true, explicitArray: false, ignoreAttrs: false,
    });

    const items = parsed?.rss?.channel?.item;
    if (!items) return [];
    const arr = Array.isArray(items) ? items : [items];

    return arr.slice(0, MAX).map((item) => {
      const rawDesc   = String(item.description || "");
      const linkMatch = rawDesc.match(/href="(https?:\/\/[^"]+)"/);
      const realLink  = linkMatch ? linkMatch[1] : (item.link || item.guid || "");
      const snippet   = cleanText(rawDesc).slice(0, 200);

      return {
        title:   cleanText(String(item.title || "No title")),
        link:    realLink,
        source:  extractSource(item),
        pubDate: prettyDate(item.pubDate || ""),
        ago:     timeAgo(item.pubDate || ""),
        snippet,
      };
    });
  } catch (err) {
    log("error", "fetchRSS:", err.message);
    return [];
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function cleanText(str = "") {
  return String(str)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g,  "&").replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g,    " ").trim();
}

function h(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractSource(item) {
  if (item.source) {
    if (typeof item.source === "string") return cleanText(item.source);
    if (item.source._)                   return cleanText(item.source._);
    if (item.source.$?.url)
      return item.source.$.url.replace(/https?:\/\/(www\.)?/, "").split("/")[0];
  }
  return "Google News";
}

function prettyDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff <    60) return `${diff}s ago`;
  if (diff <  3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const BULLETS = ["🔵", "🟢", "🟡", "🟠", "🔴", "🟣"];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CARD BUILDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCards(articles, key) {
  const meta = CATEGORY_META[key] || { emoji: "📰", label: key, accent: "NEWS" };

  if (!articles.length) {
    return {
      text: `${meta.emoji} <b>${h(meta.label)}</b>\n\n😔 <i>No articles found right now.</i>\nTry again shortly or use /top_headlines`,
      opts: { parse_mode: "HTML", disable_web_page_preview: true },
    };
  }

  const now   = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const lines = [
    `╔════════════════════════╗`,
    `  ${meta.emoji}  <b>${h(meta.label).toUpperCase()}</b>`,
    `  <code>${h(meta.accent)}</code>  ·  <i>${articles.length} stories</i>  ·  <code>${now}</code>`,
    `╚════════════════════════╝`,
    ``,
  ];

  const keyboard = [];

  articles.forEach((art, i) => {
    const num    = String(i + 1).padStart(2, "0");
    const bullet = BULLETS[i % BULLETS.length];
    const title  = h(art.title.length > 95 ? art.title.slice(0, 92) + "…" : art.title);
    const source = h(art.source);
    const ago    = h(art.ago || art.pubDate);
    const artId  = storeArticle(art);

    lines.push(`${bullet} <b>${num}.</b>  <b>${title}</b>`);
    lines.push(`     🏢 <code>${source}</code>   🕐 <i>${ago}</i>`);
    lines.push(`     ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`);
    lines.push(``);

    const row = [{ text: `👁 Read #${num}`, callback_data: `read:${artId}` }];
    if (art.link) row.push({ text: `🌐 Web`, url: art.link });
    keyboard.push(row);
  });

  lines.push(`<i>⚡ @DailyNews26Bot  •  Tap 👁 Read to view inside Telegram</i>`);

  return {
    text: lines.join("\n"),
    opts: {
      parse_mode:               "HTML",
      disable_web_page_preview: true,
      reply_markup:             { inline_keyboard: keyboard },
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ARTICLE POPUP BUILDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildArticlePopup(art) {
  const lines = [
    `┌─────────────────────────┐`,
    `  📰  <b>ARTICLE DETAIL</b>`,
    `└─────────────────────────┘`,
    ``,
    `<b>${h(art.title)}</b>`,
    ``,
    `🏢 <b>Source:</b>  <code>${h(art.source)}</code>`,
    `🕐 <b>Published:</b>  <i>${h(art.pubDate)}</i>  <code>(${h(art.ago)})</code>`,
  ];

  if (art.snippet && art.snippet.length > 10) {
    lines.push(``, `📝 <b>Summary:</b>`, `<i>${h(art.snippet)}</i>`);
  }

  lines.push(``, `━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`<i>Tap 🌐 Open in Browser for the full story.</i>`);

  return lines.join("\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CALLBACK QUERY HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data   = query.data || "";

  if (data.startsWith("read:")) {
    const art = articleCache.get(data.slice(5));
    await bot.answerCallbackQuery(query.id, { text: "Loading article…" });

    if (!art) {
      await bot.sendMessage(chatId,
        `⏰ <b>Article Expired</b>\n\nThis article is no longer cached.\nPlease run the command again to fetch fresh news.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const keyboard = [[{ text: "❌ Close", callback_data: "close" }]];
    if (art.link) keyboard[0].unshift({ text: "🌐 Open in Browser", url: art.link });

    await bot.sendMessage(chatId, buildArticlePopup(art), {
      parse_mode:               "HTML",
      disable_web_page_preview: true,
      reply_markup:             { inline_keyboard: keyboard },
    });
    return;
  }

  if (data === "close") {
    await bot.answerCallbackQuery(query.id, { text: "Closed ✓" });
    try { await bot.deleteMessage(chatId, query.message.message_id); } catch {}
    return;
  }

  await bot.answerCallbackQuery(query.id, { text: "Unknown action" });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SEND HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendNews(chatId, key, customQuery) {
  try {
    await bot.sendChatAction(chatId, "typing");

    const url      = customQuery
      ? `${RSS_BASE}/search?q=${encodeURIComponent(customQuery)}&hl=en-IN&gl=IN&ceid=IN:en`
      : FEEDS[key];

    const articles       = await fetchRSS(url);
    const { text, opts } = buildCards(articles, key);

    await bot.sendMessage(chatId, text, opts);
    log("info", `✅ Sent ${articles.length} cards [${key}] → chat ${chatId}`);
  } catch (err) {
    log("error", `sendNews [${key}]:`, err.message);
    await bot.sendMessage(chatId,
      "⚠️ <b>Oops!</b> Something went wrong. Please try again in a moment.",
      { parse_mode: "HTML" }
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  WELCOME MESSAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildWelcome(name) {
  return [
    `╔══════════════════════════╗`,
    `  📰  <b>DAILY NEWS BOT</b>  📰`,
    `  <code>@DailyNews26Bot  •  v4.0</code>`,
    `╚══════════════════════════╝`,
    ``,
    `👋 Hey <b>${h(name)}</b>! Welcome aboard!`,
    `<i>Your personal AI-powered news assistant.</i>`,
    `<i>Tap 👁 Read on any article to view inside Telegram!</i>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🌐 <b>GLOBAL NEWS</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔵 /top_headlines  — Breaking stories`,
    `🟢 /world          — International news`,
    `🟡 /tech           — Technology`,
    `🟠 /business       — Markets & finance`,
    `🔴 /science        — Discovery & research`,
    `🟣 /health         — Health & wellness`,
    `🔵 /sports         — Sports worldwide`,
    `🟢 /entertainment  — Movies & TV`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🇮🇳 <b>INDIA NEWS</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔵 /india               — India headlines`,
    `🟢 /india_business      — India business`,
    `🟡 /india_tech          — India technology`,
    `🟠 /india_entertainment — Bollywood & more`,
    `🔴 /india_sports        — India sports`,
    `🟣 /politics            — Indian politics`,
    `🔵 /economy             — Indian economy`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔥 <b>TRENDING TOPICS</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏏 /cricket       — Cricket & IPL`,
    `🎥 /bollywood     — Bollywood buzz`,
    `📊 /stock_market  — Sensex & Nifty`,
    `🚀 /startups      — Startup ecosystem`,
    `🤖 /ai_news       — AI & machine learning`,
    `🌌 /space         — ISRO, NASA & cosmos`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔍 <b>SEARCH</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💬 /search &lt;keywords&gt;`,
    `   <i>Example: /search IPL 2026 final</i>`,
    ``,
    `<i>⚡ All commands fetch fresh news instantly!</i>`,
  ].join("\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  COMMAND HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function cmd(pattern, key) {
  bot.onText(pattern, (msg) => {
    stats.totalRequests++;
    stats.lastCommand = `/${key}`;
    stats.lastUser    = msg.from?.username || String(msg.chat.id);
    log("info", `/${key} from @${msg.from?.username || msg.chat.id}`);
    sendNews(msg.chat.id, key);
  });
}

bot.onText(/\/(start|help)/, async (msg) => {
  stats.totalRequests++;
  stats.lastCommand = "/start";
  stats.lastUser    = msg.from?.username || String(msg.chat.id);
  const name = msg.from?.first_name || "friend";
  log("info", `/start from @${msg.from?.username || msg.chat.id}`);
  await bot.sendMessage(msg.chat.id, buildWelcome(name), {
    parse_mode: "HTML", disable_web_page_preview: true,
  });
});

cmd(/\/top_headlines/,       "top_headlines");
cmd(/\/world/,               "world");
cmd(/\/tech/,                "tech");
cmd(/\/business/,            "business");
cmd(/\/science/,             "science");
cmd(/\/health/,              "health");
cmd(/\/sports/,              "sports");
cmd(/\/entertainment/,       "entertainment");
cmd(/\/india(?!_)/,          "india");
cmd(/\/india_business/,      "india_business");
cmd(/\/india_tech/,          "india_tech");
cmd(/\/india_entertainment/, "india_entertainment");
cmd(/\/india_sports/,        "india_sports");
cmd(/\/cricket/,             "cricket");
cmd(/\/bollywood/,           "bollywood");
cmd(/\/stock_market/,        "stock_market");
cmd(/\/startups/,            "startups");
cmd(/\/ai_news/,             "ai_news");
cmd(/\/space/,               "space");
cmd(/\/politics/,            "politics");
cmd(/\/economy/,             "economy");

// /search <query>
bot.onText(/\/search (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query  = (match[1] || "").trim();
  if (!query) {
    await bot.sendMessage(chatId,
      `🔍 <b>Search Usage:</b>\n<code>/search your keywords</code>\n\n<i>Example: /search IPL 2026</i>`,
      { parse_mode: "HTML" }
    );
    return;
  }
  stats.totalRequests++;
  stats.lastCommand = `/search ${query}`;
  stats.lastUser    = msg.from?.username || String(chatId);
  log("info", `/search "${query}" from @${msg.from?.username}`);

  await bot.sendMessage(chatId,
    `🔍 <b>Searching for:</b>  <code>${h(query)}</code>\n\n⏳ <i>Fetching fresh results…</i>`,
    { parse_mode: "HTML" }
  );

  const key = `search_${Date.now()}`;
  CATEGORY_META[key] = { emoji: "🔍", label: `Search: ${query}`, accent: "🔎 RESULTS" };
  await sendNews(chatId, key, query);
  delete CATEGORY_META[key];
});

bot.onText(/^\/search$/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `🔍 <b>How to search:</b>\n\n<code>/search your topic</code>\n\n` +
    `<i>Examples:</i>\n• <code>/search IPL 2026</code>\n• <code>/search Budget India</code>\n• <code>/search Tesla</code>`,
    { parse_mode: "HTML" }
  );
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  UNKNOWN COMMAND
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const KNOWN = new Set([
  "start","help","top_headlines","world","tech","business","science",
  "health","sports","entertainment","india","india_business","india_tech",
  "india_entertainment","india_sports","cricket","bollywood","stock_market",
  "startups","ai_news","space","politics","economy","search",
]);

bot.on("message", async (msg) => {
  if (!msg.text?.startsWith("/")) return;
  const c = msg.text.split(/\s/)[0].replace("/","").toLowerCase().replace("@dailynews26bot","");
  if (!KNOWN.has(c) && !c.startsWith("india")) {
    await bot.sendMessage(msg.chat.id,
      `🤷 <b>Unknown command:</b> <code>/${h(c)}</code>\n\nType /help to see all available commands.`,
      { parse_mode: "HTML" }
    );
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ERROR HANDLING & GRACEFUL SHUTDOWN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

bot.on("polling_error", (err) => {
  // Ignore 409 on startup — it resolves once old instance is killed
  if (err.code === "ETELEGRAM" && err.message.includes("409")) {
    log("warn", "409 Conflict — waiting for old instance to stop…");
    return;
  }
  log("error", "Polling:", err.message);
});

bot.on("error", (err) => log("error", "BotError:", err.message));
process.on("unhandledRejection", (r) => log("error", "UnhandledRejection:", r));
process.on("uncaughtException",  (e) => log("error", "UncaughtException:", e.message));

process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);  // Render sends SIGTERM on deploy

function shutdown() {
  log("info", "🛑  Shutting down gracefully…");
  bot.stopPolling();
  process.exit(0);
}