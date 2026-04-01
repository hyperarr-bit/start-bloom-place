import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOfflineQueue } from "@/hooks/use-offline-queue";

export const OfflineBanner = () => {
  const { isOnline, pendingCount } = useOfflineQueue();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-warning text-warning-foreground py-2 px-4 flex items-center justify-center gap-2 text-xs font-medium"
        >
          <WifiOff className="w-3.5 h-3.5" />
          Modo offline {pendingCount > 0 && `— ${pendingCount} alteração(ões) pendente(s)`}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
