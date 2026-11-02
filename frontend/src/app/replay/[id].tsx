import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Banner, Button, Chip } from '@/components/ui';
import { CountryCard } from '@/components/game/CountryCard';
import { BattlePanel } from '@/components/game/BattlePanel';
import { COLORS, RADIUS } from '@/constants/theme';
import { api } from '@/lib/api';
import type { EventType, GameEvent, GameView, Player } from '@/lib/types';

const BATTLE_STARTS: EventType[] = ['attack_start'];
const BATTLE_EVENTS: EventType[] = ['attack_start', 'roll', 'conquest', 'attack_failed', 'attack_stop'];
const SPEEDS = [{ label: '1×', ms: 1200 }, { label: '2×', ms: 600 }, { label: '4×', ms: 250 }];

// Rebuilds the board at any point in history by applying event patches from the start.
export default function ReplayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [game, setGame] = useState<GameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    api.game(id).then((r) => setGame(r.game)).catch((e) => setError(e.message));
  }, [id]);

  const events = game?.events ?? [];
  const last = Math.max(0, events.length - 1);

  useEffect(() => {
    if (!playing) return;
    if (step >= last) return setPlaying(false);
    const timer = setTimeout(() => setStep((s) => Math.min(last, s + 1)), SPEEDS[speed].ms);
    return () => clearTimeout(timer);
  }, [playing, step, last, speed]);

  const frame = useMemo(() => {
    if (!game) return null;
    const board: Record<string, { owner: string; soldiers: number }> = {};
    for (const e of events.slice(0, step + 1)) for (const p of e.patch) board[p.code] = { owner: p.owner, soldiers: p.soldiers };
    const countries = game.countries.map((c) => ({ ...c, ...(board[c.code] ?? {}) }));
    const seen = events.slice(0, step + 1);
    const spotlight = [...seen].reverse().find((e) => BATTLE_EVENTS.includes(e.type)) ?? null;
    const lastRoll = [...seen].reverse().find((e) => e.type === 'roll') ?? null;
    return { countries, countryMap: Object.fromEntries(countries.map((c) => [c.code, c])), spotlight, lastRoll };
  }, [game, events, step]);

  if (error) return <Screen title="Replay"><Banner message={error} /></Screen>;
  if (!game || !frame) {
    return (
      <Screen title="Replay" dark>
        <ActivityIndicator color={COLORS.yellowGreen} size="large" />
      </Screen>
    );
  }

  const players: Record<string, Player> = Object.fromEntries(game.players.map((p) => [p.pid, p]));
  const current: GameEvent | undefined = events[step];
  const jump = (dir: 1 | -1) => {
    for (let i = step + dir; i >= 0 && i <= last; i += dir) {
      if (BATTLE_STARTS.includes(events[i].type)) return setStep(i);
    }
    setStep(dir === 1 ? last : 0);
  };
  const columns = width < 520 ? 2 : width < 900 ? 3 : 5;

  return (
    <Screen title="Replay" dark maxWidth={1300}>
      <View style={styles.controls}>
        <Text style={styles.position}>
          Event {step + 1} / {events.length} · Round {current?.round}
        </Text>
        <View style={styles.row}>
          <Button small variant="ghostDark" title="⏮" onPress={() => setStep(0)} accessibilityHint="Go to start" />
          <Button small variant="ghostDark" title="◀ Battle" onPress={() => jump(-1)} />
          <Button small variant="ghostDark" title="◀" onPress={() => setStep((s) => Math.max(0, s - 1))} />
          <Button small variant="accent" title={playing ? '⏸ Pause' : '▶ Play'} onPress={() => setPlaying((p) => !p)} />
          <Button small variant="ghostDark" title="▶" onPress={() => setStep((s) => Math.min(last, s + 1))} />
          <Button small variant="ghostDark" title="Battle ▶" onPress={() => jump(1)} />
          <Button small variant="ghostDark" title="⏭" onPress={() => setStep(last)} />
          {SPEEDS.map((s, i) => <Chip key={s.label} dark label={s.label} active={speed === i} onPress={() => setSpeed(i)} />)}
        </View>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${events.length ? ((step + 1) / events.length) * 100 : 0}%` }]} />
        </View>
        {current ? (
          <View style={[styles.now, { borderLeftColor: players[current.actor ?? '']?.color ?? COLORS.boardLine }]}>
            <Text style={styles.nowText}>{current.message}</Text>
            {current.reason ? <Text style={styles.reason}>💭 {current.reason}</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.layout, width >= 1000 && { flexDirection: 'row' }]}>
        <View style={[styles.grid, width >= 1000 && { flex: 1.4 }]}>
          {frame.countries.map((c) => (
            <View key={c.code} style={{ width: `${100 / (width >= 1000 ? 3 : columns)}%`, padding: 5 }}>
              <CountryCard country={c} owner={players[c.owner]} role={frame.spotlight?.data?.to === c.code && current && BATTLE_EVENTS.includes(current.type) ? 'battle-defender' : frame.spotlight?.data?.from === c.code && current && BATTLE_EVENTS.includes(current.type) ? 'battle-attacker' : null} />
            </View>
          ))}
        </View>
        <View style={width >= 1000 ? { flex: 1 } : undefined}>
          <BattlePanel event={frame.spotlight} lastRoll={frame.lastRoll} countries={frame.countryMap} players={players} />
        </View>
      </View>
      <Button variant="ghostDark" title="Open the live game" onPress={() => router.push(`/game/${game.id}`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { backgroundColor: COLORS.boardPanel, borderRadius: RADIUS.lg, padding: 14, gap: 10, borderWidth: 1, borderColor: COLORS.boardLine },
  position: { color: COLORS.yellowGreen, fontWeight: '900', letterSpacing: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  track: { height: 6, backgroundColor: COLORS.boardRaised, borderRadius: 3, overflow: 'hidden' },
  trackFill: { height: 6, backgroundColor: COLORS.yellowGreen },
  now: { borderLeftWidth: 4, paddingLeft: 10, gap: 4 },
  nowText: { color: COLORS.boardText, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  reason: { color: '#C9CDB8', fontStyle: 'italic', fontSize: 13 },
  layout: { gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -5 },
});
