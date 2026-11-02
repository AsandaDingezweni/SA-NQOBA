import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';
import { COLORS, RADIUS } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ghostDark' | 'accent';

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: COLORS.mossGreen, fg: COLORS.white },
  secondary: { bg: COLORS.oliveGreen, fg: COLORS.white },
  accent: { bg: COLORS.yellowGreen, fg: COLORS.charcoal },
  danger: { bg: COLORS.danger, fg: COLORS.white },
  ghost: { bg: 'transparent', fg: COLORS.mossGreen, border: COLORS.mossGreen },
  ghostDark: { bg: 'transparent', fg: COLORS.yellowGreen, border: COLORS.yellowGreen },
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

export function Chip({ label, active, onPress, dark }: { label: string; active?: boolean; onPress?: () => void; dark?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, dark && styles.chipDark, active && (dark ? styles.chipDarkActive : styles.chipActive)]}
    >
      <Text style={[styles.chipText, dark && { color: COLORS.boardMuted }, active && { color: dark ? COLORS.charcoal : COLORS.white }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style, dark }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean }) {
  return <View style={[styles.card, dark && styles.cardDark, style]}>{children}</View>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#8A8F80"
        {...props}
        accessibilityLabel={label}
        style={[styles.input, error ? { borderColor: COLORS.danger } : null, props.style]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Stepper({ value, min, max, onChange, dark }: { value: number; min: number; max: number; onChange: (n: number) => void; dark?: boolean }) {
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
      <Text style={[styles.stepValue, dark && { color: COLORS.boardText }]}>{value}</Text>
      {btn('+', value + 1, value < max)}
      <Pressable onPress={() => onChange(max)} style={styles.stepMax}>
        <Text style={[styles.stepMaxText, dark && { color: COLORS.yellowGreen }]}>max</Text>
      </Pressable>
    </View>
  );
}

export function Banner({ tone = 'error', message, onClose }: { tone?: 'error' | 'info' | 'success'; message: string; onClose?: () => void }) {
  const bg = tone === 'error' ? '#FBE4E1' : tone === 'success' ? '#E8F3DA' : '#E5EEF2';
  const fg = tone === 'error' ? '#8E1F14' : tone === 'success' ? COLORS.mossGreen : '#23495A';
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

export function SectionTitle({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return <Text style={[styles.sectionTitle, dark && { color: COLORS.yellowGreen }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  buttonText: { fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },
  buttonTextSmall: { fontSize: 13 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: COLORS.mossGreen, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.mossGreen },
  chipDark: { backgroundColor: COLORS.boardRaised, borderColor: COLORS.boardLine },
  chipDarkActive: { backgroundColor: COLORS.yellowGreen, borderColor: COLORS.yellowGreen },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.mossGreen },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: COLORS.line },
  cardDark: { backgroundColor: COLORS.boardPanel, borderColor: COLORS.boardLine },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  input: { borderWidth: 1.5, borderColor: COLORS.line, borderRadius: RADIUS.md, paddingVertical: 11, paddingHorizontal: 12, fontSize: 15, backgroundColor: COLORS.white, color: COLORS.ink },
  fieldError: { color: COLORS.danger, fontSize: 12, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.yellowGreen, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, fontWeight: '900', color: COLORS.charcoal },
  stepValue: { minWidth: 34, textAlign: 'center', fontSize: 20, fontWeight: '900', color: COLORS.ink },
  stepMax: { paddingHorizontal: 6, paddingVertical: 4 },
  stepMaxText: { fontWeight: '800', color: COLORS.mossGreen, textDecorationLine: 'underline' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADIUS.md },
  bannerText: { flex: 1, fontWeight: '600', fontSize: 14 },
  statTile: { flexGrow: 1, flexBasis: 130, backgroundColor: COLORS.paper, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.line },
  statValue: { fontSize: 26, fontWeight: '900', color: COLORS.mossGreen },
  statLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },
  statHint: { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1.2, color: COLORS.mossGreen, textTransform: 'uppercase' },
});
