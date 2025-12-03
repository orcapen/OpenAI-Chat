/**
 * AI Chat Studio - 主應用程式
 * 功能：OpenAI API 整合、串流輸出、對話管理、Prompt 儲存
 */

// ===================================
// 全域狀態管理
// ===================================
const AppState = {
    // API 設定
    apiKey: '',
    apiBase: 'https://api.openai.com/v1',
    
    // 模型參數
    currentModel: 'gpt-5.1',
    streamEnabled: true,
    temperature: 0.7,
    topP: 1,
    maxTokens: 4096,
    presencePenalty: 0,
    frequencyPenalty: 0,
    
    // GPT-5.1 專屬參數
    reasoningEffort: 'medium',  // 推理深度: none, low, medium, high
    verbosity: 'medium',        // 輸出詳細程度: low, medium, high
    tone: 'default',            // 語氣風格
    
    // 對話狀態
    currentChatId: null,
    chats: {},
    systemPrompt: '',
    
    // 常用 Prompt
    savedPrompts: [],
    
    // 串流控制
    abortController: null,
    isGenerating: false
};

// ===================================
// DOM 元素參照
// ===================================
const DOM = {
    // 側邊欄
    sidebar: document.getElementById('sidebar'),
    closeSidebar: document.getElementById('closeSidebar'),
    menuBtn: document.getElementById('menuBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    chatList: document.getElementById('chatList'),
    promptList: document.getElementById('promptList'),
    addPromptBtn: document.getElementById('addPromptBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    
    // 主內容區
    modelSelect: document.getElementById('modelSelect'),
    paramBtn: document.getElementById('paramBtn'),
    chatContainer: document.getElementById('chatContainer'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    messages: document.getElementById('messages'),
    
    // 輸入區域
    systemPromptBar: document.getElementById('systemPromptBar'),
    systemPromptText: document.getElementById('systemPromptText'),
    editSystemPrompt: document.getElementById('editSystemPrompt'),
    clearSystemPrompt: document.getElementById('clearSystemPrompt'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    stopBtn: document.getElementById('stopBtn'),
    
    // 設定 Modal
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    toggleApiKey: document.getElementById('toggleApiKey'),
    apiBaseInput: document.getElementById('apiBaseInput'),
    defaultModelSelect: document.getElementById('defaultModelSelect'),
    streamToggle: document.getElementById('streamToggle'),
    cancelSettings: document.getElementById('cancelSettings'),
    saveSettings: document.getElementById('saveSettings'),
    
    // 參數 Modal
    paramModal: document.getElementById('paramModal'),
    closeParam: document.getElementById('closeParam'),
    temperatureSlider: document.getElementById('temperatureSlider'),
    tempValue: document.getElementById('tempValue'),
    topPSlider: document.getElementById('topPSlider'),
    topPValue: document.getElementById('topPValue'),
    maxTokensSlider: document.getElementById('maxTokensSlider'),
    maxTokensValue: document.getElementById('maxTokensValue'),
    presenceSlider: document.getElementById('presenceSlider'),
    presenceValue: document.getElementById('presenceValue'),
    frequencySlider: document.getElementById('frequencySlider'),
    frequencyValue: document.getElementById('frequencyValue'),
    resetParams: document.getElementById('resetParams'),
    applyParams: document.getElementById('applyParams'),
    
    // GPT-5.1 專屬參數
    gpt5ParamsSection: document.getElementById('gpt5ParamsSection'),
    reasoningEffortSelect: document.getElementById('reasoningEffortSelect'),
    verbositySelect: document.getElementById('verbositySelect'),
    toneSelect: document.getElementById('toneSelect'),
    
    // Prompt Modal
    promptModal: document.getElementById('promptModal'),
    promptModalTitle: document.getElementById('promptModalTitle'),
    closePromptModal: document.getElementById('closePromptModal'),
    promptNameInput: document.getElementById('promptNameInput'),
    promptContentInput: document.getElementById('promptContentInput'),
    promptAsSystem: document.getElementById('promptAsSystem'),
    cancelPrompt: document.getElementById('cancelPrompt'),
    deletePrompt: document.getElementById('deletePrompt'),
    savePrompt: document.getElementById('savePrompt'),
    
    // 系統提示 Modal
    systemPromptModal: document.getElementById('systemPromptModal'),
    closeSystemPromptModal: document.getElementById('closeSystemPromptModal'),
    systemPromptInput: document.getElementById('systemPromptInput'),
    cancelSystemPrompt: document.getElementById('cancelSystemPrompt'),
    saveSystemPrompt: document.getElementById('saveSystemPrompt'),
    
    // Toast
    toastContainer: document.getElementById('toastContainer')
};

// 編輯中的 Prompt ID（用於編輯模式）
let editingPromptId = null;

// ===================================
// 工具函數
// ===================================

/**
 * 產生唯一識別碼
 * @returns {string} UUID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 顯示 Toast 通知
 * @param {string} message - 訊息內容
 * @param {string} type - 類型 (success, error, info)
 */
function showToast(message, type = 'info') {
    console.log(`[Toast] ${type}: ${message}`);
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    // 3 秒後自動移除
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 格式化時間
 * @param {Date} date - 日期物件
 * @returns {string} 格式化的時間字串
 */
function formatTime(date) {
    return new Intl.DateTimeFormat('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

/**
 * 簡單的 Markdown 轉 HTML
 * @param {string} text - Markdown 文字
 * @returns {string} HTML 字串
 */
function parseMarkdown(text) {
    // 程式碼區塊
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const escapedCode = escapeHtml(code.trim());
        return `<pre><code class="language-${lang}">${escapedCode}</code></pre>`;
    });
    
    // 行內程式碼
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 標題
    text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // 粗體和斜體
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // 引用
    text = text.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
    
    // 無序列表
    text = text.replace(/^\s*[-*] (.*$)/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)\n(?=<li>)/g, '$1');
    text = text.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    text = text.replace(/<\/ul>\s*<ul>/g, '');
    
    // 有序列表
    text = text.replace(/^\s*\d+\. (.*$)/gm, '<li>$1</li>');
    
    // 連結
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    
    // 段落
    text = text.replace(/\n\n/g, '</p><p>');
    text = text.replace(/\n/g, '<br>');
    
    // 包裝段落
    if (!text.startsWith('<')) {
        text = '<p>' + text + '</p>';
    }
    
    return text;
}

/**
 * HTML 跳脫
 * @param {string} text - 原始文字
 * @returns {string} 跳脫後的文字
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===================================
// 本地儲存管理
// ===================================

/**
 * 儲存資料到 localStorage
 */
function saveToStorage() {
    console.log('[Storage] 儲存資料到本地');
    
    const data = {
        apiKey: AppState.apiKey,
        apiBase: AppState.apiBase,
        currentModel: AppState.currentModel,
        streamEnabled: AppState.streamEnabled,
        temperature: AppState.temperature,
        topP: AppState.topP,
        maxTokens: AppState.maxTokens,
        presencePenalty: AppState.presencePenalty,
        frequencyPenalty: AppState.frequencyPenalty,
        // GPT-5.1 專屬參數
        reasoningEffort: AppState.reasoningEffort,
        verbosity: AppState.verbosity,
        tone: AppState.tone,
        // 對話資料
        chats: AppState.chats,
        savedPrompts: AppState.savedPrompts,
        currentChatId: AppState.currentChatId
    };
    
    localStorage.setItem('aiChatStudio', JSON.stringify(data));
}

/**
 * 從 localStorage 載入資料
 */
function loadFromStorage() {
    console.log('[Storage] 載入本地資料');
    
    try {
        const data = JSON.parse(localStorage.getItem('aiChatStudio'));
        
        if (data) {
            AppState.apiKey = data.apiKey || '';
            AppState.apiBase = data.apiBase || 'https://api.openai.com/v1';
            AppState.currentModel = data.currentModel || 'gpt-5.1';
            AppState.streamEnabled = data.streamEnabled !== false;
            AppState.temperature = data.temperature ?? 0.7;
            AppState.topP = data.topP ?? 1;
            AppState.maxTokens = data.maxTokens ?? 4096;
            AppState.presencePenalty = data.presencePenalty ?? 0;
            AppState.frequencyPenalty = data.frequencyPenalty ?? 0;
            // GPT-5.1 專屬參數
            AppState.reasoningEffort = data.reasoningEffort || 'medium';
            AppState.verbosity = data.verbosity || 'medium';
            AppState.tone = data.tone || 'default';
            // 對話資料
            AppState.chats = data.chats || {};
            AppState.savedPrompts = data.savedPrompts || [];
            AppState.currentChatId = data.currentChatId || null;
            
            console.log('[Storage] 資料載入成功');
        }
    } catch (e) {
        console.error('[Storage] 載入資料失敗:', e);
    }
}

// ===================================
// UI 更新函數
// ===================================

/**
 * 更新對話列表 UI
 */
function updateChatList() {
    console.log('[UI] 更新對話列表');
    
    const chatIds = Object.keys(AppState.chats).sort((a, b) => {
        return (AppState.chats[b].updatedAt || 0) - (AppState.chats[a].updatedAt || 0);
    });
    
    DOM.chatList.innerHTML = chatIds.map(id => {
        const chat = AppState.chats[id];
        const isActive = id === AppState.currentChatId;
        const title = chat.title || '新對話';
        
        return `
            <div class="chat-item ${isActive ? 'active' : ''}" data-id="${id}">
                <svg class="chat-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="chat-item-title">${escapeHtml(title)}</span>
                <button class="btn-icon-small chat-item-delete" data-id="${id}" title="刪除對話">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
    
    // 綁定點擊事件
    DOM.chatList.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-item-delete')) {
                loadChat(item.dataset.id);
            }
        });
    });
    
    // 綁定刪除按鈕
    DOM.chatList.querySelectorAll('.chat-item-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(btn.dataset.id);
        });
    });
}

/**
 * 更新常用 Prompt 列表 UI
 */
function updatePromptList() {
    console.log('[UI] 更新常用 Prompt 列表');
    
    DOM.promptList.innerHTML = AppState.savedPrompts.map(prompt => {
        return `
            <div class="prompt-item" data-id="${prompt.id}">
                <svg class="prompt-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <span class="prompt-item-name">${escapeHtml(prompt.name)}</span>
                <div class="prompt-item-actions">
                    <button class="btn-icon-small prompt-edit" data-id="${prompt.id}" title="編輯">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // 綁定點擊使用 Prompt
    DOM.promptList.querySelectorAll('.prompt-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.prompt-item-actions')) {
                const prompt = AppState.savedPrompts.find(p => p.id === item.dataset.id);
                if (prompt) {
                    usePrompt(prompt);
                }
            }
        });
    });
    
    // 綁定編輯按鈕
    DOM.promptList.querySelectorAll('.prompt-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditPromptModal(btn.dataset.id);
        });
    });
}

/**
 * 更新訊息區域 UI
 */
function updateMessages() {
    if (!AppState.currentChatId) {
        DOM.welcomeScreen.classList.remove('hidden');
        DOM.messages.innerHTML = '';
        return;
    }
    
    const chat = AppState.chats[AppState.currentChatId];
    if (!chat || chat.messages.length === 0) {
        DOM.welcomeScreen.classList.remove('hidden');
        DOM.messages.innerHTML = '';
        return;
    }
    
    DOM.welcomeScreen.classList.add('hidden');
    
    DOM.messages.innerHTML = chat.messages.map(msg => {
        const isUser = msg.role === 'user';
        const avatarSvg = isUser 
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>';
        
        const content = isUser ? escapeHtml(msg.content) : parseMarkdown(msg.content);
        const time = msg.timestamp ? formatTime(new Date(msg.timestamp)) : '';
        
        return `
            <div class="message ${msg.role}">
                <div class="message-avatar">${avatarSvg}</div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-role">${isUser ? '你' : 'AI'}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-body">${content}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // 滾動到底部
    scrollToBottom();
}

/**
 * 滾動聊天區域到底部
 */
function scrollToBottom() {
    DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
}

/**
 * 更新系統提示列顯示
 */
function updateSystemPromptBar() {
    if (AppState.systemPrompt) {
        DOM.systemPromptBar.classList.remove('hidden');
        DOM.systemPromptText.textContent = AppState.systemPrompt.substring(0, 50) + 
            (AppState.systemPrompt.length > 50 ? '...' : '');
    } else {
        DOM.systemPromptBar.classList.add('hidden');
        DOM.systemPromptText.textContent = '未設定';
    }
}

/**
 * 檢查是否為 GPT-5.1 系列模型
 * @param {string} model - 模型名稱
 * @returns {boolean}
 */
function isGpt5Model(model) {
    return model && (model.startsWith('gpt-5.1') || model.startsWith('gpt-5'));
}

/**
 * 更新參數顯示值
 */
function updateParamDisplays() {
    // 通用參數
    DOM.tempValue.textContent = AppState.temperature;
    DOM.topPValue.textContent = AppState.topP;
    DOM.maxTokensValue.textContent = AppState.maxTokens;
    DOM.presenceValue.textContent = AppState.presencePenalty;
    DOM.frequencyValue.textContent = AppState.frequencyPenalty;
    
    DOM.temperatureSlider.value = AppState.temperature;
    DOM.topPSlider.value = AppState.topP;
    DOM.maxTokensSlider.value = AppState.maxTokens;
    DOM.presenceSlider.value = AppState.presencePenalty;
    DOM.frequencySlider.value = AppState.frequencyPenalty;
    
    // GPT-5.1 專屬參數
    if (DOM.reasoningEffortSelect) {
        DOM.reasoningEffortSelect.value = AppState.reasoningEffort;
    }
    if (DOM.verbositySelect) {
        DOM.verbositySelect.value = AppState.verbosity;
    }
    if (DOM.toneSelect) {
        DOM.toneSelect.value = AppState.tone;
    }
    
    // 根據模型顯示/隱藏 GPT-5.1 參數區塊
    updateGpt5ParamsVisibility();
}

/**
 * 根據當前模型更新 GPT-5.1 參數區塊的顯示狀態
 */
function updateGpt5ParamsVisibility() {
    if (DOM.gpt5ParamsSection) {
        if (isGpt5Model(AppState.currentModel)) {
            DOM.gpt5ParamsSection.style.display = 'block';
            console.log('[UI] 顯示 GPT-5.1 專屬參數');
        } else {
            DOM.gpt5ParamsSection.style.display = 'none';
            console.log('[UI] 隱藏 GPT-5.1 專屬參數');
        }
    }
}

// ===================================
// 對話管理
// ===================================

/**
 * 建立新對話
 */
function createNewChat() {
    console.log('[Chat] 建立新對話');
    
    const id = generateId();
    AppState.chats[id] = {
        id: id,
        title: '新對話',
        messages: [],
        systemPrompt: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    AppState.currentChatId = id;
    AppState.systemPrompt = '';
    
    updateChatList();
    updateMessages();
    updateSystemPromptBar();
    saveToStorage();
    
    // 聚焦到輸入框
    DOM.messageInput.focus();
}

/**
 * 載入對話
 * @param {string} chatId - 對話 ID
 */
function loadChat(chatId) {
    console.log('[Chat] 載入對話:', chatId);
    
    if (!AppState.chats[chatId]) {
        console.error('[Chat] 對話不存在:', chatId);
        return;
    }
    
    AppState.currentChatId = chatId;
    AppState.systemPrompt = AppState.chats[chatId].systemPrompt || '';
    
    updateChatList();
    updateMessages();
    updateSystemPromptBar();
    saveToStorage();
    
    // 行動版關閉側邊欄
    if (window.innerWidth <= 768) {
        DOM.sidebar.classList.remove('active');
    }
}

/**
 * 刪除對話
 * @param {string} chatId - 對話 ID
 */
function deleteChat(chatId) {
    console.log('[Chat] 刪除對話:', chatId);
    
    delete AppState.chats[chatId];
    
    if (AppState.currentChatId === chatId) {
        AppState.currentChatId = null;
        AppState.systemPrompt = '';
    }
    
    updateChatList();
    updateMessages();
    updateSystemPromptBar();
    saveToStorage();
    
    showToast('對話已刪除', 'success');
}

/**
 * 更新對話標題（根據第一則訊息）
 * @param {string} chatId - 對話 ID
 */
function updateChatTitle(chatId) {
    const chat = AppState.chats[chatId];
    if (!chat || chat.messages.length === 0) return;
    
    const firstUserMessage = chat.messages.find(m => m.role === 'user');
    if (firstUserMessage) {
        // 取前 30 個字元作為標題
        chat.title = firstUserMessage.content.substring(0, 30) + 
            (firstUserMessage.content.length > 30 ? '...' : '');
        updateChatList();
    }
}

// ===================================
// 常用 Prompt 管理
// ===================================

/**
 * 使用 Prompt
 * @param {Object} prompt - Prompt 物件
 */
function usePrompt(prompt) {
    console.log('[Prompt] 使用 Prompt:', prompt.name);
    
    if (prompt.isSystem) {
        // 設為系統提示
        AppState.systemPrompt = prompt.content;
        updateSystemPromptBar();
        
        // 如果有當前對話，也更新對話的系統提示
        if (AppState.currentChatId) {
            AppState.chats[AppState.currentChatId].systemPrompt = prompt.content;
            saveToStorage();
        }
        
        showToast('已設定系統提示', 'success');
    } else {
        // 填入輸入框
        DOM.messageInput.value = prompt.content;
        DOM.messageInput.focus();
        autoResizeTextarea();
        updateSendButton();
    }
    
    // 行動版關閉側邊欄
    if (window.innerWidth <= 768) {
        DOM.sidebar.classList.remove('active');
    }
}

/**
 * 開啟新增 Prompt Modal
 */
function openAddPromptModal() {
    editingPromptId = null;
    DOM.promptModalTitle.textContent = '新增常用 Prompt';
    DOM.promptNameInput.value = '';
    DOM.promptContentInput.value = '';
    DOM.promptAsSystem.checked = false;
    DOM.deletePrompt.classList.add('hidden');
    DOM.promptModal.classList.add('active');
}

/**
 * 開啟編輯 Prompt Modal
 * @param {string} promptId - Prompt ID
 */
function openEditPromptModal(promptId) {
    const prompt = AppState.savedPrompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    editingPromptId = promptId;
    DOM.promptModalTitle.textContent = '編輯 Prompt';
    DOM.promptNameInput.value = prompt.name;
    DOM.promptContentInput.value = prompt.content;
    DOM.promptAsSystem.checked = prompt.isSystem || false;
    DOM.deletePrompt.classList.remove('hidden');
    DOM.promptModal.classList.add('active');
}

/**
 * 儲存 Prompt
 */
function savePromptFromModal() {
    const name = DOM.promptNameInput.value.trim();
    const content = DOM.promptContentInput.value.trim();
    const isSystem = DOM.promptAsSystem.checked;
    
    if (!name || !content) {
        showToast('請填寫名稱和內容', 'error');
        return;
    }
    
    if (editingPromptId) {
        // 編輯模式
        const index = AppState.savedPrompts.findIndex(p => p.id === editingPromptId);
        if (index !== -1) {
            AppState.savedPrompts[index] = {
                ...AppState.savedPrompts[index],
                name,
                content,
                isSystem
            };
        }
        showToast('Prompt 已更新', 'success');
    } else {
        // 新增模式
        AppState.savedPrompts.push({
            id: generateId(),
            name,
            content,
            isSystem
        });
        showToast('Prompt 已儲存', 'success');
    }
    
    updatePromptList();
    saveToStorage();
    closePromptModal();
}

/**
 * 刪除 Prompt
 */
function deletePromptFromModal() {
    if (!editingPromptId) return;
    
    AppState.savedPrompts = AppState.savedPrompts.filter(p => p.id !== editingPromptId);
    
    updatePromptList();
    saveToStorage();
    closePromptModal();
    
    showToast('Prompt 已刪除', 'success');
}

/**
 * 關閉 Prompt Modal
 */
function closePromptModal() {
    DOM.promptModal.classList.remove('active');
    editingPromptId = null;
}

// ===================================
// OpenAI API 呼叫
// ===================================

/**
 * 發送訊息到 OpenAI API
 * @param {string} userMessage - 使用者訊息
 */
async function sendMessage(userMessage) {
    console.log('[API] 發送訊息');
    
    // 檢查 API Key
    if (!AppState.apiKey) {
        showToast('請先設定 API Key', 'error');
        DOM.settingsModal.classList.add('active');
        return;
    }
    
    // 確保有當前對話
    if (!AppState.currentChatId) {
        createNewChat();
    }
    
    const chat = AppState.chats[AppState.currentChatId];
    
    // 新增使用者訊息
    chat.messages.push({
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
    });
    
    chat.updatedAt = Date.now();
    
    // 更新標題（如果是第一則訊息）
    if (chat.messages.filter(m => m.role === 'user').length === 1) {
        updateChatTitle(AppState.currentChatId);
    }
    
    // 更新 UI
    updateMessages();
    saveToStorage();
    
    // 準備 API 請求
    const messages = [];
    
    // 系統提示
    if (AppState.systemPrompt || chat.systemPrompt) {
        messages.push({
            role: 'system',
            content: AppState.systemPrompt || chat.systemPrompt
        });
    }
    
    // 對話歷史
    chat.messages.forEach(msg => {
        messages.push({
            role: msg.role,
            content: msg.content
        });
    });
    
    // 顯示載入狀態
    AppState.isGenerating = true;
    DOM.sendBtn.classList.add('hidden');
    DOM.stopBtn.classList.remove('hidden');
    
    // 新增 AI 訊息佔位
    const assistantMessageIndex = chat.messages.length;
    chat.messages.push({
        role: 'assistant',
        content: '',
        timestamp: Date.now()
    });
    
    // 顯示打字指示器
    addTypingIndicator();
    
    try {
        AppState.abortController = new AbortController();
        
        // 構建請求參數
        const requestBody = {
            model: AppState.currentModel,
            messages: messages,
            stream: AppState.streamEnabled
        };
        
        // 根據模型類型設定不同的參數
        if (isGpt5Model(AppState.currentModel)) {
            // GPT-5.1/GPT-5 系列模型參數
            // 注意：GPT-5.1 使用 max_completion_tokens 而非 max_tokens
            requestBody.temperature = AppState.temperature;
            requestBody.top_p = AppState.topP;
            requestBody.max_completion_tokens = AppState.maxTokens;
            requestBody.presence_penalty = AppState.presencePenalty;
            requestBody.frequency_penalty = AppState.frequencyPenalty;
            
            // GPT-5.1 專屬參數
            requestBody.reasoning_effort = AppState.reasoningEffort;
            requestBody.verbosity = AppState.verbosity;
            if (AppState.tone !== 'default') {
                requestBody.tone = AppState.tone;
            }
            
            console.log('[API] 使用 GPT-5.1 專屬參數:', {
                reasoning_effort: AppState.reasoningEffort,
                verbosity: AppState.verbosity,
                tone: AppState.tone,
                max_completion_tokens: AppState.maxTokens
            });
            
        } else if (!AppState.currentModel.startsWith('o1')) {
            // 一般模型參數 (GPT-4, GPT-3.5 等)
            requestBody.temperature = AppState.temperature;
            requestBody.top_p = AppState.topP;
            requestBody.max_tokens = AppState.maxTokens;
            requestBody.presence_penalty = AppState.presencePenalty;
            requestBody.frequency_penalty = AppState.frequencyPenalty;
        } else {
            // o1 模型使用 max_completion_tokens
            requestBody.max_completion_tokens = AppState.maxTokens;
        }
        
        console.log('[API] 請求參數:', { ...requestBody, messages: `${messages.length} 則訊息` });
        
        const response = await fetch(`${AppState.apiBase}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AppState.apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: AppState.abortController.signal
        });
        
        // 移除打字指示器
        removeTypingIndicator();
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        
        if (AppState.streamEnabled) {
            // 串流處理
            await handleStreamResponse(response, assistantMessageIndex);
        } else {
            // 非串流處理
            const data = await response.json();
            const content = data.choices[0]?.message?.content || '';
            chat.messages[assistantMessageIndex].content = content;
            updateMessages();
        }
        
        console.log('[API] 回應完成');
        
    } catch (error) {
        removeTypingIndicator();
        
        if (error.name === 'AbortError') {
            console.log('[API] 請求已取消');
            showToast('已停止生成', 'info');
        } else {
            console.error('[API] 錯誤:', error);
            showToast(`錯誤: ${error.message}`, 'error');
            
            // 移除失敗的 AI 訊息
            chat.messages.pop();
        }
    } finally {
        AppState.isGenerating = false;
        AppState.abortController = null;
        DOM.sendBtn.classList.remove('hidden');
        DOM.stopBtn.classList.add('hidden');
        
        chat.updatedAt = Date.now();
        updateMessages();
        saveToStorage();
    }
}

/**
 * 處理串流回應
 * @param {Response} response - Fetch 回應
 * @param {number} messageIndex - 訊息索引
 */
async function handleStreamResponse(response, messageIndex) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    const chat = AppState.chats[AppState.currentChatId];
    
    // 建立串流訊息元素（只建立一次，避免閃爍）
    const streamingElement = createStreamingMessageElement();
    DOM.messages.appendChild(streamingElement);
    const contentElement = streamingElement.querySelector('.message-body');
    
    while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // 處理 SSE 資料
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                    console.log('[Stream] 串流結束');
                    continue;
                }
                
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices[0]?.delta?.content;
                    
                    if (content) {
                        chat.messages[messageIndex].content += content;
                        // 只更新內容元素，不重新渲染整個列表
                        updateStreamingContent(contentElement, chat.messages[messageIndex].content);
                    }
                } catch (e) {
                    // 忽略解析錯誤
                }
            }
        }
    }
    
    // 串流結束後，移除串流元素並完整渲染一次
    streamingElement.remove();
}

/**
 * 建立串流訊息元素
 * @returns {HTMLElement} 訊息元素
 */
function createStreamingMessageElement() {
    const element = document.createElement('div');
    element.className = 'message assistant';
    element.id = 'streamingMessage';
    element.innerHTML = `
        <div class="message-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
            </svg>
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-role">AI</span>
                <span class="message-time">${formatTime(new Date())}</span>
            </div>
            <div class="message-body"></div>
        </div>
    `;
    return element;
}

/**
 * 更新串流訊息內容（增量更新，避免閃爍）
 * @param {HTMLElement} element - 內容元素
 * @param {string} content - 完整內容
 */
function updateStreamingContent(element, content) {
    // 使用 requestAnimationFrame 優化渲染效能
    requestAnimationFrame(() => {
        element.innerHTML = parseMarkdown(content);
        scrollToBottom();
    });
}

/**
 * 停止生成
 */
function stopGeneration() {
    console.log('[API] 停止生成');
    
    if (AppState.abortController) {
        AppState.abortController.abort();
    }
}

/**
 * 新增打字指示器
 */
function addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message assistant';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="message-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
            </svg>
        </div>
        <div class="message-content">
            <div class="message-body">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
    DOM.messages.appendChild(indicator);
    scrollToBottom();
}

/**
 * 移除打字指示器
 */
function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// ===================================
// 輸入處理
// ===================================

/**
 * 自動調整輸入框高度
 */
function autoResizeTextarea() {
    const textarea = DOM.messageInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

/**
 * 更新發送按鈕狀態
 */
function updateSendButton() {
    const hasContent = DOM.messageInput.value.trim().length > 0;
    DOM.sendBtn.disabled = !hasContent || AppState.isGenerating;
}

/**
 * 處理發送
 */
function handleSend() {
    const message = DOM.messageInput.value.trim();
    
    if (!message || AppState.isGenerating) return;
    
    DOM.messageInput.value = '';
    autoResizeTextarea();
    updateSendButton();
    
    sendMessage(message);
}

// ===================================
// Modal 控制
// ===================================

/**
 * 開啟設定 Modal
 */
function openSettingsModal() {
    DOM.apiKeyInput.value = AppState.apiKey;
    DOM.apiBaseInput.value = AppState.apiBase;
    DOM.defaultModelSelect.value = AppState.currentModel;
    DOM.streamToggle.checked = AppState.streamEnabled;
    DOM.settingsModal.classList.add('active');
}

/**
 * 關閉設定 Modal
 */
function closeSettingsModal() {
    DOM.settingsModal.classList.remove('active');
}

/**
 * 儲存設定
 */
function saveSettingsFromModal() {
    AppState.apiKey = DOM.apiKeyInput.value.trim();
    AppState.apiBase = DOM.apiBaseInput.value.trim() || 'https://api.openai.com/v1';
    AppState.currentModel = DOM.defaultModelSelect.value;
    AppState.streamEnabled = DOM.streamToggle.checked;
    
    DOM.modelSelect.value = AppState.currentModel;
    
    saveToStorage();
    closeSettingsModal();
    
    showToast('設定已儲存', 'success');
}

/**
 * 切換 API Key 顯示
 */
function toggleApiKeyVisibility() {
    const input = DOM.apiKeyInput;
    input.type = input.type === 'password' ? 'text' : 'password';
}

/**
 * 開啟參數 Modal
 */
function openParamModal() {
    updateParamDisplays();
    DOM.paramModal.classList.add('active');
}

/**
 * 關閉參數 Modal
 */
function closeParamModal() {
    DOM.paramModal.classList.remove('active');
}

/**
 * 套用參數
 */
function applyParams() {
    // 通用參數
    AppState.temperature = parseFloat(DOM.temperatureSlider.value);
    AppState.topP = parseFloat(DOM.topPSlider.value);
    AppState.maxTokens = parseInt(DOM.maxTokensSlider.value);
    AppState.presencePenalty = parseFloat(DOM.presenceSlider.value);
    AppState.frequencyPenalty = parseFloat(DOM.frequencySlider.value);
    
    // GPT-5.1 專屬參數
    if (DOM.reasoningEffortSelect) {
        AppState.reasoningEffort = DOM.reasoningEffortSelect.value;
    }
    if (DOM.verbositySelect) {
        AppState.verbosity = DOM.verbositySelect.value;
    }
    if (DOM.toneSelect) {
        AppState.tone = DOM.toneSelect.value;
    }
    
    saveToStorage();
    closeParamModal();
    
    showToast('參數已套用', 'success');
}

/**
 * 重設參數為預設值
 */
function resetParams() {
    // 通用參數
    DOM.temperatureSlider.value = 0.7;
    DOM.topPSlider.value = 1;
    DOM.maxTokensSlider.value = 4096;
    DOM.presenceSlider.value = 0;
    DOM.frequencySlider.value = 0;
    
    DOM.tempValue.textContent = '0.7';
    DOM.topPValue.textContent = '1';
    DOM.maxTokensValue.textContent = '4096';
    DOM.presenceValue.textContent = '0';
    DOM.frequencyValue.textContent = '0';
    
    // GPT-5.1 專屬參數
    if (DOM.reasoningEffortSelect) {
        DOM.reasoningEffortSelect.value = 'medium';
    }
    if (DOM.verbositySelect) {
        DOM.verbositySelect.value = 'medium';
    }
    if (DOM.toneSelect) {
        DOM.toneSelect.value = 'default';
    }
}

/**
 * 開啟系統提示 Modal
 */
function openSystemPromptModal() {
    DOM.systemPromptInput.value = AppState.systemPrompt;
    DOM.systemPromptModal.classList.add('active');
}

/**
 * 關閉系統提示 Modal
 */
function closeSystemPromptModal() {
    DOM.systemPromptModal.classList.remove('active');
}

/**
 * 儲存系統提示
 */
function saveSystemPromptFromModal() {
    AppState.systemPrompt = DOM.systemPromptInput.value.trim();
    
    // 更新當前對話的系統提示
    if (AppState.currentChatId) {
        AppState.chats[AppState.currentChatId].systemPrompt = AppState.systemPrompt;
    }
    
    updateSystemPromptBar();
    saveToStorage();
    closeSystemPromptModal();
    
    showToast('系統提示已更新', 'success');
}

/**
 * 清除系統提示
 */
function clearSystemPrompt() {
    AppState.systemPrompt = '';
    
    if (AppState.currentChatId) {
        AppState.chats[AppState.currentChatId].systemPrompt = '';
    }
    
    updateSystemPromptBar();
    saveToStorage();
    
    showToast('系統提示已清除', 'info');
}

// ===================================
// 事件綁定
// ===================================

function initEventListeners() {
    console.log('[Init] 綁定事件監聽器');
    
    // 側邊欄控制
    DOM.menuBtn.addEventListener('click', () => {
        DOM.sidebar.classList.add('active');
    });
    
    DOM.closeSidebar.addEventListener('click', () => {
        DOM.sidebar.classList.remove('active');
    });
    
    // 新對話
    DOM.newChatBtn.addEventListener('click', createNewChat);
    
    // 設定
    DOM.settingsBtn.addEventListener('click', openSettingsModal);
    DOM.closeSettings.addEventListener('click', closeSettingsModal);
    DOM.cancelSettings.addEventListener('click', closeSettingsModal);
    DOM.saveSettings.addEventListener('click', saveSettingsFromModal);
    DOM.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
    
    // 參數
    DOM.paramBtn.addEventListener('click', openParamModal);
    DOM.closeParam.addEventListener('click', closeParamModal);
    DOM.applyParams.addEventListener('click', applyParams);
    DOM.resetParams.addEventListener('click', resetParams);
    
    // 參數滑桿即時更新顯示
    DOM.temperatureSlider.addEventListener('input', (e) => {
        DOM.tempValue.textContent = e.target.value;
    });
    DOM.topPSlider.addEventListener('input', (e) => {
        DOM.topPValue.textContent = e.target.value;
    });
    DOM.maxTokensSlider.addEventListener('input', (e) => {
        DOM.maxTokensValue.textContent = e.target.value;
    });
    DOM.presenceSlider.addEventListener('input', (e) => {
        DOM.presenceValue.textContent = e.target.value;
    });
    DOM.frequencySlider.addEventListener('input', (e) => {
        DOM.frequencyValue.textContent = e.target.value;
    });
    
    
    // Prompt 管理
    DOM.addPromptBtn.addEventListener('click', openAddPromptModal);
    DOM.closePromptModal.addEventListener('click', closePromptModal);
    DOM.cancelPrompt.addEventListener('click', closePromptModal);
    DOM.savePrompt.addEventListener('click', savePromptFromModal);
    DOM.deletePrompt.addEventListener('click', deletePromptFromModal);
    
    // 系統提示
    DOM.editSystemPrompt.addEventListener('click', openSystemPromptModal);
    DOM.clearSystemPrompt.addEventListener('click', clearSystemPrompt);
    DOM.closeSystemPromptModal.addEventListener('click', closeSystemPromptModal);
    DOM.cancelSystemPrompt.addEventListener('click', closeSystemPromptModal);
    DOM.saveSystemPrompt.addEventListener('click', saveSystemPromptFromModal);
    
    // 模型選擇
    DOM.modelSelect.addEventListener('change', (e) => {
        AppState.currentModel = e.target.value;
        updateGpt5ParamsVisibility();
        saveToStorage();
        console.log('[Model] 切換模型:', AppState.currentModel);
    });
    
    // 輸入處理
    DOM.messageInput.addEventListener('input', () => {
        autoResizeTextarea();
        updateSendButton();
    });
    
    DOM.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
    
    DOM.sendBtn.addEventListener('click', handleSend);
    DOM.stopBtn.addEventListener('click', stopGeneration);
    
    // 快速 Prompt 按鈕
    document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.messageInput.value = btn.dataset.prompt;
            DOM.messageInput.focus();
            autoResizeTextarea();
            updateSendButton();
        });
    });
    
    // Modal 背景點擊關閉
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            const modal = overlay.parentElement;
            modal.classList.remove('active');
        });
    });
    
    // 鍵盤快捷鍵
    document.addEventListener('keydown', (e) => {
        // Escape 關閉 Modal
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
        
        // Ctrl/Cmd + N 新對話
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            createNewChat();
        }
    });
}

// ===================================
// PWA Service Worker 註冊
// ===================================

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('[SW] Service Worker 註冊成功:', registration.scope);
        } catch (error) {
            console.error('[SW] Service Worker 註冊失敗:', error);
        }
    }
}

// ===================================
// 應用程式初始化
// ===================================

function init() {
    console.log('[Init] AI Chat Studio 初始化');
    
    // 載入儲存的資料
    loadFromStorage();
    
    // 更新 UI
    DOM.modelSelect.value = AppState.currentModel;
    updateChatList();
    updatePromptList();
    updateMessages();
    updateSystemPromptBar();
    updateParamDisplays();
    
    // 綁定事件
    initEventListeners();
    
    // 註冊 Service Worker
    registerServiceWorker();
    
    // 如果沒有 API Key，提示設定
    if (!AppState.apiKey) {
        setTimeout(() => {
            showToast('請先設定 API Key 以開始使用', 'info');
        }, 1000);
    }
    
    console.log('[Init] 初始化完成');
}

// 啟動應用程式
document.addEventListener('DOMContentLoaded', init);

