# Skills 目录

此目录用于存放 Agent Skills，每个技能是一个独立的文件夹，包含 SKILL.md 文件。

## 目录结构

```
skills/
├── README.md                    # 此文件
├── web-search/
│   └── SKILL.md                 # 网页搜索技能
├── file-processing/
│   └── SKILL.md                 # 文件处理技能
├── todo-management/
│   └── SKILL.md                 # 任务管理技能
└── memory-management/
    └── SKILL.md                 # 记忆管理技能
```

## 技能格式

每个技能必须包含一个 `SKILL.md` 文件，格式如下：

```yaml
---
name: skill-name
description: 简短描述此技能的功能
---

# 技能名称

## 使用场景
描述何时使用此技能

## 使用步骤
1. 第一步
2. 第二步
...
```

## 添加新技能

1. 在 `skills/` 目录下创建新文件夹
2. 在文件夹中创建 `SKILL.md` 文件
3. 按照上述格式填写技能信息
4. 重启应用使技能生效