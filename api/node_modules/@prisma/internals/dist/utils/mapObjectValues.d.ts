export declare function mapObjectValues<K extends PropertyKey, T, U>(object: Record<K, T>, mapper: (value: T, key: K) => U): Record<K, U>;
