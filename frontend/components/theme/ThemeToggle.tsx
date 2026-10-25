"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // The inline script in layout.tsx already set the class before first paint; just read it.
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("thesis_theme", next ? "dark" : "light"); } catch { /* storage unavailable */ }
    setDark(next);
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle dark mode" className="w-8 px-0">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}