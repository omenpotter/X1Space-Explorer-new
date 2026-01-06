import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Button } from "@/components/ui/button";

export function useFavorites(type = 'validators') {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem(`favorites_${type}`);
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        setFavorites([]);
      }
    }
  }, [type]);

  const toggleFavorite = (id) => {
    const newFavorites = favorites.includes(id)
      ? favorites.filter(f => f !== id)
      : [...favorites, id];
    
    setFavorites(newFavorites);
    localStorage.setItem(`favorites_${type}`, JSON.stringify(newFavorites));
  };

  const isFavorite = (id) => favorites.includes(id);

  return { favorites, toggleFavorite, isFavorite };
}

export function FavoriteButton({ id, type = 'validators', className = '' }) {
  const { isFavorite, toggleFavorite } = useFavorites(type);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(id);
      }}
      className={`${className} hover:bg-transparent`}
      aria-label={isFavorite(id) ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star 
        className={`w-4 h-4 ${isFavorite(id) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`}
      />
    </Button>
  );
}