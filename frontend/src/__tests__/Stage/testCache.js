// Test cache

import {Cache} from "../../Map/Cache";

// Create cache object before each test
const cache = new Cache(4, "http://localhost:80");
beforeEach(() => {
    // Clear cache
    cache.cache.clear();
});

// Test add_batch method
// ----------------------------------------------------------------------------
test('add_batch method', async () => {
    // Add batch of elements to the cache
    await cache.add_batch(["1-Alfred_Sisley.jpg", "2-Alfred_Sisley.jpg"]);

    // Check that the cache has the correct size
    expect(cache.cache.size).toBe(2);

    // Check that the cache has the correct elements
    expect(cache.cache.has("1-Alfred_Sisley.jpg")).toBe(true);
    expect(cache.cache.has("2-Alfred_Sisley.jpg")).toBe(true);

    // Check that adding the same batch of elements again does not change the cache
    await cache.add_batch(["1-Alfred_Sisley.jpg", "2-Alfred_Sisley.jpg"]);
    expect(cache.cache.size).toBe(2);
    expect(cache.cache.has("1-Alfred_Sisley.jpg")).toBe(true);
    expect(cache.cache.has("2-Alfred_Sisley.jpg")).toBe(true);

    // Add four new elements to the cache
    await cache.add_batch(["3-Alfred_Sisley.jpg", "4-Alfred_Sisley.jpg", "5-Alfred_Sisley.jpg", "6-Alfred_Sisley.jpg"]);
    expect(cache.cache.size).toBe(4);
    expect(cache.cache.has("3-Alfred_Sisley.jpg")).toBe(true);
    expect(cache.cache.has("4-Alfred_Sisley.jpg")).toBe(true);
    expect(cache.cache.has("5-Alfred_Sisley.jpg")).toBe(true);
    expect(cache.cache.has("6-Alfred_Sisley.jpg")).toBe(true);

    // Add non-existing element to the cache
    await cache.add_batch(["non-existing-image.jpg"]);
    // Check that the new element is not in the cache
    expect(cache.cache.has("non-existing-image.jpg")).toBe(false);
});

// Test get method
// ----------------------------------------------------------------------------
test('get method', async () => {
    // Add batch of elements to the cache
    await cache.add_batch(["1-Alfred_Sisley.jpg", "2-Alfred_Sisley.jpg"]);

    // Get element from the cache
    const image = await cache.get("1-Alfred_Sisley.jpg");
    expect(image).toBeDefined();

    // Check that the cache has the correct size
    expect(cache.cache.size).toBe(2);

    // Check that the cache has the correct elements
    expect(cache.cache.has("1-Alfred_Sisley.jpg")).toBe(true);
    expect(cache.cache.has("2-Alfred_Sisley.jpg")).toBe(true);

    // Try to get an element that is not in the cache
    const image_not_in_cache = await cache.get("3-Alfred_Sisley.jpg");
    expect(image_not_in_cache).toBeNull();

    // Check that the element is at the end of the cache
    const iterator = cache.cache.keys();
    expect(iterator.next().value).toBe("2-Alfred_Sisley.jpg");
    expect(iterator.next().value).toBe("1-Alfred_Sisley.jpg");
});