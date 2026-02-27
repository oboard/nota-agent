import { NextResponse } from 'next/server';
import { getAvailableDates } from '@/app/actions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dates = await getAvailableDates();

    return NextResponse.json({
      dates: dates,
      success: true
    });
  } catch (error) {
    console.error('获取可用日期失败:', error);
    return NextResponse.json(
      {
        error: '获取可用日期失败',
        dates: [],
        success: false
      },
      { status: 500 }
    );
  }
}