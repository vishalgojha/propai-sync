---
read_when:
  - 你想要可复现、可回滚的安装
  - 你已经在使用 Nix/NixOS/Home Manager
  - 你想要所有内容都固定并以声明式管理
summary: 使用 Nix 声明式安装 propai
title: Nix
x-i18n:
  generated_at: "2026-02-03T07:49:51Z"
  model: claude-opus-4-5
  provider: pi
  source_hash: f1452194cfdd74613b5b3ab90b0d506eaea2d16b147497987710d6ad658312ba
  source_path: install/nix.md
  workflow: 15
---

# Nix 安装

使用 Nix 运行 propai 的推荐方式是通过 **[nix-propai](https://github.com/propai/nix-propai)** — 一个开箱即用的 Home Manager 模块。

## 快速开始

将此粘贴给你的 AI 智能体（Claude、Cursor 等）：

```text
I want to set up nix-propai on my Mac.
Repository: github:propai/nix-propai

What I need you to do:
1. Check if Determinate Nix is installed (if not, install it)
2. Create a local flake at ~/code/propai-local using templates/agent-first/flake.nix
3. Help me create a Telegram bot (@BotFather) and get my chat ID (@userinfobot)
4. Set up secrets (bot token, Anthropic key) - plain files at ~/.secrets/ is fine
5. Fill in the template placeholders and run home-manager switch
6. Verify: launchd running, bot responds to messages

Reference the nix-propai README for module options.
```

> **📦 完整指南：[github.com/propai/nix-propai](https://github.com/propai/nix-propai)**
>
> nix-propai 仓库是 Nix 安装的权威来源。本页只是一个快速概述。

## 你将获得

- Gateway 网关 + 工具（whisper、spotify、cameras）— 全部固定版本
- 重启后仍能运行的 Launchd 服务
- 带有声明式配置的插件系统
- 即时回滚：`home-manager switch --rollback`

---

## Nix 模式运行时行为

当设置 `PROPAI_NIX_MODE=1` 时（nix-propai 会自动设置）：

propai 支持 **Nix 模式**，使配置确定性并禁用自动安装流程。
通过导出以下环境变量启用：

```bash
PROPAI_NIX_MODE=1
```


### 配置 + 状态路径

propai 从 `PROPAI_CONFIG_PATH` 读取 JSON5 配置，并将可变数据存储在 `PROPAI_STATE_DIR` 中。

- `PROPAI_STATE_DIR`（默认：`~/.propai`）
- `PROPAI_CONFIG_PATH`（默认：`$PROPAI_STATE_DIR/propai.json`）

在 Nix 下运行时，将这些显式设置为 Nix 管理的位置，以便运行时状态和配置不会进入不可变存储。

### Nix 模式下的运行时行为

- 自动安装和自我修改流程被禁用
- 缺失的依赖会显示 Nix 特定的修复消息
- 存在时 UI 会显示只读 Nix 模式横幅

## 相关内容

- [nix-propai](https://github.com/propai/nix-propai) — 完整设置指南
- [向导](/start/wizard) — 非 Nix CLI 设置
- [Docker](/install/docker) — 容器化设置




