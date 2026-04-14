import * as fs from "fs";
import * as path from "path";

const __dirname = path.resolve();
const MEMORIES_DIR = path.join(__dirname, "data/memories");

export { MEMORIES_DIR };

/**
 * 检查并确保记忆目录存在
 */
export function ensureMemoriesDir() {
  if (!fs.existsSync(MEMORIES_DIR)) {
    fs.mkdirSync(MEMORIES_DIR, { recursive: true });
  }
}

/**
 * 解析记忆文件内容
 */
export function parseMemoriesFromContent(content: string, fileName: string): any[] {
  const memories: any[] = [];
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