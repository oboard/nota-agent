import { tool } from "ai";
import { z } from "zod";

export interface WebSearchItem {
  title: string;
  link: string;
  snippet: string;
  resolvedUrl: string;
  source: "baidu";
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtml(input: string): string {
  return decodeHtmlEntities(input.replace(/<em>|<\/em>/g, "").replace(/<[^>]+>/g, ""));
}

function pickSnippet(block: string): string {
  const candidates = [
    /<div[^>]*class\s*=\s*"[^"]*(c-abstract|content-right_8Zs40|c-span-last)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<span[^>]*class\s*=\s*"[^"]*(content-right_8Zs40|c-color-text)[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  ];

  for (const re of candidates) {
    const match = block.match(re);
    if (match) {
      return stripHtml(match[2] || match[1] || "");
    }
  }
  return "";
}

function tryGetMuUrl(block: string): string {
  // 百度部分结果会把落地页放在 mu/data-mu 属性里
  const muMatch = block.match(/\s(?:mu|data-mu)\s*=\s*"([^"]+)"/i);
  if (!muMatch) return "";
  try {
    return decodeURIComponent(muMatch[1]);
  } catch {
    return muMatch[1];
  }
}

export function extractBaiduResults(html: string, limit: number): Array<{ title: string; link: string; snippet: string; muUrl?: string }> {
  const results: Array<{ title: string; link: string; snippet: string; muUrl?: string }> = [];

  const blockRegex = /<h3[^>]*class\s*=\s*"[^"]*t[^"]*"[^>]*>[\s\S]*?<\/h3>[\s\S]*?(?=<h3[^>]*class\s*=\s*"[^"]*t[^"]*"|<\/body>)/gi;
  const blocks = html.match(blockRegex) || [];

  for (const block of blocks) {
    if (results.length >= limit) break;

    const titleMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i);
    const linkMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*href\s*=\s*"([^"]+)"/i);

    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    const link = linkMatch ? decodeHtmlEntities(linkMatch[1]) : "";
    const snippet = pickSnippet(block);
    const muUrl = tryGetMuUrl(block);

    if (title && link) {
      results.push({ title, link, snippet, muUrl: muUrl || undefined });
    }
  }

  return results;
}

function toAbsoluteBaiduUrl(url: string) {
  if (!url) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://www.baidu.com${url}`;
  return url;
}

export async function resolveBaiduRedirect(url: string): Promise<string> {
  const absolute = toAbsoluteBaiduUrl(url);
  if (!absolute) return url;

  // 若已是明确落地页，直接返回
  if (!/baidu\.com\/(link|from=|s\?wd=)/i.test(absolute)) {
    return absolute;
  }

  try {
    const response = await fetch(absolute, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    return response.url || absolute;
  } catch {
    return absolute;
  }
}

/**
 * 百度网页搜索工具
 */
export const webSearchTool = tool({
  description: `进行网页搜索（Baidu），返回 JSON 结构：{ query, total, results[] }，每条结果含 title/link/resolvedUrl/snippet/source。

支持的高级语法（直接写入 query）：
1) 精确匹配（双引号）: "前端GitHub"
   - 双引号内作为整体匹配，不拆词。
2) 书名号（《》）: 《JavaScript高级程序设计（第4版）》
   - 书名号会参与检索，括起内容尽量作为整体。
3) 排除词（-）: 全栈工程师 -java
   - 包含“全栈工程师”，排除“java”。
4) 必含词（+）: 全栈工程师 +node
   - 结果必须包含“node”。
5) 站内搜索（site:）: 问题描述 site:stackoverflow.com
   - 仅在指定站点内搜索。
6) 标题搜索（intitle:）: intitle:前端开发
   - 要求关键词出现在网页标题中。
7) URL 搜索（inurl:）: 前端教程 inurl:video
   - “video” 必须出现在 URL 中。
8) 文档类型（filetype:）: filetype:pdf JavaScript权威指南
   - 限定文档类型（如 pdf/doc/xls）。

说明：
- 本工具会尽量解析百度跳转链接，返回 resolvedUrl（落地页）。
- 若遭遇反爬或页面结构变化，可能出现结果为空或 error 字段。`,
  inputSchema: z.object({
    query: z.string().min(1, "搜索关键词不能为空").describe("搜索关键词"),
    limit: z.number().int().min(1).max(10).optional().describe("返回结果数量，默认 5"),
  }),
  execute: async ({ query, limit = 5 }) => {
    const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
      });

      if (!res.ok) {
        return {
          query,
          total: 0,
          results: [] as WebSearchItem[],
          error: `搜索失败：HTTP ${res.status}`,
        };
      }

      const html = await res.text();
      const parsed = extractBaiduResults(html, limit);

      const resolvedResults: WebSearchItem[] = await Promise.all(
        parsed.map(async (r) => {
          const resolvedUrl = r.muUrl || (await resolveBaiduRedirect(r.link));
          return {
            title: r.title,
            link: toAbsoluteBaiduUrl(r.link),
            snippet: r.snippet,
            resolvedUrl,
            source: "baidu" as const,
          };
        }),
      );

      return {
        query,
        total: resolvedResults.length,
        results: resolvedResults,
      };
    } catch (error) {
      return {
        query,
        total: 0,
        results: [] as WebSearchItem[],
        error: `搜索失败：${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
});
