/**
 * Shared screen wrapper: SafeAreaView + consistent horizontal padding.
 * Every route in app/ should render its content inside a <Screen>.
 */
import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { layout } from '../../constants/theme';

type ScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  /** Overrides the default background for both the safe area and content. */
  backgroundColor?: string;
};

export function Screen({
  children,
  style,
  edges = ['top', 'bottom'],
  backgroundColor = colors.background,
}: ScreenProps) {
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={edges}>
      <View style={[styles.content, { backgroundColor }, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
  },
});
