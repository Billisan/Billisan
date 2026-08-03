import { DotLottie } from '@lottiefiles/dotlottie-web'
import { useEffect, useRef } from 'react'

interface DotLottieAnimationProps {
  src: string
  width?: number
  height?: number
  loop?: boolean
  autoplay?: boolean
  speed?: number
  className?: string
}

export function DotLottieAnimation({
  src,
  width = 300,
  height = 300,
  loop = true,
  autoplay = true,
  speed = 1,
  className,
}: DotLottieAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const dotLottie = new DotLottie({
      autoplay,
      loop,
      speed,
      canvas: canvasRef.current,
      src,
    })

    return () => dotLottie.destroy()
  }, [src, loop, autoplay, speed])

  return (
    <canvas ref={canvasRef} width={width} height={height} className={className} />
  )
}
