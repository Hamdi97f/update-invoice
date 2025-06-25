// This file is no longer needed as we're using SQLite for all storage
// Keeping an empty file to avoid import errors in case it's referenced elsewhere
export function useLocalStorage<T>(key: string, initialValue: T) {
  console.warn('useLocalStorage is deprecated. The application now uses SQLite for all storage.');
  
  // Return a dummy implementation that logs warnings
  return [
    initialValue,
    () => {
      console.warn('Attempted to use localStorage in desktop-only mode. This operation has no effect.');
    }
  ] as const;
}