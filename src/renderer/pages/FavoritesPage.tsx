import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { ModCard } from '../components/ModCard';
import { SearchBar } from '../components/SearchBar';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { useModStore } from '../stores/modStore';
import { useTranslation } from '../hooks/useTranslation';

export function FavoritesPage() {
  const { t } = useTranslation();
  const { library, fetchLibrary } = useModStore();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLibrary({ favorites: true }).finally(() => setLoading(false));
  }, []);

  const favorites = library.filter((m) => m.isFavorited);

  if (loading) return <div className="page-container pt-14"><LoadingSpinner className="mt-20" /></div>;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('favorites.title')}</h1>
            <p className="text-surface-400 text-sm mt-1">{t('favorites.subtitle', { count: favorites.length })}</p>
          </div>
          <SearchBar value={query} onChange={setQuery} placeholder={t('favorites.searchPlaceholder')} className="w-64" />
        </div>

        {favorites.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={t('favorites.empty')}
            description={t('favorites.emptyHint')}
            action={{ label: t('favorites.browseMods'), onClick: () => window.location.hash = '#/' }}
          />
        ) : (
          <div className="mod-grid">
            {favorites
              .filter((m) => !query || m.title.toLowerCase().includes(query.toLowerCase()))
              .map((mod, i) => (
                <ModCard key={mod.id} mod={mod} index={i} />
              ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
