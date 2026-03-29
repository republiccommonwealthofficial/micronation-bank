const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Безопасность
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
        },
    },
}));

// CORS настройки
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:3000',
    credentials: true
}));

// Rate limiting для защиты от брутфорса
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Слишком много запросов, попробуйте позже' }
});
app.use('/api/', limiter);

// Сессии для авторизации
app.use(session({
    secret: process.env.SESSION_SECRET || 'micronation_bank_secret_key_2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'strict'
    }
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));

// Middleware для проверки авторизации
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Необходима авторизация' });
    }
    next();
};

const requireAdmin = async (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Необходима авторизация' });
    }
    
    db.getUserById(req.session.userId, (err, user) => {
        if (err || !user || !user.is_admin) {
            return res.status(403).json({ success: false, message: 'Доступ запрещен' });
        }
        next();
    });
};

// ============= API ЭНДПОИНТЫ =============

// Регистрация
app.post('/api/register', async (req, res) => {
    const { username, password, full_name, passport_series, passport_number, date_of_birth, place_of_birth, email } = req.body;
    
    if (!username || !password || !full_name || !passport_series || !passport_number || !date_of_birth || !place_of_birth || !email) {
        return res.json({ success: false, message: 'Заполните все поля' });
    }
    
    // Проверка email на кириллицу
    const cyrillicPattern = /[а-яА-ЯЁё]/;
    if (cyrillicPattern.test(email)) {
        return res.json({ success: false, message: 'Email не должен содержать кириллицу' });
    }
    
    const passportPattern = /^\d{4}-\d{8}$/;
    if (!passportPattern.test(`${passport_series}-${passport_number}`)) {
        return res.json({ success: false, message: 'Неверный формат паспорта' });
    }
    
    if (username.length < 3 || password.length < 6) {
        return res.json({ success: false, message: 'Имя пользователя (мин 3) и пароль (мин 6)' });
    }
    
    db.registerUser({
        username, password, full_name, passport_series, passport_number,
        date_of_birth, place_of_birth, email
    }, (err, userId) => {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                res.json({ success: false, message: 'Пользователь уже существует' });
            } else {
                res.json({ success: false, message: 'Ошибка регистрации' });
            }
            return;
        }
        
        db.createInitialCard(userId, full_name, () => {});
        res.json({ success: true, message: 'Регистрация успешна' });
    });
});

// Вход
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.getUserByUsername(username, (err, user) => {
        if (err || !user) {
            return res.json({ success: false, message: 'Неверные учетные данные' });
        }
        
        const bcrypt = require('bcryptjs');
        const isValid = bcrypt.compareSync(password, user.password);
        
        if (!isValid) {
            return res.json({ success: false, message: 'Неверные учетные данные' });
        }
        
        if (user.is_frozen === 1) {
            return res.json({ success: false, message: 'Ваш аккаунт заморожен. Обратитесь в службу поддержки.' });
        }
        
        req.session.userId = user.id;
        req.session.isAdmin = user.is_admin === 1;
        
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                balance: user.balance,
                is_admin: user.is_admin,
                is_frozen: user.is_frozen
            }
        });
    });
});

// Выход
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Проверка сессии
app.get('/api/check-session', (req, res) => {
    if (req.session.userId) {
        db.getUserById(req.session.userId, (err, user) => {
            if (err || !user) {
                return res.json({ success: false });
            }
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    is_admin: user.is_admin,
                    is_frozen: user.is_frozen
                }
            });
        });
    } else {
        res.json({ success: false });
    }
});

// Получить данные пользователя
app.get('/api/user', requireAuth, (req, res) => {
    db.getUserById(req.session.userId, (err, user) => {
        if (err || !user) {
            return res.json({ success: false });
        }
        
        db.getUserCards(user.id, (err, cards) => {
            db.getActiveLoan(user.id, (err, loan) => {
                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        full_name: user.full_name,
                        balance: user.balance,
                        passport_series: user.passport_series,
                        passport_number: user.passport_number,
                        date_of_birth: user.date_of_birth,
                        place_of_birth: user.place_of_birth,
                        email: user.email,
                        created_at: user.created_at,
                        is_frozen: user.is_frozen
                    },
                    cards: cards || [],
                    activeLoan: loan || null
                });
            });
        });
    });
});

// Получить список получателей
app.get('/api/recipients', requireAuth, (req, res) => {
    db.getUsersForTransfer(req.session.userId, (err, recipients) => {
        res.json(recipients || []);
    });
});

// Создать карту
app.post('/api/create-card', requireAuth, (req, res) => {
    db.getUserById(req.session.userId, (err, user) => {
        if (user.is_frozen === 1) {
            return res.json({ success: false, message: 'Ваш аккаунт заморожен' });
        }
        
        db.canCreateCard(req.session.userId, (err, canCreate) => {
            if (!canCreate) {
                return res.json({ success: false, message: 'Максимальное количество карт (4) уже выпущено' });
            }
            
            db.createCard(req.session.userId, user.full_name, (err, cardId) => {
                if (err) {
                    res.json({ success: false, message: 'Ошибка создания карты' });
                } else {
                    res.json({ success: true, message: 'Карта успешно выпущена' });
                }
            });
        });
    });
});

// Блокировка/разблокировка карты
app.post('/api/toggle-card-block', requireAuth, (req, res) => {
    const { card_id, action } = req.body; // action: 'block' или 'unblock'
    
    db.toggleCardBlock(card_id, action === 'block', (err) => {
        if (err) {
            res.json({ success: false, message: 'Ошибка' });
        } else {
            res.json({ success: true, message: action === 'block' ? 'Карта заблокирована' : 'Карта разблокирована' });
        }
    });
});

// Получить данные карты
app.get('/api/card/:card_id', requireAuth, (req, res) => {
    db.getCardById(req.params.card_id, req.session.userId, (err, card) => {
        if (err || !card) {
            res.json({ success: false });
        } else {
            res.json({ success: true, card });
        }
    });
});

// Перевод
app.post('/api/transfer', requireAuth, (req, res) => {
    const { to_user_id, amount, description } = req.body;
    
    db.getUserById(req.session.userId, (err, user) => {
        if (user.is_frozen === 1) {
            return res.json({ success: false, message: 'Ваш аккаунт заморожен' });
        }
        
        if (!to_user_id || !amount || amount <= 0) {
            return res.json({ success: false, message: 'Укажите получателя и сумму' });
        }
        
        if (req.session.userId === to_user_id) {
            return res.json({ success: false, message: 'Невозможно выполнить перевод самому себе' });
        }
        
        db.transfer(req.session.userId, to_user_id, amount, description, (err, result) => {
            if (err) {
                res.json({ success: false, message: err.message });
            } else {
                res.json({ success: true, message: 'Перевод выполнен успешно' });
            }
        });
    });
});

// Создать заявку на отмену транзакции
app.post('/api/create-cancellation-request', requireAuth, (req, res) => {
    const { transaction_id, reason } = req.body;
    
    db.createCancellationRequest(req.session.userId, transaction_id, reason, (err, requestId) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'Заявка на отмену отправлена' });
        }
    });
});

// Получить историю транзакций
app.get('/api/transactions', requireAuth, (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    
    db.getUserTransactions(req.session.userId, limit, (err, transactions) => {
        res.json(transactions || []);
    });
});

// Кредитные заявки
app.post('/api/loan-application', requireAuth, (req, res) => {
    const { amount, purpose } = req.body;
    
    db.getUserById(req.session.userId, (err, user) => {
        if (user.is_frozen === 1) {
            return res.json({ success: false, message: 'Ваш аккаунт заморожен' });
        }
        
        if (!amount || amount <= 0 || amount > 10000) {
            return res.json({ success: false, message: 'Сумма от 1 до 10,000' });
        }
        
        db.getActiveLoan(req.session.userId, (err, existingLoan) => {
            if (existingLoan) {
                return res.json({ success: false, message: 'У вас уже есть активный кредит' });
            }
            
            db.createLoanApplication(req.session.userId, amount, purpose, (err, applicationId) => {
                if (err) {
                    res.json({ success: false, message: 'Ошибка создания заявки' });
                } else {
                    res.json({ success: true, message: 'Заявка отправлена' });
                }
            });
        });
    });
});

// Погасить кредит
app.post('/api/repay-loan', requireAuth, (req, res) => {
    db.repayLoan(req.session.userId, (err, result) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'Кредит погашен' });
        }
    });
});

// ============= АДМИН ЭНДПОИНТЫ =============

// Получить все кредитные заявки
app.get('/api/admin/loan-applications', requireAdmin, (req, res) => {
    db.getPendingLoanApplications((err, applications) => {
        res.json(applications || []);
    });
});

// Получить все заявки на отмену транзакций
app.get('/api/admin/cancellation-requests', requireAdmin, (req, res) => {
    db.getPendingCancellationRequests((err, requests) => {
        res.json(requests || []);
    });
});

// Одобрить кредит
app.post('/api/admin/approve-loan', requireAdmin, (req, res) => {
    const { application_id } = req.body;
    
    db.approveLoan(application_id, req.session.userId, (err, result) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'Кредит одобрен' });
        }
    });
});

// Отклонить кредит
app.post('/api/admin/reject-loan', requireAdmin, (req, res) => {
    const { application_id, comment } = req.body;
    
    db.rejectLoan(application_id, req.session.userId, comment, (err) => {
        if (err) {
            res.json({ success: false, message: 'Ошибка' });
        } else {
            res.json({ success: true, message: 'Заявка отклонена' });
        }
    });
});

// Одобрить отмену транзакции
app.post('/api/admin/approve-cancellation', requireAdmin, (req, res) => {
    const { request_id } = req.body;
    
    db.approveCancellation(request_id, req.session.userId, (err, result) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'Транзакция отменена' });
        }
    });
});

// Отклонить отмену транзакции
app.post('/api/admin/reject-cancellation', requireAdmin, (req, res) => {
    const { request_id, comment } = req.body;
    
    db.rejectCancellation(request_id, req.session.userId, comment, (err) => {
        if (err) {
            res.json({ success: false, message: 'Ошибка' });
        } else {
            res.json({ success: true, message: 'Заявка отклонена' });
        }
    });
});

// Заморозить/разморозить аккаунт
app.post('/api/admin/toggle-user-freeze', requireAdmin, (req, res) => {
    const { user_id, action } = req.body;
    
    db.toggleUserFreeze(user_id, action === 'freeze', (err) => {
        if (err) {
            res.json({ success: false, message: 'Ошибка' });
        } else {
            res.json({ success: true, message: action === 'freeze' ? 'Аккаунт заморожен' : 'Аккаунт разморожен' });
        }
    });
});

// Получить всех пользователей
app.get('/api/admin/users', requireAdmin, (req, res) => {
    db.getAllUsers((err, users) => {
        res.json(users || []);
    });
});

// Начислить деньги
app.post('/api/admin/add-money', requireAdmin, (req, res) => {
    const { user_id, amount } = req.body;
    
    db.adminAddMoney(req.session.userId, user_id, amount, (err) => {
        if (err) {
            res.json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: 'Средства начислены' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Национальный банк запущен на порту ${PORT}`);
});