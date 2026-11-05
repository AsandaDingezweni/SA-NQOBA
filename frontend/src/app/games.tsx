import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Banner, Button, Card, Chip, Field } from '@/components/ui';
import { Flag } from '@/components/Flag';
import { COLORS, RADIUS } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { GameSummary } from '@/lib/types';

const STATUSES = [
  { key: '', label: 'All' },
  { key: 'active', label: 'In progress' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];
const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  active: { label: 'LIVE', color: COLORS.sky },
  won: { label: 'WON', color: COLORS.win },
  lost: { label: 'LOST', color: COLORS.danger },
};

export default function GamesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<'mine' | 'public'>(user ? 'mine' : 'public');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<GameSummary[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (p: number) => {
      const query = { status: status || undefined, search: search || undefined, page: p };
      const r = tab === 'mine' ? await api.myGames(query) : await api.publicGames(query);
      setItems((prev) => (p === 1 ? r.items : [...(prev ?? []), ...r.items]));
      setPage(r.page);
      setPages(r.pages);
      setTotal(r.total);
    },
    [tab, status, search],
  );

  useEffect(() => {
    setItems(null);
    const timer = setTimeout(() => fetchPage(1).catch((e) => setError(e.message)), 250);
    return () => clearTimeout(timer);
  }, [fetchPage]);

  return (
    <Screen title="Campaigns">
      <View style={styles.tabs}>
        <Chip label="My campaigns" active={tab === 'mine'} onPress={() => (user ? setTab('mine') : router.push('/login?next=/games'))} />
        <Chip label="Everyone's games" active={tab === 'public'} onPress={() => setTab('public')} />
        <Button small title="+ New campaign" onPress={() => router.push(user ? '/new-game' : '/login?next=/new-game')} style={{ marginLeft: 'auto' }} />
      </View>
      {error ? <Banner message={error} onClose={() => setError(null)} /> : null}

      <Card style={{ gap: 10 }}>
        <Field label={tab === 'mine' ? 'Search by country' : 'Search by commander or country'} value={search} onChangeText={setSearch} placeholder="Search…" autoCorrect={false} />
        <View style={styles.tabs}>{STATUSES.map((s) => <Chip key={s.key} label={s.label} active={status === s.key} onPress={() => setStatus(s.key)} />)}</View>
        <Text style={styles.count}>{items ? `${total} game${total === 1 ? '' : 's'}` : ' '}</Text>
      </Card>

      {items === null ? <ActivityIndicator color={COLORS.lime} /> : null}
      {items?.length === 0 ? (
        <Card>
          <Text style={styles.empty}>{tab === 'mine' ? 'No campaigns yet. Start one and conquer the world!' : 'No games match.'}</Text>
        </Card>
      ) : null}

      <View style={styles.list}>
        {items?.map((g) => {
          const st = STATUS_STYLE[g.status];
          return (
            <Pressable key={g.id} accessibilityRole="link" onPress={() => router.push(`/game/${g.id}`)} style={({ hovered }: any) => [styles.item, hovered && { borderColor: COLORS.lineStrong }]}>
              <Flag iso2={g.startCountry.iso2} size={30} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {g.ownerName} · {g.startCountry.name}
                </Text>
                <Text style={styles.itemMeta}>
                  Round {g.round} · holds {g.countriesHeld}/10 · {g.playersAlive} players alive
                  {g.status === 'active' && g.currentPlayer ? ` · ${g.currentPlayer} to play` : ''}
                </Text>
                <Text style={styles.itemMeta}>Updated {new Date(g.updatedAt).toLocaleString()}</Text>
              </View>
              <View style={{ gap: 6, alignItems: 'flex-end' }}>
                <Text style={[styles.badge, { backgroundColor: st.color }]}>{st.label}</Text>
                <Pressable onPress={() => router.push(`/replay/${g.id}`)} accessibilityRole="link">
                  <Text style={styles.replay}>Replay ▸</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </View>
      {items && page < pages ? <Button variant="ghost" title="Load more" onPress={() => fetchPage(page + 1).catch((e) => setError(e.message))} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  count: { color: COLORS.textMuted, fontSize: 12 },
  empty: { color: COLORS.textMuted, textAlign: 'center' },
  list: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.panel, padding: 14, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.line },
  itemTitle: { fontWeight: '900', color: COLORS.text, fontSize: 15 },
  itemMeta: { color: COLORS.textMuted, fontSize: 12 },
  badge: { color: COLORS.onColor, fontWeight: '900', fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', letterSpacing: 1 },
  replay: { color: COLORS.lime, fontWeight: '800', fontSize: 12 },
});
