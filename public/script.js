// Глобальные переменные
let currentUser = null;
let pendingTransactionId = null;

// Проверка авторизации и загрузка меню
async function checkAuth() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            showUserMenu();
            loadPageData();
        } else {
            showGuestMenu();
        }
    } catch (error) {
        console.error('Auth error:', error);
        showGuestMenu();
    }
}

// Показать меню для авторизованного пользователя
function showUserMenu() {
    const navLinks = document.getElementById('navLinks');
    if (!navLinks) return;
    
    const pages = [
        { name: 'Главная', url: '/' },
        { name: 'Профиль', url: '/profile.html' },
        { name: 'Карты', url: '/cards.html' },
        { name: 'Переводы', url: '/transfers.html' },
        { name: 'Кредиты', url: '/loans.html' },
        { name: 'История', url: '/history.html' }
    ];
    
    if (currentUser.is_admin) {
        pages.push({ name: 'Администрирование', url: '/admin.html' });
    }
    
    navLinks.innerHTML = pages.map(page => 
        `<a href="${page.url}" class="nav-link ${page.url === window.location.pathname ? 'active' : ''}">${page.name}</a>`
    ).join('');
    
    // На главной странице показываем приветствие
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        const authPanel = document.getElementById('authPanel');
        const welcomePanel = document.getElementById('welcomePanel');
        if (authPanel) authPanel.style.display = 'none';
        if (welcomePanel) {
            welcomePanel.style.display = 'block';
            document.getElementById('welcomeName').textContent = currentUser.full_name.split(' ')[0];
            loadUserBalance();
        }
    }
}

// Показать меню для гостя
function showGuestMenu() {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.innerHTML = '<a href="/" class="nav-link active">Главная</a>';
    }
}

// Загрузка данных страницы
function loadPageData() {
    const path = window.location.pathname;
    
    if (path === '/profile.html') {
        loadProfileData();
    } else if (path === '/cards.html') {
        loadCardsData();
    } else if (path === '/transfers.html') {
        loadTransfersData();
    } else if (path === '/loans.html') {
        loadLoansData();
    } else if (path === '/history.html') {
        loadFullHistory();
    } else if (path === '/admin.html') {
        if (currentUser?.is_admin) {
            loadAdminData();
        } else {
            window.location.href = '/';
        }
    }
}

// Загрузка баланса
async function loadUserBalance() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        if (data.success) {
            const balanceSpan = document.getElementById('welcomeBalance');
            if (balanceSpan) balanceSpan.textContent = data.user.balance.toFixed(2);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Загрузка профиля
async function loadProfileData() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('userId').textContent = data.user.id;
            document.getElementById('fullName').textContent = data.user.full_name;
            document.getElementById('passport').textContent = `${data.user.passport_series}-${data.user.passport_number}`;
            document.getElementById('birthDate').textContent = new Date(data.user.date_of_birth).toLocaleDateString('ru-RU');
            document.getElementById('email').textContent = data.user.email;
            document.getElementById('createdAt').textContent = new Date(data.user.created_at).toLocaleDateString('ru-RU');
        }
    } catch (error) {
        showAlert('Ошибка загрузки профиля');
    }
}

// Загрузка карт
async function loadCardsData() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        const cardsList = document.getElementById('cardsList');
        if (!data.cards || data.cards.length === 0) {
            cardsList.innerHTML = '<div class="card-item">У вас нет карт</div>';
        } else {
            cardsList.innerHTML = data.cards.map(card => `
                <div class="card-item ${card.is_blocked ? 'blocked' : ''}" onclick="showCardDetails(${card.id})">
                    <div class="card-number">${card.card_number}</div>
                    <div class="card-details">
                        <span>${card.card_holder}</span>
                        <span>${card.expiry_date}</span>
                    </div>
                    <div class="card-status">${card.is_blocked ? 'ЗАБЛОКИРОВАНА' : 'АКТИВНА'}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        showAlert('Ошибка загрузки карт');
    }
}

// Показать детали карты
window.showCardDetails = async function(cardId) {
    try {
        const response = await fetch(`/api/card/${cardId}`);
        const data = await response.json();
        
        if (data.success) {
            const modalContent = document.getElementById('cardModalContent');
            modalContent.innerHTML = `
                <h3>Детали карты</h3>
                <div class="info-item"><span class="info-label">Номер</span><span>${data.card.card_number}</span></div>
                <div class="info-item"><span class="info-label">Держатель</span><span>${data.card.card_holder}</span></div>
                <div class="info-item"><span class="info-label">Срок</span><span>${data.card.expiry_date}</span></div>
                <div class="info-item"><span class="info-label">CVV</span><span>${data.card.cvv}</span></div>
                <div class="info-item"><span class="info-label">Статус</span><span>${data.card.is_blocked ? 'Заблокирована' : 'Активна'}</span></div>
                <button class="btn ${data.card.is_blocked ? 'btn-primary' : 'btn-danger'}" 
                        onclick="toggleCardBlock(${cardId}, ${!data.card.is_blocked})">
                    ${data.card.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                </button>
            `;
            document.getElementById('cardModal').style.display = 'flex';
        }
    } catch (error) {
        showAlert('Ошибка');
    }
};

// Блокировка карты
window.toggleCardBlock = async function(cardId, block) {
    try {
        const response = await fetch('/api/toggle-card-block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_id: cardId, action: block ? 'block' : 'unblock' })
        });
        const data = await response.json();
        if (data.success) {
            showAlert(data.message, 'success');
            closeModal();
            loadCardsData();
        }
    } catch (error) {
        showAlert('Ошибка');
    }
};

// Создать карту
async function createCard() {
    try {
        const response = await fetch('/api/create-card', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showAlert('Карта создана', 'success');
            loadCardsData();
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка');
    }
}

// Загрузка переводов
async function loadTransfersData() {
    try {
        const userRes = await fetch('/api/user');
        const userData = await userRes.json();
        if (userData.success) {
            document.getElementById('transferBalance').textContent = userData.user.balance.toFixed(2);
        }
        
        const recipientsRes = await fetch('/api/recipients');
        const recipients = await recipientsRes.json();
        const select = document.getElementById('recipientSelect');
        if (select) {
            select.innerHTML = '<option value="">Выберите получателя</option>' + 
                recipients.map(r => `<option value="${r.id}">${r.full_name}</option>`).join('');
        }
        
        await loadRecentTransactions();
    } catch (error) {
        showAlert('Ошибка');
    }
}

// Загрузка последних транзакций
async function loadRecentTransactions() {
    try {
        const response = await fetch('/api/transactions?limit=10');
        const transactions = await response.json();
        const container = document.getElementById('recentTransactionsList');
        if (container) {
            container.innerHTML = transactions.map(t => {
                const isIncome = t.to_user_id === currentUser?.id;
                return `
                    <div class="transaction-item">
                        <div>${isIncome ? 'От' : 'Кому'} ${isIncome ? t.from_name : t.to_name}</div>
                        <div class="${isIncome ? 'transaction-income' : 'transaction-outcome'}">${isIncome ? '+' : '-'} ${t.amount}</div>
                        <small>${new Date(t.created_at).toLocaleString()}</small>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Выполнить перевод
async function makeTransfer() {
    const to_id = document.getElementById('recipientSelect').value;
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const desc = document.getElementById('transferDescription').value;
    
    if (!to_id || !amount) {
        showAlert('Заполните поля');
        return;
    }
    
    try {
        const response = await fetch('/api/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_user_id: parseInt(to_id), amount, description: desc })
        });
        const data = await response.json();
        if (data.success) {
            showAlert('Перевод выполнен', 'success');
            loadTransfersData();
            document.getElementById('transferAmount').value = '';
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка');
    }
}

// Загрузка кредитов
async function loadLoansData() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        const loanInfo = document.getElementById('activeLoanInfo');
        if (data.activeLoan) {
            loanInfo.innerHTML = `<div class="loan-status">Долг: ${data.activeLoan.debt_amount} кредитов</div>`;
        } else {
            loanInfo.innerHTML = '<div class="loan-status">Нет активных кредитов</div>';
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Подать заявку на кредит
async function submitLoan() {
    const amount = parseFloat(document.getElementById('loanAmount').value);
    const purpose = document.getElementById('loanPurpose').value;
    
    if (!amount || amount < 1 || amount > 10000) {
        showAlert('Сумма от 1 до 10000');
        return;
    }
    
    try {
        const response = await fetch('/api/loan-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, purpose })
        });
        const data = await response.json();
        if (data.success) {
            showAlert('Заявка отправлена', 'success');
            document.getElementById('loanAmount').value = '';
            document.getElementById('loanPurpose').value = '';
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка');
    }
}

// Загрузка полной истории
async function loadFullHistory() {
    try {
        const response = await fetch('/api/transactions?limit=100');
        const transactions = await response.json();
        const container = document.getElementById('fullTransactionsList');
        container.innerHTML = transactions.map(t => {
            const isIncome = t.to_user_id === currentUser?.id;
            return `
                <div class="transaction-item">
                    <div><strong>${isIncome ? 'Получено' : 'Отправлено'}</strong> ${isIncome ? t.from_name : t.to_name}</div>
                    <div>Сумма: ${t.amount} кредитов</div>
                    <div>Дата: ${new Date(t.created_at).toLocaleString()}</div>
                    ${t.description ? `<div>${t.description}</div>` : ''}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Загрузка админ данных
async function loadAdminData() {
    if (!currentUser?.is_admin) return;
    
    try {
        const loansRes = await fetch('/api/admin/loan-applications');
        const loans = await loansRes.json();
        document.getElementById('loanApplicationsList').innerHTML = loans.map(app => `
            <div class="admin-item">
                <div>${app.full_name} - ${app.amount} кредитов</div>
                <div>${app.purpose || 'Без цели'}</div>
                <button class="btn small" onclick="approveLoan(${app.id})">Одобрить</button>
                <button class="btn small" onclick="rejectLoan(${app.id})">Отклонить</button>
            </div>
        `).join('');
        
        const usersRes = await fetch('/api/admin/users');
        const users = await usersRes.json();
        document.getElementById('usersList').innerHTML = users.map(u => `
            <div class="admin-item">
                <div>${u.full_name} (${u.username}) - ${u.balance} кредитов</div>
                <button class="btn small" onclick="toggleUserFreeze(${u.id}, ${!u.is_frozen})">
                    ${u.is_frozen ? 'Разморозить' : 'Заморозить'}
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Админ функции
window.approveLoan = async (id) => {
    const res = await fetch('/api/admin/approve-loan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: id })
    });
    const data = await res.json();
    if (data.success) {
        showAlert('Одобрено', 'success');
        loadAdminData();
    }
};

window.rejectLoan = async (id) => {
    const comment = prompt('Причина отказа:');
    if (!comment) return;
    const res = await fetch('/api/admin/reject-loan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: id, comment })
    });
    const data = await res.json();
    if (data.success) {
        showAlert('Отклонено', 'success');
        loadAdminData();
    }
};

window.toggleUserFreeze = async (userId, freeze) => {
    const res = await fetch('/api/admin/toggle-user-freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action: freeze ? 'freeze' : 'unfreeze' })
    });
    const data = await res.json();
    if (data.success) {
        showAlert(data.message, 'success');
        loadAdminData();
    }
};

// Регистрация
async function register() {
    const data = {
        username: document.getElementById('regUsername').value.trim(),
        password: document.getElementById('regPassword').value,
        full_name: document.getElementById('regFullName').value.trim(),
        passport_series: document.getElementById('regPassportSeries').value.trim(),
        passport_number: document.getElementById('regPassportNumber').value.trim(),
        date_of_birth: document.getElementById('regDateOfBirth').value,
        place_of_birth: 'Столица',
        email: document.getElementById('regEmail').value.trim()
    };
    
    if (!data.username || !data.password || !data.full_name || !data.passport_series || 
        !data.passport_number || !data.date_of_birth || !data.email) {
        showAlert('Заполните все поля');
        return;
    }
    
    if (data.username.length < 3) {
        showAlert('Логин минимум 3 символа');
        return;
    }
    if (data.password.length < 6) {
        showAlert('Пароль минимум 6 символов');
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            showAlert('Регистрация успешна! Войдите.', 'success');
            document.getElementById('loginUsername').value = data.username;
            document.getElementById('loginPassword').value = '';
            switchToLogin();
        } else {
            showAlert(result.message);
        }
    } catch (error) {
        showAlert('Ошибка');
    }
}

// Вход
async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showAlert('Введите логин и пароль');
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
            window.location.href = '/';
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка');
    }
}

// Выход
async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
}

// Вспомогательные функции
function showAlert(message, type = 'error') {
    const alertDiv = document.getElementById('alertMessage');
    alertDiv.textContent = message;
    alertDiv.className = `alert ${type}`;
    alertDiv.style.display = 'block';
    setTimeout(() => alertDiv.style.display = 'none', 3000);
}

function switchToLogin() {
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('loginTabBtn').classList.add('active');
    document.getElementById('registerTabBtn').classList.remove('active');
}

function switchToRegister() {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.add('active');
    document.getElementById('loginTabBtn').classList.remove('active');
    document.getElementById('registerTabBtn').classList.add('active');
}

function closeModal() {
    document.getElementById('cardModal').style.display = 'none';
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
    }, 500);
    
    await checkAuth();
    
    // Кнопки на главной
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const loginTab = document.getElementById('loginTabBtn');
    const registerTab = document.getElementById('registerTabBtn');
    const supportBtn = document.getElementById('supportBtn');
    const faqBtn = document.getElementById('faqBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const createCardBtn = document.getElementById('createCardBtn');
    const makeTransferBtn = document.getElementById('makeTransferBtn');
    const submitLoanBtn = document.getElementById('submitLoanBtn');
    const repayLoanBtn = document.getElementById('repayLoanBtn');
    const adminAddMoneyBtn = document.getElementById('adminAddMoneyBtn');
    const submitCancellationBtn = document.getElementById('submitCancellationBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const closeCancellationBtn = document.getElementById('closeCancellationBtn');
    
    if (loginBtn) loginBtn.onclick = login;
    if (registerBtn) registerBtn.onclick = register;
    if (loginTab) loginTab.onclick = switchToLogin;
    if (registerTab) registerTab.onclick = switchToRegister;
    if (supportBtn) supportBtn.onclick = () => window.location.href = 'mailto:republiccommfinance@gmail.com';
    if (faqBtn) faqBtn.onclick = () => showAlert('Обратитесь в поддержку', 'info');
    if (logoutBtn) logoutBtn.onclick = logout;
    if (createCardBtn) createCardBtn.onclick = createCard;
    if (makeTransferBtn) makeTransferBtn.onclick = makeTransfer;
    if (submitLoanBtn) submitLoanBtn.onclick = submitLoan;
    if (repayLoanBtn) repayLoanBtn.onclick = async () => {
        const res = await fetch('/api/repay-loan', { method: 'POST' });
        const data = await res.json();
        showAlert(data.message, data.success ? 'success' : 'error');
        if (data.success) loadLoansData();
    };
    if (adminAddMoneyBtn) adminAddMoneyBtn.onclick = async () => {
        const userId = document.getElementById('adminUserId').value;
        const amount = parseFloat(document.getElementById('adminAmount').value);
        const res = await fetch('/api/admin/add-money', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: parseInt(userId), amount })
        });
        const data = await res.json();
        showAlert(data.message, data.success ? 'success' : 'error');
        if (data.success) loadAdminData();
    };
    if (closeModalBtn) closeModalBtn.onclick = closeModal;
    if (closeCancellationBtn) closeCancellationBtn.onclick = () => document.getElementById('cancellationModal').style.display = 'none';
    
    // Кнопки на welcome панели
    const welcomeTransfer = document.getElementById('welcomeTransferBtn');
    const welcomeCards = document.getElementById('welcomeCardsBtn');
    const welcomeProfile = document.getElementById('welcomeProfileBtn');
    if (welcomeTransfer) welcomeTransfer.onclick = () => window.location.href = '/transfers.html';
    if (welcomeCards) welcomeCards.onclick = () => window.location.href = '/cards.html';
    if (welcomeProfile) welcomeProfile.onclick = () => window.location.href = '/profile.html';
});
