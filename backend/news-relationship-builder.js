// news-relationship-builder.js

const neo4j = require('neo4j-driver');

class NewsRelationshipBuilder {
    constructor(uri, user, password, config = {}) {
        this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), config);
        this.maxConnectionsPerCategory = 30; // 限制每个分类节点连接的新闻数量
    }

    async executeQuery(query, parameters = {}) {
        const session = this.driver.session();
        try {
            return await session.run(query, parameters);
        } finally {
            await session.close();
        }
    }

    async buildNewsRelationships() {
        try {
            console.log('🔗 开始构建新闻关联关系...');

            // 1. 创建关联节点（如果不存在）
            await this.createRelationshipNodes();
            
            // 2. 创建新闻与分类节点的直接关系
            await this.createDirectCategoryRelationships();
            
            // 3. 创建新闻之间的间接关系（通过共享分类）
            await this.createIndirectNewsRelationships();
            
            // 4. 显示统计信息
            await this.showRelationshipStatistics();

            console.log('🎉 新闻关联关系构建完成！');
            return true;

        } catch (error) {
            console.error('❌ 构建过程出错:', error);
            return false;
        }
    }

    async createRelationshipNodes() {
        console.log('📝 创建关联节点（如果不存在）...');
        
        // 创建共享关系节点（用于连接共享相同分类的新闻）
        const relationshipQueries = [
            `CREATE CONSTRAINT IF NOT EXISTS FOR (n:SharedCategory) REQUIRE n.id IS UNIQUE`,
            `CREATE CONSTRAINT IF NOT EXISTS FOR (n:NewsConnection) REQUIRE n.id IS UNIQUE`
        ];

        for (const query of relationshipQueries) {
            try {
                await this.executeQuery(query);
            } catch (error) {
                console.warn(`⚠️ 创建约束时警告: ${error.message}`);
            }
        }
    }

    async createDirectCategoryRelationships() {
        console.log('🔗 创建新闻与分类节点的直接关系...');
        
        // 这里不需要创建新的分类节点，因为你的导入脚本已经创建了
        // 我们只需要确保关系是正确的
        
        console.log('✅ 直接关系创建完成（已有导入脚本处理）');
    }

    async createIndirectNewsRelationships() {
        console.log('🔄 创建新闻之间的间接关系...');
        
        let totalRelations = 0;
        
        // 1. 通过位置分类连接新闻
        console.log('📍 通过位置分类连接新闻...');
        const locationRelations = await this.connectNewsByCategory('LocationCategory', 'SHARES_LOCATION');
        totalRelations += locationRelations;
        
        // 2. 通过主题分类连接新闻
        console.log('🎯 通过主题分类连接新闻...');
        const themeRelations = await this.connectNewsByCategory('ThemeCategory', 'SHARES_THEME');
        totalRelations += themeRelations;
        
        // 3. 通过污染分类连接新闻
        console.log('⚠️ 通过污染分类连接新闻...');
        const pollutionRelations = await this.connectNewsByCategory('PollutionCategory', 'SHARES_POLLUTION');
        totalRelations += pollutionRelations;
        
        // 4. 通过时间分类连接新闻
        console.log('⏰ 通过时间分类连接新闻...');
        const timeRelations = await this.connectNewsByCategory('TimeCategory', 'SHARES_TIME');
        totalRelations += timeRelations;
        
        console.log(`✅ 间接关系创建完成: ${totalRelations} 条连接关系`);
    }

    async connectNewsByCategory(categoryType, relationshipType) {
        try {
            // 获取所有分类节点
            const categoryQuery = `
                MATCH (cat:${categoryType})
                WHERE size((cat)<--()) <= $maxConnections
                RETURN cat.name as categoryName
                LIMIT 100
            `;
            
            const categories = await this.executeQuery(categoryQuery, {
                maxConnections: this.maxConnectionsPerCategory
            });
            
            let totalConnections = 0;
            
            for (const record of categories.records) {
                const categoryName = record.get('categoryName');
                
                // 获取共享该分类的所有新闻
                const newsQuery = `
                    MATCH (news:News)-[:HAS_${categoryType.toUpperCase()}]->(cat:${categoryType} {name: $categoryName})
                    RETURN news.id as newsId
                    LIMIT 20  // 限制每个分类最多连接20个新闻
                `;
                
                const newsResult = await this.executeQuery(newsQuery, {
                    categoryName: categoryName
                });
                
                const newsIds = newsResult.records.map(r => r.get('newsId'));
                
                // 如果有多于1个新闻共享该分类，创建连接关系
                if (newsIds.length > 1) {
                    for (let i = 0; i < newsIds.length; i++) {
                        for (let j = i + 1; j < newsIds.length; j++) {
                            try {
                                await this.executeQuery(`
                                    MATCH (news1:News {id: $newsId1})
                                    MATCH (news2:News {id: $newsId2})
                                    MERGE (news1)-[r:${relationshipType}]->(news2)
                                    SET r.category = $categoryName,
                                        r.categoryType = $categoryType,
                                        r.weight = $weight,
                                        r.createdAt = timestamp()
                                `, {
                                    newsId1: newsIds[i],
                                    newsId2: newsIds[j],
                                    categoryName: categoryName,
                                    categoryType: categoryType,
                                    weight: 1.0 / newsIds.length  // 权重基于共享新闻数量
                                });
                                
                                totalConnections++;
                                
                            } catch (error) {
                                console.warn(`⚠️ 创建关系时出错: ${error.message}`);
                            }
                        }
                    }
                }
            }
            
            console.log(`   ${categoryType}: ${totalConnections} 条连接`);
            return totalConnections;
            
        } catch (error) {
            console.error(`❌ 处理 ${categoryType} 分类时出错:`, error.message);
            return 0;
        }
    }

    async showRelationshipStatistics() {
        console.log('\n📊 新闻关联关系统计报告:');
        console.log('='.repeat(50));
        
        const statsQueries = [
            { name: '新闻总数', query: 'MATCH (n:News) RETURN count(n) as count' },
            { name: '位置分类连接', query: "MATCH ()-[r:SHARES_LOCATION]->() RETURN count(r) as count" },
            { name: '主题分类连接', query: "MATCH ()-[r:SHARES_THEME]->() RETURN count(r) as count" },
            { name: '污染分类连接', query: "MATCH ()-[r:SHARES_POLLUTION]->() RETURN count(r) as count" },
            { name: '时间分类连接', query: "MATCH ()-[r:SHARES_TIME]->() RETURN count(r) as count" },
            { name: '总连接关系', query: "MATCH ()-[r:SHARES_]->() RETURN count(r) as count" }
        ];
        
        for (const { name, query } of statsQueries) {
            try {
                const result = await this.executeQuery(query);
                const countRecord = result.records[0].get('count');
                
                let count;
                if (countRecord && typeof countRecord.toNumber === 'function') {
                    count = countRecord.toNumber();
                } else if (typeof countRecord === 'number') {
                    count = countRecord;
                } else {
                    count = parseInt(countRecord) || 0;
                }
                
                console.log(`  📊 ${name}: ${count}`);
            } catch (error) {
                console.log(`  ℹ️ ${name}: 查询失败（可能关系不存在）`);
            }
        }
        
        console.log('='.repeat(50));
        
        // 显示新闻连接的示例
        try {
            const exampleQuery = `
                MATCH (n1:News)-[r:SHARES_LOCATION]->(n2:News)
                RETURN n1.id as news1, n2.id as news2, r.category as sharedCategory
                LIMIT 5
            `;
            
            const examples = await this.executeQuery(exampleQuery);
            
            console.log('\n🔍 连接关系示例:');
            examples.records.forEach((record, index) => {
                console.log(`  ${index + 1}. 新闻 ${record.get('news1')} ←[共享位置:${record.get('sharedCategory')}]→ 新闻 ${record.get('news2')}`);
            });
        } catch (error) {
            // 忽略示例查询错误
        }
    }
}

module.exports = NewsRelationshipBuilder;