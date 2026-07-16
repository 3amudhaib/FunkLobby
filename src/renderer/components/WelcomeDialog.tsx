import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Sparkles, Download, Layers, Zap } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

interface WelcomeDialogProps {
  open: boolean;
  onDismiss: () => void;
}

export function WelcomeDialog({ open, onDismiss }: WelcomeDialogProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg glass rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/40 p-6"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 shrink-0">
                <Compass className="w-7 h-7 text-primary-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Welcome to FunkLobby</h2>
                <p className="text-sm text-surface-400 mt-1">
                  Your all-in-one mod manager for Friday Night Funkin'
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { icon: Sparkles, title: 'Discover Mods', desc: 'Browse thousands of FNF mods from GameBanana with powerful search and filters.' },
                { icon: Download, title: 'Easy Installation', desc: 'Download and install mods in one click. Auto-detect engines and manage profiles.' },
                { icon: Layers, title: 'Engine Manager', desc: 'Install, launch, and manage multiple FNF engines. Switch between them seamlessly.' },
                { icon: Zap, title: 'One-Click Launch', desc: 'Launch any mod with the right engine instantly. No more manual setup.' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03]">
                  <div className="p-1.5 rounded-lg bg-primary-500/10 shrink-0">
                    <item.icon className="w-4 h-4 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-surface-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onDismiss}
              className="w-full py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors"
            >
              {t('welcome.getStarted') || 'Get Started'}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
