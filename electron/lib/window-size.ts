export interface WorkAreaSize {
  width: number
  height: number
}

/** 默认启动尺寸；过小屏幕则钳到工作区 */
export function getMainWindowSize({ width, height }: WorkAreaSize) {
  const preferredWidth = 1240
  const preferredHeight = 760

  return {
    width: Math.min(preferredWidth, width),
    height: Math.min(preferredHeight, height),
    minWidth: Math.min(980, width),
    minHeight: Math.min(620, height),
  }
}
