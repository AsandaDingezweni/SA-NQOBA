import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, playerTone, PROFILE_LABELS, RADIUS } from '@/constants/theme';
import type { CountryState, Player } from '@/lib/types';

// Turn order with each player's holdings, so everyone can size up the next target at a glance.
export function PlayerBoard({ order, players, countries, currentPid }: { order: string[]; players: Record<string, Player>; countries: CountryState[]; currentPid?: string }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>TURN ORDER & STANDINGS</Text>
      {order.map((pid) => {
        const p = players[pid];
        const held = countries.filter((c) => c.owner === pid);
        const soldiers = held.reduce((s, c) => s + c.soldiers, 0);
        const active = pid === currentPid;
        return (
          <View key={pid} style={[styles.row, active && styles.active, p.eliminated && { opacity: 0.4 }]}>
            <Text style={styles.turn}>{active ? '▶' : ''}</Text>
            <View style={[styles.dot, { backgroundColor: playerTone(p.color).fill }]} />
            <Text style={[styles.name, p.eliminated && styles.out]} numberOfLines={1}>
              {p.kind === 'human' ? `★ ${p.name}` : p.name}
            </Text>
            {p.profile ? <Text style={styles.profile}>{PROFILE_LABELS[p.profile]?.icon}</Text> : null}
            <Text style={styles.stat}>{p.eliminated ? 'out' : `${held.length} 🏳 · ${soldiers} ⚔`}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: COLORS.panel, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.line, gap: 4 },
  title: { color: COLORS.textMuted, fontWeight: '900', letterSpacing: 1.5, fontSize: 12, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 6, borderRadius: RADIUS.sm },
  active: { backgroundColor: COLORS.raised },
  turn: { width: 12, color: COLORS.lime, fontWeight: '900' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, color: COLORS.text, fontWeight: '700', fontSize: 13 },
  out: { textDecorationLine: 'line-through' },
  profile: { fontSize: 12 },
  stat: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
});
