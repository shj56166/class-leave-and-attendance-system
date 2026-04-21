import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

const ROUTE_TRANSITIONS_ENABLED = true;

const transitionState = ref({
  navigationType: 'initial',
  direction: 'none',
  motionTier: 'full',
  from: null,
  to: null,
  epoch: 0
});

let isTrackingInstalled = false;
let previousHistoryPosition = null;
let motionMediaQuery = null;

function readHistoryState() {
  if (typeof window === 'undefined' || !window.history) {
    return null;
  }

  return window.history.state || null;
}

function readHistoryPosition() {
  const historyState = readHistoryState();
  return typeof historyState?.position === 'number'
    ? historyState.position
    : null;
}

function detectIosVersion(userAgent) {
  const match = userAgent.match(/OS (\d+)[._](\d+)?/);
  return match ? Number(match[1]) : null;
}

function detectAndroidVersion(userAgent) {
  const match = userAgent.match(/Android\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function detectMotionTier() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'full';
  }

  const prefersReducedMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return 'none';
  }

  const cpuCores = Number(navigator.hardwareConcurrency || 0);
  const deviceMemory = Number(navigator.deviceMemory || 0);
  const userAgent = navigator.userAgent || '';
  const iosVersion = /(iPhone|iPad|iPod)/i.test(userAgent)
    ? detectIosVersion(userAgent)
    : null;
  const androidVersion = /Android/i.test(userAgent)
    ? detectAndroidVersion(userAgent)
    : null;

  if (
    (cpuCores && cpuCores <= 2)
    || (deviceMemory && deviceMemory <= 1)
  ) {
    return 'none';
  }

  if (
    (androidVersion && androidVersion <= 9)
    || (iosVersion && iosVersion <= 12)
    || (cpuCores && cpuCores <= 4)
    || (deviceMemory && deviceMemory <= 3)
  ) {
    return 'lite';
  }

  return 'full';
}

function syncMotionTier() {
  const nextTier = detectMotionTier();

  if (transitionState.value.motionTier === nextTier) {
    return;
  }

  transitionState.value = {
    ...transitionState.value,
    motionTier: nextTier
  };
}

function createRouteSnapshot(route) {
  if (!route || !Array.isArray(route.matched)) {
    return null;
  }

  const matched = route.matched;
  const rootRecord = matched[0];
  const leafRecord = matched[matched.length - 1];

  return {
    fullPath: route.fullPath || route.path || '',
    redirected: Boolean(route.redirectedFrom),
    rootPath: rootRecord?.path || route.path || '',
    rootKind: rootRecord?.meta?.transitionKind || 'stack',
    rootDisabled: Boolean(rootRecord?.meta?.transitionDisabled),
    leafPath: leafRecord?.path || route.path || '',
    leafKind: leafRecord?.meta?.transitionKind || route.meta?.transitionKind || 'stack',
    leafDisabled: Boolean(leafRecord?.meta?.transitionDisabled)
  };
}

function resolveNavigationState(to, from, nextHistoryPosition) {
  if (!from?.matched?.length) {
    return {
      navigationType: 'initial',
      direction: 'none'
    };
  }

  if (to?.redirectedFrom) {
    return {
      navigationType: 'redirect',
      direction: 'none'
    };
  }

  if (
    typeof nextHistoryPosition === 'number'
    && typeof previousHistoryPosition === 'number'
  ) {
    if (nextHistoryPosition > previousHistoryPosition) {
      return {
        navigationType: 'push',
        direction: 'forward'
      };
    }

    if (nextHistoryPosition < previousHistoryPosition) {
      return {
        navigationType: 'pop',
        direction: 'back'
      };
    }
  }

  return {
    navigationType: 'replace',
    direction: 'none'
  };
}

function getScopeSnapshot(route, scope) {
  const snapshot = createRouteSnapshot(route);
  if (!snapshot) {
    return null;
  }

  if (scope === 'tab') {
    return {
      kind: snapshot.leafKind,
      disabled: snapshot.leafDisabled
    };
  }

  return {
    kind: snapshot.rootKind,
    disabled: snapshot.rootDisabled
  };
}

function getRootViewKey(route) {
  return route.matched?.[0]?.path || route.path || route.fullPath || 'root';
}

function resolveTransitionName(scope, route) {
  if (!ROUTE_TRANSITIONS_ENABLED) {
    return 'route-none';
  }

  const currentScope = getScopeSnapshot(route, scope);
  const fromScope = scope === 'tab'
    ? transitionState.value.from && {
      disabled: transitionState.value.from.leafDisabled
    }
    : transitionState.value.from && {
      disabled: transitionState.value.from.rootDisabled
    };
  const toScope = scope === 'tab'
    ? transitionState.value.to && {
      disabled: transitionState.value.to.leafDisabled
    }
    : transitionState.value.to && {
      disabled: transitionState.value.to.rootDisabled
    };

  if (!currentScope) {
    return 'route-none';
  }

  if (
    currentScope.disabled
    || fromScope?.disabled
    || toScope?.disabled
    || transitionState.value.motionTier === 'none'
    || transitionState.value.navigationType === 'initial'
    || transitionState.value.navigationType === 'redirect'
    || transitionState.value.navigationType === 'replace'
  ) {
    return 'route-none';
  }

  return 'route-fade-soft';
}

export function installRouteTransitionTracking(router) {
  if (isTrackingInstalled) {
    return;
  }

  isTrackingInstalled = true;
  previousHistoryPosition = readHistoryPosition();
  syncMotionTier();

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionPreferenceChange = () => {
      syncMotionTier();
    };

    if (typeof motionMediaQuery.addEventListener === 'function') {
      motionMediaQuery.addEventListener('change', handleMotionPreferenceChange);
    } else if (typeof motionMediaQuery.addListener === 'function') {
      motionMediaQuery.addListener(handleMotionPreferenceChange);
    }
  }

  router.afterEach((to, from, failure) => {
    if (failure) {
      return;
    }

    const nextHistoryPosition = readHistoryPosition();
    const navigationState = resolveNavigationState(to, from, nextHistoryPosition);

    transitionState.value = {
      ...transitionState.value,
      ...navigationState,
      from: createRouteSnapshot(from),
      to: createRouteSnapshot(to),
      motionTier: detectMotionTier(),
      epoch: transitionState.value.epoch + 1
    };

    previousHistoryPosition = typeof nextHistoryPosition === 'number'
      ? nextHistoryPosition
      : previousHistoryPosition;
  });
}

export function useRouteTransition(scope = 'root') {
  const route = useRoute();

  return {
    motionTier: computed(() => transitionState.value.motionTier),
    transitionName: computed(() => resolveTransitionName(scope, route)),
    viewKey: computed(() => (
      scope === 'root'
        ? getRootViewKey(route)
        : (route.fullPath || route.path || 'tab')
    ))
  };
}
