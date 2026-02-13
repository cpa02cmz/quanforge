// Lazy Loading Utilities - Non-component exports for lazy-loader
import React, { lazy, ComponentType } from 'react';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('lazy-utils');

export type InteractionTrigger = 'hover' | 'click' | 'visible';

/**
 * Create a lazy-loaded component with error handling
 * @param importFunc - Dynamic import function that returns the component
 * @param componentName - Name of the component for logging purposes
 * @returns Lazy-loaded React component
 */
export function createLazyComponent(
   
  importFunc: () => Promise<{ default: ComponentType<any> }>,
  componentName: string
   
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): React.LazyExoticComponent<ComponentType<any>> {
  return lazy(async () => {
    try {
      logger.debug(`Loading component: ${componentName}`);
      return await importFunc();
    } catch (error: unknown) {
      logger.error(`Failed to load component ${componentName}:`, error);
      // Return a fallback component instead of crashing
      return {
        default: (_props: unknown) => (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50">
            <h3 className="text-red-800 font-semibold">Component Load Error</h3>
            <p className="text-red-600 text-sm">
              Failed to load {componentName}. Please refresh the page.
            </p>
          </div>
        )
      };
    }
  });
}

/**
 * Load component on user interaction (hover, click, or visibility)
 * @param importFunc - Dynamic import function for the component
 * @param trigger - Type of interaction to trigger loading
 * @param element - HTMLElement to attach interaction listeners to
 * @returns Promise resolving to the component type or null
 */
export async function loadComponentOnInteraction<T extends ComponentType<unknown>>(
  importFunc: () => Promise<{ default: T }>,
  trigger: InteractionTrigger,
  element: HTMLElement
): Promise<T | null> {
  try {
    if (trigger === 'hover') {
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          element.removeEventListener('mouseenter', handleMouseEnter);
          resolve(null);
        }, 200); // 200ms delay

        const handleMouseEnter = async () => {
          clearTimeout(timeoutId);
          element.removeEventListener('mouseenter', handleMouseEnter);
          const module = await importFunc();
          resolve(module.default);
        };

        element.addEventListener('mouseenter', handleMouseEnter);
      });
    }

    if (trigger === 'click') {
      return new Promise((resolve) => {
        const handleClick = async () => {
          element.removeEventListener('click', handleClick);
          const module = await importFunc();
          resolve(module.default);
        };
        element.addEventListener('click', handleClick);
      });
    }

    if (trigger === 'visible') {
      return new Promise((resolve) => {
        const observer = new IntersectionObserver(
          async (entries) => {
            const entry = entries[0];
            if (entry?.isIntersecting) {
              observer.disconnect();
              const module = await importFunc();
              resolve(module.default);
            }
          },
          { threshold: 0.1 }
        );
        observer.observe(element);
      });
    }

    return null;
  } catch (error: unknown) {
    logger.error('Error in conditional component loading:', error);
    return null;
  }
}

/**
 * Preload critical components for faster initial render
 * Preloads homepage components like Dashboard, MarketTicker, and ChatInterface
 */
export async function preloadCriticalComponents(): Promise<void> {
  try {
    logger.debug('Preloading critical components...');

    // Preload homepage components
    await Promise.all([
      import('../pages/Dashboard'),
      import('../components/MarketTicker'),
      import('../components/ChatInterface')
    ]);

    logger.debug('Critical components preloaded');
  } catch (error: unknown) {
    logger.warn('Error preloading components:', error);
  }
}
