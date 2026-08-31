# 安全、隐私与人工发布边界

本仓库只公开确定性的工作流、虚构示例和测试夹具。它不保存凭据，不托管真实账号数据，也不执行发布或互动写操作。

## 禁止进入公开树

- Cookie、Token、API key、密码、私钥、证书、认证状态与会话文件；任何 `*.key`、`*.pem`、`*.ppk`、`*.pvk`、`*.p7b`、`*.p7c`、`*.p8`、`*.p12`、`*.pfx`、`*.crt`、`*.cer`、`*.der`、`*.csr`、`*.pkcs8`、`*.pkcs12`、`*.jks`、`*.keystore` 等密钥或证书扩展名，以及 `.ssh/id_rsa`、`.ssh/id_ed25519`、`.ssh/id_dsa` 等无扩展名 SSH 私钥路径，即使位于 fixture、示例目录或文件名含 LICENSE，也一律禁止；
- 浏览器 profile、user-data-dir、Puppeteer / Playwright 下载缓存；
- 真实账号档案、真实发布记录、真实素材与真实 `06-产出/<run>/`；
- `node_modules/`、包管理器缓存、日志、压缩包与可执行文件。

仅允许提交明确标注为虚构的 `*.example.*`，以及 `06-产出/00000000-selftest/`、`06-产出/00000000-verify-fixture/` 中的确定性夹具。示例不得由真实数据简单改名得到；URL 使用 `example.invalid`，人物、指标和时间均应为虚构值。

## 工作流能力边界

12 节点只覆盖：研究（只读）→ 生成 → Topic / Visual Gate 审核 → ★1 / ★2 人工确认 → 生成人工发布包。终点是 `manual-publish.md` 和 `publish.status: package_ready`。

`publish_content`、发评论、回复、点赞、收藏、关注及其他自动互动均禁止被主控、prompt、脚本或公开工作流调用。用户须在平台客户端亲自复核并手工发布；发布后的 URL 只有在用户主动提供时才能补录到本地被忽略的 `receipt.md` / 已发档案。

研究后端只能执行只读查询。认证应在仓库外完成；配置检查默认只接受无内嵌凭据的本机 MCP URL。后端不可用时记录 `degraded`，不得改走写接口、导入共享 Cookie 或跳过人工确认。

## 失败与脱敏

- 状态不明、登录异常、外部工具失败：停止相关外部动作，保留已落盘产物并说明降级原因；不得尝试发布来“验证”。
- 日志和问题报告：只保留错误类别与必要上下文；账号名、URL 参数、请求头、Cookie、绝对 profile 路径和内容片段必须删除或替换为占位符。
- 若凭据误入工作树：立即停止提交与共享，撤销 / 轮换凭据，再从公开候选历史中清除；仅删除文件不足以消除已提交历史中的秘密。

## 私下报告安全漏洞

不要把凭据、Cookie、Token、私钥、账号资料、未公开漏洞细节或可复现攻击数据粘贴到公开 Issue、Discussion 或其他公开讨论中；公开渠道也不要附日志、截图或复现文件。当前仓库为私有仓库，GitHub 的 private vulnerability reporting / Security Advisories 报告入口不可用，本项目也没有对外公布专用安全邮箱，因此不要假定存在某个邮箱或 Advisories 表单。

当前可执行的私下报告方式是：通过仓库所有者或维护者 GitHub 个人资料中**实际公开**的私下联系方式发出不含秘密的简短联络请求，或使用双方已经建立的受信任私下沟通渠道；待维护者确认接收方式后再发送脱敏细节。若找不到任何私下联系方式，可在 Issue / Discussion 中只发布“不含漏洞细节、凭据、日志和附件”的联络请求，请维护者提供私下渠道；在私下渠道建立前不要披露技术细节。

仓库将来公开后，维护者可在 GitHub 的 Security 设置中启用 private vulnerability reporting，并使用 **Security → Advisories → Report a vulnerability** 接收私下报告；本文不声称该能力当前已经启用。

## 提交前检查

运行：

```bash
npm test
npm run check:config
npm run smoke
npm run audit:security
```

`audit:security` 分别列举并标注三个范围：

1. **当前工作树**：`git ls-files --cached --others --exclude-standard`，覆盖仍存在的 tracked 文件和所有未跟踪、未被 `.gitignore` 排除的文件；已删除的 tracked 路径在工作树范围没有内容可读，但仍由 index / 历史范围覆盖。`.git/` 不参与工作树遍历，未跟踪且已忽略的 `node_modules/` 等依赖目录也不扫描；若这类路径已进入 index 或历史，则仍按禁入项报告。
2. **Git index**：`git ls-files --cached` 列举路径，`git cat-file --batch-check` 先取得暂存 blob 的类型和大小，再以流方式读取不超过上限的 `:path` 对象，因此与工作树副本独立。
3. **全部可达历史**：`git rev-list --objects --all` 单次枚举可达对象，`git cat-file --batch-check` 先筛出 blob 并取得大小；超限 blob 立即拒绝，其余再由一个持续的 `git cat-file --batch` 子进程逐 blob 流式读取。相同 blob 内容只读一次，不再对每个提交重复展开整棵树。`git log --all --name-only --diff-filter=AM` 另行覆盖曾进入可达提交的路径名，因此历史中的禁入扩展名不会因内容重复或后来改名而漏掉；由 tag 直接引用、没有路径名的 blob 也会扫描内容。

任一范围无法列举、任一 index / 历史树 / 可达对象无法完整读取或 Git 批处理响应不完整时，审计均以退出码 2 失败，不会把“不可读”当成“安全”。历史扫描只覆盖当前 refs 可达的对象；reflog、悬空 / 已回收对象、其他 clone 中未取得的 refs、LFS 服务端内容与 submodule 内部历史不在本地 Git 可达对象集合内，必须另行审计。超大仓库的全历史扫描成本随可达提交和对象数量增长，本命令不会悄悄降级成仅扫 HEAD 或 index。

凭据占位符必须完整匹配整个值，不能以前缀或子串形式夹带真实内容。JavaScript 使用 Acorn 生成 ESTree AST，再沿赋值与解构关系追踪成员别名、`bind`、`.call` / `.apply`、对象槽、对象整体别名及其再次解构、对象槽后赋值、条件 / 逻辑表达式、默认值、数组模式、后赋值别名、序列表达式、可选链、计算成员、模板插值和 `callTool` / `invoke` 分派；无法静态确定的动态成员或分派按写能力保守报警。HTML 使用 parse5 按 WHATWG 语法解析，只把 `<script>` 内容和 `on*` 事件属性（含无引号属性）送入 JavaScript 分析。模板文本、普通 JS 字符串、注释、正则字面量、普通 Markdown / HTML 说明、非事件属性、行内代码和围栏示例保持惰性；`${...}` 表达式及文档边界外可解析的真实单行或多行语句仍会扫描。

内容扫描只对已知文本扩展名执行；无路径名的可达 blob 会强制检查，但含 NUL 的限额内对象按二进制处理，不把任意字节误解码为文本。单个对象的 16 MiB 上限统一适用于工作树、Git index 和全部可达历史 blob；工作树和 index 以增量解码方式边读边限额，历史先检查对象大小，再按批处理头声明的精确长度逐段消费，任何范围超限都明确拒绝，且不会用完整对象的 `Buffer.concat` 拼接或解码超限内容。三个范围中任一个内容不可读或响应不完整均以退出码 2 失败。路径禁入规则优先于 LICENSE、example 和 fixture 例外，也不受大小或二进制判定影响。图片及其他限额内二进制的语义、LFS 服务端对象与 submodule 内部历史仍需人工或对应仓库另行审计。

JavaScript / HTML event 的写能力分析会沿递归成员路径传播危险槽位，覆盖嵌套对象初始化、嵌套解构、整对象别名和对象 spread；运行时才能确定的动态成员路径在可执行调用位置按危险处理。普通文档、字符串、注释、Markdown 代码示例和非 event HTML 属性仍按非执行内容处理。

安全审计测试中的 write-call 字符串、模板和拼接结果属于测试数据，不因描述危险调用而报警；审计器仍按 JavaScript 执行语义分析测试源码，因此测试文件中真正执行的写 API 调用仍会拒绝。动态路径只在最终被调用的成员本身无法静态确定时保守报警：`clients[index][operation]()` 会拒绝，`codeLines[index].trim()` 不会仅因接收者使用索引而误报，已知写方法 `clients[index].like()` 仍会拒绝。这个写能力上下文边界不豁免任何文件或目录，测试源码与历史版本仍完整接受凭据、私钥内容和禁入路径检查。

本审计器新增的解析依赖为 `acorn` 8.18.0（MIT）、`acorn-walk` 8.3.5（MIT）、`parse5` 7.3.0（MIT），后者的传递依赖 `entities` 6.0.1 为 BSD-2-Clause；准确版本、完整许可证元数据与完整性摘要记录在 `package-lock.json`，上游许可证文本随 npm 包发布。

审计检查禁入路径、常见 API key / JWT / AWS / Bearer / 密码等凭据模式，以及可执行写能力调用。敏感密钥 / 证书扩展名优先于 LICENSE、example 和 fixture 例外。它是最低限度的确定性防线，不能替代提交者对图片、其他二进制语义、LFS / submodule、不可达对象和上下文泄露的人工复核。
