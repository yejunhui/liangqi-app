<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# AGENTS.md · 两讫项目 AI 上下文

> 给 AI 编码助手、代码审查工具和自动化代理的项目说明。  
> 修改代码前先读本文件，再读 [README.md](README.md) 和 [docs/deployment.md](docs/deployment.md)。

**最后更新：** 2026-11-02  
**当前版本：** 0.10.1  
**许可证：** AGPL-3.0-or-later

## 1. 项目是什么

两讫（Liangqi）是一个**本地优先、可连接远程仓库的共享负债记账 PWA**。

它把两类支出分开：

- **现金支出**：立即从资产账户扣款，立即计入支出。
- **赊账支出**：不动资产，只增加负债并生成账单；还款时才计入支出。
- **还款**：从资产账户转到负债账户，资产和负债同时减少，并按还款金额计入支出。

核心目标不是做“万能记账”，而是保证：

- 赊账消费不会被重复计算为支出。
- 还款不会被重复计算。
- 净资产、可支配资产、账单余额始终能从流水推导出来。
- 多成员、多设备同步时不丢账、不复活已删除记录。

### 在线地址

- 应用：https://arksc.cn:8002/workbook/
- GitHub：https://github.com/yejunhui/liangqi-app
- Gitee：https://gitee.com/PharaohMan/liangqi-app

### 分支约定

- 本地主分支：`main`
- GitHub 默认分支：`main`
- Gitee 默认分支：`master`
- 推送命令：`git push github` / `git push origin`

不要把私钥、token、密码写入仓库或提交历史。

## 2. 快速命令

要求 Node.js 22+、pnpm。

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm build:workbook
pnpm preview
```

当前基线（2026-11-02）：

- 26 个测试文件
- 139 个测试通过
- `tsc -b` 通过
- `oxlint` 通过（可能存在既有 warning）
- `pnpm build:workbook` 通过

修改账务、备份、同步或成员逻辑后，至少运行：

```bash
pnpm typecheck
pnpm test
```

改 UI 后建议再运行：

```bash
pnpm build:workbook
```

## 3. 技术栈

| 层 | 技术 |
| --- | --- |
| UI | React 19 + TypeScript |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS 4 |
| 状态 | Zustand |
| 路由 | React Router 7，HashRouter |
| 本地存储 | IndexedDB（`idb-keyval`）+ localStorage 兜底 |
| 测试 | Vitest |
| 图标 | Lucide React（ISC） |
| 远程 | GitHub / Gitee / WebDAV |
| 可选后端 | `server/oauth-worker`（Cloudflare Worker，当前界面未启用） |
| PWA | 自定义 Service Worker，缓存应用外壳 |

没有数据库，没有业务 API 服务，没有两讫自己的数据服务器。

## 4. 架构

```text
React pages/components
        │
        ▼
Zustand stores
  ├─ library.ts      书库、账本、连接配置
  ├─ ledger.ts       当前账本、账务 actions、成员 actions
  ├─ member-session.ts
  ├─ auth.ts
  └─ ui.ts
        │
        ├──► domain/*.ts        纯函数：余额、账单、预算、合并、报表、校验
        ├──► IndexedDB          主存储
        ├──► localStorage       兜底镜像
        └──► remote/*.ts        GitHub / Gitee / WebDAV 适配器与同步
```

### 关键原则

- `src/domain/` 尽量保持纯函数，不依赖 React。
- 金额计算必须在 domain 层完成，UI 不直接算余额。
- 账本状态通过 Zustand action 修改，不直接改 store 对象。
- 本地写入优先：先写 IndexedDB，界面立即更新；远程同步异步进行。
- 远程写入只通过 `src/remote/` 适配器，不在页面里直接发 Git API 请求。
- 静态托管使用 HashRouter，不需要服务端 404 重写。

## 5. 目录导览

```text
src/
├── domain/              # 纯业务逻辑
│   ├── ledger.ts        # 余额、账单状态、还款校验、支出确认
│   ├── merge.ts         # 多端字段级合并、墓碑、作者认领
│   ├── member-pin.ts    # PBKDF2 成员密码
│   ├── backup.ts        # 备份导入导出与校验
│   ├── budgets.ts       # 预算进度
│   ├── recurring.ts     # 周期规则
│   ├── csv.ts           # CSV 导入
│   ├── quick-entry.ts   # 一句话记账解析
│   ├── ai.ts            # OpenAI 兼容接口
│   ├── reports.ts       # CSV / PDF 报表
│   └── money.ts         # 金额解析与格式化
├── remote/
│   ├── sync.ts          # 拉取、合并、推送、冲突处理
│   ├── repository.ts    # meta.json + manifest + chunks
│   ├── chunks.ts        # 分片、哈希、manifest
│   ├── git-contents.ts  # GitHub / Gitee；GitHub 用 Git Data API
│   ├── webdav.ts        # WebDAV
│   └── attachments.ts   # 附件远程上传下载
├── store/
│   ├── library.ts       # 书库、账本、连接
│   ├── ledger.ts        # 当前账本 + 账务 actions
│   ├── member-session.ts
│   ├── auth.ts
│   └── ui.ts
├── pages/               # 首页、流水、账单、账户、设置等
├── components/
│   ├── entry-modal.tsx  # 记账 / 还款 / 转账表单
│   ├── bill-card.tsx
│   ├── sync-status-badge.tsx
│   └── legal-footer.tsx
├── i18n/
│   ├── index.ts         # 语言检测、懒加载、t()
│   ├── en.ts
│   ├── zh-TW.ts
│   └── ja.ts / ko.ts / es.ts / fr.ts / de.ts / pt.ts / ru.ts
├── types.ts             # 数据模型
└── main.tsx

public/
├── LICENSE.txt
├── NOTICE.txt
├── THIRD_PARTY_NOTICES.txt
├── support/             # 支付宝 / 微信 / 在线地址二维码
└── sw.js                # PWA Service Worker

docs/
└── deployment.md        # 面向普通用户的部署指南

server/
└── oauth-worker/        # 可选 OAuth Worker

scripts/
└── deploy-workbook.sh
```

## 6. 核心账务规则（必须保留）

金额全部使用**整数分**，不要用浮点数。

| 操作 | 资产 | 负债 | 支出 |
| --- | ---: | ---: | ---: |
| 现金支出 | −amount | 0 | +amount |
| 赊账支出 | 0 | +amount | 0（购买时不计） |
| 还款 | −amount | −amount | +amount |
| 收入 | +amount | 0 | 0 |
| 转账 | 转出 −amount，转入 +amount | 0 | 0 |

### 定义

- **净资产** = 总资产 − 总负债。
- **可支配资产** = 所有 `liquid = true` 的资产账户余额之和，**不扣减负债**。
- **总资产 / 总负债 / 账户余额 / 账单剩余金额** 都是推导值，不要单独存一份余额。
- **账单剩余金额** = 本金 − 关联该账单的还款金额。
- **支出确认**：
  - 现金支出立即确认。
  - 赊账购买只增加负债，不确认支出。
  - 还款时确认支出。
  - 转账不确认支出。
- **期初余额**只在创建账户时填写，之后不能直接修改；调整余额应通过流水或还款。

### 关键函数

- `getAccountBalance(account, entries)`
- `getBillRemaining(bill, entries)`
- `getBillStatus(bill, entries)`
- `getTotals(data)`
- `getMonthTotals(entries, date)`
- `isRecognizedExpense(entry)`
- `validateRepayment(bill, entries, amount, assetAccount)`
- `validateRepaymentToAccount(liabilityAccount, entries, amount, assetAccount)`

### 还款规则

当前版本支持两种还款：

1. **直接还款**：从资产账户还到负债账户，不选择账单。
   - `Entry.billId` 为空。
   - 只减少资产和负债，计入支出。
   - 不更新任何账单进度。
2. **从账单发起还款**：从账单卡片点「还款」。
   - 自动带出该账单的负债账户。
   - 后台仍然关联 `billId`，还款后更新该账单进度。
   - 界面上不需要手动选择账单。

必须保留的校验：

- 目标负债账户必须存在。
- 负债账户当前余额必须大于 0；为 0 时禁止还款。
- 还款金额不能超过负债账户当前余额。
- 资产账户余额不足时允许提交，但 UI 提示会变成负数。
- 还款金额必须大于 0。

## 7. 数据模型

核心类型在 `src/types.ts`。

### Library / Book

- `Library`：`books`、`activeBookId`、`connections`。
- `Book`：一个完整账本，包含：
  - `accounts`、`categories`、`members`
  - `tagGroups`、`tags`
  - `budgets`、`recurringRules`
  - `attachments`
  - `bills`、`entries`
  - `deletedEntries`、`deletedBills`、`deletedConfig`
  - `settings`
  - `remote` 绑定信息

### Account

- `kind: "asset" | "liability"`
- `openingBalance`：整数分
- `liquid?: boolean`：资产账户是否计入可支配资产
- 负债账户也可以有期初余额，会生成期初账单。

### Member

- 共享账的登录身份和记账作者。
- `pinHash` / `pinSalt` / `pinIterations`：PBKDF2。
- `updatedAt` / `fieldUpdatedAt`：成员合并使用。
- 成员密码哈希会随 `meta.json` 同步。

### Category / Tag

- 分类支持 `parent`，最多两级。
- 标签组支持单选 / 多选。

### Bill

- `liabilityAccountId`：所属负债账户。
- `categoryId`：可选，期初账单可以没有分类。
- `principal`：本金，整数分。
- `purchasedAt`、`dueDate`、`note`、`opening`。
- 账单剩余金额不存储，由关联还款推导。

### Entry

- `kind: "expense" | "income" | "repayment" | "transfer"`
- `amount`：整数分。
- `accountId`：资产账户（现金支出、收入、还款来源）。
- `liabilityAccountId`：负债账户（赊账支出、还款目标）。
- `billId`：可选。赊账支出和“从账单发起”的还款会带。
- `toAccountId`：转账转入账户。
- `categoryId`、`memberId`、`tagIds`、`attachmentIds`。
- `ownerId` / `ownerName`：作者。
- `originalAmount`：外币原始金额和汇率。
- `location`、`recurringId`、`note`。

### Tombstone

- `deletedEntries`、`deletedBills`、`deletedConfig`。
- 删除时写墓碑，合并时应用墓碑，防止旧副本复活。

## 8. 持久化与同步

### 本地存储

- 主存储：IndexedDB
  - 书库：`keyval-store` / `liangqi-library-v2`
  - 附件：`liangqi-attachments`
  - 远程分片缓存：`liangqi-remote-chunks`
  - 冲突备份：`liangqi-conflicts-v1`
- 兜底镜像：localStorage `liangqi-library-v2`
- 旧数据兼容：
  - `liangqi-ledger-v1`
  - `zhaibu-ledger-v1`
  - 旧版多账本布局 `liangqi/index.json` + `liangqi/books/<bookId>/`
  - 旧版单文件 `books/<bookId>.json`
- 不要随意改这些 key；改数据格式必须写迁移。

### 远程布局

一个仓库只保存一本共享账：

```text
repo/
└── liangqi/
    ├── meta.json
    ├── manifest.json
    ├── entries-0.json
    ├── entries-1000.json
    ├── bills-0.json
    └── attachments/
```

### 同步流程

1. 本地修改先写 IndexedDB，界面立即更新。
2. 延迟约 1.8 秒自动推送。
3. 先读 `manifest.json` 判断远程是否有变化。
4. 按分片哈希复用本地缓存。
5. 拉取远程后按 id 合并流水 / 账单。
6. 同一 id 的字段按 `fieldUpdatedAt` 逐字段取舍。
7. 成员按 `updatedAt` / `fieldUpdatedAt` 合并，避免旧副本覆盖新密码。
8. 应用墓碑。
9. 只上传哈希变化的分片。
10. GitHub 使用 Git Data API 批量提交；Gitee / WebDAV 按文件写入。
11. 写入前发现本地和远程都改过，保存冲突备份。
12. 远程失败不阻塞本地记账，恢复后补推。

### 作者权限

- 流水、账单、周期规则、附件记录作者。
- 非作者只能查看，不能修改或删除。
- 这是应用层权限；拥有仓库写权限的人仍可直接改 Git 文件。

## 9. 成员密码与本地锁

- 成员密码只存 PBKDF2 哈希、盐、迭代次数，不存明文。
- 哈希随 `meta.json` 写入远程仓库。
- 共享账成员必须有密码。
- 当前登录成员保存在本机 `localStorage`（`liangqi-active-members-v1`），不远程同步。
- 解锁状态保存在当前标签页 `sessionStorage`（`liangqi-unlocked-members-v1`）。
- 本地密码锁是另一套机制：`liangqi-auth-v1`，只保护界面访问，不加密 IndexedDB / localStorage。
- 不要在任何日志、提交或错误信息中输出 token、密码、私钥。

## 10. 多语言

支持 10 种界面语言：

- 简体中文（源文案）
- 繁體中文
- English
- 日本語
- 한국어
- Español
- Français
- Deutsch
- Português
- Русский

规则：

- UI 文案使用 `t("中文源文案", [参数])`。
- 翻译包在 `src/i18n/<语言>.ts`，key 是中文源文案。
- 所有翻译包必须拥有与 `en.ts` 完全相同的 key；`src/i18n/packs.test.ts` 会检查。
- 新增 key 时，必须同步更新 9 个翻译包（`en`、`zh-TW`、`ja`、`ko`、`es`、`fr`、`de`、`pt`、`ru`）。
- 缺少翻译时回退英文，再回退中文。
- 语言包按需加载，不要把所有翻译打进首屏。
- 语言保存在本机 `localStorage`（`liangqi-language-v1`），不写入共享账本。

README 也有 10 种语言版本，见 `README*.md`。

## 11. 关键 UI 入口

- `src/components/entry-modal.tsx`
  - 支出 / 收入 / 还款 / 转账四个 tab。
  - 还款页当前是「从哪个账户还款」+「还款到」两个账户选择器，不显示账单列表。
  - 从账单卡片进入时自动带出目标负债账户和金额，后台关联 `billId`。
  - 负债为 0 时确认按钮禁用。
- `src/pages/bills.tsx`、`src/components/bill-card.tsx`
  - 账单列表、还款入口、账单编辑。
- `src/pages/settings.tsx`
  - 界面语言、数据管理、AI 配置、赞助二维码、关于/许可证。
- `src/components/sync-status-badge.tsx`
  - 首页云同步状态。
- `src/components/legal-footer.tsx`
  - 登录页 / 主界面底部的 AGPL、源码、许可证入口。

## 12. 质量门槛与代码约定

必须遵守：

- 所有源码文件保留 SPDX 头：`AGPL-3.0-or-later`。
- 金额用整数分，使用 `parseAmountToCents` / `formatCents`。
- 不要在 UI 中手写余额计算。
- 不要绕过 store action 直接改状态。
- 不要绕过 `validateRepayment` / `validateRepaymentToAccount`。
- 不要删除或弱化成员密码、作者权限、墓碑和冲突备份。
- 不要删除 `LICENSE`、`NOTICE`、`THIRD_PARTY_NOTICES.md` 或 `public/` 中的许可证文件。
- 不要引入 GPL 不兼容的依赖；新增依赖前检查许可证。
- 不要提交 token、密码、私钥、`.env`、个人 API Key。
- 不要使用 `BrowserRouter`；静态部署依赖 HashRouter。
- 不要只改一种语言的翻译包。
- 不要改 `meta.json` / manifest / chunk 格式而不写迁移。
- 不要删除旧数据兼容逻辑，除非明确放弃旧版本。

提交前建议：

```bash
git status
pnpm typecheck
pnpm test
pnpm lint
pnpm build:workbook
```

提交信息使用现有风格：

```text
feat: ...
fix: ...
docs: ...
license: ...
```

## 13. 部署

- 纯静态前端，没有数据库。
- 根目录部署：`pnpm build`
- 子路径 `/workbook/`：`pnpm build:workbook`
- 产物在 `dist/`
- Nginx 需要 SPA fallback，但 HashRouter 通常不需要额外重写。
- 详细步骤见 [docs/deployment.md](docs/deployment.md)。
- 线上地址：https://arksc.cn:8002/workbook/

## 14. 许可证与合规

- 项目使用 **AGPL-3.0-or-later**。
- 完整文本：`LICENSE`
- 版权和网络使用说明：`NOTICE`
- 第三方依赖许可：`THIRD_PARTY_NOTICES.md`
- 构建产物内也包含：
  - `LICENSE.txt`
  - `NOTICE.txt`
  - `THIRD_PARTY_NOTICES.txt`
- 应用内「设置 → 关于两讫」和登录页法律页脚提供源码、许可证、第三方许可入口。

依赖许可证基线：

- MIT
- ISC
- Apache-2.0
- BSD-3-Clause
- MPL-2.0（仅构建工具 `lightningcss`）

不要添加 GPL / AGPL 不兼容的代码或素材。

历史说明：

- `88f622d` 之前的版本以 GPL-3.0-or-later 发布。
- 旧版本的 GPL 授权不可撤回。
- 当前版本和新版本使用 AGPL-3.0-or-later。

## 15. 常见坑（不要重新引入）

1. **把还款当成普通支出**：会重复计算支出。还款必须同时减少资产和负债。
2. **赊账购买时计入支出**：错误。购买时只增加负债，还款时才确认支出。
3. **可支配资产扣减负债**：错误。可支配资产只统计流动资产。
4. **单独存余额**：错误。余额、账单剩余、统计都由流水推导。
5. **还款必须选账单**：当前已改为可选。直接还款没有 `billId`；从账单发起才有。
6. **直接还款更新账单进度**：错误。直接还款只更新账户余额；账单进度只在关联 `billId` 时更新。
7. **负债为 0 仍允许还款**：错误。UI 应禁用，store 和 domain 也要拒绝。
8. **删除时只删记录不写墓碑**：会导致其他设备同步后复活。
9. **用旧成员记录覆盖新密码**：必须按 `updatedAt` / `fieldUpdatedAt` 合并。
10. **用 `BrowserRouter`**：静态托管刷新会 404。
11. **只改中文翻译 key**：`packs.test.ts` 会失败。
12. **提交 `.env` / token / 私钥**：绝对禁止。
13. **改备份格式不兼容旧版本**：`parseBackup` 支持 `liangqi` 和旧 `zhaibu` 标识，不要破坏。
14. **删除 AGPL / 第三方许可文件**：会导致分发合规问题。

## 16. 推荐阅读顺序

1. [README.md](README.md) — 产品功能和用户视角
2. `src/types.ts` — 数据模型
3. `src/domain/ledger.ts` — 账务规则
4. `src/store/ledger.ts` — 账务 actions
5. `src/domain/merge.ts` — 合并和墓碑
6. `src/remote/sync.ts` — 同步流程
7. `src/components/entry-modal.tsx` — 记账 / 还款 / 转账 UI
8. `src/i18n/index.ts` + `src/i18n/en.ts` — 多语言
9. [docs/deployment.md](docs/deployment.md) — 部署
10. `src/domain/backup.ts` — 备份与导入校验

## 17. 最近重要变更

- **2026-11-02**：还款改为资产账户 → 负债账户直接操作，不再要求选择账单；负债为 0 时禁止还款；备份支持无 `billId` 的还款。
- **2026-11-01**：许可证从 GPL-3.0-or-later 切换为 AGPL-3.0-or-later；补充应用内法律声明和第三方许可证。
- **2026-11-01**：README 增加 10 种语言版本。
- 多成员密码合并使用 `updatedAt` / `fieldUpdatedAt`，防止旧副本覆盖新密码。

## 18. 维护本文件

当以下内容变化时更新本文件：

- 技术栈或目录结构
- 数据模型或存储 key
- 账务规则
- 同步 / 合并 / 墓碑规则
- 多语言 key 规则
- 构建、测试、部署命令
- 许可证或第三方依赖

本文件是 AI 的入口文档，不是用户手册；用户功能说明放在 `README.md`。
