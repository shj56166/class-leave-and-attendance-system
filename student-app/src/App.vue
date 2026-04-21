<template>
  <div class="app-root">
    <div class="route-stage route-stage--root">
      <router-view v-slot="{ Component }">
        <transition :name="transitionName">
          <component
            :is="Component"
            :key="viewKey"
            class="route-scene route-scene--root"
            :data-route-motion-tier="motionTier"
          />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<script setup>
import { useRouteTransition } from './composables/useRouteTransition';

const { motionTier, transitionName, viewKey } = useRouteTransition('root');
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-root {
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: clip;
}
</style>
