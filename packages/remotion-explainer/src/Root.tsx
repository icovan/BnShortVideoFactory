import React from 'react';
import { Composition, CalculateMetadataFunction } from 'remotion';
import { LaunchShowreel } from './LaunchShowreel';
import { NarratedExplainer } from './NarratedExplainer';
import { ActiveLaunch } from './generated/ActiveLaunch';
import { ActiveNarrated } from './generated/ActiveNarrated';
import { ActiveNextWord } from './generated/ActiveNextWord';
import { NextWordLoop } from './NextWordLoop';
import { ActiveDirected } from './generated/ActiveDirected';
import { LaunchSchema, defaultLaunchProps, type LaunchProps } from './launchSchema';
import { NarratedSchema, defaultNarratedProps, type NarratedProps } from './narratedSchema';
import { NextWordSchema, defaultNextWordProps, type NextWordProps } from './nextWordSchema';
import { DirectedSchema, defaultDirectedProps, type DirectedProps } from './directedSchema';

const FPS = 30;

/** Same formula as Series.Sequence: round each scene, then sum. */
function sumSceneFrames(scenes: { durationSec: number }[] | undefined): number {
  const list = scenes || [];
  if (!list.length) return 1;
  return Math.max(
    1,
    list.reduce((s, sc) => s + Math.max(1, Math.round((Number(sc.durationSec) || 0) * FPS)), 0),
  );
}

const launchMeta: CalculateMetadataFunction<LaunchProps> = ({ props }) => ({
  durationInFrames: sumSceneFrames(props.scenes),
  fps: FPS,
  width: 1920,
  height: 1080,
});

const narratedMeta: CalculateMetadataFunction<NarratedProps> = ({ props }) => ({
  durationInFrames: sumSceneFrames(props.scenes),
  fps: FPS,
  width: 1920,
  height: 1080,
});

const nextWordMeta: CalculateMetadataFunction<NextWordProps> = ({ props }) => ({
  durationInFrames: sumSceneFrames(props.scenes),
  fps: FPS,
  width: 1080,
  height: 1920,
});

function directedSize(aspect: DirectedProps['aspect'], quality?: DirectedProps['quality']) {
  const q720 = quality === '720p';
  if (aspect === '9:16') return q720 ? { width: 720, height: 1280 } : { width: 1080, height: 1920 };
  if (aspect === '1:1') return q720 ? { width: 720, height: 720 } : { width: 1080, height: 1080 };
  if (aspect === '3:4') return q720 ? { width: 720, height: 960 } : { width: 1080, height: 1440 };
  return q720 ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
}

const directedMeta: CalculateMetadataFunction<DirectedProps> = ({ props }) => {
  const size = directedSize(props.aspect, props.quality);
  return {
    durationInFrames: sumSceneFrames(props.scenes),
    fps: FPS,
    ...size,
  };
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LaunchShowreel"
      component={LaunchShowreel}
      durationInFrames={600}
      fps={FPS}
      width={1920}
      height={1080}
      schema={LaunchSchema}
      defaultProps={defaultLaunchProps}
      calculateMetadata={launchMeta}
    />
    <Composition
      id="NarratedExplainer"
      component={NarratedExplainer}
      durationInFrames={900}
      fps={FPS}
      width={1920}
      height={1080}
      schema={NarratedSchema}
      defaultProps={defaultNarratedProps}
      calculateMetadata={narratedMeta}
    />
    {/* LLM-generated compositions — Active*.tsx swapped per job */}
    <Composition
      id="GeneratedLaunch"
      component={ActiveLaunch}
      durationInFrames={600}
      fps={FPS}
      width={1920}
      height={1080}
      schema={LaunchSchema}
      defaultProps={defaultLaunchProps}
      calculateMetadata={launchMeta}
    />
    <Composition
      id="GeneratedNarrated"
      component={ActiveNarrated}
      durationInFrames={900}
      fps={FPS}
      width={1920}
      height={1080}
      schema={NarratedSchema}
      defaultProps={defaultNarratedProps}
      calculateMetadata={narratedMeta}
    />
    <Composition
      id="NextWordLoop"
      component={NextWordLoop}
      durationInFrames={780}
      fps={FPS}
      width={1080}
      height={1920}
      schema={NextWordSchema}
      defaultProps={defaultNextWordProps}
      calculateMetadata={nextWordMeta}
    />
    <Composition
      id="GeneratedNextWord"
      component={ActiveNextWord}
      durationInFrames={780}
      fps={FPS}
      width={1080}
      height={1920}
      schema={NextWordSchema}
      defaultProps={defaultNextWordProps}
      calculateMetadata={nextWordMeta}
    />
    <Composition
      id="GeneratedDirected"
      component={ActiveDirected}
      durationInFrames={900}
      fps={FPS}
      width={1920}
      height={1080}
      schema={DirectedSchema}
      defaultProps={defaultDirectedProps}
      calculateMetadata={directedMeta}
    />
  </>
);
