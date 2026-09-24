/**
 * Shared pieces for the filing-flow screens (Select Platform → Return Review):
 *
 *  - RequireDraft: the flow only edits a draft. With no draft (e.g. after
 *    submitting, then navigating back), the screen goes to the File tab
 *    instead, so a submitted return can't be edited from the UI.
 *  - useSaveAndContinue: "Continue" saves the step (lib/filings) and moves
 *    on. While saving, the button shows a spinner; if saving fails (e.g. no
 *    connection) the user's input stays as it is, an error shows under the
 *    button, and tapping Continue again retries.
 *  - SaveErrorNote: that error.
 *  - useMissingItems: what the draft still needs, from the server's own
 *    completeness rules (the same ones submit_filing enforces), re-checked
 *    whenever the screen is shown.
 *  - Fix mode: Return Review's "Fix" opens a step with `fix=1` (and `focus`,
 *    the platform or deduction to highlight). In fix mode, Continue saves
 *    and goes straight back to Return Review instead of on to the next step.
 *  - useStartFiling: every "start filing" button (Home, the File tab). Resumes
 *    the draft at its saved step, or creates one for the current tax year —
 *    never a second draft — or opens the File tab if this year is filed.
 *
 * ⚠️ No Figma design for the saving / save-failed states — built from the
 * existing Button loading spinner and the danger caption style.
 */
import { Href, Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import {
  FilingStep,
  getMissingItems,
  MissingItem,
  MissingItemDetails,
  STEP_ROUTES,
} from '../../lib/filings';
import { useFiling } from '../../state/filingContext';

export function RequireDraft({ children }: { children: ReactNode }) {
  const { isLoading, draft } = useFiling();
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!draft) {
    return <Redirect href="/(app)/filing-history" />;
  }
  return <>{children}</>;
}

export function useMissingItems(draftId: string | undefined) {
  const [items, setItems] = useState<MissingItem[] | null>(null);
  const [state, setState] = useState<'checking' | 'done' | 'failed'>('checking');

  const recheck = useCallback(async () => {
    if (!draftId) {
      setItems(null);
      return;
    }
    setState('checking');
    const result = await getMissingItems(draftId);
    if (result.error) {
      setState('failed');
      return;
    }
    setItems(result.items);
    setState('done');
  }, [draftId]);

  useFocusEffect(
    useCallback(() => {
      recheck();
    }, [recheck])
  );

  return { items, state, recheck, setItems };
}

/** Opens the step that fixes a missing item, highlighting it. */
export function openFix(details: MissingItemDetails) {
  router.push({
    pathname: STEP_ROUTES[details.step] as never,
    params: { fix: '1', ...(details.focus ? { focus: details.focus } : {}) },
  });
}

/** Whether this step was opened from Return Review's "Fix", and what to highlight. */
export function useFixMode() {
  const { fix, focus } = useLocalSearchParams<{ fix?: string; focus?: string }>();
  return { isFixing: fix === '1', focus: fix === '1' ? focus : undefined };
}

export function useSaveAndContinue(nextStep: FilingStep, nextRoute: Href) {
  const { saveProgress } = useFiling();
  const { isFixing } = useFixMode();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Returns true once saved (and navigated). */
  const saveAndContinue = async (): Promise<boolean> => {
    if (isSaving) {
      return false;
    }
    setIsSaving(true);
    setError(null);
    // Fixing something from Return Review: save, and go straight back there.
    const result = await saveProgress(isFixing ? 'return_review' : nextStep);
    setIsSaving(false);
    if (result.error) {
      if (result.error.code === 'not_draft') {
        router.replace('/(app)/filing-history');
        return false;
      }
      setError(
        result.error.code === 'network'
          ? 'Couldn’t save your progress. Check your connection and try again.'
          : 'Couldn’t save your progress. Please try again.'
      );
      return false;
    }
    if (isFixing) {
      router.dismissTo('/(app)/return-review');
    } else {
      router.push(nextRoute);
    }
    return true;
  };

  return { isSaving, error, saveAndContinue };
}

export function useStartFiling() {
  const { startFiling } = useFiling();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (isStarting) {
      return;
    }
    setIsStarting(true);
    setError(null);
    const result = await startFiling();
    setIsStarting(false);
    if (result.error) {
      setError(
        result.error.code === 'network'
          ? 'Couldn’t start your filing. Check your connection and try again.'
          : 'Couldn’t start your filing. Please try again.'
      );
      return;
    }
    router.push(result.route);
  };

  return { isStarting, start, error, clearError: () => setError(null) };
}

export function SaveErrorNote({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <Text style={styles.error} accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
