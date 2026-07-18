//js/products.js

'use strict';

/* ==========================================================
   
   Backend routes:
   GET    /catalog/categories
   GET    /catalog/categories/:categoryKey/subcategories
   GET    /products
   GET    /products/:productId
   POST   /products
   PUT    /products/:productId
   DELETE /products/:productId
   PUT    /products/:productId/restore
========================================================== */

(function () {
  'use strict';

  /* ========================================================
     Configuration
  ======================================================== */

  const CONFIG = Object.freeze({
    API_BASE:
      typeof window.RETAILER_WEB_API_BASE === 'string' &&
      window.RETAILER_WEB_API_BASE.trim()
        ? window.RETAILER_WEB_API_BASE.trim().replace(/\/+$/, '')
        : 'https://api.revstore.in/api/retailer-web/v1',

    IMAGE_BASE:
      typeof window.RETAILER_IMAGE_BASE === 'string' &&
      window.RETAILER_IMAGE_BASE.trim()
        ? window.RETAILER_IMAGE_BASE.trim().replace(/\/+$/, '')
        : 'https://api.revstore.in',

    LOGIN_URL:
      typeof window.RETAILER_WEB_LOGIN_URL === 'string' &&
      window.RETAILER_WEB_LOGIN_URL.trim()
        ? window.RETAILER_WEB_LOGIN_URL.trim()
        : '/retailer/login',

    DASHBOARD_URL:
      typeof window.RETAILER_WEB_DASHBOARD_URL === 'string' &&
      window.RETAILER_WEB_DASHBOARD_URL.trim()
        ? window.RETAILER_WEB_DASHBOARD_URL.trim()
        : '/retailer/dashboard',

    FALLBACK_IMAGE: '/images/no-image.png',

    PAGE_LIMIT: 20,
    MAX_IMAGES: 7,
    SEARCH_DELAY_MS: 400,
    TOAST_DURATION_MS: 3500
  });

  const API = Object.freeze({
    status: CONFIG.API_BASE + '/auth/status',

    logout: CONFIG.API_BASE + '/auth/logout',

    categories: CONFIG.API_BASE + '/catalog/categories',

    subcategories(categoryKey) {
      return (
        CONFIG.API_BASE +
        '/catalog/categories/' +
        encodeURIComponent(String(categoryKey || '').trim()) +
        '/subcategories'
      );
    },

    products: CONFIG.API_BASE + '/products',

    product(productId) {
      return (
        CONFIG.API_BASE +
        '/products/' +
        encodeURIComponent(String(productId || '').trim())
      );
    },

    restoreProduct(productId) {
      return (
        CONFIG.API_BASE +
        '/products/' +
        encodeURIComponent(String(productId || '').trim()) +
        '/restore'
      );
    }
  });

  /* ========================================================
     Application state
  ======================================================== */

  const State = {
    initialized: false,
    pageLoading: false,
    productLoading: false,
    submitLoading: false,

    retailer: null,

    categories: [],
    subcategories: [],
    products: [],

    selectedCategory: '',
    selectedSubcategory: '',

    includeDeleted: true,
    search: '',

    page: 1,
    limit: CONFIG.PAGE_LIMIT,
    total: 0,
    pages: 1,

    editingProduct: null,

    existingImages: [],
    removedImages: [],
    selectedNewFiles: []
  };

  /* ========================================================
     DOM references

     These IDs must exist in products.html.
  ======================================================== */

  const UI = {
    pageTitle: document.getElementById('pageTitle'),
    welcomeTitle: document.getElementById('welcomeTitle'),
    shopStatusBadge: document.getElementById('shopStatusBadge'),
    shopStatusText: document.getElementById('shopStatusText'),

    dashboardBtn: document.getElementById('dashboardBtn'),
    refreshBtn:
      document.getElementById('btnRefresh') ||
      document.getElementById('refreshBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    addProductBtn:
      document.getElementById('btnAddProduct') ||
      document.getElementById('addProductBtn'),

    categoryList: document.getElementById('categoryList'),
    subcategoryList: document.getElementById('subcategoryList'),

    productGrid: document.getElementById('productGrid'),
    emptyState: document.getElementById('emptyState'),
    emptyStateTitle: document.getElementById('emptyStateTitle'),
    emptyStateText: document.getElementById('emptyStateText'),

    searchInput:
      document.getElementById('txtSearch') ||
      document.getElementById('searchInput'),

    
    pagination: document.getElementById('pagination'),

    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText:
      document.getElementById('loadingMessage') ||
      document.getElementById('loadingText'),

    toastContainer: document.getElementById('toastContainer'),

    productModal: document.getElementById('productModal'),
    productForm: document.getElementById('productForm'),
    productId: document.getElementById('productId'),
    modalTitle: document.getElementById('modalTitle'),   
    
    closeModalBtn:
      document.getElementById('closeModalBtn') ||
      document.getElementById('closeModal'),

    cancelProductBtn:
      document.getElementById('cancelProductBtn') ||
      document.getElementById('cancelProduct'),

    saveProductBtn: document.getElementById('saveProductBtn'),

    productName: document.getElementById('productName'),
    productDescription: document.getElementById('productDescription'),
    productStock: document.getElementById('productStock'),
    productCategory: document.getElementById('productCategory'),
    productSubcategory: document.getElementById('productSubcategory'),

    productRevPrice: document.getElementById('productRevPrice'),
    productOfferPrice: document.getElementById('productOfferPrice'),
    productPrice: document.getElementById('productPrice'),
    productActualPrice: document.getElementById('productActualPrice'),

    productImages: document.getElementById('productImages'),

    existingImagesSection:
      document.getElementById('existingImagesSection'),

    existingImagePreview:
      document.getElementById('existingImagePreview'),

    newImagesSection:
      document.getElementById('newImagesSection'),

    newImagePreview:
      document.getElementById('newImagePreview')
  };

  /* ========================================================
     Required-element validation
  ======================================================== */

  function assertRequiredElements() {
    const required = [
      ['categoryList', UI.categoryList],
      ['subcategoryList', UI.subcategoryList],
      ['productGrid', UI.productGrid],
      ['search input', UI.searchInput],
      ['add product button', UI.addProductBtn],
      ['refresh button', UI.refreshBtn],
      ['loading overlay', UI.loadingOverlay],
      ['toast container', UI.toastContainer],
      ['product modal', UI.productModal],
      ['product form', UI.productForm]
    ];

    const missing = required
      .filter(function (entry) {
        return !entry[1];
      })
      .map(function (entry) {
        return entry[0];
      });

    if (missing.length) {
      throw new Error(
        'products.html is missing required elements: ' +
          missing.join(', ')
      );
    }
  }

  /* ========================================================
     General helpers
  ======================================================== */

  function cleanText(value, fallback) {
    const result = String(value == null ? '' : value).trim();

    if (result) {
      return result;
    }

    return String(fallback == null ? '' : fallback);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeKey(value) {
    return cleanText(value).toLowerCase();
  }

  function getCategoryKey(category) {
    return cleanText(
      category &&
        (
          category.key ||
          category.categoryKey ||
          category.slug ||
          category.value ||
          category.id ||
          category._id
        )
    );
  }

  function getCategoryName(category) {
    return cleanText(
      category &&
        (
          category.name ||
          category.label ||
          category.title ||
          category.displayName
        ),
      getCategoryKey(category) || 'Category'
    );
  }

  function getSubcategoryKey(subcategory) {
    return cleanText(
      subcategory &&
        (
          subcategory.key ||
          subcategory.subcategoryKey ||
          subcategory.subCategoryKey ||
          subcategory.slug ||
          subcategory.value ||
          subcategory.id ||
          subcategory._id
        )
    );
  }

  function getSubcategoryName(subcategory) {
    return cleanText(
      subcategory &&
        (
          subcategory.name ||
          subcategory.label ||
          subcategory.title ||
          subcategory.displayName
        ),
      getSubcategoryKey(subcategory) ||
        'Subcategory'
    );
  }

  function getProductId(product) {
    return cleanText(
      product && (product._id || product.id || product.productId)
    );
  }

  function clearElement(element) {
    if (!element) {
      return;
    }

    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function extractArray(payload, keys) {
    const requestedKeys = Array.isArray(keys)
      ? keys
      : [keys];

    const visited = new Set();

    function search(value, depth) {
      if (depth > 5 || value == null) {
        return [];
      }

      if (Array.isArray(value)) {
        return value;
      }

      if (typeof value !== 'object') {
        return [];
      }

      if (visited.has(value)) {
        return [];
      }

      visited.add(value);

      for (
        let index = 0;
        index < requestedKeys.length;
        index += 1
      ) {
        const key = requestedKeys[index];

        if (Array.isArray(value[key])) {
          return value[key];
        }

        if (
          value[key] &&
          typeof value[key] === 'object'
        ) {
          const nestedResult = search(
            value[key],
            depth + 1
          );

          if (nestedResult.length) {
            return nestedResult;
          }
        }
      }

      const wrapperKeys = [
        'data',
        'result',
        'results',
        'items',
        'payload',
        'response'
      ];

      for (
        let index = 0;
        index < wrapperKeys.length;
        index += 1
      ) {
        const wrapper = value[wrapperKeys[index]];

        const nestedResult = search(
          wrapper,
          depth + 1
        );

        if (nestedResult.length) {
          return nestedResult;
        }
      }

      return [];
    }

    return search(payload, 0);
  }

  function debounce(callback, delay) {
    let timer = null;

    return function debouncedCallback() {
      const args = arguments;
      const context = this;

      if (timer) {
        window.clearTimeout(timer);
      }

      timer = window.setTimeout(function () {
        callback.apply(context, args);
      }, delay);
    };
  }

  function getCookie(name) {
    const target = encodeURIComponent(String(name || '')) + '=';
    const parts = String(document.cookie || '').split(';');

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index].trim();

      if (part.indexOf(target) === 0) {
        try {
          return decodeURIComponent(part.slice(target.length));
        } catch (_) {
          return part.slice(target.length);
        }
      }
    }

    return '';
  }

  function getCsrfToken() {
    return getCookie('csrf_token');
  }

  function redirectToLogin() {
    window.location.replace(CONFIG.LOGIN_URL);
  }

  function redirectToDashboard() {
    window.location.assign(CONFIG.DASHBOARD_URL);
  }

  function resolveImageUrl(value) {
    const image = cleanText(value);

    if (!image) {
      return CONFIG.FALLBACK_IMAGE;
    }

    if (/^(?:data:|blob:)/i.test(image)) {
      return image;
    }

    if (/^https?:\/\//i.test(image)) {
      return image;
    }

    if (image.startsWith('/')) {
      return CONFIG.IMAGE_BASE + image;
    }

    return (
      CONFIG.IMAGE_BASE +
      '/' +
      image.replace(/^\/+/, '')
    );
  }

  function setImageFallback(imageElement) {
    if (!imageElement) {
      return;
    }

    imageElement.addEventListener(
      'error',
      function handleImageError() {
        imageElement.removeEventListener(
          'error',
          handleImageError
        );

        imageElement.src = CONFIG.FALLBACK_IMAGE;
      }
    );
  }

  function formatCurrencyFromPaise(value) {
    const paise = Number(value);

    if (!Number.isFinite(paise)) {
      return '—';
    }

    const amount = paise / 100;

    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (_) {
      return '₹' + amount.toFixed(2);
    }
  }

  function formatDate(value) {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    try {
      return date.toLocaleString('en-IN');
    } catch (_) {
      return date.toISOString();
    }
  }

  function getProductImages(product) {
    if (!product || typeof product !== 'object') {
      return [];
    }

    if (Array.isArray(product.images)) {
      return product.images
        .map(function (image) {
          return cleanText(image);
        })
        .filter(Boolean);
    }

    const singleImage = cleanText(product.image);

    return singleImage ? [singleImage] : [];
  }

  function getPrimaryProductImage(product) {
    const images = getProductImages(product);

    return images.length
      ? resolveImageUrl(images[0])
      : CONFIG.FALLBACK_IMAGE;
  }

  function getProductDisplayPrice(product) {
    const candidates = [
      product && product.offerPrice,
      product && product.price,
      product && product.priceActual
    ];

    for (let index = 0; index < candidates.length; index += 1) {
      const value = Number(candidates[index]);

      if (Number.isFinite(value)) {
        return formatCurrencyFromPaise(value);
      }
    }

    return '—';
  }

  function getProductOriginalPrice(product) {
    const actualPrice = Number(product && product.priceActual);
    const displayPrice = Number(
      product && (product.offerPrice ?? product.price)
    );

    if (
      !Number.isFinite(actualPrice) ||
      !Number.isFinite(displayPrice) ||
      actualPrice <= displayPrice
    ) {
      return '';
    }

    return formatCurrencyFromPaise(actualPrice);
  }

  function calculateOfferPercent(product) {
    const actualPrice = Number(product && product.priceActual);
    const offerPrice = Number(
      product && (product.offerPrice ?? product.price)
    );

    if (
      !Number.isFinite(actualPrice) ||
      !Number.isFinite(offerPrice) ||
      actualPrice <= 0 ||
      offerPrice >= actualPrice
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.round(
        ((actualPrice - offerPrice) / actualPrice) * 100
      )
    );
  }

  /* ========================================================
     Loading state
  ======================================================== */
  function updateLoadingOverlay(message) {
    const visible =
      State.pageLoading ||
      State.productLoading;

    if (UI.loadingText && message) {
      UI.loadingText.textContent = message;
    }

    if (UI.loadingOverlay) {
      UI.loadingOverlay.classList.toggle(
        'show',
        visible
      );

      UI.loadingOverlay.setAttribute(
        'aria-hidden',
        visible ? 'false' : 'true'
      );
    }

    if (UI.refreshBtn) {
      UI.refreshBtn.disabled =
        State.pageLoading ||
        State.productLoading ||
        State.submitLoading;
    }

    if (UI.addProductBtn) {
      UI.addProductBtn.disabled =
        State.pageLoading ||
        State.productLoading ||
        State.submitLoading;
    }

    if (UI.searchInput) {
      UI.searchInput.disabled =
        State.pageLoading ||
        State.productLoading;
    }
  }

  function setPageLoading(isLoading, message) {
    State.pageLoading = Boolean(isLoading);
    updateLoadingOverlay(message);
  }

  function setProductLoading(isLoading, message) {
    State.productLoading = Boolean(isLoading);
    updateLoadingOverlay(message);
  }  

  /* ========================================================
     Toast notifications
  ======================================================== */

  function showToast(message, type) {
    const safeType = ['success', 'error', 'warning', 'info']
      .includes(type)
      ? type
      : 'info';

    const toastElement = document.createElement('div');
    toastElement.className = 'toast ' + safeType;
    toastElement.setAttribute('role', 'status');

    const messageElement = document.createElement('span');
    messageElement.className = 'toast-message';
    messageElement.textContent = cleanText(
      message,
      'Something went wrong.'
    );

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'toast-close';
    closeButton.setAttribute('aria-label', 'Dismiss notification');
    closeButton.textContent = '×';

    let removeTimer = null;

    function removeToast() {
      if (removeTimer) {
        window.clearTimeout(removeTimer);
        removeTimer = null;
      }

      toastElement.classList.add('toast-hiding');

      window.setTimeout(function () {
        toastElement.remove();
      }, 200);
    }

    closeButton.addEventListener('click', removeToast);

    toastElement.appendChild(messageElement);
    toastElement.appendChild(closeButton);
    UI.toastContainer.appendChild(toastElement);

    window.requestAnimationFrame(function () {
      toastElement.classList.add('show');
    });

    removeTimer = window.setTimeout(
      removeToast,
      CONFIG.TOAST_DURATION_MS
    );
  }

  /* ========================================================
     API wrapper
  ======================================================== */

  async function apiFetch(url, options) {
    const suppliedOptions = options || {};
    const method = cleanText(
      suppliedOptions.method,
      'GET'
    ).toUpperCase();

    const headers = new Headers(
      suppliedOptions.headers || {}
    );

    headers.set('Accept', 'application/json');
    headers.set('X-Requested-With', 'XMLHttpRequest');

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrfToken = getCsrfToken();

      if (!csrfToken) {
        const csrfError = new Error(
          'Security token is missing. Please refresh and login again.'
        );

        csrfError.status = 403;
        throw csrfError;
      }

      if (!headers.has('x-csrf-token')) {
        headers.set('x-csrf-token', csrfToken);
      }
    }

    let response;

    try {
      response = await fetch(url, {
        ...suppliedOptions,
        method,
        headers,
        credentials: 'include',
        cache: 'no-store',
        redirect: 'follow',
        referrerPolicy: 'strict-origin-when-cross-origin'
      });
    } catch (_) {
      const networkError = new Error(
        'Unable to reach the server. Check your internet connection.'
      );

      networkError.status = 0;
      throw networkError;
    }

    let data = {};
    const contentType =
      response.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const responseText = await response.text();

        data = responseText
          ? { message: responseText }
          : {};
      }
    } catch (_) {
      data = {};
    }

    if (!response.ok) {
      const error = new Error(
        cleanText(
          data && data.message,
          response.status === 401
            ? 'Session expired. Please login again.'
            : response.status === 403
              ? 'You are not allowed to perform this action.'
              : 'Request failed.'
        )
      );

      error.status = response.status;
      error.payload = data;

      throw error;
    }

    return data || {};
  }

  function handleError(error, options) {
    const config = options || {};
    const status = Number(error && error.status);

    console.error('[Retailer Products]', error);

    if (status === 401) {
      showToast(
        cleanText(
          error && error.message,
          'Session expired. Redirecting to login.'
        ),
        'error'
      );

      window.setTimeout(redirectToLogin, 700);
      return;
    }

    if (status === 403 && config.redirectOnForbidden === true) {
      showToast(
        cleanText(
          error && error.message,
          'Access denied. Redirecting to login.'
        ),
        'error'
      );

      window.setTimeout(redirectToLogin, 700);
      return;
    }

    showToast(
      cleanText(
        error && error.message,
        'Unexpected error.'
      ),
      'error'
    );
  }

  /* ========================================================
     Empty-state helpers
  ======================================================== */

  function showEmptyState(title, text) {
    if (!UI.emptyState) {
      return;
    }

    if (UI.emptyStateTitle) {
      UI.emptyStateTitle.textContent = cleanText(
        title,
        'No products found'
      );
    }

    if (UI.emptyStateText) {
      UI.emptyStateText.textContent = cleanText(
        text,
        'No products are available for this view.'
      );
    }

    UI.emptyState.classList.add('show');
    UI.emptyState.classList.remove('hidden');
  }

  function hideEmptyState() {
    if (!UI.emptyState) {
      return;
    }

    UI.emptyState.classList.remove('show');
    UI.emptyState.classList.add('hidden');
  }

  /* ========================================================
     Retailer session/status
  ======================================================== */

  function renderRetailerStatus(retailer) {
    const profile =
      retailer && typeof retailer === 'object'
        ? retailer
        : {};

    const displayName = cleanText(
      profile.displayName ||
        profile.shopName ||
        profile.name,
      'Retailer'
    );

    State.retailer = profile;

    if (UI.welcomeTitle) {
      UI.welcomeTitle.textContent =
        'Welcome, ' + displayName;
    }

    if (UI.pageTitle) {
      UI.pageTitle.textContent =
        displayName + ' Products';
    }

    const isOnline =
      profile.isOnline === true ||
      normalizeKey(profile.status) === 'online';

    const statusText = cleanText(
      profile.statusLabel,
      isOnline ? 'Online' : 'Closed'
    );

    if (UI.shopStatusBadge) {
      UI.shopStatusBadge.classList.remove(
        'online',
        'closed',
        'closing-soon'
      );

      if (profile.isClosingSoon === true) {
        UI.shopStatusBadge.classList.add('closing-soon');
      } else {
        UI.shopStatusBadge.classList.add(
          isOnline ? 'online' : 'closed'
        );
      }

      UI.shopStatusBadge.setAttribute(
        'aria-label',
        'Shop status: ' + statusText
      );
    }

    if (UI.shopStatusText) {
      UI.shopStatusText.textContent =
        profile.isClosingSoon === true
          ? 'Closing Soon'
          : statusText;
    }
  }

  async function loadRetailerStatus() {
    const payload = await apiFetch(API.status, {
      method: 'GET'
    });

    let retailer = null;

    if (
      payload.retailer &&
      typeof payload.retailer === 'object'
    ) {
      retailer = payload.retailer;
    } else if (
      payload.data &&
      payload.data.retailer &&
      typeof payload.data.retailer === 'object'
    ) {
      retailer = payload.data.retailer;
    } else if (
      payload.data &&
      typeof payload.data === 'object' &&
      !Array.isArray(payload.data)
    ) {
      retailer = payload.data;
    } else if (
      payload.user &&
      typeof payload.user === 'object'
    ) {
      retailer = payload.user;
    }

    /*
    * The products page does not contain retailer-status
    * elements, so a missing retailer object must not prevent
    * categories and products from loading.
    */
    if (!retailer) {
      console.warn(
        '[Retailer Products] Retailer status response did not contain a retailer object.',
        payload
      );

      return null;
    }

    renderRetailerStatus(retailer);

    return retailer;
  }

  /* ========================================================
     Category loading/rendering
  ======================================================== */

  function setActiveCategoryCard(categoryKey) {
    const normalized = normalizeKey(categoryKey);

    UI.categoryList
      .querySelectorAll('.category-card')
      .forEach(function (card) {
        const active =
          normalizeKey(card.dataset.categoryKey) === normalized;

        card.classList.toggle('active', active);
        card.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });
  }

  function renderCategoryCard(category) {
    const categoryKey = getCategoryKey(category);
    const categoryName = getCategoryName(category);
    if (!categoryKey) {
      return;
    }

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'category-card';
    card.dataset.categoryKey = categoryKey;
    card.setAttribute('aria-pressed', 'false');

    const image = document.createElement('img');
    image.className = 'category-image';
    image.src = resolveImageUrl(
      category.image ||
      category.imageUrl ||
      category.icon ||
      category.thumbnail
    );
    image.alt = categoryName;
    image.loading = 'lazy';
    setImageFallback(image);

    const info = document.createElement('span');
    info.className = 'category-info';

    const name = document.createElement('span');
    name.className = 'category-name';
    name.textContent = categoryName;

    info.appendChild(name);
    card.appendChild(image);
    card.appendChild(info);

    card.addEventListener(
      'click',
      async function () {
        if (
          State.pageLoading ||
          State.productLoading ||
          State.submitLoading ||
          normalizeKey(State.selectedCategory) ===
            normalizeKey(categoryKey)
        ) {
          return;
        }

        State.selectedCategory = categoryKey;
        State.selectedSubcategory = '';
        State.page = 1;

        setActiveCategoryCard(categoryKey);

        setProductLoading(
          true,
          'Loading subcategories...'
        );

        try {
          await loadSubcategories(categoryKey);
        } catch (error) {
          State.subcategories = [];
          State.products = [];
          State.total = 0;
          State.pages = 1;
          State.page = 1;

          clearElement(UI.subcategoryList);
          clearElement(UI.productGrid);

          showEmptyState(
            'Subcategories could not be loaded',
            cleanText(
              error && error.message,
              'Please refresh and try again.'
            )
          );

          renderPagination();
          handleError(error);
        } finally {
          /*
          * loadProducts may already have cleared this state.
          * Calling false again is harmless.
          */
          setProductLoading(false);
        }
      }
    );

    UI.categoryList.appendChild(card);
  }

  async function loadCategories(options) {
    const config = options || {};

    const preserveSelection =
      config.preserveSelection === true;

    const payload = await apiFetch(
      API.categories,
      {
        method: 'GET'
      }
    );

    const categories = extractArray(
      payload,
      [
        'categories',
        'assignedCategories',
        'allowedCategories',
        'items',
        'results'
      ]
    ).filter(function (category) {
      return (
        category &&
        typeof category === 'object' &&
        category.isDeleted !== true &&
        getCategoryKey(category)
      );
    });

    State.categories = categories;

    clearElement(UI.categoryList);

    if (!categories.length) {
      State.selectedCategory = '';
      State.selectedSubcategory = '';
      State.subcategories = [];
      State.products = [];
      State.total = 0;
      State.pages = 1;
      State.page = 1;

      clearElement(UI.subcategoryList);
      clearElement(UI.productGrid);

      syncModalCategoryOptions();

      showEmptyState(
        'No categories available',
        cleanText(
          payload.message,
          'No active product categories are assigned to this retailer.'
        )
      );

      renderPagination();
      return;
    }

    categories.forEach(renderCategoryCard);

    const selectedStillExists =
      preserveSelection &&
      categories.some(function (category) {
        return (
          normalizeKey(
            getCategoryKey(category)
          ) ===
          normalizeKey(
            State.selectedCategory
          )
        );
      });

    if (!selectedStillExists) {
      State.selectedCategory =
        getCategoryKey(categories[0]);

      State.selectedSubcategory = '';
      State.page = 1;
    }

    setActiveCategoryCard(
      State.selectedCategory
    );

    await loadSubcategories(
      State.selectedCategory,
      {
        preserveSelection
      }
    );
  }

  /* ========================================================
     Subcategory loading/rendering
  ======================================================== */

  function setActiveSubcategoryCard(subcategoryKey) {
    const normalized = normalizeKey(subcategoryKey);

    UI.subcategoryList
      .querySelectorAll('.subcategory-card')
      .forEach(function (card) {
        const active =
          normalizeKey(card.dataset.subcategoryKey) ===
          normalized;

        card.classList.toggle('active', active);
        card.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });
  }  

  function renderSubcategoryCard(subcategory) {
    const subcategoryKey =
      getSubcategoryKey(subcategory);

    const subcategoryName =
      getSubcategoryName(subcategory);

    if (!subcategoryKey) {
      return;
    }

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'subcategory-card';
    card.dataset.subcategoryKey = subcategoryKey;
    card.setAttribute('aria-pressed', 'false');

    const image = document.createElement('img');
    image.className = 'subcategory-image';
    image.src = resolveImageUrl(
      subcategory.image ||
      subcategory.imageUrl ||
      subcategory.icon ||
      subcategory.thumbnail
    );
    image.alt = subcategoryName;
    image.loading = 'lazy';
    setImageFallback(image);

    const info = document.createElement('span');
    info.className = 'subcategory-info';

    const name = document.createElement('span');
    name.className = 'subcategory-name';
    name.textContent = subcategoryName;

    info.appendChild(name);
    card.appendChild(image);
    card.appendChild(info);

    card.addEventListener(
      'click',
      async function () {
        if (
          State.pageLoading ||
          State.productLoading ||
          State.submitLoading ||
          normalizeKey(
            State.selectedSubcategory
          ) === normalizeKey(subcategoryKey)
        ) {
          return;
        }

        State.selectedSubcategory =
          subcategoryKey;

        State.page = 1;

        setActiveSubcategoryCard(
          subcategoryKey
        );

        syncModalCategoryOptions();

        await loadProducts(1);
      }
    );

    UI.subcategoryList.appendChild(card);
  }

  async function loadSubcategories(
    categoryKey,
    options
  ) {
    const config = options || {};

    const preserveSelection =
      config.preserveSelection === true;

    const safeCategoryKey =
      cleanText(categoryKey);

    if (!safeCategoryKey) {
      State.subcategories = [];
      State.selectedSubcategory = '';
      State.products = [];
      State.total = 0;
      State.pages = 1;
      State.page = 1;

      clearElement(UI.subcategoryList);
      clearElement(UI.productGrid);

      syncModalCategoryOptions();

      showEmptyState(
        'Select a category',
        'Select a category to load its subcategories.'
      );

      renderPagination();
      return;
    }

    clearElement(UI.subcategoryList);
    clearElement(UI.productGrid);
    hideEmptyState();

    const payload = await apiFetch(
      API.subcategories(safeCategoryKey),
      {
        method: 'GET'
      }
    );

    const subcategories = extractArray(
      payload,
      [
        'subcategories',
        'subCategories',
        'assignedSubcategories',
        'allowedSubcategories',
        'items',
        'results'
      ]
    ).filter(function (subcategory) {
      return (
        subcategory &&
        typeof subcategory === 'object' &&
        subcategory.isDeleted !== true &&
        getSubcategoryKey(subcategory)
      );
    });

    State.subcategories = subcategories;

    if (!subcategories.length) {
      State.selectedSubcategory = '';
      State.products = [];
      State.total = 0;
      State.pages = 1;
      State.page = 1;

      syncModalCategoryOptions();

      showEmptyState(
        'No subcategories available',
        cleanText(
          payload.message,
          'This category does not contain any active subcategories.'
        )
      );

      renderPagination();
      return;
    }

    subcategories.forEach(
      renderSubcategoryCard
    );

    const selectedStillExists =
      preserveSelection &&
      subcategories.some(function (subcategory) {
        return (
          normalizeKey(
            getSubcategoryKey(subcategory)
          ) ===
          normalizeKey(
            State.selectedSubcategory
          )
        );
      });

    if (!selectedStillExists) {
      State.selectedSubcategory =
        getSubcategoryKey(subcategories[0]);

      State.page = 1;
    }

    setActiveSubcategoryCard(
      State.selectedSubcategory
    );

    syncModalCategoryOptions();

    await loadProducts(State.page);
  }

  /* ========================================================
     Product loading
  ======================================================== */

  function buildProductsQuery(page) {
    const params = new URLSearchParams();

    params.set(
      'page',
      String(Math.max(1, Number(page) || 1))
    );

    params.set('limit', String(State.limit));

    if (State.search) {
      params.set('search', State.search);
    }

    if (State.selectedCategory) {
      params.set('category', State.selectedCategory);
    }

    if (State.selectedSubcategory) {
      params.set(
        'subCategory',
        State.selectedSubcategory
      );
    }

    // Required for displaying deleted products with Restore action.
    params.set('includeDeleted', 'true');

    return params.toString();
  }

  async function loadProducts(page) {
    if (
      !State.selectedCategory ||
      !State.selectedSubcategory
    ) {
      State.products = [];
      State.total = 0;
      State.pages = 1;
      State.page = 1;

      clearElement(UI.productGrid);

      showEmptyState(
        'Select a subcategory',
        'Select a category and subcategory to load products.'
      );

      renderPagination();
      return;
    }

    setProductLoading(true, 'Loading products...');

    try {
      const requestedPage = Math.max(
        1,
        Number(page) || 1
      );

      const query = buildProductsQuery(requestedPage);

      const payload = await apiFetch(
        API.products + '?' + query,
        { method: 'GET' }
      );

      const products = extractArray(
        payload,
        'products'
      );

      State.products = products;
      const paginationSource =
        payload.pagination &&
        typeof payload.pagination === 'object'
          ? payload.pagination
          : payload.data &&
              payload.data.pagination &&
              typeof payload.data.pagination === 'object'
            ? payload.data.pagination
            : payload.data &&
                typeof payload.data === 'object'
              ? payload.data
              : payload;

      State.total = Math.max(
        0,
        Number(
          paginationSource.total ??
          paginationSource.totalProducts ??
          paginationSource.count ??
          products.length
        ) || 0
      );

      State.pages = Math.max(
        1,
        Number(
          paginationSource.pages ??
          paginationSource.totalPages ??
          Math.ceil(
            State.total / State.limit
          )
        ) || 1
      );

      State.page = Math.min(
        requestedPage,
        State.pages
      );

      if (
        requestedPage > State.pages &&
        State.total > 0
      ) {
        await loadProducts(State.pages);
        return;
      }

      renderProducts();
      renderPagination();
    } catch (error) {
      State.products = [];
      State.total = 0;
      State.pages = 1;
      State.page = 1;

      clearElement(UI.productGrid);

      showEmptyState(
        'Products could not be loaded',
        cleanText(
          error && error.message,
          'Please refresh and try again.'
        )
      );

      renderPagination();
      handleError(error);
    } finally {
      setProductLoading(false);
    }
  }

  /* ========================================================
     Product rendering
  ======================================================== */

  function renderProductCard(product) {
    const productId = getProductId(product);

    if (!productId) {
      return;
    }

    const deleted = product.isDeleted === true;
    const stock = Number(product.stock);
    const offerPercent = calculateOfferPercent(product);
    const originalPrice = getProductOriginalPrice(product);

    const card = document.createElement('article');
    card.className =
      'product-card' +
      (deleted ? ' is-deleted' : '');

    card.dataset.productId = productId;

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'product-image-wrap';

    const image = document.createElement('img');
    image.className = 'product-image';
    image.src = getPrimaryProductImage(product);
    image.alt = cleanText(product.name, 'Product');
    image.loading = 'lazy';
    setImageFallback(image);

    imageWrapper.appendChild(image);

    if (deleted) {
      const deletedBadge = document.createElement('span');
      deletedBadge.className = 'product-badge deleted';
      deletedBadge.textContent = 'Deleted';
      imageWrapper.appendChild(deletedBadge);
    } else if (offerPercent > 0) {
      const offerBadge = document.createElement('span');
      offerBadge.className = 'product-badge offer';
      offerBadge.textContent =
        String(offerPercent) + '% OFF';
      imageWrapper.appendChild(offerBadge);
    }

    const body = document.createElement('div');
    body.className = 'product-body';

    const name = document.createElement('h3');
    name.className = 'product-name';
    name.textContent = cleanText(
      product.name,
      'Unnamed product'
    );

    const description = document.createElement('p');
    description.className = 'product-description';
    description.textContent = cleanText(
      product.description,
      'No description'
    );

    const priceRow = document.createElement('div');
    priceRow.className = 'product-price-row';

    const currentPrice = document.createElement('span');
    currentPrice.className = 'product-price';
    currentPrice.textContent =
      getProductDisplayPrice(product);

    priceRow.appendChild(currentPrice);

    if (originalPrice) {
      const originalPriceElement =
        document.createElement('span');

      originalPriceElement.className =
        'product-original-price';

      originalPriceElement.textContent =
        originalPrice;

      priceRow.appendChild(originalPriceElement);
    }

    const meta = document.createElement('div');
    meta.className = 'product-meta';

    const stockElement = document.createElement('span');
    stockElement.className =
      'product-stock ' +
      (Number.isFinite(stock) && stock > 0
        ? 'in-stock'
        : 'out-of-stock');

    stockElement.textContent =
      Number.isFinite(stock)
        ? 'Stock: ' + String(stock)
        : 'Stock: —';

    const updatedElement = document.createElement('span');
    updatedElement.className = 'product-updated';
    updatedElement.textContent =
      'Updated: ' + formatDate(product.updatedAt);

    meta.appendChild(stockElement);
    meta.appendChild(updatedElement);

    const actions = document.createElement('div');
    actions.className = 'product-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'btn btn-primary edit-product-btn';
    editButton.textContent = 'Edit';
    editButton.disabled = deleted;

    editButton.addEventListener('click', function () {
      openEditModal(product);
    });

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = deleted
      ? 'btn btn-success toggle-product-btn'
      : 'btn btn-danger toggle-product-btn';

    toggleButton.textContent = deleted
      ? 'Restore'
      : 'Delete';

    toggleButton.addEventListener('click', function () {
      toggleProductDeletion(product);
    });

    actions.appendChild(editButton);
    actions.appendChild(toggleButton);

    body.appendChild(name);
    body.appendChild(description);
    body.appendChild(priceRow);
    body.appendChild(meta);
    body.appendChild(actions);

    card.appendChild(imageWrapper);
    card.appendChild(body);

    UI.productGrid.appendChild(card);
  }

  function renderProducts() {
    clearElement(UI.productGrid);

    if (!State.products.length) {
      showEmptyState(
        'No products found',
        State.search
          ? 'No products matched your search.'
          : 'No products are available in this subcategory.'
      );

      return;
    }

    hideEmptyState();

    State.products.forEach(renderProductCard);
  }
  

  /* ========================================================
     Initial event binding

     Modal and product write actions are completed in Part 2.
  ======================================================== */

  function bindBaseEvents() {
    UI.searchInput.addEventListener(
      'input',
      debounce(async function () {
        State.search = cleanText(
          UI.searchInput.value
        );

        State.page = 1;
        await loadProducts(1);
      }, CONFIG.SEARCH_DELAY_MS)
    );    

    UI.refreshBtn.addEventListener(
      'click',
      async function () {
        if (
          State.pageLoading ||
          State.productLoading ||
          State.submitLoading
        ) {
          return;
        }

        State.search = '';
        State.page = 1;

        UI.searchInput.value = '';

        await refreshPageData();
      }
    );

    if (UI.dashboardBtn) {
      UI.dashboardBtn.addEventListener(
        'click',
        redirectToDashboard
      );
    }    
  }

  /* ========================================================
     Refresh and initialization
  ======================================================== */

  async function refreshPageData() {
    if (
      State.pageLoading ||
      State.productLoading ||
      State.submitLoading
    ) {
      return;
    }

    setPageLoading(
      true,
      'Refreshing products...'
    );

    try {
      State.search = '';
      State.page = 1;

      if (UI.searchInput) {
        UI.searchInput.value = '';
      }

      await loadCategories({
        preserveSelection: true
      });
    } catch (error) {
      handleError(error, {
        redirectOnForbidden: true
      });
    } finally {
      setPageLoading(false);
    }
  }

  async function initialize() {
    if (State.initialized) {
      return;
    }

    State.initialized = true;

    try {
      assertRequiredElements();

      bindBaseEvents();
      ensureProductEventsBound();
      bindFinalEvents();

      resetProductFilters();

      setPageLoading(
        true,
        'Loading retailer products...'
      );

      await loadCategories({
        preserveSelection: false
      });
    } catch (error) {
      State.initialized = false;

      handleError(error, {
        redirectOnForbidden: true
      });
    } finally {
      setPageLoading(false);
    }
  }
  
  /* ========================================================
     Start
  ======================================================== */

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }  

  function toInputNumberFromPaise(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return '';
    }

    const rupees = number / 100;

    return Number.isInteger(rupees)
      ? String(rupees)
      : String(
          Math.round((rupees + Number.EPSILON) * 100) / 100
        );
  }

  function toSafeNumber(value) {
    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ''
    ) {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }

  function revokeSelectedFilePreviews() {
    State.selectedNewFiles.forEach(function (entry) {
      if (entry && entry.previewUrl) {
        URL.revokeObjectURL(entry.previewUrl);
      }
    });
  }

  function resetFormErrors() {
    if (!UI.productForm) {
      return;
    }

    UI.productForm
      .querySelectorAll('.invalid')
      .forEach(function (input) {
        input.classList.remove('invalid');
        input.removeAttribute('aria-invalid');
      });

    UI.productForm
      .querySelectorAll('.field-error')
      .forEach(function (element) {
        element.textContent = '';
        element.classList.remove('show');
      });
  }

  function setFieldError(input, errorElementId, message) {
    if (input) {
      input.classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
    }

    const errorElement =
      document.getElementById(errorElementId);

    if (errorElement) {
      errorElement.textContent = cleanText(message);
      errorElement.classList.add('show');
    }
  }

  function setSubmitLoading(isLoading) {
    State.submitLoading = Boolean(isLoading);

    if (UI.saveProductBtn) {
      UI.saveProductBtn.disabled = State.submitLoading;

      UI.saveProductBtn.textContent =
        State.submitLoading
          ? 'Saving...'
          : State.editingProduct
            ? 'Update Product'
            : 'Add Product';
    }

    if (UI.cancelProductBtn) {
      UI.cancelProductBtn.disabled = State.submitLoading;
    }

    if (UI.closeModalBtn) {
      UI.closeModalBtn.disabled = State.submitLoading;
    }

    if (UI.productImages) {
      UI.productImages.disabled = State.submitLoading;
    }

    if (UI.productName) {
      UI.productName.disabled = State.submitLoading;
    }

    if (UI.productDescription) {
      UI.productDescription.disabled = State.submitLoading;
    }

    if (UI.productStock) {
      UI.productStock.disabled = State.submitLoading;
    }

    if (UI.productCategory) {
      UI.productCategory.disabled = true;
    }

    if (UI.productSubcategory) {
      UI.productSubcategory.disabled = true;
    }

    [
      UI.productRevPrice,
      UI.productOfferPrice,
      UI.productPrice,
      UI.productActualPrice
    ].forEach(function (input) {
      if (input) {
        input.disabled = State.submitLoading;
      }
    });

    if (UI.refreshBtn) {
      UI.refreshBtn.disabled =
        State.submitLoading ||
        State.pageLoading ||
        State.productLoading;
    }

    if (UI.addProductBtn) {
      UI.addProductBtn.disabled =
        State.submitLoading ||
        State.pageLoading;
    }
  }

  function resetProductModal() {
    revokeSelectedFilePreviews();

    State.editingProduct = null;
    State.existingImages = [];
    State.removedImages = [];
    State.selectedNewFiles = [];

    if (UI.productForm) {
      UI.productForm.reset();
    }

    resetFormErrors();

    if (UI.productId) {
      UI.productId.value = '';
    }

    if (UI.productImages) {
      UI.productImages.value = '';
    }

    if (UI.existingImagePreview) {
      clearElement(UI.existingImagePreview);
    }

    if (UI.newImagePreview) {
      clearElement(UI.newImagePreview);
    }

    if (UI.existingImagesSection) {
      UI.existingImagesSection.classList.add('hidden');
    }

    if (UI.newImagesSection) {
      UI.newImagesSection.classList.add('hidden');
    }

    syncModalCategoryOptions();

    if (UI.productCategory) {
      UI.productCategory.value =
        State.selectedCategory || '';
    }

    if (UI.productSubcategory) {
      UI.productSubcategory.value =
        State.selectedSubcategory || '';
    }

    setSubmitLoading(false);
  }

  function openProductModal() {
    UI.productModal.classList.add('show');
    UI.productModal.classList.remove('hidden');
    UI.productModal.setAttribute('aria-hidden', 'false');

    document.body.classList.add('modal-open');

    window.requestAnimationFrame(function () {
      if (UI.productName) {
        UI.productName.focus();
      }
    });
  }

  function closeProductModal() {
    if (State.submitLoading) {
      return;
    }

    UI.productModal.classList.remove('show');
    UI.productModal.setAttribute('aria-hidden', 'true');

    document.body.classList.remove('modal-open');

    resetProductModal();
  }

  function openAddModal() {
    if (
      !State.selectedCategory ||
      !State.selectedSubcategory
    ) {
      showToast(
        'Select a category and subcategory before adding a product.',
        'warning'
      );

      return;
    }

    resetProductModal();

    if (UI.modalTitle) {
      UI.modalTitle.textContent = 'Add Product';
    }

    if (UI.productCategory) {
      UI.productCategory.value =
        State.selectedCategory;
    }

    if (UI.productSubcategory) {
      UI.productSubcategory.value =
        State.selectedSubcategory;
    }

    if (UI.productStock) {
      UI.productStock.value = '0';
    }

    setSubmitLoading(false);
    openProductModal();
  }

  /* ========================================================
     Existing-image rendering
  ======================================================== */

  function renderExistingImages() {
    if (
      !UI.existingImagesSection ||
      !UI.existingImagePreview
    ) {
      return;
    }

    clearElement(UI.existingImagePreview);

    if (!State.existingImages.length) {
      UI.existingImagesSection.classList.add('hidden');
      return;
    }

    UI.existingImagesSection.classList.remove('hidden');

    State.existingImages.forEach(function (image, index) {
      const isRemoved =
        State.removedImages.includes(image);

      const card = document.createElement('article');
      card.className =
        'image-preview-card' +
        (isRemoved ? ' is-removed' : '');

      const imageElement = document.createElement('img');
      imageElement.src = resolveImageUrl(image);
      imageElement.alt =
        'Existing product image ' + String(index + 1);
      imageElement.loading = 'lazy';
      setImageFallback(imageElement);

      const actions = document.createElement('div');
      actions.className = 'image-preview-actions';

      const button = document.createElement('button');
      button.type = 'button';

      if (isRemoved) {
        button.className = 'image-undo-btn';
        button.textContent = 'Undo';

        button.addEventListener('click', function () {
          if (State.submitLoading) {
            return;
          }

          State.removedImages =
            State.removedImages.filter(function (value) {
              return value !== image;
            });

          renderExistingImages();
        });
      } else {
        button.className = 'image-remove-btn';
        button.textContent = 'Remove';

        button.addEventListener('click', function () {
          if (State.submitLoading) {
            return;
          }

          if (!State.removedImages.includes(image)) {
            State.removedImages.push(image);
          }

          renderExistingImages();
          validateCombinedImageCount();
        });
      }

      actions.appendChild(button);
      card.appendChild(imageElement);
      card.appendChild(actions);

      UI.existingImagePreview.appendChild(card);
    });
  }

  /* ========================================================
     New-image rendering
  ======================================================== */

  function rebuildFileInputFromSelectedFiles() {
    if (
      !UI.productImages ||
      typeof DataTransfer !== 'function'
    ) {
      return;
    }

    try {
      const transfer = new DataTransfer();

      State.selectedNewFiles.forEach(function (entry) {
        if (entry && entry.file) {
          transfer.items.add(entry.file);
        }
      });

      UI.productImages.files = transfer.files;
    } catch (_) {
      /*
       * Some older browsers do not allow assigning FileList.
       * Submission still uses State.selectedNewFiles, so the
       * selected files remain safe for upload.
       */
    }
  }

  function renderNewImages() {
    if (
      !UI.newImagesSection ||
      !UI.newImagePreview
    ) {
      return;
    }

    clearElement(UI.newImagePreview);

    if (!State.selectedNewFiles.length) {
      UI.newImagesSection.classList.add('hidden');
      return;
    }

    UI.newImagesSection.classList.remove('hidden');

    State.selectedNewFiles.forEach(function (entry, index) {
      const card = document.createElement('article');
      card.className = 'image-preview-card';

      const imageElement = document.createElement('img');
      imageElement.src = entry.previewUrl;
      imageElement.alt =
        'New product image ' + String(index + 1);

      const actions = document.createElement('div');
      actions.className = 'image-preview-actions';

      const removeButton =
        document.createElement('button');

      removeButton.type = 'button';
      removeButton.className = 'image-remove-btn';
      removeButton.textContent = 'Remove';

      removeButton.addEventListener('click', function () {
        if (State.submitLoading) {
          return;
        }

        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }

        State.selectedNewFiles.splice(index, 1);

        rebuildFileInputFromSelectedFiles();
        renderNewImages();
      });

      actions.appendChild(removeButton);
      card.appendChild(imageElement);
      card.appendChild(actions);

      UI.newImagePreview.appendChild(card);
    });
  }

  function activeExistingImageCount() {
    return State.existingImages.filter(function (image) {
      return !State.removedImages.includes(image);
    }).length;
  }

  function validateCombinedImageCount() {
    const combinedCount =
      activeExistingImageCount() +
      State.selectedNewFiles.length;

    if (combinedCount > CONFIG.MAX_IMAGES) {
      showToast(
        'A product can contain a maximum of ' +
          String(CONFIG.MAX_IMAGES) +
          ' images.',
        'warning'
      );

      return false;
    }

    return true;
  }

  function isAllowedImageFile(file) {
    if (!file || typeof file !== 'object') {
      return false;
    }

    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp'
    ]);

    const mimeType = cleanText(file.type).toLowerCase();

    if (allowedMimeTypes.has(mimeType)) {
      return true;
    }

    const filename = cleanText(file.name).toLowerCase();

    return /\.(jpe?g|png|webp)$/.test(filename);
  }

  function buildFileIdentity(file) {
    return [
      cleanText(file && file.name),
      String(file && file.size),
      String(file && file.lastModified),
      cleanText(file && file.type)
    ].join('|');
  }

  function handleNewImageSelection() {
    const selectedFiles = Array.from(
      UI.productImages.files || []
    );

    if (!selectedFiles.length) {
      return;
    }

    const invalidFiles = selectedFiles.filter(function (file) {
      return !isAllowedImageFile(file);
    });

    if (invalidFiles.length) {
      showToast(
        'Only JPEG, PNG and WebP product images are allowed.',
        'warning'
      );
    }

    const validFiles = selectedFiles.filter(isAllowedImageFile);

    const currentIdentities = new Set(
      State.selectedNewFiles.map(function (entry) {
        return buildFileIdentity(entry.file);
      })
    );

    const uniqueFiles = validFiles.filter(function (file) {
      const identity = buildFileIdentity(file);

      if (currentIdentities.has(identity)) {
        return false;
      }

      currentIdentities.add(identity);
      return true;
    });

    const availableSlots = Math.max(
      0,
      CONFIG.MAX_IMAGES -
        activeExistingImageCount() -
        State.selectedNewFiles.length
    );

    const acceptedFiles =
      uniqueFiles.slice(0, availableSlots);

    if (uniqueFiles.length > acceptedFiles.length) {
      showToast(
        'Only ' +
          String(CONFIG.MAX_IMAGES) +
          ' combined images are allowed.',
        'warning'
      );
    }

    acceptedFiles.forEach(function (file) {
      State.selectedNewFiles.push({
        file,
        previewUrl: URL.createObjectURL(file)
      });
    });

    rebuildFileInputFromSelectedFiles();
    renderNewImages();
  }

  /* ========================================================
     Edit product loading
  ======================================================== */

  async function fetchProductDetail(productId) {
    const payload = await apiFetch(
      API.product(productId),
      { method: 'GET' }
    );

    const product =
      payload &&
      payload.product &&
      typeof payload.product === 'object'
        ? payload.product
        : payload;

    if (
      !product ||
      typeof product !== 'object' ||
      !getProductId(product)
    ) {
      throw new Error(
        'Product details could not be loaded.'
      );
    }

    return product;
  }

  async function openEditModal(productSummary) {
    const productId = getProductId(productSummary);

    if (!productId) {
      showToast(
        'Invalid product selected.',
        'error'
      );

      return;
    }

    if (productSummary.isDeleted === true) {
      showToast(
        'Restore this product before editing it.',
        'warning'
      );

      return;
    }

    setPageLoading(true, 'Loading product details...');

    try {
      const product =
        await fetchProductDetail(productId);

      resetProductModal();

      State.editingProduct = product;
      State.existingImages =
        getProductImages(product);

      if (UI.modalTitle) {
        UI.modalTitle.textContent = 'Edit Product';
      }

      if (UI.productId) {
        UI.productId.value = productId;
      }

      if (UI.productName) {
        UI.productName.value =
          cleanText(product.name);
      }

      if (UI.productDescription) {
        UI.productDescription.value =
          cleanText(product.description);
      }

      if (UI.productStock) {
        const stock = Number(product.stock);

        UI.productStock.value =
          Number.isFinite(stock)
            ? String(Math.max(0, stock))
            : '0';
      }

      if (UI.productCategory) {
        UI.productCategory.value =
          cleanText(
            product.category,
            State.selectedCategory
          );
      }

      if (UI.productSubcategory) {
        const productSubcategory =
          cleanText(
            product.subCategory,
            State.selectedSubcategory
          );

        const optionExists =
          Array.from(UI.productSubcategory.options)
            .some(function (option) {
              return (
                normalizeKey(option.value) ===
                normalizeKey(productSubcategory)
              );
            });

        if (!optionExists && productSubcategory) {
          const option = document.createElement('option');
          option.value = productSubcategory;
          option.textContent = productSubcategory;
          UI.productSubcategory.appendChild(option);
        }

        UI.productSubcategory.value =
          productSubcategory;
      }

      if (UI.productRevPrice) {
        UI.productRevPrice.value =
          toInputNumberFromPaise(product.priceRev);
      }

      if (UI.productOfferPrice) {
        UI.productOfferPrice.value =
          toInputNumberFromPaise(product.offerPrice);
      }

      if (UI.productPrice) {
        UI.productPrice.value =
          toInputNumberFromPaise(product.price);
      }

      if (UI.productActualPrice) {
        UI.productActualPrice.value =
          toInputNumberFromPaise(product.priceActual);
      }

      renderExistingImages();
      renderNewImages();
      setSubmitLoading(false);
      openProductModal();
    } catch (error) {
      handleError(error);
    } finally {
      setPageLoading(false);
    }
  }

  /* ========================================================
     Product-form validation
  ======================================================== */

  function validateProductForm() {
    resetFormErrors();

    const name = cleanText(
      UI.productName && UI.productName.value
    );

    const description = cleanText(
      UI.productDescription &&
        UI.productDescription.value
    );

    const stock = toSafeNumber(
      UI.productStock && UI.productStock.value
    );

    const priceRev = toSafeNumber(
      UI.productRevPrice &&
        UI.productRevPrice.value
    );

    const offerPrice = toSafeNumber(
      UI.productOfferPrice &&
        UI.productOfferPrice.value
    );

    const price = toSafeNumber(
      UI.productPrice &&
        UI.productPrice.value
    );

    const actualPrice = toSafeNumber(
      UI.productActualPrice &&
        UI.productActualPrice.value
    );

    let valid = true;

    if (!name) {
      setFieldError(
        UI.productName,
        'productNameError',
        'Product name is required.'
      );

      valid = false;
    } else if (name.length > 200) {
      setFieldError(
        UI.productName,
        'productNameError',
        'Product name must not exceed 200 characters.'
      );

      valid = false;
    }

    if (description.length > 3000) {
      setFieldError(
        UI.productDescription,
        'productDescriptionError',
        'Description must not exceed 3000 characters.'
      );

      valid = false;
    }

    if (
      stock === null ||
      stock < 0 ||
      !Number.isInteger(stock)
    ) {
      setFieldError(
        UI.productStock,
        'productStockError',
        'Stock must be a non-negative whole number.'
      );

      valid = false;
    }

    if (
      !State.editingProduct &&
      (
        !State.selectedCategory ||
        !State.selectedSubcategory
      )
    ) {
      showToast(
        'A category and subcategory must be selected.',
        'warning'
      );

      valid = false;
    }

    if (priceRev === null || priceRev < 0) {
      setFieldError(
        UI.productRevPrice,
        'productRevPriceError',
        'Rev price must be a non-negative number.'
      );

      valid = false;
    }

    if (offerPrice === null || offerPrice < 0) {
      setFieldError(
        UI.productOfferPrice,
        'productOfferPriceError',
        'Offer price must be a non-negative number.'
      );

      valid = false;
    }

    if (price === null || price < 0) {
      setFieldError(
        UI.productPrice,
        'productPriceError',
        'Display price must be a non-negative number.'
      );

      valid = false;
    }

    if (actualPrice === null || actualPrice < 0) {
      setFieldError(
        UI.productActualPrice,
        'productActualPriceError',
        'Actual price must be a non-negative number.'
      );

      valid = false;
    }

    if (
      priceRev !== null &&
      offerPrice !== null &&
      price !== null &&
      actualPrice !== null &&
      !(
        priceRev < offerPrice &&
        offerPrice < price &&
        price < actualPrice
      )
    ) {
      setFieldError(
        UI.productActualPrice,
        'productActualPriceError',
        'Pricing must satisfy: Rev Price < Offer Price < Display Price < Actual Price.'
      );

      valid = false;
    }

    if (!validateCombinedImageCount()) {
      valid = false;
    }

    const finalImageCount =
      activeExistingImageCount() +
      State.selectedNewFiles.length;

    if (finalImageCount < 1) {
      showToast(
        'At least one product image is required.',
        'warning'
      );

      valid = false;
    }

    return valid;
  }

  function buildProductPayload() {
    const isEdit = Boolean(State.editingProduct);

    const category = isEdit
      ? cleanText(
          UI.productCategory &&
            UI.productCategory.value,
          State.selectedCategory
        )
      : State.selectedCategory;

    const subCategory = isEdit
      ? cleanText(
          UI.productSubcategory &&
            UI.productSubcategory.value,
          State.selectedSubcategory
        )
      : State.selectedSubcategory;

    const payload = {
      name: cleanText(UI.productName.value),

      description: cleanText(
        UI.productDescription.value
      ),

      stock: Number(UI.productStock.value),

      category,

      subCategory,

      priceRev: Number(
        UI.productRevPrice.value
      ),

      offerPrice: Number(
        UI.productOfferPrice.value
      ),

      price: Number(
        UI.productPrice.value
      ),

      priceActual: Number(
        UI.productActualPrice.value
      ),

      availability: {
        mode: 'always',
        weekly: []
      }
    };

    if (
      isEdit &&
      State.removedImages.length
    ) {
      payload.removedImages =
        State.removedImages.slice();
    }

    return payload;
  }

  function buildProductFormData() {
    const payload = buildProductPayload();
    const formData = new FormData();

    formData.append(
      'payload',
      JSON.stringify(payload)
    );

    State.selectedNewFiles.forEach(function (entry) {
      if (entry && entry.file) {
        formData.append(
          'images',
          entry.file,
          entry.file.name
        );
      }
    });

    return formData;
  }

  /* ========================================================
     Add/update submission
  ======================================================== */

  async function submitProductForm(event) {
    event.preventDefault();

    if (
      State.submitLoading ||
      !validateProductForm()
    ) {
      return;
    }

    const isEdit =
      Boolean(State.editingProduct);

    const productId = isEdit
      ? getProductId(State.editingProduct)
      : '';

    if (isEdit && !productId) {
      showToast(
        'Product ID is missing.',
        'error'
      );

      return;
    }

    setSubmitLoading(true);

    try {
      const payload = await apiFetch(
        isEdit
          ? API.product(productId)
          : API.products,
        {
          method: isEdit ? 'PUT' : 'POST',
          body: buildProductFormData()
        }
      );

      showToast(
        cleanText(
          payload.message,
          isEdit
            ? 'Product updated successfully.'
            : 'Product added successfully.'
        ),
        'success'
      );

      UI.productModal.classList.remove('show');
      UI.productModal.setAttribute(
        'aria-hidden',
        'true'
      );

      document.body.classList.remove('modal-open');

      resetProductModal();

      await loadProducts(
        isEdit ? State.page : 1
      );
    } catch (error) {
      handleError(error);
    } finally {
      setSubmitLoading(false);
    }
  }

  /* ========================================================
     Delete and restore
  ======================================================== */

  function buildProductActionMessage(product, restoring) {
    const productName = cleanText(
      product && product.name,
      'this product'
    );

    return restoring
      ? 'Restore "' + productName + '"?'
      : 'Delete "' +
          productName +
          '"? It can be restored later.';
  }

  async function toggleProductDeletion(product) {
    if (
      State.productLoading ||
      State.submitLoading
    ) {
      return;
    }

    const productId = getProductId(product);

    if (!productId) {
      showToast(
        'Invalid product selected.',
        'error'
      );

      return;
    }

    const restoring =
      product.isDeleted === true;

    const confirmed = window.confirm(
      buildProductActionMessage(
        product,
        restoring
      )
    );

    if (!confirmed) {
      return;
    }

    setProductLoading(
      true,
      restoring
        ? 'Restoring product...'
        : 'Deleting product...'
    );

    try {
      const endpoint = restoring
        ? API.restoreProduct(productId)
        : API.product(productId);

      const response = await apiFetch(
        endpoint,
        {
          method: restoring
            ? 'PUT'
            : 'DELETE'
        }
      );

      showToast(
        cleanText(
          response.message,
          restoring
            ? 'Product restored successfully.'
            : 'Product deleted successfully.'
        ),
        'success'
      );

      await loadProducts(State.page);
    } catch (error) {
      handleError(error);
    } finally {
      setProductLoading(false);
    }
  }

  /* ========================================================
     Logout
  ======================================================== */

  async function logoutRetailer() {
    if (
      State.pageLoading ||
      State.productLoading ||
      State.submitLoading
    ) {
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to logout?'
    );

    if (!confirmed) {
      return;
    }

    setPageLoading(true, 'Logging out...');

    try {
      await apiFetch(API.logout, {
        method: 'POST'
      });
    } catch (error) {
      /*
       * Even if the logout endpoint fails because the session
       * is already invalid, redirecting to login is safe.
       */
      console.error(
        '[Retailer Products] Logout:',
        error
      );
    } finally {
      redirectToLogin();
    }
  }

  /* ========================================================
     Modal and write-action event bindings
  ======================================================== */

  function bindProductEvents() {
    UI.addProductBtn.addEventListener(
      'click',
      openAddModal
    );

    if (UI.closeModalBtn) {
      UI.closeModalBtn.addEventListener(
        'click',
        closeProductModal
      );
    }

    if (UI.cancelProductBtn) {
      UI.cancelProductBtn.addEventListener(
        'click',
        closeProductModal
      );
    }

    if (UI.productImages) {
      UI.productImages.addEventListener(
        'change',
        handleNewImageSelection
      );
    }

    UI.productForm.addEventListener(
      'submit',
      submitProductForm
    );

    UI.productModal.addEventListener(
      'click',
      function (event) {
        if (event.target === UI.productModal) {
          closeProductModal();
        }
      }
    );

    document.addEventListener(
      'keydown',
      function (event) {
        if (
          event.key === 'Escape' &&
          UI.productModal.classList.contains('show')
        ) {
          closeProductModal();
        }
      }
    );

    if (UI.logoutBtn) {
      UI.logoutBtn.addEventListener(
        'click',
        logoutRetailer
      );
    }
  }

  /*
   * bindBaseEvents() already runs during initialize().
   * This guard prevents duplicate modal bindings.
   */
  let productEventsBound = false;

  function ensureProductEventsBound() {
    if (productEventsBound) {
      return;
    }

    productEventsBound = true;
    bindProductEvents();
  }

  function syncModalCategoryOptions() {
    if (
      !UI.productCategory ||
      !UI.productSubcategory
    ) {
      return;
    }

    const selectedCategory =
      State.selectedCategory || '';

    const selectedSubcategory =
      State.selectedSubcategory || '';

    clearElement(UI.productCategory);
    clearElement(UI.productSubcategory);

    const categoryPlaceholder =
      document.createElement('option');

    categoryPlaceholder.value = '';
    categoryPlaceholder.textContent =
      'Select category';

    UI.productCategory.appendChild(
      categoryPlaceholder
    );

    State.categories.forEach(function (category) {
      const categoryKey =
        getCategoryKey(category);

      if (!categoryKey) {
        return;
      }

      const option =
        document.createElement('option');

      option.value = categoryKey;
      option.textContent =
        getCategoryName(category);

      UI.productCategory.appendChild(option);
    });

    const categoryValue =
      State.editingProduct
        ? cleanText(
            State.editingProduct.category,
            selectedCategory
          )
        : selectedCategory;

    UI.productCategory.value = categoryValue;

    const subcategoryPlaceholder =
      document.createElement('option');

    subcategoryPlaceholder.value = '';
    subcategoryPlaceholder.textContent =
      'Select subcategory';

    UI.productSubcategory.appendChild(
      subcategoryPlaceholder
    );

    State.subcategories.forEach(function (subcategory) {
      const subcategoryKey =
        getSubcategoryKey(subcategory);

      if (!subcategoryKey) {
        return;
      }

      const option =
        document.createElement('option');

      option.value = subcategoryKey;
      option.textContent =
        getSubcategoryName(subcategory);

      UI.productSubcategory.appendChild(option);
    });

    const subcategoryValue =
      State.editingProduct
        ? cleanText(
            State.editingProduct.subCategory,
            selectedSubcategory
          )
        : selectedSubcategory;

    const existingSubcategoryOption =
      Array.from(UI.productSubcategory.options)
        .some(function (option) {
          return (
            normalizeKey(option.value) ===
            normalizeKey(subcategoryValue)
          );
        });

    if (
      subcategoryValue &&
      !existingSubcategoryOption
    ) {
      const option = document.createElement('option');

      option.value = subcategoryValue;
      option.textContent = subcategoryValue;

      UI.productSubcategory.appendChild(option);
    }

    UI.productSubcategory.value =
      subcategoryValue;
  }  

  /* ========================================================
     Pagination
  ======================================================== */

  function createPaginationButton(
    label,
    page,
    options
  ) {
    const config = options || {};

    const button =
      document.createElement('button');

    button.type = 'button';
    button.className = 'pagination-btn';
    button.textContent = String(label);

    if (config.active) {
      button.classList.add('active');
      button.setAttribute(
        'aria-current',
        'page'
      );
    }

    button.disabled =
      Boolean(config.disabled) ||
      State.productLoading;

    button.addEventListener(
      'click',
      async function () {
        if (
          button.disabled ||
          State.productLoading ||
          page === State.page
        ) {
          return;
        }

        await loadProducts(page);
      }
    );

    return button;
  }

  function getPaginationRange(
    currentPage,
    totalPages
  ) {
    const safeCurrent = Math.max(
      1,
      Number(currentPage) || 1
    );

    const safeTotal = Math.max(
      1,
      Number(totalPages) || 1
    );

    const maxVisible = 5;

    let start = Math.max(
      1,
      safeCurrent - 2
    );

    let end = Math.min(
      safeTotal,
      start + maxVisible - 1
    );

    if (end - start + 1 < maxVisible) {
      start = Math.max(
        1,
        end - maxVisible + 1
      );
    }

    const pages = [];

    for (
      let page = start;
      page <= end;
      page += 1
    ) {
      pages.push(page);
    }

    return pages;
  }

  function renderPagination() {
    if (!UI.pagination) {
      return;
    }

    clearElement(UI.pagination);

    const totalPages = Math.max(
      1,
      Number(State.pages) || 1
    );

    const currentPage = Math.min(
      totalPages,
      Math.max(
        1,
        Number(State.page) || 1
      )
    );

    if (totalPages <= 1) {
      UI.pagination.classList.add('hidden');
      return;
    }

    UI.pagination.classList.remove('hidden');

    UI.pagination.appendChild(
      createPaginationButton(
        'Previous',
        currentPage - 1,
        {
          disabled: currentPage <= 1
        }
      )
    );

    const range = getPaginationRange(
      currentPage,
      totalPages
    );

    if (range[0] > 1) {
      UI.pagination.appendChild(
        createPaginationButton(
          '1',
          1,
          {
            active: currentPage === 1
          }
        )
      );

      if (range[0] > 2) {
        const separator =
          document.createElement('span');

        separator.className =
          'pagination-separator';

        separator.textContent = '…';
        separator.setAttribute(
          'aria-hidden',
          'true'
        );

        UI.pagination.appendChild(separator);
      }
    }

    range.forEach(function (page) {
      UI.pagination.appendChild(
        createPaginationButton(
          String(page),
          page,
          {
            active: page === currentPage
          }
        )
      );
    });

    if (
      range[range.length - 1] <
      totalPages
    ) {
      if (
        range[range.length - 1] <
        totalPages - 1
      ) {
        const separator =
          document.createElement('span');

        separator.className =
          'pagination-separator';

        separator.textContent = '…';
        separator.setAttribute(
          'aria-hidden',
          'true'
        );

        UI.pagination.appendChild(separator);
      }

      UI.pagination.appendChild(
        createPaginationButton(
          String(totalPages),
          totalPages,
          {
            active:
              currentPage === totalPages
          }
        )
      );
    }

    UI.pagination.appendChild(
      createPaginationButton(
        'Next',
        currentPage + 1,
        {
          disabled:
            currentPage >= totalPages
        }
      )
    );
  }
  
  /* ========================================================
     Product-card action delegation
  ======================================================== */

  function findProductById(productId) {
    const normalizedId =
      cleanText(productId);

    if (!normalizedId) {
      return null;
    }

    return State.products.find(
      function (product) {
        return (
          getProductId(product) ===
          normalizedId
        );
      }
    ) || null;
  }  

  /* ========================================================
     Search and filters
  ======================================================== */

  function resetProductFilters() {
    State.search = '';
    State.page = 1;

    if (UI.searchInput) {
      UI.searchInput.value = '';
    }
  }  

  /* ========================================================
     Input cleanup
  ======================================================== */

  function bindNumericInputSafety() {
    const numericInputs = [
      UI.productStock,
      UI.productRevPrice,
      UI.productOfferPrice,
      UI.productPrice,
      UI.productActualPrice
    ].filter(Boolean);

    numericInputs.forEach(function (input) {
      input.addEventListener(
        'keydown',
        function (event) {
          if (
            event.key === 'e' ||
            event.key === 'E' ||
            event.key === '+' ||
            event.key === '-'
          ) {
            event.preventDefault();
          }
        }
      );

      input.addEventListener(
        'input',
        function () {
          input.classList.remove('invalid');
          input.removeAttribute(
            'aria-invalid'
          );
        }
      );
    });

    if (UI.productName) {
      UI.productName.addEventListener(
        'input',
        function () {
          UI.productName.classList.remove(
            'invalid'
          );

          UI.productName.removeAttribute(
            'aria-invalid'
          );
        }
      );
    }

    if (UI.productDescription) {
      UI.productDescription.addEventListener(
        'input',
        function () {
          UI.productDescription
            .classList.remove('invalid');

          UI.productDescription
            .removeAttribute(
              'aria-invalid'
            );
        }
      );
    }
  }

  /* ========================================================
     Page lifecycle
  ======================================================== */

  function handlePageVisibility() {
        if (document.visibilityState !== 'visible') {
            return;
        }

        if (
            State.pageLoading ||
            State.productLoading ||
            State.submitLoading
        ) {
            return;
        }

        loadRetailerStatus()
            .catch(function (error) {
                console.error(
                    '[Retailer Products] Status refresh:',
                    error
                );
            });
    }

  function handleBeforeUnload() {
    revokeSelectedFilePreviews();
  }
  
  /* ========================================================
     Final event initialization
  ======================================================== */

  let finalEventsBound = false;

  function bindFinalEvents() {
    if (finalEventsBound) {
      return;
    }

    finalEventsBound = true;

    bindNumericInputSafety();

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    );
  }

  /* ========================================================
     Global Error Logging
  ======================================================== */

  window.addEventListener(
    'error',
    function (event) {
      console.error(
        '[Retailer Products] Unhandled error:',
        event.error || event.message
      );
    }
  );

  window.addEventListener(
    'unhandledrejection',
    function (event) {
      console.error(
        '[Retailer Products] Unhandled promise rejection:',
        event.reason
      );

      if (UI.toastContainer) {
        showToast(
          cleanText(
            event.reason &&
              event.reason.message,
            'An unexpected request error occurred.'
          ),
          'error'
        );
      }
    }
  );

})();