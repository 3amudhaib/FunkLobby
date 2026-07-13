import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

interface SmartScreenNoticeProps {
  open: boolean;
  onDismiss: (dontShowAgain: boolean) => void;
}

export function SmartScreenNotice({ open, onDismiss }: SmartScreenNoticeProps) {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

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
            className="relative w-full max-w-md glass rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/40 p-6"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 rounded-xl bg-amber-500/10 shrink-0">
                <ShieldAlert className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{t('smartScreen.title')}</h2>
                <div className="mt-3 space-y-3 text-sm text-surface-300 leading-relaxed">
                  <p>{t('smartScreen.message')}</p>
                  <p>{t('smartScreen.reassurance')}</p>
                  <p>{t('smartScreen.future')}</p>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2.5 py-3 px-1 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-surface-600 bg-surface-800 accent-blue-500
                  focus:ring-2 focus:ring-blue-500/40 focus:outline-none
                  cursor-pointer"
              />
              <span className="text-sm text-surface-400 group-hover:text-surface-300 transition-colors select-none">
                {t('smartScreen.dontShowAgain')}
              </span>
            </label>

            <button
              onClick={() => onDismiss(dontShowAgain)}
              className="w-full mt-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500
                text-white text-sm font-medium transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {t('smartScreen.gotIt')}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
