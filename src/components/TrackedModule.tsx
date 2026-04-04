import { ReactNode } from "react";
import { useModuleTracker } from "@/hooks/use-module-tracker";

export const TrackedModule = ({ moduleId, children }: { moduleId: string; children: ReactNode }) => {
  useModuleTracker(moduleId);
  return <>{children}</>;
};
