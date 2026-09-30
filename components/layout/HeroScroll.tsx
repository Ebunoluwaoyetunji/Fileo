/**
 * A screen with a summary "hero" on top and the rest below: the hero sits on
 * the flat hero tint (colors.heroTint), the content on a white sheet with
 * rounded top corners and a hairline edge (no shadow). See DESIGN.md.
 *
 * Use inside <Screen backgroundColor={colors.heroTint} edges={['top']}> so
 * the status bar area is tinted too. The sheet grows to fill the screen, so
 * short content never shows the tint underneath.
 *
 *   <Screen backgroundColor={colors.heroTint} edges={['top']}>
 *     <HeroScroll hero={<Summary />}>
 *       <Details />
 *     </HeroScroll>
 *   </Screen>
 */
import React, { ReactNode, Ref } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';
import { layout, radii, spacing } from '../../constants/theme';

type Props = {
  hero: ReactNode;
  children?: ReactNode;
  heroStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
  scrollRef?: Ref<ScrollView>;
  /** False when the Screen has no side padding (the tab screens). */
  screenPadded?: boolean;
};

export function HeroScroll({ hero, children, heroStyle, sheetStyle, scrollRef, screenPadded = true }: Props) {
  return (
    <ScrollView
      ref={scrollRef}
      style={screenPadded ? styles.scroll : styles.scrollFlat}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, heroStyle]}>{hero}</View>
      <View style={[styles.sheet, sheetStyle]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Edge to edge (Screen pads its content); the hero and sheet pad themselves.
  scroll: {
    marginHorizontal: -layout.screenPadding,
  },
  scrollFlat: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  hero: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
