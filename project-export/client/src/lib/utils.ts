import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format number with appropriate decimal places
export function formatNumber(value: number | string, decimals: number = 2): string {
  if (typeof value === 'string') {
    value = parseFloat(value);
  }
  
  if (isNaN(value)) return '0';
  
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Format currency
export function formatCurrency(value: number | string, currency: string = 'USD', decimals: number = 2): string {
  if (typeof value === 'string') {
    value = parseFloat(value);
  }
  
  if (isNaN(value)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

// Format percentage
export function formatPercentage(value: number | string, decimals: number = 2): string {
  if (typeof value === 'string') {
    value = parseFloat(value);
  }
  
  if (isNaN(value)) return '0%';
  
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

// Format date
export function formatDate(dateString: string, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const date = new Date(dateString);
  
  switch (format) {
    case 'short':
      return date.toLocaleDateString();
    case 'long':
      return date.toLocaleString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    case 'medium':
    default:
      return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
  }
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

// Truncate middle of text (useful for long IDs, addresses, etc.)
export function truncateMiddle(text: string, startChars: number = 4, endChars: number = 4): string {
  if (text.length <= startChars + endChars) return text;
  return `${text.substring(0, startChars)}...${text.substring(text.length - endChars)}`;
}

// Convert hex color to RGBA
export function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}
