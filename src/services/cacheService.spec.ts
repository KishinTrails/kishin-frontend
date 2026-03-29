import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getCellTypeFromCache,
    setCellTypeInCache,
    syncCacheToDisk,
} from './cacheService';

// Mock localStorage implementation
class MockStorage {
    store: Map<string, string> = new Map();

    getItem(key: string): string | null {
        return this.store.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.store.set(key, value);
    }

    clear(): void {
        this.store.clear();
    }

    removeItem(key: string): void {
        this.store.delete(key);
    }
}

const mockStorage = new MockStorage();

// Helper to reset the internal module state
// We need to access the internal cacheMap to reset it between tests
function resetCacheServiceState(): void {
    // Clear mock storage
    mockStorage.clear();
    
    // Reset localStorage mock
    vi.stubGlobal('localStorage', mockStorage);
    
    // We need to reload the module to reset its internal state
    // This is a workaround for the module's singleton state
    vi.resetModules();
    
    // Re-import to get fresh module state
    // The cacheMap will be null after reset
    import('./cacheService');
}

describe('cacheService', () => {
    beforeEach(() => {
        resetCacheServiceState();
    });

    describe('getCellTypeFromCache', () => {
        it('should return null when cache is empty', async () => {
            // After reset, cache should be empty
            const result = getCellTypeFromCache('8a1f96069aeffff');
            expect(result).toBeNull();
        });

        it('should return null when cell is not in cache', async () => {
            const { setCellTypeInCache } = await import('./cacheService');
            
            setCellTypeInCache('8a1f96069aeffff', 'peak');
            
            const { getCellTypeFromCache } = await import('./cacheService');
            const result = getCellTypeFromCache('8a1f96333ffffff');
            expect(result).toBeNull();
        });

        it('should return the cell type when cell exists in cache', async () => {
            const { setCellTypeInCache, getCellTypeFromCache } = await import('./cacheService');
            
            setCellTypeInCache('8a1f96069aeffff', 'peak');
            
            const result = getCellTypeFromCache('8a1f96069aeffff');
            expect(result).toBe('peak');
        });

        it('should return different cell types correctly', async () => {
            const { setCellTypeInCache, getCellTypeFromCache } = await import('./cacheService');
            
            setCellTypeInCache('cell1', 'peak');
            setCellTypeInCache('cell2', 'natural');
            setCellTypeInCache('cell3', 'industrial');
            
            expect(getCellTypeFromCache('cell1')).toBe('peak');
            expect(getCellTypeFromCache('cell2')).toBe('natural');
            expect(getCellTypeFromCache('cell3')).toBe('industrial');
        });
    });

    describe('setCellTypeInCache', () => {
        it('should add new cell to cache', async () => {
            const { setCellTypeInCache, getCellTypeFromCache } = await import('./cacheService');
            
            setCellTypeInCache('8a1f96069aeffff', 'peak');
            
            expect(getCellTypeFromCache('8a1f96069aeffff')).toBe('peak');
        });

        it('should overwrite existing cell type', async () => {
            const { setCellTypeInCache, getCellTypeFromCache } = await import('./cacheService');
            
            setCellTypeInCache('8a1f96069aeffff', 'peak');
            setCellTypeInCache('8a1f96069aeffff', 'natural');
            
            expect(getCellTypeFromCache('8a1f96069aeffff')).toBe('natural');
        });

        it('should handle all cell types', async () => {
            const { setCellTypeInCache, getCellTypeFromCache } = await import('./cacheService');
            
            setCellTypeInCache('cell1', 'peak');
            setCellTypeInCache('cell2', 'natural');
            setCellTypeInCache('cell3', 'industrial');
            setCellTypeInCache('cell4', 'none');
            
            expect(getCellTypeFromCache('cell1')).toBe('peak');
            expect(getCellTypeFromCache('cell2')).toBe('natural');
            expect(getCellTypeFromCache('cell3')).toBe('industrial');
            expect(getCellTypeFromCache('cell4')).toBe('none');
        });
    });

    describe('syncCacheToDisk', () => {
        it('should persist cache to localStorage', async () => {
            const { setCellTypeInCache, syncCacheToDisk } = await import('./cacheService');
            
            setCellTypeInCache('cell1', 'peak');
            setCellTypeInCache('cell2', 'natural');
            syncCacheToDisk();
            
            expect(mockStorage.getItem('kishin_cell_cache')).toBe(
                JSON.stringify({ cell1: 'peak', cell2: 'natural' })
            );
        });

        it('should handle empty cache', async () => {
            const { syncCacheToDisk } = await import('./cacheService');
            
            // Should not throw
            expect(() => syncCacheToDisk()).not.toThrow();
            
            // Should write empty object
            expect(mockStorage.getItem('kishin_cell_cache')).toBe('{}');
        });

        it('should handle localStorage being full', async () => {
            // Create a failing storage
            const failingStorage = {
                getItem: () => null,
                setItem: () => { throw new Error('QuotaExceededError'); },
                clear: () => {},
                removeItem: () => {},
            };
            vi.stubGlobal('localStorage', failingStorage);
            
            // Need to reset module to pick up new localStorage
            vi.resetModules();
            const { setCellTypeInCache, syncCacheToDisk } = await import('./cacheService');
            
            setCellTypeInCache('cell1', 'peak');
            
            // Should not throw even when localStorage fails
            expect(() => syncCacheToDisk()).not.toThrow();
        });
    });

    describe('integration - cache persists in memory until sync', () => {
        it('should accumulate changes in memory before syncing', async () => {
            const { 
                setCellTypeInCache, 
                getCellTypeFromCache,
                syncCacheToDisk 
            } = await import('./cacheService');
            
            // Add multiple cells without syncing
            setCellTypeInCache('cell1', 'peak');
            setCellTypeInCache('cell2', 'natural');
            setCellTypeInCache('cell3', 'industrial');
            
            // All should be retrievable from memory
            expect(getCellTypeFromCache('cell1')).toBe('peak');
            expect(getCellTypeFromCache('cell2')).toBe('natural');
            expect(getCellTypeFromCache('cell3')).toBe('industrial');
            
            // Now sync
            syncCacheToDisk();
            
            // localStorage should have all entries
            const stored = JSON.parse(mockStorage.getItem('kishin_cell_cache') || '{}');
            expect(stored).toEqual({
                cell1: 'peak',
                cell2: 'natural',
                cell3: 'industrial',
            });
        });

        it('should load from localStorage on cache initialization', async () => {
            // Pre-populate localStorage
            mockStorage.setItem('kishin_cell_cache', JSON.stringify({
                preloaded: 'peak',
                another: 'natural',
            }));
            
            // Reset and re-import to simulate fresh load
            vi.resetModules();
            const { getCellTypeFromCache } = await import('./cacheService');
            
            // Should load from localStorage on first access
            expect(getCellTypeFromCache('preloaded')).toBe('peak');
            expect(getCellTypeFromCache('another')).toBe('natural');
            expect(getCellTypeFromCache('nonexistent')).toBeNull();
        });
    });
});