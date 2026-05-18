<template>
  <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
    <RouterLink to="/" class="nav-item" active-class="active" exact>
      <span class="nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
          <polyline points="9 21 9 12 15 12 15 21"/>
        </svg>
      </span>
      <span class="nav-label">Home</span>
    </RouterLink>

    <RouterLink to="/routes" class="nav-item" active-class="active">
      <span class="nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="5" cy="19" r="2"/>
          <circle cx="19" cy="5" r="2"/>
          <path d="M5 17c0-5 3.5-7 7-7s7-2 7-7"/>
        </svg>
      </span>
      <span class="nav-label">Routes</span>
    </RouterLink>

    <RouterLink to="/run" class="nav-item run-item" active-class="active">
      <span class="nav-icon run-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="10,8 16,12 10,16" fill="#0f0f0f"/>
        </svg>
      </span>
      <span class="nav-label">Run</span>
    </RouterLink>

    <RouterLink to="/history" class="nav-item" active-class="active">
      <span class="nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </span>
      <span class="nav-label">History</span>
    </RouterLink>

    <RouterLink to="/profile" class="nav-item" active-class="active">
      <span class="nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </span>
      <span class="nav-label">Profile</span>
    </RouterLink>
  </nav>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.bottom-nav {
  display: flex;
  align-items: stretch;
  background: var(--glass-strong);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--border);
  /* Safe area inset for iPhone home indicator */
  padding-bottom: env(safe-area-inset-bottom, 0px);
  height: calc(64px + env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
  z-index: 100;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-decoration: none;
  color: var(--text-2);
  transition: color 0.15s;
  padding: 8px 0 4px;
  -webkit-tap-highlight-color: transparent;
}

.nav-item:active {
  opacity: 0.7;
}

.nav-item.active {
  color: #f5a623;
}

.nav-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon svg {
  width: 22px;
  height: 22px;
}

/* The Run button has a larger, accent-colored icon */
.run-item {
  color: #f5a623;
}

.run-item.active .run-icon svg circle {
  fill: #f5a623;
}

.nav-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
</style>
