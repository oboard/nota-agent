# NotaAgent
这是一个永不遗忘的 Agent，但是提供 TODO 界面，TODO 会显示日期，总之就是不管什么事情都可以发送给这个 Agent，他会在后台持续整理，界面上会列出今天需要做的事情。不管什么东西都可以往里面记，然后可以问答。有两种对话模式，一种是记忆，一种是提问。

技术我想用 next.js, vercel/ai-sdk, hero ui, electron, sqlite

对于记忆的部分，不需要做任何的工具调用，因为后台需要根据聊天内容持续整理记忆



# Q&A:
```bash
[0] Error: Could not locate the bindings file. Tried:
[0]  → /Users/luoyuhang.22/Code/oboard/nota-agent/node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3/build/better_sqlite3.node
[0]  → /Users/luoyuhang.22/Code/oboard/nota-agent/node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3/build/Debug/better_sqlite3.node
```

Solution:

```bash
pnpm rebuild better-sqlite3
```