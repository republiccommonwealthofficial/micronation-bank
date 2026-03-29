// Глобальные переменные
window.currentUser = null;
window.pendingTransactionId = null;

// Функция навигации
window.navigateTo = function(url) {
    window.location.href = url;
};

// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM загружен');
    
    // Адаптация логотипа
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.style.maxWidth = '200px';
        logo.style.height = 'auto';
        logo.style.width = 'auto';
    }
    
    await window.checkSession();
    
    // Обработка кликов по навигации
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href && href !== '#') {
                window.location.href = href;
            }
        });
    });
});

// Проверка сессии
window.checkSession = async function() {
    try {
        console.log('Проверка сессии...');
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (data.success) {
            console.log('Пользователь авторизован:', data.user);
            window.currentUser = data.user;
            window.updateUIForLoggedInUser();
            
            // Если мы на главной, загружаем данные
            if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                window.loadUserBalance();
            } else {
                window.loadPageData();
            }
        } else {
            console.log('Пользователь не авторизован');
            // Если не авторизован и не на главной - перенаправляем на главную
            if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                window.location.href = '/';
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
};

// Обновление UI для авторизованного пользователя
window.updateUIForLoggedInUser = function() {
    console.log('Обновление UI для авторизованного пользователя');
    
    // Скрываем форму авторизации на главной
    const authPanel = document.getElementById('authPanel');
    const welcomePanel = document.getElementById('welcomePanel');
    
    if (authPanel) {
        authPanel.style.display = 'none';
        console.log('Форма авторизации скрыта');
    }
    if (welcomePanel) {
        welcomePanel.style.display = 'block';
        const welcomeNameSpan = document.getElementById('welcomeName');
        if (welcomeNameSpan && window.currentUser) {
            welcomeNameSpan.textContent = window.currentUser.full_name.split(' ')[0];
        }
        window.loadUserBalance();
        console.log('Панель приветствия показана');
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
        console.log('Админ панель показана');
    }
};

// Загрузка баланса для приветствия
window.loadUserBalance = async function() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        if (data.success) {
            const welcomeBalance = document.getElementById('welcomeBalance');
            if (welcomeBalance) {
                welcomeBalance.textContent = data.user.balance.toFixed(2);
            }
            console.log('Баланс загружен:', data.user.balance);
        }
    } catch (error) {
        console.error('Error loading balance:', error);
    }
};

// Загрузка данных страницы
window.loadPageData = async function() {
    const path = window.location.pathname;
    console.log('Загрузка данных для страницы:', path);
    
    if (path === '/profile.html') {
        await window.loadProfileData();
    } else if (path === '/cards.html') {
        await window.loadCardsData();
    } else if (path === '/transfers.html') {
        await window.loadTransfersData();
    } else if (path === '/history.html') {
        await window.loadFullHistory();
    } else if (path === '/loans.html') {
        await window.loadLoansData();
    } else if (path === '/admin.html') {
        if (window.currentUser?.is_admin) {
            await window.loadAdminData();
        } else {
            window.location.href = '/';
        }
    }
};

// Загрузка данных профиля
window.loadProfileData = async function() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (data.success) {
            const userIdSpan = document.getElementById('userId');
            if (userIdSpan) userIdSpan.textContent = data.user.id;
            
            const fullNameSpan = document.getElementById('fullName');
            if (fullNameSpan) fullNameSpan.textContent = data.user.full_name;
            
            const passportSpan = document.getElementById('passport');
            if (passportSpan) passportSpan.textContent = `${data.user.passport_series}-${data.user.passport_number}`;
            
            const birthDateSpan = document.getElementById('birthDate');
            if (birthDateSpan) birthDateSpan.textContent = new Date(data.user.date_of_birth).toLocaleDateString('ru-RU');
            
            const birthPlaceSpan = document.getElementById('birthPlace');
            if (birthPlaceSpan) birthPlaceSpan.textContent = data.user.place_of_birth;
            
            const emailSpan = document.getElementById('email');
            if (emailSpan) emailSpan.textContent = data.user.email;
            
            const createdAtSpan = document.getElementById('createdAt');
            if (createdAtSpan) createdAtSpan.textContent = new Date(data.user.created_at).toLocaleDateString('ru-RU');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
};

// Загрузка данных кредитов
window.loadLoansData = async function() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (data.success) {
            const loanInfoDiv = document.getElementById('activeLoanInfo');
            if (loanInfoDiv) {
                if (data.activeLoan && data.activeLoan.is_active === 1) {
                    loanInfoDiv.innerHTML = `
                        <div class="loan-status">
                            <strong>Активный кредит</strong><br>
                            Сумма долга: ${data.activeLoan.debt_amount.toFixed(2)} кредитов<br>
                            Ежемесячный платеж: ${data.activeLoan.monthly_payment?.toFixed(2) || '0.00'}<br>
                            Дата выдачи: ${new Date(data.activeLoan.created_at).toLocaleDateString('ru-RU')}
                        </div>
                    `;
                } else {
                    loanInfoDiv.innerHTML = '<div class="loan-status">Нет активных кредитов</div>';
                }
            }
        }
    } catch (error) {
        console.error('Error loading loans:', error);
    }
};

// Загрузка данных карт
window.loadCardsData = async function() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        const cardsGrid = document.getElementById('cardsGrid');
        if (!cardsGrid) return;
        
        if (!data.cards || data.cards.length === 0) {
            cardsGrid.innerHTML = '<div class="card-item">У вас нет активных карт. Выпустите новую карту.</div>';
        } else {
            cardsGrid.innerHTML = data.cards.map(card => `
                <div class="card-item ${card.is_blocked ? 'blocked' : ''}" onclick="window.showCardDetails(${card.id})">
                    <div class="card-number">${card.card_number}</div>
                    <div class="card-details">
                        <span>${card.card_holder}</span>
                        <span>${card.expiry_date}</span>
                    </div>
                    <div class="card-status">
                        <span class="${card.is_blocked ? 'status-blocked' : 'status-active'}">
                            ${card.is_blocked ? 'ЗАБЛОКИРОВАНА' : 'АКТИВНА'}
                        </span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading cards:', error);
    }
};

// Показать детали карты в модальном окне
window.showCardDetails = async function(cardId) {
    try {
        const response = await fetch(`/api/card/${cardId}`);
        const data = await response.json();
        
        if (data.success) {
            const modalContent = document.getElementById('cardModalContent');
            if (modalContent) {
                modalContent.innerHTML = `
                    <h3>Детали карты</h3>
                    <div class="info-item">
                        <span class="info-label">Номер карты</span>
                        <span class="info-value">${data.card.card_number}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Держатель</span>
                        <span class="info-value">${data.card.card_holder}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Срок действия</span>
                        <span class="info-value">${data.card.expiry_date}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">CVV</span>
                        <span class="info-value">${data.card.cvv}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Статус</span>
                        <span class="info-value ${data.card.is_blocked ? 'status-blocked' : 'status-active'}">
                            ${data.card.is_blocked ? 'Заблокирована' : 'Активна'}
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Дата выпуска</span>
                        <span class="info-value">${new Date(data.card.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div class="actions" style="margin-top: 20px;">
                        <button class="btn ${data.card.is_blocked ? 'btn-primary' : 'btn-danger'}" 
                                onclick="window.toggleCardBlock(${cardId}, ${!data.card.is_blocked})">
                            ${data.card.is_blocked ? 'Разблокировать карту' : 'Заблокировать карту'}
                        </button>
                    </div>
                `;
                document.getElementById('cardModal').style.display = 'flex';
            }
        }
    } catch (error) {
        console.error('Error loading card details:', error);
        window.showAlert('Ошибка при загрузке данных карты');
    }
};

// Блокировка/разблокировка карты
window.toggleCardBlock = async function(cardId, block) {
    const action = block ? 'block' : 'unblock';
    try {
        const response = await fetch('/api/toggle-card-block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_id: cardId, action })
        });
        
        const data = await response.json();
        if (data.success) {
            window.showAlert(data.message, 'success');
            window.closeCardModal();
            window.loadCardsData();
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при изменении статуса карты');
    }
};

// Загрузка данных переводов
window.loadTransfersData = async function() {
    try {
        // Загрузка баланса
        const userResponse = await fetch('/api/user');
        const userData = await userResponse.json();
        if (userData.success) {
            const balanceEl = document.getElementById('transferBalance');
            if (balanceEl) balanceEl.textContent = userData.user.balance.toFixed(2);
        }
        
        // Загрузка получателей
        const recipientsResponse = await fetch('/api/recipients');
        const recipients = await recipientsResponse.json();
        
        const select = document.getElementById('recipientSelect');
        if (select) {
            if (recipients.length === 0) {
                select.innerHTML = '<option value="">Нет доступных получателей. Сначала выполните перевод кому-либо.</option>';
            } else {
                select.innerHTML = '<option value="">Выберите получателя</option>' + 
                    recipients.map(r => `<option value="${r.id}">${r.full_name} (${r.username})</option>`).join('');
            }
        }
        
        // Загрузка последних транзакций
        await window.loadRecentTransactions();
    } catch (error) {
        console.error('Error loading transfers data:', error);
    }
};

// Загрузка последних транзакций
window.loadRecentTransactions = async function() {
    try {
        const response = await fetch('/api/transactions?limit=10');
        const transactions = await response.json();
        
        const container = document.getElementById('recentTransactionsList');
        if (container) {
            if (transactions.length === 0) {
                container.innerHTML = '<div class="transaction-item">Нет операций</div>';
            } else {
                container.innerHTML = transactions.map(t => {
                    const isIncome = t.to_user_id === window.currentUser?.id;
                    const isCancelled = t.status === 'cancelled';
                    return `
                        <div class="transaction-item">
                            <div class="transaction-info">
                                <div>${isIncome ? 'Получено от' : 'Отправлено для'} ${isIncome ? t.from_name : t.to_name}</div>
                                <small>${new Date(t.created_at).toLocaleString('ru-RU')}</small>
                                ${t.description ? `<div><small>${t.description}</small></div>` : ''}
                            </div>
                            <div class="transaction-amount ${isIncome ? 'transaction-income' : 'transaction-outcome'} ${isCancelled ? 'transaction-cancelled' : ''}">
                                ${isIncome ? '+' : '-'} ${t.amount.toFixed(2)}
                            </div>
                            ${!isIncome && t.status !== 'cancelled' && !t.cancellation_status ? `
                                <div class="transaction-actions">
                                    <button class="cancel-btn" onclick="window.openCancellationModal(${t.id})">Отменить</button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
};

// Загрузка полной истории
window.loadFullHistory = async function() {
    try {
        const response = await fetch('/api/transactions?limit=100');
        const transactions = await response.json();
        
        const container = document.getElementById('fullTransactionsList');
        if (container) {
            if (transactions.length === 0) {
                container.innerHTML = '<div class="transaction-item">История операций пуста</div>';
            } else {
                container.innerHTML = transactions.map(t => {
                    const isIncome = t.to_user_id === window.currentUser?.id;
                    const isCancelled = t.status === 'cancelled';
                    return `
                        <div class="transaction-item">
                            <div class="transaction-info">
                                <div>${isIncome ? 'Получено от' : 'Отправлено для'} ${isIncome ? t.from_name : t.to_name}</div>
                                <div>Сумма: ${t.amount.toFixed(2)} кредитов</div>
                                <small>${new Date(t.created_at).toLocaleString('ru-RU')}</small>
                                ${t.description ? `<div><small>${t.description}</small></div>` : ''}
                                ${isCancelled ? '<div><small class="status-blocked">ОТМЕНЕНО</small></div>' : ''}
                            </div>
                            <div class="transaction-amount ${isIncome ? 'transaction-income' : 'transaction-outcome'} ${isCancelled ? 'transaction-cancelled' : ''}">
                                ${isIncome ? '+' : '-'} ${t.amount.toFixed(2)}
                            </div>
                            ${!isIncome && t.status !== 'cancelled' && !t.cancellation_status ? `
                                <div class="transaction-actions">
                                    <button class="cancel-btn" onclick="window.openCancellationModal(${t.id})">Отменить</button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
};

// Открыть модальное окно отмены
window.openCancellationModal = function(transactionId) {
    window.pendingTransactionId = transactionId;
    const modal = document.getElementById('cancellationModal');
    if (modal) modal.style.display = 'flex';
};

// Закрыть модальное окно отмены
window.closeCancellationModal = function() {
    window.pendingTransactionId = null;
    const modal = document.getElementById('cancellationModal');
    if (modal) modal.style.display = 'none';
};

// Отправить заявку на отмену
window.submitCancellationRequest = async function() {
    const reason = document.getElementById('cancellationReason')?.value;
    const comment = document.getElementById('cancellationComment')?.value;
    
    if (!reason) {
        window.showAlert('Выберите причину отмены');
        return;
    }
    
    const fullReason = comment ? `${reason}: ${comment}` : reason;
    
    try {
        const response = await fetch('/api/create-cancellation-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transaction_id: window.pendingTransactionId,
                reason: fullReason
            })
        });
        
        const data = await response.json();
        if (data.success) {
            window.showAlert('Заявка на отмену отправлена на рассмотрение', 'success');
            window.closeCancellationModal();
            if (window.location.pathname.includes('transfers')) {
                window.loadRecentTransactions();
            }
            if (window.location.pathname.includes('history')) {
                window.loadFullHistory();
            }
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при отправке заявки');
    }
};

// Выполнить перевод
window.makeTransfer = async function() {
    const to_user_id = document.getElementById('recipientSelect')?.value;
    const amount = parseFloat(document.getElementById('transferAmount')?.value);
    const description = document.getElementById('transferDescription')?.value;
    
    if (!to_user_id) {
        window.showAlert('Выберите получателя');
        return;
    }
    if (!amount || amount <= 0) {
        window.showAlert('Введите сумму перевода');
        return;
    }
    
    try {
        const response = await fetch('/api/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to_user_id: parseInt(to_user_id),
                amount: amount,
                description: description || 'Перевод средств'
            })
        });
        
        const data = await response.json();
        if (data.success) {
            window.showAlert('Перевод выполнен успешно', 'success');
            window.loadTransfersData();
            const amountInput = document.getElementById('transferAmount');
            const descInput = document.getElementById('transferDescription');
            if (amountInput) amountInput.value = '';
            if (descInput) descInput.value = '';
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при выполнении перевода');
    }
};

// Создать новую карту
window.createNewCard = async function() {
    try {
        const response = await fetch('/api/create-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        if (data.success) {
            window.showAlert('Новая карта успешно выпущена', 'success');
            window.loadCardsData();
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при создании карты');
    }
};

// Подать заявку на кредит
window.submitLoanApplication = async function() {
    const amount = parseFloat(document.getElementById('loanAmount')?.value);
    const purpose = document.getElementById('loanPurpose')?.value;
    
    if (!amount || amount <= 0 || amount > 10000) {
        window.showAlert('Сумма кредита должна быть от 1 до 10,000');
        return;
    }
    if (!purpose) {
        window.showAlert('Укажите цель получения кредита');
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
            window.showAlert('Заявка на кредит отправлена на рассмотрение', 'success');
            const amountInput = document.getElementById('loanAmount');
            const purposeInput = document.getElementById('loanPurpose');
            if (amountInput) amountInput.value = '';
            if (purposeInput) purposeInput.value = '';
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при отправке заявки');
    }
};

// Погасить кредит
window.repayLoan = async function() {
    try {
        const response = await fetch('/api/repay-loan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        if (data.success) {
            window.showAlert('Кредит погашен', 'success');
            window.loadLoansData();
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при погашении кредита');
    }
};

// Загрузка админ панели
window.loadAdminData = async function() {
    if (!window.currentUser?.is_admin) return;
    
    try {
        // Загрузка кредитных заявок
        const loansResponse = await fetch('/api/admin/loan-applications');
        const loans = await loansResponse.json();
        
        const loansContainer = document.getElementById('loanApplicationsList');
        if (loansContainer) {
            if (loans.length === 0) {
                loansContainer.innerHTML = '<div class="admin-item">Нет ожидающих заявок</div>';
            } else {
                loansContainer.innerHTML = loans.map(app => `
                    <div class="admin-item">
                        <div><strong>${app.full_name}</strong> (${app.username})</div>
                        <div>Сумма: ${app.amount} кредитов</div>
                        <div>Цель: ${app.purpose || 'Не указана'}</div>
                        <div>Дата: ${new Date(app.created_at).toLocaleString('ru-RU')}</div>
                        <div class="actions">
                            <button class="btn btn-primary small" onclick="window.approveLoan(${app.id})">Одобрить</button>
                            <button class="btn btn-outline small" onclick="window.rejectLoan(${app.id})">Отклонить</button>
                        </div>
                    </div>
                `).join('');
            }
        }
        
        // Загрузка заявок на отмену
        const cancelResponse = await fetch('/api/admin/cancellation-requests');
        const cancellations = await cancelResponse.json();
        
        const cancelContainer = document.getElementById('cancellationRequestsList');
        if (cancelContainer) {
            if (cancellations.length === 0) {
                cancelContainer.innerHTML = '<div class="admin-item">Нет заявок на отмену</div>';
            } else {
                cancelContainer.innerHTML = cancellations.map(req => `
                    <div class="admin-item">
                        <div><strong>Отправитель:</strong> ${req.from_name}</div>
                        <div><strong>Получатель:</strong> ${req.to_name}</div>
                        <div><strong>Сумма:</strong> ${req.amount} кредитов</div>
                        <div><strong>Причина:</strong> ${req.reason}</div>
                        <div><strong>Дата транзакции:</strong> ${new Date(req.transaction_date).toLocaleString('ru-RU')}</div>
                        <div class="actions">
                            <button class="btn btn-primary small" onclick="window.approveCancellation(${req.id})">Одобрить</button>
                            <button class="btn btn-outline small" onclick="window.rejectCancellation(${req.id})">Отклонить</button>
                        </div>
                    </div>
                `).join('');
            }
        }
        
        // Загрузка пользователей
        const usersResponse = await fetch('/api/admin/users');
        const users = await usersResponse.json();
        
        const usersContainer = document.getElementById('usersList');
        if (usersContainer) {
            usersContainer.innerHTML = users.map(user => `
                <div class="admin-item">
                    <div><strong>ID ${user.id}:</strong> ${user.full_name} (${user.username})</div>
                    <div>Баланс: ${user.balance.toFixed(2)} кредитов</div>
                    <div>Статус: ${user.is_frozen ? 'ЗАМОРОЖЕН' : 'АКТИВЕН'}</div>
                    <div>Дата регистрации: ${new Date(user.created_at).toLocaleDateString('ru-RU')}</div>
                    <div class="actions">
                        <button class="btn ${user.is_frozen ? 'btn-primary' : 'btn-danger'} small" 
                                onclick="window.toggleUserFreeze(${user.id}, ${!user.is_frozen})">
                            ${user.is_frozen ? 'Разморозить' : 'Заморозить'}
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
};

// Админ: одобрить кредит
window.approveLoan = async function(applicationId) {
    try {
        const response = await fetch('/api/admin/approve-loan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ application_id: applicationId })
        });
        
        const data = await response.json();
        if (data.success) {
            window.showAlert('Кредит одобрен', 'success');
            window.loadAdminData();
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при одобрении кредита');
    }
};

// Админ: отклонить кредит
window.rejectLoan = async function(applicationId) {
    const comment = prompt('Укажите причину отказа:');
    if (comment === null) return;
    
    try {
        const response = await fetch('/api/admin/reject-loan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ application_id: applicationId, comment })
        });
        
        const data = await response.json();
        if (data.success) {
            window.showAlert('Заявка отклонена', 'success');
            window.loadAdminData();
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при отклонении заявки');
    }
};

// Админ: одобрить отмену
window.approveCancellation = async function(requestId) {
    try {
        const response = await fetch('/api/admin/approve-cancellation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_id: requestId })
        });
        
        const data = await response.json();
        if (data.success) {
            window.showAlert('Транзакция отменена', 'success');
            window.loadAdminData();
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при отмене транзакции');
    }
};

// Админ: отклонить отмену
window.rejectCancellation = async function(requestId) {
    const comment = prompt('Укажите причину отказа:');
    if (comment === null) return;
    
    try {
        const response = await fetch('/api/admin/reject-cancellation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_id: requestId, comment })
        });
        
        const data = await response.json();
        if (data.success) {
            window.showAlert('Заявка отклонена', 'success');
            window.loadAdminData();
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при отклонении заявки');
    }
};

// Админ: заморозить/разморозить пользователя
window.toggleUserFreeze = async function(userId, freeze) {
    const action = freeze ? 'freeze' : 'unfreeze';
    try {
        const response = await fetch('/api/admin/toggle-user-freeze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, action })
        });
        
        const data = await response.json();
        if (data.success) {
            window.showAlert(data.message, 'success');
            window.loadAdminData();
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при изменении статуса пользователя');
    }
};

// Админ: начислить деньги
window.adminAddMoney = async function() {
    const userId = document.getElementById('adminUserId')?.value;
    const amount = parseFloat(document.getElementById('adminAmount')?.value);
    
    if (!userId || !amount || amount <= 0) {
        window.showAlert('Укажите ID пользователя и сумму');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/add-money', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: parseInt(userId), amount })
        });
        
        const data = await response.json();
        if (data.success) {
            window.showAlert('Средства начислены', 'success');
            const userIdInput = document.getElementById('adminUserId');
            const amountInput = document.getElementById('adminAmount');
            if (userIdInput) userIdInput.value = '';
            if (amountInput) amountInput.value = '';
            window.loadAdminData();
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        window.showAlert('Ошибка при начислении средств');
    }
};

// Регистрация
window.register = async function() {
    console.log('Функция register вызвана');
    
    const username = document.getElementById('regUsername')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const full_name = document.getElementById('regFullName')?.value.trim();
    const passport_series = document.getElementById('regPassportSeries')?.value.trim();
    const passport_number = document.getElementById('regPassportNumber')?.value.trim();
    const date_of_birth = document.getElementById('regDateOfBirth')?.value;
    const place_of_birth = document.getElementById('regPlaceOfBirth')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    
    console.log('Данные регистрации:', { username, full_name, passport_series, passport_number, date_of_birth, place_of_birth, email });
    
    if (!username || !password || !full_name || !passport_series || 
        !passport_number || !date_of_birth || !place_of_birth || !email) {
        window.showAlert('Заполните все поля');
        return;
    }
    
    if (username.length < 3) {
        window.showAlert('Имя пользователя должно быть минимум 3 символа');
        return;
    }
    
    if (password.length < 6) {
        window.showAlert('Пароль должен быть минимум 6 символов');
        return;
    }
    
    if (passport_series.length !== 4 || passport_number.length !== 8) {
        window.showAlert('Неверный формат паспорта. Используйте: серия 4 цифры, номер 8 цифр');
        return;
    }
    
    // Проверка email на кириллицу
    const cyrillicPattern = /[а-яА-ЯЁё]/;
    if (cyrillicPattern.test(email)) {
        window.showAlert('Email не должен содержать кириллицу');
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username, password, full_name, passport_series, passport_number,
                date_of_birth, place_of_birth, email
            })
        });
        
        const result = await response.json();
        console.log('Результат регистрации:', result);
        
        if (result.success) {
            window.showAlert('Регистрация успешна! Теперь войдите в систему.', 'success');
            window.showAuthTab('login');
            // Очищаем форму
            const inputs = document.querySelectorAll('#registerForm input');
            inputs.forEach(input => input.value = '');
        } else {
            window.showAlert(result.message);
        }
    } catch (error) {
        console.error('Registration error:', error);
        window.showAlert('Ошибка регистрации. Попробуйте позже.');
    }
};

// Вход
window.login = async function() {
    console.log('Функция login вызвана');
    
    const username = document.getElementById('loginUsername')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    console.log('Попытка входа:', { username });
    
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
        console.log('Результат входа:', data);
        
        if (data.success) {
            window.currentUser = data.user;
            window.showAlert('Вход выполнен успешно!', 'success');
            // Перезагружаем страницу для обновления состояния
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        window.showAlert('Ошибка входа. Попробуйте позже.');
    }
};

// Выход
window.logout = async function() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.currentUser = null;
        window.location.href = '/';
    } catch (error) {
        window.showAlert('Ошибка выхода');
    }
};

// Показать вкладку авторизации
window.showAuthTab = function(tab) {
    console.log('Переключение на вкладку:', tab);
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.auth-tab');
    
    if (tab === 'login') {
        if (loginForm) loginForm.classList.add('active');
        if (registerForm) registerForm.classList.remove('active');
        if (tabs[0]) tabs[0].classList.add('active');
        if (tabs[1]) tabs[1].classList.remove('active');
    } else {
        if (loginForm) loginForm.classList.remove('active');
        if (registerForm) registerForm.classList.add('active');
        if (tabs[0]) tabs[0].classList.remove('active');
        if (tabs[1]) tabs[1].classList.add('active');
    }
};

// Открыть поддержку
window.openSupport = function() {
    window.location.href = 'mailto:republiccommfinance@gmail.com?subject=Запрос в техническую поддержку&body=Уважаемая служба поддержки,';
};

// Открыть FAQ
window.openFAQ = function() {
    window.showAlert('FAQ: Для получения справки обратитесь в службу поддержки по электронной почте republiccommfinance@gmail.com', 'success');
};

// Показать уведомление
window.showAlert = function(message, type = 'error') {
    console.log('Alert:', type, message);
    
    const alertDiv = document.getElementById('alertMessage');
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert ${type}`;
        alertDiv.style.display = 'block';
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 3000);
    } else {
        alert(`${type.toUpperCase()}: ${message}`);
    }
};

// Закрыть модальное окно карты
window.closeCardModal = function() {
    const modal = document.getElementById('cardModal');
    if (modal) modal.style.display = 'none';
};

// Анимация загрузки
window.addEventListener('load', () => {
    console.log('Страница загружена');
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
                const app = document.getElementById('app');
                if (app) app.style.display = 'block';
                console.log('Приложение отображено');
            }, 500);
        }
    }, 800);
});

// Переключение между вкладками входа и регистрации
window.switchAuthTab = function(tab) {
    console.log('Переключение на вкладку:', tab);
    
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
        if (input.type === 'password') {
            input.type = 'text';
        } else {
            input.type = 'password';
        }
    }
};

// Обновленная функция регистрации с проверкой согласия
window.register = async function() {
    console.log('Функция register вызвана');
    
    const agreeTerms = document.getElementById('agreeTerms');
    if (!agreeTerms || !agreeTerms.checked) {
        window.showAlert('Необходимо принять условия пользовательского соглашения');
        return;
    }
    
    const username = document.getElementById('regUsername')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const full_name = document.getElementById('regFullName')?.value.trim();
    const passport_series = document.getElementById('regPassportSeries')?.value.trim();
    const passport_number = document.getElementById('regPassportNumber')?.value.trim();
    const date_of_birth = document.getElementById('regDateOfBirth')?.value;
    const place_of_birth = document.getElementById('regPlaceOfBirth')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    
    console.log('Данные регистрации:', { username, full_name, passport_series, passport_number, date_of_birth, place_of_birth, email });
    
    if (!username || !password || !full_name || !passport_series || 
        !passport_number || !date_of_birth || !place_of_birth || !email) {
        window.showAlert('Заполните все обязательные поля');
        return;
    }
    
    if (username.length < 3) {
        window.showAlert('Имя пользователя должно быть минимум 3 символа');
        return;
    }
    
    if (password.length < 6) {
        window.showAlert('Пароль должен быть минимум 6 символов');
        return;
    }
    
    if (passport_series.length !== 4 || passport_number.length !== 8) {
        window.showAlert('Неверный формат паспорта. Используйте: серия 4 цифры, номер 8 цифр');
        return;
    }
    
    // Проверка email на кириллицу
    const cyrillicPattern = /[а-яА-ЯЁё]/;
    if (cyrillicPattern.test(email)) {
        window.showAlert('Email не должен содержать кириллицу');
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username, password, full_name, passport_series, passport_number,
                date_of_birth, place_of_birth, email
            })
        });
        
        const result = await response.json();
        console.log('Результат регистрации:', result);
        
        if (result.success) {
            window.showAlert('Регистрация успешна! Теперь войдите в систему.', 'success');
            window.switchAuthTab('login');
            // Очищаем форму
            const inputs = document.querySelectorAll('#registerForm input');
            inputs.forEach(input => {
                if (input.type !== 'checkbox') input.value = '';
            });
            if (agreeTerms) agreeTerms.checked = false;
        } else {
            window.showAlert(result.message);
        }
    } catch (error) {
        console.error('Registration error:', error);
        window.showAlert('Ошибка регистрации. Попробуйте позже.');
    }
};

// Обновленная функция входа
window.login = async function() {
    console.log('Функция login вызвана');
    
    const username = document.getElementById('loginUsername')?.value;
    const password = document.getElementById('loginPassword')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked;
    
    console.log('Попытка входа:', { username, rememberMe });
    
    if (!username || !password) {
        window.showAlert('Введите имя пользователя и пароль');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, rememberMe })
        });
        
        const data = await response.json();
        console.log('Результат входа:', data);
        
        if (data.success) {
            window.currentUser = data.user;
            window.showAlert('Вход выполнен успешно!', 'success');
            // Перезагружаем страницу для обновления состояния
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        } else {
            window.showAlert(data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        window.showAlert('Ошибка входа. Попробуйте позже.');
    }
};

// Инициализация обработчиков для вкладок
document.addEventListener('DOMContentLoaded', () => {
    // Обработчики для кнопок переключения вкладок
    const tabBtns = document.querySelectorAll('.auth-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = btn.getAttribute('data-auth-tab');
            if (tab) {
                window.switchAuthTab(tab);
            }
        });
    });
    
    // Автофокус на поле ввода при загрузке
    const loginUsername = document.getElementById('loginUsername');
    if (loginUsername) {
        setTimeout(() => {
            loginUsername.focus();
        }, 100);
    }
});
