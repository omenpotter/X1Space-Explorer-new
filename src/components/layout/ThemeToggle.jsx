import React, { useState, useEffect, memo } from 'react';
import { Button } from "@/components/ui/button";
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = memo(function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  
  useEffect(() => {
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('x1space-theme');
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
      if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
    }
  }, []);
  
  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    if (newIsDark) {
      document.body.classList.remove('light-theme');
      localStorage.setItem('x1space-theme', 'dark');
    } else {
      document.body.classList.add('light-theme');
      localStorage.setItem('x1space-theme', 'light');
    }
  };
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </Button>
  );
});

export default ThemeToggle;