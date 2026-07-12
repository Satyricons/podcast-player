// public/js/app.js
import { PodcastIndexAPI } from './podcast-index-api.js';
import { formatDuration, formatTime, truncateText, debounce } from './utils/helpers.js';

const API_BASE = 'https://podcast-player-backend.onrender.com';

class PodcastApp {
    constructor() {
        // ... существующие DOM элементы ...
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.resultsList = document.getElementById('resultsList');
        this.loading = document.getElementById('loading');
        this.detailsDiv = document.getElementById('details');
        this.totalResults = document.getElementById('totalResults');
        this.status = document.getElementById('status');

        // Аудиоплеер
        this.audioPlayer = document.getElementById('globalAudioPlayer');
        this.headerPlayer = document.getElementById('headerPlayer');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.progressBar = document.getElementById('progressBar');
        this.timeDisplay = document.getElementById('timeDisplay');
        this.currentTrackTitle = document.getElementById('currentTrackTitle');
        this.volumeControl = document.getElementById('volumeControl');
        this.volumeIcon = document.getElementById('volumeIcon');

        // API клиент
        this.api = new PodcastIndexAPI();

        // === СОСТОЯНИЯ ПЛЕЕРА ===
        this.isLoading = false;
        this.isPlaying = false;
        this.currentTrack = null;
        this.isDragging = false;
        this.playbackRate = 1;
        this.playlist = [];
        this.favorites = new Set();

        // Загружаем сохранённые данные
        this.loadFromStorage();

        // Инициализация
        this.init();
    }

    // ==================== LOCALSTORAGE ====================

    loadFromStorage() {
        try {
            // Плейлист
            const savedPlaylist = localStorage.getItem('playlist');
            if (savedPlaylist) {
                this.playlist = JSON.parse(savedPlaylist);
                this.updatePlaylistUI();
            }

            // Скорость
            const savedRate = localStorage.getItem('playbackRate');
            if (savedRate) {
                this.playbackRate = parseFloat(savedRate);
                if (this.audioPlayer) {
                    this.audioPlayer.playbackRate = this.playbackRate;
                }
                this.updateSpeedButtons();
            }

            // Громкость
            const savedVolume = localStorage.getItem('volume');
            if (savedVolume !== null) {
                const vol = parseFloat(savedVolume);
                this.setVolume(vol);
                if (this.volumeControl) {
                    this.volumeControl.value = vol * 100;
                }
            }

            // Избранное
            const savedFavorites = localStorage.getItem('favorites');
            if (savedFavorites) {
                this.favorites = new Set(JSON.parse(savedFavorites));
            }

            // Прогресс восстанавливается при загрузке трека
        } catch (e) {
            console.warn('Ошибка загрузки из localStorage:', e);
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('playlist', JSON.stringify(this.playlist));
            localStorage.setItem('playbackRate', String(this.playbackRate));
            localStorage.setItem('volume', String(this.audioPlayer ? this.audioPlayer.volume : 0.8));
            localStorage.setItem('favorites', JSON.stringify([...this.favorites]));
        } catch (e) {
            console.warn('Ошибка сохранения в localStorage:', e);
        }
    }

    // ==================== ПЛЕЙЛИСТ ====================

    addToPlaylist(item) {
        // Проверяем, нет ли уже в плейлисте
        if (!this.playlist.some(p => p.url === item.url)) {
            this.playlist.push(item);
            this.saveToStorage();
            this.updatePlaylistUI();
        }
    }

    removeFromPlaylist(index) {
        this.playlist.splice(index, 1);
        this.saveToStorage();
        this.updatePlaylistUI();
    }

    clearPlaylist() {
        this.playlist = [];
        this.saveToStorage();
        this.updatePlaylistUI();
        const modal = bootstrap.Modal.getInstance(document.getElementById('playlistModal'));
        if (modal) modal.hide();
    }

    togglePlaylist() {
        const modal = new bootstrap.Modal(document.getElementById('playlistModal'));
        this.updatePlaylistUI();
        modal.show();
    }

    updatePlaylistUI() {
        const countEl = document.getElementById('playlistCount');
        if (countEl) {
            countEl.textContent = this.playlist.length;
        }

        const body = document.getElementById('playlistModalBody');
        if (body) {
            if (this.playlist.length === 0) {
                body.innerHTML = '<p class="text-muted">Плейлист пуст</p>';
                return;
            }
            body.innerHTML = this.playlist.map((item, index) => `
                <div class="playlist-item d-flex justify-content-between align-items-center p-2 border-bottom">
                    <div class="flex-grow-1 me-2" style="cursor: pointer;" onclick="app.playEpisode('${item.url}', '${item.title}')">
                        <div class="small fw-bold">${item.title || 'Без названия'}</div>
                        ${item.podcastName ? `<div class="small text-muted">${item.podcastName}</div>` : ''}
                    </div>
                    <div class="d-flex gap-1 flex-shrink-0">
                        <button class="btn btn-sm btn-outline-danger" onclick="app.removeFromPlaylist(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    // ==================== ИЗБРАННОЕ ====================

    toggleFavorite(podcastId) {
        if (this.favorites.has(podcastId)) {
            this.favorites.delete(podcastId);
        } else {
            this.favorites.add(podcastId);
        }
        this.saveToStorage();
        this.updateFavoritesUI();
    }

    isFavorite(podcastId) {
        return this.favorites.has(podcastId);
    }

    updateFavoritesUI() {
        const container = document.getElementById('favoritesList');
        if (!container) return;

        if (this.favorites.size === 0) {
            container.innerHTML = '<small class="text-muted">Нет избранных подкастов</small>';
            return;
        }

        // Показываем только ID, можно расширить до загрузки названий
        container.innerHTML = [...this.favorites].map(id => `
            <div class="favorite-item d-flex justify-content-between align-items-center p-1">
                <span class="small">ID: ${id}</span>
                <button class="btn btn-sm btn-outline-danger" onclick="app.toggleFavorite('${id}')">
                    <i class="fas fa-star text-warning"></i>
                </button>
            </div>
        `).join('');
    }

    // ==================== СКОРОСТЬ И ГРОМКОСТЬ ====================

    setPlaybackRate(rate) {
        this.playbackRate = rate;
        if (this.audioPlayer) {
            this.audioPlayer.playbackRate = rate;
        }
        this.saveToStorage();
        this.updateSpeedButtons();
    }

    updateSpeedButtons() {
        document.querySelectorAll('.speed-btn').forEach(btn => {
            const speed = parseFloat(btn.dataset.speed);
            btn.classList.toggle('active', speed === this.playbackRate);
        });
    }

    setVolume(value) {
        if (this.audioPlayer) {
            this.audioPlayer.volume = Math.max(0, Math.min(1, value));
            this.saveToStorage();
        }
        if (this.volumeIcon) {
            const vol = this.audioPlayer ? this.audioPlayer.volume : 0.8;
            if (vol === 0) {
                this.volumeIcon.className = 'fas fa-volume-mute text-white small';
            } else if (vol < 0.5) {
                this.volumeIcon.className = 'fas fa-volume-down text-white small';
            } else {
                this.volumeIcon.className = 'fas fa-volume-up text-white small';
            }
        }
    }

    // ==================== АУДИОПЛЕЕР (обновлённый) ====================

    playEpisode(url, title, podcastName = '') {
        if (!url) {
            console.warn('⚠️ Нет URL для воспроизведения');
            return;
        }

        // Добавляем в плейлист, если ещё не там
        this.addToPlaylist({ url, title, podcastName });

        if (this.currentTrack && this.currentTrack.url === url) {
            this.togglePlay();
            return;
        }

        this.isLoading = true;
        this.currentTrack = { url, title, podcastName };
        this.updatePlayButton();

        if (this.headerPlayer) {
            this.headerPlayer.style.display = 'block';
        }
        if (this.currentTrackTitle) {
            this.currentTrackTitle.textContent = title || 'Эпизод';
        }

        if (this.audioPlayer) {
            this.audioPlayer.src = url;
            this.audioPlayer.load();

            // Восстанавливаем прогресс
            const progressKey = `progress_${url}`;
            const savedTime = parseFloat(localStorage.getItem(progressKey)) || 0;

            this.audioPlayer.oncanplay = () => {
                if (savedTime > 0 && savedTime < this.audioPlayer.duration) {
                    this.audioPlayer.currentTime = savedTime;
                }
                this.isLoading = false;
                this.isPlaying = true;
                this.updatePlayButton();
                this.audioPlayer.play().catch(e => {
                    console.warn('Автовоспроизведение заблокировано:', e);
                    this.isPlaying = false;
                    this.updatePlayButton();
                });
            };

            this.audioPlayer.onerror = () => {
                this.isLoading = false;
                this.isPlaying = false;
                this.updatePlayButton();
                console.error('❌ Ошибка загрузки аудио:', this.audioPlayer.error);
                if (this.currentTrackTitle) {
                    this.currentTrackTitle.textContent = '❌ Ошибка загрузки';
                }
            };

            // Сохраняем прогресс каждые 5 секунд
            this.audioPlayer.ontimeupdate = () => {
                this.updateProgress();
                const key = `progress_${url}`;
                localStorage.setItem(key, String(this.audioPlayer.currentTime));
            };
        }
    }

    togglePlay() {
        if (!this.audioPlayer || !this.currentTrack) return;
        if (this.isLoading) return;

        if (this.isPlaying) {
            this.audioPlayer.pause();
            this.isPlaying = false;
        } else {
            this.audioPlayer.play()
                .then(() => { this.isPlaying = true; })
                .catch(e => {
                    console.warn('Не удалось воспроизвести:', e);
                    this.isPlaying = false;
                });
        }
        this.updatePlayButton();
    }

    updatePlayButton() {
        if (!this.playPauseBtn) return;
        const icon = this.playPauseBtn.querySelector('i');
        if (!icon) return;

        if (this.isLoading) {
            icon.className = 'fas fa-spinner fa-spin';
            this.playPauseBtn.disabled = true;
            this.playPauseBtn.classList.add('opacity-50');
            return;
        }

        this.playPauseBtn.disabled = false;
        this.playPauseBtn.classList.remove('opacity-50');

        if (this.isPlaying && this.currentTrack) {
            icon.className = 'fas fa-pause';
        } else if (this.currentTrack) {
            icon.className = 'fas fa-play';
        } else {
            icon.className = 'fas fa-play';
            this.playPauseBtn.disabled = true;
            this.playPauseBtn.classList.add('opacity-50');
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
        this.isLoading = false;
        this.updatePlayButton();
        if (this.progressBar) {
            this.progressBar.value = 0;
        }
        this.updateTimeDisplay();

        // Автоматически играть следующий в плейлисте
        const currentIndex = this.playlist.findIndex(p => p.url === this.currentTrack?.url);
        if (currentIndex !== -1 && currentIndex < this.playlist.length - 1) {
            const next = this.playlist[currentIndex + 1];
            this.playEpisode(next.url, next.title, next.podcastName);
        }
    }

    stopAudio() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
            this.audioPlayer.oncanplay = null;
            this.audioPlayer.onerror = null;
        }

        this.isLoading = false;
        this.isPlaying = false;
        this.currentTrack = null;

        if (this.headerPlayer) {
            this.headerPlayer.style.display = 'none';
        }
        if (this.currentTrackTitle) {
            this.currentTrackTitle.textContent = 'Нет трека';
        }
        if (this.progressBar) {
            this.progressBar.value = 0;
        }
        this.updateTimeDisplay();
        this.updatePlayButton();
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ (обновлённая) ====================

    async init() {
        // ... существующие обработчики ...
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

        // Обработчики плеера
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
                    const key = `progress_${this.currentTrack?.url}`;
                    if (key) {
                        localStorage.setItem(key, String(this.audioPlayer.currentTime));
                    }
                }
                this.isDragging = false;
            });
        }

        // Громкость
        if (this.volumeControl) {
            this.volumeControl.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) / 100;
                this.setVolume(val);
            });
        }

        // Инициализация API
        const initialized = await this.api.init(API_BASE);
        if (initialized) {
            this.updateStatus('✅ Готов', 'success');
            this.search();
            this.updateFavoritesUI();
            this.updatePlaylistUI();
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

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

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

    // ==================== SEARCH ====================

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

    // ==================== RENDER RESULTS ====================

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

        this.resultsList.innerHTML = feeds.map(feed => {
            const isFav = this.isFavorite(feed.id);
            return `
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
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm ${isFav ? 'btn-warning' : 'btn-outline-secondary'}"
                                        onclick="event.stopPropagation(); app.toggleFavorite(${feed.id})">
                                    <i class="fas fa-star"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-primary view-details"
                                        onclick="event.stopPropagation(); app.showDetails(${feed.id})">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');
    }

    // ==================== SHOW DETAILS ====================

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
            const isFav = this.isFavorite(feed.id);
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
                    <button class="btn btn-sm ${isFav ? 'btn-warning' : 'btn-outline-secondary'}"
                            onclick="app.toggleFavorite(${feed.id})">
                        <i class="fas fa-star"></i> ${isFav ? 'В избранном' : 'В избранное'}
                    </button>
                </div>
            `;
            this.updateFavoritesUI();
        } catch (error) {
            this.detailsDiv.innerHTML = `
                <div class="alert alert-danger">Ошибка: ${error.message}</div>
            `;
        }
    }

    // ==================== SHOW EPISODES ====================

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
                                                onclick="event.stopPropagation(); app.playEpisode('${ep.enclosureUrl}', '${ep.title || 'Эпизод'}', '${ep.podcastTitle || ''}')">
                                            <i class="fas fa-play"></i>
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-sm btn-outline-secondary"
                                            onclick="event.stopPropagation(); app.addToPlaylist({url: '${ep.enclosureUrl}', title: '${ep.title || 'Эпизод'}', podcastName: '${ep.podcastTitle || ''}'})">
                                        <i class="fas fa-plus"></i>
                                    </button>
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
}

// Создаём глобальный экземпляр
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PodcastApp();
    window.app = app;
});