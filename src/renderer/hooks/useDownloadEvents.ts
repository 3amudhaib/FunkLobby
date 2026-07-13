import { useEffect } from 'react';
import { useDownloadStore } from '../stores/downloadStore';

export function useDownloadEvents() {
  const updateProgress = useDownloadStore((s) => s.updateProgress);
  const fetchQueue = useDownloadStore((s) => s.fetchQueue);
  const removeActiveDownload = useDownloadStore((s) => s.removeActiveDownload);

  useEffect(() => {
    const progressCb = (data: any) => updateProgress(data);
    const completeCb = (data: any) => {
      removeActiveDownload(data.downloadId || data.modId);
      fetchQueue();
    };
    const errorCb = (data: any) => {
      removeActiveDownload(data.downloadId || data.modId);
      fetchQueue();
    };

    window.electronAPI.onDownloadProgress(progressCb);
    window.electronAPI.onDownloadComplete(completeCb);
    window.electronAPI.onDownloadError(errorCb);

    fetchQueue();

    const pollInterval = setInterval(() => {
      fetchQueue();
    }, 5000);

    return () => {
      window.electronAPI.removeDownloadProgressListener(progressCb);
      window.electronAPI.removeDownloadCompleteListener(completeCb);
      window.electronAPI.removeDownloadErrorListener(errorCb);
      clearInterval(pollInterval);
    };
  }, []);
}
