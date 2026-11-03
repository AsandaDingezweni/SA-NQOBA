import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Banner, Button, Card, Chip, Field, SectionTitle } from '@/components/ui';
import { Flag } from '@/components/Flag';
import { COLORS, PROFILE_LABELS, RADIUS } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Country } from '@/lib/types';

const REGIONS = ['All', 'Africa', 'Asia', 'Europe', 'Americas', 'Oceania'];
const BANDS = [
  { label: 'Any army', min: 1, max: 9 },
  { label: 'Small (1-3)', min: 1, max: 3 },
  { label: 'Medium (4-6)', min: 4, max: 6 },
  { label: 'Large (7-9)', min: 7, max: 9 },
];
const SORTS = [
  { key: 'name', label: 'A-Z' },
  { key: 'soldiers', label: 'Strongest' },
  { key: 'population', label: 'Population' },
];
const PROFILES = ['mixed', 'aggressive', 'balanced', 'defensive'] as const;
const PROFILE_HELP: Record<string, string> = {
  mixed: 'Each rival gets a random personality.',
  aggressive: 'Rivals attack at 45%+ odds and press hard.',
  balanced: 'Rivals strike at 60%+ odds and keep reserves.',
  defensive: 'Rivals only attack at 75%+ odds and fortify.',
};

export default function NewGameScreen() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('All');
  const [band, setBand] = useState(0);
  const [sort, setSort] = useState('name');
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [selected, setSelected] = useState<Country | null>(null);
  const [profile, setProfile] = useState<(typeof PROFILES)[number]>('mixed');
  const [aiOn, setAiOn] = useState(true);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.health().then((h) => setAiAvailable(h.ai.enabled)).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .countries({ search, region: region === 'All' ? undefined : region, minSoldiers: BANDS[band].min, maxSoldiers: BANDS[band].max, sort })
        .then((r) => {
          setCountries(r.countries);
          setSelected((s) => s ?? r.countries.find((c) => c.code === 'ZAF') ?? null);
        })
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, region, band, sort]);

  if (ready && !user) return <Redirect href="/login?next=/new-game" />;

  const start = async () => {
    if (!selected) return;
    setStarting(true);
    setError(null);
    try {
      const { game } = await api.createGame(selected.code, profile, aiOn && aiAvailable);
      router.replace(`/game/${game.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the game');
      setStarting(false);
    }
  };

  const columns = width < 560 ? 2 : width < 900 ? 3 : 4;

  return (
    <Screen title="New campaign" maxWidth={1100}>
      {error ? <Banner message={error} onClose={() => setError(null)} /> : null}

      <Card style={{ gap: 12 }}>
        <SectionTitle>1 · Choose your nation</SectionTitle>
        <Field label="Search countries" placeholder="e.g. South Africa" value={search} onChangeText={setSearch} autoCorrect={false} />
        <View style={styles.chips}>{REGIONS.map((r) => <Chip key={r} label={r} active={region === r} onPress={() => setRegion(r)} />)}</View>
        <View style={styles.chips}>{BANDS.map((b, i) => <Chip key={b.label} label={b.label} active={band === i} onPress={() => setBand(i)} />)}</View>
        <View style={styles.chips}>
          <Text style={styles.sortLabel}>Sort:</Text>
          {SORTS.map((s) => <Chip key={s.key} label={s.label} active={sort === s.key} onPress={() => setSort(s.key)} />)}
        </View>

        {countries === null ? (
          <ActivityIndicator color={COLORS.mossGreen} />
        ) : countries.length === 0 ? (
          <Text style={styles.empty}>No countries match those filters.</Text>
        ) : (
          <>
            <Text style={styles.count}>{countries.length} countries · soldiers come from population (Worldometers 2025)</Text>
            <View style={styles.grid}>
              {countries.map((c) => {
                const active = selected?.code === c.code;
                return (
                  <View key={c.code} style={{ width: `${100 / columns}%`, padding: 4 }}>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={`${c.name}, ${c.soldiers} soldiers`}
                      onPress={() => setSelected(c)}
                      style={[styles.country, active && styles.countryActive]}
                    >
                      <Flag iso2={c.iso2} size={18} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.countryName, active && { color: COLORS.white }]} numberOfLines={1}>{c.name}</Text>
                        <Text style={[styles.countryMeta, active && { color: COLORS.yellowGreen }]}>
                          {c.soldiers} ⚔ · {formatPop(c.population)}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle>2 · Rival personalities</SectionTitle>
        <View style={styles.chips}>
          {PROFILES.map((p) => (
            <Chip key={p} label={`${PROFILE_LABELS[p].icon} ${PROFILE_LABELS[p].label}`} active={profile === p} onPress={() => setProfile(p)} />
          ))}
        </View>
        <Text style={styles.help}>{PROFILE_HELP[profile]} Every NPC explains each decision in the war room log.</Text>
        <View style={styles.aiRow}>
          <Switch value={aiOn && aiAvailable} onValueChange={setAiOn} disabled={!aiAvailable} trackColor={{ true: COLORS.oliveGreen }} accessibilityLabel="AI strategist" />
          <Text style={[styles.help, { flex: 1 }]}>
            🧠 AI strategist: an LLM on Groq chooses each rival's attack from the engine's legal options and explains it in character.
            {aiAvailable ? '' : ' (Unavailable: the server has no Groq API key, so rivals use the built-in strategy.)'}
          </Text>
        </View>
      </Card>

      <Card style={styles.summary}>
        {selected ? (
          <>
            <Flag iso2={selected.iso2} size={40} />
            <View style={{ flex: 1, minWidth: 180 }}>
              <Text style={styles.summaryTitle}>{selected.name}</Text>
              <Text style={styles.help}>
                Starts with {selected.soldiers} soldier{selected.soldiers === 1 ? '' : 's'} ({formatPop(selected.population)} people). Nine rivals will be drawn at random.
              </Text>
            </View>
            <Button title="⚔️ Start campaign" onPress={start} loading={starting} />
          </>
        ) : (
          <Text style={styles.help}>Pick a nation to lead.</Text>
        )}
      </Card>
    </Screen>
  );
}

function formatPop(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  sortLabel: { fontWeight: '700', color: COLORS.muted },
  empty: { color: COLORS.muted, textAlign: 'center', padding: 20 },
  count: { color: COLORS.muted, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -4 },
  country: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.paper, borderWidth: 1.5, borderColor: COLORS.line },
  countryActive: { backgroundColor: COLORS.mossGreen, borderColor: COLORS.mossGreen },
  countryName: { fontWeight: '800', color: COLORS.ink, fontSize: 13 },
  countryMeta: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  help: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderColor: COLORS.mossGreen, borderWidth: 2 },
  summaryTitle: { fontSize: 20, fontWeight: '900', color: COLORS.ink },
});
