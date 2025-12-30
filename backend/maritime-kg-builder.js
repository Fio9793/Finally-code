
// maritime-kg-builder.js - 保护新闻数据版本

const neo4j = require('neo4j-driver');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// ============ 辅助函数 ============

function parseField(field) {
    if (!field || field === '未知' || field === 'null' || field === '' || field === 'Not mentioned') return [];

    if (typeof field === 'string') {
        if (field.startsWith("['") && field.endsWith("']")) {
            const content = field.slice(2, -2);
            return content.split("', '")
                .map(item => item.trim())
                .filter(item => item && item !== '未知' && item !== 'Not mentioned');
        }
        else if (field.includes(',')) {
            return field.split(',')
                .map(item => item.trim())
                .filter(item => item && item !== '未知' && item !== 'Not mentioned');
        }
        else {
            return field.trim() !== '未知' && field.trim() !== 'Not mentioned' ? [field.trim()] : [];
        }
    }

    if (Array.isArray(field)) {
        return field.filter(item => item && item !== '未知' && item !== 'Not mentioned');
    }

    return [];
}

function parseTimeCategory(timeStr) {
    if (!timeStr || timeStr === '未知' || timeStr === 'null' || timeStr === '') return '';
    const quarterMatch = timeStr.match(/(\d{4})\s*Q(\d)/);
    if (quarterMatch) return `${quarterMatch[1]} Q${quarterMatch[2]}`;
    return timeStr;
}

// ============ 主类定义 ============

class MaritimeKnowledgeGraphBuilder {
    constructor(uri, username, password, config = {}) {
        this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password), config);
    }

    async buildKnowledgeGraph(csvFilePath) {
        let session;
        try {
            session = this.driver.session();
            
            // 不再清空现有数据，改为安全清理知识图谱数据
            await this.safelyClearExistingKGData(session);

            const projects = await this.parseCSVData("news_metadata.csv");
            console.log(`📊 开始构建知识图谱，共 ${projects.length} 个项目`);

            let successCount = 0;
            for (const project of projects) {
                try {
                    await this.processProject(session, project);
                    successCount++;

                    if (successCount % 100 === 0) {
                        console.log(`📈 进度: ${successCount}/${projects.length}`);
                    }
                } catch (error) {
                    console.warn(`⚠️ 处理项目 ${project.id} 失败:`, error.message);
                }
            }

            console.log(`✅ 知识图谱构建完成！成功处理 ${successCount} 个项目`);
            
            // 验证新闻数据是否还存在
            await this.verifyNewsData(session);
            
            return true;

        } catch (error) {
            console.error('❌ 构建失败:', error);
            return false;
        } finally {
            if (session) await session.close();
        }
    }

    async safelyClearExistingKGData(session) {
        console.log('🛡️ 安全清理知识图谱数据（保留新闻数据）...');
        
        // 先检查新闻数据是否存在
        const newsResult = await session.run('MATCH (n:News) RETURN count(n) as newsCount');
        const newsCount = newsResult.records[0].get('newsCount').toNumber();
        console.log(`📊 检测到 ${newsCount} 条新闻数据，将保留这些数据`);
        
        // 只删除知识图谱相关的节点，不删除新闻相关节点
        const deleteQueries = [
            'MATCH (p:Project) DETACH DELETE p',
            'MATCH (la:LocationAggregate) DETACH DELETE la',
            'MATCH (ta:ThemeAggregate) DETACH DELETE ta',
            'MATCH (pa:PollutionAggregate) DETACH DELETE pa',
            'MATCH (cc:CombinedContent) DETACH DELETE cc',
            'MATCH (e:Executor) DETACH DELETE e',
            'MATCH (tn:TimeNode) DETACH DELETE tn',
            // 删除知识图谱的词云节点（这些可能有重复，但会重新创建）
            'MATCH (wc:Location {isWordCloud: true}) DETACH DELETE wc',
            'MATCH (wc:Theme {isWordCloud: true}) DETACH DELETE wc',
            'MATCH (wc:Pollution {isWordCloud: true}) DETACH DELETE wc',
            'MATCH (tc:Time {isWordCloud: true}) DETACH DELETE tc'
        ];
        
        for (const query of deleteQueries) {
            try {
                const result = await session.run(query);
                console.log(`✅ 清理: ${query.split('MATCH ')[1]?.split(')')[0] || '特定节点'}`);
            } catch (error) {
                // 某些节点可能不存在，忽略错误
                console.log(`ℹ️ 跳过不存在的节点类型`);
            }
        }
        
        console.log('✅ 知识图谱数据清理完成，新闻数据已保留');
    }

    async verifyNewsData(session) {
        try {
            console.log('\n🔍 验证新闻数据完整性...');
            
            const newsResult = await session.run('MATCH (n:News) RETURN count(n) as newsCount');
            const newsCount = newsResult.records[0].get('newsCount').toNumber();
            
            if (newsCount > 0) {
                console.log(`✅ 新闻数据完好：${newsCount} 条新闻`);
                
                // 检查新闻的关键关系是否还在
                const checkQueries = [
                    { name: '位置关系', query: 'MATCH (n:News)-[:LOCATED_IN]->() RETURN count(n) as count' },
                    { name: '主题关系', query: 'MATCH (n:News)-[:HAS_THEME]->() RETURN count(n) as count' },
                    { name: '关键词关系', query: 'MATCH (n:News)-[:ABOUT]->() RETURN count(n) as count' }
                ];
                
                for (const { name, query } of checkQueries) {
                    try {
                        const result = await session.run(query);
                        const count = result.records[0].get('count').toNumber();
                        console.log(`   📊 新闻${name}: ${count}`);
                    } catch (error) {
                        console.log(`   ℹ️ 新闻${name}: 查询失败`);
                    }
                }
            } else {
                console.log('⚠️ 警告：未检测到新闻数据');
            }
        } catch (error) {
            console.error('❌ 验证新闻数据时出错:', error.message);
        }
    }

    async processProject(session, project) {
        console.log(`\n📝 处理项目 ${project.id}: ${project.title?.substring(0, 50)}...`);
        
        try {
            // 1. 创建新闻项目节点
            await this.createProjectNode(session, project);

            // 2. 创建聚合节点（新闻的直接组成部分）
            await this.createLocationAggregateNode(session, project);
            await this.createThemeAggregateNode(session, project);
            await this.createPollutionAggregateNode(session, project);

            // 3. 创建其他直接节点
            await this.createCombinedContentNode(session, project);
            await this.createExecutorNodes(session, project);
            await this.createTimeNode(session, project);
            
            console.log(`✅ 项目 ${project.id} 处理完成`);
        } catch (error) {
            console.error(`❌ 处理项目 ${project.id} 失败:`, error.message);
            throw error;
        }
    }

    async createProjectNode(session, project) {
        // 新闻项目节点 - 使用与新闻不同的标签
        await session.run(`
            MERGE (p:Project {id: $id})
            SET p.title = $title,
                p.name = $name,
                p.publish_time = $publish_time,
                p.source_url = $source_url,
                p.showLabel = false,
                p.nodeType = 'project',
                p.category = 'Project',
                p.createdAt = timestamp(),
                p.originalTheme = $theme,
                p.originalLocation = $location
        `, {
            id: project.id,
            name: `知识图谱项目${project.id}`,
            title: project.title || '无标题',
            publish_time: project.publish_time || '',
            source_url: project.source_url || '',
            theme: project.theme || '',
            location: project.location || ''
        });
        
        console.log(`   📄 创建项目节点: ${project.id}`);
    }

    async createLocationAggregateNode(session, project) {
        if (!project.location || project.location === '未知') return;

        const locations = project.location.split(/[,\/;]/)
            .map(loc => loc.trim())
            .filter(loc => loc && loc !== '未知');

        if (locations.length === 0) return;

        // 1. 创建位置聚合节点
        const aggId = `LocationAggregate_${project.id}`;
        await session.run(`
            MERGE (agg:LocationAggregate {id: $id})
            SET agg.projectId = $projectId,
                agg.items = $items,
                agg.itemCount = $itemCount,
                agg.showLabel = true,
                agg.nodeType = 'aggregate',
                agg.category = 'LocationAggregate',
                agg.createdAt = timestamp(),
                agg.originalLocation = $originalLocation
        `, {
            id: aggId,
            projectId: project.id,
            items: locations,
            itemCount: locations.length,
            originalLocation: project.location
        });

        // 2. 连接到新闻项目
        await session.run(`
            MATCH (p:Project {id: $projectId})
            MATCH (agg:LocationAggregate {id: $aggId})
            MERGE (p)-[r:HAS_LOCATION]->(agg)
            SET r.createdAt = timestamp()
        `, {
            projectId: project.id,
            aggId: aggId
        });

        console.log(`   📍 位置聚合节点: ${locations.length} 个位置`);
        
        // 3. 连接到位置词云节点
        await this.connectToLocationWordClouds(session, aggId, project.location_categories || []);
    }

    async connectToLocationWordClouds(session, aggregateId, categories) {
        if (!categories || categories.length === 0) return;
        
        for (const category of categories) {
            if (category && category !== '未知' && category.trim()) {
                const categoryName = category.trim();
                
                // 创建位置词云节点
                await session.run(`
                    MERGE (wc:Location {name: $name})
                    ON CREATE SET 
                        wc.isWordCloud = true,
                        wc.showLabel = true,
                        wc.nodeType = 'wordcloud',
                        wc.category = 'Location',
                        wc.createdAt = timestamp()
                    ON MATCH SET 
                        wc.updatedAt = timestamp()
                `, { name: categoryName });

                // 连接聚合节点到词云节点
                await session.run(`
                    MATCH (agg:LocationAggregate {id: $aggId})
                    MATCH (wc:Location {name: $name})
                    MERGE (agg)-[r:BELONGS_TO_CATEGORY]->(wc)
                    SET r.createdAt = timestamp()
                `, {
                    aggId: aggregateId,
                    name: categoryName
                });
                
                console.log(`     🏷️  连接到位置词云: "${categoryName}"`);
            }
        }
    }

    async createThemeAggregateNode(session, project) {
        if (!project.theme || project.theme === '未知') return;

        const themes = project.theme.split(/[,\/;]/)
            .map(theme => theme.trim())
            .filter(theme => theme && theme !== '未知');

        if (themes.length === 0) return;

        // 1. 创建主题聚合节点
        const aggId = `ThemeAggregate_${project.id}`;
        await session.run(`
            MERGE (agg:ThemeAggregate {id: $id})
            SET agg.projectId = $projectId,
                agg.items = $items,
                agg.itemCount = $itemCount,
                agg.showLabel = true,
                agg.nodeType = 'aggregate',
                agg.category = 'ThemeAggregate',
                agg.createdAt = timestamp(),
                agg.originalTheme = $originalTheme
        `, {
            id: aggId,
            projectId: project.id,
            items: themes,
            itemCount: themes.length,
            originalTheme: project.theme
        });

        // 2. 连接到新闻项目
        await session.run(`
            MATCH (p:Project {id: $projectId})
            MATCH (agg:ThemeAggregate {id: $aggId})
            MERGE (p)-[r:HAS_THEME]->(agg)
            SET r.createdAt = timestamp()
        `, {
            projectId: project.id,
            aggId: aggId
        });

        console.log(`   🎯 主题聚合节点: ${themes.length} 个主题`);
        
        // 3. 连接到主题词云节点
        await this.connectToThemeWordClouds(session, aggId, project.theme_categories || []);
    }

    async connectToThemeWordClouds(session, aggregateId, categories) {
        if (!categories || categories.length === 0) return;
        
        for (const category of categories) {
            if (category && category !== '未知' && category.trim()) {
                const categoryName = category.trim();
                
                // 创建主题词云节点
                await session.run(`
                    MERGE (wc:Theme {name: $name})
                    ON CREATE SET 
                        wc.isWordCloud = true,
                        wc.showLabel = true,
                        wc.nodeType = 'wordcloud',
                        wc.category = 'Theme',
                        wc.createdAt = timestamp()
                    ON MATCH SET 
                        wc.updatedAt = timestamp()
                `, { name: categoryName });

                // 连接聚合节点到词云节点
                await session.run(`
                    MATCH (agg:ThemeAggregate {id: $aggId})
                    MATCH (wc:Theme {name: $name})
                    MERGE (agg)-[r:BELONGS_TO_CATEGORY]->(wc)
                    SET r.createdAt = timestamp()
                `, {
                    aggId: aggregateId,
                    name: categoryName
                });
                
                console.log(`     🏷️  连接到主题词云: "${categoryName}"`);
            }
        }
    }

    async createPollutionAggregateNode(session, project) {
        const pollutionSources = project.pollution_source || [];
        const validSources = pollutionSources.filter(source => 
            source && source !== '未知' && source.trim()
        );

        if (validSources.length === 0) return;

        // 1. 创建污染源聚合节点
        const aggId = `PollutionAggregate_${project.id}`;
        await session.run(`
            MERGE (agg:PollutionAggregate {id: $id})
            SET agg.projectId = $projectId,
                agg.items = $items,
                agg.itemCount = $itemCount,
                agg.showLabel = true,
                agg.nodeType = 'aggregate',
                agg.category = 'PollutionAggregate',
                agg.createdAt = timestamp()
        `, {
            id: aggId,
            projectId: project.id,
            items: validSources,
            itemCount: validSources.length
        });

        // 2. 连接到新闻项目
        await session.run(`
            MATCH (p:Project {id: $projectId})
            MATCH (agg:PollutionAggregate {id: $aggId})
            MERGE (p)-[r:HAS_POLLUTION]->(agg)
            SET r.createdAt = timestamp()
        `, {
            projectId: project.id,
            aggId: aggId
        });

        console.log(`   ⚠️ 污染源聚合节点: ${validSources.length} 个污染源`);
        
        // 3. 连接到污染源词云节点
        await this.connectToPollutionWordClouds(session, aggId, project.pollution_categories || []);
    }

    async connectToPollutionWordClouds(session, aggregateId, categories) {
        if (!categories || categories.length === 0) return;
        
        for (const category of categories) {
            if (category && category !== '未知' && category.trim()) {
                const categoryName = category.trim();
                
                // 创建污染词云节点
                await session.run(`
                    MERGE (wc:Pollution {name: $name})
                    ON CREATE SET 
                        wc.isWordCloud = true,
                        wc.showLabel = true,
                        wc.nodeType = 'wordcloud',
                        wc.category = 'Pollution',
                        wc.createdAt = timestamp()
                    ON MATCH SET 
                        wc.updatedAt = timestamp()
                `, { name: categoryName });

                // 连接聚合节点到词云节点
                await session.run(`
                    MATCH (agg:PollutionAggregate {id: $aggId})
                    MATCH (wc:Pollution {name: $name})
                    MERGE (agg)-[r:BELONGS_TO_CATEGORY]->(wc)
                    SET r.createdAt = timestamp()
                `, {
                    aggId: aggregateId,
                    name: categoryName
                });
                
                console.log(`     🏷️  连接到污染词云: "${categoryName}"`);
            }
        }
    }

    async createCombinedContentNode(session, project) {
        const measures = project.measure || [];
        const effects = project.effect_data || [];

        if (measures.length === 0 && effects.length === 0) return;

        // 1. 创建措施效果合并节点
        const ccId = `CombinedContent_${project.id}`;
        await session.run(`
            MERGE (cc:CombinedContent {id: $id})
            SET cc.projectId = $projectId,
                cc.measure = $measure,
                cc.effect_data = $effect_data,
                cc.showLabel = true,
                cc.nodeType = 'combined',
                cc.category = 'CombinedContent',
                cc.createdAt = timestamp()
        `, {
            id: ccId,
            projectId: project.id,
            measure: measures,
            effect_data: effects
        });

        // 2. 连接到新闻项目
        await session.run(`
            MATCH (p:Project {id: $projectId})
            MATCH (cc:CombinedContent {id: $ccId})
            MERGE (p)-[r:HAS_CONTENT]->(cc)
            SET r.createdAt = timestamp()
        `, { projectId: project.id, ccId: ccId });

        console.log(`   📊 内容合并节点: ${measures.length} 措施, ${effects.length} 效果`);
    }

    async createTimeNode(session, project) {
        try {
            const publishTime = project.publish_time;
            const timeCategory = project.time_category;

            // 1. 创建具体时间节点
            if (publishTime && publishTime !== '未知' && publishTime.trim() !== '') {
                const cleanedPublishTime = publishTime.trim();

                await session.run(`
                    MERGE (tn:TimeNode {name: $name})
                    ON CREATE SET 
                        tn.isWordCloud = false,
                        tn.showLabel = true,
                        tn.nodeType = 'time',
                        tn.category = 'TimeNode',
                        tn.createdAt = timestamp(),
                        tn.isSpecificDate = true,
                        tn.displayName = '📅 ' + $name
                    ON MATCH SET 
                        tn.updatedAt = timestamp()
                `, { name: cleanedPublishTime });

                // 连接到项目
                await session.run(`
                    MATCH (p:Project {id: $projectId})
                    MATCH (tn:TimeNode {name: $publishTime})
                    MERGE (p)-[r:PUBLISHED_ON]->(tn)
                    SET r.createdAt = timestamp()
                `, {
                    projectId: project.id,
                    publishTime: cleanedPublishTime
                });

                console.log(`   ⏰ 时间节点: "${cleanedPublishTime}"`);
            }

            // 2. 处理时间词云节点（季度分类）
            if (timeCategory && timeCategory !== '未知' && timeCategory.trim() !== '') {
                const cleanedTimeCategory = timeCategory.trim().replace(/\s+/g, ' ');

                await session.run(`
                    MERGE (tc:Time {name: $name})
                    ON CREATE SET 
                        tc.isWordCloud = true,
                        tc.showLabel = true,
                        tc.nodeType = 'wordcloud',
                        tc.category = 'Time',
                        tc.createdAt = timestamp(),
                        tc.displayName = '🕒 ' + $name,
                        tc.timeType = 'quarter'
                    ON MATCH SET 
                        tc.updatedAt = timestamp()
                `, {
                    name: cleanedTimeCategory
                });

                // 连接项目到时间词云
                await session.run(`
                    MATCH (p:Project {id: $projectId})
                    MATCH (tc:Time {name: $quarterName})
                    MERGE (p)-[r:BELONGS_TO_QUARTER]->(tc)
                    SET r.createdAt = timestamp()
                `, {
                    projectId: project.id,
                    quarterName: cleanedTimeCategory
                });

                console.log(`   🕒 时间词云: "${cleanedTimeCategory}"`);
            }

        } catch (error) {
            console.error(`❌ 创建时间节点失败: ${error.message}`);
        }
    }

    async createExecutorNodes(session, project) {
        const executors = project.executor || [];
        
        if (executors.length === 0) return;

        for (const executor of executors) {
            if (executor && executor !== '未知' && executor.trim()) {
                const executorName = executor.trim();
                
                await session.run(`
                    MERGE (e:Executor {name: $name})
                    ON CREATE SET 
                        e.showLabel = true,
                        e.nodeType = 'executor',
                        e.category = 'Executor',
                        e.createdAt = timestamp()
                    ON MATCH SET 
                        e.updatedAt = timestamp()
                `, { name: executorName });

                await session.run(`
                    MATCH (p:Project {id: $projectId})
                    MATCH (e:Executor {name: $executor})
                    MERGE (p)-[r:EXECUTED_BY]->(e)
                    SET r.createdAt = timestamp()
                `, {
                    projectId: project.id,
                    executor: executorName
                });
            }
        }
        
        console.log(`   👥 执行方节点: ${executors.length} 个`);
    }

    async parseCSVData(csvFilePath) {
        return new Promise((resolve, reject) => {
            const projects = [];
            let rowCount = 0;

            console.log(`📁 读取CSV文件: ${csvFilePath}`);

            if (!fs.existsSync(csvFilePath)) {
                reject(new Error(`CSV文件不存在: ${csvFilePath}`));
                return;
            }

            fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on('data', (row) => {
                    rowCount++;
                    try {
                        const project = this.normalizeProjectData(row);
                        if (project && project.id) {
                            projects.push(project);
                        }
                        
                        if (rowCount % 1000 === 0) {
                            console.log(`📊 已读取 ${rowCount} 行`);
                        }
                    } catch (error) {
                        console.warn('⚠️ 解析CSV行数据失败:', error.message);
                    }
                })
                .on('end', () => {
                    console.log(`✅ 从CSV解析 ${projects.length} 个项目（共 ${rowCount} 行）`);
                    resolve(projects);
                })
                .on('error', reject);
        });
    }

    normalizeProjectData(row) {
        // 确保ID唯一，使用CSV中的ID或生成唯一ID
        let id = row.id || row.news_id || `kg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 如果ID是数字，添加前缀避免与新闻ID冲突
        if (/^\d+$/.test(id)) {
            id = `kg_${id}`;
        }
        
        return {
            id: id,
            title: row.title || '无标题',
            theme: row.theme || '',
            location: row.location || '',
            pollution_source: parseField(row.pollution_source),
            measure: parseField(row.measure),
            executor: parseField(row.executor),
            effect_data: parseField(row.effect_data),
            keywords: parseField(row.keywords),
            source_url: row.source_url || '',
            publish_time: row.publish_time || '',
            theme_categories: parseField(row.theme_categories),
            location_categories: parseField(row.location_categories),
            pollution_categories: parseField(row.pollution_categories),
            time_category: parseTimeCategory(row.time_category)
        };
    }

    async close() {
        await this.driver.close();
    }
}

module.exports = MaritimeKnowledgeGraphBuilder;
