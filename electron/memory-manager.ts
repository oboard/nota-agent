import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
dotenv.config({ path: path.join(__dirname, "../.env") });

const MEMORIES_DIR = path.join(__dirname, "../data/memories");
const LAST_RUN_FILE = path.join(__dirname, "../data/memories/.memory-consolidation-last-run");

// Initialize AI Model
// Using the same configuration as in app/api/chat/route.ts
const model = createOpenAICompatible({
    name: "Kimi-K2.5",
    baseURL: process.env.OPENAI_API_BASE || "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
})("Kimi-K2.5");

export async function checkAndConsolidateMemories() {
    console.log("[Memory Manager] Checking consolidation status...");

    const now = Date.now();
    let lastRun = 0;

    try {
        if (fs.existsSync(LAST_RUN_FILE)) {
            const data = fs.readFileSync(LAST_RUN_FILE, "utf-8");
            lastRun = parseInt(data, 10);
            if (isNaN(lastRun)) lastRun = 0;
        }
    } catch (error) {
        console.error("[Memory Manager] Error reading last run file:", error);
    }

    // Check if 1 hour (3600000 ms) has passed
    if (now - lastRun < 60 * 60 * 1000) {
        console.log(`[Memory Manager] Skipping: Last run was ${(now - lastRun) / 1000 / 60} minutes ago.`);
        return;
    }

    console.log("[Memory Manager] Starting consolidation...");
    try {
        await consolidateMemories();
        // Update last run time
        fs.writeFileSync(LAST_RUN_FILE, now.toString());
        console.log("[Memory Manager] Consolidation completed successfully.");
    } catch (error) {
        console.error("[Memory Manager] Consolidation failed:", error);
    }
}

async function consolidateMemories() {
    const today = new Date().toISOString().split("T")[0];
    const filePath = path.join(MEMORIES_DIR, `${today}.md`);

    if (!fs.existsSync(filePath)) {
        console.log(`[Memory Manager] No memory file found for today (${today}).`);
        return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.trim()) {
        console.log("[Memory Manager] Memory file is empty.");
        return;
    }

    // Prompt for consolidation
    const prompt = `
You are a memory manager system. Your task is to clean up, filter, and consolidate the user's memory log for today.

Here is the raw memory content:
<raw_memory>
${content}
</raw_memory>

Instructions:
1.  **FILTER INVALID ENTRIES**: Remove any entries that contain ONLY punctuation, symbols, whitespace, or are empty (e.g., ":", "---", ".", "TODO").
2.  **CONSOLIDATE DUPLICATES**: Merge adjacent or highly similar entries that talk about the same exact topic.
3.  **KEEP FORMAT**: The output MUST be in valid Markdown format using the same structure:
    
    ## MEMORY - {ISO_TIMESTAMP}
    
    {Content}
    
    ---

4.  **PRESERVE CONTENT**: Do not summarize away important details. Only remove noise and redundancy. 
5.  **TIMESTAMP**: For merged entries, use the timestamp of the earliest entry in the group.

Output ONLY the final markdown content. Do not add any conversational text.
`;

    try {
        const { text } = await generateText({
            model,
            prompt,
        });

        if (text && text.trim()) {
            // Backup original file just in case
            // fs.writeFileSync(filePath + ".bak", content);

            // Overwrite with consolidated content
            fs.writeFileSync(filePath, text.trim());
            console.log(`[Memory Manager] Updated memory file: ${filePath}`);
        }
    } catch (error) {
        console.error("[Memory Manager] AI generation error:", error);
        throw error;
    }
}