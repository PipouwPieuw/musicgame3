import { DEFAULT_COVER_PATH } from '../config.js';

/** Max wait before falling back so gameplay never hangs on a slow cover. */
export const IMAGE_PRELOAD_TIMEOUT_MS = 500;

/**
 * Probe-load an image. Resolves with the usable path (requested path, or
 * DEFAULT_COVER_PATH on error / timeout).
 */
export function preloadImage(path, timeoutMs = IMAGE_PRELOAD_TIMEOUT_MS) {
    const targetPath = path || DEFAULT_COVER_PATH;

    return new Promise(function (resolve) {
        let settled = false;
        const probe = new Image();

        function finish(resolvedPath) {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            resolve(resolvedPath);
        }

        const timer = setTimeout(function () {
            finish(DEFAULT_COVER_PATH);
        }, timeoutMs);

        probe.onload = function () {
            finish(targetPath);
        };
        probe.onerror = function () {
            finish(DEFAULT_COVER_PATH);
        };
        probe.src = targetPath;
    });
}

export function preloadImages(paths, timeoutMs = IMAGE_PRELOAD_TIMEOUT_MS) {
    return Promise.all(
        paths.map(function (path) {
            return preloadImage(path, timeoutMs);
        })
    );
}
