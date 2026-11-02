import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { CountryState, EventType, GameEvent, GameView, Player } from '@/lib/types';

type Board = Record<string, { owner: string; soldiers: number }>;

// [normal ms, fast-forward ms]: fast-forward speeds play up but every event is still shown.
const PACE: Partial<Record<EventType, [number, number]>> = {
  turn_start: [700, 160],
  reinforce: [1000, 260],
  transfer: [900, 240],
  attack_start: [1200, 320],
  roll: [1500, 420],
  conquest: [1500, 420],
  attack_failed: [1200, 320],
  attack_stop: [900, 260],
  occupy: [900, 240],
  elimination: [1500, 420],
  turn_end: [400, 100],
};
const BATTLE_EVENTS: EventType[] = ['attack_start', 'roll', 'conquest', 'attack_failed', 'attack_stop'];
const SPECTATOR_POLL_MS = 3000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const boardFrom = (countries: CountryState[]): Board => Object.fromEntries(countries.map((c) => [c.code, { owner: c.owner, soldiers: c.soldiers }]));
const lastOf = (events: GameEvent[], types: EventType[]) => [...events].reverse().find((e) => types.includes(e.type)) ?? null;

export function useGameSession(id: string) {
  const { user, ready } = useAuth();
  const [game, setGame] = useState<GameView | null>(null);
  const [viewerIsOwner, setViewerIsOwner] = useState(false);
  const [board, setBoard] = useState<Board>({});
  const [feed, setFeed] = useState<GameEvent[]>([]);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fastForward, setFastForward] = useState(false);

  const fastRef = useRef(false);
  fastRef.current = fastForward;
  const queue = useRef<GameEvent[]>([]);
  const latest = useRef<GameView | null>(null);
  const lastSeq = useRef(0);
  const pumping = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const play = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    setPlaying(true);
    while (queue.current.length && alive.current) {
      const e = queue.current.shift()!;
      setBoard((b) => {
        const next = { ...b };
        for (const p of e.patch) next[p.code] = { owner: p.owner, soldiers: p.soldiers };
        return next;
      });
      setFeed((f) => [...f, e]);
      const [normal, fast] = PACE[e.type] ?? [500, 120];
      await sleep(fastRef.current ? fast : normal);
    }
    if (latest.current) setGame(latest.current);
    pumping.current = false;
    setPlaying(false);
  }, []);

  const ingest = useCallback(
    (events: GameEvent[], next: GameView) => {
      const fresh = events.filter((e) => e.seq > lastSeq.current);
      if (fresh.length) lastSeq.current = fresh[fresh.length - 1].seq;
      latest.current = next;
      queue.current.push(...fresh);
      play();
    },
    [play],
  );

  const load = useCallback(async () => {
    try {
      const { game: g, viewerIsOwner: owner } = await api.game(id);
      queue.current = [];
      lastSeq.current = g.eventSeq;
      latest.current = g;
      setGame(g);
      setViewerIsOwner(owner);
      setBoard(boardFrom(g.countries));
      setFeed(g.events);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load this game.');
    }
  }, [id]);

  useEffect(() => {
    if (ready) load();
  }, [ready, user?.id, load]);

  const inFlight = useRef(false);
  const command = useCallback(
    async (action: string, body?: unknown) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const r = await api.command(id, action, body);
        ingest(r.events, r.game);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
        if (e instanceof ApiError && e.code === 'STALE_GAME') await load();
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [id, ingest, load],
  );

  // The owner's client plays NPC turns one at a time; each response is animated before the next is requested.
  const npcTurn = Boolean(game && viewerIsOwner && game.status === 'active' && game.currentPid !== 'human');
  useEffect(() => {
    if (!npcTurn || playing || busy || error) return;
    command('advance');
  }, [npcTurn, playing, busy, error, game?.eventSeq, command]);

  // Spectators follow along live by polling for events newer than the last one they saw.
  useEffect(() => {
    if (!game || viewerIsOwner || game.status !== 'active') return;
    const timer = setInterval(async () => {
      if (pumping.current) return;
      try {
        const r = await api.game(id, lastSeq.current);
        if (r.game.events.length) ingest(r.game.events, r.game);
      } catch {}
    }, SPECTATOR_POLL_MS);
    return () => clearInterval(timer);
  }, [game?.status, viewerIsOwner, id, ingest]);

  const view = useMemo(() => {
    if (!game) return null;
    const countries = game.countries.map((c) => ({ ...c, ...(board[c.code] ?? {}) }));
    const players: Record<string, Player> = Object.fromEntries(game.players.map((p) => [p.pid, p]));
    return {
      countries,
      countryMap: Object.fromEntries(countries.map((c) => [c.code, c])) as Record<string, CountryState>,
      players,
      spotlight: lastOf(feed, BATTLE_EVENTS),
      lastRoll: lastOf(feed, ['roll']),
      actingPid: lastOf(feed, ['turn_start'])?.actor ?? game.currentPid,
    };
  }, [game, board, feed]);

  return {
    game,
    view,
    feed,
    playing,
    busy,
    error,
    loadError,
    clearError: () => setError(null),
    fastForward,
    setFastForward,
    viewerIsOwner,
    canAct: Boolean(game && viewerIsOwner && !playing && !busy && game.status === 'active' && game.currentPid === 'human'),
    command,
    reload: load,
  };
}
