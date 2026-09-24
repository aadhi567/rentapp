import React, { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "../api";

const ThemeContext = createContext({
  theme: "system",
  effectiveTheme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem("rentease_theme") || "system";
  });

  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // Listen to OS system color scheme changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemDark(e.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
    } else {
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, []);

  const effectiveTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Apply data-theme attribute on root <html> element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    document.documentElement.style.colorScheme = effectiveTheme;
  }, [effectiveTheme]);

  const setTheme = (newTheme) => {
    if (!["light", "dark", "system"].includes(newTheme)) return;
    setThemeState(newTheme);
    localStorage.setItem("rentease_theme", newTheme);

    // If logged in as landlord, optionally sync preference to backend
    const token = localStorage.getItem("access_token");
    if (token) {
      fetch(`${API_URL}/notification-preferences/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ theme: newTheme }),
      }).catch(() => {
        // Silent catch: local state and storage already updated
      });
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
