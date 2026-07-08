const API_KEY = window.API_CONFIG.listenNotesKey;
const BASE_URL = "https://listen-api-test.listennotes.com/api/v2/"


export async function searchPodcasts(query, type) { 
const endpoint = BASE_URL + type
    try {
        const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}&type=podcast`, {
            method: 'GET',
            headers: {
                'X-ListenAPI-Key': API_KEY,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Не удалось загрузить данные:', error);
    }
}

