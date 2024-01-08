export const DATASET = "best_artworks";

// Define class for a cache with lru policy
export class Cache {
    constructor(max_size, host= "") {
        this.max_size = max_size;
        this.host = host;
        // Define map of path-image pairs
        this.cache = new Map();
    }

    // Define method for adding a batch of elements to the cache
    async add_batch(batch) {
        // If the cache is full, then remove the least recently used elements
        if (this.cache.size + batch.length > this.max_size) {
            // Get iterator for the cache
            const iterator = this.cache.keys();
            // Remove elements from the cache, but only those that are not in the batch
            const current_size = this.cache.size;
            for (let i = 0; i < current_size - this.max_size + batch.length; i++) {
                // Get key of the least recently used element. The least recently used element is the first element in the cache.
                // This is because the cache is implemented as a Map, whose elements are ordered by insertion order.
                const key_to_remove = iterator.next().value;
                // If the key is not in the batch, then remove it from the cache. Remember that batch is an array of paths
                if (!batch.includes(key_to_remove)) {
                    // Remove element from the cache
                    this.cache.delete(key_to_remove);
                }
            }
        }
        // Add elements that are not already in the cache to the cache
        for (let i = 0; i < batch.length; i++) {
            if (!this.cache.has(batch[i])) {
                // Fetch image from the server
                const url = `${this.host}/${DATASET}/${batch[i]}`;
                const image = await fetch(url, {
                    method: 'GET',
                })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Image with path ' + batch[i] + ' could not be retrieved from the server.' +
                                ' Please make sure the path is correct. Status: ' + response.status + ' ' + response.statusText);
                        }
                        return response.blob();
                    })
                    .catch(error => {
                        // Handle any errors that occur during the fetch operation
                        console.error(error);
                    });
                // Add image to the cache if not undefined
                if (image !== undefined) {
                    this.cache.set(batch[i], image);
                }
            }
        }
    }

    // Define function for getting an element from the cache
    get(key) {
        // If the key is in the cache, then return the value
        if (this.cache.has(key)) {
            // Put the element at the end of the cache
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }
        // Else return null
        else {
            return null;
        }
    }
}