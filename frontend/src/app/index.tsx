import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';

const SPLASH_MS = 3000;

export default function SplashScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  useEffect(() => {
    const timer = setTimeout(() => router.replace('/menu'), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <Pressable style={styles.container} onPress={() => router.replace('/menu')} accessibilityLabel="Skip intro">
      <Image source={require('../../assets/images/sanqoba.jpeg')} style={styles.backgroundImage} resizeMode="contain" />
      <Text style={[styles.loadingText, { fontSize: width < 400 ? 14 : 18 }]}>Loading the battlefield…</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  backgroundImage: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, width: '100%', height: '100%' },
  loadingText: {
    position: 'absolute',
    bottom: '10%',
    color: COLORS.text,
    fontStyle: 'italic',
    fontWeight: 'bold',
    backgroundColor: COLORS.scrim,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
