import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, playerTone, RADIUS } from '@/constants/theme';
import { Flag } from '@/components/Flag';
import type { CountryState, Player } from '@/lib/types';

export type CardRole = 'source' | 'target' | 'battle-attacker' | 'battle-defender' | null;

const ROLE_STYLE: Record<Exclude<CardRole, null>, { color: string; label: string }> = {
  source: { color: COLORS.lime, label: 'FROM' },
  target: { color: COLORS.danger, label: 'TARGET' },
  'battle-attacker': { color: COLORS.lime, label: 'ATTACKING' },
  'battle-defender': { color: COLORS.danger, label: 'DEFENDING' },
};

export function CountryCard({
  country,
  owner,
  role,
  pending,
  onPress,
  disabled,
}: {
  country: CountryState;
  owner?: Player;
  role?: CardRole;
  pending?: number;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const previous = useRef(country.soldiers);

  useEffect(() => {
    if (previous.current === country.soldiers) return;
    previous.current = country.soldiers;
    pulse.setValue(1);
    Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [country.soldiers, pulse]);

  const tone = playerTone(owner?.color);
  const roleStyle = role ? ROLE_STYLE[role] : null;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const isHuman = owner?.kind === 'human';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${country.name}, held by ${owner?.name ?? 'unknown'}, ${country.soldiers} soldiers`}
      accessibilityState={{ disabled: !onPress || disabled, selected: Boolean(role) }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed, hovered }: any) => [
        styles.card,
        { backgroundColor: tone.wash, borderColor: roleStyle?.color ?? COLORS.line, borderLeftColor: tone.fill },
        roleStyle && { borderWidth: 2.5, borderLeftWidth: 6 },
        (pressed || (hovered && onPress && !disabled)) && { backgroundColor: tone.washHover },
        disabled && styles.disabled,
      ]}
    >
      {roleStyle ? (
        <View style={[styles.roleTag, { backgroundColor: roleStyle.color }]}>
          <Text style={styles.roleText}>{roleStyle.label}</Text>
        </View>
      ) : null}
      <View style={styles.head}>
        <Flag iso2={country.iso2} size={20} />
        <Text style={styles.name} numberOfLines={1}>{country.name}</Text>
      </View>
      <View style={styles.body}>
        <Animated.Text style={[styles.soldiers, { transform: [{ scale }] }]}>{country.soldiers}</Animated.Text>
        <Text style={styles.soldierLabel}>{country.soldiers === 1 ? 'soldier' : 'soldiers'}</Text>
        {pending ? <Text style={styles.pending}>+{pending}</Text> : null}
      </View>
      <View style={[styles.owner, { backgroundColor: tone.fill }]}>
        <Text style={styles.ownerText} numberOfLines={1}>{isHuman ? `★ ${owner?.name}` : owner?.name}</Text>
      </View>
      <Text style={styles.value}>Value {country.value} · {(country.population / 1e6).toFixed(country.population < 1e7 ? 1 : 0)}M people</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderLeftWidth: 6,
    padding: 10,
    gap: 6,
    minHeight: 128,
  },
  disabled: { opacity: 0.55 },
  roleTag: { position: 'absolute', top: -9, right: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, zIndex: 2 },
  roleText: { fontSize: 9, fontWeight: '900', color: COLORS.onColor, letterSpacing: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: COLORS.text, fontWeight: '800', fontSize: 14, flex: 1 },
  body: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  soldiers: { color: COLORS.text, fontSize: 30, fontWeight: '900' },
  soldierLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  pending: { color: COLORS.lime, fontWeight: '900', fontSize: 18, marginLeft: 'auto' },
  owner: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '100%' },
  ownerText: { color: COLORS.onColor, fontSize: 11, fontWeight: '800' },
  value: { color: COLORS.textMuted, fontSize: 10 },
});
