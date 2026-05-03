/**
 * Performance Monitoring - Phase 6G
 * FPS tracking, memory profiling, and optimization metrics
 */

import { PerformanceMetrics } from '../types/floor-3d';

/**
 * Performance monitor
 */
export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;
  private metrics: PerformanceMetrics = {
    fps: 60,
    renderTime: 0,
    memoryUsage: 0,
    drawCalls: 0,
    triangles: 0
  };

  private sampleInterval = 1000; // ms
  private listeners: Set<(metrics: PerformanceMetrics) => void> = new Set();

  /**
   * Record frame
   */
  recordFrame(renderTime: number, drawCalls: number, triangles: number): void {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastTime;

    this.metrics.renderTime = renderTime;
    this.metrics.drawCalls = drawCalls;
    this.metrics.triangles = triangles;

    if (elapsed >= this.sampleInterval) {
      this.fps = (this.frameCount / elapsed) * 1000;
      this.metrics.fps = Math.round(this.fps);

      if ((performance as any).memory) {
        this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
      }

      this.notifyListeners();

      this.frameCount = 0;
      this.lastTime = now;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Subscribe to metrics updates
   */
  on(listener: (metrics: PerformanceMetrics) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getMetrics());
      } catch (error) {
        console.error('Error in performance listener:', error);
      }
    });
  }

  /**
   * Get FPS
   */
  getFPS(): number {
    return this.metrics.fps;
  }

  /**
   * Get memory usage in MB
   */
  getMemoryMB(): number {
    return this.metrics.memoryUsage / 1024 / 1024;
  }

  /**
   * Check if performance is good
   */
  isPerformanceGood(): boolean {
    return this.metrics.fps >= 50;
  }

  /**
   * Get performance status
   */
  getStatus(): 'excellent' | 'good' | 'fair' | 'poor' {
    if (this.metrics.fps >= 55) return 'excellent';
    if (this.metrics.fps >= 45) return 'good';
    if (this.metrics.fps >= 30) return 'fair';
    return 'poor';
  }
}

/**
 * Memory profiler
 */
export class MemoryProfiler {
  private samples: Array<{
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
  }> = [];

  private maxSamples = 100;

  /**
   * Record sample
   */
  recordSample(): void {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      this.samples.push({
        timestamp: performance.now(),
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.jsHeapSizeLimit
      });

      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }
    }
  }

  /**
   * Get memory trend
   */
  getTrend(): 'stable' | 'growing' | 'shrinking' {
    if (this.samples.length < 2) return 'stable';

    const recent = this.samples.slice(-10);
    const old = this.samples.slice(-20, -10);

    const recentAvg = recent.reduce((sum, s) => sum + s.heapUsed, 0) / recent.length;
    const oldAvg = old.reduce((sum, s) => sum + s.heapUsed, 0) / old.length;

    const diff = recentAvg - oldAvg;
    const changePercent = (diff / oldAvg) * 100;

    if (changePercent > 5) return 'growing';
    if (changePercent < -5) return 'shrinking';
    return 'stable';
  }

  /**
   * Get peak memory
   */
  getPeakMemory(): number {
    return Math.max(...this.samples.map(s => s.heapUsed));
  }

  /**
   * Get average memory
   */
  getAverageMemory(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((sum, s) => sum + s.heapUsed, 0) / this.samples.length;
  }

  /**
   * Export data for analysis
   */
  exportData() {
    return {
      samples: this.samples,
      trend: this.getTrend(),
      peakMB: this.getPeakMemory() / 1024 / 1024,
      avgMB: this.getAverageMemory() / 1024 / 1024
    };
  }
}

/**
 * Frame time analyzer
 */
export class FrameTimeAnalyzer {
  private frameTimes: number[] = [];
  private maxSamples = 60; // 1 second at 60 FPS

  /**
   * Record frame time
   */
  recordFrameTime(time: number): void {
    this.frameTimes.push(time);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }

  /**
   * Get average frame time
   */
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length;
  }

  /**
   * Get 99th percentile frame time
   */
  get99thPercentile(): number {
    if (this.frameTimes.length === 0) return 0;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.99) - 1;
    return sorted[index];
  }

  /**
   * Get frame drops
   */
  getFrameDrops(): number {
    return this.frameTimes.filter(t => t > 16.67).length; // > 60 FPS target
  }

  /**
   * Get jank percentage
   */
  getJankPercentage(): number {
    if (this.frameTimes.length === 0) return 0;
    return (this.getFrameDrops() / this.frameTimes.length) * 100;
  }

  /**
   * Get performance report
   */
  getReport() {
    return {
      avgFrameTime: this.getAverageFrameTime().toFixed(2),
      p99: this.get99thPercentile().toFixed(2),
      frameDrops: this.getFrameDrops(),
      jankPercent: this.getJankPercentage().toFixed(1)
    };
  }
}

/**
 * Create performance monitor instance
 */
export function createPerformanceMonitor(): PerformanceMonitor {
  return new PerformanceMonitor();
}

/**
 * Create memory profiler instance
 */
export function createMemoryProfiler(): MemoryProfiler {
  return new MemoryProfiler();
}

/**
 * Create frame time analyzer instance
 */
export function createFrameTimeAnalyzer(): FrameTimeAnalyzer {
  return new FrameTimeAnalyzer();
}
