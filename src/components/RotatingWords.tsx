import { useEffect, useState } from 'react';

interface RotatingWordsProps {
  words: string[];
  className?: string;
  duration?: number;
}

export default function RotatingWords({
  words,
  className = '',
  duration = 3000
}: RotatingWordsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // First timer for fade out
    const fadeOutTimer = setInterval(() => {
      setIsVisible(false);
      
      // Change word after fade out
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
        // Fade in new word
        setIsVisible(true);
      }, 500); // Half a second for fade out
      
    }, duration);

    return () => {
      clearInterval(fadeOutTimer);
    };
  }, [words, duration]);

  return (
    <div className="relative h-[3.5rem] flex items-center justify-center overflow-hidden">
      <span
        className={`
          ${className}
          absolute
          transition-opacity
          duration-500
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
      >
        {words[currentIndex]}
      </span>
    </div>
  );
}
