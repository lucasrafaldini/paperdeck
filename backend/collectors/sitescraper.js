// Coletor de Conteúdo e Atualizações de Sites (RSS / Atom / Web Scraper)
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { readConfig } = require('../config');

const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function fetchUrl(targetUrl, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Muitos redirecionamentos'));

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return reject(e);
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(
      parsedUrl.toString(),
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) KindleDashboard/1.0',
          Accept: 'application/rss+xml, application/atom+xml, text/xml, text/html, application/xhtml+xml',
        },
        timeout: 5000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).toString();
          return resolve(fetchUrl(redirectUrl, maxRedirects - 1));
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
          if (body.length > 500000) {
            // Limite de 500KB para evitar sobrecarga
            req.destroy();
            resolve(body);
          }
        });
        res.on('end', () => resolve(body));
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function parseRssOrAtom(xml) {
  const items = [];
  // Procura por tags <item> (RSS) ou <entry> (Atom)
  const itemMatches = xml.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) || [];

  for (const rawItem of itemMatches.slice(0, 5)) {
    const titleMatch = rawItem.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const dateMatch =
      rawItem.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i);
    const linkMatch =
      rawItem.match(/<link[^>]*href="([^"]+)"/i) || rawItem.match(/<link[^>]*>([\s\S]*?)<\/link>/i);

    const title = titleMatch ? decodeEntities(titleMatch[1]) : '';
    const dateStr = dateMatch ? decodeEntities(dateMatch[1]) : '';
    const link = linkMatch ? decodeEntities(linkMatch[1]) : '';

    if (title) {
      let formattedDate = '';
      if (dateStr) {
        try {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            formattedDate = isToday
              ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          }
        } catch {}
      }
      items.push({ title, date: formattedDate, link });
    }
  }
  return items;
}

function parseHtmlScrape(html, baseUrl) {
  const items = [];

  // 1. Tenta achar links RSS em tags <link>
  const rssLinkMatch =
    html.match(/<link[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]*href=["']([^"']+)["'][^>]*type=["']application\/rss\+xml["']/i);
  if (rssLinkMatch) {
    return { hasRssFeedUrl: new URL(rssLinkMatch[1], baseUrl).toString() };
  }

  // 2. Extrai manchetes de tags <article> ou cabeçalhos <h1..h3> com links
  const articleMatches = html.match(/<article[\s>][\s\S]*?<\/article>/gi) || [];
  if (articleMatches.length > 0) {
    for (const art of articleMatches.slice(0, 5)) {
      const hMatch = art.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
      const timeMatch = art.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
      if (hMatch) {
        const title = decodeEntities(hMatch[1]);
        const date = timeMatch ? decodeEntities(timeMatch[1]) : '';
        if (title && title.length > 5) {
          items.push({ title, date });
        }
      }
    }
  }

  // Fallback: se nenhum artigo estruturado foi achado, pega cabeçalhos <h2> e <h3>
  if (items.length === 0) {
    const headings = html.match(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi) || [];
    for (const h of headings.slice(0, 5)) {
      const clean = decodeEntities(h);
      if (clean && clean.length > 8 && clean.length < 120) {
        items.push({ title: clean, date: '' });
      }
    }
  }

  return { items };
}

async function fetchSite(site) {
  const now = Date.now();
  const cached = cache.get(site.id);
  if (cached && now - cached.time < CACHE_TTL_MS) {
    return cached.data;
  }

  let posts = [];
  try {
    const rawContent = await fetchUrl(site.url);
    const isXml =
      rawContent.trim().startsWith('<?xml') ||
      rawContent.includes('<rss') ||
      rawContent.includes('<feed');

    if (isXml) {
      posts = parseRssOrAtom(rawContent);
    } else {
      const parsedHtml = parseHtmlScrape(rawContent, site.url);
      if (parsedHtml.hasRssFeedUrl) {
        try {
          const rssBody = await fetchUrl(parsedHtml.hasRssFeedUrl);
          posts = parseRssOrAtom(rssBody);
        } catch {
          posts = parsedHtml.items || [];
        }
      } else {
        posts = parsedHtml.items || [];
      }
    }
  } catch (err) {
    posts = [{ title: `Erro ao conectar: ${err.message || err}`, date: '' }];
  }

  const result = {
    id: site.id,
    name: site.name || site.url,
    url: site.url,
    posts: posts.slice(0, 4),
    updatedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };

  cache.set(site.id, { time: now, data: result });
  return result;
}

async function collect() {
  const config = readConfig();
  const sites = Array.isArray(config.customSites) && config.customSites.length > 0
    ? config.customSites
    : [
        {
          id: 'site_default',
          name: 'Notícias & Blog',
          url: 'https://news.ycombinator.com/rss',
        },
      ];

  const results = await Promise.allSettled(sites.map((s) => fetchSite(s)));
  const collectedSites = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      id: sites[i].id,
      name: sites[i].name || sites[i].url,
      url: sites[i].url,
      posts: [{ title: `Falha: ${String(r.reason)}`, date: '' }],
    };
  });

  return {
    tool: 'sitescraper',
    label: 'Conteúdo de Sites',
    confidence: 'live',
    sites: collectedSites,
  };
}

module.exports = {
  collect,
  fetchSite,
};
