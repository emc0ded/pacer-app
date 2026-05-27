<template>
  <div class="history-view">
    <div class="view-header">
      <span class="wordmark">PACER</span>
      <h1 class="view-title">Run History</h1>
    </div>

    <!-- Sign-in prompt -->
    <div v-if="!authStore.isAuthenticated" class="empty-state">
      <div class="empty-icon">🔒</div>
      <p>Sign in to see your run history.</p>
      <p class="empty-sub">Head to the Profile tab to sign in with Google.</p>
    </div>

    <!-- Loading -->
    <div v-else-if="runStore.loadingRuns" class="empty-state">
      <div class="empty-icon">⏳</div>
      <p>Loading runs…</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="runStore.runs.length === 0" class="empty-state">
      <div class="empty-icon">📋</div>
      <p>No runs saved yet.</p>
      <p class="empty-sub">Finish a run and tap "Save Run" to see it here.</p>
    </div>

    <!-- Run list -->
    <div v-else class="run-list">
      <div
        v-for="run in runStore.runs"
        :key="run.id"
        class="run-card"
        :style="run.effort ? `--feel-color: ${feelColor(run.effort)}` : ''"
        :class="{ 'has-feel': !!run.effort }"
        @click="$router.push(`/history/${run.id}`)"
      >
        <!-- Card body: map preview + text content -->
        <div class="run-body">
          <!-- SVG route thumbnail -->
          <RunMapPreview
            :coordinates="run.coordinates || []"
            :size="76"
            @click.stop="$router.push(`/history/${run.id}`)"
          />

          <!-- Right: name, date, stats -->
          <div class="run-content">
            <!-- Name row -->
            <div class="run-top">
              <div class="run-name-row">
                <template v-if="editingId === run.id">
                  <input
                    ref="renameInput"
                    v-model="editingName"
                    class="rename-input"
                    maxlength="60"
                    @keydown.enter="confirmRename(run.id)"
                    @keydown.escape="cancelRename"
                    @blur="confirmRename(run.id)"
                    @click.stop
                  />
                </template>
                <template v-else>
                  <span class="run-name" @click.stop="startRename(run)">
                    {{ run.name || 'Unnamed Run' }}
                    <span class="edit-hint">✎</span>
                  </span>
                </template>
              </div>
              <span class="run-date">{{ formatDate(run.date) }}</span>
            </div>

            <!-- Stats row -->
            <div class="run-bottom">
              <div class="run-stat">
                <span class="r-val">{{ (run.distance / 1609.344).toFixed(2) }}</span>
                <span class="r-lbl">mi</span>
              </div>
              <div class="run-stat">
                <span class="r-val">{{ formatDuration(run.duration) }}</span>
                <span class="r-lbl">time</span>
              </div>
              <div class="run-stat">
                <span class="r-val">{{ calcPace(run) }}</span>
                <span class="r-lbl">pace</span>
              </div>
              <div v-if="run.elevationGain" class="run-stat">
                <span class="r-val">{{ Math.round(run.elevationGain * 3.28084) }}</span>
                <span class="r-lbl">ft ↑</span>
              </div>

            </div>
          </div>
        </div>

        <!-- Splits accordion (full-width, below body) -->
        <div
          v-if="run.splits && run.splits.length > 0"
          class="splits-section"
        >
          <button
            class="splits-toggle"
            @click.stop="toggleSplits(run.id)"
          >
            <span>Splits</span>
            <span class="splits-count">{{ run.splits.length }} mi</span>
            <span class="splits-caret" :class="{ open: expandedSplits.has(run.id) }">›</span>
          </button>
          <div v-if="expandedSplits.has(run.id)" class="splits-grid">
            <div v-for="split in run.splits" :key="split.mile" class="split-chip">
              <span class="split-mi">Mi {{ split.mile }}</span>
              <span class="split-pace">{{ split.pace }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useRunStore } from '@/stores/run'
import { useAuthStore } from '@/stores/auth'
import RunMapPreview from '@/components/RunMapPreview.vue'

const runStore  = useRunStore()
const authStore = useAuthStore()

// ── Feel color for left border ─────────────────────────────────
const feelColors = { 1: '#4ade80', 2: '#a3e635', 3: '#facc15', 4: '#fb923c', 5: '#ef4444' }

function feelColor(value) {
  return feelColors[value] ?? 'transparent'
}

// ── Rename ─────────────────────────────────────────────────────
const editingId   = ref(null)
const editingName = ref('')
const renameInput = ref(null)

function startRename(run) {
  editingId.value   = run.id
  editingName.value = run.name || ''
  nextTick(() => renameInput.value?.focus())
}

async function confirmRename(runId) {
  if (!editingName.value.trim()) { cancelRename(); return }
  await runStore.renameRun(authStore.uid, runId, toTitleCase(editingName.value.trim()))
  editingId.value = null
}

function toTitleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

function cancelRename() {
  editingId.value = null
}

// ── Splits expand/collapse ─────────────────────────────────────
const expandedSplits = ref(new Set())

function toggleSplits(runId) {
  const next = new Set(expandedSplits.value)
  if (next.has(runId)) {
    next.delete(runId)
  } else {
    next.add(runId)
  }
  expandedSplits.value = next
}

// ── Formatters ─────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
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
.history-view {
  flex: 1;
  overflow-y: auto;
  padding: calc(env(safe-area-inset-top) + 1.5rem) 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: var(--bg);
}

.view-header { display: flex; flex-direction: column; gap: 0.25rem; }
.wordmark    { font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem; letter-spacing: 0.12em; color: var(--accent); }
.view-title  { margin: 0; font-family: 'Bebas Neue', sans-serif; font-size: 2.2rem; letter-spacing: 0.04em; color: var(--text); }

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  color: var(--text-3);
  text-align: center;
  padding: 3rem 0;
}
.empty-icon  { font-size: 2.5rem; margin-bottom: 0.5rem; }
.empty-state p { margin: 0; font-size: 0.95rem; }
.empty-sub   { font-size: 0.82rem !important; color: var(--text-4) !important; }

.run-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.run-card {
  background: var(--bg-card);
  border-radius: 14px;
  border-left: 3px solid transparent;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  cursor: pointer;
  transition: border-color 0.2s;
}

.run-card.has-feel {
  border-left-color: var(--feel-color);
}

/* Two-column body: thumbnail | content */
.run-body {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.run-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

/* Top row (name + date) */
.run-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.run-name-row { flex: 1; min-width: 0; }

.run-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  /* Prevent layout shift when edit hint appears */
}

.run-name:active { opacity: 0.7; }

.edit-hint {
  font-size: 0.75rem;
  color: var(--text-3);
  opacity: 0;
  transition: opacity 0.15s;
}

.run-name:hover .edit-hint,
.run-name:focus .edit-hint {
  opacity: 1;
}

/* On mobile, always show the hint so it's discoverable */
@media (hover: none) {
  .edit-hint { opacity: 1; }
}

.rename-input {
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
  outline: none;
}

.run-date { font-size: 0.75rem; color: var(--text-2); white-space: nowrap; flex-shrink: 0; }

/* Bottom row */
.run-bottom {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.85rem;
}

.run-stat   { display: flex; align-items: baseline; gap: 0.25rem; }
.r-val      { font-family: 'Bebas Neue', sans-serif; font-size: 1.2rem; letter-spacing: 0.04em; color: var(--accent); font-variant-numeric: tabular-nums; }
.r-lbl      { font-size: 0.68rem; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.04em; }

/* Feel rating row */
.feel-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-sub);
}

.feel-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.1em;
  white-space: nowrap;
  flex-shrink: 0;
}

.feel-dots {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.feel-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
  opacity: 0.45;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.feel-dot:active { transform: scale(0.9); }

.feel-dot.selected {
  opacity: 1;
  transform: scale(1.25);
  box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 4px currentColor;
}

/* Splits accordion */
.splits-section {
  border-top: 1px solid var(--border-sub);
  padding-top: 0.6rem;
}

.splits-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  -webkit-tap-highlight-color: transparent;
}

.splits-count {
  background: var(--bg-elevated);
  color: var(--text-2);
  font-size: 0.68rem;
  padding: 0.15rem 0.45rem;
  border-radius: 20px;
}

.splits-caret {
  margin-left: auto;
  font-size: 1rem;
  color: var(--text-3);
  transition: transform 0.2s;
  display: inline-block;
}

.splits-caret.open {
  transform: rotate(90deg);
}

.splits-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.split-chip {
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 0.4rem 0.65rem;
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.split-mi {
  font-size: 0.7rem;
  color: var(--text-2);
}

.split-pace {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1rem;
  letter-spacing: 0.04em;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

</style>
