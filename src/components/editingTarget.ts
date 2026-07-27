export interface EditingTarget {
  label: string;
  copy: () => Promise<void>;
  paste: () => Promise<void>;
  selectAll: () => void;
  undo: () => void;
  clear: () => void;
}
