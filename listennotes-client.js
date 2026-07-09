// listennotes-client.js
const dotenv = require('dotenv');
dotenv.config();

const API_KEY = process.env.LISTEN_NOTES_API_KEY;
const BASE_URL = 'https://listen-api.listennotes.com/api/v2';

if (!API_KEY) {
    console.error('❌ LISTEN_NOTES_API_KEY не найден в .env');
    process.exit(1);
}

/**
 * Выполняет запрос к ListenNotes API
 */
async function listenNotesRequest(endpoint, params = {}) {
    const url = new URL(BASE_URL + endpoint);
    
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key]);
        }
    });

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-ListenAPI-Key': API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Ошибка запроса:', error.message);
        throw error;
    }
}

// --- API Методы ---

async function searchPodcasts(query, options = {}) {
    if (!query) throw new Error('Поисковый запрос не может быть пустым.');
    
    const params = {
        q: query,
        sort_by_date: options.sortByDate || 0,
        type: options.type || 'episode',
        offset: options.offset || 0,
        len_min: options.lenMin || 0,
        len_max: options.lenMax || 60,
        ...options
    };
    
    return await listenNotesRequest('/search', params);
}

async function getPodcast(podcastId) {
    if (!podcastId) throw new Error('ID подкаста обязателен');
    return await listenNotesRequest(`/podcasts/${podcastId}`);
}

async function getPodcastEpisodes(podcastId, options = {}) {
    if (!podcastId) throw new Error('ID подкаста обязателен');
    
    const params = {
        sort: options.sort || 'recent_first',
        offset: options.offset || 0,
        ...options
    };
    
    return await listenNotesRequest(`/podcasts/${podcastId}/episodes`, params);
}

async function getEpisode(episodeId) {
    if (!episodeId) throw new Error('ID эпизода обязателен');
    return await listenNotesRequest(`/episodes/${episodeId}`);
}

async function getBestPodcasts(options = {}) {
    const params = {
        genre: options.genre || 'all',
        page: options.page || 1,
        region: options.region || 'us',
        ...options
    };
    
    return await listenNotesRequest('/best_podcasts', params);
}

module.exports = {
    searchPodcasts,
    getPodcast,
    getPodcastEpisodes,
    getEpisode,
    getBestPodcasts
};