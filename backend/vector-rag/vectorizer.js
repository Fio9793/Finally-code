// backend/vector-rag/vectorizer.js
const qdrantService = require('../config/qdrant-config');
const embeddingService = require('../services/embedding-service');

class NewsVectorizer {
    constructor() {
        this.batchSize = 10; // 批处理大小，避免内存溢出
    }

    /**
     * 向量化所有新闻数据
     */
    async vectorizeAllNews(newsData) {
        console.log('🚀 开始向量化新闻数据...');
        
        if (!newsData || newsData.length === 0) {
            console.warn('⚠️ 没有新闻数据需要向量化');
            return;
        }

        const points = [];
        let processed = 0;

        // 分批处理
        for (let i = 0; i < newsData.length; i += this.batchSize) {
            const batch = newsData.slice(i, i + this.batchSize);
            console.log(`🔄 处理批次 ${Math.floor(i/this.batchSize) + 1}: ${batch.length} 条新闻`);
            
            const batchPoints = await this.processBatch(batch, i);
            points.push(...batchPoints);
            
            processed += batch.length;
            console.log(`📊 已处理 ${processed}/${newsData.length} 条新闻`);
            
            // 小批量上传，避免内存问题
            if (points.length >= 20) {
                await this.uploadToQdrant(points);
                points.length = 0; // 清空数组
            }
        }

        // 上传剩余的点
        if (points.length > 0) {
            await this.uploadToQdrant(points);
        }

        console.log('✅ 新闻数据向量化完成');
    }

    /**
     * 处理批次数据
     */
    async processBatch(newsBatch, startIndex) {
        try {
            const texts = newsBatch.map(item => this.prepareTextForEmbedding(item));
            const embeddings = await embeddingService.generateEmbeddings(texts);

            return newsBatch.map((item, index) => ({
                id: startIndex + index + 1, // 确保ID从1开始
                vector: embeddings[index],
                payload: {
                    news_id: item.id,
                    title: item.title,
                    content: this.prepareTextForEmbedding(item),
                    theme: item.theme,
                    locations: item.locations || [],
                    publish_time: item.publish_time,
                    executor: item.executor,
                    keywords: item.keywords || [],
                    source_url: item.source_url,
                    pollution_source: item.pollution_source,
                    measure: item.measure,
                    effect_data: item.effect_data,
                    // 🆕 新增分类字段 - 增强检索能力
                    theme_categories: item.theme_categories || [],
                    location_categories: item.location_categories || [],
                    pollution_categories: item.pollution_categories || [],
                    time_category: item.time_category || ''
                }
            }));
        } catch (error) {
            console.error('❌ 批次处理失败:', error);
            return [];
        }
    }

    /**
     * 准备用于向量化的文本 - 增强版本
     */
    prepareTextForEmbedding(newsItem) {
        const parts = [];
        
        // 原有字段
        if (newsItem.title) parts.push(`标题：${newsItem.title}`);
        if (newsItem.theme) parts.push(`主题：${newsItem.theme}`);
        if (newsItem.executor) parts.push(`执行方：${newsItem.executor}`);
        if (newsItem.pollution_source) parts.push(`污染源：${newsItem.pollution_source}`);
        if (newsItem.measure) parts.push(`措施：${newsItem.measure}`);
        if (newsItem.effect_data) parts.push(`效果：${newsItem.effect_data}`);
        if (newsItem.keywords && newsItem.keywords.length > 0) {
            parts.push(`关键词：${newsItem.keywords.join('，')}`);
        }
        
        // 修复：确保位置信息被包含在向量化文本中
        if (newsItem.locations && newsItem.locations.length > 0) {
            parts.push(`位置：${newsItem.locations.join('，')}`);
        }

        // 🆕 新增字段 - 增强检索能力
        if (newsItem.theme_categories && newsItem.theme_categories.length > 0) {
            parts.push(`主题分类：${newsItem.theme_categories.join('，')}`);
        }
        if (newsItem.location_categories && newsItem.location_categories.length > 0) {
            parts.push(`位置分类：${newsItem.location_categories.join('，')}`);
        }
        if (newsItem.pollution_categories && newsItem.pollution_categories.length > 0) {
            parts.push(`污染分类：${newsItem.pollution_categories.join('，')}`);
        }
        if (newsItem.time_category) {
            parts.push(`时间分类：${newsItem.time_category}`);
        }

        const result = parts.join('。');
        console.log(`📝 文本准备（增强版）: ${result.substring(0, 100)}...`);
        return result;
    }

    /**
     * 上传到Qdrant
     */
    async uploadToQdrant(points) {
        try {
            if (points.length === 0) return;
            
            console.log(`📤 上传 ${points.length} 个向量到Qdrant...`);
            await qdrantService.client.upsert(qdrantService.collectionName, {
                wait: true,
                points: points
            });
            console.log('✅ 向量数据上传成功');
        } catch (error) {
            console.error('❌ 向量数据上传失败:', error);
            throw error;
        }
    }

    /**
     * 获取集合统计信息
     */
    async getCollectionStats() {
        try {
            const info = await qdrantService.client.getCollection(qdrantService.collectionName);
            console.log('📊 向量数据库统计:');
            console.log(`   集合名称: ${info.name}`);
            console.log(`   向量数量: ${info.points_count}`);
            console.log(`   状态: ${info.status}`);
            
            // 检查分类字段是否存在
            const sampleResult = await qdrantService.client.search(qdrantService.collectionName, {
                vector: new Array(384).fill(0.1), // 使用简单向量进行样本搜索
                limit: 1,
                with_payload: true
            });
            
            if (sampleResult.length > 0) {
                const payload = sampleResult[0].payload;
                console.log('📋 样本数据字段:');
                Object.keys(payload).forEach(key => {
                    const value = payload[key];
                    if (Array.isArray(value)) {
                        console.log(`   ${key}: [${value.slice(0, 3).join(', ')}${value.length > 3 ? '...' : ''}]`);
                    } else {
                        console.log(`   ${key}: ${value}`);
                    }
                });
            }
            
            return info;
        } catch (error) {
            console.error('获取集合统计失败:', error);
            return null;
        }
    }

    /**
     * 验证向量数据完整性
     */
    async validateVectorData(newsData) {
        try {
            console.log('🔍 验证向量数据完整性...');
            
            const sampleIds = newsData.slice(0, 5).map(item => item.id);
            let missingFields = 0;
            
            for (const id of sampleIds) {
                const searchResult = await qdrantService.client.search(qdrantService.collectionName, {
                    vector: new Array(384).fill(0.1),
                    filter: {
                        must: [{
                            key: 'news_id',
                            match: { value: id }
                        }]
                    },
                    limit: 1,
                    with_payload: true
                });
                
                if (searchResult.length > 0) {
                    const payload = searchResult[0].payload;
                    const requiredFields = [
                        'theme_categories', 'location_categories', 
                        'pollution_categories', 'time_category'
                    ];
                    
                    requiredFields.forEach(field => {
                        if (!payload[field] || 
                            (Array.isArray(payload[field]) && payload[field].length === 0)) {
                            console.warn(`⚠️ 新闻 ${id} 缺少字段: ${field}`);
                            missingFields++;
                        }
                    });
                }
            }
            
            if (missingFields === 0) {
                console.log('✅ 所有分类字段都已正确存储');
            } else {
                console.warn(`⚠️ 发现 ${missingFields} 个缺失字段`);
            }
            
        } catch (error) {
            console.error('验证向量数据失败:', error);
        }
    }

    /**
     * 重新向量化特定新闻（用于更新）
     */
    async revectorizeNews(newsItems) {
        try {
            console.log(`🔄 重新向量化 ${newsItems.length} 条新闻...`);
            
            const points = await this.processBatch(newsItems, 0);
            
            if (points.length > 0) {
                await this.uploadToQdrant(points);
                console.log('✅ 重新向量化完成');
            }
            
            return points.length;
        } catch (error) {
            console.error('❌ 重新向量化失败:', error);
            return 0;
        }
    }

    /**
     * 清空向量数据（开发用）
     */
    async clearVectorData() {
        try {
            await qdrantService.client.deleteCollection(qdrantService.collectionName);
            console.log('🗑️ 向量数据已清空');
            // 重新初始化集合
            await qdrantService.initCollection();
        } catch (error) {
            console.error('清空向量数据失败:', error);
        }
    }

    /**
     * 测试向量化功能
     */
    async testVectorization(newsData) {
        try {
            console.log('🧪 测试向量化功能...');
            
            if (!newsData || newsData.length === 0) {
                console.warn('⚠️ 没有测试数据');
                return;
            }
            
            const testItem = newsData[0];
            console.log('📋 测试数据样本:');
            console.log(`   标题: ${testItem.title}`);
            console.log(`   主题分类: ${testItem.theme_categories ? testItem.theme_categories.join(', ') : '无'}`);
            console.log(`   位置分类: ${testItem.location_categories ? testItem.location_categories.join(', ') : '无'}`);
            console.log(`   污染分类: ${testItem.pollution_categories ? testItem.pollution_categories.join(', ') : '无'}`);
            console.log(`   时间分类: ${testItem.time_category || '无'}`);
            
            // 测试文本准备
            const preparedText = this.prepareTextForEmbedding(testItem);
            console.log(`📝 准备的文本长度: ${preparedText.length} 字符`);
            console.log(`📝 文本预览: ${preparedText.substring(0, 150)}...`);
            
            // 测试嵌入生成
            const embedding = await embeddingService.generateEmbeddings(preparedText);
            console.log(`🔢 生成的嵌入维度: ${embedding.length}`);
            console.log(`🔢 嵌入样本: [${embedding.slice(0, 5).map(x => x.toFixed(4)).join(', ')}...]`);
            
            return {
                text_length: preparedText.length,
                embedding_dim: embedding.length,
                sample_embedding: embedding.slice(0, 5)
            };
            
        } catch (error) {
            console.error('测试向量化失败:', error);
            return { error: error.message };
        }
    }
}

module.exports = new NewsVectorizer();