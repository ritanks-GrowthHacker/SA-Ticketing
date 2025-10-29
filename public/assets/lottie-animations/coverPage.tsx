'use client'

import { useEffect, useRef } from 'react'
import Lottie from 'lottie-react'
import ticketsAnimation from '../animation-json/tickets.json'

interface CoverPageAnimationProps {
  className?: string
  width?: number | string
  height?: number | string
  autoplay?: boolean
  loop?: boolean
  speed?: number
}

export default function CoverPageAnimation({
  className = '',
  width = '100%',
  height = '100%',
  autoplay = true,
  loop = true,
  speed = 1,
}: CoverPageAnimationProps) {
  const lottieRef = useRef<any>(null)

  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(speed)
    }
  }, [speed])

  const handleAnimationComplete = () => {
    // Optional: Add any logic when animation completes
    console.log('Lottie animation completed')
  }

  const handleAnimationLoaded = () => {
    // Optional: Add any logic when animation loads
    console.log('Lottie animation loaded')
  }

  return (
    <div 
      className={`flex items-center justify-center ${className}`}
      style={{ width, height }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={ticketsAnimation}
        autoplay={autoplay}
        loop={loop}
        onComplete={handleAnimationComplete}
        onDataReady={handleAnimationLoaded}
        className="w-full h-full object-contain"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      />
    </div>
  )
}

// Alternative component with more customization options
export function TicketAnimationWithControls({
  className = '',
  showControls = false,
  width = '100%',
  height = '100%',
}: {
  className?: string
  showControls?: boolean
  width?: number | string
  height?: number | string
}) {
  const lottieRef = useRef<any>(null)

  const handlePlay = () => {
    lottieRef.current?.play()
  }

  const handlePause = () => {
    lottieRef.current?.pause()
  }

  const handleStop = () => {
    lottieRef.current?.stop()
  }

  const handleRestart = () => {
    lottieRef.current?.goToAndPlay(0)
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div style={{ width, height }} className="relative">
        <Lottie
          lottieRef={lottieRef}
          animationData={ticketsAnimation}
          autoplay={true}
          loop={true}
          className="w-full h-full object-contain"
        />
      </div>
      
      {showControls && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={handlePlay}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
          >
            Play
          </button>
          <button
            onClick={handlePause}
            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
          >
            Pause
          </button>
          <button
            onClick={handleStop}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
          >
            Stop
          </button>
          <button
            onClick={handleRestart}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Restart
          </button>
        </div>
      )}
    </div>
  )
}

// Simple component for basic usage
export function SimpleTicketAnimation({ 
  size = 300,
  className = '' 
}: { 
  size?: number
  className?: string 
}) {
  return (
    <div className={`inline-block ${className}`}>
      <Lottie
        animationData={ticketsAnimation}
        autoplay={true}
        loop={true}
        style={{ width: size, height: size }}
        className="object-contain"
      />
    </div>
  )
}
