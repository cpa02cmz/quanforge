/**
 * Listener Manager Utility
 * Provides centralized management for event listeners and timers to prevent memory leaks
 * 
 * Usage:
 * ```typescript
 * class MyService {
 *   private listenerManager = createListenerManager();
 *   
 *   init() {
 *     // Add event listeners
 *     this.listenerManager.addEventListener(window, 'resize', this.handleResize);
 *     this.listenerManager.addEventListener(document, 'click', this.handleClick);
 *     
 *     // Add timers
 *     this.listenerManager.setInterval(() => this.poll(), 5000);
 *     this.listenerManager.setTimeout(() => this.delayedAction(), 1000);
 *     
 *     // Add observers
 *     const observer = new IntersectionObserver(callback);
 *     this.listenerManager.addObserver(observer, targetElement);
 *   }
 *   
 *   destroy() {
 *     this.listenerManager.cleanup();
 *   }
 * }
 * ```
 */

export interface CleanupFunction {
  (): void;
}

export interface ListenerManager {
  /** Add an event listener and track it for cleanup */
  addEventListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): CleanupFunction;
  
  addEventListener<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (this: Document, ev: DocumentEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): CleanupFunction;
  
  addEventListener<T extends EventTarget>(
    target: T,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): CleanupFunction;
  
  /** Set a timeout and track it for cleanup */
  setTimeout(callback: () => void, ms: number): number;
  
  /** Set an interval and track it for cleanup */
  setInterval(callback: () => void, ms: number): number;
  
  /** Add an observer and track it for cleanup */
  addObserver(observer: IntersectionObserver, target: Element): CleanupFunction;
  addObserver(observer: PerformanceObserver): CleanupFunction;
  addObserver(observer: MutationObserver, target: Node): CleanupFunction;
  
  /** Add a custom cleanup function */
  addCleanup(cleanup: CleanupFunction): void;
  
  /** Remove a specific listener by its cleanup function */
  remove(cleanup: CleanupFunction): void;
  
  /** Clean up all tracked listeners, timers, and observers */
  cleanup(): void;
  
  /** Check if there are any active tracked items */
  hasActiveItems(): boolean;
  
  /** Get count of active tracked items */
  getActiveCount(): number;
}

class ListenerManagerImpl implements ListenerManager {
  private cleanups: Set<CleanupFunction> = new Set();
  private timeouts: Set<number> = new Set();
  private intervals: Set<number> = new Set();

  addEventListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): CleanupFunction;
  
  addEventListener<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (this: Document, ev: DocumentEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): CleanupFunction;
  
  addEventListener<T extends EventTarget>(
    target: T,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): CleanupFunction {
    target.addEventListener(type, listener, options);
    
    const cleanup = () => {
      target.removeEventListener(type, listener, options);
      this.cleanups.delete(cleanup);
    };
    
    this.cleanups.add(cleanup);
    return cleanup;
  }

  setTimeout(callback: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      this.timeouts.delete(id);
      callback();
    }, ms);
    this.timeouts.add(id);
    return id;
  }

  setInterval(callback: () => void, ms: number): number {
    const id = window.setInterval(callback, ms);
    this.intervals.add(id);
    return id;
  }

  addObserver(observer: IntersectionObserver, target: Element): CleanupFunction;
  addObserver(observer: PerformanceObserver): CleanupFunction;
  addObserver(observer: MutationObserver, target: Node): CleanupFunction;
  addObserver(
    observer: IntersectionObserver | PerformanceObserver | MutationObserver,
    target?: Element | Node
  ): CleanupFunction {
    if (observer instanceof IntersectionObserver && target instanceof Element) {
      observer.observe(target);
    } else if (observer instanceof MutationObserver && target instanceof Node) {
      observer.observe(target);
    }
    // PerformanceObserver doesn't need a target, just observe()
    
    const cleanup = () => {
      observer.disconnect();
      this.cleanups.delete(cleanup);
    };
    
    this.cleanups.add(cleanup);
    return cleanup;
  }

  addCleanup(cleanup: CleanupFunction): void {
    this.cleanups.add(cleanup);
  }

  remove(cleanup: CleanupFunction): void {
    cleanup();
  }

  cleanup(): void {
    // Clear all timeouts
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts.clear();
    
    // Clear all intervals
    this.intervals.forEach(id => clearInterval(id));
    this.intervals.clear();
    
    // Run all cleanup functions
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups.clear();
  }

  hasActiveItems(): boolean {
    return this.cleanups.size > 0 || this.timeouts.size > 0 || this.intervals.size > 0;
  }

  getActiveCount(): number {
    return this.cleanups.size + this.timeouts.size + this.intervals.size;
  }
}

/**
 * Create a new listener manager instance
 */
export function createListenerManager(): ListenerManager {
  return new ListenerManagerImpl();
}

/**
 * Utility function to safely add an event listener with automatic cleanup
 * Returns a cleanup function that removes the listener
 */
export function addEventListenerSafe<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  listener: (this: Window, ev: WindowEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions
): CleanupFunction;

export function addEventListenerSafe<K extends keyof DocumentEventMap>(
  target: Document,
  type: K,
  listener: (this: Document, ev: DocumentEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions
): CleanupFunction;

export function addEventListenerSafe<T extends EventTarget>(
  target: T,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): CleanupFunction {
  target.addEventListener(type, listener, options);
  return () => target.removeEventListener(type, listener, options);
}

/**
 * Utility function to create a managed timer that can be cleared
 */
export function createManagedTimer(
  callback: () => void,
  ms: number,
  type: 'timeout' | 'interval' = 'timeout'
): { id: number; clear: () => void } {
  const id = type === 'timeout' 
    ? window.setTimeout(callback, ms)
    : window.setInterval(callback, ms);
  
  const clear = () => {
    if (type === 'timeout') {
      clearTimeout(id);
    } else {
      clearInterval(id);
    }
  };
  
  return { id, clear };
}

export default createListenerManager;
