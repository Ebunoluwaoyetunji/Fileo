/**
 * Full-bleed top-to-bottom gradient (or solid) fill, rendered behind its
 * children. Built on react-native-svg (already a project dependency) so no
 * extra gradient library is needed.
 *
 * The background `<Svg>` needs explicit width="100%"/height="100%" props to
 * size itself on web (react-native-web gives an unstyled <svg> a default
 * 150px height without them), but that percentage sizing can resolve
 * against the *content* box on native if this same box also carries
 * padding — pairing them shrinks the fill and, since absolute positioning
 * still pins it to the top-left, the shrinkage shows up as a gap on the
 * trailing edge instead of centered. So padding belongs on an inner
 * wrapper around `children`, never on the box the `<Svg>` measures itself
 * against — pass it via `contentStyle`, not `style`.
 */
import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
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

  return (
    <View style={[styles.container, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#fill)" />
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
