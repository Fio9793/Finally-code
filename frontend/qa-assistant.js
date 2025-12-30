// qa-assistant.js - 修复版本，解决数据传递时机问题

/**
 * 鲸鱼助手模块
 * 负责处理问答界面交互等功能
 */

class QAAssistant {
    constructor() {
        this.isInitialized = false;
        this.currentData = [];
        this.filteredData = [];
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.position = { x: 30, y: 30 }; // 默认位置
        this.backendBaseUrl = 'http://localhost:3000'; // 明确指定后端地址
        this.lastSearchResults = []; // 保存最近的搜索結果
    }

    /**
     * 增强的数据验证和更新方法
     */
    validateAndUpdateData(currentData, filteredData) {
        // 验证数据有效性
        if (!currentData || !Array.isArray(currentData)) {
            console.warn('❌ 无效的currentData:', currentData);
            this.currentData = [];
        } else {
            this.currentData = currentData;
        }
        
        if (!filteredData || !Array.isArray(filteredData)) {
            console.warn('❌ 无效的filteredData:', filteredData);
            this.filteredData = this.currentData;
        } else {
            this.filteredData = filteredData;
        }
        
        console.log(`✅ 数据验证完成: ${this.currentData.length} 条总数据, ${this.filteredData.length} 条过滤数据`);
        
        // 调试：显示前5条数据的ID和标题
        if (this.currentData.length > 0) {
            console.log('📋 数据样本:', this.currentData.slice(0, 3).map(item => ({
                id: item.id,
                title: item.title?.substring(0, 30) + '...'
            })));
        }
    }

    /**
     * 从主应用获取数据的备用方法
     */
    getDataFromMainApp() {
        try {
            if (typeof window.getNewsData === 'function') {
                const data = window.getNewsData();
                console.log('📡 从主应用获取数据:', data.currentData.length);
                return data;
            }
        } catch (error) {
            console.error('从主应用获取数据失败:', error);
        }
        return { currentData: [], filteredData: [] };
    }

    /**
     * 初始化鲸鱼助手
     */
    init(currentData, filteredData) {
        if (this.isInitialized) {
            console.log('鲸鱼助手已经初始化，更新数据');
            this.validateAndUpdateData(currentData, filteredData);
            return;
        }

        console.log('初始化鲸鱼助手...');
        this.validateAndUpdateData(currentData, filteredData);
        
        this.bindAssistantEvents();
        this.bindQAEvents();
        this.initDragBehavior();
        this.testBackendConnection();
        
        this.isInitialized = true;
        console.log('🐋 鲸鱼助手初始化完成');
    }

    /**
     * 初始化拖动行为
     */
    initDragBehavior() {
        const assistant = document.getElementById('whale-assistant');
        if (!assistant) return;

        // 恢复保存的位置
        const savedPosition = this.getSavedPosition();
        if (savedPosition) {
            this.position = savedPosition;
            this.updatePosition();
        }

        // 鼠标按下事件
        assistant.addEventListener('mousedown', (e) => {
            this.startDrag(e);
        });

        // 触摸事件支持
        assistant.addEventListener('touchstart', (e) => {
            this.startDrag(e.touches[0]);
        });

        // 全局鼠标移动和抬起事件
        document.addEventListener('mousemove', (e) => {
            this.onDrag(e);
        });

        document.addEventListener('mouseup', () => {
            this.stopDrag();
        });

        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                this.onDrag(e.touches[0]);
                e.preventDefault();
            }
        });

        document.addEventListener('touchend', () => {
            this.stopDrag();
        });
    }

    /**
     * 开始拖动
     */
    startDrag(e) {
        const assistant = document.getElementById('whale-assistant');
        const rect = assistant.getBoundingClientRect();
        
        this.isDragging = true;
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        assistant.style.transition = 'none';
        assistant.style.cursor = 'grabbing';
        
        // 防止文本选择
        e.preventDefault();
    }

    /**
     * 拖动中
     */
    onDrag(e) {
        if (!this.isDragging) return;

        const assistant = document.getElementById('whale-assistant');
        const maxX = window.innerWidth - assistant.offsetWidth;
        const maxY = window.innerHeight - assistant.offsetHeight;

        // 计算新位置
        let newX = e.clientX - this.dragOffset.x;
        let newY = e.clientY - this.dragOffset.y;

        // 限制在窗口范围内
        newX = Math.max(10, Math.min(newX, maxX - 10));
        newY = Math.max(10, Math.min(newY, maxY - 10));

        // 更新位置
        this.position = { x: newX, y: newY };
        this.updatePosition();
    }

    /**
     * 停止拖动
     */
    stopDrag() {
        if (!this.isDragging) return;

        this.isDragging = false;
        const assistant = document.getElementById('whale-assistant');
        
        assistant.style.cursor = 'pointer';
        assistant.style.transition = 'all 0.3s ease';
        
        // 保存位置
        this.savePosition();
    }

    /**
     * 更新位置
     */
    updatePosition() {
        const assistant = document.getElementById('whale-assistant');
        if (assistant) {
            assistant.style.left = this.position.x + 'px';
            assistant.style.top = this.position.y + 'px';
        }
    }

    /**
     * 保存位置到本地存储
     */
    savePosition() {
        try {
            localStorage.setItem('whaleAssistantPosition', JSON.stringify(this.position));
        } catch (e) {
            console.warn('无法保存鲸鱼助手位置:', e);
        }
    }

    /**
     * 从本地存储获取位置
     */
    getSavedPosition() {
        try {
            const saved = localStorage.getItem('whaleAssistantPosition');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.warn('无法读取鲸鱼助手位置:', e);
            return null;
        }
    }

    /**
     * 测试后端连接 - 修复版本
     */
    async testBackendConnection() {
        try {
            console.log('🔗 测试后端连接...');
            
            const response = await fetch(`${this.backendBaseUrl}/health`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ 后端连接正常:', data.message);
                
                // 检查数据库状态
                if (data.databases) {
                    console.log('📊 数据库状态:', {
                        neo4j: data.databases.neo4j,
                        qdrant: data.databases.qdrant
                    });
                }
                
                this.showConnectionStatus('connected');
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('❌ 后端连接失败:', error.message);
            this.showConnectionStatus('disconnected');
            return false;
        }
    }

    /**
     * 显示连接状态
     */
    showConnectionStatus(status) {
        // 移除现有的状态提示
        const existingStatus = document.getElementById('backend-status');
        if (existingStatus) {
            existingStatus.remove();
        }

        const statusElement = document.createElement('div');
        statusElement.id = 'backend-status';
        statusElement.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 30px;
            background: ${status === 'connected' ? '#4CAF50' : '#e74c3c'};
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        statusElement.textContent = status === 'connected' ? '✅ 已连接后端' : '❌ 后端连接失败';
        
        document.body.appendChild(statusElement);
        
        // 5秒后自动隐藏
        setTimeout(() => {
            if (statusElement.parentNode) {
                statusElement.style.opacity = '0';
                statusElement.style.transition = 'opacity 0.5s';
                setTimeout(() => statusElement.remove(), 500);
            }
        }, 5000);
    }

    /**
     * 绑定助手事件
     */
    bindAssistantEvents() {
        const assistant = document.getElementById('whale-assistant');
        const modal = document.getElementById('qa-modal');
        const closeBtn = document.querySelector('.qa-close-btn');
        
        if (!assistant || !modal) {
            console.error('找不到鲸鱼助手元素');
            return;
        }
        
        // 点击鲸鱼打开问答窗口
        assistant.addEventListener('click', (e) => {
            // 如果是拖动结束的点击，不打开窗口
            if (this.isDragging) return;
            
            e.stopPropagation();
            modal.classList.add('active');
            document.getElementById('qa-question-input').focus();
        });
        
        // 关闭问答窗口
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
        
        // 热门问题点击事件
        this.bindPopularQuestions();
    }

    /**
     * 绑定热门问题事件
     */
    bindPopularQuestions() {
        const questionChips = document.querySelectorAll('.question-chip');
        questionChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const question = chip.getAttribute('data-question');
                document.getElementById('qa-question-input').value = question;
                this.askQuestion(question);
            });
        });
    }

    /**
     * 绑定问答事件
     */
    bindQAEvents() {
        const questionInput = document.getElementById('qa-question-input');
        const sendBtn = document.getElementById('qa-send-btn');
        
        if (!questionInput || !sendBtn) {
            console.error('找不到问答输入元素');
            return;
        }
        
        // 发送按钮点击事件
        sendBtn.addEventListener('click', () => {
            const question = questionInput.value.trim();
            if (question) {
                this.askQuestion(question);
            }
        });
        
        // 输入框回车事件
        questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const question = questionInput.value.trim();
                if (question) {
                    this.askQuestion(question);
                }
            }
        });
        
        // 输入框输入事件
        questionInput.addEventListener('input', () => {
            sendBtn.disabled = !questionInput.value.trim();
        });
    }

    /**
     * 提问函数 - 增强版本，支持查询扩展
     */
    async askQuestion(question) {
        const questionInput = document.getElementById('qa-question-input');
        const sendBtn = document.getElementById('qa-send-btn');
        
        // 添加用户消息
        this.addMessage(question, 'user');
        
        // 清空输入框
        questionInput.value = '';
        sendBtn.disabled = true;
        
        // 显示加载状态
        const loadingId = this.showLoading();
        
        try {
            // 扩展查询以改善检索效果
            const expandedQuery = this.expandQuery(question);
            console.log(`🔍 扩展查询: "${question}" -> "${expandedQuery}"`);
            
            // 调用真实API
            const apiResponse = await this.callQAAPI(expandedQuery);
            
            // 移除加载状态
            this.removeLoading(loadingId);
            
            if (apiResponse.success) {
                // 添加AI回复
                this.addMessage(apiResponse.answer, 'bot');
                
                // 显示搜索结果
                if (apiResponse.sources && apiResponse.sources.length > 0) {
                    this.displaySearchResults(apiResponse.sources);
                } else {
                    this.displaySearchResults([]);
                    this.addMessage('🤔 虽然生成了回答，但没有找到精确匹配的新闻来源。回答是基于通用知识生成的。', 'bot');
                }
            } else {
                // 如果API返回失败，显示错误信息
                this.addMessage(`抱歉，处理您的问题时出现了错误：${apiResponse.error || '未知错误'}`, 'bot');
                this.displaySearchResults([]);
            }
            
        } catch (error) {
            console.error('问答请求失败:', error);
            this.removeLoading(loadingId);
            
            // 显示错误信息
            this.addMessage('抱歉，无法连接到问答服务。请检查后端服务是否正常运行。', 'bot');
            this.displaySearchResults([]);
        }
    }

    /**
     * 查询扩展函数 - 改善检索效果
     */
    expandQuery(query) {
        const queryExpansions = {
            '海洋保护': '海洋环境保护 生态保护 海洋保护区 生物多样性',
            '污染': '污染治理 排放控制 环境清理 污染防治',
            'LNG': '液化天然气 清洁燃料 天然气动力 低碳能源',
            '技术': '技术创新 科技研发 新技术 智能化',
            '减排': '碳排放 温室气体 二氧化碳 碳减排',
            '政策': '法规政策 国际公约 环保标准 监管要求',
            '船舶': '航运 海运 船只 船队',
            '能源': '燃料 动力 新能源 清洁能源'
        };

        let expandedQuery = query;
        
        // 添加相关术语
        Object.keys(queryExpansions).forEach(key => {
            if (query.toLowerCase().includes(key.toLowerCase())) {
                expandedQuery += ' ' + queryExpansions[key];
            }
        });

        // 添加通用相关词
        expandedQuery += ' 海洋 航运 环境 环保 可持续';

        return expandedQuery;
    }

    /**
     * 调用真实QA API - 修复版本
     */
    async callQAAPI(question) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
            
            console.log(`📡 发送QA请求: "${question}"`);
            
            const response = await fetch(`${this.backendBaseUrl}/api/qa/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: question,
                    filters: {},
                    sessionId: 'whale_assistant'
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log(`✅ QA响应: ${result.success ? '成功' : '失败'}, 相关新闻: ${result.sources ? result.sources.length : 0}条`);
            
            return result;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('请求超时，请检查后端服务是否运行');
            }
            console.error('API调用失败:', error.message);
            throw error;
        }
    }

    /**
     * 添加消息到聊天界面
     */
    addMessage(content, type) {
        const messagesContainer = document.getElementById('qa-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const avatar = type === 'user' ? '👤' : '🐋';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${content}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const messagesContainer = document.getElementById('qa-messages');
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message bot-message';
        loadingDiv.id = 'qa-loading';
        
        loadingDiv.innerHTML = `
            <div class="message-avatar">🐋</div>
            <div class="message-content">
                <div class="qa-loading">
                    <span>思考中</span>
                    <div class="qa-loading-dots">
                        <div class="qa-loading-dot"></div>
                        <div class="qa-loading-dot"></div>
                        <div class="qa-loading-dot"></div>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return 'qa-loading';
    }

    /**
     * 移除加载状态
     */
    removeLoading(loadingId) {
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.remove();
        }
    }

   /**
 * 显示搜索结果 - 修复区域显示问题
 */
displaySearchResults(results) {
    console.log('📋 RAG返回的数据结构:', results.map(r => ({
        id: r.id,
        news_id: r.news_id,
        title: r.title,
        locations: r.locations,
        score: r.score
    })));
    
    // 保存最近的搜索结果，以便后续使用
    this.lastSearchResults = results;
    
    const resultsList = document.getElementById('results-list');
    const resultsCount = document.getElementById('results-count');
    
    resultsCount.textContent = results.length;
    
    // 显示/隐藏"查看全部"按钮
    const viewAllBtn = document.getElementById('view-all-kg-btn');
    if (viewAllBtn) {
        viewAllBtn.style.display = results.length > 0 ? 'block' : 'none';
    }
    
    if (results.length === 0) {
        resultsList.innerHTML = `
            <div class="no-data">
                <div>🔍 未找到相关新闻</div>
                <div style="font-size: 12px; color: #666; margin-top: 8px;">
                    建议尝试：
                    <ul style="text-align: left; margin: 8px 0;">
                        <li>使用更具体的关键词</li>
                        <li>扩大搜索范围</li>
                        <li>检查拼写是否正确</li>
                    </ul>
                </div>
            </div>
        `;
        return;
    }
    
    resultsList.innerHTML = results.map(result => {
        // 优先使用news_id（Neo4j中的Project节点ID），如果没有则使用id（Qdrant向量ID）
        // 注意：result.id是Qdrant向量ID，result.news_id才是Neo4j中的Project节点ID
        const newsId = String(result.news_id || result.id);
        
        // 处理各种字段
        const title = result.title || '无标题';
        const theme = result.theme || '未知主题';
        
        // 修复：改进区域信息处理逻辑
        let locations = '未知区域';
        if (result.locations) {
            if (Array.isArray(result.locations)) {
                // 过滤空值并连接
                locations = result.locations.filter(loc => loc && loc.trim()).join(', ') || '未知区域';
            } else if (typeof result.locations === 'string' && result.locations.trim()) {
                locations = result.locations.trim();
            }
        }
        
        // 尝试从其他字段获取位置信息
        if (locations === '未知区域') {
            if (result.raw_location && result.raw_location.trim()) {
                locations = result.raw_location.trim();
            } else if (result.location && result.location.trim()) {
                locations = result.location.trim();
            }
        }
        
        // 如果还是比较泛的描述，再尝试从主应用数据中取更具体的位置
        if (locations === '未知区域' || locations === '位置区域') {
            const mainNews = this.findNewsById(newsId);
            if (mainNews) {
                if (Array.isArray(mainNews.locations) && mainNews.locations.length > 0) {
                    locations = mainNews.locations
                        .filter(loc => loc && loc.trim())
                        .join(', ');
                } else if (typeof mainNews.location === 'string' && mainNews.location.trim()) {
                    locations = mainNews.location.trim();
                }
            }
        }
        
        const executor = result.executor || '未知执行方';
        const publishTime = result.publish_time || '未知时间';
        const score = result.score ? (result.score * 100).toFixed(1) : '0.0';
        
        return `
            <div class="result-item">
                <div class="result-content" onclick="qaAssistant.showNewsDetail('${newsId}')">
                    <div class="result-title" title="${title}">${title}</div>
                    <div class="result-meta">
                        <span class="result-theme" title="主题">🎯 ${theme}</span>
                        <span class="result-location" title="位置">📍 ${locations}</span>
                    </div>
                    <div class="result-meta">
                        <span class="result-time" title="发布时间">📅 ${publishTime}</span>
                        <span class="result-score" title="相关度">🎯 ${score}%</span>
                    </div>
                    ${executor && executor !== '未知执行方' ? 
                        `<div class="result-executor" title="执行方">👥 ${executor}</div>` : ''}
                </div>
                <div class="result-actions">
                    <button class="kg-link-btn" onclick="event.stopPropagation(); qaAssistant.viewInKnowledgeGraph(['${newsId}'])">
                        🔗 查看知识图谱
                    </button>
                </div>
            </div>
        `;
    }).join('');
}
    /**
     * 增强的新闻查找方法
     */
    findNewsById(newsId) {
        console.log('🔍 开始查找新闻:', newsId);
        
        // 如果内部数据为空，尝试从主应用获取
        if (this.currentData.length === 0) {
            console.log('🔄 内部数据为空，尝试从主应用获取...');
            const mainAppData = this.getDataFromMainApp();
            this.currentData = mainAppData.currentData;
            this.filteredData = mainAppData.filteredData;
        }
        
        // 方法1: 精确匹配ID
        let newsItem = this.filteredData.find(item => 
            String(item.id) === String(newsId)
        );
        
        if (newsItem) {
            console.log('✅ 方法1: 在过滤数据中找到新闻');
            return newsItem;
        }
        
        // 方法2: 在全部数据中查找
        newsItem = this.currentData.find(item => 
            String(item.id) === String(newsId)
        );
        
        if (newsItem) {
            console.log('✅ 方法2: 在全部数据中找到新闻');
            return newsItem;
        }
        
        // 方法3: 检查是否有news_id字段
        newsItem = this.currentData.find(item => 
            item.news_id && String(item.news_id) === String(newsId)
        );
        
        if (newsItem) {
            console.log('✅ 方法3: 通过news_id字段找到新闻');
            return newsItem;
        }
        
        // 方法4: 宽松匹配（去除前缀等）
        const cleanId = String(newsId).replace(/[^\d]/g, '');
        newsItem = this.currentData.find(item => 
            String(item.id).replace(/[^\d]/g, '') === cleanId
        );
        
        if (newsItem) {
            console.log('✅ 方法4: 通过清理后ID找到新闻');
            return newsItem;
        }
        
        console.log('❌ 所有查找方法都失败了');
        return null;
    }

    /**
     * 显示所有可能的匹配项（调试用）
     */
    findSimilarNews(newsId) {
        const similar = this.currentData.filter(item => 
            String(item.id).includes(String(newsId)) ||
            (item.news_id && String(item.news_id).includes(String(newsId))) ||
            (item.title && item.title.includes(String(newsId)))
        ).slice(0, 5);
        
        console.log('🔍 相似新闻:', similar.map(item => ({
            id: item.id,
            news_id: item.news_id,
            title: item.title?.substring(0, 50)
        })));
        
        return similar;
    }

    /**
     * 修复后的showNewsDetail方法
     */
    showNewsDetail(newsId) {
        console.log('🐋 鲸鱼助手查找新闻:', newsId);
        
        // 使用增强的查找方法
        const newsItem = this.findNewsById(newsId);
        
         if (newsItem) {
            console.log('✅ 成功找到新闻:', newsItem.title);

            // ⭐ 标记：本次新闻详情是从助手打开的
            window.newsDetailFromAssistant = true;
            
            // 关闭问答窗口
            const qaModal = document.getElementById('qa-modal');
            if (qaModal) {
                qaModal.classList.remove('active');
            }
            
            // 显示新闻详情（走主页面的 showNewsDetail 逻辑）
            if (typeof window.showNewsDetail === 'function') {
                window.showNewsDetail(newsItem);
            } else if (typeof window.showIndividualNewsDetail === 'function') {
                window.showIndividualNewsDetail(newsItem);
            } else {
                this.showFallbackNewsDetail(newsItem);
            }
        } else {
            console.warn('❌ 未找到新闻:', newsId);
            const similar = this.findSimilarNews(newsId);
            this.showNewsNotFound(newsId, similar);
        }
    }

    /**
     * 显示新闻未找到的提示
     */
    showNewsNotFound(newsId, similar = []) {
        const sidebar = document.getElementById('news-detail-sidebar');
        const content = document.getElementById('news-detail-content');
        const overlay = document.querySelector('.sidebar-overlay') || this.createOverlay();
        
        let similarHtml = '';
        if (similar.length > 0) {
            similarHtml = `
                <div class="news-detail-item">
                    <div class="news-detail-label">🔍 相似新闻</div>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${similar.map(item => `
                            <div class="similar-news-item" onclick="qaAssistant.showNewsDetail('${item.id}')" 
                                 style="border: 1px solid #e9ecef; padding: 8px; margin: 4px 0; border-radius: 4px; cursor: pointer;">
                                <div><strong>ID: ${item.id}</strong></div>
                                <div>${item.title?.substring(0, 50)}...</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div class="news-detail-title">❌ 新闻未找到</div>
            <div class="news-detail-item">
                <div class="news-detail-value">
                    无法找到ID为 <strong>${newsId}</strong> 的新闻。
                    <br><br>
                    可能的原因：
                    <ul>
                        <li>新闻数据已更新</li>
                        <li>该新闻已被筛选过滤</li>
                        <li>数据加载不完整</li>
                        <li>新闻ID不匹配</li>
                    </ul>
                    <br>
                    <button onclick="qaAssistant.retryFindNews('${newsId}')" 
                            style="background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        重新查找
                    </button>
                </div>
            </div>
            ${similarHtml}
        `;
        
        sidebar.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * 重新查找新闻
     */
    retryFindNews(newsId) {
        console.log('🔄 重新查找新闻:', newsId);
        this.showNewsDetail(newsId);
    }

    /**
     * 备用新闻详情显示
     */
    showFallbackNewsDetail(newsItem) {
        const sidebar = document.getElementById('news-detail-sidebar');
        const content = document.getElementById('news-detail-content');
        const overlay = document.querySelector('.sidebar-overlay') || this.createOverlay();
        
        content.innerHTML = `
            <div class="news-detail-title">${newsItem.title || '无标题'}</div>
            
            <div class="news-detail-item">
                <div class="news-detail-label">📅 发布时间</div>
                <div class="news-detail-value">${newsItem.publish_time || '未知'}</div>
            </div>
            
            ${newsItem.theme ? `
            <div class="news-detail-item">
                <div class="news-detail-label">🎯 主题</div>
                <div class="news-detail-value">${newsItem.theme}</div>
            </div>
            ` : ''}
            
            ${newsItem.locations && newsItem.locations.length > 0 ? `
            <div class="news-detail-item">
                <div class="news-detail-label">📍 位置信息</div>
                <div class="news-detail-list">
                    ${newsItem.locations.map(location => 
                        `<span class="news-detail-tag">${location}</span>`
                    ).join('')}
                </div>
            </div>
            ` : ''}
            
            ${newsItem.source_url ? `
            <div class="news-detail-item">
                <div class="news-detail-label">🔗 新闻来源</div>
                <div class="news-detail-value">
                    <a href="${newsItem.source_url}" target="_blank" class="news-detail-url">${newsItem.source_url}</a>
                </div>
            </div>
            ` : ''}
            
            <div class="news-detail-item">
                <div class="news-detail-label">🆔 新闻ID</div>
                <div class="news-detail-value">${newsItem.id || newsItem.news_id}</div>
            </div>
        `;
        
        sidebar.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * 创建遮罩层
     */
    createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = () => this.closeNewsDetail();
        document.body.appendChild(overlay);
        return overlay;
    }

    /**
     * 关闭新闻详情
     */
    closeNewsDetail() {
        const sidebar = document.getElementById('news-detail-sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        
        document.body.style.overflow = '';
    }

    /**
     * 更新数据引用
     */
    updateData(currentData, filteredData) {
        this.validateAndUpdateData(currentData, filteredData);
        console.log(`🔄 鲸鱼助手数据已更新: ${this.currentData.length} 条数据`);
    }

    /**
 * 跳转到知识图谱页面，显示指定新闻的关联
 * @param {Array<string>} newsIds - 新闻ID列表
 * @param {string} [viewMode] - 视图模式；'assistant_multi' 表示助手多新闻模式
 */
viewInKnowledgeGraph(newsIds, viewMode) {
    if (!newsIds || newsIds.length === 0) {
        console.warn('没有提供新闻ID');
        return;
    }

    const params = new URLSearchParams();
    params.set('newsIds', newsIds.join(','));
    if (viewMode) {
        params.set('viewMode', viewMode);
    }

    const kgUrl = `knowledge-graph.html?${params.toString()}`;
    console.log(`🔗 跳转到知识图谱，新闻ID: ${newsIds.join(', ')}, viewMode=${viewMode || 'default'}`);

    // 跳转到知识图谱页面
    window.location.href = kgUrl;
}


    /**
 * 查看所有搜索结果的知识图谱关联
 */
viewAllResultsInKnowledgeGraph() {
    let newsIds = [];

    // 1. 优先从保存的搜索结果中提取新闻ID
    if (this.lastSearchResults && this.lastSearchResults.length > 0) {
        newsIds = this.lastSearchResults
            .map(result => String(result.news_id || result.id))
            .filter(id => id && id !== 'undefined');
    }

    // 2. 如果还没拿到，再从 DOM 兜底提取
    if (!newsIds || newsIds.length === 0) {
        const resultsList = document.getElementById('results-list');
        if (!resultsList) {
            console.warn('无法找到结果列表');
        } else {
            const resultItems = resultsList.querySelectorAll('.result-item');
            newsIds = [];
            resultItems.forEach(item => {
                const kgBtn = item.querySelector('.kg-link-btn');
                if (kgBtn) {
                    const onclickAttr = kgBtn.getAttribute('onclick');
                    const match = onclickAttr && onclickAttr.match(/viewInKnowledgeGraph\(\[['"](.+?)['"]\]\)/);
                    if (match && match[1]) {
                        newsIds.push(match[1]);
                    }
                }
            });
        }
    }

    if (newsIds && newsIds.length > 0) {
        console.log(`🔗 准备以“助手多新闻模式”打开知识图谱，共 ${newsIds.length} 篇新闻`);
        // ⭐ 关键：带上 viewMode=assistant_multi
        this.viewInKnowledgeGraph(newsIds, 'assistant_multi');
    } else {
        console.warn('无法提取新闻ID列表');
    }
}

    /**
     * 打开问答窗口
     */
    openQA() {
        document.getElementById('qa-modal').classList.add('active');
        document.getElementById('qa-question-input').focus();
    }

    /**
     * 关闭问答窗口
     */
    closeQA() {
        document.getElementById('qa-modal').classList.remove('active');
    }
}

// 创建全局实例
const qaAssistant = new QAAssistant();



// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🐋 DOM加载完成，等待主应用数据...');
    
    // 等待主应用初始化完成
    const waitForData = () => {
        // 检查主应用是否已初始化并包含数据
        if (typeof currentData !== 'undefined' && currentData.length > 0) {
            console.log('🐋 主应用数据就绪，初始化鲸鱼助手:', currentData.length);
            qaAssistant.init(currentData, filteredData || currentData);
            return true;
        }
        return false;
    };
    
    // 立即尝试一次
    if (!waitForData()) {
        // 如果数据还没准备好，设置轮询
        const dataCheckInterval = setInterval(() => {
            if (waitForData()) {
                clearInterval(dataCheckInterval);
            }
        }, 100);
        
        // 10秒后超时
        setTimeout(() => {
            clearInterval(dataCheckInterval);
            if (!qaAssistant.isInitialized) {
                console.warn('🐋 数据等待超时，强制初始化');
                qaAssistant.init(currentData || [], filteredData || []);
            }
        }, 10000);
    }
});