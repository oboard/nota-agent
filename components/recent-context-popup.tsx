"use client";

import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Brain } from 'lucide-react';
import { useMemories } from "@/lib/hooks/use-memories";

interface RecentContextPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecentContextPopup({ isOpen, onClose }: RecentContextPopupProps) {
  const { memories: localMemories, isLoading } = useMemories();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <span>Recent Context</span>
                {localMemories.length > 0 && (
                  <span className="text-sm font-normal text-default-500">
                    ({localMemories.length} items)
                  </span>
                )}
              </div>
            </ModalHeader>
            <ModalBody>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="flex items-center gap-2 text-default-500">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>加载中...</span>
                  </div>
                </div>
              ) : localMemories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Brain className="w-12 h-12 text-default-300 mb-3" />
                  <p className="text-default-500">暂无记忆内容</p>
                  <p className="text-sm text-default-400 mt-1">
                    与 AI 对话时保存的内容会显示在这里
                  </p>
                </div>
              ) : (
                <ScrollShadow className="max-h-[60vh]">
                  <div className="flex flex-col gap-3">
                    {localMemories.map((memory) => (
                      <div
                        key={memory.id}
                        className="flex flex-col gap-2 rounded-lg border border-default-200/50 bg-content2/30 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-primary">
                              {memory.type === 'memory' ? 'Memory' : 'Context'}
                            </span>
                            {memory.category ? (
                              <span className="text-[11px] rounded-full bg-default-100 px-2 py-0.5 text-default-600">
                                {memory.category}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-xs text-default-500">
                            {new Date(memory.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm text-default-600 whitespace-pre-wrap">
                          {memory.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollShadow>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                关闭
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
