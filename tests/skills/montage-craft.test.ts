import { describe, expect, it } from 'vitest'
import { normalizeSkillPlan } from '../../packages/create-core/src/make/skillPlan'
import { applyScriptDriveToPlan } from '../../packages/create-core/src/make/scriptDrive'
import { directedOccupancyIssues, occupancyIssues, statsFromRgb } from '../../packages/create-core/src/make/stillOccupancy'
import type { SkillPlan } from '../../packages/create-core/src/make/skillPlan'

function planStub(): SkillPlan {
  return normalizeSkillPlan(
    {
      primary: 'explainer-video',
      support: ['diagram-animation'],
      beats: [
        { job: 'a', vo: '第一句足够长', headline: '第一句', visualIntent: '节点和连线占满画面', keyMotion: 'nodes then edges', skill: 'diagram-animation' },
        { job: 'b', vo: '第二句足够长', headline: '第二句', visualIntent: '节点和连线再走一层', keyMotion: 'nodes then edges', skill: 'diagram-animation' },
        { job: 'c', vo: '第三句足够长', headline: '第三句', visualIntent: '节点和连线收束', keyMotion: 'nodes then edges', skill: 'diagram-animation' },
        { job: 'd', vo: '第四句足够长', headline: '第四句', visualIntent: '节点和连线停住', keyMotion: 'nodes then edges', skill: 'diagram-animation' },
      ],
    },
    '16:9',
  )
}

describe('one skill per beat', () => {
  it('does not hang a map or a room on the promo price craft', () => {
    const plan = normalizeSkillPlan(
      {
        primary: 'promo-video',
        support: ['kinetic-typography'],
        beats: [
          { job: 'map', vo: '', headline: '航线', visualIntent: '一张简化海岸地图，航线从上海画到福冈', keyMotion: 'route draw', skill: 'promo-video', durationSec: 4 },
          { job: 'room', vo: '', headline: '房间', visualIntent: '等距三面墙房间，桌椅灯依次落位', keyMotion: 'drop', skill: 'promo-video', durationSec: 4 },
          { job: 'ink', vo: '', headline: '杯子', visualIntent: '奶油纸上一笔画出杯子', keyMotion: 'stroke', skill: 'promo-video', durationSec: 4 },
          { job: 'chat', vo: '', headline: '到了吗', visualIntent: '聊天气泡先出现输入点再发出', keyMotion: 'pop', skill: 'promo-video', durationSec: 4 },
          { job: 'price', vo: '', headline: '199', visualIntent: '价格 299 被划掉，199 弹出', keyMotion: 'pop', skill: 'promo-video', durationSec: 4 },
        ],
      },
      '16:9',
      undefined,
      { sourcePrompt: '第1镜地图 第2镜等距 第3镜杯子 第4镜聊天 第5镜价格' },
    )
    const byJob = Object.fromEntries(plan.beats.map((b) => [b.job, b]))
    expect(byJob.map.skill).toBe('map-animation')
    expect(byJob.room.skill).toBe('isometric-animation')
    expect(byJob.ink.skill).toBe('whiteboard-animation')
    expect(byJob.chat.skill).toBe('text-message-animation')
    expect(byJob.price.skill).toBe('promo-video')
    expect(byJob.map.craftMust?.join(' ')).not.toMatch(/Price strike/)
    expect(byJob.price.craftMust?.join(' ')).toMatch(/Price strike/)
    expect(plan.support).toContain('map-animation')
    expect(plan.beats.length).toBeGreaterThanOrEqual(5)
  })

  it('drops isometric when the picture is a flat line of stations', () => {
    const plan = normalizeSkillPlan(
      {
        primary: 'explainer-video',
        support: ['diagram-animation', 'isometric-animation', 'kinetic-typography'],
        beats: [
          { job: 'hook', vo: '一个人能不能跑通一条视频生产线', headline: '一个人能跑通吗', visualIntent: '粗体中文主标题从画面下方砸入', keyMotion: '回弹', skill: 'kinetic-typography', durationSec: 4 },
          { job: 'line', vo: '每个环节都有标准，能独立运转', headline: '标准·独立·离场', visualIntent: '画面横贯一条模块化流水线，三个工位各有标准卡', keyMotion: '工位依次自启动', skill: 'isometric-animation', durationSec: 5 },
          { job: 'step', vo: '把想和做分开', headline: '想和做', visualIntent: '节点和连线把想和做分开', keyMotion: 'nodes then edges', skill: 'diagram-animation', durationSec: 4 },
          { job: 'end', vo: '你从工人变成厂长', headline: '厂长', visualIntent: '满幅逐词砸出厂长', keyMotion: 'word slam', skill: 'kinetic-typography', durationSec: 4 },
        ],
      },
      '16:9',
    )
    const line = plan.beats.find((b) => b.job === 'line')
    expect(line?.skill).toBe('diagram-animation')
    expect(plan.support).not.toContain('isometric-animation')
    expect(plan.skills).not.toContain('isometric-animation')
    expect(line?.craftMust?.join(' ')).not.toMatch(/rotateX/)
  })
})

describe('script visuals', () => {
  it('strips the filename and refuses an Illustrate paraphrase', () => {
    const plan = applyScriptDriveToPlan(
      planStub(),
      [
        {
          job: 'hook',
          vo: '【旁白.txt】 做个人 IP 不想露脸怎么办？别硬逼自己出镜。',
          headline: '【旁白.txt】 做个人 IP',
          visualIntent: 'Illustrate: 【旁白.txt】 做个人 IP 不想露脸怎么办？别硬逼自己出镜。',
          keyMotion: 'spring reveal',
        },
        {
          job: 'cost',
          vo: '单条视频最低两毛，五分钟不到一块钱。',
          headline: '成本',
          visualIntent: 'Illustrate: 单条视频最低两毛，五分钟不到一块钱。',
          keyMotion: 'spring reveal',
        },
        {
          job: 'steps',
          vo: '丢进去一篇文章，它会拆分语义分镜。',
          headline: '拆分',
          visualIntent: 'Illustrate: 丢进去一篇文章，它会拆分语义分镜。',
          keyMotion: 'spring reveal',
        },
        {
          job: 'end',
          vo: '你要做的是预览、保存，然后发布。',
          headline: '发布',
          visualIntent: 'Illustrate: 你要做的是预览、保存，然后发布。',
          keyMotion: 'spring reveal',
        },
      ],
      'verbatim',
    )
    expect(plan.beats[0].vo).not.toMatch(/旁白\.txt|【/)
    expect(plan.beats[0].headline).not.toMatch(/旁白\.txt|【/)
    for (const b of plan.beats) {
      expect(b.visualIntent).not.toMatch(/^Illustrate:/i)
      expect(b.keyMotion).not.toBe('spring reveal')
    }
    for (const b of plan.beats) {
      expect(b.headline.length).toBeLessThanOrEqual(12)
      expect(b.visualIntent).toMatch(/物体/)
      expect(b.visualIntent).not.toMatch(/只有字|节点和连线/)
    }
    expect(plan.beats.find((b) => b.job === 'cost')?.headline).toBe('成本')
  })

  it('keeps a concrete picture and does not turn 技术路线 into a map', () => {
    const plan = applyScriptDriveToPlan(
      planStub(),
      [
        {
          job: 'line',
          vo: '三个工位各自按标准运转，人不在现场。',
          headline: '三个工位',
          visualIntent: '三个工位依次亮起绿灯，人站在线外',
          keyMotion: 'stations start',
        },
        {
          job: 'route',
          vo: '整个核心的技术路线主要分成五个模块。',
          headline: '整个核心的技术路线主要分成五个模块。',
          visualIntent: 'Illustrate: 整个核心的技术路线主要分成五个模块。',
          keyMotion: 'spring reveal',
        },
      ],
      'verbatim',
    )
    expect(plan.beats[0].visualIntent).toMatch(/三个工位/)
    expect(plan.beats[0].skill).not.toBe('map-animation')
    expect(plan.beats[0].craftMust?.join(' ')).toMatch(/Picture = visualIntent/)
    expect(plan.beats[0].craftMust?.join(' ')).not.toMatch(/nodes then edges/)
    expect(plan.beats[1].skill).not.toBe('map-animation')
    expect(plan.beats[1].headline.length).toBeLessThanOrEqual(12)
    expect(plan.beats[1].visualIntent).toMatch(/物体/)
    expect(plan.beats[1].visualIntent).not.toMatch(/只有字|地图占满/)
  })
})

describe('still occupancy', () => {
  it('flags a blank field, a hairline, and a speck', () => {
    const blank = Buffer.alloc(96 * 54 * 3, 8)
    expect(occupancyIssues(statsFromRgb(blank)!).join(' ')).toMatch(/near-blank/)

    const hair = Buffer.alloc(96 * 54 * 3, 8)
    for (let x = 10; x < 80; x++) {
      const i = (27 * 96 + x) * 3
      hair[i] = hair[i + 1] = hair[i + 2] = 220
    }
    expect(occupancyIssues(statsFromRgb(hair)!).join(' ')).toMatch(/thin line/)

    const speck = Buffer.alloc(96 * 54 * 3, 8)
    for (let y = 24; y < 30; y++) {
      for (let x = 45; x < 51; x++) {
        const i = (y * 96 + x) * 3
        speck[i] = speck[i + 1] = speck[i + 2] = 230
      }
    }
    expect(occupancyIssues(statsFromRgb(speck)!).join(' ')).toMatch(/speck/)
  })

  it('keeps a large title', () => {
    const frame = Buffer.alloc(96 * 54 * 3, 8)
    for (let y = 18; y < 36; y++) {
      for (let x = 20; x < 76; x++) {
        const i = (y * 96 + x) * 3
        frame[i] = frame[i + 1] = frame[i + 2] = 240
      }
    }
    expect(occupancyIssues(statsFromRgb(frame)!)).toEqual([])
    expect(directedOccupancyIssues(statsFromRgb(frame)!)).toEqual([])
  })

  it('flags a left-column hero with a void right half', () => {
    const frame = Buffer.alloc(96 * 54 * 3, 8)
    for (let y = 12; y < 44; y++) {
      for (let x = 2; x < 28; x++) {
        const i = (y * 96 + x) * 3
        frame[i] = frame[i + 1] = frame[i + 2] = 240
      }
    }
    expect(occupancyIssues(statsFromRgb(frame)!)).toEqual([])
    expect(directedOccupancyIssues(statsFromRgb(frame)!).join(' ')).toMatch(/void|both thirds/)
  })

  it('keeps a centered full-bleed object', () => {
    const frame = Buffer.alloc(96 * 54 * 3, 8)
    for (let y = 14; y < 42; y++) {
      for (let x = 28; x < 68; x++) {
        const i = (y * 96 + x) * 3
        frame[i] = frame[i + 1] = frame[i + 2] = 240
      }
    }
    expect(directedOccupancyIssues(statsFromRgb(frame)!)).toEqual([])
  })
})
