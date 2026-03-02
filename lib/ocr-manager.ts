/**
 * OCR 管理模块
 * 使用 tesseract.js (WASM) 实现零配置 OCR
 * 语言包自动下载到用户目录
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// 语言包配置
export const LANGUAGE_PACKS = {
  'chi_sim': { name: '简体中文', code: 'chi_sim', size: '~20MB' },
  'chi_tra': { name: '繁体中文', code: 'chi_tra', size: '~20MB' },
  'eng': { name: 'English', code: 'eng', size: '~13MB' },
  'jpn': { name: '日本語', code: 'jpn', size: '~15MB' },
  'kor': { name: '한국어', code: 'kor', size: '~12MB' },
} as const;

export type LanguageCode = keyof typeof LANGUAGE_PACKS;

export interface OCRLanguageStatus {
  code: string;
  name: string;
  installed: boolean;
  downloading: boolean;
  progress: number;
  size: string;
}

export interface OCRStatus {
  available: boolean;
  tessdataPath: string;
  languages: OCRLanguageStatus[];
}

// tesseract.js 语言数据缓存路径
const TESSERACT_DATA_DIR = path.join(os.homedir(), '.nota-agent', 'tessdata');

class OCRManager {
  private dataDir: string;
  private downloadingLangs: Map<string, number> = new Map();

  constructor() {
    this.dataDir = TESSERACT_DATA_DIR;
    this.ensureDataDir();
  }

  private ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * 获取语言包文件路径
   */
  private getLangFilePath(langCode: string): string {
    return path.join(this.dataDir, `${langCode}.traineddata.gz`);
  }

  /**
   * 检查语言包是否已下载
   */
  isLanguageInstalled(langCode: string): boolean {
    const filePath = this.getLangFilePath(langCode);
    return fs.existsSync(filePath);
  }

  /**
   * 获取已安装的语言列表
   */
  getInstalledLanguages(): string[] {
    const installed: string[] = [];
    for (const code of Object.keys(LANGUAGE_PACKS)) {
      if (this.isLanguageInstalled(code)) {
        installed.push(code);
      }
    }
    return installed;
  }

  /**
   * 下载语言包
   */
  async downloadLanguage(
    langCode: string,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (!LANGUAGE_PACKS[langCode as LanguageCode]) {
      return { success: false, error: `不支持的语言: ${langCode}` };
    }

    // 如果已经下载过，直接返回成功
    if (this.isLanguageInstalled(langCode)) {
      return { success: true };
    }

    this.downloadingLangs.set(langCode, 0);

    try {
      // tesseract.js CDN 地址
      const url = `https://tessdata.projectnaptha.com/4.0.0/${langCode}.traineddata.gz`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const chunks: Uint8Array[] = [];
      let downloadedSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        downloadedSize += value.length;

        if (totalSize > 0) {
          const progress = Math.round((downloadedSize / totalSize) * 100);
          this.downloadingLangs.set(langCode, progress);
          onProgress?.(progress);
        }
      }

      // 合并所有 chunks
      const buffer = Buffer.concat(chunks);

      // 保存到文件
      const filePath = this.getLangFilePath(langCode);
      await fs.promises.writeFile(filePath, buffer);

      this.downloadingLangs.delete(langCode);
      return { success: true };
    } catch (error) {
      this.downloadingLangs.delete(langCode);
      console.error(`下载语言包 ${langCode} 失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载失败',
      };
    }
  }

  /**
   * 删除语言包
   */
  async deleteLanguage(langCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      const filePath = this.getLangFilePath(langCode);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除失败',
      };
    }
  }

  /**
   * 获取语言包下载进度
   */
  getDownloadProgress(langCode: string): number {
    return this.downloadingLangs.get(langCode) || 0;
  }

  /**
   * 是否正在下载
   */
  isDownloading(langCode: string): boolean {
    return this.downloadingLangs.has(langCode);
  }

  /**
   * 获取所有语言包状态
   */
  getLanguageStatuses(): OCRLanguageStatus[] {
    return Object.entries(LANGUAGE_PACKS).map(([code, info]) => ({
      code,
      name: info.name,
      installed: this.isLanguageInstalled(code),
      downloading: this.isDownloading(code),
      progress: this.getDownloadProgress(code),
      size: info.size,
    }));
  }

  /**
   * 获取 OCR 状态
   */
  getStatus(): OCRStatus {
    return {
      available: true, // tesseract.js 总是可用
      tessdataPath: this.dataDir,
      languages: this.getLanguageStatuses(),
    };
  }

  /**
   * 获取语言数据目录（供 tesseract.js 使用）
   */
  getDataDir(): string {
    return this.dataDir;
  }

  /**
   * 检查 OCR 是否可用（至少有一个语言包）
   */
  hasAnyLanguage(): boolean {
    return this.getInstalledLanguages().length > 0;
  }

  /**
   * 确保至少有一个语言包可用，如果没有则自动下载中文和英文
   */
  async ensureLanguages(): Promise<string[]> {
    const installed = this.getInstalledLanguages();

    if (installed.length === 0) {
      // 自动下载中文和英文
      console.log('自动下载 OCR 语言包...');
      await this.downloadLanguage('chi_sim');
      await this.downloadLanguage('eng');
      return ['chi_sim', 'eng'];
    }

    return installed;
  }
}

// 导出单例
export const ocrManager = new OCRManager();