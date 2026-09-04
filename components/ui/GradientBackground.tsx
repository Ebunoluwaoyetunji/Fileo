/**
 * Full-bleed top-to-bottom gradient (or solid) fill, rendered behind its
 * children. Built on react-native-svg (already a project dependency) so no
 * extra gradient library is needed.
 */
import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type GradientBackgroundProps = {
  children?: ReactNode;
  /** A single color renders as a solid fill; two colors fade top to bottom. */
  colors: [string] | [string, string];
  style?: ViewStyle;
};

export function GradientBackground({ children, colors, style }: GradientBackgroundProps) {
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
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
