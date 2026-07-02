"use client";
import { useEffect } from "react";

function MobileLogger() {
  useEffect(() => {
    const original = console.log;
    const logs: string[] = [];
    let isOpen = true;

    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "position:fixed;bottom:0;left:0;right:0;z-index:9999;font-family:monospace;";
    document.body.appendChild(wrapper);

    const toolbar = document.createElement("div");
    toolbar.style.cssText =
      "background:#1a1a1a;color:lime;font-size:11px;padding:4px 8px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #333;";
    toolbar.innerHTML = `<span>🪲 Console</span>`;
    wrapper.appendChild(toolbar);

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "−";
    toggleBtn.style.cssText =
      "background:transparent;border:1px solid #444;color:lime;cursor:pointer;padding:0 6px;border-radius:4px;font-size:12px;line-height:1.4;";
    toolbar.appendChild(toggleBtn);

    const panel = document.createElement("div");
    panel.style.cssText =
      "background:black;color:lime;font-size:10px;max-height:200px;overflow:auto;padding:8px;";
    wrapper.appendChild(panel);

    const render = () => {
      panel.innerHTML = logs
        .slice(-20)
        .map((l) => `<pre style="margin:0;white-space:pre-wrap">${l}</pre>`)
        .join("");
      panel.scrollTop = panel.scrollHeight;
    };

    toggleBtn.addEventListener("click", () => {
      isOpen = !isOpen;
      panel.style.display = isOpen ? "block" : "none";
      toggleBtn.textContent = isOpen ? "−" : "+";
    });

    console.log = (...args) => {
      original(...args);
      const formatted = args.map((arg) => {
        if (typeof arg === "object" && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      });
      logs.push(formatted.join(" "));
      render();
    };

    return () => {
      console.log = original;
      document.body.removeChild(wrapper);
    };
  }, []);

  return null;
}

export default MobileLogger;
