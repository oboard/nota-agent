import { NextRequest, NextResponse } from 'next/server';
import { ocrManager } from '@/lib/ocr-manager';
import Tesseract from 'tesseract.js';

// App Router 使用 route segment config
export const maxDuration = 60; // 最大执行时间（秒）

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const language = formData.get('lang') as string || 'chi_sim+eng';

    if (!imageFile) {
      return NextResponse.json(
        { error: '未提供图片文件' },
        { status: 400 }
      );
    }

    // 检查是否有语言包，如果没有则自动下载
    const langCodes = language.split('+').filter(Boolean);
    for (const lang of langCodes) {
      if (!ocrManager.isLanguageInstalled(lang)) {
        console.log(`自动下载语言包: ${lang}`);
        await ocrManager.downloadLanguage(lang);
      }
    }

    // 将 File 转换为 Buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 使用 tesseract.js 进行 OCR
    const result = await Tesseract.recognize(buffer, language, {
      logger: (info) => {
        if (info.status === 'recognizing text') {
          console.log(`OCR 进度: ${Math.round(info.progress * 100)}%`);
        }
      },
      langPath: ocrManager.getDataDir(),
      cacheMethod: 'none', // 我们自己管理缓存
    });

    // 清理识别结果
    const text = result.data.text
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return NextResponse.json({
      success: true,
      text,
      confidence: result.data.confidence,
    });

  } catch (error) {
    console.error('OCR 识别失败:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'OCR 识别失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}