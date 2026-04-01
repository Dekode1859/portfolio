// UI state only — no content data lives here.
// All portfolio content is in src/config.ts.
import { create } from 'zustand';

interface Store {
  activeCluster:  number | null;   // null = global, 1-3 = project, 4 = skills polyhedron
  hoveredProject: number | null;
}

export const useStore = create<Store>()(() => ({
  activeCluster:  null,
  hoveredProject: null,
}));
