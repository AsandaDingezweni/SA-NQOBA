import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Banner, Button, Chip, Stepper } from '@/components/ui';
import { CountryCard, type CardRole } from '@/components/game/CountryCard';
import { BattlePanel } from '@/components/game/BattlePanel';
import { EventFeed } from '@/components/game/EventFeed';
import { PlayerBoard } from '@/components/game/PlayerBoard';
import { COLORS, RADIUS } from '@/constants/theme';
import { useGameSession } from '@/hooks/useGameSession';
import { useAuth } from '@/lib/auth';
import type { CountryState } from '@/lib/types';

type Mode = 'attack' | 'transfer';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const session = useGameSession(id);
  const { game, view, canAct, playing, busy } = session;

  const [mode, setMode] = useState<Mode>('attack');
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [amount, setAmount] = useState(1);
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [occupyN, setOccupyN] = useState(0);
  const [copied, setCopied] = useState(false);

  const phase = game?.phase;
  useEffect(() => {
    setFrom(null);
    setTo(null);
    setAlloc({});
    if (game?.pendingOccupy) setOccupyN(Math.floor(game.pendingOccupy.max / 2));
  }, [phase, game?.eventSeq]);

  const wide = width >= 1100;
  const columns = width < 520 ? 2 : wide ? 3 : width < 820 ? 3 : 5;

  if (session.loadError) {
    return (
      <Screen title="Campaign">
        <Banner message={session.loadError} />
        <Button title="Back to campaigns" onPress={() => router.replace('/games')} />
      </Screen>
    );
  }
  if (!game || !view) {
    return (
      <Screen title="Campaign" dark>
        <ActivityIndicator size="large" color={COLORS.yellowGreen} />
        <Text style={styles.loading}>Loading the battlefield…</Text>
      </Screen>
    );
  }

  const human = view.players.human;
  const remaining = game.pendingReinforcements - Object.values(alloc).reduce((a, b) => a + b, 0);
  const fromC = from ? view.countryMap[from] : null;
  const toC = to ? view.countryMap[to] : null;

  const onCountry = (c: CountryState) => {
    if (!canAct) return;
    const mine = c.owner === 'human';
    if (phase === 'reinforce') {
      if (mine && remaining > 0) setAlloc((a) => ({ ...a, [c.code]: (a[c.code] ?? 0) + 1 }));
      return;
    }
    if (phase !== 'main') return;
    if (mode === 'attack') {
      if (mine) {
        setFrom(c.code === from ? null : c.code);
      } else if (from) {
        setTo(c.code === to ? null : c.code);
      }
    } else if (mine) {
      if (!from || (from && to)) {
        setFrom(c.code);
        setTo(null);
        setAmount(1);
      } else if (c.code !== from) {
        setTo(c.code);
      } else {
        setFrom(null);
      }
    }
  };

  const roleOf = (code: string): CardRole => {
    if (game.battle) return code === game.battle.from ? 'battle-attacker' : code === game.battle.to ? 'battle-defender' : null;
    if (playing && view.spotlight && ['attack_start', 'roll'].includes(view.spotlight.type)) {
      if (code === view.spotlight.data?.from) return 'battle-attacker';
      if (code === view.spotlight.data?.to) return 'battle-defender';
    }
    return code === from ? 'source' : code === to ? 'target' : null;
  };

  const share = async () => {
    const url = Platform.OS === 'web' ? `${window.location.origin}/game/${game.id}` : `${process.env.EXPO_PUBLIC_SITE_URL ?? ''}/game/${game.id}`;
    if (Platform.OS === 'web' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      Share.share({ message: `Watch my SA-NQOBA campaign live: ${url}` });
    }
  };

  const acting = view.players[view.actingPid];
  const turnBanner =
    game.status !== 'active'
      ? null
      : !session.viewerIsOwner
        ? `👀 Spectating ${game.ownerName}'s campaign live${user ? '' : '. Log in to start your own'}.`
        : game.currentPid !== 'human' || playing
          ? `${acting?.name ?? 'NPC'} is playing${session.fastForward ? ' (fast-forward)' : ''}…`
          : PHASE_HINT[game.phase](game, mode);

  const board = (
    <View style={styles.grid}>
      {view.countries.map((c) => (
        <View key={c.code} style={{ width: `${100 / columns}%`, padding: 5 }}>
          <CountryCard
            country={c}
            owner={view.players[c.owner]}
            role={roleOf(c.code)}
            pending={alloc[c.code]}
            onPress={canAct ? () => onCountry(c) : undefined}
          />
        </View>
      ))}
    </View>
  );

  const controls = session.viewerIsOwner && game.status === 'active' && (
    <View style={styles.controls}>
      {phase === 'reinforce' && canAct ? (
        <>
          <Text style={styles.controlTitle}>Deploy reinforcements: {remaining} left</Text>
          <Text style={styles.controlHint}>Tap your countries to add one soldier each.</Text>
          <View style={styles.row}>
            <Button small variant="ghostDark" title="Reset" onPress={() => setAlloc({})} />
            <Button
              small
              variant="ghostDark"
              title="All on strongest"
              onPress={() => {
                const best = view.countries.filter((c) => c.owner === 'human').sort((a, b) => b.soldiers - a.soldiers)[0];
                setAlloc({ [best.code]: game.pendingReinforcements });
              }}
            />
            <Button small variant="accent" title="Deploy" disabled={remaining !== 0} loading={busy} onPress={() => session.command('reinforce', { allocations: alloc })} />
          </View>
        </>
      ) : null}

      {phase === 'main' && canAct ? (
        <>
          <View style={styles.row}>
            <Chip dark label="⚔️ Attack" active={mode === 'attack'} onPress={() => { setMode('attack'); setFrom(null); setTo(null); }} />
            <Chip dark label="🔁 Transfer" active={mode === 'transfer'} onPress={() => { setMode('transfer'); setFrom(null); setTo(null); }} />
          </View>
          {mode === 'attack' ? (
            game.attackUsed ? (
              <Text style={styles.controlHint}>You have used this turn's attack. Transfer soldiers or end your turn.</Text>
            ) : (
              <>
                <Text style={styles.controlHint}>
                  {fromC ? `From ${fromC.name} (${fromC.soldiers}).` : 'Choose one of your countries with 2+ soldiers.'} {toC ? `Target ${toC.name} (${toC.soldiers}).` : fromC ? 'Now choose any enemy country.' : ''}
                </Text>
                {fromC && toC ? (
                  <Text style={styles.controlHint}>Each roll uses {Math.min(fromC.soldiers - 1, toC.soldiers)} dice per side.</Text>
                ) : null}
                <Button
                  variant="danger"
                  title={toC ? `⚔️ Attack ${toC.name}` : 'Select a target'}
                  disabled={!fromC || !toC || fromC.soldiers < 2}
                  loading={busy}
                  onPress={() => session.command('attack', { from, to })}
                />
              </>
            )
          ) : (
            <>
              <Text style={styles.controlHint}>
                {fromC ? `Move from ${fromC.name}` : 'Tap the country to move soldiers from'}
                {toC ? ` to ${toC.name}.` : fromC ? ', then the country to move them to.' : '.'} A country must keep at least 1 soldier.
              </Text>
              {fromC && toC ? (
                <View style={styles.row}>
                  <Stepper dark value={Math.min(amount, fromC.soldiers - 1)} min={1} max={Math.max(1, fromC.soldiers - 1)} onChange={setAmount} />
                  <Button small variant="accent" title="Move" disabled={fromC.soldiers < 2} loading={busy} onPress={() => session.command('transfer', { from, to, soldiers: Math.min(amount, fromC.soldiers - 1) })} />
                </View>
              ) : null}
            </>
          )}
          <Button variant="secondary" title={game.attackUsed ? 'End turn' : 'Skip attack & end turn'} loading={busy} onPress={() => session.command('end-turn')} />
        </>
      ) : null}

      {phase === 'attacking' && canAct && game.battle ? (
        <>
          <Text style={styles.controlTitle}>
            {view.countryMap[game.battle.from].name} {view.countryMap[game.battle.from].soldiers} vs {view.countryMap[game.battle.to].soldiers} {view.countryMap[game.battle.to].name}
          </Text>
          <Text style={styles.controlHint}>Keep rolling until you conquer it, drop to 1 soldier, or stop (stopping ends your turn).</Text>
          <View style={styles.row}>
            <Button variant="accent" title="🎲 Roll dice" loading={busy} onPress={() => session.command('roll')} style={{ flexGrow: 1 }} />
            <Button variant="ghostDark" title="🏳️ Stop attack" disabled={busy} onPress={() => session.command('stop')} />
          </View>
        </>
      ) : null}

      {phase === 'occupy' && canAct && game.pendingOccupy ? (
        <>
          <Text style={styles.controlTitle}>Conquered {view.countryMap[game.pendingOccupy.to].name}!</Text>
          <Text style={styles.controlHint}>How many extra soldiers move in from {view.countryMap[game.pendingOccupy.from].name}?</Text>
          <View style={styles.row}>
            <Stepper dark value={occupyN} min={0} max={game.pendingOccupy.max} onChange={setOccupyN} />
            <Button small variant="accent" title="Move in" loading={busy} onPress={() => session.command('occupy', { soldiers: occupyN })} />
          </View>
        </>
      ) : null}
    </View>
  );

  const side = (
    <View style={{ gap: 14 }}>
      <BattlePanel event={view.spotlight} lastRoll={view.lastRoll} countries={view.countryMap} players={view.players} />
      <PlayerBoard order={game.turnOrder} players={view.players} countries={view.countries} currentPid={view.actingPid} />
    </View>
  );

  return (
    <Screen
      title={`Round ${game.round}`}
      dark
      maxWidth={1400}
      right={
        <Pressable onPress={share} accessibilityRole="button" style={styles.share}>
          <Text style={styles.shareText}>{copied ? '✓ Link copied' : '🔗 Share'}</Text>
        </Pressable>
      }
    >
      {game.status !== 'active' ? (
        <View style={[styles.final, { borderColor: game.status === 'won' ? COLORS.win : COLORS.danger }]}>
          <Text style={styles.finalTitle}>{game.status === 'won' ? '🏆 VICTORY: the world is yours!' : '💀 DEFEAT'}</Text>
          <Text style={styles.finalText}>{session.feed[session.feed.length - 1]?.message}</Text>
          <View style={styles.row}>
            <Button variant="accent" title="▶ Replay this game" onPress={() => router.push(`/replay/${game.id}`)} />
            <Button variant="secondary" title="New campaign" onPress={() => router.push('/new-game')} />
            <Button variant="ghostDark" title="My statistics" onPress={() => router.push('/stats')} />
          </View>
        </View>
      ) : null}

      <View style={styles.topRow}>
        {turnBanner ? <Text style={styles.turnBanner}>{turnBanner}</Text> : null}
        <View style={styles.row}>
          <Chip dark label={session.fastForward ? '⏩ Fast-forward ON' : '⏩ Fast-forward'} active={session.fastForward} onPress={() => session.setFastForward(!session.fastForward)} />
          <Chip dark label="📜 Replay" onPress={() => router.push(`/replay/${game.id}`)} />
          {session.viewerIsOwner && game.status === 'active' ? <Chip dark label="Withdraw" onPress={() => confirmForfeit(() => session.command('forfeit'))} /> : null}
        </View>
      </View>

      {session.error ? <Banner message={session.error} onClose={session.clearError} /> : null}

      {wide ? (
        <View style={styles.columns}>
          <View style={{ flex: 1.45, gap: 14 }}>
            {board}
            {controls}
            <EventFeed events={session.feed} players={view.players} maxHeight={520} />
          </View>
          <View style={{ flex: 1 }}>{side}</View>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {controls}
          {board}
          {side}
          <EventFeed events={session.feed} players={view.players} maxHeight={480} />
        </View>
      )}
      <Text style={styles.footnote}>
        {human?.name}'s campaign · started from {view.countryMap[game.humanCountry]?.name} · NPC style: {game.settings.npcProfile}
        {game.settings.aiStrategist ? ' · 🧠 AI strategist on' : ''}
      </Text>
    </Screen>
  );
}

const PHASE_HINT: Record<string, (g: any, mode: Mode) => string> = {
  reinforce: (g) => `Your turn! Deploy ${g.pendingReinforcements} new soldiers (2 per country you hold).`,
  main: (g, mode) => (g.attackUsed ? 'Attack done. Transfer soldiers or end your turn.' : mode === 'attack' ? 'Your turn: pick a country to attack from, then a target.' : 'Transfer soldiers between your countries.'),
  attacking: () => 'Battle in progress: roll the dice!',
  occupy: () => 'Victory in battle! Choose how many soldiers move in.',
  finished: () => '',
};

function confirmForfeit(onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm('Withdraw from this campaign? It will count as a loss.')) onYes();
  } else {
    onYes();
  }
}

const styles = StyleSheet.create({
  loading: { color: COLORS.boardText, textAlign: 'center', marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -5 },
  columns: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  turnBanner: { color: COLORS.boardText, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  controls: { backgroundColor: COLORS.boardPanel, borderRadius: RADIUS.lg, padding: 14, gap: 10, borderWidth: 1.5, borderColor: COLORS.yellowGreen },
  controlTitle: { color: COLORS.white, fontWeight: '900', fontSize: 16 },
  controlHint: { color: COLORS.boardMuted, fontSize: 13, lineHeight: 18 },
  share: { backgroundColor: COLORS.mossGreen, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  shareText: { color: COLORS.white, fontWeight: '800', fontSize: 12 },
  final: { backgroundColor: COLORS.boardPanel, borderWidth: 2, borderRadius: RADIUS.lg, padding: 18, gap: 10 },
  finalTitle: { color: COLORS.white, fontSize: 24, fontWeight: '900' },
  finalText: { color: COLORS.boardText, fontSize: 14 },
  footnote: { color: COLORS.boardMuted, fontSize: 12, textAlign: 'center' },
});
