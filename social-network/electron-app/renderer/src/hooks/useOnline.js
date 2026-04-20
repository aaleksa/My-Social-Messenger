import { useState, useEffect } from 'react'

/**
 * Returns `true` when the browser reports an active network connection,
 * `false` when it reports offline. Reacts instantly to `online` / `offline`
 * window events so every subscriber re-renders automatically.
 */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const up   = () => setOnline(true)
    const down = () => setOnline(false)

    window.addEventListener('online',  up)
    window.addEventListener('offline', down)

    return () => {
      window.removeEventListener('online',  up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return online
}
