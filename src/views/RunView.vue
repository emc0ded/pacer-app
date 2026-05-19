<template>
  <div class="run-view">
    <!-- ── Map (fills entire screen) ──────────────────────────── -->
    <MapboxMap
      ref="mapRef"
      :center="mapCenter"
      :zoom="16"
      class="run-map"
      @mapLoaded="onMapLoaded"
    />

    <!-- ── Stats overlay (top-center, only during active run) ─── -->
    <Transition name="slide-down">
      <div v-if="runState !== 'idle'" class="stats-overlay">
        <div class="stat-item">
          <span class="val">{{ formattedDistance }}</span>
          <span class="lbl">mi</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="val">{{ formattedDuration }}</span>
          <span class="lbl">time</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="val">{{ formattedPace }}</span>
          <span class="lbl">/ mi</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="val">{{ formattedCurrentSplit }}</span>
          <span class="lbl">split</span>
        </div>
      </div>
    </Transition>

    <!-- ── Audio toggle (top-left, only during active run) ────── -->
    <Transition name="slide-down">
      <button v-if="runState !== 'idle'" class="audio-btn" @click="audioEnabled = !audioEnabled">
        {{ audioEnabled ? '🔊' : '🔇' }}
      </button>
    </Transition>

    <!-- ── GPS status badge (top-right) ──────────────────────── -->
    <div class="gps-badge" :class="gpsBadgeClass">
      <span class="gps-dot" />
      {{ gpsStatus }}
    </div>

    <!-- ── Run controls (bottom) ──────────────────────────────── -->
    <div class="run-controls">
      <!-- IDLE: single start button -->
      <template v-if="runState === 'idle'">
        <button
          class="ctrl-btn primary"
          :disabled="!gpsReady"
          @click="startRun"
        >
          {{ gpsReady ? 'Start Run' : 'Waiting for GPS…' }}
        </button>
      </template>

      <!-- RUNNING: pause + stop -->
      <template v-else-if="runState === 'running'">
        <button class="ctrl-btn secondary" @click="pauseRun">Pause</button>
        <button class="ctrl-btn danger"    @click="stopRun">Finish</button>
      </template>

      <!-- PAUSED: resume + finish -->
      <template v-else-if="runState === 'paused'">
        <button class="ctrl-btn primary"   @click="resumeRun">Resume</button>
        <button class="ctrl-btn danger"    @click="stopRun">Finish</button>
      </template>
    </div>

    <!-- ── Mile split toast ──────────────────────────────────────── -->
    <Transition name="split-fade">
      <div v-if="splitToast" class="split-toast">
        <span class="split-toast-mile">Mile {{ splitToast.mile }} ✓</span>
        <span class="split-toast-pace">{{ splitToast.pace }} /mi</span>
      </div>
    </Transition>

    <!-- ── Post-run summary sheet ─────────────────────────────── -->
    <Transition name="slide-up">
      <div v-if="showSummary" class="summary-sheet">
        <div class="summary-handle" />
        <h2 class="summary-title">Run Complete 🎉</h2>

        <div class="summary-stats">
          <div class="s-stat">
            <span class="s-val">{{ summaryData.distanceMi }}</span>
            <span class="s-lbl">mi</span>
          </div>
          <div class="s-stat">
            <span class="s-val">{{ summaryData.duration }}</span>
            <span class="s-lbl">time</span>
          </div>
          <div class="s-stat">
            <span class="s-val">{{ summaryData.pace }}</span>
            <span class="s-lbl">avg /mi</span>
          </div>
        </div>

        <!-- Mile splits -->
        <div v-if="splits.length > 0" class="splits-section">
          <span class="splits-label">Splits</span>
          <div class="splits-list">
            <div v-for="split in splits" :key="split.mile" class="split-row">
              <span class="split-num">Mile {{ split.mile }}</span>
              <span class="split-pace">{{ split.pace }}</span>
              <span class="split-unit">/mi</span>
            </div>
          </div>
        </div>

        <!-- Run name -->
        <div class="name-section">
          <input
            v-model="runName"
            class="run-name-input"
            maxlength="60"
            :placeholder="coachingLoading ? 'Generating name…' : 'Name your run…'"
          />
        </div>

        <!-- Effort rating -->
        <div class="effort-section">
          <span class="effort-label">How hard was it?</span>
          <div class="effort-row">
            <button
              v-for="level in effortLevels"
              :key="level.value"
              class="effort-btn"
              :class="{ selected: effortRating === level.value }"
              @click="effortRating = level.value"
            >
              <span class="effort-emoji">{{ level.emoji }}</span>
              <span class="effort-name">{{ level.label }}</span>
            </button>
          </div>
        </div>

        <div class="summary-actions">
          <button class="ctrl-btn primary" :disabled="saving" @click="saveRun">
            {{ saving ? 'Saving…' : 'Save Run' }}
          </button>
          <button class="ctrl-btn secondary" @click="discardRun">Discard</button>
        </div>

        <!-- AI Coaching summary -->
        <div class="ai-card">
          <span class="ai-chip">✦ AI Coaching</span>

          <!-- Loading -->
          <div v-if="coachingLoading" class="ai-loading">
            <span class="ai-dots">
              <span /><span /><span />
            </span>
            <span>Analyzing your run…</span>
          </div>

          <!-- Error -->
          <p v-else-if="coachingError" class="ai-error">
            Couldn't load coaching right now.
          </p>

          <!-- Coaching text -->
          <p v-else-if="coachingText" class="ai-text">{{ coachingText }}</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import mapboxgl from 'mapbox-gl'
import MapboxMap from '@/components/MapboxMap.vue'
import { useRunStore } from '@/stores/run'
import { useAuthStore } from '@/stores/auth'
import { useRouteStore } from '@/stores/route'
import { getRunCoaching, generateRouteName } from '@/services/coaching'

const runStore   = useRunStore()
const authStore  = useAuthStore()
const routeStore = useRouteStore()

// ── Constants ──────────────────────────────────────────────────
const MILE_METERS = 1609.344

// ── Map ────────────────────────────────────────────────────────
const mapRef    = ref(null)
const mapCenter = ref([-122.4194, 37.7749]) // SF until first GPS fix
let   mapInstance = null

// ── GPS ────────────────────────────────────────────────────────
const gpsStatus  = ref('Acquiring GPS…')
const gpsReady   = ref(false)
let   watchId    = null
let   userMarker = null

// ── Run state ──────────────────────────────────────────────────
const runState     = ref('idle') // 'idle' | 'running' | 'paused'
const coordinates  = ref([])     // [[lng, lat], …]
const totalDistance= ref(0)      // metres
const elapsedMs    = ref(0)
let   startTime    = null
let   pausedAt     = null
let   timerInterval= null
let   lastCoord    = null

// ── Audio ──────────────────────────────────────────────────────
const audioEnabled = ref(true)

function speak(text) {
  if (!audioEnabled.value || !window.speechSynthesis) return
  // Cancel anything already speaking so splits don't queue up
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate   = 0.95
  utt.volume = 1
  window.speechSynthesis.speak(utt)
}

// ── Elevation ─────────────────────────────────────────────────
const altitudes    = ref([])   // metres, captured while running

// ── Splits ─────────────────────────────────────────────────────
const splits       = ref([])   // [{ mile, pace }]
const splitToast   = ref(null) // { mile, pace } shown briefly
let   milesCompleted  = 0
let   lastSplitMs     = 0
let   splitToastTimer = null

// ── Post-run ───────────────────────────────────────────────────
const showSummary    = ref(false)
const summaryData    = ref({})
const saving         = ref(false)

// AI coaching state
const coachingText    = ref('')
const coachingLoading = ref(false)
const coachingError   = ref(false)

// Run name (pre-filled from AI, editable by user before saving)
const runName = ref('')

// Effort rating
const effortRating = ref(null)
const effortLevels = [
  { value: 1, emoji: '😴', label: 'Easy'   },
  { value: 2, emoji: '🙂', label: 'Moderate'},
  { value: 3, emoji: '💪', label: 'Hard'    },
  { value: 4, emoji: '🔥', label: 'V. Hard' },
  { value: 5, emoji: '💀', label: 'Max'     },
]

// ── Computed display values ────────────────────────────────────
const formattedDistance = computed(() =>
  (totalDistance.value / MILE_METERS).toFixed(2),
)

const formattedDuration = computed(() => {
  const s = Math.floor(elapsedMs.value / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
})

const formattedPace = computed(() => {
  const mi  = totalDistance.value / MILE_METERS
  const min = elapsedMs.value / 60000
  if (mi < 0.01) return '--:--'
  const pace = min / mi
  const pm   = Math.floor(pace)
  const ps   = Math.round((pace - pm) * 60)
  return `${pm}:${String(ps).padStart(2,'0')}`
})

// Elevation gain in metres (sum of positive altitude deltas > 1 m, to filter noise)
const elevationGainM = computed(() => {
  let gain = 0
  for (let i = 1; i < altitudes.value.length; i++) {
    const delta = altitudes.value[i] - altitudes.value[i - 1]
    if (delta > 1) gain += delta
  }
  return Math.round(gain)
})

// Current split: pace for the in-progress mile (resets each mile)
const formattedCurrentSplit = computed(() => {
  const distIntoMile = totalDistance.value - milesCompleted * MILE_METERS
  const msIntoMile   = elapsedMs.value - lastSplitMs
  if (distIntoMile < 50 || msIntoMile <= 0) return '--:--'
  const pace = (msIntoMile / 60000) / (distIntoMile / MILE_METERS)
  const pm   = Math.floor(pace)
  const ps   = Math.round((pace - pm) * 60)
  return `${pm}:${String(ps).padStart(2, '00')}`
})

const gpsBadgeClass = computed(() => {
  if (gpsReady.value && !gpsStatus.value.startsWith('GPS Error')) return 'active'
  if (gpsStatus.value.startsWith('GPS Error')) return 'error'
  return 'acquiring'
})

// ── Map loaded callback ────────────────────────────────────────
function onMapLoaded(map) {
  mapInstance = map
  drawGhostRoute()
  startGPSWatch()
}

// ── Ghost line (planned route) ─────────────────────────────────
function drawGhostRoute() {
  const planned = routeStore.selectedRoute
  if (!planned || !planned.coordinates || planned.coordinates.length < 2 || !mapInstance) return

  // Firestore stores coords as [{lng, lat}] objects — convert to [[lng, lat]] for Mapbox
  const coords = planned.coordinates.map((c) => [c.lng, c.lat])

  mapInstance.addSource('planned-route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
    },
  })
  mapInstance.addLayer({
    id: 'planned-route',
    type: 'line',
    source: 'planned-route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#E8F400',
      'line-width': 3,
      'line-opacity': 0.35,
      'line-dasharray': [2, 3],
    },
  })

  // Fit map to show the whole planned route
  const bounds = coords.reduce(
    (b, c) => b.extend(c),
    new mapboxgl.LngLatBounds(coords[0], coords[0]),
  )
  mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 1000 })
}

// ── GPS watch ─────────────────────────────────────────────────
function startGPSWatch() {
  if (!navigator.geolocation) {
    gpsStatus.value = 'GPS Not Supported'
    return
  }

  watchId = navigator.geolocation.watchPosition(
    handlePosition,
    (err) => {
      gpsStatus.value = `GPS Error: ${err.message}`
      gpsReady.value = false
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
  )
}

function handlePosition(pos) {
  const { longitude, latitude, accuracy } = pos.coords
  gpsReady.value  = true
  gpsStatus.value = `GPS  ±${Math.round(accuracy)}m`

  // First fix — fly map to user location
  if (!userMarker) {
    mapCenter.value = [longitude, latitude]
    mapInstance?.flyTo({ center: [longitude, latitude], zoom: 16, duration: 1200 })
  }

  // Update the amber position dot
  updateUserMarker(longitude, latitude)

  // While running: record coordinate, compute distance, draw route
  if (runState.value === 'running') {
    const coord = [longitude, latitude]
    coordinates.value.push(coord)

    if (lastCoord) {
      totalDistance.value += haversine(lastCoord, coord)
    }
    lastCoord = coord

    // Track altitude for elevation gain (GPS altitude, metres)
    const alt = pos.coords.altitude
    if (alt != null && !isNaN(alt)) {
      altitudes.value.push(alt)
    }

    // ── Mile split detection ───────────────────────────────────
    const newMiles = Math.floor(totalDistance.value / MILE_METERS)
    if (newMiles > milesCompleted) {
      milesCompleted = newMiles
      const deltaMs  = elapsedMs.value - lastSplitMs
      lastSplitMs    = elapsedMs.value
      const paceMin  = deltaMs / 60000
      const pm       = Math.floor(paceMin)
      const ps       = Math.round((paceMin - pm) * 60)
      const paceStr  = `${pm}:${String(ps).padStart(2, '0')}`
      splits.value.push({ mile: milesCompleted, pace: paceStr })
      // Show toast for 3.5 s
      clearTimeout(splitToastTimer)
      splitToast.value   = { mile: milesCompleted, pace: paceStr }
      splitToastTimer    = setTimeout(() => { splitToast.value = null }, 3500)
      // Read split aloud
      speak(`Mile ${milesCompleted}. Split pace: ${pm} minutes ${ps > 0 ? ps + ' seconds' : ''} per mile.`)
    }

    updateRouteLine()

    // Keep map centred on runner
    mapInstance?.easeTo({ center: [longitude, latitude], duration: 800 })
  }
}

// ── User position marker ───────────────────────────────────────
function updateUserMarker(lng, lat) {
  if (!mapInstance) return
  if (!userMarker) {
    const el = document.createElement('div')
    el.className = 'user-dot'
    userMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(mapInstance)
  } else {
    userMarker.setLngLat([lng, lat])
  }
}

// ── Route polyline ─────────────────────────────────────────────
function updateRouteLine() {
  if (!mapInstance || coordinates.value.length < 2) return

  const geojson = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coordinates.value },
  }

  if (mapInstance.getSource('route')) {
    mapInstance.getSource('route').setData(geojson)
  } else {
    mapInstance.addSource('route', { type: 'geojson', data: geojson })
    mapInstance.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#E8F400',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 3, 18, 6],
        'line-opacity': 0.9,
      },
    })
  }
}

// ── Run controls ───────────────────────────────────────────────
function startRun() {
  runState.value      = 'running'
  coordinates.value   = []
  altitudes.value     = []
  totalDistance.value = 0
  elapsedMs.value     = 0
  lastCoord           = null
  splits.value        = []
  milesCompleted      = 0
  lastSplitMs         = 0
  clearTimeout(splitToastTimer)
  splitToast.value    = null
  startTime           = Date.now()
  runStore.setRunning(true)
  startTimer()
  // Remove any previous route from map
  if (mapInstance?.getLayer('route')) mapInstance.removeLayer('route')
  if (mapInstance?.getSource('route')) mapInstance.removeSource('route')
}

function pauseRun() {
  runState.value = 'paused'
  pausedAt = Date.now()
  stopTimer()
}

function resumeRun() {
  runState.value = 'running'
  startTime += Date.now() - pausedAt
  pausedAt = null
  startTimer()
}

function stopRun() {
  stopTimer()
  runState.value = 'idle'
  runStore.setRunning(false)

  // Build summary
  const km    = totalDistance.value / 1000
  const mi    = totalDistance.value / MILE_METERS
  const min   = elapsedMs.value / 60000
  const pace  = mi > 0.01 ? min / mi : null
  const fmtPace = (p) => {
    if (!p) return '--:--'
    const pm = Math.floor(p)
    const ps = Math.round((p - pm) * 60)
    return `${pm}:${String(ps).padStart(2,'0')}`
  }

  const paceStr = fmtPace(pace)

  summaryData.value = {
    distanceMi: mi.toFixed(2),
    duration:   formattedDuration.value,
    pace:       paceStr,
    // Raw data for saving
    _distance:      totalDistance.value,
    _duration:      elapsedMs.value,
    _coords:        [...coordinates.value],
    _splits:        [...splits.value],
    _elevationGain: elevationGainM.value > 0 ? elevationGainM.value : null,
    _aiName:        null, // filled in by generateRouteName
  }

  showSummary.value = true

  // Kick off both AI calls in parallel — don't await, let them stream in
  fetchAIInsights(km.toFixed(2), formattedDuration.value, paceStr)
}

async function fetchAIInsights(distanceKm, duration, pace) {
  coachingText.value    = ''
  coachingError.value   = false
  coachingLoading.value = true

  try {
    // Run coaching + route name in parallel
    const [coaching, routeName] = await Promise.all([
      getRunCoaching({ distanceKm, duration, pace }),
      generateRouteName({ distanceKm, pace }),
    ])

    coachingText.value           = coaching
    summaryData.value._aiName    = routeName
    // Only populate the name field if the user hasn't typed anything yet
    if (!runName.value) runName.value = routeName
  } catch (err) {
    console.error('[coaching]', err)
    coachingError.value = true
  } finally {
    coachingLoading.value = false
  }
}

async function saveRun() {
  saving.value = true
  try {
    const finalName = toTitleCase(
      runName.value.trim() || summaryData.value._aiName || `Run on ${new Date().toLocaleDateString()}`
    )
    await runStore.addRun(authStore.uid, {
      name:        finalName,
      date:        new Date().toISOString(),
      distance:    summaryData.value._distance,
      duration:    summaryData.value._duration,
      coordinates: summaryData.value._coords.map(([lng, lat]) => ({ lng, lat })),
      splits:        summaryData.value._splits.length > 0 ? summaryData.value._splits : null,
      elevationGain: summaryData.value._elevationGain ?? null,
      effort:        effortRating.value,
      coaching:    coachingText.value || null,
    })
    showSummary.value  = false
    elapsedMs.value    = 0
    effortRating.value = null
    coachingText.value = ''
    runName.value      = ''
    splits.value       = []
    routeStore.clearSelectedRoute()
  } catch (err) {
    console.error('[run] save error:', err)
  } finally {
    saving.value = false
  }
}

function discardRun() {
  showSummary.value  = false
  elapsedMs.value    = 0
  effortRating.value = null
  coachingText.value = ''
  runName.value      = ''
  splits.value       = []
  splitToast.value   = null
  routeStore.clearSelectedRoute()
}

// ── Timer ──────────────────────────────────────────────────────
function startTimer() {
  timerInterval = setInterval(() => {
    elapsedMs.value = Date.now() - startTime
  }, 500)
}

function stopTimer() {
  clearInterval(timerInterval)
  timerInterval = null
}

// ── Helpers ───────────────────────────────────────────────────
function toTitleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Haversine distance (metres) ────────────────────────────────
function haversine([lng1, lat1], [lng2, lat2]) {
  const R   = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Cleanup ────────────────────────────────────────────────────
onUnmounted(() => {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  stopTimer()
  clearTimeout(splitToastTimer)
  window.speechSynthesis?.cancel()
})
</script>

<style scoped>
/* ── Layout ────────────────────────────────────────────────── */
.run-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
}

.run-map {
  position: absolute;
  inset: 0;
}

/* ── Stats overlay ─────────────────────────────────────────── */
.stats-overlay {
  position: absolute;
  top: max(1rem, calc(env(safe-area-inset-top) + 0.5rem));
  left: 50%;
  transform: translateX(-50%);
  background: var(--glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 0.7rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 20;
  white-space: nowrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.val {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.6rem;
  letter-spacing: 0.04em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.lbl {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.45rem;
  font-weight: 700;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.stat-divider {
  width: 1px;
  height: 2rem;
  background: var(--border);
}

/* ── Audio toggle ──────────────────────────────────────────── */
.audio-btn {
  position: absolute;
  top: max(1rem, calc(env(safe-area-inset-top) + 0.5rem));
  left: 1rem;
  background: var(--glass);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
  z-index: 20;
  -webkit-tap-highlight-color: transparent;
}
.audio-btn:active { opacity: 0.7; }

/* ── GPS badge ─────────────────────────────────────────────── */
.gps-badge {
  position: absolute;
  top: max(1rem, calc(env(safe-area-inset-top) + 0.5rem));
  right: 1rem;
  background: var(--glass);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  padding: 0.35rem 0.7rem;
  font-size: 0.68rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  z-index: 20;
  color: var(--text-2);
  letter-spacing: 0.02em;
}

.gps-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.gps-badge.active  { color: #32d74b; }
.gps-badge.error   { color: #ff453a; }
.gps-badge.acquiring { color: #888; }

.gps-badge.active .gps-dot {
  animation: blink 2s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.25; }
}

/* ── Run controls ──────────────────────────────────────────── */
.run-controls {
  position: absolute;
  bottom: 1.5rem;
  left: 0;
  right: 0;
  padding: 0 1.5rem;
  display: flex;
  gap: 0.75rem;
  z-index: 20;
  /* safe area inset for iPhone */
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
}

.ctrl-btn {
  flex: 1;
  padding: 1rem;
  border-radius: 16px;
  border: none;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: opacity 0.15s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}

.ctrl-btn:active { opacity: 0.75; transform: scale(0.97); }
.ctrl-btn:disabled { opacity: 0.45; cursor: default; }

.ctrl-btn.primary   { background: var(--accent); color: var(--accent-text); font-family: 'Bebas Neue', sans-serif; font-size: 1.15rem; letter-spacing: 0.1em; }
.ctrl-btn.secondary { background: var(--bg-elevated); color: var(--text); }
.ctrl-btn.danger    { background: #ff453a; color: #fff; }

/* ── Post-run summary sheet ────────────────────────────────── */
.summary-sheet {
  position: absolute;
  inset: 0;
  background: var(--sheet);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1.5rem;
  gap: 1.75rem;
  z-index: 40;
  overflow-y: auto;
}

.summary-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--divider);
}

/* ── Run name input ─────────────────────────────────────────── */
.name-section { width: 100%; }

.run-name-input {
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.7rem 1rem;
  color: var(--text);
  font-size: 1rem;
  font-weight: 600;
  outline: none;
  transition: border-color 0.15s;
}

.run-name-input:focus { border-color: var(--accent); }
.run-name-input::placeholder { color: var(--text-3); font-weight: 400; }

/* ── Effort rating ──────────────────────────────────────────── */
.effort-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.effort-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}

.effort-row {
  display: flex;
  gap: 0.5rem;
}

.effort-btn {
  flex: 1;
  background: var(--bg-elevated);
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 0.6rem 0.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.effort-btn.selected {
  border-color: var(--accent);
  background: var(--accent-tint);
}

.effort-emoji { font-size: 1.3rem; }

.effort-name {
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.effort-btn.selected .effort-name { color: var(--accent); }

.summary-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.summary-stats {
  display: flex;
  gap: 2rem;
}

.s-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.s-val {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2.2rem;
  letter-spacing: 0.04em;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.s-lbl {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.5rem;
  font-weight: 700;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.summary-actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}

.ai-card {
  width: 100%;
  background: var(--bg-card);
  border-radius: 14px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.ai-chip {
  display: inline-block;
  align-self: flex-start;
  background: var(--accent-tint);
  color: var(--accent);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
}

.ai-text {
  margin: 0;
  font-size: 0.88rem;
  color: var(--text);
  line-height: 1.6;
}

.ai-error {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-2);
}

/* Loading dots */
.ai-loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-2);
  font-size: 0.82rem;
}

.ai-dots {
  display: flex;
  gap: 4px;
}

.ai-dots span {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: dot-bounce 1.2s ease-in-out infinite;
}

.ai-dots span:nth-child(2) { animation-delay: 0.2s; }
.ai-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40%            { transform: scale(1);   opacity: 1;   }
}

/* ── Mile split toast ──────────────────────────────────────── */
.split-toast {
  position: absolute;
  bottom: 7rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(245, 166, 35, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 14px;
  padding: 0.6rem 1.2rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 30;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}

.split-toast-mile {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent-text);
}

.split-toast-pace {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(0,0,0,0.65);
  font-variant-numeric: tabular-nums;
}

/* ── Splits list (in summary sheet) ────────────────────────── */
.splits-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.splits-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.splits-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.split-row {
  display: flex;
  align-items: center;
  background: var(--bg-card);
  border-radius: 10px;
  padding: 0.55rem 0.9rem;
}

.split-num {
  font-size: 0.82rem;
  color: var(--text-2);
  flex: 1;
}

.split-pace {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1rem;
  letter-spacing: 0.04em;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.split-unit {
  font-size: 0.7rem;
  color: var(--text-3);
  margin-left: 0.25rem;
}

/* ── Transitions ───────────────────────────────────────────── */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}
.slide-down-enter-from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
.slide-down-leave-to   { opacity: 0; transform: translateX(-50%) translateY(-12px); }

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-up-enter-from { opacity: 0; transform: translateY(100%); }
.slide-up-leave-to   { opacity: 0; transform: translateY(100%); }

.split-fade-enter-active { transition: all 0.25s ease; }
.split-fade-leave-active { transition: all 0.4s ease; }
.split-fade-enter-from   { opacity: 0; transform: translateX(-50%) translateY(8px); }
.split-fade-leave-to     { opacity: 0; transform: translateX(-50%) translateY(-4px); }
</style>
