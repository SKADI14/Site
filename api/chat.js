import crypto from "node:crypto";

const GENSHIN_MOBILE_APK_URL = "https://ys-api.mihoyo.com/event/download_porter/link/ys_cn/official/android_default";
const GENSHIN_PC_URL = "https://ys-api.mihoyo.com/event/download_porter/link/ys_cn/official/pc_default";

const JM_UA = "Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36";
const JM_APP_VERSION = process.env.JM_APP_VERSION || "2.0.19";
const JM_APP_TOKEN_SECRET = process.env.JM_APP_TOKEN_SECRET || "18comicAPP";
const JM_APP_DATA_SECRET = process.env.JM_APP_DATA_SECRET || "185Hcomic3PAPP7R";
const JM_DOMAIN_SERVER_SECRET = process.env.JM_DOMAIN_SERVER_SECRET || "diosfjckwpqpdfjkvnqQjsik";

const JM_DOMAIN_SERVER_URLS = [
  "https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt",
  "https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt"
];

const JM_FALLBACK_DOMAINS = [
  "www.cdnhjk.net",
  "www.cdngwc.cc",
  "www.cdngwc.net",
  "www.cdngwc.club",
  "www.cdnhjk.cc"
];

const JM_ALBUM_WEB_BASE = process.env.JM_ALBUM_WEB_BASE || "https://18comic.vip/album/";
const JM_IMAGE_BASE_DEFAULT = process.env.JM_IMAGE_BASE_DEFAULT || "https://cdn-msp.jmapinodeudzn.net";
const JM_MAX_DOWNLOAD_FILES = Number(process.env.JM_MAX_DOWNLOAD_FILES || 220);
const PUBLIC_API_BASE_URL = process.env.PUBLIC_API_BASE_URL || "https://backend-lilac-alpha.vercel.app";
const JM_ZIP_FETCH_CONCURRENCY = Number(process.env.JM_ZIP_FETCH_CONCURRENCY || 6);
const JM_ZIP_FETCH_TIMEOUT_MS = Number(process.env.JM_ZIP_FETCH_TIMEOUT_MS || 15000);
const JM_ZIP_FETCH_RETRY = Number(process.env.JM_ZIP_FETCH_RETRY || 2);

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

function isMobileUserAgent(userAgent) {
  if (!userAgent) {
    return false;
  }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}

function getLastUserMessage(messages) {
  if (!Array.isArray(messages)) {
    return "";
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && message.role === "user" && typeof message.content === "string") {
      return message.content;
    }
  }

  return "";
}

function md5Hex(text) {
  return crypto.createHash("md5").update(text, "utf8").digest("hex");
}

function decodeAesEcbBase64(base64Input, keySeed) {
  const key = Buffer.from(md5Hex(keySeed), "utf8");
  const encrypted = Buffer.from(base64Input, "base64");
  const decipher = crypto.createDecipheriv("aes-256-ecb", key, null);
  decipher.setAutoPadding(false);
  let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const padLength = decrypted[decrypted.length - 1];
  if (padLength > 0 && padLength <= 16) {
    decrypted = decrypted.subarray(0, decrypted.length - padLength);
  }
  return decrypted.toString("utf8");
}

function normalizeText(text) {
  return typeof text === "string" ? text.trim() : "";
}

function extractSearchKeyword(message) {
  const text = normalizeText(message);
  if (!text) {
    return "";
  }

  const explicit = text.match(/(?:帮我|请)?(?:找|搜)(?:一个|一下)?(.+?)(?:的)?本子/);
  if (explicit && explicit[1]) {
    return explicit[1].trim();
  }

  if (text.startsWith("搜本子") || text.startsWith("搜索本子")) {
    return text.replace(/^搜索?本子[:：\s]*/u, "").trim();
  }

  return "";
}

function extractDownloadAlbumId(message) {
  const text = normalizeText(message);
  if (!text) {
    return "";
  }

  const explicit = text.match(/(?:帮我|请)?下载\s*(?:jm)?\s*(\d{3,})\s*(?:的)?本子?/i);
  if (explicit && explicit[1]) {
    return explicit[1];
  }

  const generic = text.match(/(?:下载|下本子)\s*(?:jm)?\s*(\d{3,})/i);
  if (generic && generic[1]) {
    return generic[1];
  }

  return "";
}

function readEnvDomainList() {
  const raw = process.env.JM_API_DOMAINS || "";
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function dedupeDomains(domains) {
  const seen = new Set();
  const result = [];

  for (const domain of domains) {
    const clean = String(domain || "").trim();
    if (!clean || seen.has(clean)) {
      continue;
    }
    seen.add(clean);
    result.push(clean);
  }

  return result;
}

function stripLeadingNonAscii(input) {
  return String(input || "").replace(/^[^\x00-\x7F]+/, "");
}

async function fetchDynamicDomains() {
  for (const url of JM_DOMAIN_SERVER_URLS) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }

      const encrypted = stripLeadingNonAscii(await response.text());
      const plaintext = decodeAesEcbBase64(encrypted, JM_DOMAIN_SERVER_SECRET);
      const json = JSON.parse(plaintext);
      if (Array.isArray(json.Server) && json.Server.length > 0) {
        return json.Server.map((d) => String(d).trim()).filter(Boolean);
      }
    } catch (err) {
      continue;
    }
  }

  return [];
}

function makeJmHeaders(timestampSec) {
  return {
    "Accept": "*/*",
    "User-Agent": JM_UA,
    "X-Requested-With": "com.example.app",
    "token": md5Hex(`${timestampSec}${JM_APP_TOKEN_SECRET}`),
    "tokenparam": `${timestampSec},${JM_APP_VERSION}`
  };
}

async function callJmApiOnDomain(domain, routeWithQuery) {
  const timestampSec = Math.floor(Date.now() / 1000).toString();
  const url = `https://${domain}${routeWithQuery}`;
  const response = await fetch(url, {
    method: "GET",
    headers: makeJmHeaders(timestampSec)
  });

  if (!response.ok) {
    throw new Error(`JM API ${domain} returned ${response.status}`);
  }

  const raw = await response.json();
  if (!raw || typeof raw.data !== "string") {
    throw new Error(`JM API ${domain} returned invalid payload`);
  }

  const plaintext = decodeAesEcbBase64(raw.data, `${timestampSec}${JM_APP_DATA_SECRET}`);
  return JSON.parse(plaintext);
}

async function callJmApiWithFallback(routeWithQuery) {
  const dynamicDomains = await fetchDynamicDomains();
  const domains = dedupeDomains([...readEnvDomainList(), ...dynamicDomains, ...JM_FALLBACK_DOMAINS]);

  let lastError = null;
  for (const domain of domains) {
    try {
      const data = await callJmApiOnDomain(domain, routeWithQuery);
      return { data, domain };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("All JM API domains failed");
}

function toAlbumSummary(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const id = item.id != null ? String(item.id) : "";
  const title = item.name != null ? String(item.name) : "(无标题)";
  const authorRaw = item.author;
  const author = Array.isArray(authorRaw)
    ? authorRaw.join(" / ")
    : (authorRaw != null ? String(authorRaw) : "未知作者");

  if (!id) {
    return null;
  }

  return { id, title, author };
}

async function searchJmAlbums(keyword) {
  const safeKeyword = encodeURIComponent(keyword).replace(/%20/g, "+");
  const route = `/search?search_query=${safeKeyword}&o=mr&page=1`;
  const { data, domain } = await callJmApiWithFallback(route);
  const content = Array.isArray(data.content) ? data.content : [];
  return {
    domain,
    total: Number(data.total || 0),
    items: content.map(toAlbumSummary).filter(Boolean)
  };
}

async function getJmAlbumDetail(albumId) {
  const route = `/album?id=${encodeURIComponent(albumId)}`;
  const { data, domain } = await callJmApiWithFallback(route);
  return { data, domain };
}

async function getJmImageHost() {
  const route = "/setting?app_img_shunt=1&express=";
  const { data } = await callJmApiWithFallback(route);
  if (data && typeof data.img_host === "string" && data.img_host.trim()) {
    return data.img_host.trim();
  }
  return JM_IMAGE_BASE_DEFAULT;
}

async function getJmChapterImages(chapterId) {
  const route = `/chapter?id=${encodeURIComponent(chapterId)}`;
  const { data } = await callJmApiWithFallback(route);
  if (data && Array.isArray(data.images)) {
    return data.images.map((imageName) => String(imageName));
  }
  return [];
}

function makeAlbumWebUrl(albumId) {
  return `${JM_ALBUM_WEB_BASE}${albumId}`;
}

function makeApiUrl(pathname) {
  return new URL(pathname, PUBLIC_API_BASE_URL).toString();
}

function toSafeFileName(name) {
  return String(name || "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function getImageExtensionFromName(name) {
  const clean = String(name || "");
  const match = clean.match(/(\.jpg|\.jpeg|\.webp|\.png|\.gif)$/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return ".jpg";
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[index]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function getDosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = ((date.getHours() & 0x1F) << 11)
    | ((date.getMinutes() & 0x3F) << 5)
    | ((Math.floor(date.getSeconds() / 2)) & 0x1F);
  const dosDate = (((year - 1980) & 0x7F) << 9)
    | (((date.getMonth() + 1) & 0x0F) << 5)
    | (date.getDate() & 0x1F);
  return { dosTime, dosDate };
}

function writeUInt16LE(buffer, value, offset) {
  buffer.writeUInt16LE(value & 0xFFFF, offset);
}

function writeUInt32LE(buffer, value, offset) {
  buffer.writeUInt32LE(value >>> 0, offset);
}

function buildZipBuffer(entries) {
  const fileChunks = [];
  const centralChunks = [];
  const { dosTime, dosDate } = getDosDateTime();
  let localOffset = 0;

  for (const entry of entries) {
    const fileNameBuffer = Buffer.from(String(entry.name || "file.bin"), "utf8");
    const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || "");
    const crc = crc32(dataBuffer);
    const size = dataBuffer.length;

    const localHeader = Buffer.alloc(30 + fileNameBuffer.length);
    writeUInt32LE(localHeader, 0x04034b50, 0);
    writeUInt16LE(localHeader, 20, 4);
    writeUInt16LE(localHeader, 0x0800, 6);
    writeUInt16LE(localHeader, 0, 8);
    writeUInt16LE(localHeader, dosTime, 10);
    writeUInt16LE(localHeader, dosDate, 12);
    writeUInt32LE(localHeader, crc, 14);
    writeUInt32LE(localHeader, size, 18);
    writeUInt32LE(localHeader, size, 22);
    writeUInt16LE(localHeader, fileNameBuffer.length, 26);
    writeUInt16LE(localHeader, 0, 28);
    fileNameBuffer.copy(localHeader, 30);

    fileChunks.push(localHeader, dataBuffer);

    const centralHeader = Buffer.alloc(46 + fileNameBuffer.length);
    writeUInt32LE(centralHeader, 0x02014b50, 0);
    writeUInt16LE(centralHeader, 20, 4);
    writeUInt16LE(centralHeader, 20, 6);
    writeUInt16LE(centralHeader, 0x0800, 8);
    writeUInt16LE(centralHeader, 0, 10);
    writeUInt16LE(centralHeader, dosTime, 12);
    writeUInt16LE(centralHeader, dosDate, 14);
    writeUInt32LE(centralHeader, crc, 16);
    writeUInt32LE(centralHeader, size, 20);
    writeUInt32LE(centralHeader, size, 24);
    writeUInt16LE(centralHeader, fileNameBuffer.length, 28);
    writeUInt16LE(centralHeader, 0, 30);
    writeUInt16LE(centralHeader, 0, 32);
    writeUInt16LE(centralHeader, 0, 34);
    writeUInt16LE(centralHeader, 0, 36);
    writeUInt32LE(centralHeader, 0, 38);
    writeUInt32LE(centralHeader, localOffset, 42);
    fileNameBuffer.copy(centralHeader, 46);

    centralChunks.push(centralHeader);
    localOffset += localHeader.length + size;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const eocd = Buffer.alloc(22);
  writeUInt32LE(eocd, 0x06054b50, 0);
  writeUInt16LE(eocd, 0, 4);
  writeUInt16LE(eocd, 0, 6);
  writeUInt16LE(eocd, entries.length, 8);
  writeUInt16LE(eocd, entries.length, 10);
  writeUInt32LE(eocd, centralSize, 12);
  writeUInt32LE(eocd, localOffset, 16);
  writeUInt16LE(eocd, 0, 20);

  return Buffer.concat([...fileChunks, ...centralChunks, eocd], localOffset + centralSize + eocd.length);
}

function sanitizeZipFileName(name) {
  const safe = toSafeFileName(name);
  return safe ? `${safe}.zip` : "jm-download.zip";
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = [];
  for (let index = 0; index < workerCount; index += 1) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

async function fetchBinaryWithRetry(url, retryCount = JM_ZIP_FETCH_RETRY) {
  let lastError = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), JM_ZIP_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": JM_UA,
          "Referer": "https://localhost/"
        }
      });

      if (!response.ok) {
        throw new Error(`Upstream error ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error("Failed to fetch binary");
}

async function buildWebDownloadTask(albumId, albumData) {
  const title = albumData && albumData.name ? String(albumData.name) : `JM${albumId}`;
  const rawSeries = Array.isArray(albumData && albumData.series) ? albumData.series : [];
  const chapterList = rawSeries.length
    ? rawSeries.slice().sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
    : [{ id: albumId, name: "第1话", sort: 1 }];

  const imageHost = await getJmImageHost();
  const files = [];
  for (let chapterIndex = 0; chapterIndex < chapterList.length; chapterIndex += 1) {
    const chapter = chapterList[chapterIndex];
    const chapterId = String(chapter.id || albumId);
    const chapterTitle = chapter && chapter.name ? String(chapter.name) : `第${chapterIndex + 1}话`;
    const imageNames = await getJmChapterImages(chapterId);

    for (let imageIndex = 0; imageIndex < imageNames.length; imageIndex += 1) {
      if (files.length >= JM_MAX_DOWNLOAD_FILES) {
        break;
      }

      const imageName = imageNames[imageIndex];
      const ext = getImageExtensionFromName(imageName);
      const fileName = toSafeFileName(`${title}_${chapterTitle}_${String(imageIndex + 1).padStart(4, "0")}${ext}`);

      files.push({
        url: `${imageHost}/media/photos/${chapterId}/${imageName}`,
        name: fileName
      });
    }

    if (files.length >= JM_MAX_DOWNLOAD_FILES) {
      break;
    }
  }

  return {
    albumId: String(albumId),
    albumTitle: title,
    albumUrl: makeAlbumWebUrl(albumId),
    zipUrl: makeApiUrl(`/api/chat?action=jm-zip&albumId=${encodeURIComponent(albumId)}`),
    zipFileName: sanitizeZipFileName(title),
    files,
    truncated: files.length >= JM_MAX_DOWNLOAD_FILES,
    maxFiles: JM_MAX_DOWNLOAD_FILES
  };
}

function formatSearchReply(keyword, result) {
  if (!result.items.length) {
    return `没有搜到“${keyword}”相关本子。你可以换一个关键词试试。`;
  }

  const lines = [];
  lines.push(`帮你搜到了“${keyword}”相关结果（共 ${result.total} 条，展示前 5 条）：`);

  const top = result.items.slice(0, 5);
  for (let i = 0; i < top.length; i += 1) {
    const item = top[i];
    lines.push(`${i + 1}. [${item.id}] ${item.title} - ${item.author}`);
  }

  lines.push("你可以继续说：帮我下载<编号>的本子");
  return lines.join("\n");
}

function formatDownloadReply(albumId, title, task) {
  const lines = [];
  lines.push(`已定位本子 JM${albumId}：${title || "(无标题)"}`);

  if (task && Array.isArray(task.files) && task.files.length > 0) {
    lines.push(`网页已准备好下载任务，共 ${task.files.length} 张图片。`);
    lines.push("点击下面的“开始网页下载”按钮即可下载到本地。 ");
    if (task.truncated) {
      lines.push(`为了避免浏览器卡顿，本次最多准备 ${task.maxFiles} 张。`);
    }
  } else {
    lines.push("未能生成图片下载清单，你可以先打开在线页面查看。 ");
  }

  return lines.join("\n");
}

function getQueryValue(req, key) {
  if (!req || !req.query) {
    return "";
  }

  const value = req.query[key];
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

function isAllowedProxyHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return /(cdn-msp|jmapi|cdnhjk|cdngwc|18comic|jmcomic)/.test(host);
}

async function fetchBinary(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": JM_UA,
      "Referer": "https://localhost/"
    }
  });

  if (!response.ok) {
    throw new Error(`Upstream error ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function handleJmZipDownload(req, res) {
  const albumId = getQueryValue(req, "albumId").trim();
  if (!albumId) {
    return res.status(400).json({ error: "Missing albumId" });
  }

  try {
    const album = await getJmAlbumDetail(albumId);
    const task = await buildWebDownloadTask(albumId, album.data);

    if (!Array.isArray(task.files) || task.files.length === 0) {
      return res.status(404).json({ error: "No files to zip" });
    }

    const fetched = await mapWithConcurrency(task.files, JM_ZIP_FETCH_CONCURRENCY, async (file) => {
      try {
        const data = await fetchBinaryWithRetry(file.url);
        return { ok: true, name: file.name, data };
      } catch (err) {
        return {
          ok: false,
          name: file.name,
          error: err instanceof Error ? err.message : String(err)
        };
      }
    });

    const entries = fetched.filter((item) => item && item.ok).map((item) => ({
      name: item.name,
      data: item.data
    }));

    const failed = fetched.filter((item) => item && !item.ok);
    if (entries.length === 0) {
      return res.status(502).json({
        error: "All files failed to download",
        failed: failed.slice(0, 8)
      });
    }

    const zipBuffer = buildZipBuffer(entries);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${task.zipFileName}"`);
    return res.status(200).send(zipBuffer);
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleJmProxyDownload(req, res) {
  const targetUrl = getQueryValue(req, "url");
  const customName = getQueryValue(req, "filename");
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing url" });
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (err) {
    return res.status(400).json({ error: "Invalid url" });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).json({ error: "Invalid protocol" });
  }

  if (!isAllowedProxyHost(parsed.hostname)) {
    return res.status(403).json({ error: "Host not allowed" });
  }

  try {
    const response = await fetch(parsed.toString(), {
      method: "GET",
      headers: {
        "User-Agent": JM_UA,
        "Referer": "https://localhost/"
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error ${response.status}` });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const fallbackName = parsed.pathname.split("/").pop() || "download.bin";
    const fileName = toSafeFileName(customName || fallbackName || "download.bin") || "download.bin";
    const arrayBuffer = await response.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const action = getQueryValue(req, "action");
    if (action === "jm-zip") {
      return handleJmZipDownload(req, res);
    }
    if (action === "jm-file") {
      return handleJmProxyDownload(req, res);
    }

    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const lastUserMessage = getLastUserMessage(req.body && req.body.messages);
  if (lastUserMessage.includes("原神")) {
    const ua = req.headers["user-agent"] || "";
    const mobile = isMobileUserAgent(ua);
    const downloadUrl = mobile ? GENSHIN_MOBILE_APK_URL : GENSHIN_PC_URL;
    const reply = mobile
      ? "你提到了原神对吧？心怀感激的收下吧"
      : "你提到了原神对吧？满怀期待的收下吧";

    return res.status(200).json({
      reply,
      downloadUrl
    });
  }

  const searchKeyword = extractSearchKeyword(lastUserMessage);
  if (searchKeyword) {
    try {
      const result = await searchJmAlbums(searchKeyword);
      return res.status(200).json({
        reply: formatSearchReply(searchKeyword, result)
      });
    } catch (err) {
      return res.status(200).json({
        reply: `JM 搜索失败：${err instanceof Error ? err.message : String(err)}`
      });
    }
  }

  const albumId = extractDownloadAlbumId(lastUserMessage);
  if (albumId) {
    try {
      const album = await getJmAlbumDetail(albumId);
      const title = album && album.data && album.data.name ? String(album.data.name) : "";
      const task = await buildWebDownloadTask(albumId, album.data);

      return res.status(200).json({
        reply: formatDownloadReply(albumId, title, task),
        jmDownload: task
      });
    } catch (err) {
      return res.status(200).json({
        reply: `JM 下载失败：${err instanceof Error ? err.message : String(err)}`
      });
    }
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: req.body.messages
      })
    });

    const data = await response.json();

    res.status(200).json({
      reply: data.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
