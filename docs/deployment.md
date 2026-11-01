# 部署与使用指南

这份文档分两部分：

- **普通用户**：不写代码，直接打开网址使用。
- **管理员**：把两讫部署到自己的域名、服务器或静态托管平台。

两讫是纯静态前端，不需要数据库或后端服务。所有账本数据默认保存在浏览器；连接远程仓库后，数据保存在你自己的 GitHub / Gitee / WebDAV。

## 一、普通用户直接用

### 在线地址

**https://arksc.cn:8002/workbook/**

如果这个地址可以打开，不需要安装 Node.js，也不需要自己部署。

### 手机安装成 App（PWA）

**iPhone / iPad**

1. 用 Safari 打开上面的网址
2. 点底部分享按钮
3. 选择「添加到主屏幕」
4. 以后从主屏幕图标打开

**Android**

1. 用 Chrome 打开网址
2. 点右上角菜单
3. 选择「安装应用」或「添加到主屏幕」

PWA 需要 HTTPS；`localhost` 除外。

### 第一次打开

第一次打开会看到「登录你的账本」：

1. 选择 GitHub、Gitee 或 WebDAV
2. 填写仓库名和私钥
3. 连接后打开共享账本
4. 选择自己的成员并设置/输入密码

如果只是想本地记账，可以点「暂不连接，仅使用本地账本」，之后随时可以在「数据源」里连接。

### 连接共享账

**GitHub / Gitee**

- 仓库名：可以写 `family-ledger`，也可以写 `your-name/family-ledger`
- 私钥：GitHub 需要 `repo` 权限，Gitee 需要 `projects` 权限

同一个仓库可以由多人共用同一个私钥。每个人的身份由「成员登录」决定，不由 token 决定。

**WebDAV**

填写 WebDAV 地址、用户名、密码。服务器必须允许浏览器跨域访问（CORS），否则连接会失败。

### 多设备使用

每台设备都连接同一个仓库：

1. 第一台设备创建成员并设置密码
2. 其他设备用同一个仓库和私钥连接
3. 打开共享账后，选择自己的成员
4. 输入该成员的密码

成员密码只保存 PBKDF2 哈希，不保存明文；哈希会随 `meta.json` 写入远程仓库。

### 备份

到「设置 → 数据管理」：

- 导出当前账本
- 导出整个书库
- 导入备份

建议定期导出。清除浏览器数据会丢失本地数据；已连接远程的账本可以从仓库重新拉取。

## 二、自己部署

### 准备

- Node.js 22+
- pnpm
- 一个静态托管平台，或一台能运行 Nginx 的服务器

安装依赖并检查：

```bash
pnpm install
pnpm test
pnpm build
```

构建结果在 `dist/`。

---

### 方案 A：Netlify Drop（最简单，不需要服务器）

适合不想配置服务器的人。

1. 在电脑上执行：

```bash
pnpm install
pnpm build
```

2. 打开 <https://app.netlify.com/drop>
3. 把整个 `dist` 文件夹拖进去
4. 等待生成网址即可

默认构建使用根路径 `/`。如果网站部署在子路径，请使用：

```bash
VITE_BASE=/your-subpath/ pnpm build
```

---

### 方案 B：Cloudflare Pages

1. 把项目推到 GitHub / Gitee 等 Git 仓库
2. 在 Cloudflare Pages 中连接仓库
3. 构建命令：

```bash
pnpm build
```

4. 输出目录：

```text
dist
```

5. Node 版本选择 22 或更高

如果部署在子路径，在构建环境变量中设置：

```text
VITE_BASE=/your-subpath/
```

---

### 方案 C：Gitee Pages

Gitee Pages 需要公开仓库，并可能需要实名认证或开通 Pages 服务。

假设仓库地址是：

```text
https://gitee.com/your-name/liangqi-app
```

网站地址将会是：

```text
https://your-name.gitee.io/liangqi-app/
```

因此要按 `/liangqi-app/` 构建：

```bash
VITE_BASE=/liangqi-app/ pnpm build
```

然后把 `dist` 的内容发布到 `gh-pages` 分支：

```bash
cd dist
git init
git checkout -b gh-pages
git add .
git commit -m "deploy"
git remote add origin https://gitee.com/your-name/liangqi-app.git
git push -f origin gh-pages
```

最后在 Gitee 仓库：

1. 进入「服务」→「Gitee Pages」
2. 部署分支选择 `gh-pages`
3. 部署目录填 `/`
4. 启动或更新服务

两讫使用 HashRouter，不需要配置 404 重写。

> 如果 Gitee Pages 暂时不可用，可以改用 Netlify Drop 或 Cloudflare Pages。

---

### 方案 D：自己的服务器 / Nginx

#### 1. 构建

部署在域名根目录：

```bash
pnpm build
```

部署在 `/workbook/` 子路径：

```bash
pnpm build:workbook
```

#### 2. 上传

```bash
rsync -av --delete dist/ user@your-server:/var/www/workbook/
```

#### 3. Nginx 配置

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www;

    location = /workbook {
        return 301 /workbook/;
    }

    location /workbook/ {
        try_files $uri $uri/ /workbook/index.html;
        index index.html;
    }

    # 带哈希的静态资源可以长期缓存
    location /workbook/assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

检查并重载：

```bash
nginx -t
systemctl reload nginx
```

#### 4. HTTPS

推荐使用 Let's Encrypt：

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d example.com
```

然后放行 80/443：

```bash
ufw allow 80/tcp
ufw allow 443/tcp
```

HTTPS 是 PWA、剪贴板和部分浏览器能力正常工作的前提。

如果 443 暂时不可用，也可以像当前演示站一样临时使用其他端口：

```text
https://example.com:8002/workbook/
```

但正式使用建议配置标准 443。

#### 5. 使用部署脚本

项目自带：

```bash
DEPLOY_HOST=example.com \
DEPLOY_USER=root \
DEPLOY_PATH=/var/www/workbook \
bash scripts/deploy-workbook.sh
```

需要提前配置 SSH 密钥或 ssh-agent。

---

### 方案 E：本机预览

```bash
pnpm install
pnpm dev
```

打开终端提示的地址（通常是 `http://localhost:5173`）。

生产预览：

```bash
pnpm build
pnpm preview
```

## 三、部署后的检查清单

- [ ] 首页能打开，静态资源没有 404
- [ ] 刷新页面不会 404（HashRouter 通常没问题）
- [ ] 手机可以「添加到主屏幕」
- [ ] GitHub / Gitee / WebDAV 至少一种能连接
- [ ] 远程共享账可以打开
- [ ] 成员能设置密码并登录
- [ ] 锁定后能切换成员
- [ ] 修改一笔账后云图标能显示「待同步 → 已同步」
- [ ] 另一台设备能看到同步后的数据

## 四、常见问题

### 页面空白或资源 404

通常是构建路径和部署路径不一致。

- 部署在根目录：`pnpm build`
- 部署在 `/workbook/`：`pnpm build:workbook`
- 部署在其他子路径：`VITE_BASE=/your-path/ pnpm build`

### Gitee 显示仓库公开失败

Gitee 可能要求账号完成 2FA 或绑定第三方账号后才能发布公开内容。按 Gitee 页面提示完成安全设置即可。

### WebDAV 连接失败

通常是服务器没有允许浏览器跨域（CORS）。需要允许应用的来源访问 WebDAV 的 `PROPFIND`、`GET`、`PUT`、`MKCOL` 等请求。

### 成员密码不对

先确认选择的是正确成员。共享账成员密码以远程 `meta.json` 中的 PBKDF2 哈希为准；如果密码曾被旧版本覆盖，进入「成员」页重新设置一次即可。

### PWA 还是旧版本

关闭 PWA 后重新打开，或在浏览器中强制刷新。静态资源带哈希，刷新后会加载新文件。

### GitHub / Gitee token 权限

建议使用只授权单个仓库、具有读写权限的细粒度 token。token 只保存在本机 `localStorage`，不会写入账本文件。

## 五、数据与安全

- 账本默认保存在浏览器 IndexedDB，`localStorage` 作为兜底。
- 连接远程后，账本文件保存在你自己的仓库或 WebDAV。
- 成员密码只保存 PBKDF2 哈希、盐和迭代次数。
- 多成员共用一个私钥时，作者权限在应用层校验；拥有仓库写权限的人仍然可以直接改 Git 文件。
- 定期导出备份。
