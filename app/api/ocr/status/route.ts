import { NextResponse } from 'next/server';
import { ocrManager } from '@/lib/ocr-manager';

/**
 * 获取 OCR 状态
 * GET /api/ocr/status
 */
export async function GET() {
  try {
    const status = ocrManager.getStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('获取 OCR 状态失败:', error);
    return NextResponse.json(
      { error: '获取 OCR 状态失败' },
      { status: 500 }
    );
  }
}