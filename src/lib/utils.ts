import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function truncateFileName(fileName: string, maxLength: number = 25): string {
    if (fileName.length <= maxLength) return fileName;
    
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0) {
        return fileName.substring(0, maxLength - 3) + '...';
    }
    
    const extension = fileName.substring(lastDotIndex);
    const nameWithoutExt = fileName.substring(0, lastDotIndex);
    
    const charsForName = maxLength - extension.length - 3;
    if (charsForName <= 0) {
        return fileName.substring(0, maxLength - 3) + '...';
    }
    
    const charsAtStart = Math.ceil(charsForName / 2);
    const charsAtEnd = Math.floor(charsForName / 2);
    
    return nameWithoutExt.substring(0, charsAtStart) + '...' + nameWithoutExt.substring(nameWithoutExt.length - charsAtEnd) + extension;
}
