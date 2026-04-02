const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Безопасность
app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Сессии
app.use(session({
    secret: 'micronation_bank_secret_key_2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

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
                    is_admin: user.is_admin
                }
            });
        });
    } else {
        res.json({ success: false });
    }
});

// Регистрация
app.post('/api/register', (req, res) => {
    const { username, password, full_name, passport_series, passport_number, date_of_birth, place_of_birth, email } = req.body;
    
    if (!username || !password || !full_name || !passport_series || !passport_number || !date_of_birth || !email) {
        return res.json({ success: false, message: 'Заполните все поля' });
    }
    
    db.registerUser({
        username, password, full_name, passport_series, passport_number,
        date_of_birth, place_of_birth, email
    }, (err, userId) => {
        if (err) {
            if (err.message && err.message.includes('UNIQUE')) {
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
        
        req.session.userId = user.id;
        
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                is_admin: user.is_admin === 1
            }
        });
    });
});

// Выход
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Получить данные пользователя
app.get('/api/user', (req, res) => {
    if (!req.session.userId) {
        return res.json({ success: false });
    }
    
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
                balance: user.balance,
                passport_series: user.passport_series,
                passport_number: user.passport_number,
                date_of_birth: user.date_of_birth,
                place_of_birth: user.place_of_birth,
                email: user.email,
                created_at: user.created_at
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});
