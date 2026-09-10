import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Helper gaya shadcn: gabung class Tailwind dengan aman. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
