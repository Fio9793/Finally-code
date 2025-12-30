// backend/services/data-service.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class DataService {
    constructor() {
        this.apiUrl = 'http://localhost:3000/api/news';
        this.localDataPath = path.join(__dirname, '../../data/news_metadata.json');
    }

    /**
     * 获取新闻数据 - 优先使用本地文件
     */
    async getNewsData() {
        // 首先尝试本地文件
        const localData = this.getLocalData();
        if (localData && localData.length > 0) {
            console.log(`✅ 从本地文件加载 ${localData.length} 条新闻数据`);
            return localData;
        }

        // 如果本地文件没有数据，尝试API
        try {
            console.log('📡 尝试从后端API获取新闻数据...');
            const response = await axios.get(this.apiUrl, { timeout: 10000 });
            
            if (response.data && response.data.success && response.data.news) {
                console.log(`✅ 成功从API获取 ${response.data.news.length} 条新闻数据`);
                return response.data.news;
            } else {
                throw new Error('API返回数据格式不正确');
            }
        } catch (error) {
            console.warn('❌ 无法连接后端API，使用模拟数据:', error.message);
            return this.getMockData();
        }
    }

    /**
     * 从本地文件获取数据
     */
    getLocalData() {
        try {
            if (fs.existsSync(this.localDataPath)) {
                console.log(`📁 读取本地数据文件: ${this.localDataPath}`);
                const rawData = fs.readFileSync(this.localDataPath, 'utf8');
                const data = JSON.parse(rawData);
                
                if (Array.isArray(data)) {
                    return data;
                } else if (data.news && Array.isArray(data.news)) {
                    return data.news;
                } else if (data.data && Array.isArray(data.data)) {
                    return data.data;
                } else {
                    console.warn('⚠️ 本地数据文件格式不识别，使用模拟数据');
                    return null;
                }
            } else {
                console.warn(`⚠️ 本地数据文件不存在: ${this.localDataPath}`);
                return null;
            }
        } catch (error) {
            console.error('❌ 读取本地数据文件失败:', error.message);
            return null;
        }
    }

    /**
     * 获取模拟数据（备用）
     */
    getMockData() {
        console.log('📋 使用模拟数据');
        return []; // 返回空数组，因为我们希望使用真实数据
    }

   
    convertDataFormat(data) {
        console.log('🔧 转换数据格式...');
        
        if (!data || data.length === 0) {
            console.warn('⚠️ 没有数据需要转换');
            return [];
        }
        
        return data.map((item, index) => {
            const normalized = {
                id: item.id || index + 1,
                title: item.title || '无标题',
                theme: item.theme || '',
                pollution_source: item.pollution_source || '',
                measure: item.measure || '',
                executor: item.executor || '',
                effect_data: item.effect_data || '',
                source_url: item.source_url || '',
                publish_time: item.publish_time || '',
                locations: [],
                keywords: [],
                entities: [],
                // 新增字段（先初始化空值，后续再处理）
                theme_categories: [],
                location_categories: [],
                pollution_categories: [],
                time_category: item.time_category || ''
            };
            
            // 处理 locations 字段 - 多种可能的来源
            if (Array.isArray(item.locations) && item.locations.length > 0) {
                normalized.locations = item.locations;
            } else if (Array.isArray(item.location) && item.location.length > 0) {
                normalized.locations = item.location;
            } else if (typeof item.location === 'string' && item.location.trim()) {
                normalized.locations = [item.location.trim()];
            } else if (typeof item.locations === 'string' && item.locations.trim()) {
                normalized.locations = [item.locations.trim()];
            }
            
            // 处理 keywords 字段
            if (Array.isArray(item.keywords) && item.keywords.length > 0) {
                normalized.keywords = item.keywords;
            } else if (typeof item.keywords === 'string' && item.keywords.trim()) {
                // 尝试解析字符串形式的数组
                try {
                    const parsed = JSON.parse(item.keywords);
                    normalized.keywords = Array.isArray(parsed) ? parsed : [item.keywords];
                } catch {
                    normalized.keywords = [item.keywords];
                }
            }
            
            // 处理 entities 字段（执行方）
            if (Array.isArray(item.entities) && item.entities.length > 0) {
                normalized.entities = item.entities;
            } else if (item.executor && typeof item.executor === 'string' && item.executor.trim()) {
                normalized.entities = [item.executor.trim()];
            }
            
            // 如果 measure 是数组，转换为字符串
            if (Array.isArray(normalized.measure)) {
                normalized.measure = normalized.measure.join(', ');
            }
            
            // 处理新增分类字段（现在能执行到了）
            const categoryFields = [
                'theme_categories',
                'location_categories', 
                'pollution_categories'
            ];
            
            categoryFields.forEach(field => {
                if (Array.isArray(item[field]) && item[field].length > 0) {
                    normalized[field] = item[field];
                } else if (typeof item[field] === 'string' && item[field].trim()) {
                    try {
                        const parsed = JSON.parse(item[field]);
                        normalized[field] = Array.isArray(parsed) ? parsed : [item[field]];
                    } catch {
                        normalized[field] = [item[field]];
                    }
                } else {
                    normalized[field] = [];
                }
            });
            
            // 所有字段处理完成后，统一返回
            return normalized;
        });
}

    /**
     * 显示数据统计信息
     */
    showDataStats(data) {
        if (!data || data.length === 0) {
            console.log('📊 数据统计: 无数据');
            return;
        }

        console.log(`📊 数据统计:`);
        console.log(`   总记录数: ${data.length}`);
        
        // 统计有数据的字段
        const fields = {
            '标题': 'title',
            '主题': 'theme', 
            '执行方': 'executor',
            '污染源': 'pollution_source',
            '措施': 'measure',
            '效果数据': 'effect_data',
            '位置': 'locations',
            '关键词': 'keywords'
        };

        Object.entries(fields).forEach(([fieldName, fieldKey]) => {
            const count = data.filter(item => {
                const value = item[fieldKey];
                if (Array.isArray(value)) return value.length > 0;
                return value && value.toString().trim() !== '';
            }).length;
            console.log(`   ${fieldName}: ${count}/${data.length} (${((count/data.length)*100).toFixed(1)}%)`);
        });

        // 显示样本数据
        if (data.length > 0) {
            console.log('\n📄 样本数据:');
            const sample = data[0];
            Object.keys(sample).forEach(key => {
                if (sample[key] && (!Array.isArray(sample[key]) || sample[key].length > 0)) {
                    console.log(`   ${key}: ${Array.isArray(sample[key]) ? sample[key].join(', ') : sample[key]}`);
                }
            });
        }
    }
}

module.exports = new DataService();