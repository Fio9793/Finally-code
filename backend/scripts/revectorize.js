// backend/scripts/revectorize.js
require('dotenv').config();
const vectorizer = require('../vector-rag/vectorizer');
const dataService = require('../services/data-service');

async function revectorizeAllData() {
    try {
        console.log('🚀 开始重新向量化所有新闻数据...');
        
        // 1. 从Neo4j获取完整数据（包含新字段）
        console.log('📡 从Neo4j获取新闻数据...');
        const newsData = await dataService.getNewsData();
        
        if (!newsData || newsData.length === 0) {
            console.error('❌ 无法获取新闻数据');
            return;
        }

        console.log(`✅ 获取到 ${newsData.length} 条新闻数据`);
        
        // 显示数据统计
        dataService.showDataStats(newsData);

        // 2. 清空现有向量数据
        console.log('🗑️ 清空现有向量数据...');
        await vectorizer.clearVectorData();
        
        // 3. 重新向量化所有数据
        console.log('🔧 开始向量化处理...');
        await vectorizer.vectorizeAllNews(newsData);
        
        // 4. 验证结果
        console.log('📊 验证向量化结果...');
        const stats = await vectorizer.getCollectionStats();
        
        console.log('🎉 重新向量化完成！');
        console.log(`📈 向量库统计: ${stats.points_count} 条向量数据`);
        
    } catch (error) {
        console.error('❌ 重新向量化失败:', error);
    }
}

// 运行脚本
if (require.main === module) {
    revectorizeAllData();
}

module.exports = { revectorizeAllData };