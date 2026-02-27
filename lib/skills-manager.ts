import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export interface SkillMetadata {
  name: string;
  description: string;
  path: string;
}

export interface Skill {
  metadata: SkillMetadata;
  content: string;
}

export class SkillsManager {
  private skillsDir: string;

  constructor(skillsDir: string = './skills') {
    this.skillsDir = skillsDir;
  }

  /**
   * 发现所有可用的技能
   */
  async discoverSkills(): Promise<SkillMetadata[]> {
    const skills: SkillMetadata[] = [];
    const seenNames = new Set<string>();

    try {
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = path.join(this.skillsDir, entry.name);
        const skillFile = path.join(skillDir, 'SKILL.md');

        try {
          const content = await fs.readFile(skillFile, 'utf-8');
          const frontmatter = this.parseFrontmatter(content);

          if (seenNames.has(frontmatter.name)) continue;
          seenNames.add(frontmatter.name);

          skills.push({
            name: frontmatter.name,
            description: frontmatter.description,
            path: skillDir,
          });
        } catch (error) {
          console.warn(`跳过无效的技能文件: ${skillFile}`, error);
          continue;
        }
      }
    } catch (error) {
      console.error('发现技能时出错:', error);
    }

    return skills;
  }

  /**
   * 加载特定技能的完整内容
   */
  async loadSkill(name: string): Promise<Skill | null> {
    const skills = await this.discoverSkills();
    const skill = skills.find(s => s.name.toLowerCase() === name.toLowerCase());

    if (!skill) {
      return null;
    }

    const skillFile = path.join(skill.path, 'SKILL.md');
    try {
      const content = await fs.readFile(skillFile, 'utf-8');
      const body = this.stripFrontmatter(content);

      return {
        metadata: skill,
        content: body,
      };
    } catch (error) {
      console.error(`加载技能 ${name} 失败:`, error);
      return null;
    }
  }

  /**
   * 构建系统提示中的技能列表
   */
  buildSkillsPrompt(skills: SkillMetadata[]): string {
    if (skills.length === 0) {
      return '';
    }

    const skillsList = skills
      .map(s => `- ${s.name}: ${s.description}`)
      .join('\n');

    return `
## 可用技能

使用 loadSkill 工具加载技能以获取专业指令。

可用技能:
${skillsList}

使用示例：
当用户请求需要特定技能时，先调用 loadSkill 工具加载相应技能，然后按照技能中的指示执行。
`;
  }

  /**
   * 解析 YAML frontmatter
   */
  private parseFrontmatter(content: string): any {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match?.[1]) throw new Error('未找到 frontmatter');

    try {
      return yaml.load(match[1]);
    } catch (error) {
      throw new Error(`解析 frontmatter 失败: ${error}`);
    }
  }

  /**
   * 移除 frontmatter 返回内容主体
   */
  private stripFrontmatter(content: string): string {
    const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    return match ? content.slice(match[0].length).trim() : content.trim();
  }
}

// 创建全局实例
export const skillsManager = new SkillsManager();