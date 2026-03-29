const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./bank.db');

db.serialize(() => {
    // Пользователи
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            passport_series TEXT NOT NULL,
            passport_number TEXT NOT NULL,
            date_of_birth TEXT NOT NULL,
            place_of_birth TEXT NOT NULL,
            email TEXT NOT NULL,
            balance REAL DEFAULT 0.00,
            is_admin INTEGER DEFAULT 0,
            is_frozen INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Карты
    db.run(`
        CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            card_number TEXT UNIQUE NOT NULL,
            card_holder TEXT NOT NULL,
            expiry_date TEXT NOT NULL,
            cvv TEXT NOT NULL,
            is_blocked INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    
    // Кредитные заявки
    db.run(`
        CREATE TABLE IF NOT EXISTS loan_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            purpose TEXT,
            status TEXT DEFAULT 'pending',
            admin_comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            processed_at DATETIME,
            processed_by INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    
    // Активные кредиты
    db.run(`
        CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            debt_amount REAL NOT NULL,
            interest_rate REAL DEFAULT 0.1,
            monthly_payment REAL,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES loan_applications(id)
        )
    `);
    
    // Транзакции
    db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_user_id INTEGER NOT NULL,
            to_user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'completed',
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id)
        )
    `);
    
    // Заявки на отмену транзакций
    db.run(`
        CREATE TABLE IF NOT EXISTS cancellation_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            admin_comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            processed_at DATETIME,
            processed_by INTEGER,
            FOREIGN KEY (transaction_id) REFERENCES transactions(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    
    // История получателей
    db.run(`
        CREATE TABLE IF NOT EXISTS frequent_recipients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            recipient_id INTEGER NOT NULL,
            times_used INTEGER DEFAULT 1,
            last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, recipient_id)
        )
    `);
    
    // Создаем администратора
    db.get("SELECT COUNT(*) as count FROM users WHERE is_admin = 1", (err, row) => {
        if (row && row.count === 0) {
            const salt = bcrypt.genSaltSync(10);
            db.run(`
                INSERT INTO users (username, password, full_name, passport_series, passport_number,
                    date_of_birth, place_of_birth, email, balance, is_admin)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'admin', bcrypt.hashSync('Admin123', salt), 'Администратор',
                '0001', '00000001', '1990-01-01', 'Столица',
                'admin@bank.gov', 0, 1
            ]);
        }
    });
});

const dbFunctions = {
    registerUser: (data, callback) => {
        const { username, password, full_name, passport_series, passport_number,
                date_of_birth, place_of_birth, email } = data;
        
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);
        
        db.run(`
            INSERT INTO users (username, password, full_name, passport_series, passport_number,
                date_of_birth, place_of_birth, email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [username, hashedPassword, full_name, passport_series, passport_number,
            date_of_birth, place_of_birth, email], function(err) {
            callback(err, this?.lastID);
        });
    },
    
    createInitialCard: (userId, fullName, callback) => {
        const generateCardNumber = () => {
            const part1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const part2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const part3 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
            return `${part1}-${part2}-${part3}`;
        };
        
        const generateCVV = () => Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const expiryDate = () => {
            const date = new Date();
            const year = date.getFullYear() + 3;
            return `12/${year.toString().slice(-2)}`;
        };
        
        db.run(`
            INSERT INTO cards (user_id, card_number, card_holder, expiry_date, cvv)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, generateCardNumber(), fullName.toUpperCase(), expiryDate(), generateCVV()], callback);
    },
    
    getUserById: (id, callback) => {
        db.get(`
            SELECT id, username, full_name, passport_series, passport_number,
                   date_of_birth, place_of_birth, email, balance, is_admin, is_frozen, created_at
            FROM users WHERE id = ?
        `, [id], callback);
    },
    
    getUserByUsername: (username, callback) => {
        db.get("SELECT * FROM users WHERE username = ?", [username], callback);
    },
    
    getUserCards: (userId, callback) => {
        db.all("SELECT * FROM cards WHERE user_id = ? ORDER BY created_at DESC", [userId], callback);
    },
    
    getCardById: (cardId, userId, callback) => {
        db.get("SELECT * FROM cards WHERE id = ? AND user_id = ?", [cardId, userId], callback);
    },
    
    canCreateCard: (userId, callback) => {
        db.get("SELECT COUNT(*) as count FROM cards WHERE user_id = ?", [userId], (err, result) => {
            callback(err, result ? result.count < 4 : true);
        });
    },
    
    createCard: (userId, fullName, callback) => {
        const generateCardNumber = () => {
            const part1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const part2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const part3 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
            return `${part1}-${part2}-${part3}`;
        };
        
        db.run(`
            INSERT INTO cards (user_id, card_number, card_holder, expiry_date, cvv)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, generateCardNumber(), fullName.toUpperCase(), '12/27', Math.floor(Math.random() * 1000).toString().padStart(3, '0')], callback);
    },
    
    toggleCardBlock: (cardId, isBlocked, callback) => {
        db.run("UPDATE cards SET is_blocked = ? WHERE id = ?", [isBlocked ? 1 : 0, cardId], callback);
    },
    
    getUsersForTransfer: (userId, callback) => {
        db.all(`
            SELECT DISTINCT u.id, u.username, u.full_name
            FROM users u
            INNER JOIN frequent_recipients fr ON u.id = fr.recipient_id
            WHERE fr.user_id = ? AND u.id != ? AND u.is_frozen = 0
            ORDER BY fr.last_used DESC
        `, [userId, userId], callback);
    },
    
    addFrequentRecipient: (userId, recipientId) => {
        db.run(`
            INSERT INTO frequent_recipients (user_id, recipient_id, times_used, last_used)
            VALUES (?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, recipient_id) DO UPDATE SET
                times_used = times_used + 1,
                last_used = CURRENT_TIMESTAMP
        `, [userId, recipientId]);
    },
    
    transfer: (fromUserId, toUserId, amount, description, callback) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            db.get("SELECT balance, is_frozen FROM users WHERE id = ?", [fromUserId], (err, fromUser) => {
                if (fromUser.is_frozen === 1) {
                    db.run("ROLLBACK");
                    callback(new Error("Ваш аккаунт заморожен"));
                    return;
                }
                
                if (fromUser.balance < amount) {
                    db.run("ROLLBACK");
                    callback(new Error("Недостаточно средств"));
                    return;
                }
                
                db.run("UPDATE users SET balance = balance - ? WHERE id = ?", [amount, fromUserId]);
                db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, toUserId]);
                db.run(`
                    INSERT INTO transactions (from_user_id, to_user_id, amount, description)
                    VALUES (?, ?, ?, ?)
                `, [fromUserId, toUserId, amount, description], function(err) {
                    if (err) {
                        db.run("ROLLBACK");
                        callback(err);
                    } else {
                        db.run("COMMIT");
                        dbFunctions.addFrequentRecipient(fromUserId, toUserId);
                        callback(null, { success: true, transactionId: this.lastID });
                    }
                });
            });
        });
    },
    
    getUserTransactions: (userId, limit, callback) => {
        db.all(`
            SELECT t.*, u1.full_name as from_name, u2.full_name as to_name,
                   cr.status as cancellation_status
            FROM transactions t
            LEFT JOIN users u1 ON t.from_user_id = u1.id
            LEFT JOIN users u2 ON t.to_user_id = u2.id
            LEFT JOIN cancellation_requests cr ON t.id = cr.transaction_id AND cr.user_id = ?
            WHERE t.from_user_id = ? OR t.to_user_id = ?
            ORDER BY t.created_at DESC LIMIT ?
        `, [userId, userId, userId, limit], callback);
    },
    
    createCancellationRequest: (userId, transactionId, reason, callback) => {
        db.get("SELECT * FROM transactions WHERE id = ? AND from_user_id = ?", [transactionId, userId], (err, transaction) => {
            if (!transaction) {
                callback(new Error("Транзакция не найдена"));
                return;
            }
            
            db.get("SELECT * FROM cancellation_requests WHERE transaction_id = ? AND status = 'pending'", [transactionId], (err, existing) => {
                if (existing) {
                    callback(new Error("Заявка на отмену уже существует"));
                    return;
                }
                
                db.run(`
                    INSERT INTO cancellation_requests (transaction_id, user_id, reason)
                    VALUES (?, ?, ?)
                `, [transactionId, userId, reason], function(err) {
                    callback(err, this?.lastID);
                });
            });
        });
    },
    
    getPendingCancellationRequests: (callback) => {
        db.all(`
            SELECT cr.*, t.amount, t.created_at as transaction_date,
                   u1.full_name as from_name, u2.full_name as to_name
            FROM cancellation_requests cr
            JOIN transactions t ON cr.transaction_id = t.id
            JOIN users u1 ON t.from_user_id = u1.id
            JOIN users u2 ON t.to_user_id = u2.id
            WHERE cr.status = 'pending'
            ORDER BY cr.created_at ASC
        `, callback);
    },
    
    approveCancellation: (requestId, adminId, callback) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            db.get("SELECT * FROM cancellation_requests WHERE id = ? AND status = 'pending'", [requestId], (err, request) => {
                if (!request) {
                    db.run("ROLLBACK");
                    callback(new Error("Заявка не найдена"));
                    return;
                }
                
                db.get("SELECT * FROM transactions WHERE id = ?", [request.transaction_id], (err, transaction) => {
                    if (!transaction) {
                        db.run("ROLLBACK");
                        callback(new Error("Транзакция не найдена"));
                        return;
                    }
                    
                    db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [transaction.amount, transaction.from_user_id]);
                    db.run("UPDATE users SET balance = balance - ? WHERE id = ?", [transaction.amount, transaction.to_user_id]);
                    db.run("UPDATE transactions SET status = 'cancelled' WHERE id = ?", [transaction.id]);
                    db.run(`
                        UPDATE cancellation_requests SET status = 'approved', processed_at = CURRENT_TIMESTAMP, processed_by = ?
                        WHERE id = ?
                    `, [adminId, requestId]);
                    
                    db.run("COMMIT");
                    callback(null, { success: true });
                });
            });
        });
    },
    
    rejectCancellation: (requestId, adminId, comment, callback) => {
        db.run(`
            UPDATE cancellation_requests SET status = 'rejected', admin_comment = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
            WHERE id = ? AND status = 'pending'
        `, [comment, adminId, requestId], callback);
    },
    
    createLoanApplication: (userId, amount, purpose, callback) => {
        db.run(`
            INSERT INTO loan_applications (user_id, amount, purpose)
            VALUES (?, ?, ?)
        `, [userId, amount, purpose], callback);
    },
    
    getPendingLoanApplications: (callback) => {
        db.all(`
            SELECT la.*, u.full_name, u.username
            FROM loan_applications la
            LEFT JOIN users u ON la.user_id = u.id
            WHERE la.status = 'pending'
            ORDER BY la.created_at ASC
        `, callback);
    },
    
    approveLoan: (applicationId, adminId, callback) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            db.get("SELECT * FROM loan_applications WHERE id = ? AND status = 'pending'", [applicationId], (err, app) => {
                if (!app) {
                    db.run("ROLLBACK");
                    callback(new Error("Заявка не найдена"));
                    return;
                }
                
                const debtAmount = app.amount * 1.1;
                const monthlyPayment = debtAmount / 12;
                
                db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [app.amount, app.user_id]);
                db.run(`
                    INSERT INTO loans (application_id, user_id, amount, debt_amount, monthly_payment)
                    VALUES (?, ?, ?, ?, ?)
                `, [applicationId, app.user_id, app.amount, debtAmount, monthlyPayment]);
                
                db.run(`
                    UPDATE loan_applications SET status = 'approved', processed_at = CURRENT_TIMESTAMP, processed_by = ?
                    WHERE id = ?
                `, [adminId, applicationId]);
                
                db.run("COMMIT");
                callback(null, { success: true });
            });
        });
    },
    
    rejectLoan: (applicationId, adminId, comment, callback) => {
        db.run(`
            UPDATE loan_applications SET status = 'rejected', admin_comment = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
            WHERE id = ? AND status = 'pending'
        `, [comment, adminId, applicationId], callback);
    },
    
    getActiveLoan: (userId, callback) => {
        db.get(`
            SELECT * FROM loans WHERE user_id = ? AND is_active = 1
        `, [userId], callback);
    },
    
    repayLoan: (userId, callback) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            db.get("SELECT * FROM loans WHERE user_id = ? AND is_active = 1", [userId], (err, loan) => {
                if (!loan) {
                    db.run("ROLLBACK");
                    callback(new Error("Нет активного кредита"));
                    return;
                }
                
                db.get("SELECT balance FROM users WHERE id = ? AND balance >= ?", [userId, loan.debt_amount], (err, user) => {
                    if (!user) {
                        db.run("ROLLBACK");
                        callback(new Error("Недостаточно средств"));
                        return;
                    }
                    
                    db.run("UPDATE users SET balance = balance - ? WHERE id = ?", [loan.debt_amount, userId]);
                    db.run("UPDATE loans SET is_active = 0 WHERE id = ?", [loan.id]);
                    
                    db.run("COMMIT");
                    callback(null, { success: true });
                });
            });
        });
    },
    
    toggleUserFreeze: (userId, freeze, callback) => {
        db.run("UPDATE users SET is_frozen = ? WHERE id = ?", [freeze ? 1 : 0, userId], callback);
    },
    
    adminAddMoney: (adminId, userId, amount, callback) => {
        db.get("SELECT is_admin FROM users WHERE id = ?", [adminId], (err, admin) => {
            if (!admin || !admin.is_admin) {
                callback(new Error("Доступ запрещен"));
                return;
            }
            
            db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, userId], callback);
        });
    },
    
    getAllUsers: (callback) => {
        db.all("SELECT id, username, full_name, balance, is_frozen, created_at FROM users", callback);
    }
};

module.exports = dbFunctions;