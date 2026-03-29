let currentUser = null;
let allRecipients = [];

// Loader
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('app').style.display = 'block';
        }, 500);
    }, 1500);
});

function showAlert(message, type = 'error') {
    const alertDiv = document.getElementById('alertMessage');
    alertDiv.textContent = message;
    alertDiv.className = `alert ${type}`;
    alertDiv.style.display = 'block';
    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 3000);
}

function showRegister() {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.add('active');
}

function showLogin() {
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
}

async function register() {
    const data = {
        username: document.getElementById('regUsername').value.trim(),
        password: document.getElementById('regPassword').value,
        full_name: document.getElementById('regFullName').value.trim(),
        passport_series: document.getElementById('regPassportSeries').value.trim(),
        passport_number: document.getElementById('regPassportNumber').value.trim(),
        date_of_birth: document.getElementById('regDateOfBirth').value,
        place_of_birth: document.getElementById('regPlaceOfBirth').value.trim(),
        address: document.getElementById('regAddress').value.trim(),
        phone: document.getElementById('regPhone').value.trim(),
        email: document.getElementById('regEmail').value.trim()
    };
    
    if (!data.username || !data.password || !data.full_name || !data.passport_series || 
        !data.passport_number || !data.date_of_birth || !data.place_of_birth || 
        !data.address || !data.phone || !data.email) {
        showAlert('Заполните все поля');
        return;
    }
    
    if (data.username.length < 3) {
        showAlert('Имя пользователя должно быть минимум 3 символа');
        return;
    }
    
    if (data.password.length < 6) {
        showAlert('Пароль должен быть минимум 6 символов');
        return;
    }
    
    if (data.passport_series.length !== 4 || data.passport_number.length !== 8) {
        showAlert('Неверный формат паспорта. Используйте: серия 4 цифры, номер 8 цифр');
        return;
    }
    
    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    const result = await response.json();
    if (result.success) {
        showAlert('Регистрация успешна! Теперь войдите в систему.', 'success');
        showLogin();
    } else {
        showAlert(result.message);
    }
}

async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showAlert('Введите имя пользователя и пароль');
        return;
    }
    
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    if (data.success) {
        currentUser = data.user;
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('bankSection').style.display = 'flex';
        
        if (currentUser.is_admin) {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
        }
        
        loadUserData();
        loadRecipients();
        setupNavigation();
        
        if (currentUser.is_admin) {
            loadLoanApplications();
        }
    } else {
        showAlert(data.message);
    }
}

async function loadUserData() {
    const response = await fetch(`/api/user/${currentUser.id}`);
    const data = await response.json();
    
    if (data.success) {
        document.getElementById('userGreeting').textContent = `Добро пожаловать, ${data.user.full_name.split(' ')[0]}`;
        document.getElementById('userBalance').textContent = data.user.balance.toFixed(2);
        
        // Profile
        document.getElementById('profileId').textContent = data.user.id;
        document.getElementById('profileFullName').textContent = data.user.full_name;
        document.getElementById('profilePassport').textContent = `${data.user.passport_series}-${data.user.passport_number}`;
        document.getElementById('profileBirthDate').textContent = new Date(data.user.date_of_birth).toLocaleDateString('ru-RU');
        document.getElementById('profileBirthPlace').textContent = data.user.place_of_birth;
        document.getElementById('profileAddress').textContent = data.user.address;
        document.getElementById('profilePhone').textContent = data.user.phone;
        document.getElementById('profileEmail').textContent = data.user.email;
        document.getElementById('profileCreatedAt').textContent = new Date(data.user.created_at).toLocaleDateString('ru-RU');
        
        // Stats
        document.getElementById('statTransactions').textContent = data.stats.total_transactions || 0;
        document.getElementById('statRecipients').textContent = data.stats.unique_recipients || 0;
        document.getElementById('statSent').textContent = (data.stats.total_sent || 0).toFixed(2);
        document.getElementById('statReceived').textContent = (data.stats.total_received || 0).toFixed(2);
        
        // Cards
        const cardsList = document.getElementById('cardsList');
        if (!data.cards || data.cards.length === 0) {
            cardsList.innerHTML = '<p>У вас нет активных карт. Выпустите новую карту.</p>';
        } else {
            cardsList.innerHTML = data.cards.map(card => `
                <div class="card-item ${card.is_blocked ? 'blocked' : ''}">
                    <div class="card-number">${card.card_number}</div>
                    <div class="card-details">
                        <span>${card.card_holder}</span>
                        <span>${card.expiry_date}</span>
                    </div>
                    <div class="card-details">
                        <span>CVV: ${card.cvv}</span>
                        <span>${card.is_blocked ? 'Заблокирована' : 'Активна'}</span>
                    </div>
                    <div class="card-status">
                        <span class="${card.is_blocked ? 'status-blocked' : 'status-active'}">
                            ${card.is_blocked ? '🔒 Карта заблокирована' : '✅ Карта активна'}
                        </span>
                    </div>
                </div>
            `).join('');
        }
        
        // Loan info
        const loanInfo = document.getElementById('activeLoanInfo');
        if (data.activeLoan && data.activeLoan.is_active === 1) {
            loanInfo.innerHTML = `
                <div class="loan-status">
                    <strong>Активный кредит</strong><br>
                    Сумма долга: ${data.activeLoan.debt_amount.toFixed(2)} кредитов<br>
                    Ежемесячный платеж: ${data.activeLoan.monthly_payment?.toFixed(2) || '0.00'}<br>
                    Дата выдачи: ${new Date(data.activeLoan.created_at).toLocaleDateString('ru-RU')}
                </div>
            `;
        } else {
            loanInfo.innerHTML = '';
        }
        
        // Transactions
        loadTransactions();
    }
}

async function loadTransactions() {
    const response = await fetch(`/api/transactions/${currentUser.id}`);
    const transactions = await response.json();
    
    const container = document.getElementById('transactionsList');
    if (transactions.length === 0) {
        container.innerHTML = '<div class="transaction-item">История операций пуста</div>';
    } else {
        container.innerHTML = transactions.map(t => {
            const isIncome = t.to_user_id === currentUser.id;
            return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div>${isIncome ? 'Получено от' : 'Отправлено для'} ${isIncome ? t.from_name : t.to_name}</div>
                        <small>${new Date(t.created_at).toLocaleString('ru-RU')}</small>
                        ${t.description ? `<div><small>${t.description}</small></div>` : ''}
                    </div>
                    <div class="transaction-amount ${isIncome ? 'transaction-income' : 'transaction-outcome'}">
                        ${isIncome ? '+' : '-'} ${t.amount.toFixed(2)}
                    </div>
                </div>
            `;
        }).join('');
    }
}

async function loadRecipients() {
    const response = await fetch(`/api/recipients/${currentUser.id}`);
    allRecipients = await response.json();
    
    const select = document.getElementById('recipientSelect');
    if (allRecipients.length === 0) {
        select.innerHTML = '<option value="">Нет доступных получателей. Сначала выполните перевод кому-либо.</option>';
    } else {
        select.innerHTML = '<option value="">Выберите получателя</option>' + 
            allRecipients.map(r => `<option value="${r.id}">${r.full_name} (${r.username})</option>`).join('');
    }
}

async function makeTransfer() {
    const to_user_id = document.getElementById('recipientSelect').value;
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const description = document.getElementById('transferDescription').value;
    
    if (!to_user_id) {
        showAlert('Выберите получателя');
        return;
    }
    if (!amount || amount <= 0) {
        showAlert('Введите сумму перевода');
        return;
    }
    
    const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from_user_id: currentUser.id,
            to_user_id: parseInt(to_user_id),
            amount: amount,
            description: description || 'Перевод средств'
        })
    });
    
    const data = await response.json();
    if (data.success) {
        showAlert('Перевод выполнен успешно', 'success');
        loadUserData();
        loadRecipients();
        document.getElementById('transferAmount').value = '';
        document.getElementById('transferDescription').value = '';
    } else {
        showAlert(data.message);
    }
}

async function createNewCard() {
    const response = await fetch('/api/create-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            full_name: currentUser.full_name
        })
    });
    
    const data = await response.json();
    if (data.success) {
        showAlert('Новая карта успешно выпущена', 'success');
        loadUserData();
    } else {
        showAlert(data.message);
    }
}

async function submitLoanApplication() {
    const amount = parseFloat(document.getElementById('loanAmount').value);
    const purpose = document.getElementById('loanPurpose').value;
    
    if (!amount || amount <= 0 || amount > 10000) {
        showAlert('Сумма кредита должна быть от 1 до 10,000');
        return;
    }
    if (!purpose) {
        showAlert('Укажите цель получения кредита');
        return;
    }
    
    const response = await fetch('/api/loan-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            amount: amount,
            purpose: purpose
        })
    });
    
    const data = await response.json();
    if (data.success) {
        showAlert('Заявка на кредит отправлена на рассмотрение', 'success');
        document.getElementById('loanAmount').value = '';
        document.getElementById('loanPurpose').value = '';
    } else {
        showAlert(data.message);
    }
}

async function loadLoanApplications() {
    if (!currentUser?.is_admin) return;
    
    const response = await fetch(`/api/loan-applications?admin_id=${currentUser.id}`);
    const applications = await response.json();
    
    const container = document.getElementById('loanApplicationsList');
    if (applications.length === 0) {
        container.innerHTML = '<p>Нет ожидающих заявок</p>';
    } else {
        container.innerHTML = applications.map(app => `
            <div class="loan-application-item">
                <div><strong>${app.full_name}</strong> (${app.username})</div>
                <div>Сумма: ${app.amount} кредитов</div>
                <div>Цель: ${app.purpose || 'Не указана'}</div>
                <div>Дата подачи: ${new Date(app.created_at).toLocaleString('ru-RU')}</div>
                <div class="actions">
                    <button class="btn btn-primary" onclick="approveLoan(${app.id})">Одобрить</button>
                    <button class="btn btn-outline" onclick="rejectLoan(${app.id})">Отклонить</button>
                </div>
            </div>
        `).join('');
    }
}

async function approveLoan(applicationId) {
    const response = await fetch('/api/approve-loan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            application_id: applicationId,
            admin_id: currentUser.id
        })
    });
    
    const data = await response.json();
    if (data.success) {
        showAlert('Кредит одобрен', 'success');
        loadLoanApplications();
    } else {
        showAlert(data.message);
    }
}

async function rejectLoan(applicationId) {
    const comment = prompt('Укажите причину отказа:');
    if (comment === null) return;
    
    const response = await fetch('/api/reject-loan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            application_id: applicationId,
            admin_id: currentUser.id,
            comment: comment
        })
    });
    
    const data = await response.json();
    if (data.success) {
        showAlert('Заявка отклонена', 'success');
        loadLoanApplications();
    } else {
        showAlert(data.message);
    }
}

async function adminAddMoney() {
    const userId = document.getElementById('adminUserId').value;
    const amount = parseFloat(document.getElementById('adminAmount').value);
    
    if (!userId || !amount || amount <= 0) {
        showAlert('Укажите ID пользователя и сумму');
        return;
    }
    
    const response = await fetch('/api/admin-add-money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            admin_id: currentUser.id,
            user_id: parseInt(userId),
            amount: amount
        })
    });
    
    const data = await response.json();
    if (data.success) {
        showAlert('Средства начислены', 'success');
        document.getElementById('adminUserId').value = '';
        document.getElementById('adminAmount').value = '';
    } else {
        showAlert(data.message);
    }
}

function setupNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabs = ['profile', 'cards', 'transfers', 'loans', 'history', 'admin'];
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            tabs.forEach(tab => {
                const tabElement = document.getElementById(`${tab}Tab`);
                if (tabElement) tabElement.classList.remove('active');
            });
            
            const activeTab = document.getElementById(`${tabName}Tab`);
            if (activeTab) activeTab.classList.add('active');
            
            if (tabName === 'admin' && currentUser?.is_admin) {
                loadLoanApplications();
            }
        });
    });
}

function openSupport() {
    window.location.href = 'mailto:republiccommfinance@gmail.com?subject=Запрос в техническую поддержку&body=Уважаемая служба поддержки,';
}

function openFAQ() {
    showAlert('FAQ: Часто задаваемые вопросы будут доступны в ближайшее время. Для вопросов обращайтесь в поддержку.', 'success');
}

function logout() {
    currentUser = null;
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('bankSection').style.display = 'none';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}
