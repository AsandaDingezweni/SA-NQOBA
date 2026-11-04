import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { COLORS } from '@/constants/theme';

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
};

export type DieTone = 'attacker' | 'defender';
export type DieResult = 'win' | 'lose' | 'tie';

// A die that tumbles in whenever `rollKey` changes, then settles on `value`.
export function Die({ value, tone, result, size = 44, rollKey }: { value: number; tone: DieTone; result?: DieResult; size?: number; rollKey?: string | number }) {
  const spin = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 650, easing: Easing.out(Easing.back(1.6)), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [rollKey, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: [tone === 'attacker' ? '-540deg' : '540deg', '0deg'] });
  const scale = spin.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.3, 1.15, 1] });
  const bg = tone === 'attacker' ? COLORS.gold : COLORS.sky;
  const ring = result === 'win' ? COLORS.win : result === 'lose' ? COLORS.danger : result === 'tie' ? COLORS.text : 'transparent';
  const pip = size / 6.5;

  return (
    <Animated.View
      accessibilityLabel={`${tone} die showing ${value}${result ? `, ${result}` : ''}`}
      style={[
        styles.die,
        { width: size, height: size, borderRadius: size / 5, backgroundColor: bg, borderColor: ring, opacity: result === 'lose' ? 0.55 : 1 },
        { transform: [{ rotate }, { scale }] },
      ]}
    >
      {PIPS[value]?.map(([r, c], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: pip,
            height: pip,
            borderRadius: pip / 2,
            backgroundColor: COLORS.onColor,
            top: size * (0.2 + r * 0.3) - pip / 2,
            left: size * (0.2 + c * 0.3) - pip / 2,
          }}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  die: { borderWidth: 3, shadowColor: COLORS.shadow, shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
});
