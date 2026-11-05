import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';
import { COLORS, mix, RADIUS } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: COLORS.lime, fg: COLORS.onColor },
  secondary: { bg: COLORS.raised, fg: COLORS.text, border: COLORS.lineStrong },
  accent: { bg: COLORS.gold, fg: COLORS.onColor },
  danger: { bg: COLORS.danger, fg: COLORS.onColor },
  ghost: { bg: 'transparent', fg: COLORS.lime, border: COLORS.lineStrong },
};

const BANNER_TONES = {
  error: { bg: mix(COLORS.panel, COLORS.danger, 0.2), fg: COLORS.dangerText },
  success: { bg: mix(COLORS.panel, COLORS.win, 0.14), fg: COLORS.win },
  info: { bg: mix(COLORS.panel, COLORS.sky, 0.14), fg: COLORS.sky },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  style,
  accessibilityHint,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      accessibilityHint={accessibilityHint}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg, opacity: inactive ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: v.fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={COLORS.textFaint}
        {...props}
        accessibilityLabel={label}
        style={[styles.input, error ? { borderColor: COLORS.danger } : null, props.style]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const btn = (label: string, next: number, enabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '−' ? 'Decrease' : 'Increase'}
      onPress={enabled ? () => onChange(next) : undefined}
      style={[styles.stepBtn, !enabled && { opacity: 0.35 }]}
    >
      <Text style={styles.stepBtnText}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {btn('−', value - 1, value > min)}
      <Text style={styles.stepValue}>{value}</Text>
      {btn('+', value + 1, value < max)}
      <Pressable onPress={() => onChange(max)} style={styles.stepMax}>
        <Text style={styles.stepMaxText}>max</Text>
      </Pressable>
    </View>
  );
}

export function Banner({ tone = 'error', message, onClose }: { tone?: 'error' | 'info' | 'success'; message: string; onClose?: () => void }) {
  const { bg, fg } = BANNER_TONES[tone];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={[styles.bannerText, { color: fg }]}>{message}</Text>
      {onClose ? (
        <Pressable accessibilityLabel="Dismiss" onPress={onClose} hitSlop={10}>
          <Text style={{ color: fg, fontWeight: '700' }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  buttonText: { fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },
  buttonTextSmall: { fontSize: 13 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.raised },
  chipActive: { backgroundColor: COLORS.lime, borderColor: COLORS.lime },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  chipTextActive: { color: COLORS.onColor },
  card: { backgroundColor: COLORS.panel, borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: COLORS.line },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  input: { borderWidth: 1.5, borderColor: COLORS.lineStrong, borderRadius: RADIUS.md, paddingVertical: 11, paddingHorizontal: 12, fontSize: 15, backgroundColor: COLORS.deep, color: COLORS.text },
  fieldError: { color: COLORS.dangerText, fontSize: 12, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.lime, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, fontWeight: '900', color: COLORS.onColor },
  stepValue: { minWidth: 34, textAlign: 'center', fontSize: 20, fontWeight: '900', color: COLORS.text },
  stepMax: { paddingHorizontal: 6, paddingVertical: 4 },
  stepMaxText: { fontWeight: '800', color: COLORS.lime, textDecorationLine: 'underline' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADIUS.md },
  bannerText: { flex: 1, fontWeight: '600', fontSize: 14 },
  statTile: { flexGrow: 1, flexBasis: 130, backgroundColor: COLORS.raised, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.line },
  statValue: { fontSize: 26, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },
  statHint: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1.2, color: COLORS.textMuted, textTransform: 'uppercase' },
});
