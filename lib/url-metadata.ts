import { JSDOM } from 'jsdom';

export interface UrlMetadata {
    url: string;
    title: string;
    description?: string;
    image?: string;
    siteName?: string;
    type?: string;
    favicon?: string;
    extractedAt: string;
}

export class UrlMetadataExtractor {
    /**
     * 从文本中提取HTTP/HTTPS链接
     */
    extractUrls(text: string): string[] {
        const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
        const matches = text.match(urlRegex);
        return matches ? Array.from(new Set(matches)) : []; // 去重
    }

    /**
     * 获取网页的元数据
     */
    async fetchUrlMetadata(url: string): Promise<UrlMetadata> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; NotaAgent-Bot/1.0)'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            const dom = new JSDOM(html);
            const document = dom.window.document;

            // 提取标题
            const title = document.querySelector('title')?.textContent?.trim() ||
                document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
                '无标题';

            // 提取描述
            const description = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                document.querySelector('meta[name="twitter:description"]')?.getAttribute('content');

            // 提取图片
            const image = document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');

            // 提取站点名称
            const siteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
                new URL(url).hostname;

            // 提取类型
            const type = document.querySelector('meta[property="og:type"]')?.getAttribute('content');

            // 提取favicon
            const favicon = document.querySelector('link[rel="icon"]')?.getAttribute('href') ||
                document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href');

            // 如果favicon是相对路径，转换为绝对路径
            let absoluteFavicon = favicon;
            if (favicon && !favicon.startsWith('http')) {
                const urlObj = new URL(url);
                absoluteFavicon = favicon.startsWith('/')
                    ? `${urlObj.protocol}//${urlObj.host}${favicon}`
                    : `${urlObj.protocol}//${urlObj.host}/${favicon}`;
            }

            return {
                url,
                title,
                description,
                image,
                siteName,
                type,
                favicon: absoluteFavicon,
                extractedAt: new Date().toISOString(),
            };
        } catch (error) {
            console.error(`获取URL元数据失败: ${url}`, error);
            // 返回基础信息
            return {
                url,
                title: `链接: ${new URL(url).hostname}`,
                description: '无法获取页面详情',
                extractedAt: new Date().toISOString(),
            };
        }
    }

    /**
     * 批量获取多个URL的元数据
     */
    async fetchMultipleUrlMetadata(urls: string[]): Promise<UrlMetadata[]> {
        const results = await Promise.allSettled(
            urls.map(url => this.fetchUrlMetadata(url))
        );

        return results
            .filter((result): result is PromiseFulfilledResult<UrlMetadata> => result.status === 'fulfilled')
            .map(result => result.value);
    }

    /**
     * 从文本中提取URL并获取元数据
     */
    async extractAndFetchMetadata(text: string): Promise<UrlMetadata[]> {
        const urls = this.extractUrls(text);
        if (urls.length === 0) {
            return [];
        }

        return await this.fetchMultipleUrlMetadata(urls);
    }
}

export const urlMetadataExtractor = new UrlMetadataExtractor();