import { create } from 'zustand';

interface ProfileState {
  profiles: any[];
  currentProfile: any | null;

  fetchProfiles: () => Promise<void>;
  createProfile: (name: string, description?: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  updateProfile: (id: string, data: any) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  currentProfile: null,

  fetchProfiles: async () => {
    try {
      const profiles = await window.electronAPI.getProfiles();
      const current = profiles.find((p: any) => p.isDefault) || profiles[0];
      set({ profiles, currentProfile: current });
    } catch {}
  },

  createProfile: async (name, description) => {
    await window.electronAPI.createProfile(name, description);
    await get().fetchProfiles();
  },

  deleteProfile: async (id) => {
    await window.electronAPI.deleteProfile(id);
    await get().fetchProfiles();
  },

  setDefault: async (id) => {
    await window.electronAPI.setDefaultProfile(id);
    await get().fetchProfiles();
  },

  switchProfile: async (id) => {
    await window.electronAPI.switchProfile(id);
    await get().fetchProfiles();
  },

  updateProfile: async (id, data) => {
    await window.electronAPI.updateProfile(id, data);
    await get().fetchProfiles();
  },
}));
