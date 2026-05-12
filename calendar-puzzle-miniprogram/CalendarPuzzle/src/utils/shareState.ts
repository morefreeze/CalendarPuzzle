import type { Difficulty } from './puzzleGenerator';

export interface ShareablePuzzle {
  difficulty: Difficulty;
  difficultyLabel: string;
  seed: number;
  dateStr: string;
}

let _current: ShareablePuzzle | null = null;

export function setShareablePuzzle(p: ShareablePuzzle | null): void {
  _current = p;
}

export function getShareablePuzzle(): ShareablePuzzle | null {
  return _current;
}

export function buildSharePath(p: ShareablePuzzle | null): string {
  if (!p) return '/pages/index/index';
  const q = `d=${encodeURIComponent(p.difficulty)}&s=${p.seed}&date=${encodeURIComponent(p.dateStr)}`;
  return `/pages/index/index?${q}`;
}

export function buildShareTitle(p: ShareablePuzzle | null): string {
  if (!p) return '日历拼图 — 来挑战今天的题目！';
  return `日历拼图「${p.difficultyLabel}」挑战 — 来比比谁快！`;
}
