import { useState, useEffect, useCallback } from 'react';

interface UseKeyboardNavigationProps<T> {
  items: T[];
  isOpen: boolean;
  onSelect: (item: T, index: number) => void;
  onClose: () => void;
  getItemId?: (item: T, index: number) => string;
}

export function useKeyboardNavigation<T>({
  items,
  isOpen,
  onSelect,
  onClose,
  getItemId = (_, index) => `item-${index}`
}: UseKeyboardNavigationProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Reset selected index when dropdown opens/closes or items change
  useEffect(() => {
    if (!isOpen) {
      setSelectedIndex(-1);
    }
  }, [isOpen, items]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen || items.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev < items.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : items.length - 1
        );
        break;
      
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          onSelect(items[selectedIndex], selectedIndex);
        }
        break;
      
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, items, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && isOpen) {
      const element = document.getElementById(getItemId(items[selectedIndex], selectedIndex));
      if (element) {
        element.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen, items, getItemId]);

  return {
    selectedIndex,
    setSelectedIndex,
    getItemProps: (item: T, index: number) => ({
      id: getItemId(item, index),
      className: `${index === selectedIndex ? 'bg-blue-100' : 'hover:bg-gray-100'} cursor-pointer`,
      onMouseEnter: () => setSelectedIndex(index),
      onClick: () => onSelect(item, index)
    })
  };
}
