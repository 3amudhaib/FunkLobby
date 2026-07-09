import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { ModCard } from '../components/ModCard';
import { SearchBar } from '../components/SearchBar';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { useModStore } from '../stores/modStore';

export function FavoritesPage() {
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
            <h1 className="text-2xl font-bold text-white">Favorites</h1>
            <p className="text-surface-400 text-sm mt-1">{favorites.length} favorited mods</p>
          </div>
          <SearchBar value={query} onChange={setQuery} placeholder="Search favorites..." className="w-64" />
        </div>

        {favorites.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No favorites yet"
            description="Click the heart icon on any mod to add it to your favorites."
            action={{ label: 'Browse Mods', onClick: () => window.location.hash = '#/' }}
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
