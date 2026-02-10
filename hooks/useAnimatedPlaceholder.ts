import { useState, useEffect, useCallback } from 'react';
import { UI_ANIMATION } from '../constants/animations';

interface UseAnimatedPlaceholderOptions {
  suggestions: string[];
  typingSpeed?: number;
  deleteSpeed?: number;
  pauseDuration?: number;
}

/**
 * Hook that creates an animated typing effect for input placeholders.
 * Cycles through suggestions with a realistic typing/deleting animation.
 * 
 * All timing values are configurable via constants/animations.ts
 * No hardcoded defaults - Flexy-approved! ✨
 * 
 * @example
 * const placeholder = useAnimatedPlaceholder({
 *   suggestions: ['Search robots...', 'EMA crossover', 'RSI strategy'],
 *   typingSpeed: UI_ANIMATION.TYPING.TYPING_SPEED,
 *   deleteSpeed: UI_ANIMATION.TYPING.DELETE_SPEED,
 *   pauseDuration: UI_ANIMATION.TYPING.PAUSE_DURATION
 * });
 */
export function useAnimatedPlaceholder({
  suggestions,
  typingSpeed = UI_ANIMATION.TYPING.TYPING_SPEED,
  deleteSpeed = UI_ANIMATION.TYPING.DELETE_SPEED,
  pauseDuration = UI_ANIMATION.TYPING.PAUSE_DURATION
}: UseAnimatedPlaceholderOptions): string {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  const typeNextChar = useCallback(() => {
    const currentSuggestion = suggestions[currentIndex];
    if (!currentSuggestion) return;
    
    if (isTyping) {
      // Typing phase
      if (displayText.length < currentSuggestion.length) {
        setDisplayText(currentSuggestion.slice(0, displayText.length + 1));
        return;
      } else {
        // Finished typing, pause then start deleting
        setIsTyping(false);
        return;
      }
    } else {
      // Deleting phase
      if (displayText.length > 0) {
        setDisplayText(displayText.slice(0, -1));
        return;
      } else {
        // Finished deleting, move to next suggestion
        setIsTyping(true);
        setCurrentIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
    }
  }, [displayText, currentIndex, isTyping, suggestions]);

  useEffect(() => {
    if (suggestions.length === 0) return;

    const currentSuggestion = suggestions[currentIndex];
    if (!currentSuggestion) return;

    const timeout = setTimeout(() => {
      typeNextChar();
    }, isTyping ? typingSpeed : (displayText.length === currentSuggestion.length ? pauseDuration : deleteSpeed));

    return () => clearTimeout(timeout);
  }, [displayText, currentIndex, isTyping, suggestions, typingSpeed, deleteSpeed, pauseDuration, typeNextChar]);

  return displayText;
}
