import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Heart, Play, FolderOpen, ExternalLink, Clock, HardDrive, DownloadCloud, Tag, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useModStore } from '../stores/modStore';
import { useDownloadStore } from '../stores/downloadStore';
import { useProfileStore } from '../stores/profileStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatBytes, formatDate, formatNumber } from '../utils/format';

export function ModDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedMod, setSelectedMod, installMod, toggleFavorite } = useModStore();
  const { startDownload } = useDownloadStore();
  const { profiles, currentProfile, fetchProfiles } = useProfileStore();
  const { settings } = useSettingsStore();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [profileId, setProfileId] = useState<string>('');

  useEffect(() => {
    (async () => {
      if (!id) return;
      const mod = await window.electronAPI.getMod(id);
      setSelectedMod(mod);
      setLoading(false);
    })();
    fetchProfiles();
  }, [id]);

  useEffect(() => {
    if (currentProfile && !profileId) {
      setProfileId(currentProfile.id);
    }
  }, [currentProfile]);

  const handleDownload = async () => {
    if (!selectedMod) return;
    setDownloading(true);
    try {
      const fileName = `${selectedMod.title.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
      // Convert GameBanana page URL to download URL if needed
      let downloadUrl = selectedMod.sourceUrl;
      const gbMatch = downloadUrl?.match(/gamebanana\.com\/mods\/(\d+)/);
      if (gbMatch) {
        downloadUrl = `https://gamebanana.com/mods/download/${gbMatch[1]}`;
      }
      await startDownload({
        modId: selectedMod.id,
        url: downloadUrl,
        fileName,
      });
      useDownloadStore.getState().setQueueVisible(true);
    } catch {}
    setDownloading(false);
  };

  const handleInstall = async () => {
    if (!selectedMod || !profileId) return;
    setInstalling(true);
    try {
      await installMod(selectedMod.id, profileId);
    } catch {}
    setInstalling(false);
  };

  const handleFavorite = async () => {
    if (!selectedMod) return;
    await toggleFavorite(selectedMod.id);
    const updated = await window.electronAPI.getMod(selectedMod.id);
    setSelectedMod(updated);
  };

  const tags = selectedMod?.tags ? selectedMod.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
  const screenshots = (() => {
    if (!selectedMod?.screenshots) return [];
    try { return JSON.parse(selectedMod.screenshots); } catch { return []; }
  })();
  const dependencies = selectedMod?.dependencies ? selectedMod.dependencies.split(',').map((d: string) => d.trim()).filter(Boolean) : [];

  if (loading) return <div className="page-container pt-14"><LoadingSpinner className="mt-20" /></div>;
  if (!selectedMod) return <div className="page-container pt-14"><p className="text-surface-400">Mod not found</p></div>;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <button
          className="flex items-center gap-2 text-sm text-surface-400 hover:text-white mb-4 transition-colors"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden mb-6">
          {selectedMod.bannerUrl ? (
            <img src={selectedMod.bannerUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-primary-900 via-purple-900 to-surface-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-transparent to-transparent" />
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-24 h-24 md:w-32 md:h-32 -mt-16 md:-mt-20 relative z-10 rounded-xl overflow-hidden border-2 border-surface-800 flex-shrink-0">
            {selectedMod.thumbnailUrl ? (
              <img src={selectedMod.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-800 to-purple-800 flex items-center justify-center">
                <HardDrive className="w-8 h-8 text-white/50" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">{selectedMod.title}</h1>
                <p className="text-surface-400 mt-1">
                  by {selectedMod.author} &middot; v{selectedMod.version}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`p-2 rounded-lg transition-colors ${selectedMod.isFavorited ? 'text-red-400 bg-red-500/10' : 'text-surface-400 hover:text-red-400 hover:bg-red-500/10'}`}
                  onClick={handleFavorite}
                >
                  <Heart className={`w-5 h-5 ${selectedMod.isFavorited ? 'fill-red-400' : ''}`} />
                </button>
                <button
                  className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-white/5 transition-colors"
                  onClick={() => window.electronAPI.openModFolder(selectedMod.id)}
                >
                  <FolderOpen className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="badge-primary">{selectedMod.engine}</span>
              <span className="badge-surface">{selectedMod.category || 'Other'}</span>
              {selectedMod.difficulty && <span className="badge-surface">{selectedMod.difficulty}</span>}
              {tags.map((tag: string) => (
                <span key={tag} className="badge-surface">{tag}</span>
              ))}
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-surface-400">
              <span className="flex items-center gap-1"><DownloadCloud className="w-3.5 h-3.5" /> {formatNumber(selectedMod.downloadCount)} downloads</span>
              <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" /> {formatBytes(selectedMod.fileSize)}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Updated {formatDate(selectedMod.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          {!selectedMod.isInstalled ? (
            <>
              <button
                className="btn-primary text-sm flex items-center gap-2"
                onClick={handleDownload}
                disabled={downloading}
              >
                <Download className="w-4 h-4" />
                {downloading ? 'Downloading...' : 'Download'}
              </button>
              <select
                className="input text-sm w-40"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
              >
                {profiles.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                className="btn-primary text-sm flex items-center gap-2"
                onClick={handleInstall}
                disabled={installing}
              >
                <DownloadCloud className="w-4 h-4" />
                {installing ? 'Installing...' : 'Install'}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <button
                className="btn-primary text-sm flex items-center gap-2"
                onClick={() => window.electronAPI.launchMod(selectedMod.id, '')}
              >
                <Play className="w-4 h-4" />
                Launch
              </button>
              <button
                className="btn-secondary text-sm flex items-center gap-2"
                onClick={() => window.electronAPI.openModFolder(selectedMod.id)}
              >
                <FolderOpen className="w-4 h-4" />
                Open Folder
              </button>
              <button
                className="btn-ghost text-sm flex items-center gap-2 text-amber-400 hover:text-amber-300"
                onClick={async () => {
                  if (!profileId) return;
                  setInstalling(true);
                  try {
                    await installMod(selectedMod.id, profileId);
                  } catch {}
                  setInstalling(false);
                }}
                disabled={installing}
              >
                <RefreshCw className="w-4 h-4" />
                {installing ? 'Reinstalling...' : 'Reinstall'}
              </button>
            </div>
          )}
          {selectedMod.homepage && (
            <a
              href={selectedMod.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-sm flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Homepage
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Description</h2>
              <div className={`text-sm text-surface-300 leading-relaxed ${!showFullDesc ? 'line-clamp-4' : ''}`}>
                {selectedMod.description || 'No description provided.'}
              </div>
              {selectedMod.description && selectedMod.description.length > 200 && (
                <button
                  className="text-xs text-primary-400 hover:text-primary-300 mt-2 flex items-center gap-1"
                  onClick={() => setShowFullDesc(!showFullDesc)}
                >
                  {showFullDesc ? 'Show less' : 'Read more'}
                  {showFullDesc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </section>

            {screenshots.length > 0 && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-white mb-3">Screenshots</h2>
                <div className="grid grid-cols-2 gap-3">
                  {screenshots.map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Screenshot ${i + 1}`} className="rounded-lg w-full h-32 object-cover" loading="lazy" />
                  ))}
                </div>
              </section>
            )}

            {selectedMod.changelog && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-white mb-3">Changelog</h2>
                <div className="text-sm text-surface-300 whitespace-pre-wrap">{selectedMod.changelog}</div>
              </section>
            )}
          </div>

          <div className="space-y-4">
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-surface-400">Author</span>
                  <span className="text-white">{selectedMod.author}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Version</span>
                  <span className="text-white">v{selectedMod.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Engine</span>
                  <span className="text-white">{selectedMod.engine}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Category</span>
                  <span className="text-white">{selectedMod.category || 'Other'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Difficulty</span>
                  <span className="text-white">{selectedMod.difficulty || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">File Size</span>
                  <span className="text-white">{formatBytes(selectedMod.fileSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Downloads</span>
                  <span className="text-white">{formatNumber(selectedMod.downloadCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Updated</span>
                  <span className="text-white">{formatDate(selectedMod.updatedAt)}</span>
                </div>
              </div>
            </section>

            {dependencies.length > 0 && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary-400" />
                  Dependencies
                </h2>
                <div className="space-y-1">
                  {dependencies.map((dep: string) => (
                    <div key={dep} className="text-xs text-surface-300 p-2 rounded-lg bg-surface-800/50">
                      {dep}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {selectedMod.requirements && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-white mb-3">Requirements</h2>
                <p className="text-sm text-surface-300">{selectedMod.requirements}</p>
              </section>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
