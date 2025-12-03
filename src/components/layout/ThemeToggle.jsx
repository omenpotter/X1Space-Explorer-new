import React, { memo, useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = memo(function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    // Initialize from localStorage synchronously
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('x1_theme');
      return saved !== 'light';
    }
    return true;
  });

  // Apply theme on mount and when isDark changes
  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light-theme');
      document.documentElement.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.documentElement.classList.add('light-theme');
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const newValue = !prev;
      localStorage.setItem('x1_theme', newValue ? 'dark' : 'light');
      return newValue;
    });
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="text-gray-400 hover:text-white rounded-lg"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </Button>
  );
});

export default ThemeToggle;