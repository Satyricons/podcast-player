import { PodcastIndexAPI } from './podcast-index-api.js';
import { formatDuration, formatTime, truncateText, debounce } from './utils/helpers.js';

const API_BASE = 'https://podcast-player-backend.onrender.com/'; // Замените на ваш URL на Render

class PodcastApp {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.resultsList = document.getElementById('resultsList');
        this.loading = document.getElementById('loading');
        this.detailsDiv = document.getElementById('details');
        this.totalResults = document.getElementById('totalResults');
        this.status = document.getElementById('status');

        this.audioPlayer = document.getElementById('globalAudioPlayer');
        this.headerPlayer = document.getElementById('headerPlayer');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.progressBar = document.getElementById('progressBar');
        this.timeDisplay = document.getElementById('timeDisplay');
        this.currentTrackTitle = document.getElementById('currentTrackTitle');

        this.api = new PodcastIndexAPI();
        this.isPlaying = false;
        this.currentTrack = null;
        this.isDragging = false;

        this.init();
    }

    async init() {
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

        if (this.audioPlayer) {
            this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
            this.audioPlayer.addEventListener('ended', () => this.onAudioEnd());
            this.audioPlayer.addEventListener('loadedmetadata', () => this.updateTimeDisplay());
        }
        if (this.progressBar) {
            this.progressBar.addEventListener('input', (e) => {
                this.isDragging = true;
            });
            this.progressBar.addEventListener('change', (e) => {
                if (this.audioPlayer && this.audioPlayer.duration) {
                    const value = parseFloat(e.target.value);
                    this.audioPlayer.currentTime = (value / 100) * this.audioPlayer.duration;
                }
                this.isDragging = false;
            });
        }

        const initialized = await this.api.init(API_BASE);
        if (initialized) {
            this.updateStatus('✅ Готов', 'success');
            this.search();
        } else {
            this.updateStatus('❌ Ошибка', 'danger');
            this.resultsList.innerHTML = `
                    <div class="col-12">
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle"></i>
                            Не удалось инициализировать Podcast Index API.
                            <br /><small>Проверьте ключи на сервере</small>
                        </div>
                    </div>
                `;
        }
        console.log('✅ Приложение инициализировано');
    }

    async search() {
        const query = this.searchInput?.value?.trim() || 'podcast';
        this.showLoading(true);
        if (this.resultsList) this.resultsList.innerHTML = '';
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
            this.showLoading(false);
        }
    }

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
                    <div class="card podcast-card h-100" onclick="app.showDetails(${feed.id})">
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
                        <button class="btn btn-sm btn-success" onclick="app.showEpisodes(${feed.id})">
                            <i class="fas fa-list"></i> Эпизоды
                        </button>
                    </div>
                `;
        } catch (error) {
            this.detailsDiv.innerHTML = `
                    <div class="alert alert-danger">Ошибка: ${error.message}</div>
                `;
        }
    }

    async showEpisodes(id) {
        if (!id || !this.detailsDiv) return;
        this.detailsDiv.innerHTML = `
                <div class="text-center py-3">
                    <div class="spinner-border text-primary"></div>
                    <p class="mt-2">Загрузка эпизодов...</p>
                </div>
            `;
        try {
            const data = await this.api.getEpisodes(id, 20);
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
                                <div class="episode-item">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div class="flex-grow-1 me-2">
                                            <div class="fw-bold">${index + 1}. ${ep.title || 'Без названия'}</div>
                                            <div class="small text-muted">
                                                ${ep.pubDate ? new Date(ep.pubDate).toLocaleDateString('ru-RU') : ''}
                                                ${ep.duration ? ` • ${formatDuration(ep.duration)}` : ''}
                                            </div>
                                        </div>
                                        <div class="d-flex gap-1 flex-shrink-0">
                                            ${ep.enclosureUrl ? `
                                                    <button class="btn btn-sm btn-success play-episode-btn"
                                                            onclick="event.stopPropagation(); app.playEpisode('${ep.enclosureUrl}', '${ep.title || 'Эпизод'}')">
                                                        <i class="fas fa-play"></i>
                                                    </button>
                                                ` : ''}
                                        </div>
                                    </div>
                                    ${ep.description ? `
                                            <div class="small text-muted mt-1">${truncateText(ep.description, 100)}</div>
                                        ` : ''}
                                    ${ep.enclosureUrl ? `
                                            <div class="mt-1">
                                                <a href="${ep.enclosureUrl}" class="small text-muted" download>
                                                    <i class="fas fa-download"></i> Скачать
                                                </a>
                                            </div>
                                        ` : ''}
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

    playEpisode(url, title) {
        if (!url) {
            console.warn('⚠️ Нет URL для воспроизведения');
            return;
        }
        this.currentTrack = { url, title };
        if (this.headerPlayer) this.headerPlayer.style.display = 'block';
        if (this.currentTrackTitle) this.currentTrackTitle.textContent = title || 'Эпизод';
        if (this.audioPlayer) {
            this.audioPlayer.src = url;
            this.audioPlayer.load();
            this.audioPlayer.play()
                .then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                })
                .catch(e => {
                    console.warn('Автовоспроизведение заблокировано:', e);
                    this.isPlaying = false;
                    this.updatePlayButton();
                });
        }
        if (window.innerWidth < 768) {
            document.querySelector('.navbar')?.scrollIntoView({ behavior: 'smooth' });
        }
    }

    togglePlay() {
        if (!this.audioPlayer) return;
        if (this.isPlaying) {
            this.audioPlayer.pause();
            this.isPlaying = false;
        } else {
            this.audioPlayer.play()
                .then(() => { this.isPlaying = true; })
                .catch(e => console.warn('Не удалось воспроизвести:', e));
        }
        this.updatePlayButton();
    }

    updatePlayButton() {
        if (!this.playPauseBtn) return;
        const icon = this.playPauseBtn.querySelector('i');
        if (icon) {
            icon.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
    }

    updateProgress() {
        if (!this.audioPlayer || !this.progressBar || this.isDragging) return;
        if (this.audioPlayer.duration) {
            const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
            this.progressBar.value = progress;
        }
        this.updateTimeDisplay();
    }

    updateTimeDisplay() {
        if (!this.audioPlayer || !this.timeDisplay) return;
        const current = formatTime(this.audioPlayer.currentTime || 0);
        const total = formatTime(this.audioPlayer.duration || 0);
        this.timeDisplay.textContent = `${current} / ${total}`;
    }

    onAudioEnd() {
        this.isPlaying = false;
        this.updatePlayButton();
        if (this.progressBar) this.progressBar.value = 0;
        this.updateTimeDisplay();
    }

    stopAudio() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
            this.isPlaying = false;
            this.updatePlayButton();
            if (this.progressBar) this.progressBar.value = 0;
            this.updateTimeDisplay();
        }
        if (this.headerPlayer) this.headerPlayer.style.display = 'none';
        this.currentTrack = null;
        if (this.currentTrackTitle) this.currentTrackTitle.textContent = 'Нет трека';
    }

    updateStatus(message, type = 'success') {
        if (!this.status) return;
        const dot = this.status.querySelector('.status-dot');
        const text = this.status.querySelector('.status-text');
        if (dot) dot.className = `status-dot bg-${type}`;
        if (text) text.textContent = message;
    }

    updateStats(data) {
        const feeds = data.feeds || [];
        if (this.totalResults) this.totalResults.textContent = feeds.length || 0;
    }

    showLoading(show) {
        if (this.loading) this.loading.style.display = show ? 'block' : 'none';
    }

    toggleTheme() {
        document.body.classList.toggle('dark-theme');
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PodcastApp();
    window.app = app;
});