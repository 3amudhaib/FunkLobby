
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home, Package, Download, Library, Users,
  Heart, Settings, Info, Gamepad2, Monitor, ArrowUp,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/installed', icon: Package, label: 'Installed' },
  { to: '/engines', icon: Monitor, label: 'Engines' },
  { to: '/downloads', icon: Download, label: 'Downloads' },
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/profiles', icon: Users, label: 'Profiles' },
  { to: '/favorites', icon: Heart, label: 'Favorites' },
  { to: '/updates', icon: ArrowUp, label: 'Updates' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/about', icon: Info, label: 'About' },
];

export function Sidebar() {
  return (
    <motion.aside
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed left-0 top-10 bottom-0 w-56 glass border-r border-white/[0.06] z-40 flex flex-col"
    >
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, var(--theme-primary), #9333ea)` }}>
          <Gamepad2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">FunkLobby</h1>
          <p className="text-[10px] text-surface-500">Mod Manager</p>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `sidebar-item text-sm ${isActive ? 'active' : ''}`
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/[0.06]">
        <p className="text-[10px] text-surface-500 text-center">FunkLobby v1.0.0</p>
      </div>
    </motion.aside>
  );
}
