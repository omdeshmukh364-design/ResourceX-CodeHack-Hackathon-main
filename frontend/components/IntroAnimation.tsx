'use client'

import { useState, useEffect } from 'react'

export default function IntroAnimation({ onComplete }: { onComplete: () => void }) {
  const [fadeOut, setFadeOut] = useState(false)

  const handleVideoEnd = () => {
    setFadeOut(true)
    setTimeout(() => {
      onComplete()
    }, 600) // matches transition duration
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[#f7f6f2] transition-opacity duration-600 ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <video
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
        className="max-h-full max-w-full object-contain"
      >
        <source src="/intro-video.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      {/* Skip button in case users want to bypass */}
      <button 
        type="button" 
        onClick={handleVideoEnd}
        className="absolute bottom-10 right-10 rounded-full bg-[#164e41]/10 px-4 py-2 text-xs font-medium text-[#164e41] backdrop-blur-sm transition hover:bg-[#164e41]/20"
      >
        Skip intro &rarr;
      </button>
    </div>
  )
}