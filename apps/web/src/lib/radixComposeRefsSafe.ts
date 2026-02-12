import * as React from 'react';

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') {
    return ref(value);
  }

  if (ref != null) {
    try {
      (ref as React.MutableRefObject<T | null>).current = value;
    } catch {
      // Some environments/components provide readonly or unexpected ref objects.
      // Swallowing here matches React's tolerance and avoids hard crashes.
    }
  }
}

export function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup === 'function') {
        hasCleanup = true;
      }
      return cleanup;
    });

    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup === 'function') {
            cleanup();
          } else {
            setRef(refs[i], null);
          }
        }
      };
    }
  };
}

export function useComposedRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return React.useCallback(composeRefs<T>(...refs), refs);
}
