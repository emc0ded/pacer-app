<template>
  <div ref="mapContainer" class="map-container" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import mapboxgl from 'mapbox-gl'
import { useThemeStore } from '@/stores/theme'

// ── Props ──────────────────────────────────────────────────────
const props = defineProps({
  /** [lng, lat] — initial map center */
  center: {
    type: Array,
    default: () => [-122.4194, 37.7749], // SF fallback
  },
  zoom: {
    type: Number,
    default: 15,
  },
})

const emit = defineEmits([
  /** Emitted once the map has fully loaded — passes the mapboxgl.Map instance */
  'mapLoaded',
])

// ── Theme-aware map styles ─────────────────────────────────────
const themeStore = useThemeStore()

function styleForTheme(t) {
  return t === 'dark'
    ? 'mapbox://styles/mapbox/dark-v11'
    : 'mapbox://styles/mapbox/light-v11'
}

// ── Internal state ─────────────────────────────────────────────
const mapContainer = ref(null)
let map = null
let mapLoaded = false

// ── Lifecycle ──────────────────────────────────────────────────
onMounted(() => {
  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

  map = new mapboxgl.Map({
    container: mapContainer.value,
    style: styleForTheme(themeStore.theme),
    center: props.center,
    zoom: props.zoom,
    pitch: 0,
    attributionControl: false,
    maxTileCacheSize: 50,
  })

  // Compact attribution bottom-left so it doesn't clash with our stats overlay
  map.addControl(
    new mapboxgl.AttributionControl({ compact: true }),
    'bottom-left',
  )

  // Zoom controls bottom-right
  map.addControl(
    new mapboxgl.NavigationControl({ showCompass: false }),
    'bottom-right',
  )

  map.on('load', () => {
    mapLoaded = true
    emit('mapLoaded', map)
  })
})

onUnmounted(() => {
  map?.remove()
  map = null
  mapLoaded = false
})

// ── Swap style when theme changes ──────────────────────────────
watch(
  () => themeStore.theme,
  (t) => {
    if (!map || !mapLoaded) return
    map.setStyle(styleForTheme(t))
  },
)

// ── Expose raw map instance to parent via template ref ─────────
defineExpose({
  getMap: () => map,
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
}
</style>
