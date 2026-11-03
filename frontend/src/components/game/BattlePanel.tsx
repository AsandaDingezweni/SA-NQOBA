import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS } from '@/constants/theme';
import { Flag } from '@/components/Flag';
import { Die } from './Dice';
import type { CountryState, GameEvent, Player } from '@/lib/types';

const OUTCOME: Record<string, { text: string; color: string }> = {
  conquest: { text: '🏆 CONQUERED', color: COLORS.win },
  attack_failed: { text: '💥 ATTACK REPELLED', color: COLORS.danger },
  attack_stop: { text: '🏳️ ATTACK CALLED OFF', color: COLORS.gold },
  attack_start: { text: '⚔️ ATTACK LAUNCHED', color: COLORS.yellowGreen },
};

// Live view of the most recent battle: who is fighting, the paired dice, the outcome and the commentary.
export function BattlePanel({
  event,
  lastRoll,
  countries,
  players,
}: {
  event: GameEvent | null;
  lastRoll: GameEvent | null;
  countries: Record<string, CountryState>;
  players: Record<string, Player>;
}) {
  if (!event) {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>BATTLE ARENA</Text>
        <Text style={styles.idle}>No battle yet. Pick a target and roll the dice.</Text>
      </View>
    );
  }
  const from = countries[event.data?.from];
  const to = countries[event.data?.to];
  const attacker = players[event.actor ?? ''];
  const defender = players[event.data?.defender ?? event.data?.formerOwner ?? to?.owner];
  const roll = lastRoll && lastRoll.data?.to === event.data?.to ? lastRoll : null;
  const outcome = OUTCOME[event.type];
  const pairs: { attacker: number; defender: number; winner: string }[] = roll?.data?.pairs ?? [];

  return (
    <View style={styles.panel} accessibilityLiveRegion="polite">
      <View style={styles.titleRow}>
        <Text style={styles.title}>BATTLE ARENA</Text>
        {roll ? <Text style={styles.rollNo}>Roll #{roll.data?.roll} · {pairs.length} {pairs.length === 1 ? 'die' : 'dice'} each</Text> : null}
      </View>

      <View style={styles.versus}>
        <Side country={from} player={attacker} soldiers={roll?.data?.attackerSoldiers ?? from?.soldiers} align="left" />
        <Text style={styles.vs}>VS</Text>
        <Side country={to} player={defender} soldiers={roll?.data?.defenderSoldiers ?? to?.soldiers} align="right" />
      </View>

      {pairs.length ? (
        <View style={styles.diceGrid}>
          {pairs.map((p, i) => (
            <View key={i} style={styles.pair}>
              <Die value={p.attacker} tone="attacker" size={40} rollKey={`${roll!.seq}-${i}`} result={p.winner === 'attacker' ? 'win' : p.winner === 'tie' ? 'tie' : 'lose'} />
              <Die value={p.defender} tone="defender" size={40} rollKey={`${roll!.seq}-${i}d`} result={p.winner === 'defender' ? 'win' : p.winner === 'tie' ? 'tie' : 'lose'} />
            </View>
          ))}
        </View>
      ) : null}

      {roll ? (
        <Text style={styles.losses}>
          {from?.name} −{roll.data?.attackerLosses} · {to?.name} −{roll.data?.defenderLosses}
        </Text>
      ) : null}

      {outcome && event.type !== 'roll' ? <Text style={[styles.outcome, { color: outcome.color }]}>{outcome.text}</Text> : null}

      {roll?.commentary ? (
        <View style={styles.commentary}>
          <Text style={styles.commentaryText}>🎙️ “{roll.commentary}”</Text>
          <Text style={styles.source}>{roll.commentarySource === 'ai' ? 'Live AI commentary · Groq' : 'Studio commentator (offline mode)'}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Side({ country, player, soldiers, align }: { country?: CountryState; player?: Player; soldiers?: number; align: 'left' | 'right' }) {
  return (
    <View style={[styles.side, align === 'right' && { alignItems: 'flex-end' }]}>
      <Flag iso2={country?.iso2} size={26} />
      <Text style={styles.sideName} numberOfLines={1}>{country?.name ?? '—'}</Text>
      <Text style={[styles.sideOwner, { color: player?.color === COLORS.mossGreen ? COLORS.yellowGreen : COLORS.boardMuted }]} numberOfLines={1}>{player?.name}</Text>
      <Text style={styles.sideSoldiers}>{soldiers ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: COLORS.boardPanel, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.boardLine, gap: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: COLORS.yellowGreen, fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  rollNo: { color: COLORS.boardMuted, fontSize: 12, fontWeight: '700' },
  idle: { color: COLORS.boardMuted, fontSize: 14 },
  versus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vs: { color: COLORS.gold, fontWeight: '900', fontSize: 18 },
  side: { flex: 1, gap: 3 },
  sideName: { color: COLORS.boardText, fontWeight: '800', fontSize: 15 },
  sideOwner: { fontSize: 12, fontWeight: '700' },
  sideSoldiers: { color: COLORS.white, fontWeight: '900', fontSize: 28 },
  diceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  pair: { gap: 8, alignItems: 'center' },
  losses: { color: COLORS.boardText, textAlign: 'center', fontWeight: '700' },
  outcome: { textAlign: 'center', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  commentary: { backgroundColor: COLORS.boardRaised, borderRadius: RADIUS.md, padding: 12, borderLeftWidth: 4, borderLeftColor: COLORS.yellowGreen, gap: 4 },
  commentaryText: { color: COLORS.boardText, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  source: { color: COLORS.boardMuted, fontSize: 11 },
});
