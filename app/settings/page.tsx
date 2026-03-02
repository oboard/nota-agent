"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Progress } from "@heroui/progress";
import { Spinner } from "@heroui/spinner";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2, Check, AlertCircle, RefreshCw } from "lucide-react";

interface LanguageStatus {
  code: string;
  name: string;
  installed: boolean;
  downloading: boolean;
  progress: number;
  size: string;
}

interface OCRStatus {
  available: boolean;
  tessdataPath: string;
  languages: LanguageStatus[];
}

export default function SettingsPage() {
  const router = useRouter();
  const [ocrStatus, setOcrStatus] = useState<OCRStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installingLang, setInstallingLang] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOCRStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const { ipcRenderer } = window.require('electron');
      const data = await ipcRenderer.invoke('ocr-get-status');
      setOcrStatus(data);
    } catch (err) {
      setError('获取 OCR 状态失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOCRStatus();
  }, []);

  const handleInstallLanguage = async (langCode: string) => {
    setInstallingLang(langCode);

    try {
      const { ipcRenderer } = window.require('electron');
      const data = await ipcRenderer.invoke('ocr-download-lang', langCode);

      if (data.success) {
        await fetchOCRStatus();
      } else {
        setError(data.error || '下载失败');
      }
    } catch (err) {
      setError('下载语言包失败');
      console.error(err);
    } finally {
      setInstallingLang(null);
    }
  };

  const handleUninstallLanguage = async (langCode: string) => {
    try {
      const { ipcRenderer } = window.require('electron');
      const data = await ipcRenderer.invoke('ocr-delete-lang', langCode);

      if (data.success) {
        await fetchOCRStatus();
      } else {
        setError(data.error || '删除失败');
      }
    } catch (err) {
      setError('删除语言包失败');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            isIconOnly
            variant="flat"
            onPress={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">设置</h1>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-4 bg-danger-50 border border-danger-200 rounded-lg flex items-center gap-2 text-danger-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <Button
              size="sm"
              variant="light"
              color="danger"
              onPress={() => setError(null)}
            >
              关闭
            </Button>
          </div>
        )}

        {/* OCR Settings */}
        <Card className="mb-6">
          <CardHeader className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">OCR 文字识别</h2>
              <p className="text-sm text-default-500">
                离线图片文字识别，语言包自动下载到本地
              </p>
            </div>
            <Button
              variant="flat"
              size="sm"
              onPress={fetchOCRStatus}
              isDisabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : (
              <>
                {/* Status */}
                <div className="mb-6 p-4 bg-success-50 border border-success-200 rounded-lg">
                  <div className="flex items-center gap-2 text-success-700">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">OCR 引擎就绪</span>
                  </div>
                  <p className="text-sm text-success-600 mt-1">
                    首次使用时会自动下载所需语言包
                  </p>
                </div>

                {/* Language Packs */}
                <div>
                  <h3 className="text-sm font-medium mb-4">语言包管理</h3>
                  <div className="space-y-3">
                    {ocrStatus?.languages?.map((lang) => (
                      <div
                        key={lang.code}
                        className="flex items-center justify-between p-3 bg-default-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{lang.name}</span>
                          <span className="text-xs text-default-400">
                            {lang.code}
                          </span>
                          <span className="text-xs text-default-400">
                            {lang.size}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {lang.installed ? (
                            <>
                              <Chip
                                color="success"
                                variant="flat"
                                size="sm"
                                startContent={<Check className="w-3 h-3" />}
                              >
                                已安装
                              </Chip>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                color="danger"
                                onPress={() => handleUninstallLanguage(lang.code)}
                                isDisabled={installingLang !== null}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              {installingLang === lang.code && (
                                <div className="w-24">
                                  <Progress
                                    value={lang.progress || 0}
                                    size="sm"
                                    color="primary"
                                  />
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="flat"
                                color="primary"
                                startContent={<Download className="w-4 h-4" />}
                                onPress={() => handleInstallLanguage(lang.code)}
                                isDisabled={installingLang !== null}
                                isLoading={installingLang === lang.code}
                              >
                                下载
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        {/* Help */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">使用说明</h2>
          </CardHeader>
          <CardBody>
            <div className="text-sm text-default-500 space-y-2">
              <p><strong>自动下载：</strong>首次使用 OCR 时会自动下载所需语言包。</p>
              <p><strong>离线使用：</strong>语言包下载后可完全离线使用，无需网络。</p>
              <p><strong>存储位置：</strong>{ocrStatus?.tessdataPath || '~/.nota-agent/tessdata'}</p>
              <p><strong>使用方式：</strong>在聊天界面点击图片按钮上传图片，自动识别并提取文字。</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}