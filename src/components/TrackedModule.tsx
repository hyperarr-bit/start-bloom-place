import { ReactNode } from "react";
import { useModuleTracker, TabTrackContext } from "@/hooks/use-module-tracker";

export const TrackedModule = ({ moduleId, children }: { moduleId: string; children: ReactNode }) => {
  const reportTab = useModuleTracker(moduleId);
  return <TabTrackContext.Provider value={reportTab}>{children}</TabTrackContext.Provider>;
};
