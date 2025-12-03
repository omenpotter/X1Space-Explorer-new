import React, { useState, useEffect, memo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = memo(function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    // Initialize from localStorage synchronously
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('x1space-theme');
      return saved !== 'light';
    }
    return true;
  });
  
  // Apply theme on mount and when isDark changes
  useEffect(() => {
    const applyTheme = (dark) => {
      if (dark) {
        document.body.classList.remove('light-theme');
        document.documentElement.classList.remove('light-theme');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.body.classList.add('light-theme');
        document.documentElement.classList.add('light-theme');
        document.documentElement.style.colorScheme = 'light';
      }
    };
    
    applyTheme(isDark);
    localStorage.setItem('x1space-theme', isDark ? 'dark' : 'light');
  }, [isDark]);
  
  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={`rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10' : 'text-yellow-500 hover:text-gray-600 hover:bg-gray-200'}`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </Button>
  );
});

export default ThemeToggle;