import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Banner, Button, Card, SectionTitle, StatTile } from '@/components/ui';
import { Flag } from '@/components/Flag';
import { COLORS, PROFILE_LABELS } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Bars({ rows, valueKey, labelKey = 'name', suffix = '' }: { rows: any[]; valueKey: string; labelKey?: string; suffix?: string }) {
  if (!rows?.length) return <Text style={styles.empty}>No data yet. Play a few games!</Text>;
  const max = Math.max(...rows.map((r) => r[valueKey]), 1);
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <View key={i} style={styles.barRow}>
          {r.iso2 ? <Flag iso2={r.iso2} size={16} /> : null}
          <Text style={styles.barLabel} numberOfLines={1}>{r[labelKey]}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(r[valueKey] / max) * 100}%` }]} />
          </View>
          <Text style={styles.barValue}>{r[valueKey]}{suffix}</Text>
        </View>
      ))}
    </View>
  );
}

export default function StatsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mine, setMine] = useState<any>(null);
  const [platform, setPlatform] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.platformStats().then(setPlatform).catch((e) => setError(e.message));
    if (user) api.myStats().then(setMine).catch((e) => setError(e.message));
  }, [user]);

  return (
    <Screen title="Statistics">
      {error ? <Banner message={error} onClose={() => setError(null)} /> : null}

      {user ? (
        <Card style={{ gap: 14 }}>
          <View style={styles.headRow}>
            <SectionTitle>Your record · {user.username}</SectionTitle>
            <Button small variant="ghost" title="Log out" onPress={logout} />
          </View>
          {!mine ? (
            <ActivityIndicator color={COLORS.lime} />
          ) : (
            <>
              <View style={styles.tiles}>
                <StatTile label="Campaigns" value={mine.summary.games} hint={`${mine.summary.active} in progress`} />
                <StatTile label="Wins" value={mine.summary.won} hint={`${mine.summary.lost} losses`} />
                <StatTile label="Win rate" value={pct(mine.summary.winRate)} hint="of finished games" />
                <StatTile label="Fastest win" value={mine.summary.fastestWin ? `R${mine.summary.fastestWin}` : '—'} hint="rounds" />
              </View>
              <View style={styles.tiles}>
                <StatTile label="Attacks" value={mine.combat.attacks} />
                <StatTile label="Conquests" value={mine.combat.conquests} hint={mine.combat.attacks ? `${pct(mine.combat.conquests / mine.combat.attacks)} success` : undefined} />
                <StatTile label="Enemies defeated" value={mine.combat.soldiersKilled} />
                <StatTile label="Soldiers lost" value={mine.combat.soldiersLost} />
                <StatTile label="Dice rolls" value={mine.combat.rolls} />
              </View>
              <View style={styles.columns}>
                <View style={styles.column}>
                  <Text style={styles.subhead}>Favourite starting nations</Text>
                  <Bars rows={mine.startCountries} valueKey="games" />
                </View>
                <View style={styles.column}>
                  <Text style={styles.subhead}>Most conquered</Text>
                  <Bars rows={mine.conquered} valueKey="count" />
                </View>
                <View style={styles.column}>
                  <Text style={styles.subhead}>Nemeses (took your land)</Text>
                  <Bars rows={mine.nemeses} valueKey="count" />
                </View>
              </View>
            </>
          )}
        </Card>
      ) : (
        <Card style={{ gap: 10 }}>
          <SectionTitle>Your record</SectionTitle>
          <Text style={styles.empty}>Log in to see your personal analytics.</Text>
          <Button title="Log in" onPress={() => router.push('/login?next=/stats')} />
        </Card>
      )}

      <Card style={{ gap: 14 }}>
        <SectionTitle>Platform-wide</SectionTitle>
        {!platform ? (
          <ActivityIndicator color={COLORS.lime} />
        ) : (
          <>
            <View style={styles.tiles}>
              <StatTile label="Commanders" value={platform.summary.players} />
              <StatTile label="Campaigns" value={platform.summary.games} hint={`${platform.summary.active} live now`} />
              <StatTile label="Human win rate" value={pct(platform.summary.humanWinRate)} />
              <StatTile label="Battles fought" value={platform.summary.battles} hint={`${platform.summary.diceRolls} dice rolls`} />
              <StatTile label="Avg rounds to win" value={platform.summary.avgRoundsToWin ? platform.summary.avgRoundsToWin.toFixed(1) : '—'} />
            </View>
            <View style={styles.columns}>
              <View style={styles.column}>
                <Text style={styles.subhead}>Most popular starting nations</Text>
                <Bars rows={platform.popularCountries} valueKey="games" />
              </View>
              <View style={styles.column}>
                <Text style={styles.subhead}>Deadliest NPC personalities</Text>
                <Bars
                  rows={platform.npcProfiles.map((p: any) => ({ ...p, name: `${PROFILE_LABELS[p.profile]?.icon ?? ''} ${PROFILE_LABELS[p.profile]?.label ?? p.profile}` }))}
                  valueKey="victories"
                  suffix=" wins"
                />
              </View>
            </View>
            <Text style={styles.subhead}>Leaderboard</Text>
            {platform.leaderboard.length === 0 ? <Text style={styles.empty}>No champions yet.</Text> : null}
            {platform.leaderboard.map((r: any, i: number) => (
              <View key={r.name + i} style={styles.leader}>
                <Text style={[styles.rank, i < 3 && styles.rankTop]}>#{i + 1}</Text>
                <Text style={styles.leaderName}>{r.name}</Text>
                <Text style={styles.leaderStat}>{r.wins} wins / {r.games} games · {pct(r.winRate)}</Text>
              </View>
            ))}
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  column: { flexGrow: 1, flexBasis: 240, gap: 8 },
  subhead: { fontWeight: '800', color: COLORS.text, fontSize: 14 },
  empty: { color: COLORS.textMuted },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 110, fontSize: 12, fontWeight: '700', color: COLORS.text },
  barTrack: { flex: 1, height: 10, backgroundColor: COLORS.raised, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, backgroundColor: COLORS.sky, borderRadius: 5 },
  barValue: { minWidth: 30, textAlign: 'right', fontSize: 12, fontWeight: '800', color: COLORS.text },
  leader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  rank: { width: 34, fontSize: 16, fontWeight: '900', color: COLORS.textMuted },
  rankTop: { color: COLORS.gold },
  leaderName: { flex: 1, fontWeight: '800', color: COLORS.text },
  leaderStat: { color: COLORS.textMuted, fontSize: 12 },
});
