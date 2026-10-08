# BiunowFactory

本机 PC 创作软件：**创作面板 → 工作台 → Remotion 成片**。

## 开发

```bash
pnpm install
pnpm engine:install   # create-core + remotion 依赖
# 本机需有完整 vendor/skills（或 BIUNOW_SKILLS_DIR）
pnpm dev
```

## 开源 / 闭源怎么分

| 开源（推 GitHub / Gitee 公开仓） | 闭源（不要推、不要挂公开 Release） |
|--------------------------------|-----------------------------------|
| Electron 壳、UI、`packages/*` | `vendor/skills/**` 正文 |
| `vendor/skills-manifest.json`、`vendor/skills/README.md` | 正式安装包里打入的 skills |
| 安装/更新脚本、本 README | `node_modules`、`outputs/`、`data/`、本机 Key |

- 公开仓用户：`pnpm build:oss` 的壳 + 自行导入 skills zip（或你另发私有包）。
- 正式用户：`pnpm build:release`（skills 打进包）。

---

## 傻瓜式：首次同步到 GitHub + Gitee

前提：本机已装 `git`、`gh`（GitHub CLI）；Gitee 用网页或 `git` 即可。

### 1. 确认不会泄 skills

```bash
# skills 正文应被 ignore；公开仓只能有 README
git check-ignore -v vendor/skills/某技能/SKILL.md
```

`.gitignore` 已含 `vendor/skills/**`（保留 `README.md`）。

### 2. 初始化并推 GitHub（公开）

```bash
cd BiunowFactory
git init
git add .
git status   # 确认没有 vendor/skills 正文、没有 .env
git commit -m "chore: initial public tree"
gh repo create biunow/BiunowFactory --public --source=. --remote=origin --push
```

### 3. 同步 Gitee（公开镜像）

1. 在 Gitee 新建同名空仓库 `BiunowFactory`（不要勾选 README）。
2. 本机加远程并推送：

```bash
git remote add gitee https://gitee.com/<你的用户名>/BiunowFactory.git
git push -u gitee HEAD:main
```

以后两个平台都有同一份**开源树**。

### 4.（可选）挂第一版开源安装包

```bash
pnpm build:oss
# 产物在 release/<version>/
# GitHub：仓库 → Releases → 新建 tag，上传 setup/dmg
# Gitee：发行版 → 同样上传
```

更新检查 API（可写环境变量，默认占位仓库名需改成你的）：

- `BIUNOW_UPDATE_GITHUB` → GitHub `.../releases/latest`
- `BIUNOW_UPDATE_GITEE` → Gitee `.../releases/latest`

---

## 傻瓜式：以后每次更新怎么发

### A. 只更新开源源码（双平台）

```bash
# 改完代码
git add .
git commit -m "feat: 说明"
git push origin main
git push gitee main
```

### B. 发新版本号 + 开源安装包（双平台 Release）

```bash
# 1. 改 package.json 的 version，例如 0.1.1
# 2. 提交并打 tag
git add package.json
git commit -m "chore: v0.1.1"
git tag v0.1.1
git push origin main --tags
git push gitee main --tags

# 3. 打不含 skills 的开源包
pnpm build:oss

# 4. 上传 release/<version>/ 里的安装包到
#    GitHub Release（tag v0.1.1）和 Gitee 发行版（同一 tag）
```

### C. 正式闭源包（给终端用户，不要挂公开仓）

```bash
# 本机 vendor/skills 正文齐全
pnpm build:release
# 安装包放到你们自己的下载页 / 私有盘 / 私有 Release
# 不要上传到公开 GitHub/Gitee Release
```

### D. 单独发 skills 补丁（闭源）

```bash
pnpm pack:skills
# → release/skills/biunow-skills-<version>.zip
# 私发；用户在 App 里导入
```

---

## 命令速查

| 目的 | 命令 |
|------|------|
| 开发 | `pnpm dev` |
| 引擎依赖 | `pnpm engine:install` |
| 开源安装包（无 skills 正文） | `pnpm build:oss` |
| 正式包（含 skills） | `pnpm build:release` |
| skills zip | `pnpm pack:skills` |
| 双平台推源码 | `git push origin main` + `git push gitee main` |

环境变量：`BIUNOW_SKILLS_DIR`、`BIUNOW_INCLUDE_SKILLS=1`、`BIUNOW_UPDATE_GITHUB`、`BIUNOW_UPDATE_GITEE`。
