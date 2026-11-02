import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS } from '@/constants/theme';
import { Chip } from '@/components/ui';
import type { EventType, GameEvent, Player } from '@/lib/types';

const BATTLE_TYPES: EventType[] = ['attack_start', 'roll', 'conquest', 'attack_failed', 'attack_stop', 'elimination', 'victory', 'defeat'];
const FILTERS = {
  all: { label: 'All', test: () => true },
  battles: { label: 'Battles', test: (e: GameEvent) => BATTLE_TYPES.includes(e.type) },
  npc: { label: 'NPC decisions', test: (e: GameEvent) => Boolean(e.reason) },
  mine: { label: 'My moves', test: (e: GameEvent) => e.actor === 'human' },
} as const;

const SHOWN = 120;

export function EventFeed({ events, players, maxHeight }: { events: GameEvent[]; players: Record<string, Player>; maxHeight?: number }) {
  const [filter, setFilter] = useState<keyof typeof FILTERS>('all');
  const rows = useMemo(() => events.filter(FILTERS[filter].test).slice(-SHOWN).reverse(), [events, filter]);

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>WAR ROOM LOG</Text>
      <View style={styles.filters}>
        {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((key) => (
          <Chip key={key} dark label={FILTERS[key].label} active={filter === key} onPress={() => setFilter(key)} />
        ))}
      </View>
      <View style={{ maxHeight, overflow: 'hidden' }}>
        {rows.length === 0 ? <Text style={styles.empty}>Nothing here yet.</Text> : null}
        {rows.map((e) => {
          const actor = e.actor ? players[e.actor] : undefined;
          return (
            <View key={e.seq} style={[styles.row, { borderLeftColor: actor?.color ?? COLORS.boardLine }]}>
              <Text style={styles.meta}>R{e.round} · #{e.seq}</Text>
              <Text style={[styles.message, e.type === 'conquest' && styles.conquest, (e.type === 'victory' || e.type === 'defeat') && styles.final]}>{e.message}</Text>
              {e.reason ? <Text style={styles.reason}>💭 {e.reason}</Text> : null}
              {e.commentary ? <Text style={styles.commentary}>🎙️ {e.commentary}</Text> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: COLORS.boardPanel, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.boardLine, gap: 10 },
  title: { color: COLORS.yellowGreen, fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  empty: { color: COLORS.boardMuted },
  row: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 6, marginBottom: 4, gap: 3 },
  meta: { color: COLORS.boardMuted, fontSize: 10, fontWeight: '700' },
  message: { color: COLORS.boardText, fontSize: 13, lineHeight: 18 },
  conquest: { color: COLORS.win, fontWeight: '800' },
  final: { color: COLORS.gold, fontWeight: '900' },
  reason: { color: '#C9CDB8', fontSize: 12, fontStyle: 'italic', lineHeight: 17 },
  commentary: { color: COLORS.yellowGreen, fontSize: 12, lineHeight: 17 },
});
