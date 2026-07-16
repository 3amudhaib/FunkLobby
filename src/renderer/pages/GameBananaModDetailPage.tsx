import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Download, ExternalLink, Clock, HardDrive, ThumbsUp, Eye,
  ChevronDown, ChevronUp, User, Tag, MessageCircle, Loader2,
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { formatCount } from '../utils/format';
import { useTranslation } from '../hooks/useTranslation';

type Tab = 'description' | 'comments';

export function GameBananaModDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('description');

  // Comments state
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsTotalPages, setCommentsTotalPages] = useState(0);
  const [commentsError, setCommentsError] = useState('');

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

  const gameBananaId = id?.match(/^gb_(\d+)$/)?.[1];

  const loadComments = async (page: number = 1) => {
    if (!gameBananaId) return;
    setCommentsLoading(true);
    setCommentsError('');
    try {
      const result = await window.electronAPI.getModComments(Number(gameBananaId), page);
      if (page === 1) {
        setComments(result.comments);
      } else {
        setComments(prev => [...prev, ...result.comments]);
      }
      setCommentsPage(page);
      setCommentsTotal(result.total);
      setCommentsTotalPages(result.totalPages);
    } catch {
      setCommentsError('Failed to load comments');
    }
    setCommentsLoading(false);
  };

  const handleLoadMore = () => {
    if (!commentsLoading && commentsPage < commentsTotalPages) {
      loadComments(commentsPage + 1);
    }
  };

  // Load comments when switching to comments tab
  useEffect(() => {
    if (activeTab === 'comments' && comments.length === 0 && !commentsLoading && gameBananaId) {
      loadComments(1);
    }
  }, [activeTab]);

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
  const commentCount = detail._nCommentCount || 0;
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

  const CommentSkeleton = () => (
    <div className="flex gap-3 p-3 rounded-xl bg-surface-800/50 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-surface-700 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 bg-surface-700 rounded" />
        <div className="h-3 w-full bg-surface-700 rounded" />
        <div className="h-3 w-3/4 bg-surface-700 rounded" />
      </div>
    </div>
  );

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
              {commentCount > 0 && (
                <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {formatCount(commentCount)}</span>
              )}
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

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-8 border-b border-surface-700/50">
          <button
            onClick={() => setActiveTab('description')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'description'
                ? 'text-primary-300 border-primary-500'
                : 'text-surface-400 border-transparent hover:text-surface-200'
            }`}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === 'comments'
                ? 'text-primary-300 border-primary-500'
                : 'text-surface-400 border-transparent hover:text-surface-200'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Comments
            {commentCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700/50 text-surface-400">
                {commentCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'description' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2 space-y-6">
              <section className="card p-5">
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

              {installGuide && (
                <section className="card p-5">
                  <h2 className="text-sm font-semibold text-white mb-3">Installation Guide</h2>
                  <div className="text-sm text-surface-300 whitespace-pre-wrap">{installGuide}</div>
                </section>
              )}

              {changelog && (
                <section className="card p-5">
                  <h2 className="text-sm font-semibold text-white mb-3">Changelog</h2>
                  <div className="text-sm text-surface-300 whitespace-pre-wrap max-h-60 overflow-y-auto">{changelog}</div>
                </section>
              )}
            </div>

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
                  <div className="flex justify-between">
                    <span className="text-surface-400">Views</span>
                    <span className="text-white">{formatCount(viewCount)}</span>
                  </div>
                  {commentCount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-surface-400">Comments</span>
                      <span className="text-white">{formatCount(commentCount)}</span>
                    </div>
                  )}
                </div>
              </section>

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

              {requirements && (
                <section className="card p-5">
                  <h2 className="text-sm font-semibold text-white mb-3">Requirements</h2>
                  <p className="text-sm text-surface-300 whitespace-pre-wrap">{requirements}</p>
                </section>
              )}

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
        ) : (
          /* Comments tab */
          <div className="mt-6 space-y-3">
            {commentsError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {commentsError}
              </div>
            )}

            {commentsLoading && comments.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <CommentSkeleton key={i} />)}
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-10 h-10 text-surface-600 mx-auto mb-3" />
                <p className="text-surface-400 text-sm">No comments yet</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {comments.map((comment: any) => (
                    <div key={comment.id} className="flex gap-3 p-3 rounded-xl bg-surface-800/50">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-700 shrink-0">
                        {comment.avatarUrl ? (
                          <img src={comment.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-surface-400">
                            {comment.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{comment.username}</span>
                          {comment.isOP && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-300 border border-primary-500/20">OP</span>
                          )}
                          <span className="text-[10px] text-surface-500 ml-auto">{formatDate(comment.date)}</span>
                        </div>
                        <div className="text-sm text-surface-300 mt-1 whitespace-pre-wrap break-words">
                          {comment.body}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {commentsLoading && (
                  <div className="space-y-3 mt-3">
                    {[1, 2].map(i => <CommentSkeleton key={i} />)}
                  </div>
                )}

                {commentsPage < commentsTotalPages && !commentsLoading && (
                  <button
                    className="w-full py-2.5 rounded-xl border border-surface-700/50 text-sm text-surface-400 hover:text-white hover:border-surface-600/50 transition-colors flex items-center justify-center gap-2"
                    onClick={handleLoadMore}
                  >
                    <Loader2 className="w-4 h-4" />
                    Load More ({commentsTotal - comments.length} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
