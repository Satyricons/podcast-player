import { searchPodcasts } from './api.js'

// Создаем асинхронную оболочку
async function main (query, type) {
  try {
    console.log('Начинаем поиск...')

    // Ждем результат
    const spisok = await searchPodcasts(query, type)

    console.log('Получен объект:', spisok)

    // Теперь можно работать с данными
    if (spisok.results && spisok.results.length > 0) {
      const container = document.querySelector('.content')

      // Очищаем контейнер перед заполнением (на случай повторного поиска)
      container.innerHTML = ''

      spisok.results.forEach(item => {
        // 1. Создаем контейнер-обертку
        const card = document.createElement('div')
        card.classList.add('podcast-card') // Добавляем класс для стилей

        // 2. Проверяем, существует ли ссылка на картинку
        if (item.image) {
          const img = document.createElement('img')

          // Кладем URL в специальный атрибут src
          img.src = item.image
          
          img.alt = item.title_original || 'Обложка подкаста'

          // Вкладываем картинку в карточку
          card.appendChild(img)
        } else {
          // Если картинки нет, можно вывести заглушку
          card.textContent = 'Нет изображения'
        }

        // 3. Добавляем готовую карточку в общий контейнер
        container.appendChild(card)
      })
    }
  } catch (error) {
    console.error('Ошибка поиска:', error.message)
  }
}

//Запускаем нашу функцию
main('футбольные новости', 'search')
