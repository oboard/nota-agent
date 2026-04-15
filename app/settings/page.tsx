"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMemoryCategories, mergeMemoryCategory, updateMemoryCategory } from "@/app/actions";

type MemoryCategory = {
  name: string;
  aliases: string[];
  createdAt: string;
  updatedAt: string;
  disabled?: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<MemoryCategory[]>([]);
  const [fromCategory, setFromCategory] = useState("");
  const [toCategory, setToCategory] = useState("");
  const [memoryId, setMemoryId] = useState("");
  const [singleCategory, setSingleCategory] = useState("");

  useEffect(() => {
    getMemoryCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const refresh = async () => {
    setCategories(await getMemoryCategories());
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center gap-4">
          <Button isIconOnly variant="flat" onPress={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">设置</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">记忆分类</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="从分类" value={fromCategory} onValueChange={setFromCategory} />
              <Input label="合并到" value={toCategory} onValueChange={setToCategory} />
            </div>
            <Button
              color="primary"
              onPress={async () => {
                if (!fromCategory) return;
                await mergeMemoryCategory(fromCategory, toCategory || null);
                await refresh();
              }}
            >
              合并分类
            </Button>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="记忆 ID" value={memoryId} onValueChange={setMemoryId} />
              <Input label="新分类" value={singleCategory} onValueChange={setSingleCategory} />
            </div>
            <Button
              variant="flat"
              onPress={async () => {
                if (!memoryId) return;
                await updateMemoryCategory(memoryId, singleCategory || null);
                await refresh();
              }}
            >
              重置单条记忆分类
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">当前分类</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-default-500">暂无分类</p>
            ) : (
              categories.map((category) => (
                <div key={category.name} className="flex items-center justify-between rounded-lg border border-default-200 p-3">
                  <div>
                    <div className="font-medium">{category.name}</div>
                    <div className="text-xs text-default-500">{category.aliases?.join("、") || "无别名"}</div>
                  </div>
                  <span className="text-xs text-default-500">{category.disabled ? "已停用" : "启用中"}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
