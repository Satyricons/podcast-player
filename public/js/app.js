// public/js/app.js
import { PodcastIndexAPI } from './podcast-index-api.js';
import { formatDuration, truncateText, debounce, safeGet } from './utils/helpers.js';

/**
 * Главный класс приложения
 */
class PodcastApp {
    constructor() {
        // DOM элементы
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.resultsList = document.getElementById('resultsList');
        this.loading = document.getElementById('loading');
        this.detailsDiv = document.getElementById('details');
        this.totalResults = document.getElementById('totalResults');
        this.status = document.getElementById('status');

        // API клиент
        this.api = new PodcastIndexAPI();

        // Состояние
        this.currentResults = [];
        this.currentOffset = 0;
        this.hasMore = true;
        this.isLoading = false;

        // Инициализация
        this.init();
    }

    /**
     * Инициализация приложения
     */
    async init() {
        // Настройка обработчиков
        if (this.searchBtn) {
            this.searchBtn.addEventListener('click', () => this.search());
        }
        
        if (this.searchInput) {
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.search();
            });

            const debouncedSearch = debounce(() => this.search(), 500);
            this.searchInput.addEventListener('input', debouncedSearch);
        }

        // Инициализация API
        const initialized = await this.api.init();
        
        if (initialized) {
            this.updateStatus('✅ Готов', 'success');
            // Первый поиск
            this.search();
        } else {
            this.updateStatus('❌ Ошибка', 'danger');
            this.resultsList.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle"></i>
                        Не удалось инициализировать Podcast Index API.
                        <br><small>Проверьте ключи в .env файле</small>
                    </div>
                </div>
            `;
        }

        console.log('✅ Приложение инициализировано');
    }

    /**
     * Поиск подкастов
     */
    async search() {
        if (this.isLoading) return;
        
        const query = this.searchInput?.value?.trim() || 'podcast';
        
        this.isLoading = true;
        this.showLoading(true);
        if (this.resultsList) {
            this.resultsList.innerHTML = '';
        }

        try {
            const data = await this.api.search(query, 20);
            this.renderResults(data);
            this.updateStats(data);
        } catch (error) {
            console.error('❌ Ошибка поиска:', error);
            if (this.resultsList) {
                this.resultsList.innerHTML = `
                    <div class="col-12">
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle"></i>
                            Ошибка: ${error.message}
                            <button class="btn btn-sm btn-outline-danger ms-2" onclick="app.search()">
                                <i class="fas fa-redo"></i> Повторить
                            </button>
                        </div>
                    </div>
                `;
            }
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }

    /**
     * Рендер результатов
     */
    renderResults(data) {
        const feeds = data.feeds || [];
        this.currentResults = feeds;

        if (!this.resultsList) return;

        if (feeds.length === 0) {
            this.resultsList.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info">Ничего не найдено</div>
                </div>
            `;
            return;
        }

        this.resultsList.innerHTML = feeds.map(feed => `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card podcast-card h-100" 
                     onclick="app.showDetails(${feed.id})">
                    ${feed.image ? `
                        <img src="${feed.image}" 
                             class="card-img-top" 
                             alt="${feed.title}"
                             loading="lazy"
                             onerror="this.style.display='none'">
                    ` : `
                        <div class="card-img-top bg-light d-flex align-items-center justify-content-center" 
                             style="height: 150px; color: #6c757d;">
                            <i class="fas fa-podcast fa-3x"></i>
                        </div>
                    `}
                    <div class="card-body">
                        <h6 class="card-title text-truncate" title="${feed.title || 'Без названия'}">
                            ${feed.title || 'Без названия'}
                        </h6>
                        ${feed.author ? `
                            <p class="card-text small text-muted text-truncate">
                                <i class="fas fa-user"></i> ${feed.author}
                            </p>
                        ` : ''}
                        <p class="card-text small">
                            ${truncateText(feed.description || '', 80)}
                        </p>
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                ${feed.language ? `
                                    <span class="badge bg-secondary">${feed.language.toUpperCase()}</span>
                                ` : ''}
                            </div>
                            <button class="btn btn-sm btn-outline-primary view-details"
                                    onclick="event.stopPropagation(); app.showDetails(${feed.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Показать детали подкаста
     */
    async showDetails(id) {
        if (!id || !this.detailsDiv) return;

        this.detailsDiv.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary"></div>
                <p class="mt-2">Загрузка...</p>
            </div>
        `;

        try {
            const data = await this.api.getPodcast(id);
            const feed = data.feed || {};

            this.detailsDiv.innerHTML = `
                ${feed.image ? `
                    <img src="${feed.image}" 
                         class="img-fluid rounded mb-2" 
                         style="max-height: 200px; width: 100%; object-fit: cover;"
                         alt="${feed.title}">
                ` : ''}
                <h6>${feed.title || 'Без названия'}</h6>
                <p class="text-muted small">
                    <i class="fas fa-user"></i> ${feed.author || 'Автор неизвестен'}
                </p>
                <p class="small">${truncateText(feed.description || '', 200)}</p>
                <div class="mb-2">
                    <span class="badge bg-secondary">📡 ${feed.language || 'en'}</span>
                    ${feed.categories ? `
                        <span class="badge bg-info">
                            ${Object.values(feed.categories).join(', ')}
                        </span>
                    ` : ''}
                    ${feed.explicit ? `
                        <span class="badge bg-warning text-dark">🔞 Explicit</span>
                    ` : ''}
                </div>
                <div class="d-flex gap-2 flex-wrap">
                    ${feed.link ? `
                        <button class="btn btn-sm btn-primary" onclick="window.open('${feed.link}', '_blank')">
                            <i class="fas fa-globe"></i> Сайт
                        </button>
                    ` : ''}
                    ${feed.url ? `
                        <button class="btn btn-sm btn-secondary" onclick="window.open('${feed.url}', '_blank')">
                            <i class="fas fa-rss"></i> RSS
                        </button>
                    ` : ''}
                    ${feed.id ? `
                        <button class="btn btn-sm btn-success" onclick="app.showEpisodes(${feed.id})">
                            <i class="fas fa-list"></i> Эпизоды
                        </button>
                    ` : ''}
                </div>
            `;

        } catch (error) {
            this.detailsDiv.innerHTML = `
                <div class="alert alert-danger">Ошибка: ${error.message}</div>
            `;
        }
    }

    /**
     * Показать эпизоды подкаста
     */
    async showEpisodes(id) {
        if (!id || !this.detailsDiv) return;

        this.detailsDiv.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary"></div>
                <p class="mt-2">Загрузка эпизодов...</p>
            </div>
        `;

        try {
            const data = await this.api.getEpisodes(id, 10);
            const items = data.items || [];

            if (items.length === 0) {
                this.detailsDiv.innerHTML = `
                    <div class="alert alert-info">Нет эпизодов</div>
                    <button class="btn btn-sm btn-secondary" onclick="app.showDetails(${id})">
                        <i class="fas fa-arrow-left"></i> Назад
                    </button>
                `;
                return;
            }

            this.detailsDiv.innerHTML = `
                <h6>📻 Эпизоды (${items.length})</h6>
                <div class="episode-list">
                    ${items.map((ep, index) => `
                        <div class="episode-item" onclick="app.showEpisodeDetails('${ep.id || ep.guid}')">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <div class="fw-bold">${index + 1}. ${ep.title || 'Без названия'}</div>
                                    <div class="small text-muted">
                                        ${ep.pubDate ? new Date(ep.pubDate).toLocaleDateString('ru-RU') : ''}
                                        ${ep.duration ? ` • ${formatDuration(ep.duration)}` : ''}
                                    </div>
                                </div>
                                <span class="badge bg-secondary">▶</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-sm btn-secondary mt-2" onclick="app.showDetails(${id})">
                    <i class="fas fa-arrow-left"></i> Назад к подкасту
                </button>
            `;

        } catch (error) {
            this.detailsDiv.innerHTML = `
                <div class="alert alert-danger">Ошибка загрузки эпизодов: ${error.message}</div>
                <button class="btn btn-sm btn-secondary" onclick="app.showDetails(${id})">
                    <i class="fas fa-arrow-left"></i> Назад
                </button>
            `;
        }
    }

    /**
     * Показать детали эпизода
     */
    async showEpisodeDetails(id) {
        // Просто показываем информацию
        this.detailsDiv.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle"></i>
                Информация об эпизоде (ID: ${id})
            </div>
            <button class="btn btn-sm btn-secondary" onclick="window.history.back()">
                <i class="fas fa-arrow-left"></i> Назад
            </button>
        `;
    }

    /**
     * Обновление статуса
     */
    updateStatus(message, type = 'success') {
        if (!this.status) return;
        const dot = this.status.querySelector('.status-dot');
        const text = this.status.querySelector('.status-text');
        
        if (dot) {
            dot.className = `status-dot bg-${type}`;
        }
        if (text) {
            text.textContent = message;
        }
    }

    /**
     * Обновление статистики
     */
    updateStats(data) {
        const feeds = data.feeds || [];
        if (this.totalResults) {
            this.totalResults.textContent = feeds.length || 0;
        }
    }

    /**
     * Показать/скрыть загрузку
     */
    showLoading(show) {
        if (this.loading) {
            this.loading.style.display = show ? 'block' : 'none';
        }
    }
}

// Создаём глобальный экземпляр
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new PodcastApp();
    window.app = app;
});