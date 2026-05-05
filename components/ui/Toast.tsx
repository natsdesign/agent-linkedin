"use client";

import { useState, createContext, useContext, useCallback } from "react";
import { X } from "lucide-react";
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
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium backdrop-blur-sm min-w-[220px]",
        toast.type === "error"
          ? "bg-red-950/95 border-red-700/50 text-red-200"
          : "bg-gray-900/95 border-gray-700 text-gray-200"
      )}
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full shrink-0",
          toast.type === "error" ? "bg-red-400" : "bg-brand-400"
        )}
      />
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="ml-1 text-gray-600 hover:text-gray-300 transition-colors shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
