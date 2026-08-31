# 安全、隐私与人工发布边界

本仓库只公开确定性的工作流、虚构示例和测试夹具。它不保存凭据，不托管真实账号数据，也不执行发布或互动写操作。

## 禁止进入公开树

- Cookie、Token、API key、密码、私钥、证书、认证状态与会话文件；任何 `*.key`、`*.pem`、`*.ppk`、`*.pvk`、`*.p7b`、`*.p7c`、`*.p8`、`*.p12`、`*.pfx`、`*.crt`、`*.cer`、`*.der`、`*.csr`、`*.pkcs8`、`*.pkcs12`、`*.jks`、`*.keystore` 等密钥或证书扩展名，即使位于 fixture、示例目录或文件名含 LICENSE，也一律禁止；
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
2. **Git index**：`git ls-files --cached` 列举路径，`git show :path` 读取每个暂存对象，因此与工作树副本独立。
3. **全部可达历史**：`git rev-list --all` 与 `git ls-tree -r` 检查每个可达提交树中的路径，`git rev-list --objects --all` 加 `git cat-file --batch` 读取所有可达 blob；相同 blob 内容只读一次。由 tag 直接引用而没有路径名的 blob 也会扫描内容。

任一范围无法列举、任一 index / 历史树 / 可达对象无法完整读取或 Git 批处理响应不完整时，审计均以退出码 2 失败，不会把“不可读”当成“安全”。历史扫描只覆盖当前 refs 可达的对象；reflog、悬空 / 已回收对象、其他 clone 中未取得的 refs、LFS 服务端内容与 submodule 内部历史不在本地 Git 可达对象集合内，必须另行审计。超大仓库的全历史扫描成本随可达提交和对象数量增长，本命令不会悄悄降级成仅扫 HEAD 或 index。

凭据占位符必须完整匹配整个值，不能以前缀或子串形式夹带真实内容。对普通解构、重命名解构和成员别名的写调用（包括无分号、跨任意行距形式）、序列表达式调用、可选链、动态成员调用、对象式 `callTool({ name: ... })`，以及操作名无法静态确定的变量化 `callTool` / `invoke` 分派，审计在静态分析能力边界内采取保守报警；HTML 事件属性中的这些真实代码同样受检，明显的类方法与接口签名不视为调用。扫描器对全文件维护字符串、行 / 块 / HTML 注释、正则字面量、模板字符串及 `${...}` 插值的词法状态：模板文本本身惰性，插值表达式仍按代码扫描；正则字符类或转义中的 `//` 不会误开行注释。普通 JS 字符串、非事件 HTML 属性值、HTML / Markdown 说明段落、JS 块注释、Markdown / HTML 纯注释、Markdown 行内代码与围栏代码示例及惰性字符串示例不按可执行代码处理，但说明、注释或示例边界以外以及文档包裹中的真实可执行语法仍会被扫描。

审计检查禁入路径、常见 API key / JWT / AWS / Bearer / 密码等凭据模式，以及可执行写能力调用。敏感密钥 / 证书扩展名优先于 LICENSE、example 和 fixture 例外。它是最低限度的确定性防线，不能替代提交者对图片、其他二进制语义、LFS / submodule、不可达对象和上下文泄露的人工复核。
