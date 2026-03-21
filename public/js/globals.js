// Инициализация сокетов и PeerJS
const socket = io();
let peer = null;

// Состояние приложения
let currentUser = null;
let selectedChatId = null;
let isCurrentChatGroup = false;
let replyData = null;
let viewingUserProfile = null;
let viewingEntityData = null; 
let unreadCounts = {}; 

// Для редактирования групп
let currentGroupAvatarBase64 = null;
let currentGroupBgBase64 = null;
let editModeGroupId = null; 

// Пагинация истории
let currentOffset = 0;
let isLoadingHistory = false;
let hasMoreHistory = true;
let editData = null; 

// DOM элементы (кэшируем)
const messagesDiv = document.getElementById('messages');
const searchInput = document.getElementById('searchUser');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const attachBtn = document.getElementById('attachBtn');
const recordUI = document.getElementById('record-ui');
const inputContainer = document.getElementById('input-container');
const readonlyBanner = document.getElementById('readonly-banner');
const contactsDiv = document.getElementById('contacts');
const mainContainer = document.getElementById('main-container');
const chatStatusEl = document.getElementById('chat-status');
const contextMenuEl = document.getElementById('msg-context-menu');

// Переводы и язык
let currentLang = localStorage.getItem('aura-lang') || 'ru';

const dict = {
    ru: { writeMsg: "Написать", addContact: "В контакты", removeContact: "Из контактов", blockUser: "Заблокировать", unblockUser: "Разблокировать", aboutMe: "О себе", birthday: "День рождения", locationLabel: "Город / Локация", websiteLabel: "Веб-сайт", username: "ID", settings: "Настройки", choosePhoto: "Выбрать фото", general: "Профиль", appearance: "Внешний вид", yourNameLabel: "ВАШЕ ИМЯ", aboutMeLabel: "О СЕБЕ", birthdayLabel: "ДЕНЬ РОЖДЕНИЯ", saveChanges: "Сохранить изменения", logout: "Выйти из аккаунта", languageLabel: "ЯЗЫК / LANGUAGE", themeLabel: "ЦВЕТОВАЯ ТЕМА", chatPatternLabel: "УЗОР ФОНА ЧАТА", profilePatternLabel: "УЗОР ОБЛОЖКИ ПРОФИЛЯ", noPattern: "Без узора", patternDots: "Точки", patternGrid: "Сетка", patternTelegram: "Telegram Pattern", searchPlaceholder: "Поиск @ID...", savedMessages: "Избранное", savedSubtext: "Личное хранилище", selectChat: "Выберите чат", secureMessages: "Ваши сообщения защищены Aura", writeMessage: "Напишите сообщение...", swipeCancel: "Свайп для отмены", wasRecently: "был(а) недавно", wasToday: "был(а) сегодня в", wasAt: "был(а)", online: "в сети", typing: "печатает...", blockedStatus: "был(а) очень давно", notSpecified: "Не указан", notFound: "Чат не найден", profileUpdated: "Профиль обновлен!", photoUpdated: "Фото обновлено!", reply: "Ответить", delete: "Удалить", createGroup: "Создать сообщество", typeGroup: "Группа", typeChannel: "Канал", groupUsername: "Идентификатор (без @)", groupName: "Название", groupDesc: "Описание", addMembers: "Добавить участников", createGroupBtn: "Создать", saveBtn: "Сохранить", customNameLabel: "Имя контакта", saveContactBtn: "Сохранить", addContactTitle: "Добавить контакт", addContactDesc: "Введите имя, под которым этот пользователь будет отображаться у вас.", membersCount: "Участников", leaveGroup: "Покинуть", groupCreated: "Создано!", readOnlyChannel: "Только администраторы могут писать сюда", kickBtn: "Удалить", glassEffectLabel: "ЭФФЕКТ ЖИДКОГО СТЕКЛА", on: "Вкл", off: "Выкл" },
    en: { writeMsg: "Message", addContact: "Add Contact", removeContact: "Remove Contact", blockUser: "Block", unblockUser: "Unblock", aboutMe: "Bio", birthday: "Birthday", locationLabel: "Location", websiteLabel: "Website", username: "ID", settings: "Settings", choosePhoto: "Choose Photo", general: "Profile", appearance: "Appearance", yourNameLabel: "YOUR NAME", aboutMeLabel: "BIO", birthdayLabel: "BIRTHDAY", saveChanges: "Save Changes", logout: "Log Out", languageLabel: "LANGUAGE", themeLabel: "THEME", chatPatternLabel: "CHAT PATTERN", profilePatternLabel: "PROFILE PATTERN", noPattern: "None", patternDots: "Dots", patternGrid: "Grid", patternTelegram: "Telegram", searchPlaceholder: "Search @ID...", savedMessages: "Saved Messages", savedSubtext: "Personal storage", selectChat: "Select a chat", secureMessages: "Secured by Aura", writeMessage: "Write...", swipeCancel: "Swipe to cancel", wasRecently: "last seen recently", wasToday: "last seen today at", wasAt: "last seen", online: "online", typing: "typing...", blockedStatus: "last seen a long time ago", notSpecified: "Not specified", notFound: "Not found", profileUpdated: "Updated!", photoUpdated: "Photo updated!", reply: "Reply", delete: "Delete", createGroup: "Create Community", typeGroup: "Group", typeChannel: "Channel", groupUsername: "ID", groupName: "Name", groupDesc: "Description", addMembers: "Add members", createGroupBtn: "Create", saveBtn: "Save", customNameLabel: "Contact Name", saveContactBtn: "Save", addContactTitle: "Add Contact", addContactDesc: "Enter the name for this user.", membersCount: "Members", leaveGroup: "Leave", groupCreated: "Created!", readOnlyChannel: "Only admins can post", kickBtn: "Kick", glassEffectLabel: "GLASS EFFECT", on: "On", off: "Off" }
};