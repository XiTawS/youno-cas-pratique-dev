import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper shadcn standard pour composer des classes Tailwind avec dédup.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
