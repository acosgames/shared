

module.exports = {
    isObject: (x) => {
        return x != null && (typeof x === 'object' || typeof x === 'function') && !Array.isArray(x);
    }
}