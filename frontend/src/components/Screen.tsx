import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

// Shared page chrome: title bar with back + account chip, centred content with a max width.
export function Screen({
  title,
  children,
  back = true,
  scroll = true,
  maxWidth = 960,
  right,
}: {
  title: string;
  children: React.ReactNode;
  back?: boolean;
  scroll?: boolean;
  maxWidth?: number;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const body = <View style={[styles.content, { maxWidth }]}>{children}</View>;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: `${title} · SA-NQOBA` }} />
      <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.barSide}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/menu'))}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>←</Text>
            </Pressable>
          ) : null}
          {width >= 480 ? (
            <Pressable onPress={() => router.replace('/menu')} accessibilityRole="link" accessibilityLabel="Main menu">
              <Text style={styles.brand}>SA-NQOBA</Text>
            </Pressable>
          ) : null}
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.barSide}>
          {right}
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(user ? '/stats' : '/login')}
            style={styles.userChip}
          >
            <Text style={styles.userText} numberOfLines={1}>{user ? user.username : 'Log in'}</Text>
          </Pressable>
        </View>
      </View>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, { flex: 1 }]}>{body}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  bar: {
    backgroundColor: COLORS.deep,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  barSide: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.raised, alignItems: 'center', justifyContent: 'center' },
  backText: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  brand: { color: COLORS.lime, fontWeight: '900', letterSpacing: 2, fontSize: 15 },
  title: { color: COLORS.text, fontWeight: '700', fontSize: 15, flexShrink: 1 },
  userChip: { backgroundColor: COLORS.raised, borderWidth: 1, borderColor: COLORS.lineStrong, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, maxWidth: 160 },
  userText: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  scroll: { padding: 16, alignItems: 'center' },
  content: { width: '100%', gap: 16 },
});
