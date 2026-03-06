import * as fs from "fs";
import * as path from "path";

const __dirname = path.resolve();
const MEMORIES_DIR = path.join(__dirname, "data/memories");
const EMBEDDINGS_DIR = path.join(MEMORIES_DIR, ".embeddings");

interface MinimalMemory {
  content: string;
  timestamp: string;
  type: string;
}

interface CachedItem {
  timestamp: string;
  type: string;
  embedding: number[];
}

interface CachedFile {
  file: string;
  generatedAt: string;
  items: CachedItem[];
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function extractKeywords(text: string): string[] {
  const chineseSegments = text.match(/[\u4E00-\u9FFF]+/g) || [];
  const chineseStop = new Set(['的', '了', '在', '是', '我', '你', '他', '她', '它', '和', '与', '及', '就', '还', '也', '都', '很', '被', '把', '这', '那', '哪', '么', '吗', '呢', '啊', '哦', '恩', '嗯', '啦', '呀', '吧', '着', '给', '上', '下', '中', '内', '外', '每', '各', '某', '其', '并', '而', '或', '且']);
  const ngrams: string[] = [];
  for (const seg of chineseSegments) {
    if (chineseStop.has(seg)) continue;
    const len = seg.length;
    for (let n = 3; n >= 2; n--) {
      if (len >= n) {
        for (let i = 0; i <= len - n; i++) {
          const gram = seg.slice(i, i + n);
          if (!chineseStop.has(gram)) {
            ngrams.push(gram);
          }
        }
      }
    }
  }
  const englishWords = (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(word =>
    word.length > 3 &&
    !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word)
  );
  const candidates = [...ngrams, ...englishWords];
  const freq: Record<string, number> = {};
  for (const c of candidates) {
    freq[c] = (freq[c] || 0) + 1;
  }
  const sorted = Object.keys(freq).sort((a, b) => {
    if (freq[b] !== freq[a]) return freq[b] - freq[a];
    return b.length - a.length;
  });
  return sorted.slice(0, 20);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const keywords = extractKeywords(text);
    const embedding = new Array(100).fill(0);
    keywords.forEach((keyword) => {
      const hash = keyword.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      const position = Math.abs(hash) % 100;
      embedding[position] = 1;
    });
    return embedding;
  } catch (_error) {
    return Array.from({ length: 100 }, () => Math.random() - 0.5);
  }
}

function parseMemoriesFromContent(content: string, fileName: string): MinimalMemory[] {
  const memories: MinimalMemory[] = [];
  const entries = content.split('---');
  for (const entry of entries) {
    const trimmedEntry = entry.trim();
    if (!trimmedEntry) continue;
    const lines = trimmedEntry.split('\n');
    const headerLine = lines.find(line => line.startsWith('## '));
    if (headerLine) {
      const headerMatch = headerLine.match(/^##\s+(\w+)\s+-\s+(.+)$/);
      if (headerMatch) {
        const [, type, timestamp] = headerMatch;
        const body = lines.slice(lines.indexOf(headerLine) + 1).join('\n').trim();
        if (body && body.length > 10 && !/^\s*$/.test(body)) {
          memories.push({
            content: body,
            timestamp,
            type: type.toLowerCase(),
          });
        }
      }
    }
  }
  return memories;
}

export async function ensurePreTodayVectorized(): Promise<void> {
  ensureDir(MEMORIES_DIR);
  ensureDir(EMBEDDINGS_DIR);
  const today = new Date().toISOString().split("T")[0];
  const files = fs.readdirSync(MEMORIES_DIR).filter(f => f.endsWith('.md') && !f.startsWith('.'));
  for (const file of files) {
    const base = path.basename(file);
    if (base === `${today}.md`) continue;
    const src = path.join(MEMORIES_DIR, base);
    const cache = path.join(EMBEDDINGS_DIR, `${base.replace(/\.md$/, '.json')}`);
    let need = true;
    if (fs.existsSync(cache)) {
      const cacheStat = fs.statSync(cache);
      const srcStat = fs.statSync(src);
      if (cacheStat.mtimeMs >= srcStat.mtimeMs) {
        need = false;
      }
    }
    if (need) {
      const content = fs.readFileSync(src, 'utf-8');
      const memories = parseMemoriesFromContent(content, base);
      const items: CachedItem[] = [];
      for (const m of memories) {
        const emb = await generateEmbedding(m.content);
        items.push({ timestamp: m.timestamp, type: m.type, embedding: emb });
      }
      const payload: CachedFile = {
        file: base,
        generatedAt: new Date().toISOString(),
        items,
      };
      fs.writeFileSync(cache, JSON.stringify(payload, null, 2));
    }
  }
  const longTermMd = path.join(MEMORIES_DIR, 'long-term.md');
  if (fs.existsSync(longTermMd)) {
    const cache = path.join(EMBEDDINGS_DIR, 'long-term.json');
    let need = true;
    if (fs.existsSync(cache)) {
      const cacheStat = fs.statSync(cache);
      const srcStat = fs.statSync(longTermMd);
      if (cacheStat.mtimeMs >= srcStat.mtimeMs) {
        need = false;
      }
    }
    if (need) {
      const content = fs.readFileSync(longTermMd, 'utf-8');
      const memories = parseMemoriesFromContent(content, 'long-term.md');
      const items: CachedItem[] = [];
      for (const m of memories) {
        const emb = await generateEmbedding(m.content);
        items.push({ timestamp: m.timestamp, type: m.type, embedding: emb });
      }
      const payload: CachedFile = {
        file: 'long-term.md',
        generatedAt: new Date().toISOString(),
        items,
      };
      fs.writeFileSync(cache, JSON.stringify(payload, null, 2));
    }
  }
}

export function getCachedEmbeddingsForFile(fileName: string): CachedItem[] | null {
  ensureDir(EMBEDDINGS_DIR);
  const cache = path.join(EMBEDDINGS_DIR, `${fileName.replace(/\.md$/, '.json')}`);
  if (!fs.existsSync(cache)) return null;
  try {
    const raw = fs.readFileSync(cache, 'utf-8');
    const parsed = JSON.parse(raw) as CachedFile;
    return parsed.items || [];
  } catch (_e) {
    return null;
  }
}

export { MEMORIES_DIR, EMBEDDINGS_DIR };