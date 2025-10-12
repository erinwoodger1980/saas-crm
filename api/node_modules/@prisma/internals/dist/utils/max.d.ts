/**
 * Accepts an array and comparator function (similar to Array.prototype.sort)
 * and returns max element of that array, ordered with that comparator.
 * Functionally, equivalent of items.sort(comparator).at(-1), but performed non-destructively
 * in O(n)
 * @param items
 * @param comparator callback specifying the relative order of two items. See `Array.prototype.sort`
 * @returns
 */
export declare function maxWithComparator<T>(items: T[], comparator: (a: T, b: T) => number): T | undefined;
export declare function maxBy<T>(items: T[], callback: (item: T) => number): T | undefined;
