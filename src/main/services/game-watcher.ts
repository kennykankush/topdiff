import https from 'https'
import { IPC } from '../ipc/channels'
import { getOverlayWindow } from '../windows/overlay-window'
import type { LiveSnapshot, PostGameSummary, GamePhase } from '../../shared/types'

// ── Riot Live Client API ─────────────────────────────────────────────────────

const AGENT = new https.Agent({ rejectUnauthorized: false })

function fetchLive<T>(path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://127.0.0.1:2999/liveclientdata${path}`, { agent: AGENT }, res => {
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString()) as T) }
        catch { reject(new Error('JSON parse failed')) }
      })
    })
    req.setTimeout(1500, () => req.destroy(new Error('timeout')))
    req.on('error', reject)
  })
}

// ── Raw API types ────────────────────────────────────────────────────────────

interface RawAllGameData {
  activePlayer: {
    summonerName: string
    currentGold: number
    level: number
  }
  allPlayers: RawPlayer[]
  events: { Events: RawEvent[] }
  gameData: { gameTime: number; gameMode: string }
}

interface RawPlayer {
  championName: string
  summonerName: string
  team: 'ORDER' | 'CHAOS'
  position: string
  level: number
  isDead: boolean
  respawnTimer: number
  scores: { kills: number; deaths: number; assists: number; creepScore: number; wardScore: number }
  items: { itemID: number; displayName: string; price: number; count: number; slot: number }[]
}

interface RawEvent {
  EventID: number
  EventName: string
  EventTime: number
  KillerName?: string
  DragonType?: string
}

// ── Derived metrics ──────────────────────────────────────────────────────────

// Stepped expected CS model: wave travel + per-minute degradation
function calcExpectedCS(gameTimeSec: number): number {
  const m = gameTimeSec / 60
  if (m <= 1.5) return 0
  if (m <= 10)  return Math.round((m - 1.5) * 8.5)        // ~72 at 10 min
  if (m <= 20)  return Math.round(72 + (m - 10) * 7)      // ~142 at 20 min
  return Math.round(142 + (m - 20) * 6)                    // ~182 at 25 min
}

function calcTeamGold(players: RawPlayer[], team: 'ORDER' | 'CHAOS'): number {
  return players
    .filter(p => p.team === team)
    .reduce((sum, p) => sum + p.items.reduce((s, i) => s + i.price * Math.max(1, i.count), 0), 0)
}

function calcKillParticipation(
  scores: RawPlayer['scores'],
  allPlayers: RawPlayer[],
  myTeam: 'ORDER' | 'CHAOS'
): number {
  const teamKills = allPlayers
    .filter(p => p.team === myTeam)
    .reduce((sum, p) => sum + p.scores.kills, 0)
  if (teamKills === 0) return 0
  return Math.round((scores.kills + scores.assists) / teamKills * 100)
}

function calcObjectives(
  events: RawEvent[],
  allPlayers: RawPlayer[],
  gameTime: number
): LiveSnapshot['objectives'] {
  const playerTeamMap: Record<string, 'ORDER' | 'CHAOS'> = {}
  allPlayers.forEach(p => { playerTeamMap[p.summonerName.toLowerCase()] = p.team })

  const dragonKills = events.filter(e => e.EventName === 'DragonKill')
  const baronKills  = events.filter(e => e.EventName === 'BaronKill')

  // Dragon timers (5:00 first spawn, 5:00 respawn)
  let nextDragon: number
  if (dragonKills.length === 0) {
    nextDragon = Math.max(0, 300 - gameTime)
  } else {
    const lastTime = dragonKills[dragonKills.length - 1].EventTime
    nextDragon = Math.max(0, lastTime + 300 - gameTime)
  }

  // Baron timers (20:00 first spawn, 6:00 respawn)
  let nextBaron: number
  if (baronKills.length === 0) {
    nextBaron = gameTime >= 1200 ? 0 : 1200 - gameTime
  } else {
    const lastTime = baronKills[baronKills.length - 1].EventTime
    nextBaron = Math.max(0, lastTime + 360 - gameTime)
  }

  // Dragon count per team
  const dragonCount = { order: 0, chaos: 0 }
  for (const e of dragonKills) {
    const killerTeam = playerTeamMap[(e.KillerName ?? '').toLowerCase()]
    if (killerTeam === 'ORDER') dragonCount.order++
    else if (killerTeam === 'CHAOS') dragonCount.chaos++
  }

  return { nextDragon, nextBaron, dragonCount }
}

function buildSnapshot(raw: RawAllGameData): LiveSnapshot | null {
  const { activePlayer, allPlayers, events, gameData } = raw
  const myName = activePlayer.summonerName.toLowerCase()

  const me = allPlayers.find(p => p.summonerName.toLowerCase() === myName)
  if (!me) return null

  const gameTime = gameData.gameTime
  const csPerMin = gameTime > 60 ? me.scores.creepScore / (gameTime / 60) : 0
  const expectedCS = calcExpectedCS(gameTime)
  const myTeam = me.team
  const enemyTeam: 'ORDER' | 'CHAOS' = myTeam === 'ORDER' ? 'CHAOS' : 'ORDER'

  // Find enemy laner by position (fall back to null if position unknown)
  const myPos = me.position
  const enemyLanerRaw = myPos && myPos !== ''
    ? allPlayers.find(p => p.team === enemyTeam && p.position === myPos) ?? null
    : null

  const myGold  = calcTeamGold(allPlayers, myTeam)
  const oppGold = calcTeamGold(allPlayers, enemyTeam)

  return {
    gameTime,
    gameMode: gameData.gameMode,
    myChampion: me.championName,
    myPosition: me.position,
    myTeam,
    level: activePlayer.level,
    isDead: me.isDead,
    respawnTimer: me.respawnTimer,
    currentGold: activePlayer.currentGold,
    scores: {
      kills: me.scores.kills,
      deaths: me.scores.deaths,
      assists: me.scores.assists,
      creepScore: me.scores.creepScore,
    },
    csPerMin,
    expectedCS,
    killParticipation: calcKillParticipation(me.scores, allPlayers, myTeam),
    teamGoldDiff: myGold - oppGold,
    enemyLaner: enemyLanerRaw ? {
      championName: enemyLanerRaw.championName,
      level: enemyLanerRaw.level,
      isDead: enemyLanerRaw.isDead,
      respawnTimer: enemyLanerRaw.respawnTimer,
      scores: {
        kills: enemyLanerRaw.scores.kills,
        deaths: enemyLanerRaw.scores.deaths,
        assists: enemyLanerRaw.scores.assists,
        creepScore: enemyLanerRaw.scores.creepScore,
      },
      csPerMin: gameTime > 60 ? enemyLanerRaw.scores.creepScore / (gameTime / 60) : 0,
    } : null,
    objectives: calcObjectives(events.Events, allPlayers, gameTime),
  }
}

function buildPostGame(lastSnapshot: LiveSnapshot): PostGameSummary {
  return {
    durationSeconds: lastSnapshot.gameTime,
    myChampion: lastSnapshot.myChampion,
    kills: lastSnapshot.scores.kills,
    deaths: lastSnapshot.scores.deaths,
    assists: lastSnapshot.scores.assists,
    cs: lastSnapshot.scores.creepScore,
    csPerMin: lastSnapshot.csPerMin,
    expectedCS: lastSnapshot.expectedCS,
    killParticipation: lastSnapshot.killParticipation,
    teamGoldDiff: lastSnapshot.teamGoldDiff,
  }
}

// ── Watcher ──────────────────────────────────────────────────────────────────

let phase: GamePhase = 'idle'
let lastSnapshot: LiveSnapshot | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function push(channel: string, data?: unknown) {
  getOverlayWindow()?.webContents.send(channel, data)
}

function scheduleNext(ms: number) {
  timer = setTimeout(poll, ms)
}

async function poll() {
  try {
    const raw = await fetchLive<RawAllGameData>('/allgamedata')
    const snapshot = buildSnapshot(raw)
    if (!snapshot) { scheduleNext(1000); return }

    if (phase !== 'in_game') {
      phase = 'in_game'
      push(IPC.GAME_PHASE, phase)
      console.log('[GameWatcher] Game started')
    }

    lastSnapshot = snapshot
    push(IPC.LIVE_DATA, snapshot)
    scheduleNext(1000)
  } catch {
    if (phase === 'in_game' && lastSnapshot) {
      // Game just ended
      phase = 'post_game'
      push(IPC.GAME_PHASE, phase)
      push(IPC.POST_GAME, buildPostGame(lastSnapshot))
      console.log('[GameWatcher] Game ended')
      lastSnapshot = null
      scheduleNext(5000)
    } else {
      if (phase !== 'idle') {
        phase = 'idle'
        push(IPC.GAME_PHASE, phase)
      }
      scheduleNext(3000) // poll less often when idle
    }
  }
}

export function startGameWatcher() {
  console.log('[GameWatcher] Started')
  poll()
}

export function stopGameWatcher() {
  if (timer) clearTimeout(timer)
  timer = null
}

export function getGamePhase(): GamePhase {
  return phase
}
