import { NextRequest, NextResponse } from 'next/server';
import { ocrManager, LANGUAGE_PACKS } from '@/lib/ocr-manager';

/**
 * 下载语言包
 * POST /api/ocr/language
 * Body: { langCode: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { langCode } = await req.json();

    if (!langCode || !LANGUAGE_PACKS[langCode as keyof typeof LANGUAGE_PACKS]) {
      return NextResponse.json(
        { error: '无效的语言代码' },
        { status: 400 }
      );
    }

    const result = await ocrManager.downloadLanguage(langCode);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `${LANGUAGE_PACKS[langCode as keyof typeof LANGUAGE_PACKS].name} 下载成功`
      });
    } else {
      return NextResponse.json(
        { error: result.error || '下载失败' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('下载语言包失败:', error);
    return NextResponse.json(
      { error: '下载语言包失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除语言包
 * DELETE /api/ocr/language
 * Body: { langCode: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { langCode } = await req.json();

    if (!langCode) {
      return NextResponse.json(
        { error: '缺少语言代码' },
        { status: 400 }
      );
    }

    const result = await ocrManager.deleteLanguage(langCode);

    if (result.success) {
      return NextResponse.json({ success: true, message: '语言包已删除' });
    } else {
      return NextResponse.json(
        { error: result.error || '删除失败' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('删除语言包失败:', error);
    return NextResponse.json(
      { error: '删除语言包失败' },
      { status: 500 }
    );
  }
}