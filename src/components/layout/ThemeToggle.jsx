import React, { memo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = memo(function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(true);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const newValue = !prev;
      localStorage.setItem('x1_theme', newValue ? 'dark' : 'light');
      document.body.classList.toggle('light-theme', !newValue);
      return newValue;
    });
  }, []);

  React.useEffect(() => {
    const saved = localStorage.getItem('x1_theme');
    if (saved === 'light') {
      setIsDark(false);
      document.body.classList.add('light-theme');
    }
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="text-gray-400 hover:text-white rounded-lg"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </Button>
  );
});

export default ThemeToggle;