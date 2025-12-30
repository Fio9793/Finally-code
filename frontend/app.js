let currentData = [];          // 原始数据
let filteredData = [];         // 筛选后的数据
let charts = {};               // 存储图表实例
let currentPage = 1;           // 当前页码
let pageSize = 10;             // 每页显示数量
let totalPages = 1;            // 总页数
let dataChanged = false;       // 标记数据是否变化，用于控制图表更新
// 记录最近一次从地图打开的区域上下文（用于“返回区域新闻汇总”）
let lastRegionContext = null;

// ⭐ 新增：时间趋势点击筛选的“基准数据集”，防止多次点击叠加过滤
let timeFilterBaseData = null;

// 标记本次 showNewsDetail 是否是从区域新闻汇总点进来的
let isInRegionDetailFlow = false;

// ⭐ 新增：标记本次新闻详情是否来自鲸鱼助手
window.newsDetailFromAssistant = false;


// 中英文关键词映射表
const KeywordTranslator = {
    // 污染相关
    '污染': ['pollution', 'contamination'],
    '海洋污染': ['marine pollution', 'ocean pollution'],
    '塑料污染': ['plastic pollution'],
    '油污': ['oil spill', 'oil pollution'],
    '化学污染': ['chemical pollution'],
    '废水': ['wastewater', 'sewage'],
    '排放': ['emission', 'discharge'],
    
    // 环保相关
    '环保': ['environmental', 'eco-friendly', 'green'],
    '保护': ['protection', 'conservation'],
    '生态': ['ecology', 'ecosystem'],
    '可持续': ['sustainable', 'sustainability'],
    '绿色': ['green'],
    '清洁': ['clean'],
    
    // 能源相关
    '能源': ['energy'],
    '燃料': ['fuel'],
    'LNG': ['lng', 'liquefied natural gas'],
    '天然气': ['natural gas'],
    '电动': ['electric'],
    '电池': ['battery'],
    '新能源': ['new energy', 'renewable energy'],
    '清洁能源': ['clean energy'],
    
    // 航运相关
    '航运': ['shipping', 'maritime'],
    '船舶': ['ship', 'vessel'],
    '港口': ['port', 'harbor'],
    '海运': ['maritime transport'],
    '航行': ['navigation', 'sailing'],
    '海事': ['maritime'],
    
    // 技术相关
    '技术': ['technology', 'technical'],
    '创新': ['innovation', 'innovative'],
    '智能': ['smart', 'intelligent'],
    '数字': ['digital'],
    '自动化': ['automation', 'automated'],
    '人工智能': ['ai', 'artificial intelligence'],
    
    // 政策法规
    '政策': ['policy'],
    '法规': ['regulation', 'law'],
    '标准': ['standard'],
    '合规': ['compliance'],
    '监管': ['supervision', 'regulation'],
    
    // 经济相关
    '经济': ['economic', 'economy'],
    '贸易': ['trade'],
    '市场': ['market'],
    '投资': ['investment'],
    '成本': ['cost'],
    '价格': ['price'],
    
    // 安全相关
    '安全': ['safety', 'security'],
    '事故': ['accident', 'incident'],
    '风险': ['risk'],
    
    // 区域相关
    '中国': ['china', 'chinese'],
    '美国': ['usa', 'united states', 'america'],
    '欧洲': ['europe', 'european'],
    '亚洲': ['asia', 'asian'],
    '太平洋': ['pacific'],
    '大西洋': ['atlantic'],
    '印度洋': ['indian ocean'],
    '南海': ['south china sea'],
    '东海': ['east china sea']
};

window.getNewsData = function() {
    return {
        currentData: currentData || [],
        filteredData: filteredData || []
    };
};

// 区域匹配系统 - 统一使用英文名称
const RegionMatcher = {
    regions: {
        // 海洋区域 - 统一英文名称
        'North Atlantic': { aliases: ['北大西洋', 'north atlantic'], coords: { lat: 40, lng: -40 }, type: 'ocean' },
        'South Atlantic': { aliases: ['南大西洋', 'south atlantic'], coords: { lat: -30, lng: -20 }, type: 'ocean' },
        'North Pacific': { aliases: ['北太平洋', 'north pacific'], coords: { lat: 30, lng: -160 }, type: 'ocean' },
        'South Pacific': { aliases: ['南太平洋', 'south pacific'], coords: { lat: -20, lng: -140 }, type: 'ocean' },
        'Indian Ocean': { aliases: ['印度洋', 'indian ocean'], coords: { lat: -10, lng: 70 }, type: 'ocean' },
        'Arctic Ocean': { aliases: ['北冰洋', 'arctic ocean'], coords: { lat: 80, lng: 0 }, type: 'ocean' },
        'South China Sea': { aliases: ['南海', 'south china sea'], coords: { lat: 15, lng: 115 }, type: 'ocean' },
        'East China Sea': { aliases: ['东海', 'east china sea'], coords: { lat: 30, lng: 125 }, type: 'ocean' },
        'Caribbean Sea': { aliases: ['加勒比海', 'caribbean sea'], coords: { lat: 15, lng: -75 }, type: 'ocean' },
        'Mediterranean Sea': { aliases: ['地中海', 'mediterranean sea'], coords: { lat: 35, lng: 15 }, type: 'ocean' },

        // 主要国家/地区 - 统一英文名称
        'United States': { aliases: ['美国', 'united states', 'usa'], coords: { lat: 39, lng: -98 }, type: 'country' },
        'China': { aliases: ['中国', 'china'], coords: { lat: 35, lng: 105 }, type: 'country' },
        'Japan': { aliases: ['日本', 'japan'], coords: { lat: 36, lng: 138 }, type: 'country' },
        'Australia': { aliases: ['澳大利亚', 'australia'], coords: { lat: -25, lng: 135 }, type: 'country' },
        'United Kingdom': { aliases: ['英国', 'united kingdom', 'uk'], coords: { lat: 55, lng: -3 }, type: 'country' },
        'Germany': { aliases: ['德国', 'germany'], coords: { lat: 51, lng: 10 }, type: 'country' },
        'France': { aliases: ['法国', 'france'], coords: { lat: 46, lng: 2 }, type: 'country' },
        'Brazil': { aliases: ['巴西', 'brazil'], coords: { lat: -14, lng: -52 }, type: 'country' },
        'India': { aliases: ['印度', 'india'], coords: { lat: 21, lng: 78 }, type: 'country' },
        'Russia': { aliases: ['俄罗斯', 'russia'], coords: { lat: 61, lng: 105 }, type: 'country' },
        'Canada': { aliases: ['加拿大', 'canada'], coords: { lat: 60, lng: -95 }, type: 'country' },
        'Norway': { aliases: ['挪威', 'norway'], coords: { lat: 65, lng: 12 }, type: 'country' },
        'Singapore': { aliases: ['新加坡', 'singapore'], coords: { lat: 1, lng: 104 }, type: 'country' },
        'South Korea': { aliases: ['韩国', 'south korea'], coords: { lat: 36, lng: 128 }, type: 'country' },
        'Netherlands': { aliases: ['荷兰', 'netherlands'], coords: { lat: 52, lng: 5 }, type: 'country' },
        
        // 其他重要区域 - 统一英文名称
        'Baltic Sea': { aliases: ['波罗的海'], coords: { lat: 58, lng: 20 }, type: 'ocean' },
        'North Sea': { aliases: ['北海'], coords: { lat: 56, lng: 3 }, type: 'ocean' },
        'Black Sea': { aliases: ['黑海'], coords: { lat: 43, lng: 34 }, type: 'ocean' },
        'Greenland': { aliases: ['格陵兰'], coords: { lat: 72, lng: -40 }, type: 'country' },
        'Finland': { aliases: ['芬兰'], coords: { lat: 64, lng: 26 }, type: 'country' },
        'Denmark': { aliases: ['丹麦'], coords: { lat: 56, lng: 10 }, type: 'country' },
        'Spain': { aliases: ['西班牙'], coords: { lat: 40, lng: -4 }, type: 'country' },
        'Italy': { aliases: ['意大利'], coords: { lat: 43, lng: 12 }, type: 'country' },
        'Turkey': { aliases: ['土耳其'], coords: { lat: 39, lng: 35 }, type: 'country' },
        'Indonesia': { aliases: ['印度尼西亚'], coords: { lat: -5, lng: 120 }, type: 'country' },
        'Malaysia': { aliases: ['马来西亚'], coords: { lat: 4, lng: 102 }, type: 'country' },
        'Philippines': { aliases: ['菲律宾'], coords: { lat: 13, lng: 122 }, type: 'country' },
        'Pakistan': { aliases: ['巴基斯坦'], coords: { lat: 30, lng: 70 }, type: 'country' },
        'Antarctica': { aliases: ['南极洲'], coords: { lat: -90, lng: 0 }, type: 'continent' },
        'Hong Kong': { aliases: ['香港'], coords: { lat: 22, lng: 114 }, type: 'region' }
    },

    // 特殊模式匹配 - 统一英文名称
    specialPatterns: {
        'United States': ['美国', 'usa', 'united states', '美利坚'],
        'China': ['中国', 'china', 'chinese', '中华人民共和国'],
        'Japan': ['日本', 'japan'],
        'United Kingdom': ['英国', 'uk', 'united kingdom', '英格兰'],
        'Germany': ['德国', 'germany'],
        'France': ['法国', 'france'],
        'South China Sea': ['南海', 'south china sea'],
        'East China Sea': ['东海', 'east china sea'],
        'North Atlantic': ['北大西洋', 'north atlantic'],
        'South Atlantic': ['南大西洋', 'south atlantic'],
        'North Pacific': ['北太平洋', 'north pacific'],
        'South Pacific': ['南太平洋', 'south pacific'],
        'Indian Ocean': ['印度洋', 'indian ocean'],
        'Arctic Ocean': ['北冰洋', 'arctic ocean']
    },

    // 添加区域名称规范化方法
    normalizeRegionName(regionName) {
        const matched = this.fuzzyMatchLocation(regionName);
        return matched || regionName;
    },

    // 批量匹配位置列表并返回统一英文名称
    matchLocations(locations) {
        if (!Array.isArray(locations)) return [];
        
        const matchedRegions = new Set();
        
        locations.forEach(location => {
            const matched = this.fuzzyMatchLocation(location);
            if (matched) {
                matchedRegions.add(matched); // 现在返回的都是英文名称
            }
        });
        
        return Array.from(matchedRegions);
    },

        // 在 RegionMatcher 对象中增强模糊匹配方法
     // 其他方法保持不变...
    fuzzyMatchLocation(location) {
        if (!location || typeof location !== 'string') return null;
        
        const cleanLocation = location.trim().toLowerCase();
        
        // 0. 过滤掉明显不完整的匹配
        if (cleanLocation.length < 2) return null;
        
        // 1. 精确匹配
        for (const [regionName, regionData] of Object.entries(this.regions)) {
            if (cleanLocation === regionName.toLowerCase()) return regionName;
        }

        // 2. 别名精确匹配
        for (const [regionName, regionData] of Object.entries(this.regions)) {
            if (regionData.aliases.some(alias => cleanLocation === alias.toLowerCase())) {
                return regionName;
            }
        }

        // 3. 包含匹配
        for (const [regionName, regionData] of Object.entries(this.regions)) {
            if (regionName.length >= 2 && cleanLocation.includes(regionName.toLowerCase())) {
                return regionName;
            }
            if (regionData.aliases.some(alias => 
                alias.length >= 2 && cleanLocation.includes(alias.toLowerCase())
            )) {
                return regionName;
            }
        }

        // 4. 分词匹配
        const words = cleanLocation.split(/[\s,\-\.\(\)]+/).filter(word => word.length >= 2);
        for (const word of words) {
            for (const [regionName, regionData] of Object.entries(this.regions)) {
                if (word === regionName.toLowerCase()) return regionName;
                if (regionData.aliases.some(alias => word === alias.toLowerCase())) {
                    return regionName;
                }
            }
        }

        // 5. 特殊模式匹配
        for (const [regionName, patterns] of Object.entries(this.specialPatterns)) {
            if (patterns.some(pattern => 
                pattern.length >= 2 && cleanLocation.includes(pattern.toLowerCase())
            )) {
                return regionName;
            }
        }

        return null;
    },

    getAllRegions() {
        return this.regions;
    }
};

// 在现有的 RegionMatcher 定义后添加区域合并功能
function initializeEnhancedRegions() {
    // 确保 RegionMatcher 存在
    if (typeof RegionMatcher === 'undefined') {
        console.warn('RegionMatcher 未定义，等待初始化...');
        setTimeout(initializeEnhancedRegions, 100);
        return;
    }
    
    // 检查是否有 DeepSeek 生成的区域数据
    if (typeof DeepSeekRegions !== 'undefined') {
        console.log('🎯 发现 DeepSeek 生成的锚点区域，开始合并...');
        
        // 合并区域数据
        Object.assign(RegionMatcher.regions, DeepSeekRegions);
        
        console.log(`✅ 成功合并 ${Object.keys(DeepSeekRegions).length} 个 DeepSeek 锚点区域`);
        console.log('📊 当前总区域数量:', Object.keys(RegionMatcher.regions).length);
        
        // 如果地图已经初始化，更新地图标记
        if (typeof updateMapMarkers === 'function' && charts.map) {
            console.log('🔄 更新地图锚点标记...');
            updateMapMarkers();
        }
    } else {
        console.log('ℹ️ 未找到 DeepSeek 区域数据，使用默认区域');
    }
}

// 在应用初始化完成后调用
document.addEventListener('DOMContentLoaded', function() {
    // 延迟执行以确保所有组件已初始化
    setTimeout(initializeEnhancedRegions, 1000);
});

/**
 * 数据格式转换函数 - 简化版本，后端已统一格式
 */
function convertDataFormat(data) {
    console.log('🔧 开始转换数据格式...');
    
    return data.map((item, index) => {
        // 预处理数据，清洗异常内容
        const cleanedItem = {
            id: item.id || index + 1,
            title: cleanNewsTitle(item.title),
            theme: item.theme || '',
            pollution_source: Array.isArray(item.pollution_source) ? item.pollution_source : [],
            measure: Array.isArray(item.measure) ? item.measure : [],
            executor: item.executor || '',
            effect_data: item.effect_data || '',
            source_url: item.source_url || '',
            publish_time: cleanNewsTime(item.publish_time),
            locations: Array.isArray(item.locations) ? item.locations : [],
            keywords: Array.isArray(item.keywords) ? item.keywords : [],
            entities: item.entities || item.executor || [],
            theme_categories: item.theme_categories || [],
            location_categories: item.location_categories || [],
            pollution_categories: item.pollution_categories || [],
            time_category: item.time_category || ''
        };
        
        return cleanedItem;
    });
}

/**
 * 检查是否包含中文字符
 */
function containsChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text);
}

/**
 * 翻译中文关键词为英文
 */
function translateChineseKeyword(keyword) {
    const cleanKeyword = keyword.trim().toLowerCase();
    
    // 首先尝试完全匹配
    if (KeywordTranslator[cleanKeyword]) {
        return KeywordTranslator[cleanKeyword];
    }
    
    // 尝试部分匹配（包含关系）
    const matchedTranslations = [];
    for (const [chinese, englishList] of Object.entries(KeywordTranslator)) {
        if (cleanKeyword.includes(chinese) || chinese.includes(cleanKeyword)) {
            matchedTranslations.push(...englishList);
        }
    }
    
    // 去重
    const uniqueTranslations = [...new Set(matchedTranslations)];
    
    return uniqueTranslations.length > 0 ? uniqueTranslations : [keyword];
}

/**
 * 处理搜索关键词 - 支持中英文混合搜索
 */
function processSearchKeyword(keyword) {
    if (!keyword || !containsChinese(keyword)) {
        return [keyword.toLowerCase()];
    }
    
    // 中文关键词，翻译为英文
    const englishKeywords = translateChineseKeyword(keyword);
    console.log(`🔤 关键词翻译: "${keyword}" ->`, englishKeywords);
    
    // 同时保留原中文关键词，以便在可能的中文字段中搜索
    return [keyword, ...englishKeywords];
}


async function init() {
    try {
        console.log('正在初始化应用...');
        
        // 尝试从后端API获取真实数据
        console.log('正在从后端API加载数据...');
        
        // 修复：请求所有数据，不限制数量
        const response = await fetch('http://localhost:3000/api/news?limit=10000');
        
        if (response.ok) {
            const data = await response.json();
            console.log('📡 API返回原始数据:', data);
            
            if (data.success && data.news) {
                // 转换数据格式
                currentData = convertDataFormat(data.news);
                console.log(`✅ 成功加载 ${currentData.length} 条新闻数据`);
                
                if (currentData.length > 0) {
                    const sample = currentData[0];
                    console.log('📋 第一条数据完整结构:', sample);
                    console.log('📊 数据总量统计:', {
                        总条数: currentData.length,
                        位置字段示例: sample.locations,
                        执行方示例: sample.executor,
                        关键词示例: sample.keywords
                    });
                }
            } else {
                throw new Error('API返回数据格式错误');
            }

                setTimeout(() => {
                analyzeLocationMatching();
            }, 2000);
        } else {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        // 在初始化完成后添加区域匹配统计
        setTimeout(() => {
            analyzeLocationMatching();
            logNewsCountPerRegion(); // 添加这一行，仅控制台输出
        }, 2000);
        
    } catch (error) {
        console.warn('无法连接到后端API，使用模拟数据:', error.message);
        currentData = typeof newsData !== 'undefined' ? convertDataFormat(newsData) : [];
        console.log(`📋 使用模拟数据: ${currentData.length} 条记录`);
    }
    // 初始化其他组件
    filteredData = [...currentData];
    updateStatistics();
    initFilters();
    initPagination();
    renderNewsList();
    initCharts();
    bindEvents();
    bindSidebarEvents();
    showDataStatus();
    
    document.getElementById('update-charts-btn').disabled = true;
    dataChanged = false;
    
    // 立即通知鲸鱼助手更新数据
    if (typeof qaAssistant !== 'undefined') {
        console.log('🔄 通知鲸鱼助手更新数据...');
        if (qaAssistant.isInitialized) {
            qaAssistant.updateData(currentData, filteredData);
        } else {
            qaAssistant.init(currentData, filteredData);
        }
    }
    
    console.log('应用初始化完成');
    
    // 检查知识图谱状态
    await checkKnowledgeGraphStatus();
}

/**
 * 分析位置匹配效果
 */
function analyzeLocationMatching() {
    const matchResults = {
        totalLocations: 0,
        matchedLocations: 0,
        regionStats: {}
    };
    
    currentData.forEach(item => {
        if (item.locations && Array.isArray(item.locations)) {
            item.locations.forEach(location => {
                matchResults.totalLocations++;
                const matched = RegionMatcher.fuzzyMatchLocation(location);
                if (matched) {
                    matchResults.matchedLocations++;
                    matchResults.regionStats[matched] = (matchResults.regionStats[matched] || 0) + 1;
                }
            });
        }
    });
    
    const matchRate = (matchResults.matchedLocations / matchResults.totalLocations * 100).toFixed(2);
    console.log('📍 位置匹配分析:', {
        总位置数: matchResults.totalLocations,
        匹配成功数: matchResults.matchedLocations,
        匹配率: `${matchRate}%`,
        各区域匹配数量: matchResults.regionStats
    });
}

async function checkKnowledgeGraphStatus() {
    try {
        const response = await fetch('/api/knowledge-graph/status');
        if (response.ok) {
            const result = await response.json();
            updateKGStatusIndicator(result);
        }
    } catch (error) {
        console.warn('检查知识图谱状态失败:', error);
        updateKGStatusIndicator({ success: false });
    }
}

function updateKGStatusIndicator(status) {
    const statusElement = document.getElementById('kg-status');
    if (!statusElement) return;
    
    const dot = statusElement.querySelector('.status-dot');
    const text = statusElement.querySelector('.status-text');
    
    if (status.success) {
        if (status.status === 'built') {
            dot.style.backgroundColor = '#27ae60';
            text.textContent = `知识图谱: ${status.statistics.nodes}节点 ${status.statistics.relationships}关系`;
        } else {
            dot.style.backgroundColor = '#f39c12';
            text.textContent = '知识图谱: 未构建';
        }
    } else {
        dot.style.backgroundColor = '#e74c3c';
        text.textContent = '知识图谱: 连接失败';
    }
}

/**
 * 显示数据状态信息
 */
function showDataStatus() {
    const hasBackendData = currentData.length > 0 && currentData !== newsData;
    const statusMessage = hasBackendData ? 
        `✅ 已连接后端数据库 (${currentData.length} 条记录)` : 
        '⚠️ 使用模拟数据 (后端连接失败)';
    
    console.log(statusMessage);
    
    const statusElement = document.createElement('div');
    statusElement.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: ${hasBackendData ? '#4CAF50' : '#FF9800'};
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
    `;
    statusElement.textContent = statusMessage;
    document.body.appendChild(statusElement);
    
    setTimeout(() => {
        statusElement.remove();
    }, 5000);
}

// 混合分类系统 - 结合预定义主题和关键词
const HybridClassifier = {
    // 扩展的主题分类
    themes: {
        '环保减排': ['排放', '减排', '碳', 'co2', '温室气体', '气候', '环境', '可持续', '环保', '绿色'],
        '能源技术': ['lng', '能源', '燃料', '电力', '电动', '混合', '电池', '推进', '新能源', '清洁能源'],
        '航运物流': ['航运', '海运', '船舶', '船只', '港口', '物流', '运输', '航行', '海事'],
        '政策法规': ['法规', '政策', '合规', '标准', '法律', '条约', '协议', '监管'],
        '科技创新': ['技术', '创新', '数字', '人工智能', '自主', '智能', '自动化', '数字化'],
        '安全运营': ['安全', '安保', '运营', '维护', '风险', '事故', '事件', '操作'],
        '经济发展': ['经济', '贸易', '市场', '投资', '金融', '成本', '价格', '经济性'],
        '船舶制造': ['造船', '船厂', '建造', '设计', '船体', '发动机', '设备'],
        '海洋保护': ['海洋', '保护', '生态', '生物', '污染', '塑料', '海洋垃圾']
    },

    // 分类新闻
    classifyNews(item) {
        const matchedThemes = new Set();
        const content = (item.title + ' ' + (item.keywords ? item.keywords.join(' ') : '')).toLowerCase();
        
        // 基于预定义主题匹配
        Object.entries(this.themes).forEach(([theme, keywords]) => {
            if (keywords.some(keyword => content.includes(keyword.toLowerCase()))) {
                matchedThemes.add(theme);
            }
        });
        
        return matchedThemes;
    },

    // 获取主题统计
    getThemeStats(data) {
        const themeStats = {};
        Object.keys(this.themes).forEach(theme => {
            themeStats[theme] = 0;
        });
        
        data.forEach(item => {
            const themes = this.classifyNews(item);
            themes.forEach(theme => {
                themeStats[theme] = (themeStats[theme] || 0) + 1;
            });
        });
        
        return themeStats;
    }
};

function updateStatistics() {
    // 新闻总量
    const totalNews = currentData.length;
    document.getElementById('total-news').textContent = totalNews.toLocaleString();
    
    // 涉及区域 - 使用统一英文名称
    const allRegions = new Set();
    
    currentData.forEach(item => {
        if (item.locations && Array.isArray(item.locations)) {
            const matchedRegions = RegionMatcher.matchLocations(item.locations);
            matchedRegions.forEach(region => allRegions.add(region));
        }
    });
    
    document.getElementById('total-regions').textContent = allRegions.size.toLocaleString();
    
    console.log('统计信息:', {
        新闻总量: totalNews,
        涉及区域: allRegions.size,
        匹配到的区域: Array.from(allRegions)
    });
}

/**
 * 初始化筛选器选项
 */
function initFilters() {
    const regionFilter = document.getElementById('region-filter');
    const topicFilter = document.getElementById('topic-filter');
    
    const locations = new Set();
    const keywords = new Set();
    const themes = new Set();
    
    currentData.forEach(item => {
        // 处理位置（现在每个新闻只有一个location）
        if (item.locations && Array.isArray(item.locations)) {
            item.locations.forEach(location => locations.add(location));
        }
        // 处理关键词
        if (item.keywords && Array.isArray(item.keywords)) {
            item.keywords.forEach(keyword => keywords.add(keyword));
        }
        // 处理主题
        if (item.theme) {
            themes.add(item.theme);
        }
    });
    
    // 清空现有选项
    regionFilter.innerHTML = '<option value="">所有区域</option>';
    topicFilter.innerHTML = '<option value="">所有主题</option>';
    
    // 添加位置选项
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        regionFilter.appendChild(option);
    });
    
    // 添加关键词和主题选项
    keywords.forEach(keyword => {
        const option = document.createElement('option');
        option.value = keyword;
        option.textContent = keyword;
        topicFilter.appendChild(option);
    });
    
    // 可选：添加主题到筛选器
    themes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme;
        option.textContent = theme;
        topicFilter.appendChild(option);
    });
}

/**
 * 分页相关函数
 */
function initPagination() {
    updatePaginationInfo();
    renderPaginationControls();
}

function updatePaginationInfo() {
    const totalItems = filteredData.length;
    totalPages = Math.ceil(totalItems / pageSize);
    
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, totalItems);
    
    document.getElementById('start-index').textContent = startIndex;
    document.getElementById('end-index').textContent = endIndex;
    document.getElementById('total-count').textContent = totalItems;
}

function renderPaginationControls() {
    const pageNumbers = document.getElementById('page-numbers');
    pageNumbers.innerHTML = '';
    
    let startPage = Math.max(1, currentPage - 3);
    let endPage = Math.min(totalPages, startPage + 6);
    
    if (endPage - startPage < 6) {
        startPage = Math.max(1, endPage - 6);
    }
    
    if (startPage > 1) {
        const firstPage = document.createElement('button');
        firstPage.className = 'page-number';
        firstPage.textContent = '1';
        firstPage.onclick = () => goToPage(1);
        pageNumbers.appendChild(firstPage);
        
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            pageNumbers.appendChild(ellipsis);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => goToPage(i);
        pageNumbers.appendChild(pageBtn);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'page-ellipsis';
            ellipsis.textContent = '...';
            pageNumbers.appendChild(ellipsis);
        }
        
        const lastPage = document.createElement('button');
        lastPage.className = 'page-number';
        lastPage.textContent = totalPages;
        lastPage.onclick = () => goToPage(totalPages);
        pageNumbers.appendChild(lastPage);
    }
    
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages;
}

function goToPage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    
    currentPage = page;
    renderNewsList();
    updatePaginationInfo();
    renderPaginationControls();
}

/**
 * 渲染新闻列表 - 优化版本，支持文本截断和tooltip
 */
function renderNewsList() {
    const newsList = document.getElementById('news-list');
    newsList.innerHTML = '';
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredData.length);
    const currentPageData = filteredData.slice(startIndex, endIndex);
    
    if (currentPageData.length === 0) {
        newsList.innerHTML = '<div class="no-data">暂无数据</div>';
        return;
    }
    
    currentPageData.forEach((item, index) => {
        const newsItem = document.createElement('div');
        newsItem.className = 'news-item';
        newsItem.onclick = () => showNewsDetail(item);
        
        // 可选：方便定位
        if (item.id != null) {
            newsItem.dataset.newsId = item.id;
        }

        // 准备tooltip内容
        const tooltipContent = `
            <strong>标题:</strong> ${item.title || '无标题'}<br>
            <strong>位置:</strong> ${item.locations ? item.locations.join(', ') : '未知'}<br>
            <strong>时间:</strong> ${item.publish_time || '未知'}<br>
            <strong>执行方:</strong> ${item.executor || '无'}<br>
            <strong>关键词:</strong> ${item.keywords ? item.keywords.slice(0, 5).join(', ') : '无'}
        `;
        
        // 优化后的新闻项布局，支持文本截断
        newsItem.innerHTML = `
            <div class="news-item-tooltip">${tooltipContent}</div>
            <h4 title="${item.title || '无标题'}">${item.title || '无标题'}</h4>
            <div class="news-meta" title="位置: ${item.locations ? item.locations.join(', ') : '未知'} | 时间: ${item.publish_time || '未知'}">
                <strong>位置:</strong> ${item.locations ? item.locations.join(', ') : '未知'} | 
                <strong>发布时间:</strong> ${item.publish_time || '未知'}
            </div>
            <div class="news-meta" title="执行方: ${item.executor || '无'}">
                <strong>执行方:</strong> ${item.executor || '无'}
            </div>
            <div class="news-keywords" title="关键词: ${item.keywords ? item.keywords.slice(0, 5).join(', ') : '无'}">
                <strong>关键词:</strong> ${item.keywords ? item.keywords.slice(0, 5).join(', ') : '无'}
            </div>
        `;
        
        // ★ 新增：hover 时高亮对应区域锚点
        newsItem.addEventListener('mouseenter', () => {
            try {
                if (!item.locations || !Array.isArray(item.locations)) return;
                if (typeof RegionMatcher === 'undefined' || !RegionMatcher.matchLocations) return;

                const matchedRegions = RegionMatcher.matchLocations(item.locations);
                if (!matchedRegions || matchedRegions.length === 0) return;

                const englishName = RegionMatcher.normalizeRegionName(matchedRegions[0]);
                if (!englishName) return;

                highlightAnchorByRegion(englishName);
            } catch (err) {
                console.warn('列表 hover 高亮锚点失败:', err);
            }
        });

        newsItem.addEventListener('mouseleave', () => {
            clearAnchorHighlight();
        });

        newsList.appendChild(newsItem);
    });
}

// 统一从新闻记录里解析出一个 Date 对象
function getNewsDate(item) {
    // 1) 优先用 publish_time
    if (item.publish_time) {
        let t = item.publish_time.toString().trim();
        if (!t) return null;

        // 统一一下分隔符
        t = t.replace(/\//g, '-');

        // 只写了日期：YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
            return new Date(t + 'T00:00:00');
        }

        // 日期 + 时间：YYYY-MM-DD HH:MM[:SS]
        if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(t)) {
            if (!/:..$/.test(t)) {
                t = t + ':00'; // 没写秒就补一个
            }
            return new Date(t.replace(' ', 'T'));
        }
    }

    // 2) 没有 publish_time，就尝试 time_category，例如 "2025 Q1"
    if (item.time_category) {
        const m = item.time_category.toString().trim().match(/(\d{4})\s*Q([1-4])/i);
        if (m) {
            const year = parseInt(m[1], 10);
            const quarter = parseInt(m[2], 10);
            const quarterStartMonth = { 1: 1, 2: 4, 3: 7, 4: 10 }[quarter] || 1;
            // 用该季度的第一天作为代表日期
            return new Date(year, quarterStartMonth - 1, 1);
        }
    }

    return null;
}


/**
 * 改进的搜索功能 - 支持中英文混合搜索
 */
function searchNews() {

    timeFilterBaseData = null;
    const originalKeyword = document.getElementById('keyword-search').value.trim();
    const region = document.getElementById('region-filter').value;
    const topic = document.getElementById('topic-filter').value;
    
     // 新增：读取起始日期
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');

    const startDate = startInput && startInput.value
        ? new Date(startInput.value + 'T00:00:00')
        : null;
    const endDate = endInput && endInput.value
        ? new Date(endInput.value + 'T23:59:59')
        : null;

    console.log('搜索参数:', { originalKeyword, region, topic });
    
    // 处理关键词翻译
    const searchKeywords = processSearchKeyword(originalKeyword);
    console.log('🔍 实际搜索关键词:', searchKeywords);
    
    filteredData = currentData.filter(item => {
        // 关键词匹配 - 多字段搜索
        let matchKeyword = true;
        if (originalKeyword) {
            const searchFields = [
                item.title || '',
                item.theme || '',
                item.executor || '',
                item.pollution_source || '',
                item.measure || '',
                item.effect_data || '',
                ...(item.keywords || []),
                ...(item.locations || [])
            ].map(field => field.toString().toLowerCase());
            
            // 使用更宽松的匹配策略，支持多个关键词
            matchKeyword = searchKeywords.some(keyword => {
                if (!keyword) return false;
                
                return searchFields.some(field => {
                    if (!field) return false;
                    
                    // 1. 完全匹配
                    if (field === keyword.toLowerCase()) return true;
                    
                    // 2. 包含匹配
                    if (field.includes(keyword.toLowerCase())) return true;
                    
                    // 3. 分词匹配（针对中文）
                    if (containsChinese(keyword)) {
                        return keyword.split('').some(char => field.includes(char));
                    }
                    
                    // 4. 模糊匹配（针对英文）
                    return keyword.toLowerCase().split(/\s+/).some(word => 
                        field.includes(word) || 
                        (word.length > 3 && field.includes(word.substring(0, word.length - 1)))
                    );
                });
            });
        }
        
        // 区域匹配
        const matchRegion = !region || 
            (item.locations && item.locations.some(location => 
                location && location.toString().toLowerCase().includes(region.toLowerCase())
            ));
        
        // 主题匹配
        const matchTopic = !topic || 
            (item.keywords && item.keywords.some(kw => 
                kw && kw.toString().toLowerCase().includes(topic.toLowerCase())
            )) ||
            (item.theme && item.theme.toString().toLowerCase().includes(topic.toLowerCase()));

        // ★ 新增：时间匹配
        let matchDate = true;
        if (startDate || endDate) {
            const newsDate = getNewsDate(item);
            if (!newsDate) {
                // 没法解析时间的新闻，在有时间条件时就不纳入
                matchDate = false;
            } else {
                if (startDate && newsDate < startDate) matchDate = false;
                if (endDate && newsDate > endDate) matchDate = false;
            }
        }
        
         return matchKeyword && matchRegion && matchTopic && matchDate;
    });
    
    console.log(`搜索完成: 找到 ${filteredData.length} 条结果`);
    
    // 显示搜索统计
    showSearchStats(originalKeyword);
    
    currentPage = 1;
    renderNewsList();
    updatePaginationInfo();
    renderPaginationControls();
    
    dataChanged = true;
    document.getElementById('update-charts-btn').disabled = false;
    showUpdateHint();
    
    // 更新助手的数据引用
    if (typeof qaAssistant !== 'undefined') {
        qaAssistant.updateData(currentData, filteredData);
    }
}

function showSearchStats(searchTerm) {
    const totalResults = filteredData.length;

    const statsElement = document.createElement('div');
    statsElement.className = 'search-stats';

    let statsHTML = `
        <div style="background: #e3f2fd; padding: 8px 12px; border-radius: 4px; margin: 10px 0;">
            <strong>搜索统计:</strong> 
    `;

    if (searchTerm) {
        // 有关键词
        statsHTML += `
            搜索词 "<span style="color: #1976d2;">${searchTerm}</span>" 
            找到 <span style="color: #d32f2f; font-weight: bold;">${totalResults}</span> 条结果
        `;
    } else {
        // 没有关键词，只根据区域 / 主题 / 时间等条件筛选
        statsHTML += `
            当前筛选条件找到 
            <span style="color: #d32f2f; font-weight: bold;">${totalResults}</span> 条结果
        `;
    }

    // 结果为 0 时的提示
    if (totalResults === 0 && searchTerm) {
        statsHTML += ` - 尝试使用更广泛的关键词`;

        if (containsChinese(searchTerm)) {
            statsHTML += `<br><small>💡 提示: 系统会自动将中文关键词翻译为英文进行搜索</small>`;
        }
    }

    // ⭐ 新增：如果当前处于“时间筛选”状态，给一个一键清除入口
    if (timeFilterBaseData && Array.isArray(timeFilterBaseData) && timeFilterBaseData.length > 0) {
        statsHTML += `
            <button type="button" class="clear-time-filter-btn" onclick="clearTimeFilter()">
                清除时间筛选
            </button>
        `;
    }

    statsHTML += `</div>`;
    statsElement.innerHTML = statsHTML;

    const newsListSection = document.querySelector('.news-list-section');
    const existingStats = newsListSection.querySelector('.search-stats');
    if (existingStats) {
        existingStats.remove();
    }
    newsListSection.insertBefore(statsElement, newsListSection.firstChild);
}

/**
 * 仅清除时间筛选（保留左侧其他筛选条件）
 */
function clearTimeFilter() {
    if (!timeFilterBaseData || !Array.isArray(timeFilterBaseData) || timeFilterBaseData.length === 0) {
        console.log('当前没有激活的时间筛选');
        return;
    }

    // 恢复为“时间筛选之前”的那一批新闻
    filteredData = [...timeFilterBaseData];
    timeFilterBaseData = null;

    currentPage = 1;
    renderNewsList();
    updatePaginationInfo();
    renderPaginationControls();

    // 联动更新地图锚点
    updateMapMarkers();

    // 更新搜索统计文案，让它反映当前（非时间）筛选条件
    try {
        const keyword = document.getElementById('keyword-search')?.value.trim() || '';
        const region = document.getElementById('region-filter')?.value || '';
        const topic = document.getElementById('topic-filter')?.value || '';

        const parts = [];
        if (keyword) parts.push(`关键词: ${keyword}`);
        if (region) parts.push(`区域: ${region}`);
        if (topic) parts.push(`主题: ${topic}`);

        const summary = parts.join(' / ');
        showSearchStats(summary);
    } catch (e) {
        console.warn('更新搜索统计时出错，但不影响功能:', e);
        showSearchStats('');
    }
}


/**
 * 清空筛选条件
 */
function clearFilters() {
    timeFilterBaseData = null;

    document.getElementById('keyword-search').value = '';
    document.getElementById('region-filter').value = '';
    document.getElementById('topic-filter').value = '';
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    filteredData = [...currentData];
    
    currentPage = 1;
    renderNewsList();
    updatePaginationInfo();
    renderPaginationControls();
    
    dataChanged = true;
    document.getElementById('update-charts-btn').disabled = false;
    showUpdateHint();

    // 更新助手的数据引用
    if (typeof qaAssistant !== 'undefined') {
        qaAssistant.updateData(currentData, filteredData);
    }
    
}

/**
 * 显示更新提示
 */
function showUpdateHint() {
    const existingHint = document.getElementById('update-hint');
    if (existingHint) {
        existingHint.remove();
    }
    
    const hintElement = document.createElement('div');
    hintElement.id = 'update-hint';
    hintElement.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: #f39c12;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: fadeIn 0.3s;
    `;
    hintElement.innerHTML = `<span>🔔 数据已更新，点击"更新图表"按钮同步图表</span>`;
    
    document.body.appendChild(hintElement);
    
    setTimeout(() => {
        if (hintElement.parentNode) {
            hintElement.style.animation = 'fadeOut 0.3s';
            setTimeout(() => hintElement.remove(), 300);
        }
    }, 10000);
}

/**
 * 更新图表 - 手动触发
 */
function updateCharts() {
    if (!dataChanged) {
        console.log('数据未变化，跳过图表更新');
        return;
    }
    
    console.log('开始更新图表...');
    
    const updateBtn = document.getElementById('update-charts-btn');
    updateBtn.disabled = true;
    updateBtn.textContent = '更新中...';
    
    try {
        updateMapMarkers();
        updateECharts();
        dataChanged = false;
        showUpdateSuccess();
        
    } catch (error) {
        console.error('图表更新失败:', error);
        showUpdateError(error.message);
    } finally {
        setTimeout(() => {
            updateBtn.textContent = '更新图表';
        }, 1000);
    }
}

/**
 * 更新地图标记
 */
function updateMapMarkers() {
    if (!charts.map) {
        console.warn('地图未初始化，跳过更新');
        return;
    }
    
    console.log('更新地图锚点标记...');
    
    if (charts.map._anchors) {
        charts.map._anchors.forEach(anchor => {
            charts.map.removeLayer(anchor);
        });
        charts.map._anchors = [];
    }
    
    removeHighlight(charts.map);
    addNewsAnchors(charts.map);
}

/**
 * 更新 ECharts 图表
 */
function updateECharts() {
    console.log('更新 ECharts 图表...');
    
    if (charts.time && typeof charts.time.dispose === 'function') {
        charts.time.dispose();
    }
    initTimeChart();
    
    if (charts.wordcloud && typeof charts.wordcloud.dispose === 'function') {
        charts.wordcloud.dispose();
    }
    initWordCloudChart();
}

/**
 * 显示更新成功提示
 */
function showUpdateSuccess() {
    const existingHint = document.getElementById('update-hint');
    if (existingHint) {
        existingHint.remove();
    }
    
    const successElement = document.createElement('div');
    successElement.id = 'update-success';
    successElement.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: #27ae60;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: fadeIn 0.3s;
    `;
    successElement.innerHTML = `<span>✅ 图表已更新</span>`;
    
    document.body.appendChild(successElement);
    
    setTimeout(() => {
        if (successElement.parentNode) {
            successElement.style.animation = 'fadeOut 0.3s';
            setTimeout(() => successElement.remove(), 300);
        }
    }, 3000);
}

/**
 * 显示更新错误提示
 */
function showUpdateError(errorMessage) {
    const errorElement = document.createElement('div');
    errorElement.id = 'update-error';
    errorElement.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: #e74c3c;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: fadeIn 0.3s;
    `;
    errorElement.innerHTML = `<span>❌ 图表更新失败: ${errorMessage}</span>`;
    
    document.body.appendChild(errorElement);
    
    setTimeout(() => {
        if (errorElement.parentNode) {
            errorElement.style.animation = 'fadeOut 0.3s';
            setTimeout(() => errorElement.remove(), 300);
        }
    }, 5000);
}

function initCharts() {
    try {
        if (!charts.map) {
            initLeafletMap();
        }
        
        // 确保两个图表都初始化，但默认只显示时间趋势图
        initTimeChart();
        initWordCloudChart();
        
        // 初始化标签页切换
        initAnalysisTabs();
        
    } catch (error) {
        console.error('图表初始化错误:', error);
    }
}

/**
 * Leaflet 地图初始化
 */
function initLeafletMap() {
    try {
        const mapContainer = document.getElementById('leaflet-map');
        
        if (mapContainer._leaflet_map) {
            console.log('地图已经初始化，跳过重复初始化');
            return mapContainer._leaflet_map;
        }
        
        if (typeof L === 'undefined') {
            throw new Error('Leaflet 库未加载');
        }
        
        mapContainer.innerHTML = '';
        
        const map = L.map('leaflet-map').setView([20, 0], 2);
        mapContainer._leaflet_map = map;
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        }).addTo(map);
        
        addNewsAnchors(map);
        bindLeafletMapControls(map);
        
        charts.map = map;
        
        console.log('Leaflet 地图初始化成功 - 锚点版本');
        return map;
    } catch (error) {
        console.error('Leaflet 地图初始化失败:', error);
        document.getElementById('leaflet-map').innerHTML = 
            '<div style="text-align: center; padding: 50px; color: #666;">地图加载失败: ' + error.message + '</div>';
        return null;
    }
}

/**
 * 添加新闻锚点标记 - 统一使用英文名称
 */
function addNewsAnchors(map) {
    const regions = RegionMatcher.getAllRegions();
    
    console.log('🗺️ 可用区域总数:', Object.keys(regions).length);
    
    // 统计每个区域的新闻数量 - 使用统一英文名称
    const regionStats = {};
    
    // 初始化所有区域统计
    Object.keys(regions).forEach(regionName => {
        regionStats[regionName] = {
            count: 0,
            news: [],
            type: regions[regionName].type,
            coords: regions[regionName].coords
        };
    });
    
    // 统计新闻数量 - 使用统一名称
    filteredData.forEach(news => {
        if (news.locations && Array.isArray(news.locations)) {
            const matchedRegions = RegionMatcher.matchLocations(news.locations);
            
            matchedRegions.forEach(matchedName => {
                // 统一使用英文名称
                const englishName = RegionMatcher.normalizeRegionName(matchedName);
                if (englishName && regionStats[englishName]) {
                    regionStats[englishName].count += 1;
                    regionStats[englishName].news.push(news);
                }
            });
        }
    });
    
    console.log('区域新闻统计（统一英文名称）:', regionStats);
    
    // 创建锚点 - 只要有新闻就显示
    Object.entries(regions).forEach(([regionName, regionData]) => {
        const stats = regionStats[regionName];
        const newsCount = stats ? stats.count : 0;
        
        if (newsCount === 0) return;
        
        // 根据新闻数量确定标记大小和颜色
        const { color, radius } = getAnchorStyleByCount(newsCount);
        
        // 创建自定义锚点图标
        const anchorIcon = L.divIcon({
            className: `news-anchor ${regionData.type}-anchor`,
            html: `
                <div class="anchor-marker" style="
                    background-color: ${color};
                    width: ${radius * 2}px;
                    height: ${radius * 2}px;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    cursor: pointer;
                    position: relative;
                ">
                    ${newsCount > 0 ? `<div style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        color: white;
                        font-size: ${radius > 6 ? '10px' : '8px'};
                        font-weight: bold;
                        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                    ">${newsCount}</div>` : ''}
                </div>
            `,
            iconSize: [radius * 2 + 4, radius * 2 + 4],
            iconAnchor: [radius + 2, radius + 2]
        });
        
        // 创建锚点标记
        const anchor = L.marker([regionData.coords.lat, regionData.coords.lng], { 
            icon: anchorIcon,
            regionName: regionName
        }).addTo(map);
        
        // 添加交互事件
        anchor.on('mouseover', function(e) {
            const region = e.target.options.regionName;
            highlightRegion(map, region, regionStats[region]);
        });
        
        anchor.on('mouseout', function(e) {
            removeHighlight(map);
        });
        
        anchor.on('click', function(e) {
            const region = e.target.options.regionName;
            showRegionNews(region, regionStats[region]);
        });
        
        // 存储锚点引用
        if (!map._anchors) map._anchors = [];
        map._anchors.push(anchor);
    });
    
    // 添加图例
    addUpdatedMapLegend(map);
    
    // 输出统计信息
    const regionsWithNews = Object.values(regionStats).filter(stats => stats.count > 0).length;
    console.log(`🗺️ 地图锚点统计: 共创建 ${regionsWithNews} 个区域锚点`);
}

function highlightAnchorByRegion(regionName) {
    const map = charts.map;
    if (!map || !map._anchors) return;

    map._anchors.forEach(anchor => {
        const el = anchor.getElement();
        if (!el) return;

        const markerEl = el.querySelector('.anchor-marker');
        if (!markerEl) return;

        if (anchor.options.regionName === regionName) {
            markerEl.classList.add('active-marker');
        } else {
            markerEl.classList.remove('active-marker');
        }
    });
}

function clearAnchorHighlight() {
    const map = charts.map;
    if (!map || !map._anchors) return;

    map._anchors.forEach(anchor => {
        const el = anchor.getElement();
        if (!el) return;

        const markerEl = el.querySelector('.anchor-marker');
        if (!markerEl) return;

        markerEl.classList.remove('active-marker');
    });
}


/**
 * 根据新闻数量获取锚点样式 - 适配新数据范围
 * @param {number} count - 新闻数量
 * @returns {Object} 包含颜色和半径的对象
 */

/**
 * 根据新闻数量获取锚点样式 - 基于实际数据分布优化
 */
function getAnchorStyleByCount(count) {
    if (count >= 200) return { color: '#d73027', radius: 16 };    // 红色，最大尺寸
    if (count >= 150) return { color: '#fc8d59', radius: 14 };    // 橙色
    if (count >= 100) return { color: '#fee08b', radius: 12 };    // 黄色
    if (count >= 50) return { color: '#d9ef8b', radius: 10 };     // 浅绿
    if (count >= 20) return { color: '#a1d99b', radius: 8 };      // 绿色
    if (count >= 10) return { color: '#74c476', radius: 7 };      // 深绿
    if (count >= 5) return { color: '#41ab5d', radius: 6 };       // 墨绿
    if (count >= 2) return { color: '#238b45', radius: 5 };       // 深蓝绿
    return { color: '#006d2c', radius: 4 };                       // 最小尺寸
}

/**
 * 添加更新后的地图图例 - 基于实际数据优化
 */
function addUpdatedMapLegend(map) {
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = `
            <h4>新闻分布图例</h4>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #d73027;"></div>
                <div class="legend-text">200+ 条新闻</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #fc8d59;"></div>
                <div class="legend-text">150-199 条</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #fee08b;"></div>
                <div class="legend-text">100-149 条</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #d9ef8b;"></div>
                <div class="legend-text">50-99 条</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #a1d99b;"></div>
                <div class="legend-text">20-49 条</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #74c476;"></div>
                <div class="legend-text">10-19 条</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #41ab5d;"></div>
                <div class="legend-text">5-9 条</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #238b45;"></div>
                <div class="legend-text">2-4 条</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #006d2c;"></div>
                <div class="legend-text">1 条</div>
            </div>
            
            <div class="legend-divider"></div>
            
            <div class="legend-item">
                <div class="legend-color square" style="background-color: #3498db;"></div>
                <div class="legend-text">海洋区域</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color square" style="background-color: #27ae60;"></div>
                <div class="legend-text">国家/地区</div>
            </div>
        `;
        return div;
    };
    
    legend.addTo(map);
}


/**
 * 统计并在控制台输出每个锚点区域的新闻数量 - 使用统一英文名称
 */
function logNewsCountPerRegion() {
    const regionNewsCount = {};
    
    // 初始化所有区域的计数为0
    Object.keys(RegionMatcher.regions).forEach(region => {
        regionNewsCount[region] = 0;
    });
    
    // 遍历所有新闻计算每个区域的新闻数量 - 使用统一英文名称
    currentData.forEach(item => {
        if (item.locations && Array.isArray(item.locations)) {
            const matchedRegions = new Set();
            
            item.locations.forEach(location => {
                const matched = RegionMatcher.fuzzyMatchLocation(location);
                if (matched) {
                    // 统一使用英文名称
                    const englishName = RegionMatcher.normalizeRegionName(matched);
                    if (englishName) {
                        matchedRegions.add(englishName);
                    }
                }
            });
            
            // 对每个匹配到的区域计数+1
            matchedRegions.forEach(region => {
                if (regionNewsCount[region] !== undefined) {
                    regionNewsCount[region]++;
                }
            });
        }
    });
    
    // 过滤掉数量为0的区域并按数量降序排序
    const filteredCounts = Object.entries(regionNewsCount)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);
    
    // 仅在控制台输出统计结果
    console.log('📊 每个锚点区域的新闻数量统计（统一英文名称）:');
    filteredCounts.forEach(([region, count]) => {
        console.log(`  ${region}: ${count}条`);
    });
    
    // 输出总计信息
    const totalNewsWithRegions = filteredCounts.reduce((sum, [_, count]) => sum + count, 0);
    console.log(`📝 总计有 ${totalNewsWithRegions} 条新闻匹配到锚点区域`);
    
    // 输出分布统计
    const distribution = {
        '200+': 0,
        '150-199': 0,
        '100-149': 0,
        '50-99': 0,
        '20-49': 0,
        '10-19': 0,
        '5-9': 0,
        '2-4': 0,
        '1': 0
    };
    
    filteredCounts.forEach(([_, count]) => {
        if (count >= 200) distribution['200+']++;
        else if (count >= 150) distribution['150-199']++;
        else if (count >= 100) distribution['100-149']++;
        else if (count >= 50) distribution['50-99']++;
        else if (count >= 20) distribution['20-49']++;
        else if (count >= 10) distribution['10-19']++;
        else if (count >= 5) distribution['5-9']++;
        else if (count >= 2) distribution['2-4']++;
        else distribution['1']++;
    });
    
    console.log('📈 新闻分布统计:', distribution);
    
    // 输出各层级的区域列表
    console.log('🏷️ 各层级区域详情:');
    const tiers = {
        '200+': [],
        '150-199': [],
        '100-149': [],
        '50-99': [],
        '20-49': [],
        '10-19': [],
        '5-9': [],
        '2-4': [],
        '1': []
    };
    
    filteredCounts.forEach(([region, count]) => {
        if (count >= 200) tiers['200+'].push(`${region}(${count})`);
        else if (count >= 150) tiers['150-199'].push(`${region}(${count})`);
        else if (count >= 100) tiers['100-149'].push(`${region}(${count})`);
        else if (count >= 50) tiers['50-99'].push(`${region}(${count})`);
        else if (count >= 20) tiers['20-49'].push(`${region}(${count})`);
        else if (count >= 10) tiers['10-19'].push(`${region}(${count})`);
        else if (count >= 5) tiers['5-9'].push(`${region}(${count})`);
        else if (count >= 2) tiers['2-4'].push(`${region}(${count})`);
        else tiers['1'].push(`${region}(${count})`);
    });
    
    Object.entries(tiers).forEach(([tier, regions]) => {
        if (regions.length > 0) {
            console.log(`  ${tier}: ${regions.join(', ')}`);
        }
    });
}


/**
 * 高亮显示区域 - 修复版本，精确控制位置
 */
function highlightRegion(map, regionName, stats) {
    removeHighlight(map);
    
    if (stats && stats.count > 0) {
        // 获取地图容器的位置信息
        const mapContainer = map.getContainer();
        const mapRect = mapContainer.getBoundingClientRect();
        
        // 计算锚点位置
        const anchorLatLng = [stats.coords.lat, stats.coords.lng];
        const point = map.latLngToContainerPoint(anchorLatLng);
        
        // 创建弹出框元素
        const popupElement = document.createElement('div');
        popupElement.className = 'custom-popup-right';
        
       // 在 highlightRegion 函数中，替换弹出框的HTML内容
        
        popupElement.innerHTML = `
            <div style="min-width: 260px; max-width: 320px;">
                <div class="region-name-header">${regionName}</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.9rem;">
                    <span><strong>新闻数量:</strong> ${stats.count}条</span>
                    <span><strong>类型:</strong> ${stats.type === 'ocean' ? '🌊 海洋' : '📍 国家'}</span>
                </div>
                <div style="margin-top: 12px; max-height: 200px; overflow-y: auto;">
                    <strong style="font-size: 0.9rem;">最新新闻:</strong>
                    ${stats.news.slice(0, 3).map(news => {
                        // 清洗新闻数据，确保标题和时间为有效字符串
                        const cleanTitle = cleanNewsTitle(news.title || '无标题');
                        const cleanTime = cleanNewsTime(news.publish_time);
                        
                        return `
                            <div style="border-left: 3px solid #3498db; padding: 8px 10px; margin: 8px 0; background: #f8f9fa; border-radius: 0 4px 4px 0;">
                                <div style="font-weight: bold; font-size: 0.85rem; margin-bottom: 4px; line-height: 1.3; word-break: break-word;">
                                    ${cleanTitle}
                                </div>
                                <div style="font-size: 0.75rem; color: #666;">
                                    📅 ${cleanTime}
                                </div>
                            </div>
                        `;
                    }).join('')}
                    ${stats.news.length > 3 ? `
                        <div style="text-align: center; margin-top: 8px; font-style: italic; color: #666; font-size: 0.8rem;">
                            ... 还有 ${stats.news.length - 3} 条新闻
                        </div>
                    ` : ''}
                </div>
                <div style="margin-top: 12px; text-align: center;">
                    <button onclick="showRegionNews('${regionName}', ${JSON.stringify(cleanStatsForDisplay(stats)).replace(/'/g, "\\'")})" 
                            style="background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; transition: background 0.3s;">
                        查看全部新闻
                    </button>
                </div>
            </div>
        `;
        
        // 添加到地图容器但不显示，用于计算尺寸
        popupElement.style.cssText = `
            position: absolute;
            visibility: hidden;
            left: ${point.x + 40}px;
            top: ${point.y}px;
            width: 300px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            padding: 15px;
            max-height: 400px;
            overflow-y: auto;
        `;
        
        mapContainer.appendChild(popupElement);
        
        // 计算弹出框的实际尺寸
        const popupRect = popupElement.getBoundingClientRect();
        const popupHeight = popupRect.height;
        const popupWidth = popupRect.width;
        
        // 计算最佳位置
        let finalTop = point.y;
        let finalLeft = point.x + 40;
        
        // 垂直居中调整：让弹出框垂直居中于锚点
        finalTop = point.y - (popupHeight / 2) + 10; // +10 是为了稍微向下偏移，避免完全居中时遮挡锚点
        
        // 边界检查 - 确保弹出框不会超出地图容器
        const containerHeight = mapRect.height;
        const containerWidth = mapRect.width;
        
        // 检查底部边界
        if (finalTop + popupHeight > containerHeight) {
            finalTop = containerHeight - popupHeight - 10; // 留出10px边距
        }
        
        // 检查顶部边界
        if (finalTop < 10) {
            finalTop = 10;
        }
        
        // 检查右侧边界
        if (finalLeft + popupWidth > containerWidth) {
            // 如果右侧空间不足，显示在左侧
            finalLeft = point.x - popupWidth - 20;
        }
        
        // 应用最终位置并显示
        popupElement.style.cssText = `
            position: absolute;
            left: ${finalLeft}px;
            top: ${finalTop}px;
            width: 300px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            padding: 15px;
            max-height: 400px;
            overflow-y: auto;
            visibility: visible;
            opacity: 1;
            transition: opacity 0.2s ease;
        `;
        
        // 存储引用以便移除
        map._customPopup = popupElement;
        
        // 点击其他地方关闭
        const closePopup = function(e) {
            if (map._customPopup && !map._customPopup.contains(e.target)) {
                removeHighlight(map);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closePopup);
        }, 100);
        
        map._closePopupHandler = closePopup;
    }
}

function removeHighlight(map) {
    // 移除 Leaflet 的 popup
    if (map._currentTooltip) {
        map.closePopup(map._currentTooltip);
        map._currentTooltip = null;
    }
    
    // 移除自定义 popup
    if (map._customPopup) {
        map._customPopup.remove();
        map._customPopup = null;
    }
    
    // 移除事件监听器
    if (map._closePopupHandler) {
        document.removeEventListener('click', map._closePopupHandler);
        map._closePopupHandler = null;
    }
}

/**
 * 清洗新闻标题 - 移除异常字符和过长内容
 */
function cleanNewsTitle(title) {
    if (!title || typeof title !== 'string') return '无标题';
    
    // 移除过长的JSON片段和异常字符
    let cleanTitle = title
        .replace(/\{.*?\}/g, '') // 移除JSON对象
        .replace(/\[.*?\]/g, '') // 移除数组
        .replace(/".*?"/g, '')   // 移除引号内容
        .replace(/吨\)/g, '吨')  // 修复特定格式问题
        .replace(/\s+/g, ' ')    // 合并多个空格
        .trim();
    
    // 如果清洗后为空，返回默认值
    if (!cleanTitle) return '无标题';
    
    // 限制标题长度
    if (cleanTitle.length > 100) {
        cleanTitle = cleanTitle.substring(0, 100) + '...';
    }
    
    return cleanTitle;
}

/**
 * 清洗新闻时间
 */
function cleanNewsTime(time) {
    if (!time || typeof time !== 'string') return '未知时间';
    
    // 移除时间中的异常字符
    const cleanTime = time
        .replace(/"/g, '')  // 移除引号
        .replace(/,/g, '')  // 移除逗号
        .trim();
    
    // 检查是否为有效日期格式
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanTime) || 
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cleanTime)) {
        return cleanTime;
    }
    
    return '未知时间';
}

function parseNewsDate(time) {
    if (!time || time === '未知时间' || time === '未知') return null;

    const trimmed = time.trim();
    let normalized = trimmed;

    // 仅日期
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        normalized = trimmed + ' 00:00:00';
    }

    // 日期 + 时间
    if (!/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(normalized)) {
        return null;
    }

    const d = new Date(normalized.replace(' ', 'T'));
    if (isNaN(d.getTime())) return null;
    return d;
}


/**
 * 清洗统计数据用于显示（保留完整新闻结构，只清洗标题和时间）
 */
function cleanStatsForDisplay(stats) {
    if (!stats) return { count: 0, news: [], type: 'unknown', coords: { lat: 0, lng: 0 } };
    
    return {
        count: stats.count || 0,
        news: (stats.news || []).map(news => ({
            // 先展开原始新闻对象，保留所有字段（包括你新增的各种 *categories 字段）
            ...news,
            // 再覆盖 title / publish_time / locations 为清洗后的版本，保证展示安全
            title: cleanNewsTitle(news.title),
            publish_time: cleanNewsTime(news.publish_time),
            locations: news.locations || []
        })),
        type: stats.type || 'unknown',
        coords: stats.coords || { lat: 0, lng: 0 }
    };
}

/**
 * 增强的区域新闻显示函数
 */
function showRegionNews(regionName, stats) {
    if (!stats || !stats.news || stats.news.length === 0) {
        alert(`区域 "${regionName}" 暂无相关新闻`);
        return;
    }
    
    // 记录最近一次区域上下文（用于详情页的“返回区域新闻汇总”）
    lastRegionContext = {
        regionName,
        stats
    };

    // 用该区域的新闻刷新左侧列表 & 分页
    filteredData = stats.news.slice();   // 拷贝一份，避免引用同一个数组
    currentPage = 1;
    renderNewsList();
    updatePaginationInfo();
    renderPaginationControls();

    // 标记数据已变化，启用“更新图表”按钮
    dataChanged = true;
    const updateBtn = document.getElementById('update-charts-btn');
    if (updateBtn) {
        updateBtn.disabled = false;
    }

    // 构造右侧侧边栏内容
    const sidebar = document.getElementById('news-detail-sidebar');
    const overlay = document.querySelector('.sidebar-overlay') || createOverlay();
    const content = document.getElementById('news-detail-content');
    
    // 使用清洗后的数据用于展示，但其内部新闻对象仍然包含完整字段
    const cleanStats = cleanStatsForDisplay(stats);

    content.innerHTML = `
        <div class="news-detail-title">📌 ${regionName} - 新闻汇总</div>
        
        <div class="news-detail-item">
            <div class="news-detail-label">📊 统计信息</div>
            <div class="news-detail-value">
                <p><strong>新闻总数:</strong> ${cleanStats.count} 条</p>
                <p><strong>区域类型:</strong> ${cleanStats.type === 'ocean' ? '海洋区域' : '国家/地区'}</p>
            </div>
        </div>
        
        <div class="news-detail-item">
            <div class="news-detail-label">📰 相关新闻 (${cleanStats.news.length} 条)</div>
            <div style="max-height: 400px; overflow-y: auto;">
                ${cleanStats.news.map((news, index) => `
                    <div class="region-news-item" onclick="showIndividualNewsDetail(${JSON.stringify(news).replace(/"/g, '&quot;')})">
                        <div style="font-weight: bold; margin-bottom: 5px; color: #2c3e50; line-height: 1.3;">
                            ${index + 1}. ${news.title}
                        </div>
                        <div style="font-size: 0.85rem; color: #666;">
                            <span>📍 ${news.locations && news.locations.length > 0 ? news.locations.join(', ') : '未知位置'}</span>
                            <span style="margin-left: 15px;">📅 ${news.publish_time}</span>
                        </div>
                        ${news.theme ? `<div style="font-size: 0.8rem; color: #888; margin-top: 4px;">主题: ${news.theme}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    sidebar.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * 从区域汇总列表点击单条新闻详情
 */
function showIndividualNewsDetail(news) {
    isInRegionDetailFlow = true;  // 标记来源于区域汇总
    showNewsDetail(news);
}


/**
 * 添加地图图例
 */
function addMapLegend(map) {
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = `
            <h4>新闻分布图例</h4>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #d73027;"></div>
                <div class="legend-text">10+ 条新闻</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #fc8d59;"></div>
                <div class="legend-text">5-9 条新闻</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #fee08b;"></div>
                <div class="legend-text">2-4 条新闻</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color" style="background-color: #d9ef8b;"></div>
                <div class="legend-text">0-1 条新闻</div>
            </div>
            
            <div class="legend-divider"></div>
            
            <div class="legend-item">
                <div class="legend-color square" style="background-color: #3498db;"></div>
                <div class="legend-text">海洋区域</div>
            </div>
            
            <div class="legend-item">
                <div class="legend-color square" style="background-color: #27ae60;"></div>
                <div class="legend-text">国家/地区</div>
            </div>
        `;
        return div;
    };
    
    legend.addTo(map);
}

/**
 * 绑定 Leaflet 地图控制事件
 */
function bindLeafletMapControls(map) {
    document.getElementById('map-zoom-in').addEventListener('click', function() {
        map.zoomIn();
    });
    
    document.getElementById('map-zoom-out').addEventListener('click', function() {
        map.zoomOut();
    });
    
    document.getElementById('map-reset').addEventListener('click', function() {
        map.setView([20, 0], 2);
    });
}

/**
 * 时间趋势图初始化
 */
function initTimeChart() {
    const timeChart = echarts.init(document.getElementById('time-chart'));
    
    const timeData = processTimeData();
    
    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        xAxis: {
            type: 'category',
            data: timeData.map(item => item.month),
            axisLabel: {
                color: '#333'
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#333'
            }
        },
        series: [{
            data: timeData.map(item => item.count),
            type: 'line',
            smooth: true,
            lineStyle: {
                color: '#3498db',
                width: 3
            },
            itemStyle: {
                color: '#3498db'
            },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(52, 152, 219, 0.5)' },
                    { offset: 1, color: 'rgba(52, 152, 219, 0.1)' }
                ])
            }
        }]
    };
    
    timeChart.setOption(option);
    charts.time = timeChart;

    // 确保不会重复绑定
    timeChart.off('click');
    timeChart.on('click', function (params) {
        if (!params || !params.name) return;
        
        const monthLabel = params.name; // 例如 "2018-12"
        console.log('时间趋势图点击月份:', monthLabel, params);

        filterNewsByMonthFromTimeChart(monthLabel);
    });
}

/**
 * 处理时间数据
 */
function processTimeData() {
    const monthCount = {};
    
    filteredData.forEach(item => {
        if (item.publish_time) {
            const date = new Date(item.publish_time);
            const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            monthCount[yearMonth] = (monthCount[yearMonth] || 0) + 1;
        }
    });
    
    const timeData = Object.entries(monthCount)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));
    
    if (timeData.length === 0) {
        return [
            { month: '2024-01', count: 5 },
            { month: '2024-02', count: 8 },
            { month: '2024-03', count: 12 },
            { month: '2024-04', count: 15 },
            { month: '2024-05', count: 18 },
            { month: '2024-06', count: 22 },
            { month: '2024-07', count: 25 },
            { month: '2024-08', count: 20 },
            { month: '2024-09', count: 16 },
            { month: '2024-10', count: 10 }
        ];
    }
    
    return timeData;
}

/**
 * 根据时间趋势图点击的月份（YYYY-MM）过滤新闻
 * 并联动更新：新闻列表 + 分页 + 地图 + 搜索统计
 *
 * 设计要点：
 * - 第一次点击：记录当前 filteredData 作为“时间筛选基准”
 * - 后续点击：始终在这份基准上按不同月份做过滤，而不是叠加过滤
 */
function filterNewsByMonthFromTimeChart(monthLabel) {
    if (!monthLabel || typeof monthLabel !== 'string') return;

    const parts = monthLabel.split('-');
    if (parts.length !== 2) {
        console.warn('无法解析月份标签:', monthLabel);
        return;
    }

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10); // 1-12

    if (isNaN(year) || isNaN(month)) {
        console.warn('月份标签格式不正确:', monthLabel);
        return;
    }

    // 构造该月的起止时间区间：[start, end)
    const startDate = new Date(year, month - 1, 1, 0, 0, 0);
    const endDate = new Date(year, month, 1, 0, 0, 0); // 下一个月的 1 号

    // ⭐ 第一次点击：把当时的 filteredData 作为“基准”
    if (!timeFilterBaseData) {
        timeFilterBaseData = Array.isArray(filteredData) 
            ? [...filteredData] 
            : [];
        console.log('初始化时间筛选基准集: ', timeFilterBaseData.length, '条');
    }

    const baseData = timeFilterBaseData.length > 0 
        ? timeFilterBaseData 
        : filteredData;

    // 在“基准集”上按月份筛选
    const monthFiltered = baseData.filter(item => {
        const d = getNewsDate(item);
        return d && d >= startDate && d < endDate;
    });

    if (monthFiltered.length === 0) {
        console.log(`月份 ${monthLabel} 在当前筛选条件的基准数据集中没有新闻记录`);
        // 不弹 alert，避免打扰；日志说明原因即可
        return;
    }

    // 用该月子集覆盖 filteredData
    filteredData = monthFiltered;
    currentPage = 1;

    // 更新列表与分页信息
    renderNewsList();
    updatePaginationInfo();
    renderPaginationControls();

    // 联动更新地图锚点
    updateMapMarkers();

    // 在“搜索统计”区域给出提示（复用已有组件）
    showSearchStats(`时间筛选：${monthLabel}`);

    console.log(`✅ 已根据月份 ${monthLabel} 过滤新闻，共 ${monthFiltered.length} 条`);
}


/**
 * 词云图初始化
 */
function initWordCloudChart() {
    const wordCloudChart = echarts.init(document.getElementById('wordcloud-chart'));
    
    try {
        const wordData = extractKeywordsFromNews();
        
        if (!wordData || wordData.length === 0) {
            throw new Error('词云数据为空');
        }
        
        const isValidData = wordData.every(item => 
            item && typeof item.name === 'string' && typeof item.value === 'number'
        );
        
        if (!isValidData) {
            throw new Error('词云数据格式不正确');
        }
        
        const option = {
            tooltip: {
                show: true,
                formatter: function(params) {
                    return `${params.name}: ${params.value}次`;
                }
            },
            series: [{
                type: 'wordCloud',
                shape: 'circle',
                left: 'center',
                top: 'center',
                width: '90%',
                height: '90%',
                sizeRange: [12, 60],
                rotationRange: [-45, 45],
                rotationStep: 45,
                gridSize: 8,
                drawOutOfBound: false,
                textStyle: {
                    fontFamily: 'Microsoft YaHei',
                    fontWeight: 'bold',
                    color: function () {
                        const colors = [
                            '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9c80e', 
                            '#f7931e', '#6c5ce7', '#a29bfe', '#00b894',
                            '#e17055', '#0984e3', '#a29bfe', '#fd79a8'
                        ];
                        return colors[Math.floor(Math.random() * colors.length)];
                    }
                },
                emphasis: {
                    focus: 'self',
                    textStyle: {
                        shadowBlur: 10,
                        shadowColor: '#333'
                    }
                },
                data: wordData
            }]
        };
        
        wordCloudChart.setOption(option);
        charts.wordcloud = wordCloudChart;
        
        console.log('词云图初始化完成');
        
    } catch (error) {
        console.error('词云图初始化失败:', error);
        document.getElementById('wordcloud-chart').innerHTML = 
            `<div style="text-align: center; padding: 50px; color: #666;">
                <h4>词云加载失败</h4>
                <p>错误信息: ${error.message}</p>
                <p>请检查控制台获取详细信息</p>
            </div>`;
    }
}

/**
 * 从新闻数据提取关键词 - 简化大小写管理版本
 */
function extractKeywordsFromNews() {
    const keywordCount = {};
    
    filteredData.forEach(item => {
        if (item.keywords && Array.isArray(item.keywords)) {
            item.keywords.forEach(keyword => {
                if (keyword && keyword.trim()) {
                    // 简单的大小写归一化：转换为小写并修剪
                    const normalizedKeyword = keyword.trim().toLowerCase();
                    keywordCount[normalizedKeyword] = (keywordCount[normalizedKeyword] || 0) + 1;
                }
            });
        }
    });
    
    const wordData = Object.entries(keywordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40)
        .map(([name, value]) => ({
            name,
            value: Math.max(value, 5)
        }));
    
    if (wordData.length === 0) {
        return [
            { name: 'emissions reduction', value: 100 },
            { name: 'lng', value: 85 },
            { name: 'greenhouse gas', value: 78 },
            { name: 'energy efficiency', value: 72 },
            { name: 'marine technology', value: 65 },
            { name: 'sustainability', value: 58 },
            { name: 'decarbonisation', value: 55 },
            { name: 'hybrid system', value: 50 },
            { name: 'environmental protection', value: 45 },
            { name: 'clean energy', value: 42 }
        ];
    }
    
    return wordData;
}

/**
 * 显示单条新闻详情
 */
function showNewsDetail(item) {
    if (!item) return;

    const sidebar = document.getElementById('news-detail-sidebar');
    const overlay = document.querySelector('.sidebar-overlay') || createOverlay();
    const content = document.getElementById('news-detail-content');

    // ⭐ 只有从助手打开时才显示“返回助手”按钮
    const backToAssistantBtn = document.getElementById('back-to-assistant');
    const fromAssistant = !!window.newsDetailFromAssistant;
    // 用完立即清理标记，避免影响下一次其它入口
    window.newsDetailFromAssistant = false;

    if (backToAssistantBtn) {
        backToAssistantBtn.style.display = fromAssistant ? 'inline-flex' : 'none';
    }

    // 只有从区域新闻汇总点进来的详情，才显示“返回区域新闻汇总”按钮
    const fromRegionSummary =
        isInRegionDetailFlow &&
        lastRegionContext &&
        lastRegionContext.regionName &&
        lastRegionContext.stats;

    // 重置标记，避免影响后续从左侧列表点进来的详情
    isInRegionDetailFlow = false;

    const backButtonHtml = fromRegionSummary
        ? `<button class="news-detail-back-btn" onclick="backToRegionNews()">← 返回 ${lastRegionContext.regionName} 新闻汇总</button>`
        : '';

    content.innerHTML = `
        ${backButtonHtml}
        <div class="news-detail-title">📰 ${item.title || '无标题'}</div>

        <div class="news-detail-item">
            <div class="news-detail-label">🕒 发布时间</div>
            <div class="news-detail-value">${item.publish_time || '未知时间'}</div>
        </div>

        <div class="news-detail-item">
            <div class="news-detail-label">📍 区域 / 位置</div>
            <div class="news-detail-value">
                ${
                    item.locations && item.locations.length > 0
                        ? item.locations.join(', ')
                        : (item.location || '未知位置')
                }
            </div>
        </div>

        ${item.time_category ? `
        <div class="news-detail-item">
            <div class="news-detail-label">📅 时间分类</div>
            <div class="news-detail-value">${item.time_category}</div>
        </div>
        ` : ''}

        ${item.theme ? `
        <div class="news-detail-item">
            <div class="news-detail-label">🎯 主题</div>
            <div class="news-detail-value">${item.theme}</div>
        </div>
        ` : ''}

        ${item.theme_categories && item.theme_categories.length > 0 ? `
        <div class="news-detail-item">
            <div class="news-detail-label">🎯 主题分类</div>
            <div class="news-detail-list">
                ${item.theme_categories.map(c => `<span class="news-detail-tag">${c}</span>`).join('')}
            </div>
        </div>
        ` : ''}

        ${item.location_categories && item.location_categories.length > 0 ? `
        <div class="news-detail-item">
            <div class="news-detail-label">🌍 区域分类</div>
            <div class="news-detail-list">
                ${item.location_categories.map(c => `<span class="news-detail-tag">${c}</span>`).join('')}
            </div>
        </div>
        ` : ''}

        ${item.executor ? `
        <div class="news-detail-item">
            <div class="news-detail-label">🏢 执行方</div>
            <div class="news-detail-value">${item.executor}</div>
        </div>
        ` : ''}

        ${item.pollution_source ? `
        <div class="news-detail-item">
            <div class="news-detail-label">⚠️ 污染来源</div>
            <div class="news-detail-value">${item.pollution_source}</div>
        </div>
        ` : ''}

        ${item.pollution_categories && item.pollution_categories.length > 0 ? `
        <div class="news-detail-item">
            <div class="news-detail-label">⚠️ 污染分类</div>
            <div class="news-detail-list">
                ${item.pollution_categories.map(c => 
                    `<span class="news-detail-tag" style="background: #ffebee; color: #c62828;">${c}</span>`
                ).join('')}
            </div>
        </div>
        ` : ''}

        <div class="news-detail-item">
            <div class="news-detail-label">📊 措施</div>
            <div class="news-detail-value">${item.measure || '无措施信息'}</div>
        </div>

        <div class="news-detail-item">
            <div class="news-detail-label">📈 效果数据</div>
            <div class="news-detail-value">${item.effect_data || '无效果数据'}</div>
        </div>

        <div class="news-detail-item">
            <div class="news-detail-label">🏷️ 关键词</div>
            <div class="news-detail-list">
                ${
                    item.keywords && item.keywords.length > 0
                        ? item.keywords.map(k => `<span class="news-detail-tag">${k}</span>`).join('')
                        : '<span class="news-detail-value">无关键词</span>'
                }
            </div>
        </div>

        <div class="news-detail-item">
            <div class="news-detail-label">🔗 新闻来源</div>
            <div class="news-detail-value">
                ${
                    item.source_url
                        ? `<a href="${item.source_url}" target="_blank" class="news-detail-url">${item.source_url}</a>`
                        : '无来源链接'
                }
            </div>
        </div>

        ${item.id ? `
        <div class="news-detail-item">
            <div class="news-detail-label">🆔 新闻ID</div>
            <div class="news-detail-value">${item.id}</div>
        </div>
        ` : ''}
    `;

    sidebar.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}


/**
 * 创建遮罩层
 */
function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.onclick = closeNewsDetail;
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * 从新闻详情返回到区域新闻汇总
 */
function backToRegionNews() {
    if (!lastRegionContext || !lastRegionContext.regionName || !lastRegionContext.stats) {
        return;
    }
    const { regionName, stats } = lastRegionContext;
    showRegionNews(regionName, stats);
}


/**
 * 关闭新闻详情侧边栏
 */
function closeNewsDetail() {
    const sidebar = document.getElementById('news-detail-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.remove('active');
    if (overlay) {
        overlay.classList.remove('active');
    }
    
    document.body.style.overflow = '';
}

/**
 * 绑定侧边栏事件
 */
function bindSidebarEvents() {
    const closeBtn = document.getElementById('close-sidebar');
    const backBtn = document.getElementById('back-to-assistant');
    const sidebar = document.getElementById('news-detail-sidebar');

    // 关闭按钮：只关闭新闻详情
    if (closeBtn) {
        closeBtn.addEventListener('click', closeNewsDetail);
    }

    // 返回助手按钮：关闭新闻详情 + 打开问答窗口
    if (backBtn) {
        backBtn.addEventListener('click', function () {
            // 1. 先关闭侧边栏
            closeNewsDetail();

            // 2. 再恢复鲸鱼助手问答界面
            if (typeof qaAssistant !== 'undefined' && qaAssistant && typeof qaAssistant.openQA === 'function') {
                // 用模块自己的方法打开
                qaAssistant.openQA();
            } else {
                // 兜底：直接操作 DOM
                const qaModal = document.getElementById('qa-modal');
                if (qaModal) {
                    qaModal.classList.add('active');
                    const qaInput = document.getElementById('qa-question-input');
                    if (qaInput) {
                        qaInput.focus();
                    }
                }
            }
        });
    }

    // ESC 关闭新闻详情
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeNewsDetail();
        }
    });

    // 阻止点击冒泡到遮罩层
    if (sidebar) {
        sidebar.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    }
}


/**
 * 绑定事件处理函数
 */
function bindEvents() {
    document.getElementById('keyword-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchNews();
        }
    });
    
    document.getElementById('prev-page').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('next-page').addEventListener('click', () => goToPage(currentPage + 1));
    
    document.getElementById('page-size').addEventListener('change', function(e) {
        pageSize = parseInt(e.target.value);
        currentPage = 1;
        renderNewsList();
        updatePaginationInfo();
        renderPaginationControls();
        
        dataChanged = true;
        document.getElementById('update-charts-btn').disabled = false;
        showUpdateHint();
    });
    
    document.getElementById('btn-knowledge-graph').addEventListener('click', function() {
    // 使用后端定义的路由路径
    window.location.href = '/knowledge-graph';
});
    
    document.getElementById('btn-dashboard').addEventListener('click', function() {
        // 已经在仪表板页面
    });
    
    window.addEventListener('resize', function() {
        Object.entries(charts).forEach(([key, chart]) => {
            if (chart && typeof chart.resize === 'function') {
                try {
                    chart.resize();
                } catch (error) {
                    console.warn(`调整 ${key} 图表大小时出错:`, error);
                }
            }
        });
    });
}

/**
 * 初始化分析面板切换功能
 */
function initAnalysisTabs() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const chartPanels = document.querySelectorAll('.chart-panel');
    
    navTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 更新导航栏激活状态
            navTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 更新图表面板显示状态
            chartPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `${targetTab}-panel`) {
                    panel.classList.add('active');
                    
                    // 重新渲染图表以确保正确显示
                    setTimeout(() => {
                        if (targetTab === 'time-chart' && charts.time) {
                            charts.time.resize();
                        } else if (targetTab === 'wordcloud-chart' && charts.wordcloud) {
                            charts.wordcloud.resize();
                        }
                    }, 100);
                }
            });
        });
    });
}

// 添加 CSS 动画
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
    }
`;
document.head.appendChild(style);

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);