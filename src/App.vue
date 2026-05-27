<template>
  <div class="app-shell">
    <!-- Splash while Firebase resolves the persisted session -->
    <div v-if="authStore.loading" class="splash">
      <span class="splash-wordmark">PACER</span>
    </div>

    <template v-else>
      <RouterView class="route-view" />
      <!-- Bottom nav hidden during an active run for distraction-free UI -->
      <BottomNav v-if="!runStore.isRunning" />
    </template>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import { useAuthStore } from '@/stores/auth'
import { useRunStore } from '@/stores/run'
import { useRouteStore } from '@/stores/route'
import { useThemeStore } from '@/stores/theme'
import { useSettingsStore } from '@/stores/settings'
import { usePlanStore } from '@/stores/plan'
import WatchBridge from '@/plugins/watchbridge'

const authStore     = useAuthStore()
const runStore      = useRunStore()
const routeStore    = useRouteStore()
const settingsStore = useSettingsStore()
const planStore     = usePlanStore()
useThemeStore() // initialize immediately so data-theme is set before first render

// Resolve persisted Firebase session before showing any UI
onMounted(() => {
  authStore.init()

  // Save runs sent from Apple Watch to Firestore via existing addRun logic
  WatchBridge.addListener('watchRun', (run) => {
    const uid = authStore.uid
    if (!uid) return
    runStore.addRun(uid, {
      date:        run.date,
      distance:    run.distance,
      duration:    run.duration,
      coordinates: run.coordinates,
      name:        'Watch Run',
      source:      'appleWatch',
    })
  })
})

// Subscribe to Firestore runs + routes whenever the user signs in,
// and unsubscribe + clear when they sign out.
watch(
  () => authStore.uid,
  async (uid) => {
    if (uid) {
      runStore.subscribeToRuns(uid)
      routeStore.subscribeToRoutes(uid)
      settingsStore.loadSettings(uid)
      // Load training plan, then run the Monday adaptation check
      await planStore.loadPlan(uid)
      planStore.maybeAdapt(uid, runStore.runs)
    } else {
      runStore.unsubscribeRuns()
      routeStore.unsubscribeRoutes()
      planStore.clear()
    }
  },
  { immediate: true },
)
</script>

<style>
.app-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}

.route-view {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Splash screen ──────────────────────────────────────────── */
.splash {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}

.splash-wordmark {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2rem;
  letter-spacing: 0.28em;
  color: var(--accent);
  animation: pulse-opacity 1.2s ease-in-out infinite;
}

@keyframes pulse-opacity {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

/* Hide bottom nav while a sheet/modal is open */
body.sheet-open .bottom-nav {
  display: none;
}
</style>
