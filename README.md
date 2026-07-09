Шаг 1.

Task https://github.com/rolling-scopes-school/tasks/blob/master/stage0.5%20Bootcamp/tasks/podcast-player/README.md

Шаг 2.

1. Настроен Podcast Index API с аутентификацией через SHA-1

2. Реализован Web Crypto API в браузере для генерации подписи

3. Создан прокси-сервер для передачи запросов (обход CORS)

4. Исправлена передача параметров в запросах

🔑 Ключевые моменты

1	Время в секундах	Math.round(Date.now() / 1000).toString()
2	Конкатенация	apiKey + apiSecret + apiHeaderTime
3	Кодирование	new TextEncoder().encode(payload)
4	SHA-1	crypto.subtle.digest('SHA-1', data)
5	Hex с padStart	b.toString(16).padStart(2, '0')
6	Заголовки	X-Auth-Date, X-Auth-Key, Authorization

Шаг 3.

Компонент	Статус
Podcast Index API с SHA-1	✅ Работает
Web Crypto API	✅ Работает
Поиск подкастов	✅ Работает
Детали подкаста	✅ Работает
Список эпизодов	✅ Работает
Аудиоплеер в шапке	✅ Работает
Тёмная тема	✅ Работает
Адаптивность	✅ Работает
