// public/js/podcast-index-api.js

/**
 * Клиент для Podcast Index API
 * Использует Web Crypto API + SHA-1 для аутентификации
 */
export class PodcastIndexAPI {
    constructor() {
        this.apiKey = null;
        this.apiSecret = null;
        this.baseURL = '/api/proxy';
        this.isInitialized = false;
        this.initError = null;
    }

    async init() {
        try {
            console.log('🔑 Запрос ключей Podcast Index...');
            const response = await fetch('/api/keys');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            
            const data = await response.json();
            
            if (!data.apiKey || !data.apiSecret) {
                throw new Error('Ключи не найдены');
            }
            
            this.apiKey = data.apiKey;
            this.apiSecret = data.apiSecret;
            this.isInitialized = true;
            
            console.log('✅ Podcast Index API инициализирован');
            console.log(`   API Key: ${this.apiKey.substring(0, 8)}...`);
            console.log(`   API Secret: ${this.apiSecret.substring(0, 8)}...`);
            return true;
            
        } catch (error) {
            this.isInitialized = false;
            this.initError = error.message;
            console.error('❌ Ошибка инициализации Podcast Index:', error.message);
            return false;
        }
    }

    ensureInitialized() {
        if (!this.isInitialized || !this.apiKey || !this.apiSecret) {
            throw new Error('Podcast Index API не инициализирован');
        }
        return true;
    }

    /**
     * Генерация SHA-1 подписи через Web Crypto API
     */
    async generateAuthHeaders() {
        this.ensureInitialized();

        // Шаг 1: Время в секундах
        const apiHeaderTime = Math.round(Date.now() / 1000).toString();
        
        // Шаг 2: Конкатенация
        const payload = this.apiKey + this.apiSecret + apiHeaderTime;
        
        // Шаг 3: Кодирование
        const encoder = new TextEncoder();
        const data = encoder.encode(payload);
        
        // Шаг 4: SHA-1
        const digest = await crypto.subtle.digest('SHA-1', data);
        
        // Шаг 5: Hex-строка с padStart
        const hex = [...new Uint8Array(digest)]
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        return {
            'X-Auth-Date': apiHeaderTime,
            'X-Auth-Key': this.apiKey,
            'Authorization': hex
        };
    }

    /**
     * Выполнение запроса к API
     */
    async request(endpoint, params = {}) {
        this.ensureInitialized();

        const urlPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = new URL(`${this.baseURL}${urlPath}`, window.location.origin);
        
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });

        const authHeaders = await this.generateAuthHeaders();

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...authHeaders
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Ошибка Podcast Index API:', error.message);
            throw error;
        }
    }

    // ==================== API МЕТОДЫ ====================

    async search(query, max = 20) {
        if (!query) throw new Error('Поисковый запрос не может быть пустым');
        console.log(`🔍 Поиск: "${query}"...`);
        const result = await this.request('search/byterm', { q: query, max: max });
        console.log(`✅ Найдено: ${result.feeds?.length || 0} подкастов`);
        return result;
    }

    async getPodcast(feedId) {
        if (!feedId) throw new Error('ID подкаста обязателен');
        console.log(`📻 Получение подкаста ID: ${feedId}...`);
        const result = await this.request('podcasts/byfeedid', { id: feedId });
        console.log(`✅ Подкаст: ${result.feed?.title || 'Без названия'}`);
        return result;
    }

    async getEpisodes(feedId, max = 10) {
        if (!feedId) throw new Error('ID подкаста обязателен');
        console.log(`🎧 Получение эпизодов для ID: ${feedId}...`);
        const result = await this.request('episodes/byfeedid', { id: feedId, max: max });
        console.log(`✅ Найдено эпизодов: ${result.items?.length || 0}`);
        return result;
    }

    async getTopPodcasts(max = 20) {
        console.log('🏆 Получение популярных подкастов...');
        const result = await this.request('podcasts/top', { max: max });
        console.log(`✅ Найдено: ${result.feeds?.length || 0} подкастов`);
        return result;
    }
}

export const podcastAPI = new PodcastIndexAPI();