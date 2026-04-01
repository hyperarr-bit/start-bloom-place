import { useState, useEffect, useCallback } from "react";

interface QueuedOperation {
  id: string;
  action: string;
  data: any;
  timestamp: number;
}

const STORAGE_KEY = "core-offline-queue";

export const useOfflineQueue = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueuedOperation[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Persist queue to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }, [queue]);

  const enqueue = useCallback((action: string, data: any) => {
    setQueue(prev => [...prev, { id: Date.now().toString(), action, data, timestamp: Date.now() }]);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const pendingCount = queue.length;

  return { isOnline, queue, enqueue, clearQueue, pendingCount };
};
