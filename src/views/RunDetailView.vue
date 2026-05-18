<template>
  <div class="detail-view">
    <!-- Back button -->
    <button class="back-btn" @click="$router.back()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>

    <!-- Not found -->
    <div v-if="!run" class="empty-state">
      <p>Run not found.</p>
      <button class="ctrl-btn secondary" @click="$router.back()">Go Back</button>
    </div>

    <template v-else>
      <!-- ── Map showing the route ──────────────────────────── -->
      <div class="map-wrapper">
        <!-- Only render once run data (and coordinates) are available -->
        <MapboxMap
          v-if="runCenter"
          ref="mapRef"
          :center="runCenter"
          :zoom="14"
          class="detail-map"
          @mapLoaded="onMapLoaded"
        />
        <div v-else class="map-loading">
          <span>Loading map…</span>
        </div>
      </div>

      <!-- ── Scrollable info panel ─────────────────────────── -->
      <div class="info-panel">
        <div class="panel-handle" />

        <!-- Name + date -->
        <div class="run-header">
          <div class="run-name-row">
            <template v-if="editingName">
              <input
                ref="nameInput"
                v-model="nameValue"
                class="name-input"
                maxlength="60"
                @keydown.enter="saveName"
                @keydown.escape="editingName = false"
                @blur="saveName"
              />
            </template>
            <template v-else>
              <h1 class="run-name" @click="startEditName">
                {{ run.name || 'Unnamed Run' }}
                <span class="edit-hint">✎</span>
              </h1>
            </template>
          </div>
          <span class="run-date">{{ formatDate(run.date) }}</span>
        </div>

        <!-- Stats grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-val">{{ (run.distance / 1609.344).toFixed(2) }}</span>
            <span class="stat-lbl">mi</span>
          </div>
          <div class="stat-card">
            <span class="stat-val">{{ formatDuration(run.duration) }}</span>
            <span class="stat-lbl">time</span>
          </div>
          <div class="stat-card">
            <span class="stat-val">{{ calcPace(run) }}</span>
            <span class="stat-lbl">/ mi</span>
          </div>
          <div class="stat-card" v-if="run.effort">
            <span class="stat-val">{{ effortLabel(run.effort) }}</span>
            <span class="stat-lbl">effort</span>
          </div>
        </div>

        <!-- Mile splits -->
        <div v-if="run.splits && run.splits.length > 0" class="splits-card">
          <span class="splits-title">Splits</span>
          <div class="splits-list">
            <div v-for="split in run.splits" :key="split.mile" class="split-row">
              <span class="split-num">Mile {{ split.mile }}</span>
              <span class="split-pace">{{ split.pace }}</span>
              <span class="split-unit">/mi</span>
            </div>
          </div>
        </div>

        <!-- AI Coaching -->
        <div v-if="run.coaching" class="ai-card">
          <span class="ai-chip">✦ AI Coaching</span>
          <p class="ai-text">{{ run.coaching }}</p>
        </div>

        <!-- Delete -->
        <button
          class="delete-btn"
          :class="{ confirming: confirmDelete }"
          @click="handleDelete"
        >
          {{ confirmDelete ? 'Tap again to delete this run' : 'Delete Run' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import mapboxgl from 'mapbox-gl'
import MapboxMap from '@/components/MapboxMap.vue'
import { useRunStore } from '@/stores/run'
import { useAuthStore } from '@/stores/auth'

const route    = useRoute()
const router   = useRouter()
const runStore = useRunStore()
const authStore= useAuthStore()

// ── Find the run ───────────────────────────────────────────────
const run = computed(() =>
  runStore.runs.find((r) => r.id === route.params.id) ?? null,
)

// ── Map ────────────────────────────────────────────────────────
const mapRef = ref(null)
let mapInstance = null

// Only computed once run has coordinates — gates the v-if on MapboxMap
// so the map never mounts until we have a real center to give it
const runCenter = computed(() => {
  const coords = run.value?.coordinates
  if (!coords || coords.length < 1) return null
  const mid = coords[Math.floor(coords.length / 2)]
  return Array.isArray(mid) ? { lng: mid[0], lat: mid[1] } : mid
})

function onMapLoaded(map) {
  mapInstance = map
  const coords = run.value?.coordinates
  if (coords?.length >= 1) drawRoute(coords)
}

function drawRoute(rawCoords) {
  if (!mapInstance || rawCoords.length < 1) return

  // Normalise to { lng, lat } objects (handles both legacy [lng,lat] arrays and new objects)
  const coords = rawCoords.map((c) =>
    Array.isArray(c) ? { lng: c[0], lat: c[1] } : c,
  )

  if (coords.length >= 2) {
    // GeoJSON requires [lng, lat] arrays
    const lngLats = coords.map(({ lng, lat }) => [lng, lat])
    mapInstance.addSource('route', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: lngLats } },
    })
    mapInstance.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#f5a623',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 3, 18, 6],
      },
    })
    addMarker(coords[0], '#32d74b')
    addMarker(coords[coords.length - 1], '#ff453a')
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(coords[0], coords[0]),
    )
    mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 800 })
  } else {
    // Stationary run — just drop a marker at the single point
    addMarker(coords[0], '#f5a623')
    mapInstance.flyTo({ center: coords[0], zoom: 15, duration: 800 })
  }
}

function addMarker(coord, color) {
  const el = document.createElement('div')
  el.style.cssText = `
    width:14px; height:14px; border-radius:50%;
    background:${color}; border:2px solid #fff;
    box-shadow:0 0 6px rgba(0,0,0,0.4);
  `
  new mapboxgl.Marker({ element: el }).setLngLat(coord).addTo(mapInstance)
}

// ── Rename ─────────────────────────────────────────────────────
const editingName = ref(false)
const nameValue   = ref('')
const nameInput   = ref(null)

function startEditName() {
  nameValue.value   = run.value?.name || ''
  editingName.value = true
  nextTick(() => nameInput.value?.focus())
}

async function saveName() {
  if (nameValue.value.trim() && run.value) {
    await runStore.renameRun(authStore.uid, run.value.id, toTitleCase(nameValue.value.trim()))
  }
  editingName.value = false
}

function toTitleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Delete ─────────────────────────────────────────────────────
const confirmDelete = ref(false)
let deleteTimer = null

function handleDelete() {
  if (confirmDelete.value) {
    clearTimeout(deleteTimer)
    runStore.removeRun(authStore.uid, run.value.id)
    router.replace('/history')
  } else {
    confirmDelete.value = true
    deleteTimer = setTimeout(() => { confirmDelete.value = false }, 3000)
  }
}

onUnmounted(() => clearTimeout(deleteTimer))

// ── Helpers ────────────────────────────────────────────────────
const effortEmojis = { 1:'😴', 2:'🙂', 3:'💪', 4:'🔥', 5:'💀' }
const effortLabels = { 1:'Easy', 2:'Moderate', 3:'Hard', 4:'Very Hard', 5:'Max' }

function effortLabel(e) {
  return `${effortEmojis[e] || ''} ${effortLabels[e] || e}`
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatDuration(ms) {
  if (!ms) return '—'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m ${s % 60}s`
}

function calcPace(run) {
  const mi  = run.distance / 1609.344
  const min = run.duration / 60000
  if (mi < 0.01 || !min) return '--:--'
  const p  = min / mi
  const pm = Math.floor(p)
  const ps = Math.round((p - pm) * 60)
  return `${pm}:${String(ps).padStart(2,'0')}`
}
</script>

<style scoped>
.detail-view {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
}

/* Back button */
.back-btn {
  position: absolute;
  top: max(1rem, calc(env(safe-area-inset-top) + 0.5rem));
  left: 1rem;
  z-index: 30;
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
  -webkit-tap-highlight-color: transparent;
}

.back-btn:active { opacity: 0.7; }

/* Map */
.map-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
}

.detail-map {
  width: 100%;
  height: 100%;
}

.map-loading {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  color: var(--text-2);
  font-size: 0.9rem;
}

/* Info panel */
.info-panel {
  background: var(--bg);
  border-top: 1px solid var(--border-sub);
  border-radius: 20px 20px 0 0;
  padding: 0.75rem 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-height: 55vh;
  overflow-y: auto;
  /* Pull up over the map slightly */
  margin-top: -20px;
  position: relative;
  z-index: 10;
}

.panel-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--divider);
  align-self: center;
  margin-bottom: 0.25rem;
}

/* Run header */
.run-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.run-name {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.edit-hint {
  font-size: 0.8rem;
  color: var(--text-3);
}

@media (hover: none) { .edit-hint { opacity: 1; } }

.name-input {
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid #f5a623;
  border-radius: 8px;
  padding: 0.5rem 0.7rem;
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 700;
  outline: none;
}

.run-date {
  font-size: 0.8rem;
  color: var(--text-2);
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
  gap: 0.6rem;
}

.stat-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 0.85rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.stat-val {
  font-size: 1.1rem;
  font-weight: 700;
  color: #f5a623;
  font-variant-numeric: tabular-nums;
}

.stat-lbl {
  font-size: 0.62rem;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Splits card */
.splits-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.splits-title {
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
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}

.split-num {
  font-size: 0.82rem;
  color: var(--text-2);
  flex: 1;
}

.split-pace {
  font-size: 0.88rem;
  font-weight: 700;
  color: #f5a623;
  font-variant-numeric: tabular-nums;
}

.split-unit {
  font-size: 0.7rem;
  color: var(--text-3);
  margin-left: 0.25rem;
}

/* AI card */
.ai-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.ai-chip {
  display: inline-block;
  align-self: flex-start;
  background: rgba(245, 166, 35, 0.12);
  color: #f5a623;
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

/* Delete */
.delete-btn {
  width: 100%;
  padding: 0.9rem;
  background: var(--bg-elevated);
  color: #ff453a;
  border: none;
  border-radius: 14px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.delete-btn.confirming {
  background: #ff453a;
  color: #fff;
}

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-3);
}
</style>
