# 安装到手机 / 原生壳

两讫是一个 PWA。部署到 HTTPS 后可以直接安装到 iOS、Android 和桌面，不需要单独下载安装包。

## iOS / iPadOS

1. 用 Safari 打开部署地址（例如 `https://arksc.cn:8002/workbook/`）。
2. 点底部「分享」。
3. 选择「添加到主屏幕」。
4. 从主屏幕打开后，应用会以独立窗口显示，账本数据保存在本机 WebKit 的 IndexedDB。

iOS 的语音识别依赖 Safari 的 Web Speech 支持；如果系统没有提供中文识别，可以直接在输入框里打字。

## Android

1. 用 Chrome 打开部署地址。
2. 打开浏览器菜单，选择「安装应用」或「添加到主屏幕」。
3. 安装后可以离线打开应用外壳；记账数据仍然在本机。

## 可选：用 Capacitor 打包原生壳

如果需要在 App Store / Google Play 上架，可以用 Capacitor 包装同一份静态构建。仓库没有内置 `ios/` / `android/` 工程和签名配置，需要在 macOS / Android Studio 环境中生成。

```bash
pnpm add @capacitor/core
pnpm add -D @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "两讫" cn.arksc.liangqi --web-dir=dist
pnpm build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios       # 需要 Xcode / macOS
npx cap open android   # 需要 Android Studio
```

注意事项：

- `vite.config.ts` 默认 `base: "/"`；Capacitor WebView 从 `capacitor://localhost` 加载，使用默认构建即可，不要用 `build:workbook` 的 `/workbook/` 前缀。
- 原生壳仍然使用 IndexedDB / localStorage，卸载 App 会丢失本地账本，建议连接远程或定期导出备份。
- 附件二进制保存在 IndexedDB，不会随远程账本同步。
- iOS 的 Web Speech、定位、剪贴板权限需要在 `Info.plist` 中补充说明文案；首次使用时系统会弹窗请求权限。
- PWA 的 Service Worker 在原生 WebView 中通常不生效，离线能力由 Capacitor 的 WebView 资源加载承担。
