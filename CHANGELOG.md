## Unreleased

- 对齐老厂：工作流 = StylePack（skill-directed / launch-showreel / narrated-explainer / next-word-loop / footage-remix）；原案例货架改为模板货架，绑定工作流+种子提示词；APP 点选后改词同质出片；恢复硬 SKU 出片路由。
- 模板货架：默认不展示（官网配置开关）；分类下拉 + 横向滚动与左右翻页；预览播放弹窗；点选只绑自由创作（混剪除外）。
- （已纠正）此前误把工作流绑成 APP `formMode` 入口形态，已撤销。
- 激活授权：新机免费体验 3 天（一机一码）；创作页「引擎已就绪 | 体验/专业版剩余 X 天」；点击弹窗激活；出片门禁；对接 `BN_COMMERCE_URL` 管理后台核销与公开站点配置（关于/版权/下载按语言）。
- 产品标识：软件名 `BnShortVideoFactory`，包名 `bn-short-video-factory`，`appId` `com.bn.shortvideofactory`；更新检查按界面语言分流（中文 Gitee / 英文 GitHub）。
- 火柴人 skill：姿态字母 + 动作短语库（sampleClip / 意图映射）；补 push/pull/carry/handoff/desk；SignBoard/PhoneSlab 场面道具；双人辩论短语；codegen 优先短语而非盲目加姿。
- 工作台创作进度：步骤描述支持中英双语（默认 seed + 常见运行中文 detail 映射）；标题原有 `studio.steps.*`。
- 火柴人机器 brief：需求含 stickman/火柴人时，润色/路由注入「意图→短语」锁，分镜 visualIntent 强制 `clip:<id>`，避免乱点姿态名。
- Logo / 动效升级：拆成「Logo 片」与「动效展片」两条成品线；Logo 硬锁 geo→accent→assemble→overshoot→settle；展片硬锁六章技法（弹压/动能字/错峰/径向/碎裂/定版），均无旁白。
- 创作面板：自动音效 / 网页检索默认开启；配音跟随全局配置，中英文界面分别记住默认音色。
- 修复：安装包创作面板设计参考列表为空（打包打入 `assets/style-refs`，不再误用空 `data/style-refs`）。
- 创作面板：切换 6 种分类时清空输入/附件/设计参考，回到该分类默认态。
- 混剪：新增 UI 形态「混剪」；口播硬锁/合成 → TTS → 素材库随机切镜 → FFmpeg 成片（字幕烧录，失败则无字幕降级）。
- 混剪话题字段：种草可填品牌/卖点，故事口播与干货清单可填主题，写入口播策划约束。
- Logo/动效：独立形态 `logo`（旧 `stickman` 任务映射过来）；默认无旁白、无讲解字幕，主 skill 为 logo-animation。
- 火柴人：不再占 UI 分类，由提示词驱动；可与 explainer/diagram/kinetic 等混用。Manim 仍独占、不可混用。
- 无文稿但需要口播：先合成可说旁白再硬锁分镜/TTS，避免 5–8 句口号即兴分镜。
- 画幅工艺：9:16 不再强制每行 ≥72 动能砸字；竖屏安全区上 8% / 下 18%；宽屏四周 ≥6%。
