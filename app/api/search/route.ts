import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ChatStorage } from '@/lib/chat-storage';

const chatStorage = new ChatStorage();

interface SearchResult {
  id: string;
  content: string;
  date: string;
  type: 'memory' | 'note' | 'chat';
  highlight?: string;
  category?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const { query, types = ['memory', 'note', 'chat'], categories = [] } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ results: [] });
    }

    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    // 搜索记忆
    if (types.includes('memory')) {
      try {
        const memories = await storage.searchMemories(query, 10, { categories });
        memories.forEach(memory => {
          results.push({
            id: memory.id,
            content: memory.content,
            date: memory.createdAt,
            type: 'memory',
            category: memory.category || null,
          });
        });
      } catch (error) {
        console.error('Error searching memories:', error);
      }
    }

    // 搜索笔记
    if (types.includes('note')) {
      try {
        const notes = await storage.getNotes();
        notes.forEach(note => {
          if (note.title.toLowerCase().includes(queryLower) || 
              note.content.toLowerCase().includes(queryLower)) {
            results.push({
              id: note.id,
              content: `${note.title}\n\n${note.content}`,
              date: note.updatedAt,
              type: 'note',
            });
          }
        });
      } catch (error) {
        console.error('Error searching notes:', error);
      }
    }

    // 搜索聊天记录
    if (types.includes('chat')) {
      try {
        const messages = await chatStorage.loadChat(1, 100);
        messages.forEach((msg: any) => {
          const text = msg.parts
            ?.filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join(' ') || '';
          
          if (text.toLowerCase().includes(queryLower)) {
            results.push({
              id: msg.id,
              content: text,
              date: msg.createdAt || new Date().toISOString(),
              type: 'chat',
            });
          }
        });
      } catch (error) {
        console.error('Error searching chats:', error);
      }
    }

    // 按时间排序，最新的在前面
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 限制返回数量
    return NextResponse.json({ results: results.slice(0, 20) });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ results: [], error: '搜索失败' }, { status: 500 });
  }
}
