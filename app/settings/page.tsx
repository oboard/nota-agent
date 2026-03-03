"use client";

import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();

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

        {/* OCR Settings Info - Now Cloud Based */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">OCR 文字识别</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-default-500">
              当前使用 SiliconFlow DeepSeek-OCR 进行云端文字识别。
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}