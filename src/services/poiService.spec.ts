import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchCellTypes, fetchCellType, CellType } from './poiService';

// Mock dependencies
vi.mock('./authService', () => ({
    getToken: vi.fn(),
}));

vi.mock('./cacheService', () => ({
    getCellTypeFromCache: vi.fn(),
    setCellTypeInCache: vi.fn(),
    syncCacheToDisk: vi.fn(),
}));

// Import after mocks are set up
import { getToken } from './authService';
import { getCellTypeFromCache, setCellTypeInCache, syncCacheToDisk } from './cacheService';

const mockGetToken = getToken as ReturnType<typeof vi.fn>;
const mockGetCellTypeFromCache = getCellTypeFromCache as ReturnType<typeof vi.fn>;
const mockSetCellTypeInCache = setCellTypeInCache as ReturnType<typeof vi.fn>;
const mockSyncCacheToDisk = syncCacheToDisk as ReturnType<typeof vi.fn>;

// Mock fetch globally
let mockFetch: ReturnType<typeof vi.fn>;

function setupFetchMock() {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
}

function resetAllMocks() {
    mockGetToken.mockReturnValue(null);
    mockGetCellTypeFromCache.mockReturnValue(null);
    mockSetCellTypeInCache.mockClear();
    mockSyncCacheToDisk.mockClear();
    if (mockFetch) {
        mockFetch.mockClear();
    }
}

describe('poiService', () => {
    beforeEach(() => {
        setupFetchMock();
        resetAllMocks();
    });

    describe('fetchCellTypes', () => {
        it('should return empty Map when all cells are already cached', async () => {
            mockGetCellTypeFromCache.mockReturnValue('peak');
            
            const result = await fetchCellTypes(['cell1', 'cell2']);
            
            expect(result).toEqual(new Map());
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should return empty Map when input array is empty', async () => {
            const result = await fetchCellTypes([]);
            
            expect(result).toEqual(new Map());
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should only fetch uncached cells', async () => {
            mockGetCellTypeFromCache
                .mockReturnValueOnce('peak')  // cell1 cached
                .mockReturnValueOnce(null);   // cell2 not cached
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ cells: [{ h3_cell: 'cell2', type: 'natural' }] }),
            });
            
            await fetchCellTypes(['cell1', 'cell2']);
            
            // Should only call fetch for cell2
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should set cells to "none" when API returns 204 No Content', async () => {
            mockGetCellTypeFromCache.mockReturnValue(null);
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 204,
                json: async () => ({}),
            });
            
            const result = await fetchCellTypes(['cell1', 'cell2']);
            
            expect(mockSetCellTypeInCache).toHaveBeenCalledWith('cell1', 'none');
            expect(mockSetCellTypeInCache).toHaveBeenCalledWith('cell2', 'none');
            expect(mockSyncCacheToDisk).toHaveBeenCalled();
        });

        it('should return Map with cell types on valid API response', async () => {
            mockGetCellTypeFromCache.mockReturnValue(null);
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    cells: [
                        { h3_cell: 'cell1', type: 'peak' },
                        { h3_cell: 'cell2', type: 'natural' },
                    ],
                }),
            });
            
            const result = await fetchCellTypes(['cell1', 'cell2']);
            
            expect(result.get('cell1')).toBe('peak');
            expect(result.get('cell2')).toBe('natural');
        });

        it('should set found cells to type and unfound to "none"', async () => {
            mockGetCellTypeFromCache.mockReturnValue(null);
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    cells: [
                        { h3_cell: 'cell1', type: 'peak' },
                        // cell2 has no data
                    ],
                }),
            });
            
            await fetchCellTypes(['cell1', 'cell2']);
            
            expect(mockSetCellTypeInCache).toHaveBeenCalledWith('cell1', 'peak');
            expect(mockSetCellTypeInCache).toHaveBeenCalledWith('cell2', 'none');
        });

        it('should handle multiple batches when >100 cells', async () => {
            mockGetCellTypeFromCache.mockReturnValue(null);
            
            // Create 150 cells
            const cells = Array.from({ length: 150 }, (_, i) => `cell${i}`);
            
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ cells: [] }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ cells: [] }),
                });
            
            await fetchCellTypes(cells);
            
            // Should make 2 calls (100 + 50)
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should include Authorization header when token exists', async () => {
            mockGetToken.mockReturnValue('mock-token');
            mockGetCellTypeFromCache.mockReturnValue(null);
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ cells: [] }),
            });
            
            await fetchCellTypes(['cell1']);
            
            const fetchCall = mockFetch.mock.calls[0];
            const headers = fetchCall[1]?.headers as Record<string, string>;
            expect(headers?.['Authorization']).toBe('Bearer mock-token');
        });

        it('should not include Authorization header when no token', async () => {
            mockGetToken.mockReturnValue(null);
            mockGetCellTypeFromCache.mockReturnValue(null);
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ cells: [] }),
            });
            
            await fetchCellTypes(['cell1']);
            
            const fetchCall = mockFetch.mock.calls[0];
            const headers = fetchCall[1]?.headers as Record<string, string>;
            expect(headers?.['Authorization']).toBeUndefined();
        });

        it('should catch fetch errors and continue', async () => {
            mockGetCellTypeFromCache.mockReturnValue(null);
            
            mockFetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ cells: [{ h3_cell: 'cell2', type: 'peak' }] }),
                });
            
            // Should not throw
            await expect(fetchCellTypes(['cell1', 'cell2'])).resolves.not.toThrow();
        });
    });

    describe('fetchCellType', () => {
        it('should return cache hit with peak type', async () => {
            mockGetCellTypeFromCache.mockReturnValue('peak');
            
            const result = await fetchCellType('cell1');
            
            expect(result).toEqual({ type: 'peak', cacheHit: true });
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should return cache hit with null for "none" type', async () => {
            mockGetCellTypeFromCache.mockReturnValue('none');
            
            const result = await fetchCellType('cell1');
            
            expect(result).toEqual({ type: null, cacheHit: true });
        });

        it('should make API call when cell not in cache', async () => {
            mockGetCellTypeFromCache.mockReturnValue(null);
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    h3_cell: 'cell1',
                    type: 'natural',
                    center: { lat: 45.0, lng: 3.0 },
                    count: 1,
                }),
            });
            
            const result = await fetchCellType('cell1');
            
            expect(result).toEqual({ type: 'natural', cacheHit: false });
            expect(mockSetCellTypeInCache).toHaveBeenCalledWith('cell1', 'natural');
            expect(mockSyncCacheToDisk).toHaveBeenCalled();
        });

        it('should return null type when API returns error', async () => {
            mockGetCellTypeFromCache.mockReturnValue(null);
            
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });
            
            const result = await fetchCellType('cell1');
            
            expect(result).toEqual({ type: null, cacheHit: false });
        });

        it('should include Authorization header when token exists', async () => {
            mockGetToken.mockReturnValue('mock-token');
            mockGetCellTypeFromCache.mockReturnValue(null);
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ h3_cell: 'cell1', type: 'peak', center: { lat: 45, lng: 3 }, count: 1 }),
            });
            
            await fetchCellType('cell1');
            
            const fetchCall = mockFetch.mock.calls[0];
            const options = fetchCall[1] as { headers: Record<string, string> };
            expect(options?.headers?.['Authorization']).toBe('Bearer mock-token');
        });

        it('should update cache after successful fetch', async () => {
            mockGetCellTypeFromCache.mockReturnValue(null);
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    h3_cell: 'cell1',
                    type: 'industrial',
                    center: { lat: 45.0, lng: 3.0 },
                    count: 1,
                }),
            });
            
            await fetchCellType('cell1');
            
            expect(mockSetCellTypeInCache).toHaveBeenCalledWith('cell1', 'industrial');
            expect(mockSyncCacheToDisk).toHaveBeenCalled();
        });
    });
});