import { AppLauncher } from '@capacitor/app-launcher';
import { isNativeAndroidRuntime } from '../config/serverRuntime';

export const DINGTALK_HOME_URL = 'dingtalk://dingtalkclient/';

const DINGTALK_ANDROID_PACKAGE = 'com.alibaba.android.rimet';
const LAUNCH_TIMEOUT_MS = 1400;

function launchViaAnchor(url) {
  if (typeof document === 'undefined') {
    return false;
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

function launchViaLocation(url) {
  if (typeof window === 'undefined') {
    return false;
  }

  window.location.assign(url);
  return true;
}

function launchViaBrowserScheme(url) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let settled = false;

    const finalize = (opened) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener('pagehide', handlePageHide, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
      resolve(opened);
    };

    const handlePageHide = () => finalize(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        finalize(true);
      }
    };

    const timeoutId = window.setTimeout(() => {
      finalize(document.visibilityState === 'hidden');
    }, LAUNCH_TIMEOUT_MS);

    window.addEventListener('pagehide', handlePageHide, true);
    document.addEventListener('visibilitychange', handleVisibilityChange, true);

    try {
      if (!launchViaAnchor(url)) {
        finalize(false);
        return;
      }
    } catch (error) {
      try {
        if (!launchViaLocation(url)) {
          finalize(false);
          return;
        }
      } catch (locationError) {
        finalize(false);
      }
    }
  });
}

async function launchNativeAndroidPackage() {
  try {
    const { value } = await AppLauncher.canOpenUrl({
      url: DINGTALK_ANDROID_PACKAGE
    });

    if (!value) {
      return false;
    }

    const { completed } = await AppLauncher.openUrl({
      url: DINGTALK_ANDROID_PACKAGE
    });

    return completed === true;
  } catch (error) {
    return false;
  }
}

export async function launchDingTalkHome() {
  if (isNativeAndroidRuntime()) {
    const openedByPackage = await launchNativeAndroidPackage();
    if (openedByPackage) {
      return true;
    }
  }

  return launchViaBrowserScheme(DINGTALK_HOME_URL);
}
