import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  
  useEffect(() => {
    // Check saved preference
    const saved = localStorage.getItem('x1space-theme');
    if (saved === 'light') {
      setIsDark(false);
      applyLightTheme();
    } else {
      setIsDark(true);
      applyDarkTheme();
    }
  }, []);
  
  const applyDarkTheme = () => {
    document.documentElement.classList.remove('light-theme');
    document.body.classList.remove('light-theme');
    document.documentElement.style.setProperty('--bg-primary', '#1d2d3a');
    document.documentElement.style.setProperty('--bg-secondary', '#24384a');
    document.documentElement.style.setProperty('--text-primary', '#ffffff');
    document.documentElement.style.setProperty('--text-secondary', '#9ca3af');
    document.body.style.backgroundColor = '#1d2d3a';
    document.body.style.color = '#ffffff';
  };
  
  const applyLightTheme = () => {
    document.documentElement.classList.add('light-theme');
    document.body.classList.add('light-theme');
    document.documentElement.style.setProperty('--bg-primary', '#f8fafc');
    document.documentElement.style.setProperty('--bg-secondary', '#ffffff');
    document.documentElement.style.setProperty('--text-primary', '#1e293b');
    document.documentElement.style.setProperty('--text-secondary', '#64748b');
    document.body.style.backgroundColor = '#f8fafc';
    document.body.style.color = '#1e293b';
  };
  
  const toggleTheme = () => {
    if (isDark) {
      setIsDark(false);
      localStorage.setItem('x1space-theme', 'light');
      applyLightTheme();
    } else {
      setIsDark(true);
      localStorage.setItem('x1space-theme', 'dark');
      applyDarkTheme();
    }
  };
  
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