# Skills pack（私有）

本目录的 **SKILL.md / references** 为私有创作资产，**不**随公开开源仓分发。产品走自建发布时，用正式安装包打入，或单独发 zip。

## 开发 / 正式包

- 本机开发：把完整 skills 放到此目录（或设置 `BIUNOW_SKILLS_DIR`）。
- 正式安装包：`BIUNOW_INCLUDE_SKILLS=1`（`pnpm build:release`），由 `stage-engine` 打进 `resources`。
- 仅壳的包：此目录可只留本 README；用户首次打开后导入 skills zip/文件夹到用户数据目录。

## 打包独立 skills

```bash
pnpm pack:skills
# → release/skills/biunow-skills-<version>.zip
```
