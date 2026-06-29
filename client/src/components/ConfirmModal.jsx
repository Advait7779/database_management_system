import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, CloseIcon } from './Icons';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="glass-card p-6 w-full max-w-sm relative z-10">
            <h3 className="text-lg font-bold font-display text-primary mb-2">{title}</h3>
            <p className="text-sm text-secondary mb-6">{message}</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">
                <CloseIcon size={16} /> Cancel
              </button>
              <button onClick={onConfirm} className="btn-danger flex-1">
                <CheckIcon size={16} /> Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
