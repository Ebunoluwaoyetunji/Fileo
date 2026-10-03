/**
 * Fills the onboarding illustration area and centres a square in it, as large
 * as fits. Every onboarding illustration draws inside this square, so all
 * three are the same size and sit centred between the subtitle and the sheet.
 *
 * The lower part of every drawing sinks into white: a fade from clear to the
 * sheet colour lies over the bottom `sinkFraction` of the square, eased, and
 * stays white from the square's foot down to the sheet, across the full
 * screen width. Hidden from screen readers: the heading and subtitle carry
 * the meaning.
 */
import { ReactNode, useId, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../../constants/colors';
import { layout } from '../../constants/theme';
import { onboardingArt } from './art';

type Props = {
  /** `side` is the centred square; `box` is the whole area, for drawings that aren't square. */
  children: (side: number, box: { width: number; height: number }) => ReactNode;
};

/** Linear stops approximating an eased (smoothstep) fade. */
const SINK_STEPS = 8;

function Sink({ top, height, width, depth }: { top: number; height: number; width: number; depth: number }) {
  const gradientId = `onboarding-sink-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const end = depth / height;
  const stops = Array.from({ length: SINK_STEPS + 1 }, (_, i) => {
    const t = i / SINK_STEPS;
    return { offset: end * t, opacity: t * t * (3 - 2 * t) };
  });
  // solid from the drawing's foot down to the sheet
  stops.push({ offset: 1, opacity: 1 });
  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={height}
      style={[styles.sink, { top, left: -layout.screenPadding }]}
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          {stops.map((stop, i) => (
            <Stop key={i} offset={stop.offset} stopColor={colors.background} stopOpacity={stop.opacity} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradientId})`} />
    </Svg>
  );
}

export function IllustrationCanvas({ children }: Props) {
  const [box, setBox] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox({ width, height });
  };

  // an even whole number keeps the centre on a pixel boundary
  const side = Math.floor(Math.min(box.width, box.height) / 2) * 2;
  const squareTop = (box.height - side) / 2;
  const depth = side * onboardingArt.sinkFraction;
  const sinkTop = squareTop + side - depth;

  return (
    <View
      style={styles.fill}
      onLayout={handleLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {side > 0 ? (
        <>
          <View style={{ width: side, height: side }}>{children(side, box)}</View>
          <Sink
            top={sinkTop}
            height={box.height - sinkTop}
            width={box.width + layout.screenPadding * 2}
            depth={depth}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sink: {
    position: 'absolute',
  },
});
