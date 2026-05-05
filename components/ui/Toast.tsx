"use client";

import { useState, createContext, useContext, useCallback } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "info" | "error";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

const TOAST_CONFIG: Record<ToastType, { icon: React.ElementType; cls: string; iconCls: string }> = {
  success: {
    icon:    CheckCircle2,
    cls:     "bg-white border-zinc-200 text-zinc-700",
    iconCls: "text-brand-500",
  },
  info: {
    icon:    Info,
    cls:     "bg-white border-zinc-200 text-zinc-700",
    iconCls: "text-blue-500",
  },
  error: {
    icon:    AlertCircle,
    cls:     "bg-white border-red-200 text-zinc-700",
    iconCls: "text-red-500",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { icon: Icon, cls, iconCls } = TOAST_CONFIG[toast.type];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium min-w-[220px]",
        cls
      )}
    >
      <Icon size={16} className={cn("shrink-0", iconCls)} />
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="ml-1 text-zinc-300 hover:text-zinc-600 transition-colors shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
