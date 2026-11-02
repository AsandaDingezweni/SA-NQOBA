import type { CommandResult, Country, GameSummary, GameView, Page, User } from './types';

// In production the API is served from the same origin as the web app.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? 'http://localhost:5000' : '');

export class ApiError extends Error {
  constructor(message: string, public status: number, public code: string, public details?: Record<string, string>) {
    super(message);
  }
}

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the SA-NQOBA server. Check your connection.', 0, 'NETWORK');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json.error ?? {};
    throw new ApiError(err.message ?? `Request failed (${res.status})`, res.status, err.code ?? 'UNKNOWN', err.details);
  }
  return json as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

export const api = {
  health: () => request<{ ok: boolean; ai: { enabled: boolean; model: string } }>('GET', '/health'),

  register: (username: string, password: string) => request<{ token: string; user: User }>('POST', '/auth/register', { username, password }),
  login: (username: string, password: string) => request<{ token: string; user: User }>('POST', '/auth/login', { username, password }),
  me: () => request<{ user: User }>('GET', '/auth/me'),

  countries: (q: { search?: string; region?: string; minSoldiers?: number; maxSoldiers?: number; sort?: string }) =>
    request<{ countries: Country[]; total: number }>('GET', `/countries${qs(q)}`),

  createGame: (countryCode: string, npcProfile: string, aiStrategist: boolean) =>
    request<{ game: GameView }>('POST', '/games', { countryCode, npcProfile, aiStrategist }),
  game: (id: string, since = 0) => request<{ game: GameView; viewerIsOwner: boolean }>('GET', `/games/${id}${qs({ since })}`),
  myGames: (q: { status?: string; search?: string; page?: number }) => request<Page<GameSummary>>('GET', `/games/mine${qs(q)}`),
  publicGames: (q: { status?: string; search?: string; page?: number }) => request<Page<GameSummary>>('GET', `/games${qs(q)}`),
  command: (id: string, action: string, body?: unknown) => request<CommandResult>('POST', `/games/${id}/${action}`, body ?? {}),

  myStats: () => request<any>('GET', '/stats/me'),
  platformStats: () => request<any>('GET', '/stats/platform'),
};
