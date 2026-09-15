import { EventEmitter } from 'node:events';

export interface PollStartedEvent {
  timestamp: string;
  triggeredBy: 'auto' | 'manual';
}

export interface PollCompletedEvent {
  timestamp: string;
  durationMs: number;
  accountsProcessed: number;
  errorCount: number;
}

class PollEventEmitter extends EventEmitter {
  emitStarted(payload: PollStartedEvent): boolean {
    return this.emit('poll:started', payload);
  }

  onStarted(listener: (payload: PollStartedEvent) => void): this {
    return this.on('poll:started', listener);
  }

  offStarted(listener: (payload: PollStartedEvent) => void): this {
    return this.off('poll:started', listener);
  }

  emitCompleted(payload: PollCompletedEvent): boolean {
    return this.emit('poll:completed', payload);
  }

  onCompleted(listener: (payload: PollCompletedEvent) => void): this {
    return this.on('poll:completed', listener);
  }

  offCompleted(listener: (payload: PollCompletedEvent) => void): this {
    return this.off('poll:completed', listener);
  }
}

export const pollEvents = new PollEventEmitter();
