import { useEffect } from 'react';
import { useDownloadStore } from '../stores/downloadStore';

export function useDownloadEvents() {
  const updateProgress = useDownloadStore((s) => s.updateProgress);
  const fetchQueue = useDownloadStore((s) => s.fetchQueue);

  useEffect(() => {
    window.electronAPI.onDownloadProgress((data) => {
      updateProgress(data);
    });

    window.electronAPI.onDownloadComplete((data) => {
      fetchQueue();
    });

    window.electronAPI.onDownloadError((data) => {
      fetchQueue();
    });

    fetchQueue();
  }, []);
}
