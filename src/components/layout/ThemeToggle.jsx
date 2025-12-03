import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('x1space-theme') !== 'light';
    }
    return true;
  });
  
  const applyTheme = useCallback((dark) => {
    const root = document.documentElement;
    const body = document.body;
    
    if (dark) {
      root.classList.remove('light-theme');
      body.classList.remove('light-theme');
      root.setAttribute('data-theme', 'dark');
      body.style.backgroundColor = '#1d2d3a';
      body.style.color = '#ffffff';
    } else {
      root.classList.add('light-theme');
      body.classList.add('light-theme');
      root.setAttribute('data-theme', 'light');
      body.style.backgroundColor = '#f8fafc';
      body.style.color = '#1e293b';
    }
  }, []);
  
  useEffect(() => {
    applyTheme(isDark);
  }, [isDark, applyTheme]);
  
  const toggleTheme = useCallback(() => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    localStorage.setItem('x1space-theme', newIsDark ? 'dark' : 'light');
    applyTheme(newIsDark);
  }, [isDark, applyTheme]);
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={`rounded-lg transition-all duration-300 ${isDark ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10' : 'text-yellow-600 bg-yellow-100 hover:bg-yellow-200'}`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </Button>
  );
}