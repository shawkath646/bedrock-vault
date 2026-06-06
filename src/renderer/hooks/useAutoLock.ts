import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function useAutoLock(isDecryptedShowing: boolean): void {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== "/decrypted-content" || !isDecryptedShowing) {
      window.ipcRenderer.send("stop-security-timer");
      return;
    }

    window.ipcRenderer.send("start-security-timer");

    const unsubscribe = window.ipcRenderer.on("vault-locked-inactivity", () => {
      navigate("/", { replace: true });
    });

    const pingActivity = throttle(() => {
      window.ipcRenderer.send("ping-activity");
    }, 1000);

    window.addEventListener("mousemove", pingActivity);
    window.addEventListener("keydown", pingActivity);
    window.addEventListener("click", pingActivity);
    window.addEventListener("scroll", pingActivity);

    return () => {
      window.removeEventListener("mousemove", pingActivity);
      window.removeEventListener("keydown", pingActivity);
      window.removeEventListener("click", pingActivity);
      window.removeEventListener("scroll", pingActivity);
      
      if (unsubscribe) {
        unsubscribe();
      }
      
      window.ipcRenderer.send("stop-security-timer");
    };
  }, [location.pathname, isDecryptedShowing, navigate]);
}
