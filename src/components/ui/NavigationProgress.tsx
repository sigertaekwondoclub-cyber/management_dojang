'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
    setProgress(20)

    const t1 = setTimeout(() => setProgress(60), 80)
    const t2 = setTimeout(() => setProgress(85), 200)
    const t3 = setTimeout(() => {
      setProgress(100)
    }, 350)
    const t4 = setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 600)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [pathname])

  if (!visible && progress === 0) return null

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[3px] bg-primary shadow-[0_0_8px_rgba(34,197,94,0.6)]"
      style={{
        width: `${progress}%`,
        transition: progress === 0
          ? 'none'
          : progress === 100
          ? 'width 0.2s ease-out, opacity 0.2s ease-out'
          : `width ${progress < 60 ? 0.3 : 0.4}s ease-out`,
        opacity: progress === 100 ? 0 : 1,
      }}
    />
  )
}
