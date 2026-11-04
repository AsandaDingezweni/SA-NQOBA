import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Banner, Button, Card, Field } from '@/components/ui';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';

// Mirrors the server's rules so mistakes show instantly; the server still re-validates everything.
function validate(username: string, password: string, confirm: string | null) {
  const errors: Record<string, string> = {};
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username.trim())) errors.username = '3-20 letters, numbers or _';
  if (password.length < 8 || password.length > 72) errors.password = 'At least 8 characters';
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.password = 'Use at least one letter and one number';
  if (confirm !== null && confirm !== password) errors.confirm = 'Passwords do not match';
  return errors;
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isRegister = mode === 'register';
  const destination = (next?.startsWith('/') ? next : '/menu') as Href;

  const submit = async () => {
    const found = isRegister ? validate(username, password, confirm) : {};
    if (!isRegister && (!username.trim() || !password)) found.username = 'Enter your username and password';
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;
    setLoading(true);
    try {
      await (isRegister ? auth.register : auth.login)(username.trim(), password);
      router.replace(destination);
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(e.details);
      setServerError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title={isRegister ? 'Sign up' : 'Log in'} maxWidth={460}>
      <Card style={{ gap: 14 }}>
        <Text style={styles.heading}>{isRegister ? 'Enlist as a commander' : 'Welcome back, commander'}</Text>
        <Text style={styles.sub}>
          {isRegister ? 'Create an account to start and play your own campaigns.' : 'Log in to play your turns. Anyone can watch a shared game without logging in.'}
        </Text>
        {serverError ? <Banner message={serverError} onClose={() => setServerError(null)} /> : null}
        <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" error={errors.username} onSubmitEditing={submit} />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={isRegister ? 'new-password' : 'current-password'} error={errors.password} onSubmitEditing={submit} />
        {isRegister ? <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry error={errors.confirm} onSubmitEditing={submit} /> : null}
        <Button title={isRegister ? 'Create account' : 'Log in'} onPress={submit} loading={loading} />
        <View style={styles.switch}>
          <Text style={styles.sub}>{isRegister ? 'Already enlisted?' : 'New here?'}</Text>
          <Link href={{ pathname: isRegister ? '/login' : '/register', params: next ? { next } : {} }} replace style={styles.link}>
            {isRegister ? 'Log in' : 'Create an account'}
          </Link>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  sub: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  switch: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center' },
  link: { color: COLORS.lime, fontWeight: '800', textDecorationLine: 'underline' },
});
