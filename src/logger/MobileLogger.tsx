"use client";
import { useEffect } from "react";

const safeStringify = (obj: unknown): string => {
  try {
    return JSON.stringify(
      obj,
      (key, val) => {
        if (typeof val === "bigint") return val.toString() + "n";
        if (typeof val === "function") return "[Function]";
        if (typeof val === "undefined") return "[undefined]";
        return val;
      },
      2
    );
  } catch {
    return String(obj);
  }
};

function MobileLogger() {
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const logs: string[] = [];
    let isOpen = true;

    // wrapper
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "position:fixed;bottom:0;left:0;right:0;z-index:9999;font-family:monospace;";
    document.body.appendChild(wrapper);

    // toolbar
    const toolbar = document.createElement("div");
    toolbar.style.cssText =
      "background:#1a1a1a;color:lime;font-size:11px;padding:4px 8px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #333;";
    toolbar.innerHTML = `<span>🪲 Console</span>`;
    wrapper.appendChild(toolbar);

    // toggle button
    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "−";
    toggleBtn.style.cssText =
      "background:transparent;border:1px solid #444;color:lime;cursor:pointer;padding:0 6px;border-radius:4px;font-size:12px;line-height:1.4;";
    toolbar.appendChild(toggleBtn);

    // clear button
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "clear";
    clearBtn.style.cssText =
      "background:transparent;border:1px solid #444;color:#aaa;cursor:pointer;padding:0 6px;border-radius:4px;font-size:12px;line-height:1.4;margin-right:auto;margin-left:8px;";
    toolbar.insertBefore(clearBtn, toggleBtn);

    // log panel
    const panel = document.createElement("div");
    panel.style.cssText =
      "background:black;color:lime;font-size:10px;max-height:500px;overflow:auto;padding:8px;";
    wrapper.appendChild(panel);

    const render = () => {
      panel.innerHTML = logs
        .slice(-20)
        .map(
          (l) =>
            `<pre style="margin:0;white-space:pre-wrap;border-bottom:1px solid #222;padding-bottom:4px;">${l}</pre>`
        )
        .join("");
      panel.scrollTop = panel.scrollHeight;
    };

    const formatArgs = (prefix: string, args: unknown[]): string => {
      const formatted = args.map((arg) => {
        if (typeof arg === "bigint") return arg.toString() + "n";
        if (typeof arg === "object" && arg !== null) return safeStringify(arg);
        return String(arg);
      });
      return `${prefix}${formatted.join(" ")}`;
    };

    toggleBtn.addEventListener("click", () => {
      isOpen = !isOpen;
      panel.style.display = isOpen ? "block" : "none";
      toggleBtn.textContent = isOpen ? "−" : "+";
    });

    clearBtn.addEventListener("click", () => {
      logs.length = 0;
      render();
    });

    console.log = (...args) => {
      originalLog(...args);
      logs.push(formatArgs("", args));
      render();
    };

    console.error = (...args) => {
      originalError(...args);
      logs.push(formatArgs("🔴 ", args));
      render();
    };

    console.warn = (...args) => {
      originalWarn(...args);
      logs.push(formatArgs("🟡 ", args));
      render();
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      document.body.removeChild(wrapper);
    };
  }, []);

  return null;
}

export default MobileLogger;
