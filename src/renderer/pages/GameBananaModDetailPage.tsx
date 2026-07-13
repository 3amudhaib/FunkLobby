import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Download, ExternalLink, Clock, HardDrive, ThumbsUp, Eye,
  ChevronDown, ChevronUp, Star, User, Tag, CheckCircle, XCircle, Loader2,
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { formatCount } from '../utils/format';
import { useTranslation } from '../hooks/useTranslation';

export function GameBananaModDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const gbMatch = id.match(/^gb_(\d+)$/);
    if (!gbMatch) {
      setError('Invalid mod ID');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await window.electronAPI.discoverGetRichDetails(Number(gbMatch[1]));
        if (data) {
          setDetail(data);
        } else {
          setError('Could not load mod details');
        }
      } catch {
        setError('Failed to load mod details');
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="page-container pt-14"><LoadingSpinner className="mt-20" /></div>;
  if (error || !detail) return (
    <div className="page-container pt-14">
      <button className="flex items-center gap-2 text-sm text-surface-400 hover:text-white mb-4 transition-colors" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <p className="text-surface-400">{error || 'Mod not found'}</p>
    </div>
  );

  const name = detail.name || detail._sName || 'Unknown Mod';
  const author = detail['Owner().name'] || detail._aSubmitter?._sName || 'Unknown';
  const description = detail.text || detail._sDescription || '';
  const profileUrl = detail['Url().sProfileUrl()'] || detail._sProfileUrl || `https://gamebanana.com/mods/${id?.replace('gb_', '')}`;
  const thumbnailUrl = detail['Preview().sSubFeedImageUrl()'] || '';
  const downloadCount = detail._nDownloadCount || detail.downloads || 0;
  const likeCount = detail._nLikeCount || 0;
  const viewCount = detail._nViewCount || 0;
  const version = detail._sVersion || '1.0.0';
  const files = detail['Files().aFiles()'] || {};
  const firstFile = Object.values(files)[0] as any;
  const downloadUrl = firstFile?._sDownloadUrl || '';
  const fileSize = firstFile?._nFilesize || 0;
  const category = detail['Category().name'] || 'Other';

  const screenshots: string[] = [];
  const media = (detail as any).aPreviewMedia;
  if (media?._aImages) {
    for (const img of media._aImages) {
      if (img._sBaseUrl && img._sFile) screenshots.push(`${img._sBaseUrl}/${img._sFile}`);
    }
  }
  const screenshotsData = detail['Screenshots().aScreenShots()'];
  if (screenshotsData && typeof screenshotsData === 'object') {
    for (const [_, s] of Object.entries(screenshotsData) as any) {
      if (s?._sBaseUrl && s?._sFile) screenshots.push(`${s._sBaseUrl}/${s._sFile}`);
    }
  }

  const credits: any[] = [];
  const creditsData = detail['Credits().aCredit()'];
  if (creditsData && typeof creditsData === 'object') {
    for (const [_, c] of Object.entries(creditsData) as any) {
      credits.push(c);
    }
  }

  const dependencies: any[] = [];
  const depsData = detail['Dependencies().aDependencies()'];
  if (depsData && typeof depsData === 'object') {
    for (const [_, d] of Object.entries(depsData) as any) {
      dependencies.push(d);
    }
  }

  const requirements = detail['Requirements().sRequirements()'] || '';
  const installGuide = detail['Installation().sInstallationGuide()'] || '';
  const changelog = detail['Changelog().sChangelog()'] || '';

  const links: Array<{ name: string; url: string }> = [];
  const linksData = detail['Links().aLinks()'];
  if (linksData && typeof linksData === 'object') {
    for (const [_, l] of Object.entries(linksData) as any) {
      if (l._sLinkUrl) links.push({ name: l._sCaption || l._sLinkUrl, url: l._sLinkUrl });
    }
  }

  const formatDate = (raw: any) => {
    const ts = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    if (Number.isFinite(ts) && ts > 0) {
      const d = new Date(ts * 1000);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return 'N/A';
  };

  const handleDownload = async () => {
    if (!downloadUrl) return;
    try {
      const fileName = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
      const gbMatch2 = id?.match(/^gb_(\d+)$/);
      const url = downloadUrl || (gbMatch2 ? `https://gamebanana.com/mods/download/${gbMatch2[1]}` : '');
      if (url) {
        await window.electronAPI.startDownload({ modId: id || '', url, fileName });
      }
    } catch {}
  };

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <button
          className="flex items-center gap-2 text-sm text-surface-400 hover:text-white mb-4 transition-colors"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Banner */}
        <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden mb-6">
          {screenshots.length > 0 ? (
            <img src={screenshots[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-800 to-purple-800 flex items-center justify-center">
              <HardDrive className="w-12 h-12 text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-transparent to-transparent" />
        </div>

        {/* Title & actions */}
        <div className="flex flex-col md:flex-row gap-6">
          <div className="relative">
            <div className="w-24 h-24 md:w-32 md:h-32 -mt-16 md:-mt-20 relative z-10 rounded-xl overflow-hidden border-2 border-surface-800 flex-shrink-0">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-surface-700 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white/40">{name.charAt(0)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">{name}</h1>
                <p className="text-surface-400 mt-1">by {author} &middot; v{version}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Open on GameBanana"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              </div>
            </div>

            {category && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="badge-primary">{category}</span>
              </div>
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-surface-400 flex-wrap">
              <span className="flex items-center gap-1"><Download className="w-3.5 h-3.5" /> {formatCount(downloadCount)} downloads</span>
              <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> {formatCount(likeCount)}</span>
              <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {formatCount(viewCount)}</span>
              {fileSize > 0 && (
                <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" /> {(fileSize / 1024 / 1024).toFixed(1)} MB</span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-4">
              {downloadUrl && (
                <button className="btn-primary text-sm flex items-center gap-2" onClick={handleDownload}>
                  <Download className="w-4 h-4" /> Download
                </button>
              )}
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-sm flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Open on GameBanana
              </a>
            </div>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Description</h2>
              <div className={`text-sm text-surface-300 leading-relaxed whitespace-pre-wrap ${!showFullDesc ? 'line-clamp-4' : ''}`}>
                {description || 'No description provided.'}
              </div>
              {description.length > 300 && (
                <button
                  className="text-xs text-primary-400 hover:text-primary-300 mt-2 flex items-center gap-1"
                  onClick={() => setShowFullDesc(!showFullDesc)}
                >
                  {showFullDesc ? 'Show less' : 'Show more'}
                  {showFullDesc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </section>

            {/* Screenshots / Gallery */}
            {screenshots.length > 1 && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-white mb-3">Gallery</h2>
                <div className="grid grid-cols-2 gap-3">
                  {screenshots.slice(1).map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Screenshot ${i + 1}`} className="rounded-lg w-full h-32 object-cover" loading="lazy" />
                  ))}
                </div>
              </section>
            )}

            {/* Installation Guide */}
            {installGuide && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-white mb-3">Installation Guide</h2>
                <div className="text-sm text-surface-300 whitespace-pre-wrap">{installGuide}</div>
              </section>
            )}

            {/* Changelog */}
            {changelog && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-white mb-3">Changelog</h2>
                <div className="text-sm text-surface-300 whitespace-pre-wrap max-h-60 overflow-y-auto">{changelog}</div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-surface-400">Author</span>
                  <span className="text-white">{author}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Version</span>
                  <span className="text-white">v{version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Category</span>
                  <span className="text-white">{category}</span>
                </div>
                {fileSize > 0 && (
                  <div className="flex justify-between">
                    <span className="text-surface-400">File Size</span>
                    <span className="text-white">{(fileSize / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-surface-400">Downloads</span>
                  <span className="text-white">{formatCount(downloadCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Likes</span>
                  <span className="text-white">{formatCount(likeCount)}</span>
                </div>
              </div>
            </section>

            {/* Credits */}
            {credits.length > 0 && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary-400" /> Credits
                </h2>
                <div className="space-y-1">
                  {credits.map((c: any, i: number) => (
                    <div key={i} className="text-xs text-surface-300 p-2 rounded-lg bg-surface-800/50">
                      <span className="text-white font-medium">{c._sName || c.name || 'Unknown'}</span>
                      {c._sRole && <span className="text-surface-500 ml-1">- {c._sRole}</span>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Dependencies */}
            {dependencies.length > 0 && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary-400" /> Dependencies
                </h2>
                <div className="space-y-1">
                  {dependencies.map((d: any, i: number) => (
                    <div key={i} className="text-xs text-surface-300 p-2 rounded-lg bg-surface-800/50">
                      {d._sName || d.name || d}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Requirements */}
            {requirements && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-white mb-3">Requirements</h2>
                <p className="text-sm text-surface-300 whitespace-pre-wrap">{requirements}</p>
              </section>
            )}

            {/* Links */}
            {links.length > 0 && (
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-white mb-3">Links</h2>
                <div className="space-y-1">
                  {links.map((l: any, i: number) => (
                    <a
                      key={i}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-primary-400 hover:text-primary-300 p-2 rounded-lg bg-surface-800/50"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {l.name || l.url}
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
