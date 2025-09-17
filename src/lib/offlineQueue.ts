interface QueueJob {
  id: string;
  type: 'upload' | 'insert_session' | 'insert_swing' | 'insert_metrics';
  payload: any;
  client_request_id: string;
  retries: number;
  created_at: number;
}

class OfflineQueue {
  private dbName = 'swing_app';
  private storeName = 'pending_writes';
  private db: IDBDatabase | null = null;
  private isProcessing = false;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('client_request_id', 'client_request_id', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  async enqueue(job: Omit<QueueJob, 'id' | 'retries' | 'created_at'>): Promise<void> {
    await this.init();
    
    const fullJob: QueueJob = {
      ...job,
      id: crypto.randomUUID(),
      retries: 0,
      created_at: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      
      store.add(fullJob);
    });
  }

  async dequeue(): Promise<QueueJob[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      transaction.oncomplete = () => resolve(request.result || []);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async remove(jobId: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      
      store.delete(jobId);
    });
  }

  async updateRetries(jobId: string, retries: number): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const getRequest = store.get(jobId);
      getRequest.onsuccess = () => {
        const job = getRequest.result;
        if (job) {
          job.retries = retries;
          store.put(job);
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) {
      return;
    }

    this.isProcessing = true;

    try {
      const jobs = await this.dequeue();
      
      for (const job of jobs) {
        try {
          // Dynamic import to avoid circular dependencies
          const { retryJob } = await import('./persistence');
          await retryJob(job);
          await this.remove(job.id);
        } catch (error) {
          console.warn(`Job ${job.id} failed, retry ${job.retries + 1}:`, error);
          
          if (job.retries >= 5) {
            console.error(`Job ${job.id} failed after 5 retries, removing from queue`);
            await this.remove(job.id);
          } else {
            await this.updateRetries(job.id, job.retries + 1);
            // Exponential backoff: 500ms -> 1s -> 2s -> 4s -> 8s
            const delay = Math.min(500 * Math.pow(2, job.retries), 10000);
            setTimeout(() => this.processQueue(), delay);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  setupListeners(): void {
    // Process queue when coming back online
    window.addEventListener('online', () => {
      this.processQueue();
    });

    // Also process on app start
    if (navigator.onLine) {
      // Small delay to let the app initialize
      setTimeout(() => this.processQueue(), 1000);
    }
  }
}

export const offlineQueue = new OfflineQueue();

// Initialize listeners when module loads
offlineQueue.setupListeners();