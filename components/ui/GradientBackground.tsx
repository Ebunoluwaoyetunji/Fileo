/**
 * Full-bleed top-to-bottom gradient (or solid) fill, rendered behind its
 * children. Built on react-native-svg (already a project dependency) so no
 * extra gradient library is needed.
 *
 * The fill's <Svg> is sized from a real measured pixel width/height (via
 * onLayout), not the CSS percentage strings width="100%"/height="100%" this
 * used to pass straight through. Percentage sizing on web only resolves
 * once the browser has a definite size to resolve it against, and that
 * doesn't reliably happen for a freshly-mounted SVG reached via client-side
 * navigation (as opposed to a full page load) — it rendered fine on the
 * onboarding screens (reached via a full reload from splash) but came out
 * invisible on Home's compliance card (reached by client-side routing after
 * sign-in), same component, same props, different navigation history.
 * Measuring real pixels sidesteps that timing question entirely. Falls back
 * to "100%" for the one frame before the first onLayout fires, same as the
 * old always-on behavior, so nothing regresses while unmeasured.
 *
 * The gradient's own <LinearGradient id> is generated per-instance with
 * useId rather than hardcoded — React Navigation keeps a screen's previous
 * instance mounted (off-screen) during a transition, so two copies of this
 * component can exist in the DOM at once; a shared literal id="fill" is a
 * real (not just theoretical) collision; `fill="url(#fill)"` on the visible
 * one can resolve to the *other* instance's definition — which, if that
 * instance is a stale, zero-sized leftover, renders as no fill at all.
 */
import React, { ReactNode, useId, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type GradientBackgroundProps = {
  children?: ReactNode;
  /** A single color renders as a solid fill; two colors fade top to bottom. */
  colors: [string] | [string, string];
  /** Sizing for the outer, unpadded box the background SVG fills (e.g. flex). */
  style?: ViewStyle;
  /** Padding/layout for the content wrapper around `children`. */
  contentStyle?: ViewStyle;
};

export function GradientBackground({
  children,
  colors,
  style,
  contentStyle,
}: GradientBackgroundProps) {
  const [from, to = from] = colors;
  const [measuredSize, setMeasuredSize] = useState<{ width: number; height: number } | null>(
    null
  );
  // useId()'s default format includes colons (e.g. ":r0:"), which aren't
  // safe inside a url(#id) reference — strip them.
  const gradientId = `gradient-fill-${useId().replace(/:/g, '')}`;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setMeasuredSize({ width, height });
  };

  const svgWidth = measuredSize ? measuredSize.width : '100%';
  const svgHeight = measuredSize ? measuredSize.height : '100%';

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <Svg style={StyleSheet.absoluteFill} width={svgWidth} height={svgHeight}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={svgWidth} height={svgHeight} fill={`url(#${gradientId})`} />
      </Svg>
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
