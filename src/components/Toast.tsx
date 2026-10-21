// ── Toast.tsx: lightweight transient notifications ──────────────────────────
import React, { useEffect, useState } from 'react';
import { create } from 'zustand';

interface ToastItem { id: number; msg: string; kind: 'good' | 'warn' | ''; }
interface ToastState {
  items: ToastItem[];
  push(msg: string, kind?: ToastItem['kind']): void;
  drop(id: number): void;
}
let nid = 1;
export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (msg, kind = '') => {
    const id = nid++;
    set({ items: [...get().items, { id, msg, kind }] });
    setTimeout(() => get().drop(id), 3400);
  },
  drop: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

export const toast = (msg: string, kind?: ToastItem['kind']) => useToasts.getState().push(msg, kind);

export function ToastHost() {
  const items = useToasts((s) => s.items);
  return (
    <div className="toast-wrap">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>
      ))}
    </div>
  );
}
