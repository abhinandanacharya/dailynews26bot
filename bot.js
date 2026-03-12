/**
 * ╔══════════════════════════════════════════════════════╗
 * ║    📰  @DailyNews26Bot  —  v4  In-App Popup Edition  ║
 * ║        Powered by Google News RSS  •  Node.js        ║
 * ╚══════════════════════════════════════════════════════╝
 *
 *  Install : npm install
 *  Run     : node bot.js
 *  Dev     : npm run dev
 *
 *  What's new in v4:
 *  ✅ "📖 Read" button opens an in-chat popup (no browser jump!)
 *  ✅ Popup shows full article card with title, source, time, snippet
 *  ✅ "🌐 Open in browser" secondary button for those who want it
 *  ✅ Article cache with 30-min auto-expiry
 */

"use strict";

const TelegramBot = require("node-telegram-bot-api");
const axios       = require("axios");
const xml2js      = require("xml2js");
require('dotenv').config();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TOKEN    = process.env.TELEGRAM_TOKEN;
const RSS_BASE = process.env.RSS_BASE;
const MAX      = 6;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  IN-MEMORY ARTICLE CACHE  (powers in-app popups)
//  Each article is stored for 30 min then auto-evicted
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const articleCache = new Map();
const CACHE_TTL    = 30 * 60 * 1000; // 30 minutes
let   cacheSeq     = 0;

function storeArticle(art) {
  const id = `a${++cacheSeq}`;
  articleCache.set(id, { ...art, cachedAt: Date.now() });
  setTimeout(() => articleCache.delete(id), CACHE_TTL);
  return id;
}

// Periodic cleanup every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [id, a] of articleCache) {
    if (now - a.cachedAt > CACHE_TTL) articleCache.delete(id);
  }
}, 10 * 60 * 1000);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BOT INIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const bot = new TelegramBot(TOKEN, { polling: true });
log("info", "🚀  @DailyNews26Bot v4 (In-App Popup Edition) is live!");

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
  top_headlines:       { emoji: "🌐", label: "Top Headlines",        accent: "🔥 BREAKING"  },
  world:               { emoji: "🌍", label: "World News",            accent: "🌐 GLOBAL"    },
  india:               { emoji: "🇮🇳", label: "India Headlines",      accent: "🇮🇳 INDIA"    },
  tech:                { emoji: "💻", label: "Technology",            accent: "⚡ TECH"      },
  business:            { emoji: "📈", label: "Business & Markets",    accent: "💼 BUSINESS"  },
  entertainment:       { emoji: "🎬", label: "Entertainment",         accent: "🎭 SHOWBIZ"   },
  sports:              { emoji: "⚽", label: "Sports",                accent: "🏆 SPORTS"    },
  science:             { emoji: "🔬", label: "Science",               accent: "🧪 SCIENCE"   },
  health:              { emoji: "💊", label: "Health",                accent: "❤️ HEALTH"   },
  india_business:      { emoji: "🇮🇳📈", label: "India Business",     accent: "💼 INDIA BIZ" },
  india_tech:          { emoji: "🇮🇳💻", label: "India Technology",   accent: "⚡ INDIA TECH" },
  india_entertainment: { emoji: "🇮🇳🎬", label: "India Entertainment",accent: "🎥 BOLLYWOOD" },
  india_sports:        { emoji: "🇮🇳⚽", label: "India Sports",       accent: "🏏 INDIA"     },
  cricket:             { emoji: "🏏", label: "Cricket",               accent: "🏆 CRICKET"   },
  bollywood:           { emoji: "🎥", label: "Bollywood",             accent: "⭐ FILMI"     },
  stock_market:        { emoji: "📊", label: "Stock Market",          accent: "📉 MARKETS"   },
  startups:            { emoji: "🚀", label: "Startups",              accent: "💡 STARTUPS"  },
  ai_news:             { emoji: "🤖", label: "AI & Tech",             accent: "🧠 AI"        },
  space:               { emoji: "🌌", label: "Space",                 accent: "🚀 COSMOS"    },
  politics:            { emoji: "🏛️", label: "Politics",             accent: "🗳️ POLITICS"  },
  economy:             { emoji: "💹", label: "Economy",               accent: "💰 ECONOMY"   },
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
      // Extract real URL from inside RSS description HTML
      const rawDesc   = String(item.description || "");
      const linkMatch = rawDesc.match(/href="(https?:\/\/[^"]+)"/);
      const realLink  = linkMatch ? linkMatch[1] : (item.link || item.guid || "");

      // Extract any snippet text from description (strip all tags)
      const snippet = cleanText(rawDesc).slice(0, 200);

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
//  CARD BUILDER  (returns text + inline keyboard)
//  "Read" buttons now use callback_data → in-app popup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildCards(articles, key) {
  const meta = CATEGORY_META[key] || { emoji: "📰", label: key, accent: "NEWS" };

  if (!articles.length) {
    return {
      text:
        `${meta.emoji} <b>${h(meta.label)}</b>\n\n` +
        `😔 <i>No articles found right now.</i>\n` +
        `Try again shortly or use /top_headlines`,
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

  // One inline-keyboard row per article: [ 👁 Read · 🌐 Web ]
  const keyboard = [];

  articles.forEach((art, i) => {
    const num    = String(i + 1).padStart(2, "0");
    const bullet = BULLETS[i % BULLETS.length];
    const title  = h(art.title.length > 95 ? art.title.slice(0, 92) + "…" : art.title);
    const source = h(art.source);
    const ago    = h(art.ago || art.pubDate);

    // Store article in cache — callback button will reference this ID
    const artId = storeArticle(art);

    lines.push(`${bullet} <b>${num}.</b>  <b>${title}</b>`);
    lines.push(`     🏢 <code>${source}</code>   🕐 <i>${ago}</i>`);
    lines.push(`     ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`);
    lines.push(``);

    // Callback button (in-app popup) + optional browser button
    const row = [
      { text: `👁 Read #${num}`, callback_data: `read:${artId}` },
    ];
    if (art.link) {
      row.push({ text: `🌐 Web`, url: art.link });
    }
    keyboard.push(row);
  });

  lines.push(`<i>⚡ @DailyNews26Bot  •  Tap 👁 Read to view inside Telegram</i>`);
  lines.push(`<i>🌐 Tap Web to open in browser</i>`);

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
//  IN-APP ARTICLE POPUP BUILDER
//  Shown when user taps "👁 Read" button
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildArticlePopup(art) {
  const title   = h(art.title);
  const source  = h(art.source);
  const ago     = h(art.ago || art.pubDate);
  const pubDate = h(art.pubDate);
  const snippet = art.snippet ? h(art.snippet) : null;

  const lines = [
    `┌─────────────────────────┐`,
    `  📰  <b>ARTICLE DETAIL</b>`,
    `└─────────────────────────┘`,
    ``,
    `<b>${title}</b>`,
    ``,
    `🏢 <b>Source:</b>  <code>${source}</code>`,
    `🕐 <b>Published:</b>  <i>${pubDate}</i>  <code>(${ago})</code>`,
  ];

  if (snippet && snippet.length > 10) {
    lines.push(``);
    lines.push(`📝 <b>Summary:</b>`);
    lines.push(`<i>${snippet}</i>`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`<i>Want the full story? Tap 🌐 Open in Browser below.</i>`);

  return lines.join("\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CALLBACK QUERY HANDLER  (handles 👁 Read button taps)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data   = query.data || "";

  // ── read:<artId> ──────────────────────────────────
  if (data.startsWith("read:")) {
    const artId = data.slice(5);
    const art   = articleCache.get(artId);

    // Immediately answer the callback to stop the loading spinner
    await bot.answerCallbackQuery(query.id, { text: "Loading article…" });

    if (!art) {
      // Article expired from cache
      await bot.sendMessage(chatId,
        `⏰ <b>Article Expired</b>\n\n` +
        `This article is no longer cached (30-min limit).\n` +
        `Please run the command again to fetch fresh news.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const popupText = buildArticlePopup(art);

    // Build keyboard: close button + optional browser button
    const keyboard = [[{ text: "❌ Close", callback_data: "close" }]];
    if (art.link) {
      keyboard[0].unshift({ text: "🌐 Open in Browser", url: art.link });
    }

    await bot.sendMessage(chatId, popupText, {
      parse_mode:               "HTML",
      disable_web_page_preview: true,
      reply_markup:             { inline_keyboard: keyboard },
    });

    log("info", `📖 Article popup shown [${artId}] → chat ${chatId}`);
    return;
  }

  // ── close ─────────────────────────────────────────
  if (data === "close") {
    await bot.answerCallbackQuery(query.id, { text: "Closed ✓" });
    try {
      await bot.deleteMessage(chatId, query.message.message_id);
    } catch {
      // Message might already be deleted — ignore
    }
    return;
  }

  // Fallback for unknown callbacks
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
      "⚠️ <b>Oops!</b> Something went wrong fetching news.\nPlease try again in a moment.",
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
    `<i>Tap 👁 Read on any article to read it inside Telegram!</i>`,
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
    log("info", `/${key} from @${msg.from?.username || msg.chat.id}`);
    sendNews(msg.chat.id, key);
  });
}

// /start & /help
bot.onText(/\/(start|help)/, async (msg) => {
  const name = msg.from?.first_name || "friend";
  log("info", `/start from @${msg.from?.username || msg.chat.id}`);
  await bot.sendMessage(msg.chat.id, buildWelcome(name), {
    parse_mode:               "HTML",
    disable_web_page_preview: true,
  });
});

// All feed commands
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

bot.on("polling_error", (err) => log("error", "Polling:", err.message));
bot.on("error",         (err) => log("error", "BotError:", err.message));
process.on("unhandledRejection", (r) => log("error", "UnhandledRejection:", r));
process.on("uncaughtException",  (e) => log("error", "UncaughtException:", e.message));

process.on("SIGINT", () => {
  log("info", "🛑  Shutting down gracefully…");
  bot.stopPolling();
  process.exit(0);
});