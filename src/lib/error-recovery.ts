/**
 * Phase 6I: Error Handling & Recovery
 * Comprehensive error management for 3D floor visualization
 */

import React, { ReactNode, useState, useCallback, useEffect } from 'react';
import * as Sentry from '@sentry/react';

/**
 * Error Boundary Component
 * Catches errors in component tree and shows fallback UI
 */
export class Floor3DErrorBoundary extends React.Component<
  { children: ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null; errorId: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorId: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = `ERROR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.error('Floor3D Error:', error, errorInfo);
    
    // Report to Sentry if available
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error, { 
        tags: { component: 'Floor3D', errorId },
        extra: { errorInfo }
      });
    }

    this.setState({ error, errorId });
    this.props.onError?.(error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorId: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.errorContainer}>
          <div style={styles.errorContent}>
            <h2>3D Visualization Error</h2>
            <p>The 3D floor visualization encountered an error.</p>
            <code style={styles.errorCode}>{this.state.error?.message}</code>
            <div style={styles.errorMeta}>
              <small>Error ID: {this.state.errorId}</small>
            </div>
            <button 
              onClick={this.handleReset}
              style={styles.button}
            >
              Reload Visualization
            </button>
            <button 
              onClick={() => window.history.back()}
              style={{ ...styles.button, background: '#6C757D' }}
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Connection Recovery Manager
 * Handles Supabase connection loss and recovery
 */
export class ConnectionRecoveryManager {
  private isConnected = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionListeners: ((status: boolean) => void)[] = [];

  /**
   * Register connection status listener
   */
  onConnectionStatusChange(listener: (isConnected: boolean) => void) {
    this.connectionListeners.push(listener);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of connection status change
   */
  private notifyConnectionStatusChange(status: boolean) {
    this.isConnected = status;
    this.connectionListeners.forEach(listener => listener(status));
  }

  /**
   * Detect connection loss
   */
  detectConnectionLoss() {
    if (this.isConnected) {
      this.notifyConnectionStatusChange(false);
      this.attemptReconnection();
    }
  }

  /**
   * Detect connection restored
   */
  detectConnectionRestored() {
    if (!this.isConnected) {
      this.reconnectAttempts = 0;
      this.notifyConnectionStatusChange(true);
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private async attemptReconnection() {
    while (this.reconnectAttempts < this.maxReconnectAttempts && !this.isConnected) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        // Attempt connection test
        const response = await fetch('/api/health', { method: 'HEAD' });
        if (response.ok) {
          this.detectConnectionRestored();
          return;
        }
      } catch (error) {
        console.warn(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      }
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

/**
 * Rendering Error Handler
 * Catches WebGL and Three.js rendering errors
 */
export class RenderingErrorHandler {
  private errors: Map<string, number> = new Map();
  private maxErrorsPerType = 5;
  private errorRecoveryTime = 5000;
  private recoveryTimer: NodeJS.Timeout | null = null;

  /**
   * Handle WebGL context loss
   */
  handleContextLoss(contextLostEvent: Event) {
    console.error('WebGL context lost');
    const canvas = (contextLostEvent.target as HTMLCanvasElement);
    
    // Prevent default error handling
    contextLostEvent.preventDefault();
    
    // Attempt recovery
    this.attemptContextRecovery(canvas);
  }

  /**
   * Handle WebGL context restoration
   */
  handleContextRestored(contextRestoredEvent: Event) {
    console.log('WebGL context restored');
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }
  }

  /**
   * Attempt to recover WebGL context
   */
  private attemptContextRecovery(canvas: HTMLCanvasElement) {
    this.recoveryTimer = setTimeout(() => {
      try {
        // Try to get WebGL context again
        const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (ctx) {
          console.log('WebGL context recovered');
        } else {
          console.error('Unable to recover WebGL context');
        }
      } catch (error) {
        console.error('Context recovery failed:', error);
      }
    }, this.errorRecoveryTime);
  }

  /**
   * Track and handle rendering errors
   */
  handleRenderingError(errorType: string, error: Error) {
    const count = (this.errors.get(errorType) || 0) + 1;
    this.errors.set(errorType, count);

    console.error(`Rendering error (${errorType}):`, error);

    if (count > this.maxErrorsPerType) {
      console.error(`Too many ${errorType} errors, please refresh the page`);
      return false; // Signal critical error
    }

    return true; // Signal recoverable error
  }

  /**
   * Clear error counts
   */
  clearErrorCounts() {
    this.errors.clear();
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return Object.fromEntries(this.errors);
  }
}

/**
 * Supabase Subscription Error Recovery
 * Handles Supabase subscription failures
 */
export class SubscriptionErrorRecovery {
  private subscriptions: Map<string, any> = new Map();
  private resubscribeFunctions: Map<string, () => Promise<void>> = new Map();
  private maxRetries = 3;
  private retryDelays: number[] = [1000, 3000, 5000];

  /**
   * Register a subscription with recovery capability
   */
  registerSubscription(
    id: string,
    subscription: any,
    resubscribeFn: () => Promise<void>
  ) {
    this.subscriptions.set(id, subscription);
    this.resubscribeFunctions.set(id, resubscribeFn);
  }

  /**
   * Handle subscription error
   */
  async handleSubscriptionError(subscriptionId: string, error: Error) {
    console.error(`Subscription ${subscriptionId} error:`, error);

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const delay = this.retryDelays[attempt];
      console.log(`Resubscribing (attempt ${attempt + 1}/${this.maxRetries}) in ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        const resubscribeFn = this.resubscribeFunctions.get(subscriptionId);
        if (resubscribeFn) {
          await resubscribeFn();
          console.log(`Successfully resubscribed to ${subscriptionId}`);
          return;
        }
      } catch (retryError) {
        console.warn(`Resubscription attempt ${attempt + 1} failed:`, retryError);
        if (attempt === this.maxRetries - 1) {
          console.error(`Failed to recover subscription ${subscriptionId}`);
        }
      }
    }
  }

  /**
   * Unsubscribe and clean up
   */
  unsubscribe(subscriptionId: string) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription && typeof subscription.unsubscribe === 'function') {
      subscription.unsubscribe();
    }
    this.subscriptions.delete(subscriptionId);
    this.resubscribeFunctions.delete(subscriptionId);
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll() {
    this.subscriptions.forEach((subscription, id) => {
      this.unsubscribe(id);
    });
  }
}

/**
 * Performance Error Detector
 * Monitors for performance issues and errors
 */
export class PerformanceErrorDetector {
  private fpsThreshold = 30; // Minimum acceptable FPS
  private frameTimeThreshold = 33; // Maximum acceptable frame time (ms)
  private lowPerformanceListeners: ((reason: string) => void)[] = [];
  private isMonitoring = false;

  /**
   * Register low performance listener
   */
  onLowPerformance(listener: (reason: string) => void) {
    this.lowPerformanceListeners.push(listener);
  }

  /**
   * Start monitoring performance
   */
  startMonitoring(onFrame: (frameTime: number) => void) {
    this.isMonitoring = true;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsCheckTime = lastTime;

    const monitor = () => {
      if (!this.isMonitoring) return;

      const now = performance.now();
      const frameTime = now - lastTime;

      // Check frame time
      if (frameTime > this.frameTimeThreshold) {
        this.notifyLowPerformance(`Slow frame: ${frameTime.toFixed(2)}ms`);
      }

      // Check FPS every second
      frameCount++;
      if (now - fpsCheckTime >= 1000) {
        const fps = (frameCount * 1000) / (now - fpsCheckTime);
        if (fps < this.fpsThreshold) {
          this.notifyLowPerformance(`Low FPS: ${fps.toFixed(1)}`);
        }
        frameCount = 0;
        fpsCheckTime = now;
      }

      lastTime = now;
      onFrame(frameTime);
      requestAnimationFrame(monitor);
    };

    requestAnimationFrame(monitor);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
  }

  /**
   * Notify listeners of low performance
   */
  private notifyLowPerformance(reason: string) {
    this.lowPerformanceListeners.forEach(listener => listener(reason));
  }

  /**
   * Set thresholds
   */
  setThresholds(fpsThreshold: number, frameTimeThreshold: number) {
    this.fpsThreshold = fpsThreshold;
    this.frameTimeThreshold = frameTimeThreshold;
  }
}

/**
 * Fallback UI Component for Rendering Failures
 */
export const Floor3DFallback: React.FC<{ error?: string; onRetry?: () => void }> = ({
  error,
  onRetry
}) => (
  <div style={styles.fallbackContainer}>
    <div style={styles.fallbackContent}>
      <h3>3D Visualization Unavailable</h3>
      <p>{error || 'Unable to load 3D floor visualization. Your browser may not support WebGL.'}</p>
      <div style={styles.fallbackInfo}>
        <h4>Troubleshooting:</h4>
        <ul>
          <li>Try refreshing the page</li>
          <li>Check that WebGL is enabled in your browser</li>
          <li>Try a different browser</li>
          <li>Update your graphics drivers</li>
        </ul>
      </div>
      {onRetry && (
        <button onClick={onRetry} style={styles.button}>
          Retry
        </button>
      )}
    </div>
  </div>
);

/**
 * Connection Status Indicator
 */
export const ConnectionStatus: React.FC<{ isConnected: boolean }> = ({ isConnected }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 20,
      right: 20,
      padding: '10px 15px',
      borderRadius: '6px',
      background: isConnected ? '#10B981' : '#EF4444',
      color: 'white',
      fontSize: '12px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}
  >
    <div
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: 'white',
        animation: isConnected ? 'none' : 'pulse 1s infinite'
      }}
    />
    {isConnected ? 'Connected' : 'Reconnecting...'}
  </div>
);

/**
 * Hook for error recovery
 */
export const useFloor3DErrorRecovery = () => {
  const [connectionRecovery] = useState(() => new ConnectionRecoveryManager());
  const [renderingErrorHandler] = useState(() => new RenderingErrorHandler());
  const [subscriptionRecovery] = useState(() => new SubscriptionErrorRecovery());
  const [performanceDetector] = useState(() => new PerformanceErrorDetector());
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = connectionRecovery.onConnectionStatusChange((status) => {
      setIsConnected(status);
    });

    return unsubscribe;
  }, [connectionRecovery]);

  return {
    connectionRecovery,
    renderingErrorHandler,
    subscriptionRecovery,
    performanceDetector,
    isConnected,
    detectConnectionLoss: () => connectionRecovery.detectConnectionLoss(),
    detectConnectionRestored: () => connectionRecovery.detectConnectionRestored()
  };
};

const styles = {
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100vh',
    background: 'linear-gradient(135deg, #1f1f2e 0%, #2d1b4e 100%)',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  errorContent: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    padding: '40px',
    maxWidth: '500px',
    textAlign: 'center' as const,
    color: 'white',
    backdropFilter: 'blur(10px)'
  },
  errorCode: {
    display: 'block',
    background: 'rgba(0, 0, 0, 0.3)',
    padding: '12px',
    borderRadius: '6px',
    marginTop: '16px',
    fontSize: '12px',
    color: '#FF6B6B',
    overflow: 'auto'
  },
  errorMeta: {
    marginTop: '16px',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '11px'
  },
  button: {
    marginTop: '20px',
    marginRight: '10px',
    padding: '10px 20px',
    background: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  fallbackContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #1f1f2e 0%, #2d1b4e 100%)'
  },
  fallbackContent: {
    color: 'white',
    textAlign: 'center' as const,
    padding: '40px',
    maxWidth: '500px'
  },
  fallbackInfo: {
    textAlign: 'left' as const,
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '20px',
    borderRadius: '8px',
    marginTop: '20px',
    fontSize: '12px'
  }
};
