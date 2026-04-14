"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { SearchIcon } from 'lucide-react';

interface SearchResult {
  id: string;
  content: string;
  date: string;
  type: 'message' | 'memory';
  highlight?: string;
}

interface SearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  results: SearchResult[];
  isLoading: boolean;
}

export function SearchPopup({ isOpen, onClose, query, results, isLoading }: SearchPopupProps) {
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
      size="2xl"
      scrollBehavior="inside"
      backdrop="blur"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <SearchIcon className="w-5 h-5 text-primary" />
                <span>Search Results</span>
                {query && (
                  <span className="text-sm font-normal text-default-500">
                    for "{query}"
                  </span>
                )}
              </div>
            </ModalHeader>
            <ModalBody>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="flex items-center gap-2 text-default-500">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Searching...</span>
                  </div>
                </div>
              ) : results.length === 0 && query ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <SearchIcon className="w-12 h-12 text-default-300 mb-3" />
                  <p className="text-default-500">No results found</p>
                  <p className="text-sm text-default-400 mt-1">
                    Try different keywords or check your spelling
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <SearchIcon className="w-12 h-12 text-default-300 mb-3" />
                  <p className="text-default-500">Start typing to search</p>
                  <p className="text-sm text-default-400 mt-1">
                    Search through your messages and memories
                  </p>
                </div>
              ) : (
                <ScrollShadow className="max-h-[60vh]">
                  <div className="flex flex-col gap-3">
                    {results.map((result) => (
                      <div
                        key={result.id}
                        className="flex flex-col gap-1 rounded-lg border border-default-200/50 bg-content2/30 p-3 cursor-pointer hover:bg-content2/50 transition-colors"
                        onClick={() => {
                          // 处理点击结果，可以跳转到对应的消息或日期
                          console.log('Clicked result:', result);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-primary">
                            {result.type === 'message' ? 'Message' : 'Memory'}
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
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}