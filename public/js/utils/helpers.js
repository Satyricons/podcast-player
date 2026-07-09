// public/js/utils/helpers.js

/**
 * Форматирование длительности в минуты
 */
export function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Обрезка текста до заданной длины
 */
export function truncateText(text, maxLength = 80) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * Дебаунс для поиска
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Безопасное получение значения из объекта
 */
export function safeGet(obj, path, defaultValue = '') {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result === null || result === undefined || typeof result !== 'object') {
            return defaultValue;
        }
        result = result[key];
    }
    return result !== undefined && result !== null ? result : defaultValue;
}