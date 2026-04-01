import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-10 px-4 text-center"
  >
    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
      <Icon className="w-7 h-7 text-muted-foreground/60" />
    </div>
    <h4 className="text-sm font-semibold mb-1">{title}</h4>
    <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <Button onClick={onAction} variant="outline" size="sm" className="mt-4 text-xs">
        {actionLabel}
      </Button>
    )}
  </motion.div>
);
