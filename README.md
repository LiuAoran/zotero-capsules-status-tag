<div align="center">

<img src="addon/assets/icon.svg" width="100" height="100" alt="Zotero Capsules Status logo" />

# Zotero Capsules Status

为 Zotero 文献添加可直接编辑的阅读状态胶囊。

[简体中文](README.md) · [English](README.en.md)

[![License](https://img.shields.io/badge/license-MIT-6750A4?style=flat-square)](LICENSE)
[![Stars](https://img.shields.io/github/stars/LiuAoran/zotero-capsules-status?style=flat-square)](https://github.com/LiuAoran/zotero-capsules-status/stargazers)
![Platform](https://img.shields.io/badge/platform-macOS-6750A4?style=flat-square)
![Zotero](https://img.shields.io/badge/Zotero-10-6750A4?style=flat-square)
[![Zotero Veil](https://img.shields.io/badge/%E5%8F%8B%E9%93%BE-Zotero%20Veil-6750A4?style=flat-square)](https://github.com/LiuAoran/zotero-veil)

[**下载 XPI**](downloads/zotero-capsules-status-1.0.0.xpi)

[预览](#预览) · [安装](#安装) · [功能](#功能) · [数据与兼容](#数据与兼容) · [开发](#开发)

</div>

---

独立的 Material Design 3 阅读状态插件，主要面向 macOS Zotero 10。

## 预览

截图来自独立临时配置和测试文献。明暗与种子色只影响插件自己的胶囊、菜单和设置页面。

![状态与设置](docs/screenshots/settings-dark.png)
![文献列表](docs/screenshots/library-dark.png)
![浅色设置](docs/screenshots/settings-light.png)

## 安装

1. 下载 [XPI](downloads/zotero-capsules-status-1.0.0.xpi)。在 GitHub 文件页面使用 **Download raw file** 保存。
2. 在 Zotero 的“工具 → 插件”中选择“从文件安装插件”。
3. 安装后在文献列表启用“状态”列，点击胶囊选择状态。
4. 打开“设置 → Capsules 状态”，调整主题、种子色、自定义状态和排序。

升级可覆盖安装，现有配置和文献标签保留。目前使用手动安装升级。

## 功能

- 五种内置状态：**New / To Read / Reading / Finished / UnRead**。没有状态的文献显示 New，打开 PDF 不自动改变状态。
- 胶囊等宽、左对齐；附近菜单直接选择，支持键盘和只读提示。
- 自定义名称、颜色和状态；▲ / ▼ 调整菜单与列的排序，− 删除自定义状态。
- 浅色、深色、跟随系统；官方 Material Color Utilities 配色，可选择随种子色轻微偏色。
- 恢复默认带确认弹窗，设置自动保存。
- PDF 子条目使用父文献状态；独立附件、笔记等非普通文献不提供编辑。
- 支持虚拟列表、外部标签更新、排序和 Zotero 撤销。

## 数据与兼容

| 显示 | 标准手动标签 |
| --- | --- |
| New | `/reading-status/new` |
| To Read | `/reading-status/to-read` |
| Reading | `/reading-status/reading` |
| Finished | `/reading-status/read` |
| UnRead | `/reading-status/unread` |

默认 New 只计算显示，不批量写标签。修改时只替换插件认识的专用标签，保留其他标签与字段；不修改 `/done`、`/reading` 等其他插件标签。禁用或卸载保留已设置标签。删除自定义状态及恢复默认也不批量改动文献。

支持 Zotero 10.0.*，验证环境为 macOS Zotero 10.0.6。其他平台尚未完整验证。虚拟列表兼容保护可能在菜单/保存及其后的短暂阶段纠正没有用户输入事件的程序选择；用户点击、导航键或滚动会结束保护。

真实运行验证使用临时配置、Gecko 事件和受控宿主恢复，不等同于实体鼠标或触控板验证。详见[验证说明](docs/验证说明.md)。

## 开发

需要 Node.js、npm 和 Python 3：

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run release
```

安装包、源码包与校验和生成在 `dist/`；当前 XPI 同时复制到 `downloads/`。生成代码位于 `build/`，不提交开发缓存或构建目录。

- `addon/`：插件入口、清单、设置页面和图标。
- `src/`：状态规则、列表、交互、设置和配色模块。
- `tests/`：模型测试与独立临时配置验证。
- `scripts/`：构建、打包和测试工具。
- `docs/`：架构、测试指南、验证记录和截图。
- `licenses/`：依赖许可证。

[架构说明](docs/架构.md) · [测试指南](docs/测试指南.md) · [发布说明](docs/发布说明.md)

## 许可证

采用 [MIT](LICENSE) 许可证。第三方依赖及开发工具见 [licenses/NOTICE.md](licenses/NOTICE.md)。
