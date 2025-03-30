import { useEffect, useState } from 'react';

interface TypewriterTextProps {
  paragraphs: string[];
  className?: string;
  delay?: number;
}

export default function TypewriterText({ paragraphs, className = '', delay = 50 }: TypewriterTextProps) {
  const [displayedParagraphs, setDisplayedParagraphs] = useState<string[]>(Array(paragraphs.length).fill(''));
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);

  useEffect(() => {
    if (currentParagraph >= paragraphs.length) return;

    const timer = setTimeout(() => {
      if (currentChar < paragraphs[currentParagraph].length) {
        setDisplayedParagraphs(prev => {
          const newParagraphs = [...prev];
          newParagraphs[currentParagraph] = paragraphs[currentParagraph].slice(0, currentChar + 1);
          return newParagraphs;
        });
        setCurrentChar(prev => prev + 1);
      } else {
        setCurrentParagraph(prev => prev + 1);
        setCurrentChar(0);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [currentParagraph, currentChar, paragraphs, delay]);

  return (
    <div>
      {displayedParagraphs.map((text, index) => (
        <p key={index} className={`${className} ${index > 0 ? 'mt-4' : ''}`}>
          {text}
          {currentParagraph === index && <span className="animate-pulse">|</span>}
        </p>
      ))}
    </div>
  );
}
