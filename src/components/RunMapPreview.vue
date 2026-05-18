<template>
  <div class="map-preview" :style="{ width: size + 'px', height: size + 'px' }">
    <svg
      v-if="points.length >= 2"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="xMidYMid meet"
      class="preview-svg"
    >
      <!-- Subtle grid lines -->
      <line x1="0" :y1="H/2" :x2="W" :y2="H/2" stroke="var(--border-sub,rgba(255,255,255,0.06))" stroke-width="0.5"/>
      <line :x1="W/2" y1="0" :x2="W/2" :y2="H" stroke="var(--border-sub,rgba(255,255,255,0.06))" stroke-width="0.5"/>

      <!-- Route glow (amber, wide + blurred) -->
      <polyline
        :points="svgPoints"
        fill="none"
        stroke="#f5a623"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.18"
      />

      <!-- Route line -->
      <polyline
        :points="svgPoints"
        fill="none"
        stroke="#f5a623"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.9"
      />

      <!-- Start dot (green) -->
      <circle
        :cx="points[0][0]"
        :cy="points[0][1]"
        r="4"
        fill="#30d158"
        stroke="var(--bg-card,#1c1c1e)"
        stroke-width="1.5"
      />

      <!-- End dot (amber) -->
      <circle
        :cx="points[points.length - 1][0]"
        :cy="points[points.length - 1][1]"
        r="4"
        fill="#f5a623"
        stroke="var(--bg-card,#1c1c1e)"
        stroke-width="1.5"
      />
    </svg>

    <!-- Fallback for no GPS data -->
    <div v-else class="no-route">
      <span>—</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  /**
   * Either [[lng, lat], ...] (from runs)
   * or [{ lng, lat }, ...] (from routes)
   */
  coordinates: {
    type: Array,
    default: () => [],
  },
  size: {
    type: Number,
    default: 72,
  },
})

const W = 100
const H = 100
const PAD = 14 // padding so dots don't clip

/**
 * Normalise raw coordinates into SVG space.
 * Input can be either [[lng, lat]] or [{lng, lat}].
 * Returns [[svgX, svgY], ...] clamped to the viewBox with padding.
 */
const points = computed(() => {
  const raw = props.coordinates
  if (!raw || raw.length < 2) return []

  // Normalise to { lng, lat }
  const coords = raw.map((c) =>
    Array.isArray(c) ? { lng: c[0], lat: c[1] } : c,
  )

  // Bounding box
  let minLng = Infinity, maxLng = -Infinity
  let minLat = Infinity, maxLat = -Infinity
  for (const { lng, lat } of coords) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  const dLng = maxLng - minLng || 1e-5
  const dLat = maxLat - minLat || 1e-5

  // Preserve aspect ratio: scale uniformly so the route fits without distortion
  const drawW = W - PAD * 2
  const drawH = H - PAD * 2
  const scale = Math.min(drawW / dLng, drawH / dLat)

  // Centre the scaled route in the viewBox
  const routeW = dLng * scale
  const routeH = dLat * scale
  const offX = PAD + (drawW - routeW) / 2
  const offY = PAD + (drawH - routeH) / 2

  return coords.map(({ lng, lat }) => [
    offX + (lng - minLng) * scale,
    // Flip Y — SVG Y grows downward, lat grows upward
    offY + (maxLat - lat) * scale,
  ])
})

const svgPoints = computed(() =>
  points.value.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
)
</script>

<style scoped>
.map-preview {
  flex-shrink: 0;
  background: var(--bg-elevated, #2c2c2e);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.no-route {
  color: var(--text-4, #555);
  font-size: 1.1rem;
}
</style>
