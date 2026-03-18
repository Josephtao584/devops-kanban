/**
 * 需求迁移脚本
 * 将现有的 requirements 数据转换为统一的 tasks 格式
 *
 * 使用方法:
 * node scripts/migrate-requirements.js
 */

const fs = require('fs');
const path = require('path');

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../../data');
const REQUIREMENTS_FILE = path.join(DATA_DIR, 'requirements.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

/**
 * 读取 JSON 文件
 */
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`读取文件失败：${filePath}`, error.message);
    return null;
  }
}

/**
 * 写入 JSON 文件
 */
function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`写入文件失败：${filePath}`, error.message);
    return false;
  }
}

/**
 * 生成下一个 ID
 */
function getNextId(items) {
  if (items.length === 0) return 1;
  return Math.max(...items.map(item => item.id)) + 1;
}

/**
 * 主迁移函数
 */
async function migrate() {
  console.log('开始迁移需求数据到任务格式...\n');

  // 读取现有数据
  const requirements = readJsonFile(REQUIREMENTS_FILE);
  const existingTasks = readJsonFile(TASKS_FILE);

  if (requirements === null || existingTasks === null) {
    console.error('错误：无法读取数据文件');
    process.exit(1);
  }

  console.log(`当前需求数量：${requirements.length}`);
  console.log(`当前任务数量：${existingTasks.length}\n`);

  // 获取已有任务的最大 ID
  let nextTaskId = getNextId(existingTasks);

  // 统计
  let migratedCount = 0;
  let skippedCount = 0;
  const migratedTasks = [];

  // 处理每个需求
  for (const req of requirements) {
    if (req.status === 'CONVERTED') {
      // 已转换的需求，检查是否已有关联任务
      const hasExistingTask = existingTasks.some(t => t.requirement_id === req.id);
      if (hasExistingTask) {
        console.log(`跳过 (已转换): ${req.title}`);
        skippedCount++;
        continue;
      }
    }

    // 将 NEW 状态的需求转换为 TODO 任务
    // 将 CONVERTED 状态的需求转换为已完成任务（如果有验收标准）
    const taskStatus = req.status === 'NEW' ? 'TODO' : 'TODO';

    const newTask = {
      id: nextTaskId++,
      project_id: req.project_id,
      title: req.title,
      description: req.description,
      status: taskStatus,
      priority: req.priority || 'MEDIUM',
      acceptance_criteria: req.acceptance_criteria || null,
      created_by: req.created_by || null,
      created_at: req.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    migratedTasks.push(newTask);
    migratedCount++;
    console.log(`迁移：${req.title} (ID: ${req.id} -> ${newTask.id}, 状态：${taskStatus})`);
  }

  console.log(`\n迁移完成:`);
  console.log(`- 已迁移：${migratedCount} 个需求`);
  console.log(`- 已跳过：${skippedCount} 个需求`);
  console.log(`- 新任务总数：${existingTasks.length + migratedCount}`);

  // 写入新的任务数据
  const allTasks = [...existingTasks, ...migratedTasks];
  if (!writeJsonFile(TASKS_FILE, allTasks)) {
    console.error('错误：无法写入任务文件');
    process.exit(1);
  }

  console.log(`\n任务数据已更新到：${TASKS_FILE}`);

  // 备份需求文件而不是删除（安全起见）
  const backupFile = path.join(DATA_DIR, 'requirements.json.backup');
  try {
    fs.copyFileSync(REQUIREMENTS_FILE, backupFile);
    console.log(`需求文件已备份到：${backupFile}`);

    // 清空 requirements.json 但保留文件（保持向后兼容）
    writeJsonFile(REQUIREMENTS_FILE, []);
    console.log('需求文件已清空（保留空数组以保持一致性）');
  } catch (error) {
    console.error('警告：备份需求文件失败', error.message);
  }

  console.log('\n迁移完成！');
}

// 运行迁移
migrate().catch(error => {
  console.error('迁移过程中发生错误:', error);
  process.exit(1);
});
