import { skillsManager } from './lib/skills-manager';

async function testSkills() {
  console.log('测试技能管理系统...');

  try {
    // 测试发现技能
    console.log('1. 发现可用技能...');
    const skills = await skillsManager.discoverSkills();
    console.log('发现的技能:', skills);

    // 测试构建技能提示
    console.log('\n2. 构建技能提示...');
    const skillsPrompt = skillsManager.buildSkillsPrompt(skills);
    console.log(skillsPrompt);

    // 测试加载特定技能
    if (skills.length > 0) {
      console.log('\n3. 加载第一个技能...');
      const firstSkill = await skillsManager.loadSkill(skills[0].name);
      console.log('加载的技能:', firstSkill);
    }

    console.log('\n测试完成！');
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testSkills();