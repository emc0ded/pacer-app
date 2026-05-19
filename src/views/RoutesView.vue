<template>
  <div class="routes-view">

    <!-- ══════════════════════════════════════════════════════════
         LIST MODE
    ═══════════════════════════════════════════════════════════ -->
    <template v-if="mode === 'list'">
      <div class="view-header">
        <span class="wordmark">PACER</span>
        <h1 class="view-title">Routes</h1>
      </div>

      <!-- Empty state -->
      <div v-if="!authStore.isAuthenticated" class="empty-state">
        <span class="empty-icon">🗺️</span>
        <p class="empty-heading">Sign in to save routes</p>
        <p class="empty-sub">Plan your run in advance and follow it on the map.</p>
      </div>

      <div v-else-if="routeStore.routes.length === 0" class="empty-state">
        <span class="empty-icon">🗺️</span>
        <p class="empty-heading">No saved routes yet</p>
        <p class="empty-sub">Tap the button below to draw your first route.</p>
      </div>

      <!-- Route cards -->
      <div v-else class="routes-list">
        <div
          v-for="route in routeStore.routes"
          :key="route.id"
          class="route-card"
        >
          <!-- Preview + info row -->
          <div class="route-body">
            <RunMapPreview
              :coordinates="route.coordinates || []"
              :size="72"
            />
            <div class="route-info">
              <span class="route-name">{{ route.name }}</span>
              <span class="route-meta">
                {{ metersToMiles(route.distance) }} mi
                · {{ formatDate(route.createdAt) }}
              </span>
            </div>
          </div>

          <div class="route-actions">
            <button class="run-route-btn" @click="runRoute(route)">
              ▶ Run
            </button>
            <button
              class="delete-route-btn"
              :class="{ confirming: confirmingId === route.id }"
              @click="handleDeleteRoute(route.id)"
            >
              {{ confirmingId === route.id ? '✕ Sure?' : '🗑' }}
            </button>
          </div>
        </div>
      </div>

      <!-- New route button -->
      <button
        v-if="authStore.isAuthenticated"
        class="new-route-btn"
        @click="startBuilder"
      >
        + New Route
      </button>
    </template>

    <!-- ══════════════════════════════════════════════════════════
         BUILDER MODE — full-screen map
    ═══════════════════════════════════════════════════════════ -->
    <template v-else>

      <!-- Map -->
      <MapboxMap
        ref="mapRef"
        :center="builderCenter"
        :zoom="15"
        class="builder-map"
        @mapLoaded="onBuilderMapLoaded"
      />

      <!-- Top bar: back + title + distance -->
      <div class="builder-top">
        <button class="builder-back" @click="discardBuilder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
               width="20" height="20">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="builder-title-block">
          <span class="builder-label">New Route</span>
          <span class="builder-distance">
            <template v-if="waypoints.length === 0">Tap map to add points</template>
            <template v-else-if="snapLoading">Snapping to roads…</template>
            <template v-else>{{ metersToMiles(routeDistance) }} mi</template>
          </span>
        </div>
        <button
          class="builder-undo"
          :disabled="waypoints.length === 0 || snapLoading"
          @click="undoWaypoint"
        >
          Undo
        </button>
      </div>

      <!-- Tap hint (disappears after first tap) -->
      <Transition name="fade">
        <div v-if="waypoints.length === 0" class="tap-hint">
          👆 Tap anywhere on the map to place waypoints
        </div>
      </Transition>

      <!-- Bottom controls: name input + save/discard -->
      <div class="builder-bottom">
        <input
          v-model="routeName"
          class="route-name-input"
          placeholder="Route name…"
          maxlength="60"
        />
        <div class="builder-btns">
          <button class="ctrl-btn secondary" @click="discardBuilder">Discard</button>
          <button
            class="ctrl-btn primary"
            :disabled="waypoints.length < 2 || saving || snapLoading"
            @click="saveRoute"
          >
            {{ saving ? 'Saving…' : 'Save Route' }}
          </button>
        </div>
      </div>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import mapboxgl from 'mapbox-gl'
import MapboxMap from '@/components/MapboxMap.vue'
import RunMapPreview from '@/components/RunMapPreview.vue'
import { useRouteStore } from '@/stores/route'
import { useAuthStore } from '@/stores/auth'

const router     = useRouter()
const routeStore = useRouteStore()
const authStore  = useAuthStore()

// ── View mode ──────────────────────────────────────────────────
const mode = ref('list') // 'list' | 'builder'

// ── Delete confirm ─────────────────────────────────────────────
const confirmingId = ref(null)
let confirmTimer   = null

function handleDeleteRoute(id) {
  if (confirmingId.value === id) {
    clearTimeout(confirmTimer)
    routeStore.removeRoute(authStore.uid, id)
    confirmingId.value = null
  } else {
    confirmingId.value = id
    confirmTimer = setTimeout(() => { confirmingId.value = null }, 3000)
  }
}

// ── Run a saved route ──────────────────────────────────────────
function runRoute(route) {
  routeStore.selectRoute(route)
  router.push('/run')
}

// ── Builder state ──────────────────────────────────────────────
const builderCenter = ref([-98.5795, 39.8283]) // US center fallback
const mapRef        = ref(null)
let   builderMap    = null
const waypoints     = ref([])  // raw tapped coords [[lng,lat], ...]
const segments      = ref([])  // [{ coords: [[lng,lat],...], distance: number }]
let   markers       = []       // mapboxgl.Marker instances
const routeName     = ref('')
const saving        = ref(false)
const snapLoading   = ref(false)

// Sum of all snapped segment distances (metres)
const routeDistance = computed(() =>
  segments.value.reduce((sum, s) => sum + s.distance, 0),
)

// Full road-snapped coordinate list for drawing + saving
const snappedCoords = computed(() => {
  if (segments.value.length === 0) return []
  const all = []
  segments.value.forEach((seg, i) => {
    // Skip the duplicate shared endpoint on all segments after the first
    all.push(...(i === 0 ? seg.coords : seg.coords.slice(1)))
  })
  return all
})

function startBuilder() {
  mode.value = 'builder'
  waypoints.value = []
  routeName.value = ''
  // Try to center on user's location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        builderCenter.value = [pos.coords.longitude, pos.coords.latitude]
        builderMap?.flyTo({ center: builderCenter.value, zoom: 15, duration: 800 })
      },
      () => {}, // silent fail — stay on fallback center
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }
}

function onBuilderMapLoaded(map) {
  builderMap = map
  // Fly to user location if it arrived before map loaded
  if (builderCenter.value[0] !== -98.5795) {
    map.flyTo({ center: builderCenter.value, zoom: 15 })
  }
  // Attach tap/click handler
  map.on('click', handleMapClick)
  // Change cursor to crosshair to hint interactivity
  map.getCanvas().style.cursor = 'crosshair'
}

async function handleMapClick(e) {
  if (snapLoading.value) return // ignore taps while snapping

  const coord = [e.lngLat.lng, e.lngLat.lat]

  // Drop a marker immediately so the tap feels instant
  const isFirst = waypoints.value.length === 0
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  const el = document.createElement('div')
  el.style.cssText = `
    width: 12px; height: 12px; border-radius: 50%;
    background: ${isFirst ? '#32d74b' : accent};
    border: 2px solid var(--bg, #111);
    box-shadow: 0 0 6px rgba(0,0,0,0.5);
  `
  const marker = new mapboxgl.Marker({ element: el }).setLngLat(coord).addTo(builderMap)
  markers.push(marker)

  if (isFirst) {
    // First point — no segment yet, just record it
    waypoints.value.push(coord)
    return
  }

  // Snap the new segment to roads
  snapLoading.value = true
  const from = waypoints.value[waypoints.value.length - 1]
  try {
    const seg = await getDirections(from, coord)
    segments.value.push(seg)
  } catch {
    // Fallback: straight line with haversine distance
    segments.value.push({ coords: [from, coord], distance: haversine(from, coord) })
  } finally {
    waypoints.value.push(coord)
    snapLoading.value = false
    updateBuilderRoute()
  }
}

// ── Mapbox Directions API ──────────────────────────────────────
async function getDirections(from, to) {
  const token   = import.meta.env.VITE_MAPBOX_TOKEN
  const coords  = `${from[0]},${from[1]};${to[0]},${to[1]}`
  const url     = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?geometries=geojson&overview=full&access_token=${token}`
  const res     = await fetch(url)
  if (!res.ok) throw new Error(`Directions ${res.status}`)
  const data    = await res.json()
  if (!data.routes?.length) throw new Error('No route found')
  return {
    coords:   data.routes[0].geometry.coordinates,
    distance: data.routes[0].distance,
  }
}

function undoWaypoint() {
  if (waypoints.value.length === 0) return
  waypoints.value.pop()
  // Also pop the segment that led to this point (if any)
  if (segments.value.length > 0) segments.value.pop()
  const last = markers.pop()
  last?.remove()
  updateBuilderRoute()
}

function updateBuilderRoute() {
  if (!builderMap) return
  const coords = snappedCoords.value

  const geojson = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords.length >= 2 ? coords : [] },
  }

  if (builderMap.getSource('builder-route')) {
    builderMap.getSource('builder-route').setData(geojson)
  } else if (coords.length >= 2) {
    builderMap.addSource('builder-route', { type: 'geojson', data: geojson })
    builderMap.addLayer({
      id: 'builder-route',
      type: 'line',
      source: 'builder-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#E8F400',
        'line-width': 3,
        'line-opacity': 0.9,
      },
    })
  }
}

async function saveRoute() {
  if (waypoints.value.length < 2 || saving.value) return
  saving.value = true
  try {
    // Firestore doesn't support nested arrays — store as [{lng, lat}] objects
    const coordObjects = snappedCoords.value.map(([lng, lat]) => ({ lng, lat }))
    await routeStore.addRoute(authStore.uid, {
      name:        routeName.value.trim() || `Route ${new Date().toLocaleDateString()}`,
      coordinates: coordObjects,
      distance:    routeDistance.value,
    })
    cleanupBuilder()
    mode.value = 'list'
  } catch (err) {
    console.error('[routes] save error:', err)
  } finally {
    saving.value = false
  }
}

function discardBuilder() {
  cleanupBuilder()
  mode.value = 'list'
}

function cleanupBuilder() {
  markers.forEach((m) => m.remove())
  markers      = []
  waypoints.value = []
  segments.value  = []
  builderMap   = null
  snapLoading.value = false
}

// ── Helpers ────────────────────────────────────────────────────
function metersToMiles(m) {
  return (m / 1609.344).toFixed(2)
}

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function haversine([lng1, lat1], [lng2, lat2]) {
  const R    = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

onUnmounted(() => {
  clearTimeout(confirmTimer)
  cleanupBuilder()
})
</script>

<style scoped>
.routes-view {
  flex: 1;
  overflow-y: auto;
  padding: calc(env(safe-area-inset-top) + 1.5rem) 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  background: var(--bg);
  position: relative;
}

/* ── Header ─────────────────────────────────────────────────── */
.view-header { display: flex; flex-direction: column; gap: 0.25rem; }
.wordmark    { font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem; letter-spacing: 0.12em; color: var(--accent); }
.view-title  { margin: 0; font-family: 'Bebas Neue', sans-serif; font-size: 2.2rem; letter-spacing: 0.04em; color: var(--text); }

/* ── Empty state ────────────────────────────────────────────── */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  text-align: center;
  padding: 3rem 1rem;
}
.empty-icon    { font-size: 2.8rem; }
.empty-heading { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text); }
.empty-sub     { margin: 0; font-size: 0.82rem; color: var(--text-2); line-height: 1.5; max-width: 240px; }

/* ── Route cards ─────────────────────────────────────────────── */
.routes-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.route-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.route-body {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.route-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.route-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.route-meta {
  font-size: 0.75rem;
  color: var(--text-2);
}

.route-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.run-route-btn {
  background: var(--accent);
  color: var(--accent-text);
  border: none;
  border-radius: 10px;
  padding: 0.5rem 0.9rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.run-route-btn:active { opacity: 0.75; }

.delete-route-btn {
  background: var(--bg-elevated);
  color: #ff453a;
  border: none;
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.delete-route-btn.confirming {
  background: #ff453a;
  color: #fff;
  font-size: 0.75rem;
}

/* ── New Route button ────────────────────────────────────────── */
.new-route-btn {
  width: 100%;
  padding: 1rem;
  background: var(--accent);
  color: var(--accent-text);
  border: none;
  border-radius: 10px;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.25rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  margin-top: auto;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s;
}

.new-route-btn:active { opacity: 0.8; }

/* ══════════════════════════════════════════════════════════════
   BUILDER MODE
══════════════════════════════════════════════════════════════ */

/* In builder mode we need the view to be full-screen + fixed */
.routes-view:has(.builder-map) {
  padding: 0;
  overflow: hidden;
}

.builder-map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Top bar */
.builder-top {
  position: absolute;
  top: max(1rem, calc(env(safe-area-inset-top) + 0.5rem));
  left: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 20;
}

.builder-back {
  background: var(--glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text);
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.builder-title-block {
  flex: 1;
  background: var(--glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.5rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.builder-label {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.builder-distance {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.1rem;
  letter-spacing: 0.04em;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.builder-undo {
  background: var(--glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.55rem 0.9rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.builder-undo:disabled { opacity: 0.35; }

/* Tap hint */
.tap-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.75rem 1.1rem;
  font-size: 0.85rem;
  color: var(--text-2);
  text-align: center;
  z-index: 20;
  pointer-events: none;
  white-space: nowrap;
}

/* Bottom controls */
.builder-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1rem 1.25rem;
  padding-bottom: max(1.25rem, calc(env(safe-area-inset-bottom) + 1rem));
  background: var(--glass-strong);
  backdrop-filter: blur(20px);
  border-top: 1px solid var(--border-sub);
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 20;
}

.route-name-input {
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.65rem 0.85rem;
  color: var(--text);
  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box;
}

.route-name-input:focus {
  border-color: var(--accent);
}

.route-name-input::placeholder { color: var(--text-3); }

.builder-btns {
  display: flex;
  gap: 0.75rem;
}

.ctrl-btn {
  flex: 1;
  padding: 0.9rem;
  border-radius: 14px;
  border: none;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s;
}

.ctrl-btn:active   { opacity: 0.75; }
.ctrl-btn:disabled { opacity: 0.4; cursor: default; }
.ctrl-btn.primary   { background: var(--accent); color: var(--accent-text); font-family: 'Bebas Neue', sans-serif; font-size: 1.1rem; letter-spacing: 0.1em; }
.ctrl-btn.secondary { background: var(--bg-elevated); color: var(--text); }

/* ── Transitions ─────────────────────────────────────────────── */
.fade-enter-active { transition: opacity 0.3s ease; }
.fade-leave-active { transition: opacity 0.5s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
