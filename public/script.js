// Глобальные переменные
window.currentUser = null;

// Функция навигации
window.navigateTo = function(url) {
    window.location.href = url;
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализация...');
    
    // Скрываем лоадер через 500мс
    setTimeout(function() {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(function() {
                loader.style.display = 'none';
                const app = document.getElementById('app');
                if (app) {
                    app.style.display = 'block';
                    console.log('Приложение отображено');
                }
            }, 300);
        }
    }, 500);
    
    // Проверяем сессию после загрузки
    setTimeout(function() {
        window.checkSession();
    }, 600);
});

// Проверка сессии
window.checkSession = async function() {
    console.log('Проверка сессии...');
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (data.success) {
            console.log('Пользователь авторизован:', data.user);
            window.currentUser = data.user;
            window.showWelcomePanel();
        } else {
            console.log('Пользователь не авторизован');
            window.showAuthPanel();
        }
    } catch (error) {
        console.error('Session check error:', error);
        window.showAuthPanel();
    }
};

// Показать панель авторизации
window.showAuthPanel = function() {
    const authPanel = document.getElementById('authPanel');
    const welcomePanel = document.getElementById('welcomePanel');
    
    if (authPanel) authPanel.style.display = 'block';
    if (welcomePanel) welcomePanel.style.display = 'none';
    
    // Показываем только главную ссылку в меню
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === '/' || href === '/index.html') {
            link.style.display = 'inline-block';
        } else {
            link.style.display = 'none';
        }
    });
};

// Показать панель приветствия
window.showWelcomePanel = async function() {
    const authPanel = document.getElementById('authPanel');
    const welcomePanel = document.getElementById('welcomePanel');
    
    if (authPanel) authPanel.style.display = 'none';
    if (welcomePanel) welcomePanel.style.display = 'block';
    
    // Загружаем баланс
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        if (data.success) {
            const welcomeBalance = document.getElementById('welcomeBalance');
            if (welcomeBalance) welcomeBalance.textContent = data.user.balance.toFixed(2);
            
            const welcomeName = document.getElementById('welcomeName');
            if (welcomeName) welcomeName.textContent = data.user.full_name.split(' ')[0];
        }
    } catch (error) {
        console.error('Error loading balance:', error);
    }
    
    // Показываем все ссылки навигации
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href !== '/' && href !== '/index.html') {
            link.style.display = 'inline-block';
        }
    });
    
    // Показываем админ ссылку если нужно
    if (window.currentUser && window.currentUser.is_admin) {
        const adminLink = document.querySelector('.nav-link[href="/admin.html"]');
        if (adminLink) adminLink.style.display = 'inline-block';
    }
};

// Регистрация
window.register = async function() {
    console.log('Регистрация начата');
    
    // Получаем данные
    const username = document.getElementById('regUsername')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const full_name = document.getElementById('regFullName')?.value.trim();
    const passport_series = document.getElementById('regPassportSeries')?.value.trim();
    const passport_number = document.getElementById('regPassportNumber')?.value.trim();
    const date_of_birth = document.getElementById('regDateOfBirth')?.value;
    const email = document.getElementById('regEmail')?.value.trim();
    const agreeTerms = document.getElementById('agreeTerms')?.checked;
    
    // Проверка согласия
    if (!agreeTerms) {
        window.showAlert('Необходимо принять условия пользовательского соглашения');
        return;
    }
    
    // Проверка заполнения
    if (!username || !password || !full_name || !passport_series || 
        !passport_number || !date_of_birth || !email) {
        window.showAlert('Заполните все поля');
        return;
    }
    
    // Валидация
    if (username.length < 3) {
        window.showAlert('Имя пользователя должно быть минимум 3 символа');
        return;
    }
    
    if (password.length < 6) {
        window.showAlert('Пароль должен быть минимум 6 символов');
        return;
    }
    
    if (passport_series.length !== 4 || passport_number.length !== 8) {
        window.showAlert('Неверный формат паспорта');
        return;
    }
    
    // Проверка email на кириллицу
    if (/[а-яА-ЯЁё]/.test(email)) {
        window.showAlert('Email не должен содержать кириллицу');
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username, password, full_name, passport_series, passport_number,
                date_of_birth, place_of_birth: 'Столица', email
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            window.showAlert('Регистрация успешна! Теперь войдите в систему.', 'success');
            
            // Очищаем форму
            document.getElementById('regUsername').value = '';
            document.getElementById('regPassword').value = '';
            document.getElementById('regFullName').value = '';
            document.getElementById('regPassportSeries').value = '';
            document.getElementById('regPassportNumber').value = '';
            document.getElementById('regDateOfBirth').value = '';
            document.getElementById('regEmail').value = '';
            document.getElementById('agreeTerms').checked = false;
            
            // Заполняем логин в форме входа
            document.getElementById('loginUsername').value = username;
            document.getElementById('loginPassword').value = '';
            
            // Переключаем на форму входа
            window.switchAuthTab('login');
        } else {
            window.showAlert(result.message || 'Ошибка регистрации');
        }
    } catch (error) {
        console.error('Registration error:', error);
        window.showAlert('Ошибка соединения с сервером');
    }
};

// Вход
window.login = async function() {
    console.log('Вход начат');
    
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    
    if (!username || !password) {
        window.showAlert('Введите имя пользователя и пароль');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.currentUser = data.user;
            window.showAlert('Вход выполнен успешно!', 'success');
            window.showWelcomePanel();
        } else {
            window.showAlert(data.message || 'Неверный логин или пароль');
        }
    } catch (error) {
        console.error('Login error:', error);
        window.showAlert('Ошибка соединения с сервером');
    }
};

// Выход
window.logout = async function() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.currentUser = null;
        window.showAuthPanel();
        window.showAlert('Вы вышли из системы', 'success');
    } catch (error) {
        window.showAlert('Ошибка выхода');
    }
};

// Переключение между вкладками
window.switchAuthTab = function(tab) {
    const loginContainer = document.getElementById('loginFormContainer');
    const registerContainer = document.getElementById('registerFormContainer');
    const tabs = document.querySelectorAll('.auth-tab-btn');
    
    if (tab === 'login') {
        if (loginContainer) loginContainer.classList.add('active');
        if (registerContainer) registerContainer.classList.remove('active');
        if (tabs[0]) tabs[0].classList.add('active');
        if (tabs[1]) tabs[1].classList.remove('active');
    } else {
        if (loginContainer) loginContainer.classList.remove('active');
        if (registerContainer) registerContainer.classList.add('active');
        if (tabs[0]) tabs[0].classList.remove('active');
        if (tabs[1]) tabs[1].classList.add('active');
    }
};

// Показать/скрыть пароль
window.togglePassword = function(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
};

// Открыть поддержку
window.openSupport = function() {
    window.location.href = 'mailto:republiccommfinance@gmail.com?subject=Запрос в техническую поддержку';
};

// Открыть FAQ
window.openFAQ = function() {
    window.showAlert('Для получения справки обратитесь в службу поддержки', 'info');
};

// Показать уведомление
window.showAlert = function(message, type = 'error') {
    const alertDiv = document.getElementById('alertMessage');
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert ${type}`;
        alertDiv.style.display = 'block';
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 3000);
    }
};
