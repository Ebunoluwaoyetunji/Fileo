/**
 * Onboarding step 1: a phone showing the Fileo wordmark, with a Tax form card
 * and a Bank statement card floating beside it. Drawn as vector and real
 * components so it stays crisp: a navy phone, and white cards with a tinted
 * icon disc, a label and a small document drawn with simple lines.
 *
 * The phone's foot sinks into the white below (IllustrationCanvas). The two
 * cards float up and down gently, slightly out of step. With reduce motion
 * on, they hold still.
 */
import { FileText, Landmark, type LucideIcon } from 'lucide-react-native';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Rect } from 'react-native-svg';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import { BadgeTone, iconSizeFor, onboardingArt, useReduceMotion } from '../../components/onboarding/art';
import { IllustrationCanvas } from '../../components/onboarding/IllustrationCanvas';
import { floatTranslate, useLoopClock } from '../../components/onboarding/motion';
import { OnboardingBadge } from '../../components/onboarding/OnboardingBadge';
import { FileoWordmark } from '../../components/ui/FileoWordmark';
import { colors } from '../../constants/colors';
import { radii } from '../../constants/theme';

/** Layout, as fractions of the side. */
const PHONE = { x: 0.29, y: 0.04, width: 0.42, height: 0.92, radius: 0.07 };
const CARD_WIDTH = 0.48;
const CARD_PADDING = 0.035;
const DISC = 0.15;
const DOC = { width: 0.13, height: 0.17 };
const LABEL_SIZE = 0.032;
const CARD_EDGE = 0.01;
/** Card tops, and the wordmark's centre in the gap between them. */
const TAX_CARD_TOP = 0.04;
const BANK_CARD_TOP = 0.5;
const WORDMARK_CENTRE = 0.415;
/** The second card floats a third of a beat behind the first. */
const SECOND_CARD_PHASE = 0.33;

function Phone({ side }: { side: number }) {
  const width = side * PHONE.width;
  const height = side * PHONE.height;
  const radius = side * PHONE.radius;
  const inset = side * 0.014;
  const island = { width: side * 0.11, height: side * 0.03 };
  const wordmarkWidth = side * 0.25;
  const wordmarkHeight = (wordmarkWidth * 35) / 141;
  // the light outline sits inside the phone's box, so nothing is clipped
  const half = onboardingArt.lineWidth / 2;

  return (
    <View style={{ position: 'absolute', left: side * PHONE.x, top: side * PHONE.y, width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Rect
          x={half}
          y={half}
          width={width - half * 2}
          height={height - half * 2}
          rx={radius - half}
          fill={colors.backgroundInverse}
          stroke={colors.outlineOnDark}
          strokeWidth={onboardingArt.lineWidth}
        />
        <Rect
          x={inset}
          y={inset}
          width={width - inset * 2}
          height={height - inset * 2}
          rx={radius - inset}
          fill="none"
          stroke={colors.faintOnDark}
          strokeWidth={onboardingArt.lineWidth}
        />
        <Rect
          x={(width - island.width) / 2}
          y={inset * 2.2}
          width={island.width}
          height={island.height}
          rx={island.height / 2}
          fill={colors.textPrimary}
        />
      </Svg>
      <View style={[styles.phoneScreen, { top: side * (WORDMARK_CENTRE - PHONE.y) - wordmarkHeight / 2 }]}>
        <FileoWordmark width={wordmarkWidth} height={wordmarkHeight} />
      </View>
    </View>
  );
}

/** A small tax form: a title, a field box and a few lines. */
function TaxFormDoc() {
  return (
    <>
      <Rect x={4} y={5} width={16} height={3} rx={1} fill={colors.backgroundInverse} />
      <Rect x={4} y={11} width={26} height={2} rx={1} fill={colors.border} />
      <Rect x={4} y={16} width={32} height={18} rx={1.5} fill="none" stroke={colors.mutedStroke} strokeWidth={0.8} />
      <Line x1={4} y1={22} x2={36} y2={22} stroke={colors.mutedStroke} strokeWidth={0.8} />
      <Line x1={4} y1={28} x2={36} y2={28} stroke={colors.mutedStroke} strokeWidth={0.8} />
      <Line x1={20} y1={22} x2={20} y2={34} stroke={colors.mutedStroke} strokeWidth={0.8} />
      <Rect x={4} y={39} width={22} height={2} rx={1} fill={colors.border} />
      <Rect x={4} y={44} width={28} height={2} rx={1} fill={colors.border} />
    </>
  );
}

/** A small bank statement: a title and rows of entries, money in shown in green. */
function BankStatementDoc() {
  const rows = [17, 24, 31, 38, 45];
  return (
    <>
      <Rect x={4} y={5} width={20} height={3} rx={1} fill={colors.backgroundInverse} />
      <Rect x={4} y={11} width={8} height={1.5} rx={0.75} fill={colors.mutedStroke} />
      <Rect x={28} y={11} width={8} height={1.5} rx={0.75} fill={colors.mutedStroke} />
      {rows.map((y, i) => (
        <G key={y}>
          <Rect x={4} y={y} width={12} height={2} rx={1} fill={colors.border} />
          <Rect
            x={i % 2 === 0 ? 26 : 28}
            y={y}
            width={i % 2 === 0 ? 10 : 8}
            height={2}
            rx={1}
            fill={i % 2 === 0 ? colors.primary : colors.mutedStroke}
          />
          {i < rows.length - 1 ? (
            <Line x1={4} y1={y + 4.5} x2={36} y2={y + 4.5} stroke={colors.border} strokeWidth={0.5} />
          ) : null}
        </G>
      ))}
    </>
  );
}

type CardProps = {
  side: number;
  icon: LucideIcon;
  tone: BadgeTone;
  label: string;
  doc: 'tax' | 'bank';
  left: number;
  top: number;
  float: Animated.AnimatedInterpolation<number> | number;
};

function DocumentCard({ side, icon, tone, label, doc, left, top, float }: CardProps) {
  const padding = side * CARD_PADDING;
  const disc = Math.round(side * DISC);
  const labelSize = side * LABEL_SIZE;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          left: side * left,
          top: side * top,
          width: side * CARD_WIDTH,
          padding,
          transform: [{ translateY: float }],
        },
      ]}
    >
      <View style={styles.cardRow}>
        <OnboardingBadge icon={icon} tone={tone} size={disc} iconSize={iconSizeFor(side)} variant="solid" />
        <Svg width={side * DOC.width} height={side * DOC.height} viewBox="0 0 40 52">
          <Rect x={0.5} y={0.5} width={39} height={51} rx={2.5} fill={colors.surface} stroke={colors.border} strokeWidth={0.8} />
          {doc === 'tax' ? <TaxFormDoc /> : <BankStatementDoc />}
        </Svg>
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          styles.label,
          { fontSize: labelSize, lineHeight: labelSize * 1.35, marginTop: side * 0.022, letterSpacing: labelSize * 0.075 },
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

function PhoneAndCards({ side }: { side: number }) {
  const reduceMotion = useReduceMotion();
  const running = reduceMotion === false;
  const clock = useLoopClock(onboardingArt.floatMs, running);

  return (
    <>
      <Phone side={side} />
      <DocumentCard
        side={side}
        icon={FileText}
        tone="indigo"
        label="Tax form"
        doc="tax"
        left={CARD_EDGE}
        top={TAX_CARD_TOP}
        float={floatTranslate(clock, 0, running)}
      />
      <DocumentCard
        side={side}
        icon={Landmark}
        tone="green"
        label="Bank statement"
        doc="bank"
        left={1 - CARD_WIDTH - CARD_EDGE}
        top={BANK_CARD_TOP}
        float={floatTranslate(clock, SECOND_CARD_PHASE, running)}
      />
    </>
  );
}

export default function OnboardingStepOne() {
  return (
    <OnboardingScreen
      step={1}
      heading="File Your Taxes Without the Stress"
      body="Prepare and file your tax return in minutes. Fileo handles the hard work, so you don't have to."
      illustration={<IllustrationCanvas>{(side) => <PhoneAndCards side={side} />}</IllustrationCanvas>}
      nextRoute="/(onboarding)/step-2"
    />
  );
}

const styles = StyleSheet.create({
  phoneScreen: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  card: {
    position: 'absolute',
    backgroundColor: colors.background,
    borderRadius: radii.lg,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
});
