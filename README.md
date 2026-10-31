# 两讫 · Liangqi

> 银货两讫，账目两清。

两讫是一个**本地优先、可连接远程仓库**的记账 Web App，专门把两类支出分开：

- **现金支出**：现在就从存款里扣。
- **赊账支出**：现在不动存款，只增加负债，之后还款。

默认情况下数据只保存在本机，可以放多个账本；连接 GitHub、Gitee 或 WebDAV 后，一个仓库可以保存多个账本。连接远程时优先使用远程数据，离线自动回退本地。

![两讫首页](docs/screenshots/dashboard.png)

## 它解决什么问题

大多数记账 App 只记录「花了多少」，但现实里经常是：

> 这顿饭是刷信用卡的，钱还没从银行卡扣，但支出已经发生了。

两讫把这件事拆成三笔逻辑：

| 操作 | 资产 / 存款 | 负债 | 支出 |
| --- | ---: | ---: | ---: |
| 现金消费 | −100 | 0 | +100 |
| 赊账消费 | 0 | +100 | +100 |
| 还款 | −100 | −100 | 0 |
| 借款到账 | +100 | +100 | 0 |

关键点：

- 赊账消费在**资产**层面只增加负债、不动存款；但在**损益**层面仍要在消费当时确认支出。否则「这个月花了多少」会漏掉。
- 还款是「资产 → 负债」的转移，**不能再记一笔支出**，否则同一笔消费会被统计两次。
- 净资产 = 资产合计 − 负债合计。还款不会改变净资产，只会改变资产和负债的构成。

## 功能

- **多账本**：本地书库可以放家庭账、旅行账、生意账等多个账本，随时切换。
- **资产 / 负债账户**：现金、银行卡、信用卡、花呗、借款等，支持期初余额；资产账户可标记是否计入「可支配资产」。
- **资产概览**：总资产、总负债、可支配、净资产。
- **两种支出方式**：现在扣存款，或先记负债生成待还账单。
- **账单管理**：账单名称、分类、到期日、部分还款、已还清状态。
- **还款**：从资产账户还款，自动减少负债和存款，不重复计入支出。
- **成员归属**：每个账单和流水可以归属到家庭成员，账单卡片和流水里都会显示成员。
- **本地密码**：可设置本地密码锁，PBKDF2 哈希保存在本机，打开应用时需要解锁。
- **统计**：净资产、本月支出、本月收入、待还总额、逾期金额、分类占比、7 天走势。
- **分类管理**：支出 / 收入分类，支持自定义名称、Emoji 和颜色。
- **远程数据源**：GitHub、Gitee、WebDAV；一个仓库放多个账本，连接时列出仓库内账本供选择。
- **本地优先 + 远程优先读取**：本地立即写入；连接远程后打开账本优先拉远程，离线自动用本地。
- **冲突备份**：远程覆盖本地时，被覆盖版本保存在本机，可下载 JSON。
- **备份**：单账本 JSON、整个书库 JSON；GitHub / Gitee 仓库本身保留提交历史。
- **深色模式**：浅色、深色、跟随系统。
- **响应式**：桌面端侧边栏，手机端底部导航和底部弹层。

| 账单 | 流水 |
| --- | --- |
| ![账单页](docs/screenshots/bills.png) | ![流水页](docs/screenshots/entries.png) |

| 账户 | 手机端 |
| --- | --- |
| ![账户页](docs/screenshots/accounts.png) | <img src="docs/screenshots/mobile.png" width="280" alt="手机端首页" /> |

| 数据源 | |
| --- | --- |
| ![数据源页](docs/screenshots/data-source.png) | 本地 / GitHub / Gitee / WebDAV 四种模式 |

## 远程仓库结构

一个仓库不是一本账，而是一个书库：

```text
repo/
└── liangqi/
    ├── index.json          # 账本清单：id、名称、币种、更新时间、流水数
    └── books/
        ├── <bookId>.json   # 账本 A 的完整数据
        └── <bookId>.json   # 账本 B 的完整数据
```

连接远程时先读取 `index.json`，列出仓库里的所有账本；用户选择一个打开，或把当前本地账本上传进去。

## 同步规则

- **本地立即写**：每次修改先写浏览器 `localStorage`，界面立刻更新。
- **远程优先读取**：账本已连接远程且在线时，打开账本、窗口重新聚焦、恢复网络时先拉远程。
- **自动推送**：本地修改后延迟约 1.8 秒推送到远程；失败不阻塞记账。
- **离线回退**：远程不可用时继续使用本地，恢复后自动补推。
- **冲突处理**：MVP 按账本 `updatedAt` 判断，远程版本优先；被覆盖的本地版本保存在「数据源 → 冲突备份」，最多 10 份。
- **不做逐条合并**：多人同时编辑同一账本时，后同步的一方会以远程版本为准。需要 CRDT / 逐条合并可以后续扩展。

## 部署形态

- **纯静态前端**：`pnpm build` 产出 `dist/`，可部署到 Cloudflare Pages、GitHub Pages、Netlify 等；没有数据库、没有 API 服务。
- **完全无后端**：使用 GitHub / Gitee PAT 或 WebDAV；不启用 OAuth。
- **可选 OAuth**：只有 OAuth 需要 `server/oauth-worker` 做 code exchange，它不保存账本数据；不想部署就只用 PAT。
- **WebDAV 注意**：浏览器直连要求服务器允许 CORS；不支持 CORS 的 WebDAV 需要额外代理，那种情况下才需要后端。

### 部署到子路径

```bash
# 生成 /workbook/ 前缀的静态文件
pnpm build:workbook
```

Nginx 示例：

```nginx
location = /workbook { return 301 /workbook/; }
location /workbook/ {
    root /var/www;
    try_files $uri $uri/ /workbook/index.html;
    index index.html;
}
```

也可以使用 `scripts/deploy-workbook.sh`，通过 `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_PATH` 部署并在远端 reload nginx。SSH 需要预先配置好密钥或 ssh-agent。

## 登录方式

### PAT Token

- GitHub：创建有 `repo` 权限的 token。
- Gitee：创建有 `projects` 权限的 token。
- Token 只保存在本机 `localStorage`，不会经过两讫的服务器。建议使用只授权单个仓库的细粒度 token。

### OAuth（可选）

`server/oauth-worker` 是一个 Cloudflare Worker 参考实现，负责 GitHub / Gitee 的 OAuth code exchange：

- 应用打开弹窗 → Worker 跳转 GitHub / Gitee 授权 → 回调交换 token → `postMessage` 返回应用。
- 部署和配置见 [server/oauth-worker/README.md](server/oauth-worker/README.md)。
- 在「数据源 → OAuth 服务地址」填入 Worker 地址即可使用。

### WebDAV

支持 Nextcloud、Alist、群晖等标准 WebDAV。填写地址、用户名、密码即可。WebDAV 服务器需要允许浏览器跨域访问（CORS），否则连接会失败。

## 快速开始

要求 Node.js 22+ 和 pnpm。

```bash
pnpm install
pnpm dev
```

打开终端输出的地址（默认 `http://localhost:5173`）。

其他命令：

```bash
pnpm test       # 账务、备份、远程适配器测试
pnpm typecheck  # TypeScript 类型检查
pnpm lint       # oxlint
pnpm build      # 生产构建
pnpm preview    # 预览构建结果
```

## 使用方式

1. 打开首页，点击左上角「当前账本」可以新建 / 切换账本。
2. 到「账户」页设置资产账户的期初余额（例如银行卡里现在有多少钱）。
3. 记一笔支出时选择：
   - **现在扣存款**：从现金 / 银行卡支出。
   - **先记负债**：记到信用卡 / 花呗，生成待还账单。
4. 到「账单」页查看待还金额和到期日，点「还款」从存款账户还款。
5. 到「数据源」页连接 GitHub / Gitee / WebDAV，选择一个远程账本，或把当前账本上传到仓库。
6. 在「设置 → 数据管理」导出单账本或整个书库备份。

### 本地密码

到「设置 → 本地密码」设置至少 6 位密码。密码使用 PBKDF2-SHA256 哈希后保存在本机，打开应用或刷新新标签页时需要解锁；同一标签页刷新会保持解锁。

注意：**本地密码只保护界面访问，不加密 localStorage 里的账本数据**。能打开浏览器开发者工具的人仍然可以读到本地数据；如果忘记密码，只能清除浏览器数据。

### 成员

到「成员」页添加家庭成员。记账时在金额下方选择成员；赊账生成的账单会继承该成员，账单和流水列表都会显示成员标签。成员只影响归属和展示，不影响金额、余额和统计。

### 可支配资产

首页资产卡显示四个数字：

- **总资产**：所有资产账户余额之和。
- **总负债**：所有负债账户余额之和。
- **可支配**：流动资产 − 总负债。现金、银行卡等默认计入流动资产；房产、投资等可以在账户编辑里关闭「计入可支配资产」。
- **净资产**：总资产 − 总负债。

当所有资产都是流动资产时，可支配和净资产相同；存在房产、投资等非流动资产时会分开显示。

期初余额只在创建账户时填写，之后不能修改；如果需要调整，请通过新增流水或还款处理。这是为了避免历史账目被悄悄改掉。

## 数据与隐私

- 本地书库保存在浏览器 `localStorage`，键名：`liangqi-library-v2`。
- 旧版单账本 `liangqi-ledger-v1` / `zhaibu-ledger-v1` 会在首次启动时迁移到书库，旧键保留，方便回滚。
- 旧的 `zhaibu` 单账本备份仍可导入；新导出使用 `liangqi` 标识。
- 远程模式下，账本数据保存在你自己的 GitHub / Gitee 仓库或 WebDAV 服务器；两讫没有自己的数据服务器。
- OAuth Worker 只做 code exchange，不存储账本数据。
- **Token / 密码保存在本机 `localStorage`**，以便刷新后保持连接；请使用细粒度、单仓库权限的 token。
- **清除浏览器数据会丢失本地书库**。请定期导出备份；已连接远程的数据可以从远程重新拉取。
- 本地密码哈希保存在 `liangqi-auth-v1`；解锁状态只保存在当前标签页的 `sessionStorage`。
- 本地密码不加密账本数据，不能替代磁盘加密或浏览器账户保护。
- 书库备份默认**不包含 token / 密码**，导入后需要重新填写远程凭据。
- 冲突备份保存在 `liangqi-conflicts-v1`，可在数据源页下载或清空。

## 技术栈

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- Zustand（书库 + 当前账本状态）
- React Router 7（HashRouter，静态托管无需服务端重写）
- Vitest（账务、备份、远程适配器测试）
- Lucide React（界面图标，ISC 许可）
- Cloudflare Worker（可选 OAuth 服务，`server/oauth-worker`）

金额全部以**整数分**存储，计算过程中不使用浮点数，避免 `0.1 + 0.2` 类问题。

## 项目结构

```text
src/
├── domain/
│   ├── ledger.ts      # 账户余额、账单状态、统计等纯函数
│   ├── money.ts       # 金额解析与格式化
│   ├── backup.ts      # 单账本 / 书库备份与校验
│   └── seed.ts        # 默认账户、分类和账本
├── remote/
│   ├── git-contents.ts # GitHub / Gitee Contents API
│   ├── webdav.ts       # WebDAV GET / PUT / MKCOL
│   ├── repository.ts   # index.json + books/*.json
│   ├── sync.ts         # 拉取、推送、冲突处理
│   └── oauth.ts        # OAuth 弹窗
├── store/
│   ├── library.ts      # 书库、账本列表、连接配置
│   ├── ledger.ts       # 当前账本 + 账务 / 成员 actions
│   ├── auth.ts         # 本地密码
│   ├── book-actions.ts # 切换 / 新建 / 删除账本
│   └── ui.ts           # 全局弹层状态
├── pages/              # 首页、流水、账单、账户、分类、成员、数据源、设置
├── components/         # 布局、账本切换、弹层、卡片、图表等
├── hooks/
├── utils/
└── types.ts            # 数据模型

server/
└── oauth-worker/       # 可选 GitHub / Gitee OAuth Worker
```

核心数据模型在 `src/types.ts`：

- `Library`：多个 `Book` + 当前账本 + 远程连接配置。
- `Book`：账户、分类、成员、账单、流水、币种、远程绑定。
- `Account`：`asset` 或 `liability`，带期初余额；资产可标记 `liquid` 是否计入可支配资产。
- `Member`：账单和流水的归属成员。
- `Bill`：一张待还账单，记录本金、到期日、成员；还款金额由流水推导。
- `Entry`：`expense` / `income` / `repayment`，支出和还款通过 `billId` 关联账单，可关联成员。

余额、账单剩余金额和统计结果都是**推导值**，不单独存一份余额，避免数据不同步。

## 路线图

- [ ] S3 兼容存储
- [ ] SQLite 备份快照
- [ ] PWA（离线缓存、安装到桌面）
- [ ] 微信 / 支付宝账单 CSV 导入
- [ ] 多币种汇率换算（目前只改变显示货币，不做换算）
- [ ] 周期账单、分期还款
- [ ] 逐条合并 / CRDT 家庭同步
- [ ] 更多统计视图和年度报告
- [ ] 更完整的组件测试与端到端测试

## 许可证

本项目以 **GNU General Public License v3.0 or later（GPL-3.0-or-later）** 发布，完整文本见 [LICENSE](LICENSE)。

### 与 Cent 的关系

两讫是**独立实现**，不是 Cent 的 fork，不包含 Cent 的源代码、文案或素材。功能思路受开源项目 [Cent](https://github.com/glink25/Cent) 启发；Cent 版权归 glink25 所有，采用 CC BY-NC-SA 4.0。

Cent 的许可证**不适用于本项目**；本项目的原创代码按 GPL-3.0-or-later 发布。如果你打算把 Cent 的代码合并进来，需要注意 CC BY-NC-SA 4.0 与 GPLv3 不兼容（NonCommercial 与 ShareAlike 条款冲突），必须先取得 Cent 作者授权。

### 品牌与素材

「两讫 / LIANGQI」名称和双栏 Logo 为本项目原创。界面图标使用 Lucide（ISC 许可）和系统 Emoji，不包含 Cent 的图标、文案或截图素材。

名称与 Logo 尚未做正式的商标注册检索；如果计划商业发行，请在目标国家 / 类目自行做商标查询。本项目不声称拥有任何注册商标。

第三方依赖与图标的许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 免责声明

本项目是记账工具，不构成财务、税务或投资建议。使用前请先导出备份；作者不对因数据丢失、计算错误或使用本软件造成的损失负责。
