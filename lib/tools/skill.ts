import { tool } from "ai";
import { z } from "zod";
import { skillsManager } from "@/lib/skills-manager";

/**
 * 加载技能工具
 */
export const loadSkillTool = tool({
  description: "加载指定技能以获取专业指令",
  inputSchema: z.object({
    name: z.string().describe("要加载的技能名称"),
  }),
  execute: async ({ name }) => {
    const skill = await skillsManager.loadSkill(name);
    if (!skill) {
      return { error: `技能 '${name}' 未找到` };
    }

    return {
      skillDirectory: skill.metadata.path,
      content: skill.content,
      metadata: skill.metadata,
    };
  },
});