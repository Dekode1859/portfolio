// UI state only — no content data lives here.
// All portfolio content is in src/config.ts.
import { create } from 'zustand';

interface Store {
  activeCluster:  number | null;
  hoveredProject: number | null;
  // 'projects' = normal per-cluster camera + highlights
  // 'matrix'   = global zoom-out, every skill edge lit simultaneously
  viewMode:       'projects' | 'matrix';
  // Hides the section headline during the Hero section
  headerVisible:  boolean;
}

export const useStore = create<Store>()(() => ({
  activeCluster:  null,
  hoveredProject: null,
  viewMode:       'projects',
  headerVisible:  false,
}));
