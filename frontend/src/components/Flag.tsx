import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '@/constants/theme';

export function Flag({ iso2, size = 28 }: { iso2?: string; size?: number }) {
  return (
    <View style={[styles.frame, { width: size * 1.4, height: size }]}>
      {iso2 ? (
        <Image source={{ uri: `https://flagcdn.com/w80/${iso2}.png` }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 4, overflow: 'hidden', backgroundColor: COLORS.hover, borderWidth: 1, borderColor: COLORS.line },
});
