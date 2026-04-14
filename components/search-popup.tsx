"use client";

import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Input } from "@heroui/input";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { SearchIcon } from 'lucide-react';

interface SearchResult {
  id: string;
  content: string;
  date: string;
  type: 'chat' | 'memory' | 'note';
  highlight?: string;
}

interface SearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  results: SearchResult[];
  isLoading: boolean;
}

export function SearchPopup({ isOpen, onClose, query, onQueryChange, results, isLoading }: SearchPopupProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>');
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      hideCloseButton
      size="2xl"
      scrollBehavior="inside"
      backdrop="blur"
      placement="top"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <div className="p-4 border-b border-default-200">
              <Input
                autoFocus
                placeholder="搜索消息和记忆..."
                value={query}
                onValueChange={onQueryChange}
                startContent={<SearchIcon className="w-4 h-4 text-default-400" />}
                classNames={{
                  input: "text-base",
                  inputWrapper: "bg-default-100"
                }}
              />
            </div>
            <ModalBody className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="flex items-center gap-2 text-default-500">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>搜索中...</span>
                  </div>
                </div>
              ) : results.length === 0 && query ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <SearchIcon className="w-12 h-12 text-default-300 mb-3" />
                  <p className="text-default-500">未找到结果</p>
                  <p className="text-sm text-default-400 mt-1">
                    尝试不同的关键词或检查拼写
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <SearchIcon className="w-12 h-12 text-default-300 mb-3" />
                  <p className="text-default-500">开始输入以搜索</p>
                  <p className="text-sm text-default-400 mt-1">
                    搜索您的消息和记忆
                  </p>
                </div>
              ) : (
                <ScrollShadow className="max-h-[60vh]">
                  <div className="flex flex-col gap-3 p-4">
                    {results.map((result) => (
                      <div
                        key={result.id}
                        className="flex flex-col gap-1 rounded-lg border border-default-200/50 bg-content2/30 p-3 cursor-pointer hover:bg-content2/50 transition-colors"
                        onClick={() => {
                          if (result.type === 'chat') {
                            const date = result.date.split('T')[0];
                            window.dispatchEvent(new CustomEvent('searchNavigate', { detail: { date, msgId: result.id } }));
                            onClose();
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-primary">
                            {({ chat: '聊天', memory: '记忆', note: '笔记' } as Record<string, string>)[result.type] || result.type}
                          </span>
                          <span className="text-xs text-default-500">
                            {formatDate(result.date)}
                          </span>
                        </div>
                        <div 
                          className="text-sm text-default-600"
                          dangerouslySetInnerHTML={{
                            __html: highlightText(result.content, query)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollShadow>
              )}
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
