


/**
 * ═══════════════════════════════════════════════════════
 *  LUXE STORE — script.js
 *  Production-grade E-Commerce Frontend
 *  Architecture: Modular Vanilla JS (IIFE + Module Pattern)
 * ═══════════════════════════════════════════════════════
 */

'use strict';

/* ─── CONFIG ──────────────────────────────────────────── */
const CONFIG = {
  API_BASE: 'https://fakestoreapi.com',
  CURRENCY: '$',
  TOAST_DURATION: 3000,
  DEBOUNCE_DELAY: 250,
};


/* ─── STATE ───────────────────────────────────────────── */
const State = (() => {
  let _products = [];          // Tüm ürünler (API'den gelen)
  let _filtered = [];          // Filtreli ürünler (gösterilen)
  let _categories = [];        // Kategoriler
  let _activeCategory = 'all'; // Aktif kategori
  let _searchQuery = '';       // Arama terimi
  let _cart = [];              // Sepet

  return {
    get products()       { return _products; },
    get filtered()       { return _filtered; },
    get categories()     { return _categories; },
    get activeCategory() { return _activeCategory; },
    get searchQuery()    { return _searchQuery; },
    get cart()           { return _cart; },

    setProducts(data) {
      _products = data;
      _filtered = data;
    },
    setFiltered(data) { _filtered = data; },
    setCategories(data) { _categories = data; },
    setActiveCategory(cat) { _activeCategory = cat; },
    setSearchQuery(q) { _searchQuery = q; },
    setCart(c) { _cart = c; },
  };
});

/* ─── DOM CACHE ───────────────────────────────────────── */
const DOM = {
  navbar:          document.getElementById('navbar'),
  searchInput:     document.getElementById('searchInput'),
  searchClear:     document.getElementById('searchClear'),
  categoryFilters: document.getElementById('categoryFilters'),
  productGrid:     document.getElementById('productGrid'),
  productCount:    document.getElementById('productCount'),
  loadingState:    document.getElementById('loadingState'),
  errorState:      document.getElementById('errorState'),
  errorMsg:        document.getElementById('errorMsg'),
  retryBtn:        document.getElementById('retryBtn'),
  noResults:       document.getElementById('noResults'),
  // Cart
  cartBtn:         document.getElementById('cartBtn'),
  cartBadge:       document.getElementById('cartBadge'),
  cartOverlay:     document.getElementById('cartOverlay'),
  cartSidebar:     document.getElementById('cartSidebar'),
  cartClose:       document.getElementById('cartClose'),
  cartItems:       document.getElementById('cartItems'),
  cartTotalPrice:  document.getElementById('cartTotalPrice'),
  cartFooter:      document.getElementById('cartFooter'),
  checkoutBtn:     document.getElementById('checkoutBtn'),
  // Modal
  modalOverlay:    document.getElementById('modalOverlay'),
  modalClose:      document.getElementById('modalClose'),
  modalImage:      document.getElementById('modalImage'),
  modalCategory:   document.getElementById('modalCategory'),
  modalTitle:      document.getElementById('modalTitle'),
  modalRating:     document.getElementById('modalRating'),
  modalDesc:       document.getElementById('modalDesc'),
  modalPrice:      document.getElementById('modalPrice'),
  modalAddBtn:     document.getElementById('modalAddBtn'),
  // Toast
  toast:           document.getElementById('toast'),
};

/* ─── UTILITY FUNCTIONS ───────────────────────────────── */
const Utils = {
  /**
   * Belirli süre bekledikten sonra fonksiyon çağırır (performans için)
   */
  debounce(fn, delay = CONFIG.DEBOUNCE_DELAY) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Fiyatı formatlı string'e dönüştürür
   */
  formatPrice(price) {
    return `${CONFIG.CURRENCY}${Number(price).toFixed(2)}`;
  },

  /**
   * Yıldız rating HTML'i üretir
   */
  renderStars(rating) {
    const full  = Math.floor(rating);
    const half  = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return (
      '★'.repeat(full) +
      (half ? '½' : '') +
      '☆'.repeat(empty)
    );
  },

  /**
   * Kategori metnini formatlı hale getirir
   */
  formatCategory(cat) {
    return cat
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  },

  /**
   * Ürün adını kısaltır
   */
  truncate(str, max = 60) {
    return str.length > max ? str.slice(0, max) + '…' : str;
  },

  /**
   * localStorage'dan cart verisini yükler
   */
  loadCartFromStorage() {
    try {
      const raw = localStorage.getItem('luxe_cart');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Cart verisini localStorage'a kaydeder
   */
  saveCartToStorage(cart) {
    try {
      localStorage.setItem('luxe_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn('LocalStorage yazma hatası:', e);
    }
  },

  /**
   * Klavye Escape tuşunu dinler
   */
  onEscape(callback) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') callback();
    });
  },
};

/* ─── API SERVICE ─────────────────────────────────────── */
const ApiService = {
  /**
   * Tüm ürünleri getirir
   */
  async fetchProducts() {
    const res = await fetch(`${CONFIG.API_BASE}/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Ürünler yüklenemedi`);
    return res.json();
  },

  /**
   * Kategorileri getirir
   */
  async fetchCategories() {
    const res = await fetch(`${CONFIG.API_BASE}/products/categories`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Kategoriler yüklenemedi`);
    return res.json();
  },
};

/* ─── UI / RENDER FUNCTIONS ───────────────────────────── */
const UI = {
  /**
   * Loading spinner'ı gösterir/gizler
   */
  setLoading(visible) {
    DOM.loadingState.classList.toggle('hidden', !visible);
    DOM.productGrid.classList.toggle('hidden', visible);
  },

  /**
   * Hata durumunu gösterir
   */
  showError(msg) {
    DOM.loadingState.classList.add('hidden');
    DOM.productGrid.classList.add('hidden');
    DOM.errorMsg.textContent = msg;
    DOM.errorState.classList.remove('hidden');
  },

  /**
   * Hata durumunu gizler
   */
  hideError() {
    DOM.errorState.classList.add('hidden');
  },

  /**
   * Toast bildirimi gösterir
   */
  showToast(msg, type = 'info') {
    DOM.toast.textContent = msg;
    DOM.toast.className = `toast ${type} show`;
    clearTimeout(DOM.toast._timer);
    DOM.toast._timer = setTimeout(() => {
      DOM.toast.classList.remove('show');
    }, CONFIG.TOAST_DURATION);
  },

  /**
   * Ürün sayısını günceller
   */
  updateProductCount(count) {
    DOM.productCount.textContent = `— ${count} ürün`;
  },

  /**
   * Kategori filtre butonlarını render eder
   */
  renderCategoryFilters(categories) {
    // Mevcut butonları koru, yenilerini ekle
    const existing = DOM.categoryFilters.querySelector('[data-category="all"]');
    DOM.categoryFilters.innerHTML = '';
    DOM.categoryFilters.appendChild(existing);

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.category = cat;
      btn.textContent = Utils.formatCategory(cat);
      DOM.categoryFilters.appendChild(btn);
    });
  },

  /**
   * Tek bir ürün kartı HTML'i üretir
   */
  createProductCard(product, index) {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.style.setProperty('--i', index);
    card.dataset.id = product.id;

    const stars = Utils.renderStars(product.rating?.rate || 0);
    const count = product.rating?.count || 0;

    card.innerHTML = `
      <div class="product-card__img-wrap">
        <span class="product-card__badge">${Utils.formatCategory(product.category)}</span>
        <img
          class="product-card__img"
          src="${product.image}"
          alt="${product.title}"
          loading="lazy"
        />
      </div>
      <div class="product-card__body">
        <span class="product-card__cat">${Utils.formatCategory(product.category)}</span>
        <h3 class="product-card__title">${product.title}</h3>
        <div class="product-card__rating">
          <span class="stars">${stars}</span>
          <span>${product.rating?.rate || 0} (${count})</span>
        </div>
        <div class="product-card__footer">
          <div class="product-card__price">
            <span>${CONFIG.CURRENCY}</span>${Number(product.price).toFixed(2)}
          </div>
          <button
            class="product-card__add-btn"
            data-id="${product.id}"
            title="Sepete ekle"
            aria-label="${product.title} ürününü sepete ekle"
          >+</button>
        </div>
      </div>
    `;

    // Kart tıklaması → Modal aç (buton hariç)
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.product-card__add-btn')) {
        Modal.open(product);
      }
    });

    // Sepete ekle butonu
    const addBtn = card.querySelector('.product-card__add-btn');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Cart.addItem(product);
      UI.animateAddButton(addBtn);
    });

    return card;
  },

  /**
   * Ürün grid'ini render eder
   */
  renderProducts(products) {
    DOM.productGrid.innerHTML = '';
    DOM.noResults.classList.add('hidden');

    if (products.length === 0) {
      DOM.noResults.classList.remove('hidden');
      UI.updateProductCount(0);
      return;
    }

    const fragment = document.createDocumentFragment();
    products.forEach((product, i) => {
      fragment.appendChild(UI.createProductCard(product, i));
    });
    DOM.productGrid.appendChild(fragment);
    UI.updateProductCount(products.length);
  },

  /**
   * Sepete ekleme animasyonu
   */
  animateAddButton(btn) {
    btn.classList.add('added');
    btn.textContent = '✓';
    setTimeout(() => {
      btn.classList.remove('added');
      btn.textContent = '+';
    }, 1200);
  },

  /**
   * Aktif filtre butonunu günceller
   */
  setActiveFilterBtn(category) {
    DOM.categoryFilters.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });
  },
};

/* ─── FILTER / SEARCH LOGIC ───────────────────────────── */
const Filter = {
  /**
   * Kategori + arama kombinasyonuna göre ürünleri filtreler
   */
  apply() {
    const cat   = State.activeCategory;
    const query = State.searchQuery.toLowerCase().trim();

    let result = State.products;

    // Kategori filtresi
    if (cat !== 'all') {
      result = result.filter(p => p.category === cat);
    }

    // Arama filtresi (ürün adı)
    if (query) {
      result = result.filter(p =>
        p.title.toLowerCase().includes(query)
      );
    }

    State.setFiltered(result);
    UI.renderProducts(result);
  },

  /**
   * Kategori buton tıklamasını işler
   */
  onCategoryClick(e) {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    State.setActiveCategory(btn.dataset.category);
    UI.setActiveFilterBtn(btn.dataset.category);
    Filter.apply();
  },

  /**
   * Arama inputunu işler (debounced)
   */
  onSearch: Utils.debounce((value) => {
    State.setSearchQuery(value);
    DOM.searchClear.classList.toggle('visible', value.length > 0);
    Filter.apply();
  }),
};

/* ─── MODAL ───────────────────────────────────────────── */
const Modal = {
  _currentProduct: null,

  /**
   * Ürün detay modalını açar
   */
  open(product) {
    Modal._currentProduct = product;

    DOM.modalImage.src   = product.image;
    DOM.modalImage.alt   = product.title;
    DOM.modalCategory.textContent = Utils.formatCategory(product.category);
    DOM.modalTitle.textContent    = product.title;
    DOM.modalDesc.textContent     = product.description;
    DOM.modalPrice.textContent    = Utils.formatPrice(product.price);

    const stars = Utils.renderStars(product.rating?.rate || 0);
    DOM.modalRating.innerHTML = `
      <span class="stars">${stars}</span>
      <span>${product.rating?.rate || 0} / 5  (${product.rating?.count || 0} değerlendirme)</span>
    `;

    DOM.modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    DOM.modalClose.focus();
  },

  /**
   * Modalı kapatır
   */
  close() {
    DOM.modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
    Modal._currentProduct = null;
  },

  /**
   * Modal'daki "Sepete Ekle" butonunu işler
   */
  onAddToCart() {
    if (Modal._currentProduct) {
      Cart.addItem(Modal._currentProduct);
      Modal.close();
    }
  },
};

/* ─── CART ────────────────────────────────────────────── */
const Cart = {
  /**
   * Sepete ürün ekler (varsa miktarı artırır)
   */
  addItem(product) {
    const cart = [...State.cart];
    const idx = cart.findIndex(i => i.id === product.id);

    if (idx > -1) {
      cart[idx] = { ...cart[idx], qty: cart[idx].qty + 1 };
    } else {
      cart.push({ ...product, qty: 1 });
    }

    State.setCart(cart);
    Utils.saveCartToStorage(cart);
    Cart.render();
    Cart.updateBadge();
    UI.showToast(`"${Utils.truncate(product.title, 30)}" sepete eklendi`, 'success');
  },

  /**
   * Ürün miktarını değiştirir
   */
  changeQty(productId, delta) {
    let cart = [...State.cart];
    const idx = cart.findIndex(i => i.id === productId);
    if (idx === -1) return;

    const newQty = cart[idx].qty + delta;
    if (newQty <= 0) {
      cart = cart.filter(i => i.id !== productId);
    } else {
      cart[idx] = { ...cart[idx], qty: newQty };
    }

    State.setCart(cart);
    Utils.saveCartToStorage(cart);
    Cart.render();
    Cart.updateBadge();
  },

  /**
   * Ürünü sepetten siler
   */
  removeItem(productId) {
    const cart = State.cart.filter(i => i.id !== productId);
    State.setCart(cart);
    Utils.saveCartToStorage(cart);
    Cart.render();
    Cart.updateBadge();
    UI.showToast('Ürün sepetten çıkarıldı');
  },

  /**
   * Toplam fiyatı hesaplar
   */
  calcTotal() {
    return State.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  },

  /**
   * Toplam ürün sayısını hesaplar
   */
  calcItemCount() {
    return State.cart.reduce((sum, item) => sum + item.qty, 0);
  },

  /**
   * Sepet badge'ini günceller
   */
  updateBadge() {
    const count = Cart.calcItemCount();
    DOM.cartBadge.textContent = count;
    DOM.cartBadge.classList.toggle('visible', count > 0);
  },

  /**
   * Sepet sidebar içeriğini render eder
   */
  render() {
    const cart = State.cart;

    if (cart.length === 0) {
      DOM.cartItems.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty__icon">🛍</div>
          <p>Sepetiniz boş.<br/>Ürünleri keşfetmeye başlayın.</p>
        </div>
      `;
      DOM.cartFooter.style.display = 'none';
      return;
    }

    DOM.cartFooter.style.display = '';

    const fragment = document.createDocumentFragment();
    cart.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <div class="cart-item__img-wrap">
          <img class="cart-item__img" src="${item.image}" alt="${item.title}" />
        </div>
        <div class="cart-item__info">
          <p class="cart-item__title">${item.title}</p>
          <p class="cart-item__price">${Utils.formatPrice(item.price * item.qty)}</p>
          <div class="cart-item__controls">
            <button class="qty-btn" data-id="${item.id}" data-delta="-1" aria-label="Azalt">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" data-id="${item.id}" data-delta="1" aria-label="Artır">+</button>
            <button class="remove-btn" data-id="${item.id}" aria-label="Kaldır">✕</button>
          </div>
        </div>
      `;
      fragment.appendChild(div);
    });

    DOM.cartItems.innerHTML = '';
    DOM.cartItems.appendChild(fragment);
    DOM.cartTotalPrice.textContent = Utils.formatPrice(Cart.calcTotal());
  },

  /**
   * Sepet sidebar'ını açar
   */
  openSidebar() {
    DOM.cartSidebar.classList.add('open');
    DOM.cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  /**
   * Sepet sidebar'ını kapatır
   */
  closeSidebar() {
    DOM.cartSidebar.classList.remove('open');
    DOM.cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
  },

  /**
   * Cart item butonlarını event delegation ile işler
   */
  onItemAction(e) {
    const qtyBtn    = e.target.closest('.qty-btn');
    const removeBtn = e.target.closest('.remove-btn');

    if (qtyBtn) {
      Cart.changeQty(Number(qtyBtn.dataset.id), Number(qtyBtn.dataset.delta));
    }
    if (removeBtn) {
      Cart.removeItem(Number(removeBtn.dataset.id));
    }
  },
};

/* ─── NAVBAR SCROLL EFFECT ────────────────────────────── */
const NavbarEffect = {
  init() {
    window.addEventListener('scroll', () => {
      DOM.navbar.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  },
};

/* ─── APP BOOTSTRAP ───────────────────────────────────── */
const App = {
  /**
   * Uygulamayı başlatır
   */
  async init() {
    // LocalStorage'dan sepeti yükle
    const savedCart = Utils.loadCartFromStorage();
    State.setCart(savedCart);
    Cart.render();
    Cart.updateBadge();

    // Navbar efektini başlat
    NavbarEffect.init();

    // Event listener'ları bağla
    App.bindEvents();

    // Veriyi yükle
    await App.loadData();
  },

  /**
   * API'den ürün ve kategorileri çeker
   */
  async loadData() {
    UI.setLoading(true);
    UI.hideError();

    try {
      // Paralel API çağrısı (performans için)
      const [products, categories] = await Promise.all([
        ApiService.fetchProducts(),
        ApiService.fetchCategories(),
      ]);

      State.setProducts(products);
      State.setCategories(categories);

      UI.renderCategoryFilters(categories);
      UI.renderProducts(products);
      UI.setLoading(false);
    } catch (err) {
      console.error('Veri yükleme hatası:', err);
      UI.setLoading(false);
      UI.showError(err.message || 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    }
  },

  /**
   * Tüm event listener'ları tanımlar
   */
  bindEvents() {
    // ── Arama ─────────────────────────────────────
    DOM.searchInput.addEventListener('input', (e) => {
      Filter.onSearch(e.target.value);
    });
    DOM.searchClear.addEventListener('click', () => {
      DOM.searchInput.value = '';
      DOM.searchClear.classList.remove('visible');
      State.setSearchQuery('');
      Filter.apply();
      DOM.searchInput.focus();
    });

    // ── Kategori Filtreleme ────────────────────────
    DOM.categoryFilters.addEventListener('click', Filter.onCategoryClick);

    // ── Sepet ─────────────────────────────────────
    DOM.cartBtn.addEventListener('click', Cart.openSidebar);
    DOM.cartClose.addEventListener('click', Cart.closeSidebar);
    DOM.cartOverlay.addEventListener('click', Cart.closeSidebar);
    DOM.cartItems.addEventListener('click', Cart.onItemAction);
    DOM.checkoutBtn.addEventListener('click', () => {
      UI.showToast('Ödeme sayfasına yönlendiriliyor…', 'success');
    });

    // ── Modal ──────────────────────────────────────
    DOM.modalClose.addEventListener('click', Modal.close);
    DOM.modalOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.modalOverlay) Modal.close();
    });
    DOM.modalAddBtn.addEventListener('click', Modal.onAddToCart);

    // ── Hata durumu yeniden deneme ─────────────────
    DOM.retryBtn.addEventListener('click', App.loadData);

    // ── Klavye ESC kapatma ─────────────────────────
    Utils.onEscape(() => {
      Modal.close();
      Cart.closeSidebar();
    });
  },
};

/* ─── LAUNCH ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => App.init());