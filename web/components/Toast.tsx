'use client';

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';

type ToastKind = 'success' | 'error' | 'message';

interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastCtx {
  push: (text: string, kind?: ToastKind) => void;
  success: (text: string) => void;
  error: (text: string) => void;
}

const Ctx = createContext<ToastCtx>(null as unknown as ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems(p => p.filter(i => i.id !== id));
  }, []);

  const push = useCallback((text: string, kind: ToastKind = 'message') => {
    const id = ++idRef.current;
    setItems(p => [...p.slice(-4), { id, kind, text }]);
    setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  const value: ToastCtx = {
    push,
    success: (t: string) => push(t, 'success'),
    error: (t: string) => push(t, 'error'),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {items.map(i => (
          <div
            key={i.id}
            className={`animate-slide-up flex items-center gap-2 px-4 py-3 rounded-xl border text-sm shadow-xl shadow-black/50 bg-dark-700 backdrop-blur-md ${
              i.kind === 'error' ? 'border-red-500/40' : i.kind === 'success' ? 'border-green-500/30' : 'border-white/10'
            }`}
          >
            {i.kind === 'success' && <FiCheckCircle className="text-accent flex-shrink-0" />}
            {i.kind === 'error' && <FiAlertCircle className="text-red-400 flex-shrink-0" />}
            {i.kind === 'message' && <FiInfo className="text-white/40 flex-shrink-0" />}
            <span className="text-white/90 flex-1">{i.text}</span>
            <button onClick={() => dismiss(i.id)} className="text-white/30 hover:text-white flex-shrink-0">
              <FiX className="text-xs" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  return useContext(Ctx);
}
