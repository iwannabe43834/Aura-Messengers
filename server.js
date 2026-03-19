const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    maxHttpBufferSize: 5e7 
});

// --- Настройка Telegram Бота ---
const tgToken = '8666406149:AAHJA4-jhQTk2GDfvwfJdtWJejGfpwHvUEs';
const tgBot = new TelegramBot(tgToken, { 
    polling: true 
});

// Игнорируем ошибку 409
tgBot.on('polling_error', (error) => {
    if (error.code !== 'ETELEGRAM' || !error.message.includes('409 Conflict')) {
        console.error('Telegram Polling Error:', error.message);
    }
});

tgBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';

    if (text.startsWith('/start ')) {
        const token = text.split(' ')[1];
        
        const row = await db.get('SELECT * FROM temp_tg_binds WHERE token = ?', [token]);
        
        if (row) {
            await db.run('UPDATE temp_tg_binds SET chatId = ?, bound = 1 WHERE token = ?', [chatId, token]);
            tgBot.sendMessage(chatId, "✅ Telegram успешно привязан к Aura Messenger! Возвращайтесь на сайт.");
        } else {
            tgBot.sendMessage(chatId, "❌ Ссылка устарела или недействительна. Попробуйте нажать кнопку привязки на сайте еще раз.");
        }
    } else if (text === '/start') {
        tgBot.sendMessage(chatId, "👋 Привет! Для привязки аккаунта используйте специальную кнопку на сайте Aura Messenger.");
    }
});

// --- HTML Шаблон для письма ---
function getEmailTemplate(code) { 
    return ` 
    <div style="font-family: -apple-system, sans-serif; background-color: #f0f2f5; padding: 40px 20px; text-align: center;"> 
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin: 0 auto;"> 
            <tr> 
                <td style="background-color: #2AABEE; padding: 25px; text-align: center;"> 
                    <h1 style="margin: 0; font-size: 26px; color: #ffffff;">Aura Messenger</h1> 
                </td> 
            </tr> 
            <tr> 
                <td style="padding: 40px 30px; text-align: center; color: #333333;"> 
                    <p style="font-size: 18px; margin: 0 0 20px 0;">Здравствуйте!</p> 
                    <p style="font-size: 15px; margin: 0 0 30px 0;">Ваш код для входа в Aura Messenger:</p> 
                    <div style="display: inline-block; background-color: #f4f8fb; border: 1px solid #e1eef7; border-radius: 10px; padding: 15px 30px; margin-bottom: 30px;"> 
                        <span style="font-size: 36px; font-weight: bold; color: #2AABEE; letter-spacing: 8px;">${code}</span> 
                    </div> 
                </td> 
            </tr> 
        </table> 
    </div> `; 
}

const verificationCodes = {};

// --- Настройки сервера ---
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Сессии храним в памяти
app.use(session({
    secret: 'aura-secret-key-2026-pro',
    resave: true,
    saveUninitialized: true,
    cookie: { 
        maxAge: 7 * 24 * 60 * 60 * 1000, 
        secure: false 
    }
}));

const USERS_FILE = path.join(__dirname, 'users.json');
const GROUPS_FILE = path.join(__dirname, 'groups.json');

// --- ОПТИМИЗАЦИЯ ДЛЯ RENDER (КЭШИРОВАНИЕ В ПАМЯТЬ) ---
let usersCache = {};
let groupsCache = {};

function initFiles() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify({}));
    }
    if (!fs.existsSync(GROUPS_FILE)) {
        fs.writeFileSync(GROUPS_FILE, JSON.stringify({}));
    }
    
    try {
        usersCache = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        usersCache = {};
    }
    
    try {
        groupsCache = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
    } catch (e) {
        groupsCache = {};
    }
}

// Асинхронное сохранение для предотвращения зависаний
function saveUsers() {
    fs.writeFile(USERS_FILE, JSON.stringify(usersCache, null, 2), (err) => {
        if (err) console.error("Ошибка сохранения пользователей:", err);
    });
}

function saveGroups() {
    fs.writeFile(GROUPS_FILE, JSON.stringify(groupsCache, null, 2), (err) => {
        if (err) console.error("Ошибка сохранения групп:", err);
    });
}

let db;
async function initDB() {
    initFiles();
    db = await open({
        filename: 'aura_database.db',
        driver: sqlite3.Database
    });
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            fromUser TEXT,
            toUser TEXT,
            text TEXT,
            mediaType TEXT,
            mediaData TEXT,
            mediaName TEXT,
            replyData TEXT,
            time TEXT,
            isRead INTEGER DEFAULT 0,
            isEdited INTEGER DEFAULT 0,
            isPinned INTEGER DEFAULT 0,
            reactions TEXT,
            deletedFor TEXT,
            views TEXT DEFAULT '[]',
            isChannelPost INTEGER DEFAULT 0,
            isSystem INTEGER DEFAULT 0
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS temp_tg_binds (
            token TEXT PRIMARY KEY,
            chatId INTEGER,
            bound INTEGER DEFAULT 0,
            createdAt INTEGER
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS stories (
            id TEXT PRIMARY KEY,
            username TEXT,
            mediaData TEXT,
            mediaType TEXT,
            createdAt INTEGER,
            expiresAt INTEGER,
            views TEXT DEFAULT '[]',
            reactions TEXT DEFAULT '{}'
        )
    `);

    try { await db.exec(`ALTER TABLE stories ADD COLUMN views TEXT DEFAULT '[]'`); } catch(e){}
    try { await db.exec(`ALTER TABLE stories ADD COLUMN reactions TEXT DEFAULT '{}'`); } catch(e){}
    try { await db.exec(`ALTER TABLE messages ADD COLUMN views TEXT DEFAULT '[]'`); } catch(e){}
    try { await db.exec(`ALTER TABLE messages ADD COLUMN isChannelPost INTEGER DEFAULT 0`); } catch(e){}
    try { await db.exec(`ALTER TABLE messages ADD COLUMN isSystem INTEGER DEFAULT 0`); } catch(e){}

    console.log("✅ База данных SQLite и Кэш памяти успешно инициализированы!");
}
initDB();

// --- API ДЛЯ ПРИВЯЗКИ TELEGRAM ---
app.get('/api/generate-tg-token', async (req, res) => {
    const token = 'bind_' + Math.random().toString(36).substr(2, 9);
    await db.run('INSERT INTO temp_tg_binds (token, createdAt) VALUES (?, ?)', [token, Date.now()]);
    res.json({ token });
});

app.get('/api/check-tg-token', async (req, res) => {
    const token = req.query.token;
    const row = await db.get('SELECT * FROM temp_tg_binds WHERE token = ?', [token]);

    if (row && row.bound === 1) {
        const chatId = row.chatId;
        await db.run('DELETE FROM temp_tg_binds WHERE token = ?', [token]);
        res.json({ bound: true, chatId });
    } else {
        res.json({ bound: false });
    }
});

// --- МАРШРУТЫ ДЛЯ АВТОРИЗАЦИИ ---
app.post('/api/check-user', (req, res) => {
    const { loginId } = req.body;
    let targetUsername = null;
    let targetUser = null;

    for (const uname in usersCache) {
        if (uname.toLowerCase() === loginId.toLowerCase() || 
           (usersCache[uname].email && usersCache[uname].email.toLowerCase() === loginId.toLowerCase())) {
            targetUsername = uname;
            targetUser = usersCache[uname];
            break;
        }
    }

    if (targetUser) {
        res.json({ 
            exists: true, 
            username: targetUsername, 
            hasEmail: !!targetUser.email, 
            hasTelegram: !!targetUser.telegram 
        });
    } else {
        res.json({ exists: false });
    }
});

app.post('/api/send-auth-code', async (req, res) => {
    const { username, method, isReset } = req.body;
    const user = usersCache[username];
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    verificationCodes[username] = { code, timestamp: Date.now() };

    if (method === 'telegram' && user.telegram) {
        const chatId = user.telegram;
        const text = isReset ? `🔐 Код для сброса пароля Aura: *${code}*` : `🔑 Ваш код для входа в Aura: *${code}*`;
        try {
            await tgBot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
            return res.json({ success: true, message: 'Код отправлен в Telegram' });
        } catch (err) {
            return res.status(500).json({ error: 'Ошибка отправки в Telegram' });
        }
    } else if (method === 'email' && user.email) {
        try {
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: { 
                    'accept': 'application/json', 
                    'api-key': process.env.BREVO_API_KEY || '', 
                    'content-type': 'application/json' 
                },
                body: JSON.stringify({
                    sender: { name: "Aura Messenger", email: "auramessengercode@gmail.com" },
                    to: [{ email: user.email }],
                    subject: isReset ? "Сброс пароля Aura Messenger" : "Код подтверждения Aura Messenger",
                    htmlContent: getEmailTemplate(code), 
                    textContent: `Здравствуйте! Ваш код: ${code}`
                })
            });

            if (response.ok) {
                res.status(200).json({ success: true, message: 'Код отправлен на E-mail' });
            } else {
                res.status(200).json({ success: true, message: 'Режим отладки: письмо не ушло' });
            }
        } catch (error) { 
            res.status(200).json({ success: true, message: 'Режим отладки: ошибка сети' }); 
        }
    } else {
        res.status(400).json({ error: 'Неверный метод или контакт не привязан' });
    }
});

app.post('/api/verify-code', (req, res) => {
    const { username, code } = req.body;
    const pending = verificationCodes[username];
    
    if (!pending || pending.code !== code) {
        return res.status(400).json({ error: 'Неверный или просроченный код' });
    }
    
    delete verificationCodes[username];
    const user = usersCache[username];

    if (user) { 
        req.session.username = username; 
        req.session.save(() => {
            res.json({ isNewUser: false, user: { username, ...user } }); 
        });
    } else { 
        res.json({ isNewUser: true }); 
    }
});

app.post('/api/login-password', async (req, res) => {
    const { loginId, password } = req.body;
    let username = null;
    let user = null;
    
    for (const uname in usersCache) {
        if (uname.toLowerCase() === loginId.toLowerCase() || 
           (usersCache[uname].email && usersCache[uname].email.toLowerCase() === loginId.toLowerCase())) {
            username = uname; 
            user = usersCache[uname]; 
            break;
        }
    }
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: 'Неверный логин или пароль' });
    }
    
    req.session.username = username;
    req.session.save(() => {
        res.json({ success: true, user: { username, name: user.name, avatar: user.avatar } });
    });
});

app.post('/api/register-final', async (req, res) => {
    const { fullname, username, email, telegramId, password } = req.body;
    
    if (usersCache[username]) {
        return res.status(400).json({ error: 'Этот логин уже занят' });
    }

    usersCache[username] = {
        password: await bcrypt.hash(password, 10), 
        email: email || null, 
        telegram: telegramId, 
        name: fullname, 
        avatar: null, 
        profileBg: null,         
        emojiStatus: '',         
        profileColor: '#8774e1', 
        bio: '', 
        birthday: '', 
        profilePattern: 'none',
        privacy: { calls: 'all', online: 'all', groups: 'all' },
        contacts: [], 
        blocked: [], 
        lastSeen: Date.now()
    };

    saveUsers();
    req.session.username = username;
    req.session.save(() => {
        res.json({ success: true, user: { username, name: fullname } });
    });
});

app.post('/api/reset-password', async (req, res) => {
    const { username, code, newPassword } = req.body;
    const pending = verificationCodes[username];
    
    if (!pending || pending.code !== code) {
        return res.status(400).json({ error: 'Неверный код' });
    }

    usersCache[username].password = await bcrypt.hash(newPassword, 10);
    saveUsers();
    
    delete verificationCodes[username];
    req.session.username = username;
    req.session.save(() => {
        res.json({ success: true });
    });
});

app.get('/logout', (req, res) => { 
    req.session.destroy(); 
    res.redirect('/auth.html'); 
});

app.get('/my-full-profile', (req, res) => {
    const sessionUser = req.session.username || req.headers['x-user-id'];
    if (!sessionUser) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const user = usersCache[sessionUser];
    if (!user) {
        return res.status(404).json({ error: 'Not found' });
    }
    
    const { password, ...safeUser } = user;
    res.json({ username: sessionUser, ...safeUser });
});

app.post('/update-profile', (req, res) => {
    const sessionUser = req.session.username || req.headers['x-user-id'];
    if (!sessionUser) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const user = usersCache[sessionUser];
    if (!user) {
        return res.status(404).json({ error: 'Not found' });
    }
    
    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.bio !== undefined) user.bio = req.body.bio;
    if (req.body.birthday !== undefined) user.birthday = req.body.birthday;
    if (req.body.avatar !== undefined) user.avatar = req.body.avatar;
    if (req.body.profilePattern !== undefined) user.profilePattern = req.body.profilePattern;
    if (req.body.profileBg !== undefined) user.profileBg = req.body.profileBg;
    if (req.body.emojiStatus !== undefined) user.emojiStatus = req.body.emojiStatus;
    if (req.body.profileColor !== undefined) user.profileColor = req.body.profileColor;
    if (req.body.privacy !== undefined) user.privacy = { ...user.privacy, ...req.body.privacy };
    
    saveUsers();

    const safeUser = { username: sessionUser, ...user };
    delete safeUser.password;
    io.emit('user_updated', { username: sessionUser, user: safeUser });
    
    res.json({ success: true });
});

app.get('/api/entity/:id', (req, res) => {
    const callerId = req.session.username || req.headers['x-user-id'];
    const id = req.params.id;
    const caller = usersCache[callerId];

    if (groupsCache[id]) {
        const group = groupsCache[id];
        let myRole = 'member';
        
        if (group.creator === callerId) {
            myRole = 'creator';
        } else if (group.admins && group.admins[callerId]) {
            myRole = 'admin';
        }

        return res.json({
            type: group.type || 'group',
            id: group.id, 
            name: group.name, 
            displayName: group.name,
            description: group.description, 
            avatar: group.avatar,
            profileBg: group.profileBg,
            profileColor: group.profileColor,
            emojiStatus: group.emojiStatus,
            membersCount: group.members.length,
            isCreator: group.creator === callerId,
            myRole: myRole,
            admins: group.admins || {},
            muted: group.muted || {},
            inviteHash: group.inviteHash || null,
            isOnline: false, 
            lastSeen: null, 
            membersList: group.members.map(m => ({
                username: m,
                name: usersCache[m] ? usersCache[m].name : m,
                avatar: usersCache[m] ? usersCache[m].avatar : null,
                emojiStatus: usersCache[m] ? usersCache[m].emojiStatus : '',
                role: group.creator === m ? 'creator' : (group.admins && group.admins[m] ? 'admin' : 'member'),
                customTitle: (group.admins && group.admins[m] && group.admins[m].title) ? group.admins[m].title : ''
            }))
        });
    }

    const user = usersCache[id];
    if (!user) {
        return res.status(404).json({ error: 'Not found' });
    }

    let displayName = user.name || id;
    let inContacts = false;
    let isContactForThem = false;
    
    if (caller && caller.contacts) {
        const contactObj = caller.contacts.find(c => typeof c === 'object' ? c.username === id : c === id);
        if (contactObj) {
            inContacts = true;
            if (typeof contactObj === 'object' && contactObj.customName) {
                displayName = contactObj.customName;
            }
        }
    }

    if (user.contacts) {
        isContactForThem = user.contacts.some(c => (typeof c === 'object' ? c.username : c) === callerId);
    }

    const isBlocked = caller && caller.blocked && caller.blocked.includes(id);

    let showOnline = true;
    let canCall = true;
    let canGroup = true;

    if (user.privacy) {
        if (user.privacy.online === 'nobody') {
            showOnline = false;
        } else if (user.privacy.online === 'contacts' && !isContactForThem) {
            showOnline = false;
        }

        if (user.privacy.calls === 'nobody') {
            canCall = false;
        } else if (user.privacy.calls === 'contacts' && !isContactForThem) {
            canCall = false;
        }
        
        if (user.privacy.groups === 'contacts' && !isContactForThem) {
            canGroup = false;
        }
    }

    res.json({
        type: 'user', 
        username: id, 
        name: user.name, 
        displayName: displayName,
        avatar: user.avatar, 
        profileBg: user.profileBg,
        emojiStatus: user.emojiStatus,
        profileColor: user.profileColor,
        bio: user.bio, 
        birthday: user.birthday, 
        profilePattern: user.profilePattern,
        isOnline: showOnline ? !!onlineUsers[id] : false, 
        lastSeen: showOnline ? user.lastSeen : null, 
        isBlocked: isBlocked, 
        inContacts: inContacts,
        canCall: canCall,
        canGroup: canGroup
    });
});

// --- WebSocket Логика ---
const onlineUsers = {}; 

io.on('connection', (socket) => {
    let currentUsername = null;

    socket.on('identify', (username) => {
        currentUsername = username;
        onlineUsers[username] = socket.id;
        
        if (usersCache[username]) { 
            usersCache[username].lastSeen = 'online'; 
            saveUsers();
        }
        
        const u = usersCache[username];
        for (let otherUser in onlineUsers) {
            let canSee = true;
            if (u && u.privacy) {
                if (u.privacy.online === 'nobody') {
                    canSee = false;
                } else if (u.privacy.online === 'contacts') {
                    const isContactForThem = u.contacts && u.contacts.some(c => (typeof c === 'object' ? c.username : c) === otherUser);
                    if (!isContactForThem) {
                        canSee = false;
                    }
                }
            }
            if (canSee) {
                io.to(onlineUsers[otherUser]).emit('user_status_change', { username, online: true, lastSeen: 'online' });
            }
        }
    });

    socket.on('get_my_chats', async () => {
        if (!currentUsername) return;
        const myUser = usersCache[currentUsername];
        let chats = new Set();
        
        const rows = await db.all(`SELECT fromUser, toUser FROM messages WHERE fromUser = ? OR toUser = ?`, [currentUsername, currentUsername]);
        
        rows.forEach(r => {
            if (r.fromUser === currentUsername && !groupsCache[r.toUser]) {
                chats.add(r.toUser);
            }
            if (r.toUser === currentUsername && !groupsCache[r.fromUser]) {
                chats.add(r.fromUser);
            }
        });
        
        if (myUser && myUser.contacts) {
            myUser.contacts.forEach(c => chats.add(typeof c === 'object' ? c.username : c));
        }
        
        chats.delete(currentUsername);
        let chatsArray = Array.from(chats);

        for (const groupId in groupsCache) {
            if (groupsCache[groupId].members.includes(currentUsername)) {
                chatsArray.push(groupId);
            }
        }
        
        socket.emit('my_chats_list', chatsArray);
    });

    socket.on('get_call_history', async () => {
        if (!currentUsername) return;
        const rows = await db.all(`SELECT * FROM messages WHERE (fromUser = ? OR toUser = ?) AND text LIKE '%system-call-msg%' ORDER BY id DESC LIMIT 50`, [currentUsername, currentUsername]);
        socket.emit('call_history_data', rows);
    });

    socket.on('get_history', async (data) => {
        if (!currentUsername) return;
        const chatWith = data.chatWith;
        const offset = data.offset || 0; 
        const myUser = usersCache[currentUsername];

        let historyRows = [];
        
        if (chatWith === 'me') {
            historyRows = await db.all(`SELECT * FROM messages WHERE fromUser = ? AND toUser = 'me' ORDER BY id DESC LIMIT 40 OFFSET ?`, [currentUsername, offset]);
        } else if (groupsCache[chatWith]) {
            historyRows = await db.all(`SELECT * FROM messages WHERE toUser = ? ORDER BY id DESC LIMIT 40 OFFSET ?`, [chatWith, offset]);
            if (offset === 0) {
                const pinnedRow = await db.get(`SELECT * FROM messages WHERE toUser = ? AND isPinned = 1 ORDER BY id DESC LIMIT 1`, [chatWith]);
                if (pinnedRow) {
                    socket.emit('msg_pinned', { id: pinnedRow.id, text: pinnedRow.text, chatId: chatWith });
                }
            }
        } else {
            historyRows = await db.all(`SELECT * FROM messages WHERE (fromUser = ? AND toUser = ?) OR (fromUser = ? AND toUser = ?) ORDER BY id DESC LIMIT 40 OFFSET ?`, 
                [currentUsername, chatWith, chatWith, currentUsername, offset]);
        }

        historyRows.reverse(); 

        let history = historyRows.map(r => {
            let deletedFor = r.deletedFor ? JSON.parse(r.deletedFor) : [];
            if (deletedFor.includes(currentUsername)) return null; 

            let fromDisplayName = r.fromUser;
            let emojiStatus = '';
            let isAdmin = false;
            let customTitle = '';
            
            if (usersCache[r.fromUser]) {
                emojiStatus = usersCache[r.fromUser].emojiStatus || '';
            }

            if (groupsCache[chatWith]) {
                const g = groupsCache[chatWith];
                if (g.creator === r.fromUser) {
                    isAdmin = true;
                    customTitle = 'Создатель';
                } else if (g.admins && g.admins[r.fromUser]) {
                    isAdmin = true;
                    customTitle = g.admins[r.fromUser].title || 'Админ';
                }
            }

            if (r.fromUser !== currentUsername && groupsCache[chatWith]) {
                const contactObj = myUser.contacts ? myUser.contacts.find(c => (typeof c === 'object' ? c.username : c) === r.fromUser) : null;
                if (contactObj && typeof contactObj === 'object' && contactObj.customName) {
                    fromDisplayName = contactObj.customName;
                } else if (usersCache[r.fromUser] && usersCache[r.fromUser].name) {
                    fromDisplayName = usersCache[r.fromUser].name;
                }
            }

            return {
                id: r.id, 
                from: r.fromUser, 
                to: r.toUser, 
                text: r.text, 
                time: r.time, 
                read: r.isRead === 1,
                isEdited: r.isEdited === 1,
                media: r.mediaType ? { type: r.mediaType, data: r.mediaData, name: r.mediaName } : null,
                reply: r.replyData ? JSON.parse(r.replyData) : null,
                reactions: r.reactions ? JSON.parse(r.reactions) : {},
                deletedFor: deletedFor,
                fromDisplayName: fromDisplayName,
                emojiStatus: emojiStatus,
                isChannelPost: r.isChannelPost === 1,
                isSystem: r.isSystem === 1,
                views: r.views ? JSON.parse(r.views) : [],
                isAdmin: isAdmin,
                customTitle: customTitle
            };
        }).filter(m => m !== null);

        socket.emit('chat_history', { history, offset, chatWith });
    });

    socket.on('search_chat', async (data) => {
        if (!currentUsername) return;
        let query = `%${data.query}%`;
        let historyRows = [];

        if (groupsCache[data.chatWith]) {
            historyRows = await db.all(`SELECT * FROM messages WHERE toUser = ? AND text LIKE ? ORDER BY id DESC LIMIT 100`, [data.chatWith, query]);
        } else {
            historyRows = await db.all(`SELECT * FROM messages WHERE ((fromUser = ? AND toUser = ?) OR (fromUser = ? AND toUser = ?)) AND text LIKE ? ORDER BY id DESC LIMIT 100`, 
                [currentUsername, data.chatWith, data.chatWith, currentUsername, query]);
        }
        historyRows.reverse();
        
        let history = historyRows.map(r => ({
            id: r.id, 
            from: r.fromUser, 
            to: r.toUser, 
            text: r.text, 
            time: r.time, 
            read: r.isRead === 1, 
            isEdited: r.isEdited === 1,
            isSystem: r.isSystem === 1
        }));
        
        socket.emit('chat_history', { history, offset: 0, chatWith: data.chatWith, isSearch: true });
    });

    socket.on('private_msg', async (data) => {
        if (!currentUsername) return;

        if (groupsCache[data.to]) {
            const g = groupsCache[data.to];
            if (g.muted && g.muted[currentUsername]) {
                if (Date.now() < g.muted[currentUsername]) {
                    socket.emit('error_msg', 'Вы временно заглушены в этом чате модератором.');
                    return;
                } else {
                    delete g.muted[currentUsername];
                    saveGroups();
                }
            }
            
            if (g.type === 'channel' && g.creator !== currentUsername) {
                if (!g.admins || !g.admins[currentUsername]) {
                    socket.emit('error_msg', 'В канал могут писать только администраторы.');
                    return; 
                }
            }
        }

        const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        
        let isChannelPost = false;
        let customTitle = '';
        let isAdmin = false;
        
        if (groupsCache[data.to]) {
            const g = groupsCache[data.to];
            if (g.type === 'channel') {
                isChannelPost = true;
            }
            if (g.creator === currentUsername) {
                isAdmin = true;
                customTitle = 'Создатель';
            } else if (g.admins && g.admins[currentUsername]) {
                isAdmin = true;
                customTitle = g.admins[currentUsername].title || 'Админ';
            }
        }

        const msg = {
            id: msgId,
            from: currentUsername,
            to: data.to,
            text: data.text || '',
            media: data.media || null,
            reply: data.reply || null,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: false, 
            reactions: {}, 
            isEdited: false, 
            deletedFor: [],
            isChannelPost: isChannelPost,
            isSystem: false,
            views: isChannelPost ? [currentUsername] : [],
            isAdmin: isAdmin,
            customTitle: customTitle
        };

        let mediaType = msg.media ? msg.media.type : null;
        let mediaData = msg.media ? msg.media.data : null;
        let mediaName = msg.media ? msg.media.name : null;

        await db.run(`INSERT INTO messages 
            (id, fromUser, toUser, text, mediaType, mediaData, mediaName, replyData, time, isRead, isEdited, isPinned, reactions, deletedFor, views, isChannelPost, isSystem) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, '{}', '[]', ?, ?, 0)`,
            [
                msg.id, msg.from, msg.to, msg.text,
                mediaType, mediaData, mediaName,
                msg.reply ? JSON.stringify(msg.reply) : null,
                msg.time,
                JSON.stringify(msg.views),
                isChannelPost ? 1 : 0
            ]
        );

        const myUser = usersCache[currentUsername];
        msg.emojiStatus = myUser.emojiStatus || '';

        if (groupsCache[data.to]) {
            groupsCache[data.to].members.forEach(memberUsername => {
                if (memberUsername === currentUsername) {
                    socket.emit('msg_receive', msg);
                } else if (onlineUsers[memberUsername]) {
                    const memberUser = usersCache[memberUsername];
                    let fromDisplayName = currentUsername;
                    
                    if (memberUser && memberUser.contacts) {
                        const contactObj = memberUser.contacts.find(c => (typeof c === 'object' ? c.username : c) === currentUsername);
                        if (contactObj && typeof contactObj === 'object' && contactObj.customName) {
                            fromDisplayName = contactObj.customName;
                        } else if (myUser && myUser.name) {
                            fromDisplayName = myUser.name;
                        }
                    }
                    io.to(onlineUsers[memberUsername]).emit('msg_receive', { ...msg, fromDisplayName });
                }
            });
        } else {
            socket.emit('msg_receive', msg);
            if (data.to !== 'me' && data.to !== currentUsername && onlineUsers[data.to]) {
                const recipient = usersCache[data.to];
                if (!(recipient && recipient.blocked && recipient.blocked.includes(currentUsername))) {
                    io.to(onlineUsers[data.to]).emit('msg_receive', msg);
                }
            }
        }
    });

    socket.on('view_channel_msg', async (data) => {
        if (!currentUsername) return;
        const msg = await db.get('SELECT views FROM messages WHERE id = ? AND isChannelPost = 1', [data.id]);
        if (msg) {
            let views = JSON.parse(msg.views || '[]');
            if (!views.includes(currentUsername)) {
                views.push(currentUsername);
                await db.run('UPDATE messages SET views = ? WHERE id = ?', [JSON.stringify(views), data.id]);
                io.emit('msg_views_update', { id: data.id, views: views.length });
            }
        }
    });

    socket.on('edit_msg', async (data) => {
        if (!currentUsername) return;
        await db.run(`UPDATE messages SET text = ?, isEdited = 1 WHERE id = ? AND fromUser = ?`, [data.text, data.id, currentUsername]);
        io.emit('msg_edited', { id: data.id, text: data.text });
    });

    socket.on('pin_msg', async (data) => {
        if (!currentUsername) return;
        
        if (groupsCache[data.chatId]) {
            const g = groupsCache[data.chatId];
            if (g.creator !== currentUsername && (!g.admins || !g.admins[currentUsername])) {
                socket.emit('error_msg', 'Только администраторы могут закреплять сообщения');
                return;
            }
        }

        await db.run(`UPDATE messages SET isPinned = 0 WHERE toUser = ?`, [data.chatId]);
        await db.run(`UPDATE messages SET isPinned = 1 WHERE id = ?`, [data.id]);
        io.emit('msg_pinned', { id: data.id, text: data.text, chatId: data.chatId });

        const sysMsgId = 'sys_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        await db.run(`INSERT INTO messages (id, fromUser, toUser, text, time, isSystem, isChannelPost) VALUES (?, ?, ?, ?, ?, 1, 0)`, [sysMsgId, currentUsername, data.chatId, 'закрепил(а) сообщение', timeStr]);
        io.emit('msg_receive', { id: sysMsgId, from: currentUsername, to: data.chatId, text: 'закрепил(а) сообщение', time: timeStr, isSystem: true, isChannelPost: false });
    });

    socket.on('mark_read', async (data) => {
        if (!currentUsername) return;
        
        if (groupsCache[data.chatWith]) {
            await db.run(`UPDATE messages SET isRead = 1 WHERE toUser = ? AND fromUser != ? AND isRead = 0`, [data.chatWith, currentUsername]);
        } else {
            const rows = await db.all(`SELECT fromUser FROM messages WHERE fromUser = ? AND toUser = ? AND isRead = 0`, [data.chatWith, currentUsername]);
            if (rows.length > 0) {
                await db.run(`UPDATE messages SET isRead = 1 WHERE fromUser = ? AND toUser = ?`, [data.chatWith, currentUsername]);
                if (onlineUsers[data.chatWith]) {
                    io.to(onlineUsers[data.chatWith]).emit('messages_read', { by: currentUsername });
                }
            }
        }
    });

    socket.on('typing', (data) => {
        if (groupsCache[data.to] && groupsCache[data.to].type !== 'channel') {
            groupsCache[data.to].members.forEach(member => {
                if (member !== currentUsername && onlineUsers[member]) {
                    io.to(onlineUsers[member]).emit('user_typing', { from: currentUsername, to: data.to });
                }
            });
        } else if (onlineUsers[data.to] && !groupsCache[data.to]) {
            io.to(onlineUsers[data.to]).emit('user_typing', { from: currentUsername, to: currentUsername });
        }
    });

    socket.on('stop_typing', (data) => {
        if (groupsCache[data.to] && groupsCache[data.to].type !== 'channel') {
            groupsCache[data.to].members.forEach(member => {
                if (member !== currentUsername && onlineUsers[member]) {
                    io.to(onlineUsers[member]).emit('user_stop_typing', { from: currentUsername, to: data.to });
                }
            });
        } else if (onlineUsers[data.to] && !groupsCache[data.to]) {
            io.to(onlineUsers[data.to]).emit('user_stop_typing', { from: currentUsername, to: currentUsername });
        }
    });

    // --- ЛОГИКА ИСТОРИЙ (STORIES) ---
    socket.on('upload_story', async (data) => {
        if (!currentUsername) return;
        const id = Date.now().toString();
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; 
        
        await db.run('INSERT INTO stories (id, username, mediaData, mediaType, createdAt, expiresAt, views, reactions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
            [id, currentUsername, data.mediaData, data.mediaType, Date.now(), expiresAt, '[]', '{}']);
        
        const storyObj = { 
            id: id, 
            username: currentUsername, 
            media: data.mediaData, 
            type: data.mediaType,
            userAvatar: usersCache[currentUsername] ? usersCache[currentUsername].avatar : null,
            profileColor: usersCache[currentUsername] ? usersCache[currentUsername].profileColor : 'var(--primary)',
            views: [],
            reactions: {}
        };

        socket.emit('new_story', storyObj);

        for (let otherUser in onlineUsers) {
            if (otherUser === currentUsername) continue;
            
            const otherU = usersCache[otherUser];
            let canSee = false;
            
            if (otherU && otherU.contacts && otherU.contacts.some(c => (typeof c === 'object' ? c.username : c) === currentUsername)) {
                canSee = true;
            } else {
                const hasChat = await db.get(`SELECT id FROM messages WHERE (fromUser=? AND toUser=?) OR (fromUser=? AND toUser=?) LIMIT 1`, [currentUsername, otherUser, otherUser, currentUsername]);
                if (hasChat) {
                    canSee = true;
                }
            }
            
            if (canSee) {
                io.to(onlineUsers[otherUser]).emit('new_story', storyObj);
            }
        }
    });

    socket.on('get_stories', async () => {
        if (!currentUsername) return;
        
        await db.run('DELETE FROM stories WHERE expiresAt < ?', [Date.now()]);
        
        const myUser = usersCache[currentUsername];
        
        let allowedAuthors = new Set();
        allowedAuthors.add(currentUsername); 
        
        if (myUser && myUser.contacts) {
            myUser.contacts.forEach(c => allowedAuthors.add(typeof c === 'object' ? c.username : c));
        }
        
        const chatRows = await db.all(`SELECT fromUser, toUser FROM messages WHERE fromUser = ? OR toUser = ?`, [currentUsername, currentUsername]);
        chatRows.forEach(r => {
            if (r.fromUser !== currentUsername) allowedAuthors.add(r.fromUser);
            if (r.toUser !== currentUsername) allowedAuthors.add(r.toUser);
        });

        const stories = await db.all('SELECT * FROM stories ORDER BY createdAt ASC');
        
        const enrichedStories = stories
            .filter(s => allowedAuthors.has(s.username))
            .map(s => ({
                ...s,
                media: s.mediaData, 
                type: s.mediaType, 
                views: s.views ? JSON.parse(s.views) : [],
                reactions: s.reactions ? JSON.parse(s.reactions) : {},
                userAvatar: usersCache[s.username] ? usersCache[s.username].avatar : null,
                emojiStatus: usersCache[s.username] ? usersCache[s.username].emojiStatus : '',
                profileColor: usersCache[s.username] ? usersCache[s.username].profileColor : 'var(--primary)'
            }));
        
        socket.emit('stories_data', enrichedStories);
    });

    socket.on('view_story', async (data) => {
        if (!currentUsername) return;
        const story = await db.get('SELECT views, username FROM stories WHERE id = ?', [data.id]);
        if (story) {
            let views = JSON.parse(story.views || '[]');
            if (!views.includes(currentUsername)) {
                views.push(currentUsername);
                await db.run('UPDATE stories SET views = ? WHERE id = ?', [JSON.stringify(views), data.id]);
                if (onlineUsers[story.username]) {
                    io.to(onlineUsers[story.username]).emit('story_viewed', { id: data.id, viewer: currentUsername });
                }
            }
        }
    });

    socket.on('react_story', async (data) => {
        if (!currentUsername) return;
        const story = await db.get('SELECT reactions, username FROM stories WHERE id = ?', [data.id]);
        if (story) {
            let reactions = JSON.parse(story.reactions || '{}');
            reactions[currentUsername] = data.emoji;
            await db.run('UPDATE stories SET reactions = ? WHERE id = ?', [JSON.stringify(reactions), data.id]);
            
            if (onlineUsers[story.username]) {
                io.to(onlineUsers[story.username]).emit('story_reaction_received', { id: data.id, from: currentUsername, emoji: data.emoji });
            }
        }
    });

    socket.on('delete_story', async (data) => {
        if (!currentUsername) return;
        await db.run('DELETE FROM stories WHERE id = ? AND username = ?', [data.id, currentUsername]);
        io.emit('story_deleted', { id: data.id });
    });

    socket.on('toggle_contact', (data) => {
        if (!currentUsername) return;
        if (!usersCache[currentUsername].contacts) {
            usersCache[currentUsername].contacts = [];
        }
        let contacts = usersCache[currentUsername].contacts.filter(c => (typeof c === 'object' ? c.username : c) !== data.username);
        
        if (!data.remove) {
            contacts.push({ username: data.username, customName: data.customName || data.username });
        }
        usersCache[currentUsername].contacts = contacts;
        saveUsers();
        socket.emit('contact_toggled', { username: data.username, inContacts: !data.remove });
    });

    socket.on('toggle_block', (data) => {
        if (!currentUsername) return;
        if (!usersCache[currentUsername].blocked) {
            usersCache[currentUsername].blocked = [];
        }
        const idx = usersCache[currentUsername].blocked.indexOf(data.username);
        let isBlocked = false;
        
        if (idx === -1) { 
            usersCache[currentUsername].blocked.push(data.username); 
            isBlocked = true; 
        } else { 
            usersCache[currentUsername].blocked.splice(idx, 1); 
        }
        
        saveUsers();
        socket.emit('block_toggled', { username: data.username, isBlocked });
        
        if (onlineUsers[data.username]) {
            io.to(onlineUsers[data.username]).emit('user_status_change', { username: currentUsername, online: !isBlocked, lastSeen: isBlocked ? 'blocked' : 'online' });
        }
    });

    socket.on('update_group_info', (data) => {
        if (!currentUsername) return;
        if (groupsCache[data.id] && (groupsCache[data.id].creator === currentUsername || (groupsCache[data.id].admins && groupsCache[data.id].admins[currentUsername]))) {
            if (data.name) groupsCache[data.id].name = data.name;
            if (data.description !== undefined) groupsCache[data.id].description = data.description;
            if (data.avatar !== undefined) groupsCache[data.id].avatar = data.avatar;
            if (data.profileBg !== undefined) groupsCache[data.id].profileBg = data.profileBg;
            if (data.profileColor !== undefined) groupsCache[data.id].profileColor = data.profileColor;
            if (data.emojiStatus !== undefined) groupsCache[data.id].emojiStatus = data.emojiStatus;
            saveGroups();
            io.emit('group_updated', { groupId: data.id });
        }
    });

    // АДМИН ПАНЕЛЬ: Выдача прав
    socket.on('promote_admin', (data) => {
        if (!currentUsername) return;
        const g = groupsCache[data.groupId];
        if (g && g.creator === currentUsername) {
            if (!g.admins) {
                g.admins = {};
            }
            g.admins[data.userId] = { title: data.title || 'Админ' };
            saveGroups();
            io.emit('group_updated', { groupId: data.groupId });
        }
    });

    socket.on('demote_admin', (data) => {
        if (!currentUsername) return;
        const g = groupsCache[data.groupId];
        if (g && g.creator === currentUsername && g.admins) {
            delete g.admins[data.userId];
            saveGroups();
            io.emit('group_updated', { groupId: data.groupId });
        }
    });

    socket.on('mute_user', (data) => {
        if (!currentUsername) return;
        const g = groupsCache[data.groupId];
        if (g && (g.creator === currentUsername || (g.admins && g.admins[currentUsername]))) {
            if (g.creator === data.userId) return; // Нельзя замутить создателя
            if (!g.muted) {
                g.muted = {};
            }
            g.muted[data.userId] = Date.now() + (data.hours * 60 * 60 * 1000);
            saveGroups();
            io.emit('group_updated', { groupId: data.groupId });
        }
    });

    // ГЕНЕРАЦИЯ ИНВАЙТ ССЫЛОК
    socket.on('generate_invite_link', (data) => {
        if (!currentUsername) return;
        const g = groupsCache[data.groupId];
        if (g && (g.creator === currentUsername || (g.admins && g.admins[currentUsername]))) {
            const hash = Math.random().toString(36).substr(2, 10);
            g.inviteHash = hash;
            saveGroups();
            socket.emit('invite_link_generated', { groupId: data.groupId, hash: hash });
        }
    });

    // ВХОД ПО ИНВАЙТ ССЫЛКЕ
    socket.on('join_by_hash', async (data) => {
        if (!currentUsername) return;
        let targetGroup = null;
        
        for (let g in groupsCache) {
            if (groupsCache[g].inviteHash === data.hash) { 
                targetGroup = groupsCache[g]; 
                break; 
            }
        }
        
        if (targetGroup) {
            if (!targetGroup.members.includes(currentUsername)) {
                targetGroup.members.push(currentUsername);
                saveGroups();

                const sysMsgId = 'sys_' + Date.now() + Math.random().toString(36).substr(2, 5);
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                await db.run(`INSERT INTO messages (id, fromUser, toUser, text, time, isSystem, isChannelPost) VALUES (?, ?, ?, ?, ?, 1, 0)`, [sysMsgId, currentUsername, targetGroup.id, 'присоединился(лась) к чату по ссылке', timeStr]);
                io.emit('msg_receive', { id: sysMsgId, from: currentUsername, to: targetGroup.id, text: 'присоединился(лась) к чату по ссылке', time: timeStr, isSystem: true, isChannelPost: false });
                
                socket.emit('group_joined_success', { groupId: targetGroup.id });
                socket.emit('get_my_chats');
                io.emit('group_updated', { groupId: targetGroup.id });
            } else {
                socket.emit('group_joined_success', { groupId: targetGroup.id }); 
            }
        } else {
            socket.emit('error_msg', 'Ссылка недействительна или устарела');
        }
    });

    socket.on('create_group', async (data) => {
        if (!currentUsername) return;
        
        if (groupsCache[data.id]) { 
            socket.emit('error_msg', 'Группа с таким ID уже существует'); 
            return; 
        }

        let allowedMembers = [currentUsername];
        data.members.forEach(memberId => {
            if (memberId === currentUsername) return;
            const u = usersCache[memberId];
            
            if (u && u.privacy && u.privacy.groups === 'contacts') {
                const amIContact = u.contacts && u.contacts.some(c => (typeof c === 'object' ? c.username : c) === currentUsername);
                if (amIContact) {
                    allowedMembers.push(memberId);
                }
            } else { 
                allowedMembers.push(memberId); 
            }
        });

        let members = [...new Set(allowedMembers)].slice(0, 100);
        groupsCache[data.id] = { 
            id: data.id, 
            type: data.type || 'group', 
            name: data.name, 
            description: data.description || '', 
            avatar: data.avatar || null, 
            profileBg: data.profileBg || null,
            profileColor: data.profileColor || 'var(--primary)', 
            emojiStatus: data.emojiStatus || '', 
            creator: currentUsername, 
            members: members,
            admins: {}, 
            muted: {}
        };
        
        saveGroups();
        socket.emit('group_created', { groupId: data.id });

        const sysMsgId = 'sys_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const sysText = `создал(а) ${data.type === 'channel' ? 'канал' : 'группу'} "${data.name}"`;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        await db.run(`INSERT INTO messages (id, fromUser, toUser, text, time, isSystem, isChannelPost) VALUES (?, ?, ?, ?, ?, 1, 0)`, [sysMsgId, currentUsername, data.id, sysText, timeStr]);
        io.emit('msg_receive', { id: sysMsgId, from: currentUsername, to: data.id, text: sysText, time: timeStr, isSystem: true, isChannelPost: false });

        members.forEach(member => { 
            if (member !== currentUsername && onlineUsers[member]) {
                io.to(onlineUsers[member]).emit('search_result', { exists: true, username: data.id }); 
            }
        });
    });

    socket.on('leave_group', async (data) => {
        if (!currentUsername) return;
        if (groupsCache[data.groupId]) {
            groupsCache[data.groupId].members = groupsCache[data.groupId].members.filter(m => m !== currentUsername);
            
            const sysMsgId = 'sys_' + Date.now() + Math.random().toString(36).substr(2, 5);
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            await db.run(`INSERT INTO messages (id, fromUser, toUser, text, time, isSystem, isChannelPost) VALUES (?, ?, ?, ?, ?, 1, 0)`, [sysMsgId, currentUsername, data.groupId, 'покинул(а) чат', timeStr]);
            io.emit('msg_receive', { id: sysMsgId, from: currentUsername, to: data.groupId, text: 'покинул(а) чат', time: timeStr, isSystem: true, isChannelPost: false });

            if (groupsCache[data.groupId].members.length === 0) {
                delete groupsCache[data.groupId];
            }
            saveGroups();
            socket.emit('get_my_chats');
        }
    });

    socket.on('delete_msg', async (data) => {
        if (!currentUsername) return;
        const msg = await db.get(`SELECT * FROM messages WHERE id = ?`, [data.id]);
        
        if (msg) {
            const recipient = msg.toUser === currentUsername ? msg.fromUser : msg.toUser;
            
            // Проверка прав на удаление ЧУЖОГО сообщения в группе
            let hasAdminRights = false;
            if (groupsCache[recipient] && msg.fromUser !== currentUsername) {
                const g = groupsCache[recipient];
                if (g.creator === currentUsername || (g.admins && g.admins[currentUsername])) {
                    hasAdminRights = true;
                }
            }

            if ((data.forEveryone && msg.fromUser === currentUsername) || hasAdminRights) {
                await db.run(`DELETE FROM messages WHERE id = ?`, [data.id]);
                if (groupsCache[recipient]) { 
                    groupsCache[recipient].members.forEach(member => { 
                        if (onlineUsers[member]) {
                            io.to(onlineUsers[member]).emit('msg_deleted', { id: data.id }); 
                        }
                    }); 
                } else { 
                    socket.emit('msg_deleted', { id: data.id }); 
                    if (onlineUsers[recipient]) {
                        io.to(onlineUsers[recipient]).emit('msg_deleted', { id: data.id }); 
                    }
                }
            } else {
                let deletedFor = msg.deletedFor ? JSON.parse(msg.deletedFor) : [];
                if (!deletedFor.includes(currentUsername)) { 
                    deletedFor.push(currentUsername); 
                    await db.run(`UPDATE messages SET deletedFor = ? WHERE id = ?`, [JSON.stringify(deletedFor), data.id]); 
                }
                socket.emit('msg_deleted', { id: data.id });
            }
        }
    });

    socket.on('kick_member', async (data) => {
        if (!currentUsername) return;
        const g = groupsCache[data.groupId];
        
        if (g && (g.creator === currentUsername || (g.admins && g.admins[currentUsername]))) {
            if (g.creator === data.userId) return; // Нельзя кикнуть создателя

            g.members = g.members.filter(m => m !== data.userId);
            saveGroups();
            
            const sysMsgId = 'sys_' + Date.now() + Math.random().toString(36).substr(2, 5);
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            await db.run(`INSERT INTO messages (id, fromUser, toUser, text, time, isSystem, isChannelPost) VALUES (?, ?, ?, ?, ?, 1, 0)`, [sysMsgId, currentUsername, data.groupId, `исключил(а) пользователя @${data.userId}`, timeStr]);
            io.emit('msg_receive', { id: sysMsgId, from: currentUsername, to: data.groupId, text: `исключил(а) пользователя @${data.userId}`, time: timeStr, isSystem: true, isChannelPost: false });

            io.emit('group_updated', { groupId: data.groupId });
            if (onlineUsers[data.userId]) {
                io.to(onlineUsers[data.userId]).emit('kicked_from_group', { groupId: data.groupId });
            }
        }
    });

    socket.on('disconnect', () => {
        if (currentUsername) {
            const now = Date.now();
            let u = usersCache[currentUsername];
            
            if (u) { 
                u.lastSeen = now; 
                saveUsers(); 
            }
            
            delete onlineUsers[currentUsername];

            for (let otherUser in onlineUsers) {
                let canSee = true;
                if (u && u.privacy) {
                    if (u.privacy.online === 'nobody') {
                        canSee = false;
                    } else if (u.privacy.online === 'contacts') {
                        const isContactForThem = u.contacts && u.contacts.some(c => (typeof c === 'object' ? c.username : c) === otherUser);
                        if (!isContactForThem) {
                            canSee = false;
                        }
                    }
                }
                if (canSee) {
                    io.to(onlineUsers[otherUser]).emit('user_status_change', { username: currentUsername, online: false, lastSeen: now });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
const peerServer = ExpressPeerServer(server, { 
    debug: true, 
    path: '/' 
});
app.use('/peerjs', peerServer);

// --- ОБРАБОТКА КОРОТКИХ ССЫЛОК И ИНВАЙТОВ В САМОМ НИЗУ ---
app.get('/join/:hash', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:id', (req, res, next) => {
    const id = req.params.id;
    
    // Игнорируем системные запросы и файлы с расширениями
    const reserved = ['api', 'socket.io', 'uploads', 'peerjs', 'join', 'auth.html', 'index.html', 'manifest.json', 'style.css', 'sw.js', 'favicon.ico', 'send.mp3', 'notify.mp3'];
    
    if (id.includes('.') || reserved.includes(id)) {
        return next();
    }
    
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => { 
    console.log(`🚀 Сервер запущен на порту ${PORT}. Telegram бот и сервер звонков активны.`); 
});
