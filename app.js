const API_KEY = window.API_CONFIG.listenNotesKey;

const BASE_URL = "https://listen-api.listennotes.com/api/v2";

async function searchPodcasts(query) {
    
    console.log(API_KEY)
    const endpoint = 'https://listen-api-test.listennotes.com/api/v2/search'
    
    try {
        const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}&type=podcast`, {
            method: 'GET',
            headers: {
                'X-ListenAPI-Key': API_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log(`${endpoint}?q=${encodeURIComponent(query)}&type=podcast`)

        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }

        const data = await response.json();
        console.log(data.results); 
        return data.results;
    } catch (error) {
        console.error('Не удалось загрузить данные:', error);
    }
}

// Использование
searchPodcasts('футбольные новости');