const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const SibApiV3Sdk = require('@getbrevo/brevo');
const TelegramBot = require('node-telegram-bot-api'); // Добавлено

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 5e7 
});

// --- Настройка Telegram Бота ---
const TG_TOKEN = process.env.TG_BOT_TOKEN || '8795912699:AAGNG756DWk2wDZA8fmsRlJSzGjxHvzlK0g';
const bot = new TelegramBot(TG_TOKEN, { polling: true });

// --- Настройка Brevo API ---
let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_API_KEY;

// --- HTML Шаблон для красивого письма ---
function getEmailTemplate(code) { 
    return ` 
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f0f2f5; padding: 40px 20px; text-align: center; margin: 0;"> 
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin: 0 auto;"> 
            <tr> 
                <td style="background-color: #2AABEE; padding: 25px; text-align: center;"> 
                    <h1 style="margin: 0; font-size: 26px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px;">Aura Messenger</h1> 
                </td> 
            </tr> 
            <tr> 
                <td style="padding: 40px 30px; text-align: center; color: #333333;"> 
                    <p style="font-size: 18px; margin: 0 0 20px 0; font-weight: 500;">Здравствуйте!</p> 
                    <p style="font-size: 15px; margin: 0 0 30px 0; line-height: 1.6; color: #555555;"> Вы запросили код подтверждения для доступа к вашему аккаунту. Пожалуйста, введите этот код в приложении: </p> 
                    <div style="display: inline-block; background-color: #f4f8fb; border: 1px solid #e1eef7; border-radius: 10px; padding: 15px 30px; margin-bottom: 30px;"> 
                        <span style="font-size: 36px; font-weight: bold; color: #2AABEE; letter-spacing: 8px;">${code}</span> 
                    </div> 
                    <p style="font-size: 13px; color: #999999; margin: 0; line-height: 1.5;"> Если вы не пытались войти в Aura Messenger, просто проигнорируйте и удалите это письмо. </p> 
                </td> 
            </tr> 
            <tr> 
                <td style="background-color: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #aaaaaa; border-top: 1px solid #eeeeee;"> © ${new Date().getFullYear()} Aura Messenger. Все права защищены. </td> 
            </tr> 
        </table> 
    </div> 
    `; 
}

// Универсальная функция-помощник для отправки писем через API
async function sendBrevoEmail(toEmail, subject, textContent, htmlContent = null) {
    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.textContent = textContent;
    if (htmlContent) sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.sender = { "name": "Aura Messenger", "email": "auramessengercode@gmail.com" };
    sendSmtpEmail.to = [{ "email": toEmail }];
    
    return apiInstance.sendTransacEmail(sendSmtpEmail);
}

const verificationCodes = {};

// --- Настройки сервера ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use(session({
    secret: 'aura-secret-key-2026-pro',
    resave: true,
    saveUninitialized: false,
    cookie: { 
        maxAge: 7 * 24 * 60 * 60 * 1000, 
        secure: false 
    }
}));

// --- Логика Telegram ---
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `Твой ID: ${msg.chat.id}\nВведи его в профиле Aura, чтобы получать коды входа здесь.`);
});

// --- МАРШРУТЫ ДЛЯ АВТОРИЗАЦИИ ---

// 1. Проверка пользователя (Поиск по username или email)
app.post('/api/check-user', (req, res) => {
    const { loginId } = req.body;
    const users = readData(USERS_FILE);
    const username = Object.keys(users).find(u => 
        u.toLowerCase() === loginId.toLowerCase() || 
        (users[u].email && users[u].email.toLowerCase() === loginId.toLowerCase())
    );

    if (username) {
        const user = users[username];
        res.json({
            exists: true,
            username: username,
            hasEmail: !!user.email,
            hasTelegram: !!user.telegramChatId
        });
    } else {
        res.json({ exists: false });
    }
});

// 2. Отправка кода (Telegram или Email)
app.post('/api/send-auth-code', async (req, res) => {
    const { username, method } = req.body;
    const users = readData(USERS_FILE);
    const user = users[username];

    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    verificationCodes[username] = { code, timestamp: Date.now() };

    console.log(`\n[AUTH] Код для ${username} (${method}): ${code}\n`);

    try {
        if (method === 'telegram' && user.telegramChatId) {
            await bot.sendMessage(user.telegramChatId, `🔐 Ваш код подтверждения Aura: ${code}`);
            res.json({ success: true });
        } else if (method === 'email' && user.email) {
            await sendBrevoEmail(user.email, "Код подтверждения Aura", `Ваш код: ${code}`, getEmailTemplate(code));
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Метод недоступен' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Ошибка отправки' });
    }
});

// 3. Проверка кода
app.post('/api/verify-code', (req, res) => {
    const { username, code } = req.body;
    const pending = verificationCodes[username];
    
    if (!pending || pending.code !== code || (Date.now() - pending.timestamp > 300000)) {
        return res.status(400).json({ error: 'Неверный или просроченный код' });
    }
    
    delete verificationCodes[username];
    req.session.username = username;
    const users = readData(USERS_FILE);
    res.json({ success: true, user: { username, ...users[username] } });
});

// 4. Финальная регистрация (Email теперь необязателен)
app.post('/api/register-final', async (req, res) => {
    const { email, fullname, username, password } = req.body;
    const users = readData(USERS_FILE);

    if (users[username]) return res.status(400).json({ error: 'Этот логин уже занят' });

    users[username] = {
        password: await bcrypt.hash(password, 10),
        email: email || null,
        name: fullname,
        avatar: null,
        bio: '',
        birthday: '',
        profilePattern: 'none',
        contacts: [],
        blocked: [],
        telegramChatId: null,
        lastSeen: Date.now()
    };

    writeData(USERS_FILE, users);
    req.session.username = username;
    res.json({ success: true, user: { username, name: fullname } });
});

const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const GROUPS_FILE = path.join(__dirname, 'groups.json');

// --- Инициализация файлов БД ---
function initFiles() {
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
    if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
    if (!fs.existsSync(GROUPS_FILE)) fs.writeFileSync(GROUPS_FILE, JSON.stringify({}));
}
initFiles();

function readData(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } 
    catch (e) { return file === MESSAGES_FILE ? [] : {}; }
}
function writeData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Вход по паролю (Обновлено под поиск по ID)
app.post('/api/login-password', async (req, res) => {
    const { loginId, password } = req.body;
    const users = readData(USERS_FILE);
    
    const username = Object.keys(users).find(u => 
        u.toLowerCase() === loginId.toLowerCase() || 
        (users[u].email && users[u].email.toLowerCase() === loginId.toLowerCase())
    );
    const user = users[username];
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: 'Неверные данные' });
    }
    
    req.session.username = username;
    res.json({ success: true, user: { username, name: user.name, avatar: user.avatar } });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth.html');
});

// Получение профиля текущего пользователя
app.get('/my-full-profile', (req, res) => {
    if (!req.session.username) return res.status(401).json({ error: 'Not logged in' });
    const users = readData(USERS_FILE);
    const user = users[req.session.username];
    if (!user) return res.status(404).json({ error: 'Not found' });
    
    const { password, ...safeUser } = user;
    res.json({ username: req.session.username, ...safeUser });
});

// Обновление профиля
app.post('/update-profile', (req, res) => {
    if (!req.session.username) return res.status(401).json({ error: 'Not logged in' });
    const users = readData(USERS_FILE);
    const user = users[req.session.username];
    if (!user) return res.status(404).json({ error: 'Not found' });
    
    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.bio !== undefined) user.bio = req.body.bio;
    if (req.body.birthday !== undefined) user.birthday = req.body.birthday;
    if (req.body.avatar !== undefined) user.avatar = req.body.avatar;
    if (req.body.profilePattern !== undefined) user.profilePattern = req.body.profilePattern;
    if (req.body.telegramChatId !== undefined) user.telegramChatId = req.body.telegramChatId;
    
    writeData(USERS_FILE, users);
    res.json({ success: true });
});

// Универсальный эндпоинт для получения данных о пользователе или группе
app.get('/api/entity/:id', (req, res) => {
    const callerId = req.session.username;
    const id = req.params.id;
    
    const users = readData(USERS_FILE);
    const groups = readData(GROUPS_FILE);
    const caller = users[callerId];

    if (groups[id]) {
        const group = groups[id];
        return res.json({
            type: 'group',
            id: group.id,
            name: group.name,
            displayName: group.name,
            description: group.description,
            avatar: group.avatar,
            membersCount: group.members.length,
            isOnline: false,
            lastSeen: null
        });
    }

    const user = users[id];
    if (!user) return res.status(404).json({ error: 'Not found' });

    let displayName = user.name || id;
    let inContacts = false;
    
    if (caller && caller.contacts) {
        const contactObj = caller.contacts.find(c => typeof c === 'object' ? c.username === id : c === id);
        if (contactObj) {
            inContacts = true;
            if (typeof contactObj === 'object' && contactObj.customName) {
                displayName = contactObj.customName;
            }
        }
    }

    const isBlocked = caller && caller.blocked && caller.blocked.includes(id);

    res.json({
        type: 'user',
        username: id,
        name: user.name,
        displayName: displayName,
        avatar: user.avatar,
        bio: user.bio,
        birthday: user.birthday,
        profilePattern: user.profilePattern,
        isOnline: !!onlineUsers[id],
        lastSeen: user.lastSeen,
        isBlocked: isBlocked,
        inContacts: inContacts
    });
});


// --- WebSocket Логика ---
const onlineUsers = {}; 

io.on('connection', (socket) => {
    let currentUsername = null;

    socket.on('identify', (username) => {
        currentUsername = username;
        onlineUsers[username] = socket.id;
        
        const users = readData(USERS_FILE);
        if (users[username]) {
            users[username].lastSeen = 'online';
            writeData(USERS_FILE, users);
        }
        
        io.emit('user_status_change', { username, online: true, lastSeen: 'online' });
    });

    socket.on('search_user', (searchUsername) => {
        const users = readData(USERS_FILE);
        if (users[searchUsername]) {
            socket.emit('search_result', { exists: true, username: searchUsername });
        } else {
            socket.emit('search_result', { exists: false });
        }
    });

    socket.on('get_my_chats', () => {
        if (!currentUsername) return;
        const msgs = readData(MESSAGES_FILE);
        const users = readData(USERS_FILE);
        const groups = readData(GROUPS_FILE);
        const myUser = users[currentUsername];
        let chats = new Set();
        
        msgs.forEach(m => {
            if (!(m.deletedFor && m.deletedFor.includes(currentUsername))) {
                if (m.from === currentUsername && !groups[m.to]) chats.add(m.to);
                if (m.to === currentUsername && !groups[m.from]) chats.add(m.from);
            }
        });
        
        if (myUser && myUser.contacts) {
            myUser.contacts.forEach(c => {
                const cUser = typeof c === 'object' ? c.username : c;
                chats.add(cUser);
            });
        }
        
        chats.delete(currentUsername);
        
        let chatsArray = Array.from(chats);

        for (const groupId in groups) {
            if (groups[groupId].members.includes(currentUsername)) {
                chatsArray.push(groupId);
            }
        }
        
        socket.emit('my_chats_list', chatsArray);
    });

    socket.on('get_history', (chatWith) => {
        if (!currentUsername) return;
        const msgs = readData(MESSAGES_FILE);
        const users = readData(USERS_FILE);
        const groups = readData(GROUPS_FILE);
        const myUser = users[currentUsername];

        let history = [];
        
        if (chatWith === 'me') {
            history = msgs.filter(m => m.from === currentUsername && m.to === 'me' && !(m.deletedFor && m.deletedFor.includes(currentUsername)));
        } else if (groups[chatWith]) {
            history = msgs.filter(m => m.to === chatWith && !(m.deletedFor && m.deletedFor.includes(currentUsername)));
        } else {
            history = msgs.filter(m => 
                ((m.from === currentUsername && m.to === chatWith) || 
                 (m.from === chatWith && m.to === currentUsername)) &&
                !(m.deletedFor && m.deletedFor.includes(currentUsername))
            );
        }

        history = history.map(m => {
            let fromDisplayName = m.from;
            if (m.from !== currentUsername && groups[chatWith]) {
                const contactObj = myUser.contacts ? myUser.contacts.find(c => (typeof c === 'object' ? c.username : c) === m.from) : null;
                if (contactObj && typeof contactObj === 'object' && contactObj.customName) {
                    fromDisplayName = contactObj.customName;
                } else if (users[m.from] && users[m.from].name) {
                    fromDisplayName = users[m.from].name;
                }
            }
            return { ...m, fromDisplayName };
        });

        socket.emit('chat_history', history);
    });

    socket.on('private_msg', (data) => {
        if (!currentUsername) return;
        
        const msg = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            from: currentUsername,
            to: data.to,
            text: data.text,
            media: data.media || null,
            reply: data.reply || null,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: false,
            reactions: {},
            deletedFor: []
        };

        const allMsgs = readData(MESSAGES_FILE);
        const groups = readData(GROUPS_FILE);
        allMsgs.push(msg);
        writeData(MESSAGES_FILE, allMsgs);

        const users = readData(USERS_FILE);
        const myUser = users[currentUsername];

        if (groups[data.to]) {
            const group = groups[data.to];
            
            group.members.forEach(memberUsername => {
                if (memberUsername === currentUsername) {
                    socket.emit('msg_receive', msg);
                } else if (onlineUsers[memberUsername]) {
                    const memberUser = users[memberUsername];
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
                const recipient = users[data.to];
                if (!(recipient.blocked && recipient.blocked.includes(currentUsername))) {
                    io.to(onlineUsers[data.to]).emit('msg_receive', msg);
                }
            }
        }
    });

    socket.on('mark_read', (data) => {
        if (!currentUsername) return;
        const allMsgs = readData(MESSAGES_FILE);
        const groups = readData(GROUPS_FILE);
        let updated = false;
        
        if (groups[data.chatWith]) {
             allMsgs.forEach(m => {
                if (m.to === data.chatWith && m.from !== currentUsername && !m.read) {
                    m.read = true;
                    updated = true;
                    if (onlineUsers[m.from]) io.to(onlineUsers[m.from]).emit('messages_read', { chatId: data.chatWith });
                }
            });
        } else {
            allMsgs.forEach(m => {
                if (m.from === data.chatWith && m.to === currentUsername && !m.read) {
                    m.read = true;
                    updated = true;
                }
            });
            if (updated && onlineUsers[data.chatWith]) {
                io.to(onlineUsers[data.chatWith]).emit('messages_read', { by: currentUsername });
            }
        }

        if (updated) writeData(MESSAGES_FILE, allMsgs);
    });

    socket.on('typing', (data) => {
        const groups = readData(GROUPS_FILE);
        if (groups[data.to]) {
            groups[data.to].members.forEach(member => {
                if (member !== currentUsername && onlineUsers[member]) {
                    io.to(onlineUsers[member]).emit('user_typing', { from: currentUsername, to: data.to });
                }
            });
        } else if (onlineUsers[data.to]) {
            io.to(onlineUsers[data.to]).emit('user_typing', { from: currentUsername, to: currentUsername });
        }
    });

    socket.on('stop_typing', (data) => {
        const groups = readData(GROUPS_FILE);
        if (groups[data.to]) {
            groups[data.to].members.forEach(member => {
                if (member !== currentUsername && onlineUsers[member]) {
                    io.to(onlineUsers[member]).emit('user_stop_typing', { from: currentUsername, to: data.to });
                }
            });
        } else if (onlineUsers[data.to]) {
            io.to(onlineUsers[data.to]).emit('user_stop_typing', { from: currentUsername, to: currentUsername });
        }
    });

    socket.on('toggle_contact', (data) => {
        if (!currentUsername) return;
        const users = readData(USERS_FILE);
        if (!users[currentUsername].contacts) users[currentUsername].contacts = [];
        
        let contacts = users[currentUsername].contacts;
        contacts = contacts.filter(c => (typeof c === 'object' ? c.username : c) !== data.username);
        
        if (!data.remove) {
            contacts.push({
                username: data.username,
                customName: data.customName || data.username
            });
        }
        
        users[currentUsername].contacts = contacts;
        writeData(USERS_FILE, users);
        socket.emit('contact_toggled', { username: data.username, inContacts: !data.remove });
    });

    socket.on('toggle_block', (data) => {
        if (!currentUsername) return;
        const users = readData(USERS_FILE);
        if (!users[currentUsername].blocked) users[currentUsername].blocked = [];
        
        const idx = users[currentUsername].blocked.indexOf(data.username);
        let isBlocked = false;
        if (idx === -1) { users[currentUsername].blocked.push(data.username); isBlocked = true; } 
        else { users[currentUsername].blocked.splice(idx, 1); }
        
        writeData(USERS_FILE, users);
        socket.emit('block_toggled', { username: data.username, isBlocked });
        
        if (onlineUsers[data.username]) {
            io.to(onlineUsers[data.username]).emit('user_status_change', { 
                username: currentUsername, 
                online: !isBlocked, 
                lastSeen: isBlocked ? 'blocked' : 'online' 
            });
        }
    });

    // --- ЛОГИКА ГРУПП ---
    socket.on('create_group', (data) => {
        if (!currentUsername) return;
        const groups = readData(GROUPS_FILE);
        
        if (groups[data.id]) {
            socket.emit('error', 'Группа с таким ID уже существует');
            return;
        }

        let members = [currentUsername, ...data.members];
        members = [...new Set(members)];
        if (members.length > 100) members = members.slice(0, 100);

        groups[data.id] = {
            id: data.id,
            name: data.name,
            description: data.description || '',
            avatar: data.avatar || null,
            creator: currentUsername,
            members: members
        };

        writeData(GROUPS_FILE, groups);
        
        socket.emit('group_created', { groupId: data.id });
        
        members.forEach(member => {
            if (member !== currentUsername && onlineUsers[member]) {
                io.to(onlineUsers[member]).emit('search_result', { exists: true, username: data.id });
            }
        });
    });

    socket.on('leave_group', (data) => {
        if (!currentUsername) return;
        const groups = readData(GROUPS_FILE);
        
        if (groups[data.groupId]) {
            groups[data.groupId].members = groups[data.groupId].members.filter(m => m !== currentUsername);
            
            if (groups[data.groupId].members.length === 0) {
                delete groups[data.groupId];
            }
            writeData(GROUPS_FILE, groups);
            socket.emit('get_my_chats');
        }
    });

    socket.on('add_reaction', (data) => {
        if (!currentUsername) return;
        const allMsgs = readData(MESSAGES_FILE);
        const msg = allMsgs.find(m => m.id === data.id);
        
        if (msg) {
            msg.reactions = msg.reactions || {};
            msg.reactions[data.emoji] = msg.reactions[data.emoji] || [];
            
            const userIdx = msg.reactions[data.emoji].indexOf(currentUsername);
            if (userIdx > -1) msg.reactions[data.emoji].splice(userIdx, 1);
            else msg.reactions[data.emoji].push(currentUsername);
            
            writeData(MESSAGES_FILE, allMsgs);
            
            io.emit('msg_reaction_update', { id: data.id, reactions: msg.reactions });
        }
    });

    socket.on('delete_msg', (data) => {
        if (!currentUsername) return;
        const allMsgs = readData(MESSAGES_FILE);
        const groups = readData(GROUPS_FILE);
        const msgIndex = allMsgs.findIndex(m => m.id === data.id);
        
        if (msgIndex !== -1) {
            const msg = allMsgs[msgIndex];
            const recipient = msg.to === currentUsername ? msg.from : msg.to;
            
            if (data.forEveryone && msg.from === currentUsername) {
                allMsgs.splice(msgIndex, 1);
                writeData(MESSAGES_FILE, allMsgs);
                
                if (groups[recipient]) {
                    groups[recipient].members.forEach(member => {
                        if (onlineUsers[member]) io.to(onlineUsers[member]).emit('msg_deleted', { id: data.id });
                    });
                } else {
                    socket.emit('msg_deleted', { id: data.id });
                    if (onlineUsers[recipient]) io.to(onlineUsers[recipient]).emit('msg_deleted', { id: data.id });
                }
            } else {
                msg.deletedFor = msg.deletedFor || [];
                if (!msg.deletedFor.includes(currentUsername)) {
                    msg.deletedFor.push(currentUsername);
                    writeData(MESSAGES_FILE, allMsgs);
                }
                socket.emit('msg_deleted', { id: data.id });
            }
        }
    });

    socket.on('disconnect', () => {
        if (currentUsername) {
            const users = readData(USERS_FILE);
            const now = Date.now();
            if (users[currentUsername]) {
                users[currentUsername].lastSeen = now;
                writeData(USERS_FILE, users);
            }
            delete onlineUsers[currentUsername];
            io.emit('user_status_change', { username: currentUsername, online: false, lastSeen: now });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
