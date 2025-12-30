// backend/scripts/vectorize-news.js
const dataService = require('../services/data-service');
const vectorizer = require('../vector-rag/vectorizer');
const qdrantConfig = require('../config/qdrant-config');

async function main() {
    try {
        console.log('🎯 开始新闻数据向量化流程...\n');

        // 1. 测试数据库连接
        console.log('1. 测试向量数据库连接...');
        const connected = await qdrantConfig.testConnection();
        if (!connected) {
            console.log('❌ 数据库连接失败，退出流程');
            process.exit(1);
        }

        // 2. 初始化集合
        console.log('2. 初始化向量集合...');
        await qdrantConfig.initCollection();

        // 3. 获取新闻数据
        console.log('3. 获取新闻数据...');
        const rawData = await dataService.getNewsData();
        
        if (!rawData || rawData.length === 0) {
            console.log('❌ 没有获取到新闻数据，请检查数据文件');
            process.exit(1);
        }
        
        const newsData = dataService.convertDataFormat(rawData);
        
        console.log(`\n📋 获取到 ${newsData.length} 条新闻数据`);
        
        // 显示数据统计
        dataService.showDataStats(newsData);
        console.log('');

        // 4. 向量化数据
        console.log('4. 开始向量化新闻数据...');
        await vectorizer.vectorizeAllNews(newsData);

        // 5. 显示统计信息
        console.log('5. 获取最终统计...');
        await vectorizer.getCollectionStats();

        console.log('\n🎉 新闻数据向量化流程完成！');
        console.log('下一步：可以开始测试检索功能了');

    } catch (error) {
        console.error('❌ 向量化流程失败:', error);
        process.exit(1);
    }
}

// 运行主函数
main();