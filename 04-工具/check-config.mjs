import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const notes = [];

const major = Number.parseInt(process.versions.node.split('.')[0], 10);
if (major < 20 || major >= 25) errors.push(`Node.js 版本须为 >=20 <25，当前 ${process.version}`);

for (const relativePath of ['package-lock.json', '.env.example', '06-产出/00000000-verify-fixture/copy.md']) {
  try { await access(path.join(root, relativePath)); }
  catch { errors.push(`缺少基础文件: ${relativePath}`); }
}

const mcpUrl = process.env.XHS_MCP_URL ?? 'http://localhost:18060/mcp';
try {
  const parsed = new URL(mcpUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('协议必须是 http/https');
  if (parsed.username || parsed.password) throw new Error('URL 不得内嵌凭据');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) throw new Error('仅允许本机研究服务');
} catch {
  errors.push('XHS_MCP_URL 必须是无内嵌凭据的本机 HTTP(S) URL');
}

const optionalSkills = [
  ['cover-anchor-system', '.claude/skills/cover-anchor-system'],
  ['guizang-social-card-skill', '.claude/skills/guizang-social-card-skill'],
];
for (const [name, relativePath] of optionalSkills) {
  try {
    await access(path.join(root, relativePath));
    notes.push(`可选视觉技能已存在: ${name}`);
  } catch {
    notes.push(`可选视觉技能未安装（不阻塞）: ${name}`);
  }
}

notes.push(`可选研究命令（不执行、不阻塞）: ${process.env.OPENCLI_COMMAND ?? 'opencli'}, ${process.env.REDBOOK_COMMAND ?? 'redbook'}`);
notes.forEach(note => console.log(`INFO ${note}`));

if (errors.length) {
  errors.forEach(error => console.error(`FAIL ${error}`));
  process.exit(1);
}

console.log(`PASS 基础配置检查通过（Node ${process.version}；无需凭据）`);
