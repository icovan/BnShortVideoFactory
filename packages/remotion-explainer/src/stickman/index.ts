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
export type { StickClipId, ClipSample, ClipMeta } from './clips';
export {
  STICK_CLIPS,
  INTENT_TO_CLIPS,
  clipsForIntent,
  sampleClip,
  sampleClipForIntent,
} from './clips';
export { Stickman } from './Stickman';
export type { StickmanProps } from './Stickman';
export { typeScale, safePad } from './typeScale';
export {
  Ground,
  Platform,
  SplitRule,
  PanelLabel,
  PropBlock,
  SignBoard,
  PhoneSlab,
  ProgressTicks,
  BilingualTitle,
  CaptionPill,
  KineticLine,
} from './Stage';
