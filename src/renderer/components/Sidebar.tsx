import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home, Package, Download, Library, Users,
  Heart, Settings, Info, Monitor, ArrowUp, Stethoscope,
} from 'lucide-react';
import { SidebarHeader } from './SidebarHeader';
import { useTranslation } from '../hooks/useTranslation';

export function Sidebar() {
  const { t } = useTranslation();

const navItems = [
  { to: '/', icon: Home, label: t('nav.home') },
  { to: '/installed', icon: Package, label: t('nav.installed') },
  { to: '/engines', icon: Monitor, label: t('nav.engines') },
  { to: '/downloads', icon: Download, label: t('nav.downloads') },
  { to: '/library', icon: Library, label: t('nav.library') },
  { to: '/profiles', icon: Users, label: t('nav.profiles') },
  { to: '/favorites', icon: Heart, label: t('nav.favorites') },
  { to: '/updates', icon: ArrowUp, label: t('nav.updates') },
  { to: '/settings', icon: Settings, label: t('nav.settings') },
  { to: '/diagnostics', icon: Stethoscope, label: 'Diagnostics' },
  { to: '/about', icon: Info, label: t('nav.about') },
];
  return (
    <motion.aside
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed left-0 top-10 bottom-0 w-56 glass border-r border-white/[0.06] z-40 flex flex-col"
    >
      <SidebarHeader />

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
        <p className="text-[10px] text-surface-500 text-center">{t('app.name')} {t('app.version')}</p>
      </div>
    </motion.aside>
  );
}
