'use client'
import { useEffect, useRef, useState } from 'react'

/** Anime un nombre de 0 (ou de sa valeur précédente) jusqu'à `target`. */
export function useCountUp(target: number | null, duration = 900): number {
  const [val, setVal] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (target == null || isNaN(target)) { setVal(0); return }
    const from = fromRef.current
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setVal(from + (target - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return val
}
