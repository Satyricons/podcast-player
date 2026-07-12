// public/js/app.js
import { PodcastIndexAPI } from './podcast-index-api.js';
import { formatDuration, formatTime, truncateText, debounce } from './utils/helpers.js';

const API_BASE = 'https://podcast-player-backend.onrender.com';

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
        this.favorites = []; // массив объектов { id, title, image, author }

        // === ПАГИНАЦИЯ ===
        this.currentQuery = '';
        this.currentOffset = 0;
        this.totalResultsCount = 0;
        this.hasMore = true;
        this.isLoadingMore = false;
        this.resultsPerPage = 20;
        this.allFeeds = [];

        // Загружаем сохранённые данные
        this.loadFromStorage();

        // Инициализация
        this.init();
    }

    // ==================== LOCALSTORAGE ====================

    loadFromStorage() {
        try {
            const savedPlaylist = localStorage.getItem('playlist');
            if (savedPlaylist) {
                this.playlist = JSON.parse(savedPlaylist);
                this.updatePlaylistUI();
            }

            const savedRate = localStorage.getItem('playbackRate');
            if (savedRate) {
                this.playbackRate = parseFloat(savedRate);
                if (this.audioPlayer) {
                    this.audioPlayer.playbackRate = this.playbackRate;
                }
                this.updateSpeedButtons();
            }

            const savedVolume = localStorage.getItem('volume');
            if (savedVolume !== null) {
                const vol = parseFloat(savedVolume);
                this.setVolume(vol);
                if (this.volumeControl) {
                    this.volumeControl.value = vol * 100;
                }
            }

            const savedFavorites = localStorage.getItem('favorites');
            if (savedFavorites) {
                this.favorites = JSON.parse(savedFavorites);
            }
        } catch (e) {
            console.warn('Ошибка загрузки из localStorage:', e);
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('playlist', JSON.stringify(this.playlist));
            localStorage.setItem('playbackRate', String(this.playbackRate));
            localStorage.setItem('volume', String(this.audioPlayer ? this.audioPlayer.volume : 0.8));
            localStorage.setItem('favorites', JSON.stringify(this.favorites));
        } catch (e) {
            console.warn('Ошибка сохранения в localStorage:', e);
        }
    }

    // ==================== ПЛЕЙЛИСТ ====================

    addToPlaylist(item) {
        if (!this.playlist.some(p => p.url === item.url)) {
            this.playlist.push(item);
            this.saveToStorage();
            this.updatePlaylistUI();
            this.showToast(`➕ "${item.title}" добавлен в плейлист`);
        }
    }

    removeFromPlaylist(index) {
        const title = this.playlist[index]?.title || 'Эпизод';
        this.playlist.splice(index, 1);
        this.saveToStorage();
        this.updatePlaylistUI();
        this.showToast(`❌ "${title}" удалён из плейлиста`);
    }

    clearPlaylist() {
        if (this.playlist.length === 0) return;
        if (confirm('Очистить весь плейлист?')) {
            this.playlist = [];
            this.saveToStorage();
            this.updatePlaylistUI();
            const modal = bootstrap.Modal.getInstance(document.getElementById('playlistModal'));
            if (modal) modal.hide();
            this.showToast('🗑️ Плейлист очищен');
        }
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

    // ==================== ИЗБРАННОЕ (обновлённое) ====================

    toggleFavorite(podcast) {
        const id = podcast.id || podcast;
        const index = this.favorites.findIndex(f => f.id === id);
        
        if (index !== -1) {
            this.favorites.splice(index, 1);
            this.showToast(`❌ "${podcast.title || 'Подкаст'}" удалён из избранного`);
        } else {
            this.favorites.push({
                id: id,
                title: podcast.title || 'Без названия',
                image: podcast.image || '',
                author: podcast.author || 'Автор неизвестен'
            });
            this.showToast(`⭐ "${podcast.title || 'Подкаст'}" добавлен в избранное`);
        }
        
        this.saveToStorage();
        this.updateFavoritesUI();
        this.updateFavoriteButtons();
    }

    isFavorite(podcastId) {
        return this.favorites.some(f => f.id === podcastId);
    }

    getFavorite(podcastId) {
        return this.favorites.find(f => f.id === podcastId);
    }

    updateFavoritesUI() {
        const container = document.getElementById('favoritesList');
        const countBadge = document.getElementById('favoritesCount');
        if (!container) return;

        if (countBadge) {
            countBadge.textContent = this.favorites.length;
        }

        if (this.favorites.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="fas fa-star fa-2x mb-2"></i>
                    <p class="small mb-0">Нет избранных подкастов</p>
                    <p class="small">Добавляйте подкасты, нажимая на ⭐</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.favorites.map(item => `
            <div class="favorite-item d-flex align-items-center gap-2 p-2 border-bottom" 
                 onclick="app.showDetails('${item.id}')" style="cursor: pointer;">
                ${item.image ? `
                    <img src="${item.image}" 
                         class="rounded" 
                         style="width: 40px; height: 40px; object-fit: cover;"
                         onerror="this.style.display='none'">
                ` : `
                    <div class="bg-light rounded d-flex align-items-center justify-content-center" 
                         style="width: 40px; height: 40px; flex-shrink: 0;">
                        <i class="fas fa-podcast text-secondary"></i>
                    </div>
                `}
                <div class="flex-grow-1 min-width-0">
                    <div class="small fw-bold text-truncate">${item.title}</div>
                    <div class="small text-muted text-truncate">${item.author}</div>
                </div>
                <button class="btn btn-sm btn-outline-danger flex-shrink-0" 
                        onclick="event.stopPropagation(); app.toggleFavorite({id: '${item.id}', title: '${item.title}'})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        if (this.favorites.length > 0) {
            container.innerHTML += `
                <div class="text-center mt-2">
                    <button class="btn btn-sm btn-outline-danger" onclick="app.clearFavorites()">
                        <i class="fas fa-trash"></i> Очистить всё
                    </button>
                </div>
            `;
        }
    }

    updateFavoriteButtons() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const id = btn.dataset.id;
            const isFav = this.isFavorite(id);
            btn.classList.toggle('btn-warning', isFav);
            btn.classList.toggle('btn-outline-secondary', !isFav);
            btn.innerHTML = `<i class="fas fa-star"></i>`;
            btn.title = isFav ? 'Удалить из избранного' : 'Добавить в избранное';
        });
    }

    clearFavorites() {
        if (this.favorites.length === 0) return;
        if (confirm('Удалить все подкасты из избранного?')) {
            this.favorites = [];
            this.saveToStorage();
            this.updateFavoritesUI();
            this.updateFavoriteButtons();
            this.showToast('🗑️ Избранное очищено');
        }
    }

    showToast(message) {
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                max-width: 350px;
            `;
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = 'toast show';
        toast.style.cssText = `
            background: #333;
            color: #fff;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease-out;
            font-size: 14px;
        `;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
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

    // ==================== АУДИОПЛЕЕР ====================

    playEpisode(url, title, podcastName = '') {
        if (!url) {
            console.warn('⚠️ Нет URL для воспроизведения');
            return;
        }

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

    // ==================== ПОИСК И ПАГИНАЦИЯ ====================

    async search(query) {
        if (query === undefined) {
            query = this.searchInput?.value?.trim() || 'podcast';
        }
        
        this.currentQuery = query;
        this.currentOffset = 0;
        this.allFeeds = [];
        this.hasMore = true;
        this.isLoadingMore = false;
        this.totalResultsCount = 0;
        
        this.showLoading(true);
        if (this.resultsList) {
            this.resultsList.innerHTML = '';
        }

        try {
            const data = await this.api.search(
                this.currentQuery, 
                this.resultsPerPage, 
                this.currentOffset
            );
            
            this.totalResultsCount = data.count || data.feeds?.length || 0;
            this.allFeeds = data.feeds || [];
            this.hasMore = this.allFeeds.length >= this.resultsPerPage;
            this.currentOffset = this.allFeeds.length;
            
            this.renderResults(this.allFeeds, true);
            this.updateStats(this.totalResultsCount, this.allFeeds.length);
            this.renderLoadMoreButton();
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
            this.isLoadingMore = false;
        }
    }

    async loadMore() {
        if (this.isLoadingMore || !this.hasMore) return;
        
        this.isLoadingMore = true;
        
        try {
            const loadMoreBtn = document.querySelector('.load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Загрузка...';
            }

            const data = await this.api.search(
                this.currentQuery, 
                this.resultsPerPage, 
                this.currentOffset
            );
            
            const newFeeds = data.feeds || [];
            if (newFeeds.length > 0) {
                this.allFeeds = [...this.allFeeds, ...newFeeds];
                this.currentOffset += newFeeds.length;
                this.hasMore = newFeeds.length >= this.resultsPerPage;
                
                this.renderResults(newFeeds, false);
                this.renderLoadMoreButton();
                this.updateStats(this.totalResultsCount, this.allFeeds.length);
            } else {
                this.hasMore = false;
                this.renderLoadMoreButton();
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки ещё:', error);
            if (this.resultsList) {
                const errorEl = document.createElement('div');
                errorEl.className = 'col-12';
                errorEl.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        Не удалось загрузить ещё: ${error.message}
                    </div>
                `;
                this.resultsList.appendChild(errorEl);
            }
        } finally {
            this.isLoadingMore = false;
            const loadMoreBtn = document.querySelector('.load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                this.renderLoadMoreButton();
            }
        }
    }

    renderLoadMoreButton() {
        const oldBtn = document.querySelector('.load-more-container');
        if (oldBtn) {
            oldBtn.remove();
        }

        if (!this.hasMore) {
            if (this.allFeeds.length > 0 && this.allFeeds.length >= this.resultsPerPage) {
                const container = document.createElement('div');
                container.className = 'col-12 load-more-container text-center my-3';
                container.innerHTML = `
                    <p class="text-muted small">
                        <i class="fas fa-check-circle text-success"></i>
                        Все ${this.totalResultsCount} подкастов загружены
                    </p>
                `;
                this.resultsList.appendChild(container);
            }
            return;
        }

        const container = document.createElement('div');
        container.className = 'col-12 load-more-container text-center my-3';
        
        const remaining = this.totalResultsCount - this.allFeeds.length;
        const remainingText = remaining > 0 ? ` (осталось ${remaining})` : '';
        
        container.innerHTML = `
            <button class="btn btn-outline-primary load-more-btn" onclick="app.loadMore()" ${this.isLoadingMore ? 'disabled' : ''}>
                ${this.isLoadingMore ? '<span class="spinner-border spinner-border-sm" role="status"></span> Загрузка...' : `Загрузить ещё ${remainingText}`}
            </button>
        `;
        
        this.resultsList.appendChild(container);
    }

    // ==================== ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ ====================

    renderResults(feeds, replace = true) {
        if (!this.resultsList) return;
        
        if (feeds.length === 0 && this.allFeeds.length === 0) {
            this.resultsList.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info">Ничего не найдено</div>
                </div>
            `;
            return;
        }

        if (replace) {
            this.resultsList.innerHTML = '';
        }

        feeds.forEach(feed => {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4 mb-3';
            col.innerHTML = this.createPodcastCard(feed);
            this.resultsList.appendChild(col);
        });

        this.renderLoadMoreButton();
    }

    createPodcastCard(feed) {
        const isFav = this.isFavorite(feed.id);
        return `
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
                            <button class="btn btn-sm favorite-btn ${isFav ? 'btn-warning' : 'btn-outline-secondary'}"
                                    data-id="${feed.id}"
                                    onclick="event.stopPropagation(); app.toggleFavorite({id: '${feed.id}', title: '${feed.title || 'Без названия'}', image: '${feed.image || ''}', author: '${feed.author || ''}'})">
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
        `;
    }

    // ==================== ДЕТАЛИ ПОДКАСТА ====================

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
                            onclick="app.toggleFavorite({id: '${feed.id}', title: '${feed.title || 'Без названия'}', image: '${feed.image || ''}', author: '${feed.author || ''}'})">
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

    // ==================== ЭПИЗОДЫ ====================

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

    // ==================== СТАТУС И СТАТИСТИКА ====================

    updateStatus(message, type = 'success') {
        if (!this.status) return;
        const dot = this.status.querySelector('.status-dot');
        const text = this.status.querySelector('.status-text');
        if (dot) dot.className = `status-dot bg-${type}`;
        if (text) text.textContent = message;
    }

    updateStats(total, loaded) {
        if (this.totalResults) {
            this.totalResults.textContent = `${loaded || 0} / ${total || 0}`;
        }
    }

    showLoading(show) {
        if (this.loading) {
            this.loading.style.display = show ? 'block' : 'none';
        }
    }

    toggleTheme() {
        document.body.classList.toggle('dark-theme');
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================

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
                    const key = `progress_${this.currentTrack?.url}`;
                    if (key && this.currentTrack) {
                        localStorage.setItem(key, String(this.audioPlayer.currentTime));
                    }
                }
                this.isDragging = false;
            });
        }

        if (this.volumeControl) {
            this.volumeControl.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) / 100;
                this.setVolume(val);
            });
        }

        const initialized = await this.api.init(API_BASE);
        if (initialized) {
            this.updateStatus('✅ Готов', 'success');
            this.search();
            this.updateFavoritesUI();
            this.updatePlaylistUI();
        } else {
            this.updateStatus('❌ Ошибка', 'danger');
            if (this.resultsList) {
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
        }
        console.log('✅ Приложение инициализировано');
    }
}

// Создаём глобальный экземпляр
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PodcastApp();
    window.app = app;
});