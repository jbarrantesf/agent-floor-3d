/**
 * Object Pool Utility - Performance Optimization
 */

/**
 * Generic object pool for reusing objects
 */
export class ObjectPool<T> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 10,
    maxSize: number = 100
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
    }
  }

  /**
   * Get object from pool
   */
  get(): T {
    let obj: T;

    if (this.available.length > 0) {
      obj = this.available.pop()!;
    } else {
      obj = this.factory();
    }

    this.inUse.add(obj);
    return obj;
  }

  /**
   * Return object to pool
   */
  return(obj: T): void {
    if (!this.inUse.has(obj)) {
      console.warn('Object not from this pool');
      return;
    }

    this.inUse.delete(obj);

    if (this.available.length < this.maxSize) {
      this.reset(obj);
      this.available.push(obj);
    }
  }

  /**
   * Get pool stats
   */
  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      maxSize: this.maxSize
    };
  }

  /**
   * Clear pool
   */
  clear(): void {
    this.available = [];
    this.inUse.clear();
  }

  /**
   * Pre-allocate more objects
   */
  preAllocate(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.available.length < this.maxSize) {
        this.available.push(this.factory());
      }
    }
  }
}

/**
 * Request animation frame pool for batching updates
 */
export class RAFPool {
  private callbacks: Set<() => void> = new Set();
  private isScheduled = false;

  /**
   * Add callback to be executed in next frame
   */
  add(callback: () => void): void {
    this.callbacks.add(callback);

    if (!this.isScheduled) {
      this.isScheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  /**
   * Remove callback
   */
  remove(callback: () => void): void {
    this.callbacks.delete(callback);
  }

  /**
   * Execute all callbacks and clear
   */
  private flush(): void {
    this.callbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in RAF callback:', error);
      }
    });

    this.callbacks.clear();
    this.isScheduled = false;
  }

  /**
   * Force immediate flush
   */
  flushImmediate(): void {
    this.flush();
  }

  /**
   * Get count of pending callbacks
   */
  getCount(): number {
    return this.callbacks.size;
  }
}

/**
 * Event emitter pool for managing many event listeners
 */
export class EventPool<T = any> {
  private listeners: Map<string, Set<(data: T) => void>> = new Map();

  /**
   * Subscribe to event
   */
  on(event: string, listener: (data: T) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  /**
   * Unsubscribe from event
   */
  off(event: string, listener: (data: T) => void): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }

  /**
   * Emit event
   */
  emit(event: string, data: T): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in listener for event "${event}":`, error);
      }
    });
  }

  /**
   * Clear all listeners for an event
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count
   */
  getListenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }
}
