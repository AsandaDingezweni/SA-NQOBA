import React from 'react';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Button } from '@/components/ui';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function MenuScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, logout } = useAuth();
  const titleSize = Math.min(width * 0.1, 64);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: 'SA-NQOBA · Conquer the World' }} />
      <View style={[styles.wrapper, width > 768 && styles.wrapperDesktop]}>
        <View style={styles.header}>
          <Image source={require('../../assets/images/sa-nqoba-logo.jpeg')} style={styles.logo} accessibilityLabel="SA-NQOBA logo" />
          <Text style={[styles.title, { fontSize: titleSize }]}>SA-NQOBA</Text>
          <Text style={styles.tagline}>Nqoba: “conquer”. Ten nations. One commander.</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{user ? `Sawubona, ${user.username}!` : 'Welcome, Commander!'}</Text>
          <Text style={styles.infoText}>
            Choose any nation on Earth, then face nine rival nations drawn at random. Armies are sized by real populations,
            every battle is called live by an AI commentator, and rival NPCs explain every move they make. Conquer all ten to win.
          </Text>
        </View>

        <View style={styles.buttons}>
          <Button title="🎮  START NEW CAMPAIGN" onPress={() => router.push(user ? '/new-game' : '/login?next=/new-game')} />
          <Button variant="secondary" title="🗂️  MY CAMPAIGNS & LIVE GAMES" onPress={() => router.push('/games')} />
          <Button variant="secondary" title="📊  STATISTICS & LEADERBOARD" onPress={() => router.push('/stats')} />
          <Button variant="secondary" title="📖  HOW TO PLAY" onPress={() => router.push('/rules')} />
          {user ? (
            <Button variant="ghost" title={`Log out (${user.username})`} onPress={logout} />
          ) : (
            <View style={styles.authRow}>
              <Button variant="accent" title="Log in" onPress={() => router.push('/login')} style={{ flex: 1 }} />
              <Button variant="ghost" title="Sign up" onPress={() => router.push('/register')} style={{ flex: 1 }} />
            </View>
          )}
        </View>

        <Text style={styles.footer}>UCT INF4001N Entrance Exam 2027 · Built with Expo, Express & MongoDB Atlas</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, backgroundColor: COLORS.skyBlue, alignItems: 'center' },
  wrapper: { width: '100%', padding: 20, paddingTop: 48 },
  wrapperDesktop: { maxWidth: 720, paddingTop: 36 },
  header: { alignItems: 'center', marginBottom: 24, gap: 6 },
  logo: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: COLORS.mossGreen },
  title: { fontWeight: '900', color: COLORS.charcoal, letterSpacing: 3 },
  tagline: { fontSize: 15, color: COLORS.mossGreen, fontWeight: '700', textAlign: 'center' },
  infoBox: { backgroundColor: COLORS.white, padding: 20, borderRadius: 14, marginBottom: 24, borderLeftWidth: 6, borderLeftColor: COLORS.yellowGreen },
  infoTitle: { fontSize: 20, fontWeight: '900', color: COLORS.charcoal, marginBottom: 8 },
  infoText: { fontSize: 15, color: '#3D4237', lineHeight: 22 },
  buttons: { gap: 12 },
  authRow: { flexDirection: 'row', gap: 12 },
  footer: { textAlign: 'center', marginTop: 32, marginBottom: 16, color: COLORS.mossGreen, fontSize: 12, fontWeight: '700' },
});
