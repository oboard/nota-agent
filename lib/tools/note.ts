import { tool } from "ai";
import { z } from "zod";
import { createNote, deleteNote, getNote, getNotes, updateNote } from "@/app/actions";

export const listNotesTool = tool({
  description: "列出当前所有便笺，返回便笺标题、ID和更新时间。适合在修改便笺前先查看现有便笺。",
  inputSchema: z.object({}),
  execute: async () => {
    const notes = await getNotes();

    if (notes.length === 0) {
      return "当前还没有便笺。";
    }

    return notes
      .map((note, index) => `${index + 1}. [${note.id}] ${note.title}（更新于 ${new Date(note.updatedAt).toLocaleString("zh-CN")}）`)
      .join("\n");
  },
});

export const getNoteTool = tool({
  description: "读取单个便笺的完整纯文本内容。便笺内容不是 markdown，而是纯文本。",
  inputSchema: z.object({
    id: z.string().describe("便笺 ID"),
  }),
  execute: async ({ id }) => {
    const note = await getNote(id);

    if (!note) {
      return `未找到 ID 为 ${id} 的便笺。`;
    }

    return `标题：${note.title}\n更新时间：${new Date(note.updatedAt).toLocaleString("zh-CN")}\n\n${note.content || "（空白便笺）"}`;
  },
});

export const createNoteTool = tool({
  description: "创建一个新的纯文本便笺。便笺第一行是标题，其余内容是正文。",
  inputSchema: z.object({
    title: z.string().min(1).optional().describe("便笺标题，不传时会自动命名为未命名便笺"),
    content: z.string().optional().describe("便笺正文，纯文本"),
  }),
  execute: async ({ title, content }) => {
    const note = await createNote({ title, content });
    return `已创建便笺 [${note.id}] ${note.title}`;
  },
});

export const updateNoteTool = tool({
  description: "更新现有便笺的标题或正文。正文是纯文本，不要使用 markdown 语法。",
  inputSchema: z.object({
    id: z.string().describe("便笺 ID"),
    title: z.string().optional().describe("新的便笺标题"),
    content: z.string().optional().describe("新的纯文本正文"),
  }),
  execute: async ({ id, title, content }) => {
    const note = await updateNote(id, { title, content });
    return `已更新便笺 [${note.id}] ${note.title}`;
  },
});

export const deleteNoteTool = tool({
  description: "删除一个便笺。",
  inputSchema: z.object({
    id: z.string().describe("便笺 ID"),
  }),
  execute: async ({ id }) => {
    const deleted = await deleteNote(id);
    return deleted ? `已删除便笺 ${id}` : `未找到便笺 ${id}`;
  },
});
