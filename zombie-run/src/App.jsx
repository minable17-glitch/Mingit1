import { useCallback, useEffect, useRef, useState } from 'react'
import GameMap from './GameMap.jsx'
import { haversineDistance, moveToward, randomPointNear } from './lib/geo.js'

const CATCH_RADIUS_M = 12 // 이 거리 안으로 좀비가 들어오면 붙잡힘
const SHOOT_RADIUS_M = 35 // 이 거리 안의 좀비만 탭해서 처치 가능
const PICKUP_RADIUS_M = 15 // 이 거리 안으로 걸어가면 아이템 자동 획득
const ULTIMATE_RADIUS_M = 200 // 궁극기가 미치는 범위
const FIRST_WAVE_SEC = 60
const NEXT_WAVE_SEC = 75
const START_AMMO = 3
const MAX_AMMO = 12
const START_HEALTH = 6

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(2)}km`
}

function makeInitialGame() {
  return {
    status: 'start', // start | playing | gameover
    playerPos: null,
    lastPos: null,
    distance: 0,
    elapsedSec: 0,
    ammo: START_AMMO,
    health: START_HEALTH,
    score: 0,
    gauge: 0,
    frozenUntil: 0,
    zombies: [],
    pickups: [],
    waveCount: 0,
    nextWaveSec: FIRST_WAVE_SEC,
    ultimateCooldownUntil: 0,
    gameOverReason: null,
  }
}

export default function App() {
  const game = useRef(makeInitialGame()).current
  const [, setTick] = useState(0)
  const rerender = useCallback(() => setTick((n) => n + 1), [])

  const [geoError, setGeoError] = useState('')
  const [follow, setFollow] = useState(true)
  const [toastMsg, setToastMsg] = useState('')
  const toastTimerRef = useRef(null)
  const watchIdRef = useRef(null)
  const tickIntervalRef = useRef(null)

  const toast = useCallback((msg) => {
    setToastMsg(msg)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMsg(''), 2600)
  }, [])

  const spawnWave = useCallback(() => {
    if (!game.playerPos) return
    const count = 3 + Math.floor(Math.random() * 3)
    const spawned = []
    for (let i = 0; i < count; i++) {
      const p = randomPointNear(game.playerPos.lat, game.playerPos.lon, 70, 150)
      spawned.push({
        id: `z${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        lat: p.lat,
        lon: p.lon,
        speed: 1.5 + Math.random() * 0.9, // m/s (도보~조깅 속도, 1틱=1초라 그대로 스텝 거리로 씀)
      })
    }
    game.zombies = [...game.zombies, ...spawned]
    toast(`좀비 무리 등장! (${count}마리) 🧟`)
  }, [game, toast])

  const spawnPickup = useCallback(
    (type) => {
      if (!game.playerPos) return
      const p = randomPointNear(game.playerPos.lat, game.playerPos.lon, 30, 90)
      game.pickups = [...game.pickups, { id: `${type}_${Date.now()}`, type, lat: p.lat, lon: p.lon }]
    },
    [game]
  )

  const endGame = useCallback(
    (reason) => {
      game.status = 'gameover'
      game.gameOverReason = reason
      clearInterval(tickIntervalRef.current)
      rerender()
    },
    [game, rerender]
  )

  const tick = useCallback(() => {
    if (game.status !== 'playing') return
    game.elapsedSec += 1
    const now = Date.now()
    const frozen = now < game.frozenUntil

    if (game.playerPos && game.elapsedSec >= game.nextWaveSec) {
      spawnWave()
      game.waveCount += 1
      game.nextWaveSec = game.elapsedSec + NEXT_WAVE_SEC
    }

    if (game.playerPos && game.elapsedSec % 45 === 0 && !game.pickups.some((p) => p.type === 'ammo')) {
      spawnPickup('ammo')
    }
    if (game.playerPos && game.elapsedSec % 70 === 0 && !game.pickups.some((p) => p.type === 'hourglass')) {
      spawnPickup('hourglass')
    }

    if (!frozen && game.playerPos && game.zombies.length) {
      game.zombies = game.zombies.map((z) => {
        const next = moveToward(z.lat, z.lon, game.playerPos.lat, game.playerPos.lon, z.speed)
        return { ...z, lat: next.lat, lon: next.lon }
      })
    }

    if (game.playerPos && game.zombies.length) {
      let caught = false
      const survivors = []
      for (const z of game.zombies) {
        const d = haversineDistance(game.playerPos.lat, game.playerPos.lon, z.lat, z.lon)
        if (d < CATCH_RADIUS_M) {
          caught = true
          const far = randomPointNear(game.playerPos.lat, game.playerPos.lon, 90, 160)
          survivors.push({ ...z, lat: far.lat, lon: far.lon })
        } else {
          survivors.push(z)
        }
      }
      if (caught) {
        game.zombies = survivors
        game.health -= 1
        toast('좀비에게 붙잡혔어요! 💔')
        if (game.health <= 0) {
          endGame('caught')
          return
        }
      }
    }

    if (game.playerPos && game.pickups.length) {
      const remaining = []
      for (const p of game.pickups) {
        const d = haversineDistance(game.playerPos.lat, game.playerPos.lon, p.lat, p.lon)
        if (d < PICKUP_RADIUS_M) {
          if (p.type === 'ammo') {
            game.ammo = Math.min(MAX_AMMO, game.ammo + 4)
            toast('탄약 상자 발견! +4 🔫')
          } else {
            game.frozenUntil = Date.now() + 10000
            toast('모래시계 발동! 좀비가 10초간 멈춰요 ⏳')
          }
        } else {
          remaining.push(p)
        }
      }
      game.pickups = remaining
    }

    rerender()
  }, [game, rerender, spawnWave, spawnPickup, toast, endGame])

  const handlePosition = useCallback(
    (pos) => {
      const newPos = { lat: pos.coords.latitude, lon: pos.coords.longitude }
      if (game.status === 'playing' && game.lastPos) {
        const d = haversineDistance(game.lastPos.lat, game.lastPos.lon, newPos.lat, newPos.lon)
        if (d >= 0.5 && d <= 30) {
          game.distance += d
          game.gauge = Math.min(100, game.gauge + d * 0.15)
        }
      }
      game.lastPos = newPos
      game.playerPos = newPos
      setGeoError('')
      rerender()
    },
    [game, rerender]
  )

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
      clearInterval(tickIntervalRef.current)
      clearTimeout(toastTimerRef.current)
    }
  }, [])

  const requestLocationAndStart = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('이 기기/브라우저는 위치 정보를 지원하지 않아요.')
      return
    }
    setGeoError('')
    if (watchIdRef.current == null) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        (err) => setGeoError(err.message || '위치 권한을 확인해주세요.'),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
      )
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const startPos = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        Object.assign(game, makeInitialGame())
        game.status = 'playing'
        game.playerPos = startPos
        game.lastPos = startPos
        tickIntervalRef.current = setInterval(tick, 1000)
        rerender()
      },
      (err) => setGeoError(err.message || '위치 권한이 필요해요.'),
      { enableHighAccuracy: true, timeout: 20000 }
    )
  }, [game, handlePosition, tick, rerender])

  const shootZombie = useCallback(
    (id) => {
      if (game.status !== 'playing') return
      if (game.ammo <= 0) {
        toast('탄약이 없어요! 탄약 상자를 찾아보세요 📦')
        return
      }
      const z = game.zombies.find((zz) => zz.id === id)
      if (!z || !game.playerPos) return
      const d = haversineDistance(game.playerPos.lat, game.playerPos.lon, z.lat, z.lon)
      if (d > SHOOT_RADIUS_M) {
        toast(`너무 멀어요! (${Math.round(d)}m)`)
        return
      }
      game.zombies = game.zombies.filter((zz) => zz.id !== id)
      game.ammo -= 1
      game.score += 1
      toast('좀비 처치! 💀')
      rerender()
    },
    [game, toast, rerender]
  )

  const useUltimate = useCallback(() => {
    if (game.status !== 'playing') return
    if (game.gauge < 100) return
    const now = Date.now()
    if (now < game.ultimateCooldownUntil) return
    if (!game.playerPos) return
    let killed = 0
    game.zombies = game.zombies.filter((z) => {
      const d = haversineDistance(game.playerPos.lat, game.playerPos.lon, z.lat, z.lon)
      const inRange = d <= ULTIMATE_RADIUS_M
      if (inRange) killed += 1
      return !inRange
    })
    game.gauge = 0
    game.ultimateCooldownUntil = now + 5000
    game.score += killed
    toast(killed > 0 ? `궁극기 발동! 좀비 ${killed}마리 제거! ⚡` : '궁극기 발동! (주변에 좀비가 없어요)')
    rerender()
  }, [game, toast, rerender])

  const finishRun = useCallback(() => endGame('manual'), [endGame])

  const restart = useCallback(() => {
    const keepPos = game.playerPos
    Object.assign(game, makeInitialGame())
    game.playerPos = keepPos
    game.lastPos = keepPos
    game.status = 'playing'
    tickIntervalRef.current = setInterval(tick, 1000)
    rerender()
  }, [game, tick, rerender])

  const backToStart = useCallback(() => {
    const keepPos = game.playerPos
    Object.assign(game, makeInitialGame())
    game.playerPos = keepPos
    game.lastPos = keepPos
    rerender()
  }, [game, rerender])

  if (game.status === 'start') {
    return (
      <div className="zr-screen zr-start">
        <div className="zr-start-card">
          <h1 className="zr-title">🧟 좀비 런</h1>
          <p className="zr-subtitle">실제 GPS를 쓰기 때문에, 살아남는 방법은 진짜로 뛰는 것뿐입니다.</p>
          <ul className="zr-rules">
            <li>러닝 시작 60초 뒤, 좀비 무리 등장</li>
            <li>기본 총알 3발</li>
            <li>좀비를 탭해서 처치 (가까이 있어야 함)</li>
            <li>탄약 상자(📦)로 재장전</li>
            <li>모래시계(⏳) 아이템으로 좀비 10초간 정지</li>
            <li>달릴수록 게이지가 차서 궁극기 발동</li>
          </ul>
          {geoError && <p className="zr-error">{geoError}</p>}
          <button className="zr-btn zr-btn-primary" onClick={requestLocationAndStart}>
            도망치기 시작 🏃
          </button>
        </div>
      </div>
    )
  }

  if (game.status === 'gameover') {
    const reasonText =
      game.gameOverReason === 'caught' ? '좀비 무리에게 붙잡혔어요 💀' : '무사히 도망치는 데 성공했어요 🎉'
    return (
      <div className="zr-screen zr-start">
        <div className="zr-start-card">
          <h1 className="zr-title">{reasonText}</h1>
          <div className="zr-result-grid">
            <div>
              <div className="zr-result-num">{formatTime(game.elapsedSec)}</div>
              <div className="zr-result-label">생존 시간</div>
            </div>
            <div>
              <div className="zr-result-num">{formatDistance(game.distance)}</div>
              <div className="zr-result-label">달린 거리</div>
            </div>
            <div>
              <div className="zr-result-num">{game.score}</div>
              <div className="zr-result-label">처치한 좀비</div>
            </div>
          </div>
          <button className="zr-btn zr-btn-primary" onClick={restart}>
            다시 도전하기
          </button>
          <button className="zr-btn zr-btn-ghost" onClick={backToStart}>
            처음으로
          </button>
        </div>
      </div>
    )
  }

  const nearestZombieDist = game.zombies.length && game.playerPos
    ? Math.min(
        ...game.zombies.map((z) => haversineDistance(game.playerPos.lat, game.playerPos.lon, z.lat, z.lon))
      )
    : null
  const frozenActive = Date.now() < game.frozenUntil
  const ultimateReady = game.gauge >= 100 && Date.now() >= game.ultimateCooldownUntil

  return (
    <div className="zr-screen">
      <div className="zr-hud-top">
        <div className="zr-hud-stat">
          <div className="zr-hud-value">{formatTime(game.elapsedSec)}</div>
          <div className="zr-hud-label">시간</div>
        </div>
        <div className="zr-hud-stat">
          <div className="zr-hud-value">{formatDistance(game.distance)}</div>
          <div className="zr-hud-label">거리</div>
        </div>
        <div className="zr-hud-stat">
          <div className="zr-hud-value">{nearestZombieDist == null ? '-' : formatDistance(nearestZombieDist)}</div>
          <div className="zr-hud-label">가까운 좀비</div>
        </div>
      </div>

      <GameMap
        playerPos={game.playerPos}
        zombies={game.zombies}
        pickups={game.pickups}
        onShootZombie={shootZombie}
        follow={follow}
      />

      <div className="zr-hud-side">
        <div className="zr-badge">🔫 {game.ammo}</div>
        <div className="zr-hearts">
          {Array.from({ length: START_HEALTH }).map((_, i) => (
            <span key={i} className={i < game.health ? 'zr-heart zr-heart-on' : 'zr-heart'}>
              ❤️
            </span>
          ))}
        </div>
        <button
          className={ultimateReady ? 'zr-gauge zr-gauge-ready' : 'zr-gauge'}
          onClick={useUltimate}
          disabled={!ultimateReady}
        >
          ⚡{Math.floor(game.gauge)}
        </button>
        <div className="zr-badge">💀 {game.score}</div>
      </div>

      {frozenActive && <div className="zr-frozen-banner">⏳ 좀비 이동 정지 중</div>}
      {toastMsg && <div className="zr-toast">{toastMsg}</div>}
      {geoError && <div className="zr-frozen-banner zr-error-banner">{geoError}</div>}

      <div className="zr-hud-bottom">
        <button className="zr-round-btn" onClick={() => setFollow((f) => !f)}>
          {follow ? '📍' : '🗺️'}
        </button>
        <button className="zr-btn zr-btn-ghost zr-btn-small" onClick={finishRun}>
          종료
        </button>
      </div>
    </div>
  )
}
