import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  
  // Initialize theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('x1space-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved ? saved === 'dark' : prefersDark;
    setIsDark(shouldBeDark);
    applyTheme(shouldBeDark);
  }, []);
  
  const applyTheme = (dark) => {
    const html = document.documentElement;
    const body = document.body;
    
    if (dark) {
      html.classList.remove('light-theme');
      body.classList.remove('light-theme');
      html.style.colorScheme = 'dark';
      body.style.backgroundColor = '#1d2d3a';
      body.style.color = '#ffffff';
    } else {
      html.classList.add('light-theme');
      body.classList.add('light-theme');
      html.style.colorScheme = 'light';
      body.style.backgroundColor = '#f8fafc';
      body.style.color = '#1e293b';
    }
  };
  
  const toggleTheme = useCallback(() => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    localStorage.setItem('x1space-theme', newIsDark ? 'dark' : 'light');
    applyTheme(newIsDark);
  }, [isDark]);
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={`rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10' : 'text-yellow-500 bg-yellow-100 hover:bg-yellow-200'}`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </Button>
  );
}