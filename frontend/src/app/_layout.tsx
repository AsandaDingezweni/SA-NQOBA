import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, title: 'SA-NQOBA', contentStyle: { backgroundColor: COLORS.surface } }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
