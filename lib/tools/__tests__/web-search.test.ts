import { describe, it, expect, vi, afterEach } from "vitest";
import {
  extractBaiduResults,
  resolveBaiduRedirect,
  stripHtml,
  webSearchTool,
} from "../web-search";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("web-search tool helpers", () => {
  it("stripHtml should remove tags and decode entities", () => {
    const raw = '<em>测试</em>&nbsp;内容 &amp; 更多';
    expect(stripHtml(raw)).toBe("测试 内容 & 更多");
  });

  it("extractBaiduResults should parse title/link/snippet/muUrl", () => {
    const html = `
      <html><body>
        <h3 class="t"><a href="https://www.baidu.com/link?url=abc">第一个<em>结果</em></a></h3>
        <div class="c-abstract">这是第一条摘要</div>
        <div mu="https%3A%2F%2Fexample.com%2Flanding"></div>

        <h3 class="t"><a href="//www.baidu.com/link?url=def">第二个结果</a></h3>
        <span class="c-color-text">这是第二条摘要</span>
      </body></html>
    `;

    const res = extractBaiduResults(html, 5);
    expect(res.length).toBe(2);
    expect(res[0].title).toContain("第一个结果");
    expect(res[0].link).toContain("baidu.com/link?url=abc");
    expect(res[0].snippet).toContain("第一条摘要");
    expect(res[0].muUrl).toBe("https://example.com/landing");
    expect(res[1].link).toBe("//www.baidu.com/link?url=def");
  });

  it("resolveBaiduRedirect should return final redirected url", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      url: "https://real.example.com/article/123",
    } as any);

    const finalUrl = await resolveBaiduRedirect("https://www.baidu.com/link?url=xyz");
    expect(finalUrl).toBe("https://real.example.com/article/123");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("resolveBaiduRedirect should not fetch for non-baidu url", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch" as any);
    const finalUrl = await resolveBaiduRedirect("https://github.com/vercel/ai");
    expect(finalUrl).toBe("https://github.com/vercel/ai");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("web-search live test (no mock)", () => {
    it(
      "should search baidu and return real results",
      async () => {
        const result = await webSearchTool.execute?.(
          {
            query: "OpenAI",
            limit: 3,
          },
          {},
        );

        console.info(result);

        // 工具返回结构：{ query, total, results, error? }
        expect(result).toBeTruthy();
        expect(typeof result).toBe("object");

        const data = result as any;
        expect(data.query).toBe("OpenAI");
        expect(Array.isArray(data.results)).toBe(true);
        expect(data.total).toBeGreaterThanOrEqual(0);
        expect(data.error).toBeUndefined();

        // 至少有一条真实结果（网络波动时你也可以放宽）
        expect(data.results.length).toBeGreaterThan(0);

        for (const item of data.results) {
          expect(typeof item.title).toBe("string");
          expect(item.title.length).toBeGreaterThan(0);

          expect(typeof item.link).toBe("string");
          expect(item.link.startsWith("http")).toBe(true);

          expect(typeof item.resolvedUrl).toBe("string");
          expect(item.resolvedUrl.startsWith("http")).toBe(true);

          expect(item.source).toBe("baidu");
        }
      },
      30_000, // 给网络请求更长超时
    );
  });