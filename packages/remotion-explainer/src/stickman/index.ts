export type { StickPose, PoseName, StickVariant, StickRig } from './types';
export {
  RIG,
  VISUAL_LOCK,
  VARIANTS,
  resolveRig,
  footPlantOffset,
  luminanceHex,
  resolveStickInk,
} from './types';
export {
  POSES,
  ensurePose,
  lerpPose,
  poseByName,
  mirrorPose,
  walkPose,
  runPose,
  idleBob,
  pushupPose,
  jumpPose,
  jumpHipY,
  wavePose,
  climbPose,
} from './poses';
export { Stickman } from './Stickman';
export type { StickmanProps } from './Stickman';
export { typeScale, safePad } from './typeScale';
export {
  Ground,
  Platform,
  SplitRule,
  PanelLabel,
  PropBlock,
  ProgressTicks,
  BilingualTitle,
  CaptionPill,
  KineticLine,
} from './Stage';
