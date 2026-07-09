// server.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;

if (!API_KEY || !API_SECRET) {
    console.error('❌ ОШИБКА: Ключи Podcast Index не найдены в .env');
    console.log('📝 Добавьте в .env:');
    console.log('   PODCAST_INDEX_API_KEY=ваш_ключ');
    console.log('   PODCAST_INDEX_API_SECRET=ваш_секрет');
    process.exit(1);
}

console.log('✅ Podcast Index API ключи загружены');
console.log(`   API Key: ${API_KEY.substring(0, 8)}...`);
console.log(`   API Secret: ${API_SECRET.substring(0, 8)}...`);

// Статика
app.use(express.static(path.join(__dirname, 'public')));

// Эндпоинт для передачи ключей
app.get('/api/keys', (req, res) => {
    const host = req.get('host');
    if (host && host.includes('localhost')) {
        res.json({
            apiKey: API_KEY,
            apiSecret: API_SECRET
        });
    } else {
        res.status(403).json({ error: 'Forbidden' });
    }
});

// Прокси для Podcast Index API (ИСПРАВЛЕННАЯ ВЕРСИЯ)
app.get('/api/proxy/*', async (req, res) => {
    try {
        // Получаем путь из URL (всё что после /api/proxy/)
        const targetPath = req.params[0];
        
        // Получаем все параметры запроса из req.query
        const queryParams = req.query;
        
        console.log(`🔄 Прокси запрос:`);
        console.log(`   Путь: ${targetPath}`);
        console.log(`   Параметры:`, queryParams);
        
        // Получаем заголовки аутентификации
        const authDate = req.headers['x-auth-date'];
        const authKey = req.headers['x-auth-key'];
        const authHash = req.headers['authorization'];
        
        if (!authDate || !authKey || !authHash) {
            return res.status(400).json({ 
                error: 'Missing authentication headers'
            });
        }

        // Строим URL для Podcast Index API с параметрами
        const baseUrl = 'https://api.podcastindex.org/api/1.0';
        const url = new URL(`${baseUrl}/${targetPath}`);
        
        // Добавляем все параметры запроса
        Object.keys(queryParams).forEach(key => {
            url.searchParams.append(key, queryParams[key]);
        });
        
        console.log(`📡 Полный URL: ${url.toString()}`);

        // Выполняем запрос
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'User-Agent': 'MyPodcastApp/1.0',
                'X-Auth-Date': authDate,
                'X-Auth-Key': authKey,
                'Authorization': authHash,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        // Получаем ответ
        const data = await response.json();
        
        console.log(`   Статус: ${response.status}`);
        if (response.status !== 200) {
            console.log(`   Ошибка:`, data);
        }
        
        // Отправляем ответ клиенту
        res.status(response.status).json(data);
        
    } catch (error) {
        console.error('❌ Прокси ошибка:', error.message);
        res.status(500).json({ 
            error: 'Proxy error',
            message: error.message 
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен: http://localhost:${PORT}`);
    console.log(`📡 Podcast Index API настроен`);
    console.log(`\n📋 Тестовый запрос:`);
    console.log(`   http://localhost:${PORT}/api/proxy/search/byterm?q=technology&max=5`);
});