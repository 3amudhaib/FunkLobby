import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Trash2, Check, Star } from 'lucide-react';
import { useProfileStore } from '../stores/profileStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { GlassDialog } from '../components/GlassDialog';

export function ProfilesPage() {
  const { profiles, currentProfile, fetchProfiles, createProfile, deleteProfile, setDefault, switchProfile } = useProfileStore();
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    fetchProfiles().finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createProfile(newName.trim(), newDesc.trim() || undefined);
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
  };

  const handleSwitch = async (id: string) => {
    await switchProfile(id);
  };

  if (loading) return <div className="page-container pt-14"><LoadingSpinner className="mt-20" /></div>;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Profiles</h1>
            <p className="text-surface-400 text-sm mt-1">Manage your mod profiles</p>
          </div>
          <button className="btn-primary text-sm flex items-center gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        </div>

        {profiles.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No profiles"
            description="Create your first profile to organize your mods."
            action={{ label: 'Create Profile', onClick: () => setShowCreate(true) }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile, i) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`card p-5 relative overflow-hidden ${currentProfile?.id === profile.id ? 'ring-2 ring-primary-500/50' : ''}`}
              >
                <div
                  className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
                  style={{ backgroundColor: profile.color, transform: 'translate(30%, -30%)' }}
                />

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                      style={{ backgroundColor: profile.color + '20', color: profile.color }}
                    >
                      {profile.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{profile.name}</h3>
                      {profile.description && (
                        <p className="text-[11px] text-surface-400 mt-0.5">{profile.description}</p>
                      )}
                    </div>
                  </div>
                  {profile.isDefault && (
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-surface-500">
                    {(profile._count?.installs || 0)} mods installed
                  </span>
                  <div className="flex items-center gap-1">
                    {!profile.isDefault && (
                      <button
                        className="p-1.5 hover:bg-white/5 rounded-lg text-surface-400 hover:text-red-400 transition-colors"
                        onClick={() => deleteProfile(profile.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {currentProfile?.id !== profile.id && (
                      <button
                        className="btn-secondary text-[10px] px-2 py-1"
                        onClick={() => handleSwitch(profile.id)}
                      >
                        Switch
                      </button>
                    )}
                    {currentProfile?.id === profile.id && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <GlassDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Profile"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Profile Name</label>
            <input
              className="input text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Vanilla, Horror Mods, Sonic Mods"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Description (optional)</label>
            <input
              className="input text-sm"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What will this profile be used for?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary text-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn-primary text-sm" onClick={handleCreate}>Create</button>
          </div>
        </div>
      </GlassDialog>
    </div>
  );
}
