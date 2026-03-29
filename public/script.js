let currentUser = null;
let pendingTransactionId = null;

// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // Адаптация логотипа
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.style.maxWidth = '200px';
        logo.style.height = 'auto';
        logo.style.width = 'auto';
    }
    
    await checkSession();
});

// Проверка сессии
async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            updateUIForLoggedInUser();
            
            // Если мы на главной, загружаем данные
            if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                loadUserBalance();
            } else {
                // На других страницах загружаем соответствующие данные
                loadPageData();
            }
        } else {
            // Если не авторизован и не на главной - перенаправляем на главную
            if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                window.location.href = '/';
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
}

// Обновление UI для авторизованного пользователя
function updateUIForLoggedInUser() {
    // Скрываем форму авторизации на главной
    const authPanel = document.getElementById('authPanel');
    const welcomePanel = document.getElementById('welcomePanel');
    
    if (authPanel) authPanel.style.display = 'none';
    if (welcomePanel) {
        welcomePanel.style.display = 'block';
        const welcomeNameSpan = document.getElementById('welcomeName');
        if (welcomeNameSpan) {
            welcomeNameSpan.textContent = currentUser.full_name.split(' ')[0];
        }
        loadUserBalance();
    }
    
    // Показываем ссылки для авторизованных
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href !== '/' && href !== '/index.html') {
            link.style.display = 'inline-block';
        }
    });
    
    // Показываем админ ссылку если нужно
    if (currentUser.is_admin) {
        const adminLink = document.querySelector('.nav-link[href="/admin"]');
        if (adminLink) adminLink.style.display = 'inline-block';
    }
}

// Загрузка баланса для приветствия
async function loadUserBalance() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        if (data.success) {
            const welcomeBalance = document.getElementById('welcomeBalance');
            if (welcomeBalance) welcomeBalance.textContent = data.user.balance.toFixed(2);
        }
    } catch (error) {
        console.error('Error loading balance:', error);
    }
}

// Загрузка данных страницы
async function loadPageData() {
    const path = window.location.pathname;
    
    if (path === '/profile' || path === '/profile.html') {
        await loadProfileData();
    } else if (path === '/cards' || path === '/cards.html') {
        await loadCardsData();
    } else if (path === '/transfers' || path === '/transfers.html') {
        await loadTransfersData();
    } else if (path === '/history' || path === '/history.html') {
        await loadFullHistory();
    } else if (path === '/loans' || path === '/loans.html') {
        await loadLoansData();
    } else if (path === '/admin' || path === '/admin.html') {
        if (currentUser?.is_admin) {
            await loadAdminData();
        } else {
            window.location.href = '/';
        }
    }
}

// Загрузка данных профиля
async function loadProfileData() {
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
}

// Загрузка данных кредитов
async function loadLoansData() {
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
}

// Загрузка данных карт
async function loadCardsData() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        const cardsGrid = document.getElementById('cardsGrid');
        if (!cardsGrid) return;
        
        if (!data.cards || data.cards.length === 0) {
            cardsGrid.innerHTML = '<div class="card-item">У вас нет активных карт. Выпустите новую карту.</div>';
        } else {
            cardsGrid.innerHTML = data.cards.map(card => `
                <div class="card-item ${card.is_blocked ? 'blocked' : ''}" onclick="showCardDetails(${card.id})">
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
}

// Показать детали карты в модальном окне
async function showCardDetails(cardId) {
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
                                onclick="toggleCardBlock(${cardId}, ${!data.card.is_blocked})">
                            ${data.card.is_blocked ? 'Разблокировать карту' : 'Заблокировать карту'}
                        </button>
                    </div>
                `;
                document.getElementById('cardModal').style.display = 'flex';
            }
        }
    } catch (error) {
        console.error('Error loading card details:', error);
        showAlert('Ошибка при загрузке данных карты');
    }
}

// Блокировка/разблокировка карты
async function toggleCardBlock(cardId, block) {
    const action = block ? 'block' : 'unblock';
    try {
        const response = await fetch('/api/toggle-card-block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_id: cardId, action })
        });
        
        const data = await response.json();
        if (data.success) {
            showAlert(data.message, 'success');
            closeCardModal();
            loadCardsData();
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при изменении статуса карты');
    }
}

// Загрузка данных переводов
async function loadTransfersData() {
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
        await loadRecentTransactions();
    } catch (error) {
        console.error('Error loading transfers data:', error);
    }
}

// Загрузка последних транзакций
async function loadRecentTransactions() {
    try {
        const response = await fetch('/api/transactions?limit=10');
        const transactions = await response.json();
        
        const container = document.getElementById('recentTransactionsList');
        if (container) {
            if (transactions.length === 0) {
                container.innerHTML = '<div class="transaction-item">Нет операций</div>';
            } else {
                container.innerHTML = transactions.map(t => {
                    const isIncome = t.to_user_id === currentUser?.id;
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
                                    <button class="cancel-btn" onclick="openCancellationModal(${t.id})">Отменить</button>
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
}

// Загрузка полной истории
async function loadFullHistory() {
    try {
        const response = await fetch('/api/transactions?limit=100');
        const transactions = await response.json();
        
        const container = document.getElementById('fullTransactionsList');
        if (container) {
            if (transactions.length === 0) {
                container.innerHTML = '<div class="transaction-item">История операций пуста</div>';
            } else {
                container.innerHTML = transactions.map(t => {
                    const isIncome = t.to_user_id === currentUser?.id;
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
                                    <button class="cancel-btn" onclick="openCancellationModal(${t.id})">Отменить</button>
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
}

// Открыть модальное окно отмены
function openCancellationModal(transactionId) {
    pendingTransactionId = transactionId;
    const modal = document.getElementById('cancellationModal');
    if (modal) modal.style.display = 'flex';
}

// Закрыть модальное окно отмены
function closeCancellationModal() {
    pendingTransactionId = null;
    const modal = document.getElementById('cancellationModal');
    if (modal) modal.style.display = 'none';
}

// Отправить заявку на отмену
async function submitCancellationRequest() {
    const reason = document.getElementById('cancellationReason')?.value;
    const comment = document.getElementById('cancellationComment')?.value;
    
    if (!reason) {
        showAlert('Выберите причину отмены');
        return;
    }
    
    const fullReason = comment ? `${reason}: ${comment}` : reason;
    
    try {
        const response = await fetch('/api/create-cancellation-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transaction_id: pendingTransactionId,
                reason: fullReason
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showAlert('Заявка на отмену отправлена на рассмотрение', 'success');
            closeCancellationModal();
            if (window.location.pathname.includes('transfers')) {
                loadRecentTransactions();
            }
            if (window.location.pathname.includes('history')) {
                loadFullHistory();
            }
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при отправке заявки');
    }
}

// Выполнить перевод
async function makeTransfer() {
    const to_user_id = document.getElementById('recipientSelect')?.value;
    const amount = parseFloat(document.getElementById('transferAmount')?.value);
    const description = document.getElementById('transferDescription')?.value;
    
    if (!to_user_id) {
        showAlert('Выберите получателя');
        return;
    }
    if (!amount || amount <= 0) {
        showAlert('Введите сумму перевода');
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
            showAlert('Перевод выполнен успешно', 'success');
            loadTransfersData();
            const amountInput = document.getElementById('transferAmount');
            const descInput = document.getElementById('transferDescription');
            if (amountInput) amountInput.value = '';
            if (descInput) descInput.value = '';
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при выполнении перевода');
    }
}

// Создать новую карту
async function createNewCard() {
    try {
        const response = await fetch('/api/create-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        if (data.success) {
            showAlert('Новая карта успешно выпущена', 'success');
            loadCardsData();
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при создании карты');
    }
}

// Подать заявку на кредит
async function submitLoanApplication() {
    const amount = parseFloat(document.getElementById('loanAmount')?.value);
    const purpose = document.getElementById('loanPurpose')?.value;
    
    if (!amount || amount <= 0 || amount > 10000) {
        showAlert('Сумма кредита должна быть от 1 до 10,000');
        return;
    }
    if (!purpose) {
        showAlert('Укажите цель получения кредита');
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
            showAlert('Заявка на кредит отправлена на рассмотрение', 'success');
            const amountInput = document.getElementById('loanAmount');
            const purposeInput = document.getElementById('loanPurpose');
            if (amountInput) amountInput.value = '';
            if (purposeInput) purposeInput.value = '';
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при отправке заявки');
    }
}

// Погасить кредит
async function repayLoan() {
    try {
        const response = await fetch('/api/repay-loan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        if (data.success) {
            showAlert('Кредит погашен', 'success');
            loadLoansData();
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при погашении кредита');
    }
}

// Загрузка админ панели
async function loadAdminData() {
    if (!currentUser?.is_admin) return;
    
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
                            <button class="btn btn-primary small" onclick="approveLoan(${app.id})">Одобрить</button>
                            <button class="btn btn-outline small" onclick="rejectLoan(${app.id})">Отклонить</button>
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
                            <button class="btn btn-primary small" onclick="approveCancellation(${req.id})">Одобрить</button>
                            <button class="btn btn-outline small" onclick="rejectCancellation(${req.id})">Отклонить</button>
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
                                onclick="toggleUserFreeze(${user.id}, ${!user.is_frozen})">
                            ${user.is_frozen ? 'Разморозить' : 'Заморозить'}
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

// Админ: одобрить кредит
async function approveLoan(applicationId) {
    try {
        const response = await fetch('/api/admin/approve-loan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ application_id: applicationId })
        });
        
        const data = await response.json();
        if (data.success) {
            showAlert('Кредит одобрен', 'success');
            loadAdminData();
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при одобрении кредита');
    }
}

// Админ: отклонить кредит
async function rejectLoan(applicationId) {
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
            showAlert('Заявка отклонена', 'success');
            loadAdminData();
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при отклонении заявки');
    }
}

// Админ: одобрить отмену
async function approveCancellation(requestId) {
    try {
        const response = await fetch('/api/admin/approve-cancellation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_id: requestId })
        });
        
        const data = await response.json();
        if (data.success) {
            showAlert('Транзакция отменена', 'success');
            loadAdminData();
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при отмене транзакции');
    }
}

// Админ: отклонить отмену
async function rejectCancellation(requestId) {
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
            showAlert('Заявка отклонена', 'success');
            loadAdminData();
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при отклонении заявки');
    }
}

// Админ: заморозить/разморозить пользователя
async function toggleUserFreeze(userId, freeze) {
    const action = freeze ? 'freeze' : 'unfreeze';
    try {
        const response = await fetch('/api/admin/toggle-user-freeze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, action })
        });
        
        const data = await response.json();
        if (data.success) {
            showAlert(data.message, 'success');
            loadAdminData();
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при изменении статуса пользователя');
    }
}

// Админ: начислить деньги
async function adminAddMoney() {
    const userId = document.getElementById('adminUserId')?.value;
    const amount = parseFloat(document.getElementById('adminAmount')?.value);
    
    if (!userId || !amount || amount <= 0) {
        showAlert('Укажите ID пользователя и сумму');
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
            showAlert('Средства начислены', 'success');
            const userIdInput = document.getElementById('adminUserId');
            const amountInput = document.getElementById('adminAmount');
            if (userIdInput) userIdInput.value = '';
            if (amountInput) amountInput.value = '';
            loadAdminData();
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        showAlert('Ошибка при начислении средств');
    }
}

// Регистрация
async function register() {
    const username = document.getElementById('regUsername')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const full_name = document.getElementById('regFullName')?.value.trim();
    const passport_series = document.getElementById('regPassportSeries')?.value.trim();
    const passport_number = document.getElementById('regPassportNumber')?.value.trim();
    const date_of_birth = document.getElementById('regDateOfBirth')?.value;
    const place_of_birth = document.getElementById('regPlaceOfBirth')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    
    if (!username || !password || !full_name || !passport_series || 
        !passport_number || !date_of_birth || !place_of_birth || !email) {
        showAlert('Заполните все поля');
        return;
    }
    
    if (username.length < 3) {
        showAlert('Имя пользователя должно быть минимум 3 символа');
        return;
    }
    
    if (password.length < 6) {
        showAlert('Пароль должен быть минимум 6 символов');
        return;
    }
    
    if (passport_series.length !== 4 || passport_number.length !== 8) {
        showAlert('Неверный формат паспорта. Используйте: серия 4 цифры, номер 8 цифр');
        return;
    }
    
    // Проверка email на кириллицу
    const cyrillicPattern = /[а-яА-ЯЁё]/;
    if (cyrillicPattern.test(email)) {
        showAlert('Email не должен содержать кириллицу');
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
        if (result.success) {
            showAlert('Регистрация успешна! Теперь войдите в систему.', 'success');
            showAuthTab('login');
            // Очищаем форму
            const inputs = document.querySelectorAll('#registerForm input');
            inputs.forEach(input => input.value = '');
        } else {
            showAlert(result.message);
        }
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('Ошибка регистрации. Попробуйте позже.');
    }
}

// Вход
async function login() {
    const username = document.getElementById('loginUsername')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (!username || !password) {
        showAlert('Введите имя пользователя и пароль');
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
            currentUser = data.user;
            // Перезагружаем страницу для обновления состояния
            window.location.href = '/';
        } else {
            showAlert(data.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert('Ошибка входа. Попробуйте позже.');
    }
}

// Выход
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        window.location.href = '/';
    } catch (error) {
        showAlert('Ошибка выхода');
    }
}

// Показать вкладку авторизации
function showAuthTab(tab) {
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
}

// Открыть поддержку
function openSupport() {
    window.location.href = 'mailto:republiccommfinance@gmail.com?subject=Запрос в техническую поддержку&body=Уважаемая служба поддержки,';
}

// Открыть FAQ
function openFAQ() {
    showAlert('FAQ: Для получения справки обратитесь в службу поддержки по электронной почте republiccommfinance@gmail.com', 'success');
}

// Показать уведомление
function showAlert(message, type = 'error') {
    const alertDiv = document.getElementById('alertMessage');
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert ${type}`;
        alertDiv.style.display = 'block';
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 3000);
    } else {
        console.log(`${type}: ${message}`);
    }
}

// Закрыть модальное окно карты
function closeCardModal() {
    const modal = document.getElementById('cardModal');
    if (modal) modal.style.display = 'none';
}

// Анимация загрузки
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
                const app = document.getElementById('app');
                if (app) app.style.display = 'block';
            }, 500);
        }
    }, 800);
});
