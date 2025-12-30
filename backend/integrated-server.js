// backend/integrated-server.js - 完整整合版本
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const neo4j = require('neo4j-driver');

// 导入Qdrant配置和RAG服务
const qdrantConfig = require('./config/qdrant-config');
const ragQAService = require('./vector-rag/qa-service');

// 导入增强的检索器
const enhancedRetriever = require('./vector-rag/enhanced-retriever');
const categoryRetriever = require('./vector-rag/category-retriever');

// 导入向量化器
const newsVectorizer = require('./vector-rag/vectorizer');

// 导入知识图谱构建器
const MaritimeKnowledgeGraphBuilder = require('./maritime-kg-builder');
const MaritimeNewsKnowledgeGraphBuilder = require('./maritime-kg-builder');
const NewsRelationshipBuilder = require('./news-relationship-builder');

const app = express();

// Neo4j驱动配置
const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'ocean123'),
    {
        encrypted: false,
        trust: 'TRUST_ALL_CERTIFICATES',
        maxConnectionLifetime: 3 * 60 * 60 * 1000,
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 120000,
        disableLosslessIntegers: true
    }
);

// 节点颜色辅助函数
function getNodeColor(type) {
    const colorMap = {
        'Theme': '#9b59b6',
        'Location': '#e67e22',
        'Pollution': '#e74c3c',
        'Time': '#3498db',
        'Project': '#ff6b6b',
        'CombinedContent': '#2ecc71',
        'PollutionSource': '#ff9ff3',
        'Measure': '#feca57',
        'Effect': '#1dd1a1',
        'Executor': '#54a0ff',
        'News': '#95a5a6',
        'ThemeCategory': '#8e44ad',
        'LocationRegion': '#d35400',
        'TimePeriod': '#2980b9',
        'News': '#ff6b6b',
        'LocationCategory': '#4ecdc4',
        'ThemeCategory': '#feca57',
        'PollutionCategory': '#ff9ff3',
        'TimeCategory': '#c8d6e5'
    };
    return colorMap[type] || '#95a5a6';
}

// CORS配置
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5501',
        'http://127.0.0.1:5501',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// 添加请求日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

// ============ 辅助函数 ============
function tryParseJSON(str) {
    if (!str) return [];
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return [str];
    }
}

function getCategoryType(wordcloudType) {
    const typeMap = {
        'Theme': 'ThemeCategory',
        'Location': 'LocationRegion',
        'Pollution': 'PollutionSource',
        'Time': 'TimePeriod'
    };
    return typeMap[wordcloudType] || 'ThemeCategory';
}

function getRelationshipType(categoryType) {
    const typeMap = {
        'ThemeCategory': 'HAS_THEME',
        'LocationRegion': 'LOCATED_IN',
        'PollutionSource': 'ADDRESSES_POLLUTION',
        'TimePeriod': 'OCCURS_IN'
    };
    return typeMap[categoryType] || 'RELATED_TO';
}

function createNodeData(neo4jNode) {
    if (!neo4jNode || !neo4jNode.properties) {
        console.warn('⚠️ 无效的节点数据:', neo4jNode);
        return {
            id: 'invalid_node',
            name: '未知节点',
            category: 'Unknown',
            symbolSize: 10,
            showLabel: false,
            isWordCloud: false,
            nodeType: 'unknown',
            itemStyle: { color: '#95a5a6', borderColor: '#fff', borderWidth: 1 },
            properties: {}
        };
    }

    const properties = neo4jNode.properties || {};
    const labels = neo4jNode.labels || [];
    const category = labels[0] || 'Unknown';

    // 判断是否为词云节点
    const isWordCloud = properties.isWordCloud ||
        category === 'Theme' ||
        category === 'Location' ||
        category === 'Pollution' ||
        category === 'Time';

    const nodeType = properties.nodeType || 'unknown';

    // 处理显示名称
    let displayName = properties.name || properties.title || '未知节点';

    // 项目节点显示ID
    if (category === 'Project' && properties.id) {
        displayName = `项目${properties.id}`;
    }

    // 新闻节点显示标题
    if (category === 'News' && properties.title) {
        displayName = properties.title.length > 30 ? properties.title.substring(0, 30) + '...' : properties.title;
    }

    // 词云节点显示标签
    const showLabel = isWordCloud;

    const colorMap = {
        'Project': '#ff6b6b',
        'Theme': '#9b59b6',
        'Location': '#e67e22',
        'Pollution': '#e74c3c',
        'Time': '#3498db',
        'PollutionSource': '#ff7979',
        'ThemeCategory': '#8e44ad',
        'LocationRegion': '#d35400',
        'TimePeriod': '#2980b9',
        'News': '#95a5a6',
        'CombinedContent': '#2ecc71',
        'Executor': '#54a0ff',
        'Measure': '#feca57',
        'Effect': '#1dd1a1',
        'News': '#ff6b6b',
        'LocationCategory': '#4ecdc4',
        'ThemeCategory': '#feca57',
        'PollutionCategory': '#ff9ff3',
        'TimeCategory': '#c8d6e5'
    };

    const sizeMap = {
        'Project': 25,
        'Theme': 35,
        'Location': 35,
        'Pollution': 35,
        'Time': 30,
        'PollutionSource': 20,
        'ThemeCategory': 20,
        'LocationRegion': 20,
        'TimePeriod': 20,
        'News': 25,
        'CombinedContent': 20,
        'Executor': 20,
        'News': 25,
        'LocationCategory': 30,
        'ThemeCategory': 28,
        'PollutionCategory': 26,
        'TimeCategory': 32
    };

    return {
        id: neo4jNode.identity ? neo4jNode.identity.toString() : `node_${Date.now()}`,
        name: displayName,
        category: category,
        symbolSize: sizeMap[category] || 20,
        showLabel: showLabel,
        isWordCloud: isWordCloud,
        nodeType: nodeType,
        itemStyle: {
            color: colorMap[category] || '#95a5a6',
            borderColor: '#fff',
            borderWidth: isWordCloud ? 3 : 2
        },
        properties: properties
    };
}

// 统一转换为数组
function convertToArray(value) {
    if (Array.isArray(value)) {
        return value.filter(item => item && item.trim());
    } else if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.filter(item => item && item.trim());
            } else {
                return [value.trim()];
            }
        } catch {
            if (value.includes(',')) {
                return value.split(',')
                    .map(item => item.trim())
                    .filter(item => item);
            } else {
                return [value.trim()];
            }
        }
    } else {
        return [];
    }
}

// 辅助函数：格式化日期显示
function formatDateForDisplay(dateStr) {
    if (!dateStr) return '未知日期';

    try {
        // 尝试解析多种格式
        let date;

        if (dateStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
            // 格式: 2025-11-2
            const parts = dateStr.split('-');
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        } else if (dateStr.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
            // 格式: 2025/11/2
            const parts = dateStr.split('/');
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        } else {
            // 其他格式，直接返回
            return dateStr;
        }
    } catch (e) {
        return dateStr;
    }
}

function getAggregateTypeName(type) {
    const map = {
        'LocationAggregate': '位置',
        'ThemeAggregate': '主题',
        'PollutionAggregate': '污染源'
    };
    return map[type] || '聚合';
}

function getAggregateDisplayName(category) {
    const map = {
        'Theme': '主题',
        'Location': '位置',
        'Pollution': '污染源'
    };
    return map[category] || '聚合';
}

function getAggregateColor(category) {
    const colorMap = {
        'Theme': '#9b59b6',
        'Location': '#e67e22',
        'Pollution': '#e74c3c',
        'Time': '#3498db'
    };
    return colorMap[category] || '#95a5a6';
}

// 清理日期字符串函数
function cleanDateString(dateStr) {
    if (!dateStr) return '';

    console.log(`[清理日期] 原始: "${dateStr}"`);

    // 移除所有非数字和分隔符的字符
    let cleaned = dateStr.replace(/[^0-9\/\-年月日]/g, '');

    // 处理中文日期
    cleaned = cleaned.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '');

    // 统一分隔符为连字符
    cleaned = cleaned.replace(/\//g, '-');

    // 移除末尾的分隔符
    cleaned = cleaned.replace(/[-]+$/g, '');

    // 分割日期部分
    const parts = cleaned.split('-').filter(p => p);

    let result;
    if (parts.length >= 3) {
        // 完整日期: YYYY-MM-DD
        const year = parts[0].padStart(4, '20');
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        result = `${year}-${month}-${day}`;
    } else if (parts.length === 2) {
        // 年月: YYYY-MM
        const year = parts[0].padStart(4, '20');
        const month = parts[1].padStart(2, '0');
        result = `${year}-${month}`;
    } else if (parts.length === 1) {
        // 年份: YYYY
        const year = parts[0].padStart(4, '20');
        result = year;
    } else {
        result = dateStr;
    }

    console.log(`[清理日期] 结果: "${result}"`);
    return result;
}

// 判断日期是否严格匹配
function isDateStrictlyMatch(foundDate, queryDate, cleanDate) {
    if (!foundDate) return false;

    console.log(`[日期匹配检查]`);
    console.log(`  找到日期: "${foundDate}"`);
    console.log(`  查询日期: "${queryDate}"`);
    console.log(`  清理日期: "${cleanDate}"`);

    // 方法1: 直接相等
    if (foundDate === queryDate || foundDate === cleanDate) {
        console.log(`  ✅ 直接相等匹配`);
        return true;
    }

    // 方法2: 标准化后比较
    const foundClean = cleanDateString(foundDate);
    const queryClean = cleanDate || cleanDateString(queryDate);

    if (foundClean === queryClean) {
        console.log(`  ✅ 标准化后匹配: "${foundClean}" = "${queryClean}"`);
        return true;
    }

    console.log(`  ❌ 标准化后不匹配: "${foundClean}" != "${queryClean}"`);

    // 方法3: 解析日期对象比较
    try {
        const foundDateObj = new Date(foundDate);
        const queryDateObj = new Date(queryDate);

        if (!isNaN(foundDateObj.getTime()) && !isNaN(queryDateObj.getTime())) {
            // 比较年月日是否相同
            const isSameDate = foundDateObj.getFullYear() === queryDateObj.getFullYear() &&
                foundDateObj.getMonth() === queryDateObj.getMonth() &&
                foundDateObj.getDate() === queryDateObj.getDate();

            console.log(`  ${isSameDate ? '✅' : '❌'} 日期对象比较:`, {
                found: `${foundDateObj.getFullYear()}-${foundDateObj.getMonth() + 1}-${foundDateObj.getDate()}`,
                query: `${queryDateObj.getFullYear()}-${queryDateObj.getMonth() + 1}-${queryDateObj.getDate()}`,
                isSameDate
            });

            return isSameDate;
        }
    } catch (e) {
        console.log(`  ⚠️ 日期解析失败: ${e.message}`);
    }

    // 方法4: 字符串包含（谨慎使用）
    // 只有当查询日期是完整格式时才使用
    if (queryDate.includes('-') && queryDate.split('-').length === 3) {
        const containsMatch = foundDate.includes(queryDate);
        console.log(`  ${containsMatch ? '✅' : '❌'} 字符串包含匹配: ${containsMatch}`);
        return containsMatch;
    }

    console.log(`  ❌ 所有匹配方法都失败`);
    return false;
}

// 计算日期相似度（用于调试）
function calculateDateSimilarity(date1, date2) {
    if (!date1 || !date2) return 0;

    // 清理日期
    const clean1 = cleanDateString(date1);
    const clean2 = cleanDateString(date2);

    // 如果完全相同
    if (clean1 === clean2) return 100;

    // 计算相同字符数量
    let matches = 0;
    const maxLength = Math.max(clean1.length, clean2.length);

    for (let i = 0; i < maxLength; i++) {
        if (clean1[i] === clean2[i]) {
            matches++;
        }
    }

    const similarity = Math.round((matches / maxLength) * 100);
    console.log(`[相似度计算] "${clean1}" vs "${clean2}" = ${similarity}%`);
    return similarity;
}

// 统一数据格式转换
function normalizeNewsData(neo4jRecord) {
    const baseData = {
        id: neo4jRecord.get('id'),
        title: neo4jRecord.get('title') || '无标题',
        theme: neo4jRecord.get('theme') || '',
        source_url: neo4jRecord.get('source_url') || '',
        publish_time: neo4jRecord.get('publish_time') || '',
        time_category: neo4jRecord.get('time_category') || ''
    };

    // 处理数组字段的统一转换
    const arrayFields = {
        locations: neo4jRecord.get('location'),
        pollution_source: neo4jRecord.get('pollution_source'),
        measure: neo4jRecord.get('measure'),
        executor: neo4jRecord.get('executor'),
        effect_data: neo4jRecord.get('effect_data'),
        keywords: neo4jRecord.get('keywords'),
        theme_categories: neo4jRecord.get('theme_categories'),
        location_categories: neo4jRecord.get('location_categories'),
        pollution_categories: neo4jRecord.get('pollution_categories')
    };

    // 统一转换逻辑
    Object.keys(arrayFields).forEach(field => {
        const value = arrayFields[field];
        baseData[field] = convertToArray(value);
    });

    return baseData;
}

// ============ 知识图谱API端点 ============

// 获取最新新闻
app.get('/api/knowledge-graph/latest-news', async (req, res) => {
    let session;
    try {
        const limit = parseInt(req.query.limit) || 15;

        console.log(`📰 获取最新 ${limit} 篇新闻...`);

        session = driver.session();

        const result = await session.run(`
            MATCH (p:Project)
            WHERE p.title IS NOT NULL AND p.title <> ''
            RETURN 
                id(p) as id,
                p.id as projectId,
                p.title as title,
                p.theme as theme,
                p.raw_location as location,
                p.pollution_source as pollution_source,
                p.measure as measure,
                p.effect_data as effect_data,
                p.executor as executor,
                p.source_url as source_url,
                p.publish_time as publish_time
            ORDER BY p.publish_time DESC
            LIMIT $limit
        `, {
            limit: neo4j.int(limit)
        });

        const news = result.records.map(record => {
            const idRecord = record.get('id');
            const id = idRecord && typeof idRecord.toNumber === 'function' ?
                idRecord.toNumber().toString() : idRecord.toString();

            const pollutionSource = tryParseJSON(record.get('pollution_source')) || [];
            const measure = tryParseJSON(record.get('measure')) || [];
            const effectData = tryParseJSON(record.get('effect_data')) || [];
            const executor = tryParseJSON(record.get('executor')) || [];

            return {
                id: id,
                projectId: record.get('projectId'),
                name: record.get('title') || `项目${record.get('projectId')}`,
                title: record.get('title') || '无标题',
                category: 'News',
                type: 'news',
                properties: {
                    id: record.get('projectId'),
                    title: record.get('title'),
                    theme: record.get('theme'),
                    location: record.get('location'),
                    pollution_source: pollutionSource,
                    measure: measure,
                    effect_data: effectData,
                    executor: executor,
                    source_url: record.get('source_url'),
                    publish_time: record.get('publish_time')
                }
            };
        });

        console.log(`✅ 返回 ${news.length} 篇最新新闻`);

        res.json({
            success: true,
            data: news,
            count: news.length,
            limit: limit
        });

    } catch (error) {
        console.error('❌ 获取最新新闻失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    } finally {
        if (session) await session.close();
    }
});

// 获取热门词云：按类别均衡抽样，保证多元化
app.get('/api/knowledge-graph/popular-wordclouds', async (req, res) => {
    let session;
    try {
        const totalLimit = parseInt(req.query.limit) || 8;
        console.log(`🔥 获取热门词云（多类别），总限制: ${totalLimit} 个`);

        session = driver.session();

        // 1. 为每个类别分配一个基础配额，比如 totalLimit=8 时，每类 2 个
        const categories = ['Theme', 'Location', 'Pollution', 'Time'];
        const perCategoryBase = Math.max(1, Math.floor(totalLimit / categories.length)); // 通常是 2
        const categoryLimits = {
            Theme: perCategoryBase,
            Location: perCategoryBase,
            Pollution: perCategoryBase,
            Time: perCategoryBase
        };

        let wordclouds = [];

        // 2. 逐类查询词云节点，保证每类至少尝试拿到若干个
        for (const cat of categories) {
            const catLimit = categoryLimits[cat];

            const result = await session.run(`
                MATCH (wc:${cat})
                WHERE wc.isWordCloud = true
                RETURN 
                    id(wc) as id,
                    wc.name as name,
                    '${cat}' as category,
                    wc.isWordCloud as isWordCloud,
                    wc.showLabel as showLabel,
                    properties(wc) as properties
                ORDER BY wc.name
                LIMIT $limit
            `, {
                limit: neo4j.int(catLimit)
            });

            const records = result.records || [];

            records.forEach(record => {
                const idRecord = record.get('id');
                const id = idRecord && typeof idRecord.toNumber === 'function'
                    ? idRecord.toNumber().toString()
                    : idRecord.toString();

                wordclouds.push({
                    id,
                    name: record.get('name') || '未知词云',
                    category: cat,
                    isWordCloud: true,
                    showLabel: true,
                    symbolSize: 40,
                    properties: record.get('properties') || {}
                });
            });
        }

        // 3. 去重（同一节点可能被重复选到的安全处理）
        const uniqueMap = new Map();
        for (const wc of wordclouds) {
            if (!uniqueMap.has(wc.id)) {
                uniqueMap.set(wc.id, wc);
            }
        }
        wordclouds = Array.from(uniqueMap.values());

        // 4. 如果总数超过 totalLimit，就截断一下；如果不足就直接返回（一般也够用）
        if (wordclouds.length > totalLimit) {
            wordclouds = wordclouds.slice(0, totalLimit);
        }

        console.log(`✅ 返回 ${wordclouds.length} 个热门词云（多类别混合）`);

        res.json({
            success: true,
            data: wordclouds,
            count: wordclouds.length
        });

    } catch (error) {
        console.error('❌ 获取热门词云失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    } finally {
        if (session) await session.close();
    }
});


// 获取时间新闻
app.get('/api/knowledge-graph/time-news/:timeName', async (req, res) => {
    let session;
    try {
        const timeName = decodeURIComponent(req.params.timeName);
        console.log(`🔍 查询时间 "${timeName}" 的新闻`);

        session = driver.session();

        const result = await session.run(`
            MATCH (t:TimeNode {name: $name})<-[:PUBLISHED_ON]-(p:Project)
            RETURN 
                id(p) as id,
                p.id as projectId,
                p.title as title,
                p.theme as theme,
                p.raw_location as location,
                p.pollution_source as pollution_source,
                p.measure as measure,
                p.effect_data as effect_data,
                p.executor as executor,
                p.source_url as source_url,
                p.publish_time as publish_time
            ORDER BY p.id
            LIMIT 20
        `, { name: timeName });

        const news = result.records.map(record => {
            const idRecord = record.get('id');
            const id = idRecord && typeof idRecord.toNumber === 'function' ?
                idRecord.toNumber().toString() : idRecord.toString();

            const pollutionSource = tryParseJSON(record.get('pollution_source')) || [];
            const measure = tryParseJSON(record.get('measure')) || [];
            const effectData = tryParseJSON(record.get('effect_data')) || [];
            const executor = tryParseJSON(record.get('executor')) || [];

            return {
                id: id,
                projectId: record.get('projectId'),
                name: record.get('title') || `项目${record.get('projectId')}`,
                category: 'News',
                type: 'news',
                properties: {
                    id: record.get('projectId'),
                    title: record.get('title'),
                    theme: record.get('theme'),
                    location: record.get('location'),
                    pollution_source: pollutionSource,
                    measure: measure,
                    effect_data: effectData,
                    executor: executor,
                    source_url: record.get('source_url'),
                    publish_time: record.get('publish_time')
                }
            };
        });

        console.log(`✅ 找到 ${news.length} 篇新闻`);

        res.json({
            success: true,
            data: news,
            time: timeName,
            count: news.length
        });

    } catch (error) {
        console.error('❌ 查询时间新闻失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    } finally {
        if (session) await session.close();
    }
});

// 调试端点：查询特定日期的项目
app.get('/api/debug/date-projects/:date', async (req, res) => {
    let session;
    try {
        const dateStr = decodeURIComponent(req.params.date);

        console.log(`🔍 调试查询日期: "${dateStr}" 的项目`);

        session = driver.session();

        const exactResult = await session.run(`
            MATCH (p:Project)
            WHERE p.publish_time = $date
            RETURN p.id, p.title, p.publish_time, p.time_category
            LIMIT 10
        `, { date: dateStr });

        const containsResult = await session.run(`
            MATCH (p:Project)
            WHERE p.publish_time CONTAINS $datePart
            RETURN p.id, p.title, p.publish_time, p.time_category
            LIMIT 10
        `, { datePart: dateStr.split('-')[0] });

        const viaTimePeriodResult = await session.run(`
            MATCH (tp:TimePeriod {name: $date})<-[:PUBLISHED_ON]-(p:Project)
            RETURN tp.name, p.id, p.title, p.publish_time
            LIMIT 10
        `, { date: dateStr });

        res.json({
            success: true,
            exactMatch: exactResult.records.map(r => ({
                id: r.get('p.id'),
                title: r.get('p.title'),
                publish_time: r.get('p.publish_time'),
                time_category: r.get('p.time_category')
            })),
            containsMatch: containsResult.records.map(r => ({
                id: r.get('p.id'),
                title: r.get('p.title'),
                publish_time: r.get('p.publish_time'),
                time_category: r.get('p.time_category')
            })),
            viaTimePeriod: viaTimePeriodResult.records.map(r => ({
                timePeriod: r.get('tp.name'),
                id: r.get('p.id'),
                title: r.get('p.title'),
                publish_time: r.get('p.publish_time')
            })),
            debug: {
                dateQueried: dateStr,
                exactCount: exactResult.records.length,
                containsCount: containsResult.records.length,
                timePeriodCount: viaTimePeriodResult.records.length
            }
        });

    } catch (error) {
        console.error('调试查询失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (session) await session.close();
    }
});

// 获取时间词云的具体日期
app.get('/api/knowledge-graph/time-wordcloud-dates/:wordcloudName', async (req, res) => {
    let session;
    try {
        const wordcloudName = decodeURIComponent(req.params.wordcloudName);
        const limit = parseInt(req.query.limit) || 10;

        console.log(`🔍 获取时间词云 "${wordcloudName}" 的具体日期，限制: ${limit}个...`);

        session = driver.session();

        const result = await session.run(`
            MATCH (wc:Time {name: $name})<-[:BELONGS_TO_QUARTER]-(p:Project)
            WHERE p.publish_time IS NOT NULL AND p.publish_time <> '未知'
            RETURN DISTINCT p.publish_time as date,
                   count(p) as projectCount
            ORDER BY p.publish_time DESC
            LIMIT $limit
        `, {
            name: wordcloudName,
            limit: neo4j.int(limit)
        });

        const dates = result.records.map(record => {
            const dateStr = record.get('date');
            const projectCount = record.get('projectCount');

            return {
                name: dateStr,
                displayName: dateStr,
                projectCount: projectCount,
                category: 'TimePeriod',
                isWordCloud: false,
                showLabel: true,
                isTimeDate: true
            };
        });

        console.log(`✅ 找到 ${dates.length} 个具体日期`);

        const countResult = await session.run(`
            MATCH (wc:Time {name: $name})<-[:BELONGS_TO_QUARTER]-(p:Project)
            WHERE p.publish_time IS NOT NULL AND p.publish_time <> '未知'
            RETURN count(DISTINCT p.publish_time) as total
        `, { name: wordcloudName });

        const totalRecord = countResult.records[0].get('total');
        const total = totalRecord && typeof totalRecord.toNumber === 'function' ?
            totalRecord.toNumber() : parseInt(totalRecord) || 0;

        res.json({
            success: true,
            data: dates,
            wordcloud: {
                name: wordcloudName,
                type: 'quarter'
            },
            pagination: {
                total: total,
                limit: limit,
                returned: dates.length,
                hasMore: total > limit
            }
        });

    } catch (error) {
        console.error('❌ 获取时间词云日期失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    } finally {
        if (session) await session.close();
    }
});

// 查询日期新闻
app.get('/api/knowledge-graph/date-news/:date', async (req, res) => {
    let session;
    try {
        const dateStr = decodeURIComponent(req.params.date);
        const limit = parseInt(req.query.limit) || 10;

        console.log(`📅 查询日期 "${dateStr}" 的新闻...`);

        session = driver.session();

        const result = await session.run(`
            MATCH (p:Project)
            WHERE p.publish_time = $date
            RETURN 
                id(p) as id,
                p.id as projectId,
                p.name as name,
                p.title as title,
                p.theme as theme,
                p.raw_location as location,
                p.pollution_source as pollution_source,
                p.measure as measure,
                p.effect_data as effect_data,
                p.executor as executor,
                p.source_url as source_url,
                p.publish_time as publish_time
            ORDER BY p.id
            LIMIT $limit
        `, {
            date: dateStr,
            limit: neo4j.int(limit)
        });

        const news = result.records.map(record => {
            const idRecord = record.get('id');
            const id = idRecord && typeof idRecord.toNumber === 'function' ?
                idRecord.toNumber().toString() : idRecord.toString();

            const pollutionSource = tryParseJSON(record.get('pollution_source')) || [];
            const measure = tryParseJSON(record.get('measure')) || [];
            const effectData = tryParseJSON(record.get('effect_data')) || [];
            const executor = tryParseJSON(record.get('executor')) || [];

            return {
                id: id,
                projectId: record.get('projectId'),
                name: record.get('name') || `项目${record.get('projectId') || id}`,
                title: record.get('title') || '无标题',
                category: 'News',
                type: 'news',
                properties: {
                    id: record.get('projectId'),
                    title: record.get('title'),
                    theme: record.get('theme'),
                    location: record.get('location'),
                    pollution_source: pollutionSource,
                    measure: measure,
                    effect_data: effectData,
                    executor: executor,
                    source_url: record.get('source_url'),
                    publish_time: record.get('publish_time')
                }
            };
        });

        console.log(`✅ 找到 ${news.length} 篇 ${dateStr} 的新闻`);

        res.json({
            success: true,
            data: news,
            date: dateStr,
            count: news.length
        });

    } catch (error) {
        console.error('❌ 查询日期新闻失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    } finally {
        if (session) await session.close();
    }
});

// 获取词云节点列表
app.get('/api/knowledge-graph/wordclouds', async (req, res) => {
    let session;
    try {
        console.log('🌐 获取词云节点列表...');

        session = driver.session();

        const result = await session.run(`
            MATCH (wc)
            WHERE wc.isWordCloud = true
            AND labels(wc)[0] IN ['Theme', 'Location', 'Pollution', 'Time']
            RETURN 
                id(wc) as id,
                wc.name as name,
                labels(wc)[0] as category,
                wc.isWordCloud as isWordCloud,
                wc.showLabel as showLabel,
                properties(wc) as properties
            ORDER BY wc.name
            LIMIT 50
        `);

        const wordclouds = result.records.map(record => {
            const idRecord = record.get('id');
            const id = idRecord && typeof idRecord.toNumber === 'function' ?
                idRecord.toNumber().toString() : idRecord.toString();

            const properties = record.get('properties') || {};

            return {
                id: id,
                name: record.get('name') || '未知词云',
                category: record.get('category') || 'Unknown',
                isWordCloud: true,
                showLabel: true,
                symbolSize: 35,
                properties: properties
            };
        });

        console.log(`✅ 返回 ${wordclouds.length} 个词云节点`);

        res.json({
            success: true,
            data: wordclouds,
            count: wordclouds.length
        });

    } catch (error) {
        console.error('❌ 获取词云节点失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    } finally {
        if (session) await session.close();
    }
});

// 调试API：检查时间节点连接
app.get('/api/debug/check-time-connections', async (req, res) => {
    let session;
    try {
        session = driver.session();

        const countResult = await session.run(`
            MATCH (n)
            WHERE labels(n)[0] IN ['TimeNode', 'TimeWordCloud']
            RETURN labels(n)[0] as type, count(n) as count
        `);

        const counts = {};
        countResult.records.forEach(record => {
            counts[record.get('type')] = record.get('count');
        });

        const sampleResult = await session.run(`
            MATCH (p:Project)
            OPTIONAL MATCH (p)-[:PUBLISHED_ON]->(t:TimeNode)
            OPTIONAL MATCH (p)-[:HAS_TIME_CATEGORY]->(twc:TimeWordCloud)
            RETURN 
                p.id as projectId,
                p.title as title,
                p.publish_time as publishTime,
                t.name as timeNodeName,
                id(t) as timeNodeId,
                twc.name as timeWordcloudName,
                id(twc) as timeWordcloudId
            ORDER BY p.id
            LIMIT 10
        `);

        const samples = sampleResult.records.map(record => ({
            projectId: record.get('projectId'),
            title: record.get('title'),
            publishTime: record.get('publishTime'),
            timeNode: record.get('timeNodeName') ? {
                name: record.get('timeNodeName'),
                id: record.get('timeNodeId')
            } : null,
            timeWordcloud: record.get('timeWordcloudName') ? {
                name: record.get('timeWordcloudName'),
                id: record.get('timeWordcloudId')
            } : null
        }));

        const wordcloudResult = await session.run(`
            MATCH (twc:TimeWordCloud)
            OPTIONAL MATCH (twc)<-[:BELONGS_TO_QUARTER]-(t:TimeNode)
            RETURN 
                twc.name as wordcloudName,
                count(t) as timeNodeCount,
                collect(t.name)[0..5] as sampleTimes
            ORDER BY timeNodeCount DESC
            LIMIT 5
        `);

        const wordclouds = wordcloudResult.records.map(record => ({
            name: record.get('wordcloudName'),
            timeNodeCount: record.get('timeNodeCount'),
            sampleTimes: record.get('sampleTimes')
        }));

        res.json({
            success: true,
            nodeCounts: counts,
            sampleProjects: samples,
            timeWordclouds: wordclouds,
            message: `数据库中有 ${counts.TimeNode || 0} 个时间节点和 ${counts.TimeWordCloud || 0} 个时间词云`
        });

    } catch (error) {
        console.error('调试API失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (session) await session.close();
    }
});

// 时间词云的特殊处理
async function handleTimeWordCloudAggregates(session, wordcloudName, limit, res) {
    console.log(`⏰ 处理时间词云: ${wordcloudName}`);

    const result = await session.run(`
        MATCH (wc:Time {name: $name})
        MATCH (p:Project)-[:BELONGS_TO_QUARTER]->(wc)
        RETURN 
            id(p) as id,
            p.id as projectId,
            p.title as title,
            p.publish_time as publish_time,
            p.time_category as time_category
        ORDER BY p.publish_time DESC
        LIMIT $limit
    `, {
        name: wordcloudName,
        limit: neo4j.int(limit)
    });

    const aggregates = result.records.map(record => {
        const idRecord = record.get('id');
        const id = idRecord && typeof idRecord.toNumber === 'function' ?
            idRecord.toNumber().toString() : idRecord.toString();

        const projectId = record.get('projectId');
        const title = record.get('title');

        return {
            id: id,
            name: `📰 ${title?.substring(0, 40) || `项目${projectId}`}`,
            category: 'Project',
            type: 'news',
            symbolSize: 20,
            color: '#ff6b6b',
            showLabel: false,
            properties: {
                projectId: projectId,
                title: title,
                publish_time: record.get('publish_time'),
                time_category: record.get('time_category'),
                wordcloudName: wordcloudName,
                wordcloudCategory: 'Time'
            }
        };
    });

    const countResult = await session.run(`
        MATCH (wc:Time {name: $name})<-[:BELONGS_TO_QUARTER]-(p:Project)
        RETURN count(p) as total
    `, { name: wordcloudName });

    const totalRecord = countResult.records[0].get('total');
    const total = totalRecord && typeof totalRecord.toNumber === 'function' ?
        totalRecord.toNumber() : parseInt(totalRecord) || 0;

    console.log(`✅ 时间词云找到 ${aggregates.length} 个项目 (总计 ${total} 个)`);

    res.json({
        success: true,
        data: aggregates,
        wordcloud: {
            name: wordcloudName,
            category: 'Time'
        },
        pagination: {
            total: total,
            limit: limit,
            returned: aggregates.length,
            hasMore: total > limit
        }
    });
}

// 获取时间节点详情
app.get('/api/knowledge-graph/time-node-details/:timeName', async (req, res) => {
    let session;
    try {
        const timeName = decodeURIComponent(req.params.timeName);

        console.log(`🔍 获取时间节点详情: "${timeName}"`);

        session = driver.session();

        const result = await session.run(`
            MATCH (tn:TimeNode {name: $name})
            OPTIONAL MATCH (tn)<-[:PUBLISHED_ON]-(p:Project)
            OPTIONAL MATCH (tn)-[:BELONGS_TO_QUARTER]->(tc:Time {isWordCloud: true})
            RETURN 
                tn.name as name,
                tn.displayName as displayName,
                tn.isSpecificDate as isSpecificDate,
                count(p) as projectCount,
                collect(DISTINCT tc.name)[0] as quarterName,
                collect(DISTINCT tc.displayName)[0] as quarterDisplayName
        `, { name: timeName });

        if (result.records.length === 0) {
            return res.status(404).json({
                success: false,
                error: '时间节点不存在'
            });
        }

        const record = result.records[0];
        const projectCount = record.get('projectCount') || 0;

        const responseData = {
            name: record.get('name'),
            displayName: record.get('displayName') || `📅 ${record.get('name')}`,
            isSpecificDate: record.get('isSpecificDate') || true,
            projectCount: projectCount,
            quarter: record.get('quarterName') ? {
                name: record.get('quarterName'),
                displayName: record.get('quarterDisplayName') || `🕒 ${record.get('quarterName')}`
            } : null
        };

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error('❌ 获取时间节点详情失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (session) await session.close();
    }
});

// 通过Qdrant向量ID查找对应的Neo4j Project ID
app.get('/api/knowledge-graph/find-project-by-vector-id/:vectorId', async (req, res) => {
    try {
        const vectorId = parseInt(req.params.vectorId, 10);
        
        if (isNaN(vectorId)) {
            return res.status(400).json({
                success: false,
                error: '无效的向量ID'
            });
        }

        console.log(`🔍 通过向量ID查找Project节点: ${vectorId}`);

        // 从Qdrant获取向量数据
        const qdrantResult = await qdrantConfig.client.retrieve(qdrantConfig.collectionName, {
            ids: [vectorId],
            with_payload: true
        });

        if (!qdrantResult || qdrantResult.length === 0) {
            return res.status(404).json({
                success: false,
                error: '向量ID不存在'
            });
        }

        const payload = qdrantResult[0].payload;
        const newsId = payload?.news_id;

        if (!newsId) {
            return res.status(404).json({
                success: false,
                error: '向量数据中缺少news_id字段'
            });
        }

        console.log(`✅ 找到对应的news_id: ${newsId}`);

        // 重定向到正常的新闻详情API
        res.json({
            success: true,
            vectorId: vectorId,
            newsId: newsId,
            redirect: `/api/knowledge-graph/news-details/${newsId}`
        });

    } catch (error) {
        console.error('❌ 查找Project节点失败:', error);
        res.status(500).json({
            success: false,
            error: '查找失败: ' + error.message
        });
    }
});

// 获取新闻详情
app.get('/api/knowledge-graph/news-details/:projectId', async (req, res) => {
    let session;
    try {
        let projectId = req.params.projectId;

        console.log(`🔍 获取新闻 ${projectId} 的详情...`);

        // 如果projectId是数字，可能是Qdrant向量ID，先尝试查找对应的news_id
        const numericProjectId = parseInt(projectId, 10);
        if (!isNaN(numericProjectId) && numericProjectId > 0 && numericProjectId < 100000) {
            // 可能是向量ID，尝试从Qdrant查找
            try {
                const qdrantResult = await qdrantConfig.client.retrieve(qdrantConfig.collectionName, {
                    ids: [numericProjectId],
                    with_payload: true
                });

                if (qdrantResult && qdrantResult.length > 0 && qdrantResult[0].payload?.news_id) {
                    const actualNewsId = qdrantResult[0].payload.news_id;
                    console.log(`🔄 检测到向量ID ${numericProjectId}，映射到news_id: ${actualNewsId}`);
                    projectId = actualNewsId;
                }
            } catch (qdrantError) {
                console.warn(`⚠️ 无法从Qdrant查找向量ID ${numericProjectId}:`, qdrantError.message);
                // 继续使用原始ID尝试
            }
        }

        session = driver.session();

        // 确保projectId是字符串类型（Neo4j中的id属性通常是字符串）
        let projectIdStr = String(projectId);
        
        // 如果projectId是纯数字，知识图谱构建时可能添加了kg_前缀
        // 先尝试原始ID，如果失败再尝试带前缀的ID
        const numericIdForPrefix = parseInt(projectIdStr, 10);
        const possibleIds = [];
        
        if (!isNaN(numericIdForPrefix) && String(numericIdForPrefix) === projectIdStr) {
            // 是纯数字，尝试两种格式
            possibleIds.push(projectIdStr);  // 原始数字字符串
            possibleIds.push(`kg_${projectIdStr}`);  // 带kg_前缀的格式
        } else {
            // 不是纯数字，只尝试原始ID
            possibleIds.push(projectIdStr);
        }
        
        let result = null;
        let foundProjectId = null;
        
        // 尝试所有可能的ID格式
        for (const testId of possibleIds) {
            console.log(`🔍 尝试查询Project节点，ID: ${testId}`);
            const testResult = await session.run(`
                MATCH (p:Project {id: $projectId})
                OPTIONAL MATCH (p)-[r1]->(tn)
                WHERE type(r1) = 'PUBLISHED_ON' AND labels(tn)[0] = 'TimeNode'
                OPTIONAL MATCH (p)-[r2]->(tc)
                WHERE type(r2) = 'BELONGS_TO_QUARTER' AND labels(tc)[0] = 'Time' AND tc.isWordCloud = true
                OPTIONAL MATCH (p)-[:HAS_LOCATION]->(loc:LocationAggregate)
                OPTIONAL MATCH (p)-[:HAS_THEME]->(theme:ThemeAggregate)
                OPTIONAL MATCH (p)-[:HAS_POLLUTION]->(poll:PollutionAggregate)
                OPTIONAL MATCH (p)-[:EXECUTED_BY]->(e:Executor)
                OPTIONAL MATCH (p)-[:HAS_CONTENT]->(cc:CombinedContent)
                RETURN 
                    p.id as projectId,
                    p.title as title,
                    p.theme as theme,
                    p.raw_location as location,
                    p.pollution_source as pollution_source,
                    p.measure as measure,
                    p.effect_data as effect_data,
                    p.executor as executor,
                    p.source_url as source_url,
                    p.publish_time as publish_time,
                    p.time_category as time_category,
                    id(tn) as timeNodeId,
                    tn.name as timeNodeName,
                    tn.displayName as timeNodeDisplayName,
                    labels(tn) as timeNodeLabels,
                    id(tc) as timeWordcloudId,
                    tc.name as timeWordcloudName,
                    tc.displayName as timeWordcloudDisplayName,
                    labels(tc) as timeWordcloudLabels,
                    loc.id as locationAggregateId,
                    loc.items as locationItems,
                    loc.itemCount as locationCount,
                    theme.id as themeAggregateId,
                    theme.items as themeItems,
                    theme.itemCount as themeCount,
                    poll.id as pollutionAggregateId,
                    poll.items as pollutionItems,
                    poll.itemCount as pollutionCount,
                    cc.measure as measures,
                    cc.effect_data as effects,
                    collect(DISTINCT e.name) as executors
            `, { projectId: testId });
            
            if (testResult.records.length > 0) {
                console.log(`✅ 找到Project节点，使用ID: ${testId}`);
                result = testResult;
                foundProjectId = testId;
                break;  // 找到就退出循环
            }
        }
        
        // 如果所有尝试都失败，使用原始查询（保持向后兼容）
        if (!result) {
            console.log(`⚠️ 所有ID格式都未找到，使用原始查询`);
            result = await session.run(`
                MATCH (p:Project {id: $projectId})
                OPTIONAL MATCH (p)-[r1]->(tn)
                WHERE type(r1) = 'PUBLISHED_ON' AND labels(tn)[0] = 'TimeNode'
                OPTIONAL MATCH (p)-[r2]->(tc)
                WHERE type(r2) = 'BELONGS_TO_QUARTER' AND labels(tc)[0] = 'Time' AND tc.isWordCloud = true
                OPTIONAL MATCH (p)-[:HAS_LOCATION]->(loc:LocationAggregate)
                OPTIONAL MATCH (p)-[:HAS_THEME]->(theme:ThemeAggregate)
                OPTIONAL MATCH (p)-[:HAS_POLLUTION]->(poll:PollutionAggregate)
                OPTIONAL MATCH (p)-[:EXECUTED_BY]->(e:Executor)
                OPTIONAL MATCH (p)-[:HAS_CONTENT]->(cc:CombinedContent)
                RETURN 
                    p.id as projectId,
                    p.title as title,
                    p.theme as theme,
                    p.raw_location as location,
                    p.pollution_source as pollution_source,
                    p.measure as measure,
                    p.effect_data as effect_data,
                    p.executor as executor,
                    p.source_url as source_url,
                    p.publish_time as publish_time,
                    p.time_category as time_category,
                    id(tn) as timeNodeId,
                    tn.name as timeNodeName,
                    tn.displayName as timeNodeDisplayName,
                    labels(tn) as timeNodeLabels,
                    id(tc) as timeWordcloudId,
                    tc.name as timeWordcloudName,
                    tc.displayName as timeWordcloudDisplayName,
                    labels(tc) as timeWordcloudLabels,
                    loc.id as locationAggregateId,
                    loc.items as locationItems,
                    loc.itemCount as locationCount,
                    theme.id as themeAggregateId,
                    theme.items as themeItems,
                    theme.itemCount as themeCount,
                    poll.id as pollutionAggregateId,
                    poll.items as pollutionItems,
                    poll.itemCount as pollutionCount,
                    cc.measure as measures,
                    cc.effect_data as effects,
                    collect(DISTINCT e.name) as executors
            `, { projectId: projectIdStr });
        }

        console.log(`📊 新闻查询结果: ${result ? result.records.length : 0} 条记录`);

        if (!result || result.records.length === 0) {
            return res.status(404).json({
                success: false,
                error: `新闻不存在 (ID: ${projectIdStr})。已尝试的ID格式: ${possibleIds.join(', ')}。提示：如果这是Qdrant向量ID，系统已尝试自动查找对应的Project节点，但未找到。请确保Neo4j中已构建知识图谱。`
            });
        }

        const record = result.records[0];

        let timeNodeData = null;
        const timeNodeId = record.get('timeNodeId');
        const timeNodeName = record.get('timeNodeName');

        if (timeNodeId && timeNodeName) {
            let idStr;
            if (timeNodeId && typeof timeNodeId.toNumber === 'function') {
                idStr = timeNodeId.toNumber().toString();
            } else if (timeNodeId) {
                idStr = timeNodeId.toString();
            }

            timeNodeData = {
                id: idStr,
                name: timeNodeName,
                displayName: record.get('timeNodeDisplayName') || `📅 ${timeNodeName}`,
                isSpecificDate: true,
                labels: record.get('timeNodeLabels') || ['TimeNode']
            };
        } else {
            const publishTime = record.get('publish_time');
            if (publishTime && publishTime !== '未知') {
                timeNodeData = {
                    id: `time_auto_${projectIdStr}`,
                    name: publishTime,
                    displayName: `📅 ${publishTime}`,
                    isSpecificDate: true,
                    autoCreated: true
                };
            }
        }

        let timeWordcloudData = null;
        const timeWordcloudId = record.get('timeWordcloudId');
        const timeWordcloudName = record.get('timeWordcloudName');

        if (timeWordcloudId && timeWordcloudName) {
            let wcIdStr;
            if (timeWordcloudId && typeof timeWordcloudId.toNumber === 'function') {
                wcIdStr = timeWordcloudId.toNumber().toString();
            } else if (timeWordcloudId) {
                wcIdStr = timeWordcloudId.toString();
            }

            timeWordcloudData = {
                id: wcIdStr,
                name: timeWordcloudName,
                displayName: record.get('timeWordcloudDisplayName') || `🕒 ${timeWordcloudName}`,
                labels: record.get('timeWordcloudLabels') || ['Time']
            };
        }

        const responseData = {
            project: {
                id: record.get('projectId'),
                title: record.get('title'),
                theme: record.get('theme'),
                location: record.get('location'),
                pollution_source: tryParseJSON(record.get('pollution_source')),
                measure: tryParseJSON(record.get('measure')),
                effect_data: tryParseJSON(record.get('effect_data')),
                executor: tryParseJSON(record.get('executor')),
                source_url: record.get('source_url'),
                publish_time: record.get('publish_time'),
                time_category: record.get('time_category')
            },
            time: timeNodeData,
            timeWordcloud: timeWordcloudData,
            locationAggregate: record.get('locationAggregateId') ? {
                id: record.get('locationAggregateId').toString(),
                projectId: foundProjectId || projectIdStr,
                items: record.get('locationItems') || [],
                itemCount: record.get('locationCount') || 0,
                type: 'Location'
            } : null,
            themeAggregate: record.get('themeAggregateId') ? {
                id: record.get('themeAggregateId').toString(),
                projectId: foundProjectId || projectIdStr,
                items: record.get('themeItems') || [],
                itemCount: record.get('themeCount') || 0,
                type: 'Theme'
            } : null,
            pollutionAggregate: record.get('pollutionAggregateId') ? {
                id: record.get('pollutionAggregateId').toString(),
                projectId: foundProjectId || projectIdStr,
                items: record.get('pollutionItems') || [],
                itemCount: record.get('pollutionCount') || 0,
                type: 'Pollution'
            } : null,
            executors: (record.get('executors') || []).filter(e => e).map(name => ({
                name: name,
                displayName: `🏢 ${name}`
            })),
            combinedContent: (record.get('measures') || []).length > 0 ||
                (record.get('effects') || []).length > 0 ? {
                projectId: foundProjectId || projectIdStr,
                measures: record.get('measures') || [],
                effects: record.get('effects') || [],
                totalMeasures: (record.get('measures') || []).length,
                totalEffects: (record.get('effects') || []).length
            } : null
        };

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error('获取新闻详情失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (session) await session.close();
    }
});

// 获取时间词云节点列表
app.get('/api/knowledge-graph/time-wordclouds', async (req, res) => {
    let session;
    try {
        console.log('⏰ 获取时间词云节点列表...');

        session = driver.session();

        const result = await session.run(`
            MATCH (wc:Time)
            WHERE wc.isWordCloud = true
            RETURN 
                id(wc) as id,
                wc.name as name,
                wc.category as category,
                wc.isWordCloud as isWordCloud,
                wc.showLabel as showLabel,
                properties(wc) as properties
            ORDER BY wc.name
            LIMIT 50
        `);

        const wordclouds = result.records.map(record => {
            const idRecord = record.get('id');
            const id = idRecord && typeof idRecord.toNumber === 'function' ?
                idRecord.toNumber().toString() : idRecord.toString();

            const name = record.get('name') || '未知时间';
            const category = record.get('category') || 'Time';

            return {
                id: id,
                name: name,
                category: category,
                isWordCloud: true,
                showLabel: true,
                symbolSize: 35,
                color: '#3498db',
                properties: record.get('properties') || {},
                type: 'wordcloud'
            };
        });

        console.log(`✅ 返回 ${wordclouds.length} 个时间词云节点`);

        res.json({
            success: true,
            data: wordclouds,
            count: wordclouds.length
        });

    } catch (error) {
        console.error('❌ 获取时间词云失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    } finally {
        if (session) await session.close();
    }
});

// 获取聚合节点连接的词云
app.get('/api/knowledge-graph/aggregate-wordclouds/:projectId', async (req, res) => {
    let session;
    try {
        const projectId = req.params.projectId;
        const type = req.query.type;

        if (!type) {
            return res.status(400).json({
                success: false,
                error: '缺少聚合节点类型参数'
            });
        }

        session = driver.session();

        let wordcloudType;
        switch (type) {
            case 'LocationAggregate':
                wordcloudType = 'Location';
                break;
            case 'ThemeAggregate':
                wordcloudType = 'Theme';
                break;
            case 'PollutionAggregate':
                wordcloudType = 'Pollution';
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: '无效的聚合节点类型'
                });
        }

        const result = await session.run(`
            MATCH (agg:${type} {projectId: $projectId})-[:BELONGS_TO_CATEGORY]->(wc:${wordcloudType})
            RETURN 
                id(wc) as id,
                wc.name as name,
                wc.isWordCloud as isWordCloud,
                wc.category as category
        `, { projectId: projectId });

        const wordclouds = result.records.map(record => {
            const idRecord = record.get('id');
            const id = idRecord && typeof idRecord.toNumber === 'function' ?
                idRecord.toNumber().toString() : idRecord.toString();

            return {
                id: id,
                name: record.get('name'),
                isWordCloud: true,
                category: record.get('category')
            };
        });

        res.json({
            success: true,
            data: wordclouds,
            count: wordclouds.length
        });

    } catch (error) {
        console.error('获取聚合节点词云失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (session) await session.close();
    }
});

// 获取词云关联节点
app.get('/api/knowledge-graph/wordcloud-aggregates/:wordcloudName', async (req, res) => {
    let session;
    try {
        const wordcloudName = decodeURIComponent(req.params.wordcloudName);
        console.log(`🔍 查询词云 "${wordcloudName}" 的关联节点`);

        session = driver.session();

        const typeResult = await session.run(`
            MATCH (wc {name: $name})
            WHERE wc.isWordCloud = true OR labels(wc)[0] IN ['Theme', 'Location', 'Pollution', 'Time', 'TimeNode']
            RETURN labels(wc)[0] as label, wc.category as category, wc.isWordCloud as isWordCloud
            LIMIT 1
        `, { name: wordcloudName });

        if (typeResult.records.length === 0) {
            return res.status(404).json({
                success: false,
                error: '词云节点不存在',
                wordcloudName: wordcloudName
            });
        }

        const record = typeResult.records[0];
        const label = record.get('label');
        const category = record.get('category');
        const isWordCloud = record.get('isWordCloud');

        console.log(`📊 词云类型: ${label}, 分类: ${category}, isWordCloud: ${isWordCloud}`);

        let result;

        if (label === 'Time' && isWordCloud === true) {
            console.log(`⏰ 查询时间词云 "${wordcloudName}" 的具体时间节点...`);
            result = await session.run(`
                MATCH (wc:Time {name: $name})<-[:BELONGS_TO_QUARTER]-(t:TimeNode)
                RETURN 
                    id(t) as id,
                    t.name as name,
                    'TimeNode' as category,
                    'time' as type,
                    t.isSpecificDate as isSpecificDate
                ORDER BY t.name DESC
                LIMIT 20
            `, { name: wordcloudName });

            console.log(`📊 查询到 ${result.records.length} 个具体时间节点`);

            if (result.records.length === 0) {
                console.log(`📰 没有具体时间节点，查询直接连接的项目...`);
                result = await session.run(`
                    MATCH (wc:Time {name: $name})<-[:BELONGS_TO_QUARTER]-(p:Project)
                    RETURN 
                        id(p) as id,
                        p.id as projectId,
                        p.title as title,
                        'Project' as category,
                        'news' as type
                    ORDER BY p.publish_time DESC
                    LIMIT 20
                `, { name: wordcloudName });
                console.log(`📊 查询到 ${result.records.length} 个项目`);
            }

        } else if (label === 'TimeNode') {
            result = await session.run(`
                MATCH (t:TimeNode {name: $name})<-[:PUBLISHED_ON]-(p:Project)
                RETURN 
                    id(p) as id,
                    p.id as projectId,
                    p.title as title,
                    'Project' as category,
                    'news' as type,
                    t.name as timeName
                ORDER BY p.publish_time DESC
                LIMIT 20
            `, { name: wordcloudName });
        } else {
            let aggregateType;
            switch (label) {
                case 'Location': aggregateType = 'LocationAggregate'; break;
                case 'Theme': aggregateType = 'ThemeAggregate'; break;
                case 'Pollution': aggregateType = 'PollutionAggregate'; break;
                default: aggregateType = null;
            }

            if (aggregateType) {
                result = await session.run(`
                    MATCH (wc:${label} {name: $name})<-[:BELONGS_TO_CATEGORY]-(agg:${aggregateType})
                    RETURN 
                        id(agg) as id,
                        agg.projectId as projectId,
                        agg.items as items,
                        agg.itemCount as itemCount,
                        '${aggregateType}' as category,
                        'aggregate' as type
                    LIMIT 20
                `, { name: wordcloudName });
            } else {
                result = await session.run(`
                    MATCH (wc {name: $name})<-[:BELONGS_TO_CATEGORY]-(agg)
                    WHERE labels(agg)[0] ENDS WITH 'Aggregate'
                    RETURN 
                        id(agg) as id,
                        agg.projectId as projectId,
                        agg.items as items,
                        agg.itemCount as itemCount,
                        labels(agg)[0] as category,
                        'aggregate' as type
                    LIMIT 20
                `, { name: wordcloudName });
            }
        }

        const aggregates = result.records.map(record => {
            const idRecord = record.get('id');
            const id = idRecord && typeof idRecord.toNumber === 'function' ?
                idRecord.toNumber().toString() : idRecord.toString();

            if (label === 'Time' && isWordCloud === true) {
                if (record.get('type') === 'time') {
                    return {
                        id: id,
                        name: record.get('name'),
                        category: 'TimeNode',
                        type: 'time',
                        isSpecificDate: record.get('isSpecificDate') || true,
                        wordcloudCategory: category,
                        wordcloudName: wordcloudName,
                        properties: {
                            name: record.get('name'),
                            displayName: record.get('name'),
                            isTimeDate: true
                        }
                    };
                } else {
                    return {
                        id: id,
                        projectId: record.get('projectId'),
                        name: `📰 ${record.get('title') || `项目${record.get('projectId')}`}`,
                        category: 'News',
                        type: 'news',
                        wordcloudCategory: category,
                        wordcloudName: wordcloudName,
                        properties: {
                            id: record.get('projectId'),
                            title: record.get('title')
                        }
                    };
                }
            } else if (label === 'TimeNode') {
                return {
                    id: id,
                    projectId: record.get('projectId'),
                    name: `📰 ${record.get('title') || `项目${record.get('projectId')}`}`,
                    category: 'News',
                    type: 'news',
                    properties: {
                        timeName: record.get('timeName'),
                        title: record.get('title'),
                        id: record.get('projectId')
                    }
                };
            } else {
                return {
                    id: id,
                    projectId: record.get('projectId'),
                    name: `📦 聚合节点 ${record.get('projectId')}`,
                    category: record.get('category'),
                    type: record.get('type'),
                    items: record.get('items') || [],
                    itemCount: record.get('itemCount') || 0,
                    wordcloudCategory: category,
                    wordcloudName: wordcloudName
                };
            }
        });

        console.log(`✅ 找到 ${aggregates.length} 个关联节点`);

        res.json({
            success: true,
            data: aggregates,
            wordcloud: {
                name: wordcloudName,
                category: category,
                type: label,
                isTimeWordCloud: label === 'Time' && isWordCloud === true,
                isTimeNode: label === 'TimeNode'
            }
        });

    } catch (error) {
        console.error('❌ 获取词云关联节点失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    } finally {
        if (session) await session.close();
    }
});

// 获取分类新闻
app.get('/api/knowledge-graph/aggregate-details/:categoryName', async (req, res) => {
    let session;
    try {
        const categoryName = decodeURIComponent(req.params.categoryName);
        const limit = parseInt(req.query.limit) || 10;

        console.log(`🔍 获取分类 "${categoryName}" 的新闻 (最多${limit}篇)...`);

        session = driver.session();

        let categoryType, fullName;
        let isExactMatch = false;

        const exactResult = await session.run(`
            MATCH (cat {name: $name, isWordCloud: false})
            WHERE labels(cat)[0] IN ['ThemeCategory', 'LocationRegion', 'PollutionSource', 'TimePeriod']
            RETURN labels(cat)[0] as categoryType, cat.name as fullName
            LIMIT 1
        `, { name: categoryName });

        if (exactResult.records.length > 0) {
            categoryType = exactResult.records[0].get('categoryType');
            fullName = exactResult.records[0].get('fullName');
            isExactMatch = true;
            console.log(`✅ 精确匹配: ${fullName} (${categoryType})`);
        } else {
            console.log(`⚠️ 精确匹配失败，尝试模糊匹配...`);
            const cleanName = categoryName.replace(/^[🎯📍⚠️🕒📰🌿🛡️]\s*/, '').trim();

            const fuzzyResult = await session.run(`
                MATCH (cat {isWordCloud: false})
                WHERE labels(cat)[0] IN ['ThemeCategory', 'LocationRegion', 'PollutionSource', 'TimePeriod']
                AND (toLower(cat.name) = toLower($cleanName) OR toLower(cat.name) CONTAINS toLower($cleanName))
                RETURN labels(cat)[0] as categoryType, cat.name as fullName
                LIMIT 1
            `, { cleanName: cleanName });

            if (fuzzyResult.records.length === 0) {
                const words = cleanName.split(' ').filter(w => w.length > 3);
                if (words.length > 0) {
                    const keyword = words[0];
                    const looseResult = await session.run(`
                        MATCH (cat {isWordCloud: false})
                        WHERE labels(cat)[0] IN ['ThemeCategory', 'LocationRegion', 'PollutionSource', 'TimePeriod']
                        AND toLower(cat.name) CONTAINS toLower($keyword)
                        RETURN labels(cat)[0] as categoryType, cat.name as fullName
                        ORDER BY length(cat.name) ASC
                        LIMIT 1
                    `, { keyword: keyword });

                    if (looseResult.records.length > 0) {
                        categoryType = looseResult.records[0].get('categoryType');
                        fullName = looseResult.records[0].get('fullName');
                        console.log(`🔄 宽松匹配: ${fullName} (${categoryType}) 使用关键词: ${keyword}`);
                    } else {
                        return res.status(404).json({
                            success: false,
                            error: '分类节点不存在',
                            categoryName: categoryName
                        });
                    }
                } else {
                    return res.status(404).json({
                        success: false,
                        error: '分类节点不存在',
                        categoryName: categoryName
                    });
                }
            } else {
                categoryType = fuzzyResult.records[0].get('categoryType');
                fullName = fuzzyResult.records[0].get('fullName');
                console.log(`🔄 模糊匹配: ${fullName} (${categoryType})`);
            }
        }

        let relationshipType;
        switch (categoryType) {
            case 'ThemeCategory':
                relationshipType = 'HAS_THEME';
                break;
            case 'LocationRegion':
                relationshipType = 'LOCATED_IN';
                break;
            case 'PollutionSource':
                relationshipType = 'ADDRESSES_POLLUTION';
                break;
            case 'TimePeriod':
                relationshipType = 'OCCURS_IN';
                break;
            default:
                relationshipType = 'RELATED_TO';
        }

        console.log(`使用关系: ${relationshipType}`);

        let result;

        if (categoryType === 'TimePeriod') {
            result = await session.run(`
                MATCH (p:Project)
                WHERE p.publish_time = $date
                RETURN 
                    id(p) as id,
                    p.id as projectId,
                    p.name as name,
                    p.title as title,
                    p.theme as theme,
                    p.raw_location as location,
                    p.pollution_source as pollution_source,
                    p.measure as measure,
                    p.effect_data as effect_data,
                    p.executor as executor,
                    p.source_url as source_url,
                    p.publish_time as publish_time
                ORDER BY p.publish_time DESC
                LIMIT $limit
            `, {
                date: fullName,
                limit: neo4j.int(limit)
            });
        } else {
            result = await session.run(`
                MATCH (cat:${categoryType} {name: $name})<-[:${relationshipType}]-(p:Project)
                RETURN 
                    id(p) as id,
                    p.id as projectId,
                    p.name as name,
                    p.title as title,
                    p.theme as theme,
                    p.raw_location as location,
                    p.pollution_source as pollution_source,
                    p.measure as measure,
                    p.effect_data as effect_data,
                    p.executor as executor,
                    p.source_url as source_url,
                    p.publish_time as publish_time
                ORDER BY p.publish_time DESC
                LIMIT $limit
            `, {
                name: fullName,
                limit: neo4j.int(limit)
            });
        }

        const news = result.records.map(record => {
            const idRecord = record.get('id');
            const id = idRecord && typeof idRecord.toNumber === 'function' ?
                idRecord.toNumber().toString() : idRecord.toString();

            const pollutionSource = tryParseJSON(record.get('pollution_source')) || [];
            const measure = tryParseJSON(record.get('measure')) || [];
            const effectData = tryParseJSON(record.get('effect_data')) || [];
            const executor = tryParseJSON(record.get('executor')) || [];

            return {
                id: id,
                projectId: record.get('projectId'),
                name: record.get('name') || `项目${record.get('projectId') || id}`,
                title: record.get('title') || '无标题',
                category: 'News',
                type: 'news',
                symbolSize: 25,
                showLabel: false,
                isWordCloud: false,
                properties: {
                    id: record.get('projectId'),
                    title: record.get('title'),
                    theme: record.get('theme'),
                    location: record.get('location'),
                    pollution_source: pollutionSource,
                    measure: measure,
                    effect_data: effectData,
                    executor: executor,
                    source_url: record.get('source_url'),
                    publish_time: record.get('publish_time')
                }
            };
        });

        const countResult = await session.run(`
            MATCH (cat:${categoryType} {name: $name})<-[:${relationshipType}]-(p:Project)
            RETURN count(p) as total
        `, { name: fullName });

        const totalRecord = countResult.records[0].get('total');
        const total = totalRecord && typeof totalRecord.toNumber === 'function' ?
            totalRecord.toNumber() : parseInt(totalRecord) || 0;

        console.log(`✅ 找到 ${news.length} 篇相关新闻 (总计 ${total} 篇)`);

        res.json({
            success: true,
            data: news,
            category: {
                name: fullName,
                originalName: categoryName,
                type: categoryType,
                matchedExactly: isExactMatch
            },
            pagination: {
                total: total,
                limit: limit,
                returned: news.length,
                hasMore: total > limit
            }
        });

    } catch (error) {
        console.error('❌ 获取新闻失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    } finally {
        if (session) await session.close();
    }
});

// 高级搜索API
app.get('/api/knowledge-graph/advanced-search', async (req, res) => {
    let session;
    try {
        const {
            keyword, time, pollution, region, measure, organization, type
        } = req.query;

        console.log('🔍 高级搜索条件:', req.query);

        session = driver.session();

        let query = '';
        const params = {};

        if (time) {
            query = `
                MATCH (time:Time {name: $searchValue})
                OPTIONAL MATCH (project:Project)-[r:OCCURS_IN]->(time)
                RETURN DISTINCT time as node, project as related, r as relationship, 'time' as type
                LIMIT 100
            `;
            params.searchValue = time;
        }
        else if (region) {
            query = `
                MATCH (location:Location)
                WHERE toLower(location.name) CONTAINS toLower($searchValue)
                OPTIONAL MATCH (project:Project)-[r:LOCATED_IN]->(location)
                RETURN DISTINCT location as node, project as related, r as relationship, 'location' as type
                LIMIT 100
            `;
            params.searchValue = region;
        }
        else if (pollution) {
            query = `
                MATCH (pollution:Pollution)
                WHERE toLower(pollution.name) CONTAINS toLower($searchValue)
                OPTIONAL MATCH (project:Project)-[r:ADDRESSES_POLLUTION]->(pollution)
                RETURN DISTINCT pollution as node, project as related, r as relationship, 'pollution' as type
                LIMIT 100
            `;
            params.searchValue = pollution;
        }
        else if (keyword && type) {
            const keywordLower = keyword.toLowerCase().trim();

            query = `
                MATCH (node:${type})
                WHERE toLower(node.name) CONTAINS toLower($searchValue)
                AND (node.isWordCloud = false OR node.isWordCloud IS NULL)
                OPTIONAL MATCH (project:Project)-[r]->(node)
                WHERE type(r) IN ['HAS_THEME', 'LOCATED_IN', 'ADDRESSES_POLLUTION', 'OCCURS_IN']
                RETURN DISTINCT 
                    node,
                    project as related,
                    r as relationship,
                    '${type.toLowerCase()}' as type,
                    node.isWordCloud as isWordCloud
                LIMIT 100
            `;
            params.searchValue = keywordLower;
        }
        else if (keyword) {
            query = `
                MATCH (node)
                WHERE toLower(node.name) CONTAINS toLower($searchValue)
                AND labels(node)[0] IN ['Theme', 'Location', 'Pollution', 'Time', 
                                        'ThemeCategory', 'LocationRegion', 'PollutionSource', 'TimePeriod']
                OPTIONAL MATCH (project:Project)-[r]->(node)
                WHERE type(r) IN ['HAS_THEME', 'LOCATED_IN', 'ADDRESSES_POLLUTION', 'OCCURS_IN']
                RETURN DISTINCT node, project as related, r as relationship, labels(node)[0] as type
                LIMIT 100
            `;
            params.searchValue = keyword;
        }
        else {
            query = `
                MATCH (wc)
                WHERE wc.isWordCloud = true
                AND wc.category IN ['Theme', 'Location', 'Pollution', 'Time']
                RETURN wc as node, null as related, null as relationship, wc.category as type
                LIMIT 50
            `;
        }

        console.log('执行搜索查询:', query);
        console.log('查询参数:', params);

        const result = await session.run(query, params);
        console.log(`📊 数据库返回 ${result.records.length} 条记录`);

        const nodes = [];
        const links = [];
        const nodeMap = new Map();

        result.records.forEach((record, index) => {
            try {
                const node = record.get('node');
                const related = record.get('related');
                const relationship = record.get('relationship');
                const resultType = record.get('type');

                if (node && !nodeMap.has(node.identity.toString())) {
                    const nodeData = createNodeData(node);
                    nodes.push(nodeData);
                    nodeMap.set(node.identity.toString(), nodeData);
                }

                if (related && !nodeMap.has(related.identity.toString())) {
                    const relatedData = createNodeData(related);
                    if (related.labels && related.labels.includes('Project')) {
                        relatedData.showLabel = false;
                        relatedData.symbolSize = 20;
                    }
                    nodes.push(relatedData);
                    nodeMap.set(related.identity.toString(), relatedData);
                }

                if (node && related && relationship) {
                    links.push({
                        source: related.identity.toString(),
                        target: node.identity.toString(),
                        relationship: relationship.type
                    });
                }

            } catch (error) {
                console.warn(`⚠️ 处理记录 ${index} 时出错:`, error.message);
            }
        });

        console.log(`✅ 搜索完成: ${nodes.length} 个节点, ${links.length} 条关系`);

        const stats = {
            nodes: nodes.length,
            links: links.length,
            projects: nodes.filter(n => n.category === 'Project').length,
            themes: nodes.filter(n => n.category === 'Theme' || n.category === 'ThemeCategory').length,
            locations: nodes.filter(n => n.category === 'Location' || n.category === 'LocationRegion').length,
            pollutions: nodes.filter(n => n.category === 'Pollution' || n.category === 'PollutionSource').length,
            times: nodes.filter(n => n.category === 'Time' || n.category === 'TimePeriod').length
        };

        res.json({
            success: true,
            data: { nodes, links },
            query: req.query,
            stats: stats
        });

    } catch (error) {
        console.error('❌ 搜索失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            data: { nodes: [], links: [] }
        });
    } finally {
        if (session) await session.close();
    }
});

// 严格时间匹配的日期查询
app.get('/api/knowledge-graph/date/:dateStr', async (req, res) => {
    let session;
    try {
        const dateStr = decodeURIComponent(req.params.dateStr);
        const limit = parseInt(req.query.limit) || 8;

        console.log(`📅 严格查询日期项目: "${dateStr}" 限制: ${limit}个`);

        session = driver.session();

        const cleanDateStr = cleanDateString(dateStr);
        console.log(`标准化日期格式: "${dateStr}" -> "${cleanDateStr}"`);

        const result = await session.run(`
            MATCH (p:Project)
            WHERE 
                p.publish_time = $dateStr
                OR (NOT EXISTS {
                    MATCH (p2:Project WHERE p2.publish_time = $dateStr)
                } AND p.publish_time = $cleanDateStr)
                OR (NOT EXISTS {
                    MATCH (p3:Project WHERE p3.publish_time = $dateStr OR p3.publish_time = $cleanDateStr)
                } AND 
                   p.publish_time STARTS WITH $yearMonth
                   AND p.publish_time CONTAINS $dayPart
                )
            RETURN 
                id(p) as id,
                p.id as projectId,
                p.name as name,
                p.title as title,
                p.theme as theme,
                p.raw_location as location,
                p.pollution_source as pollution_source,
                p.measure as measure,
                p.effect_data as effect_data,
                p.executor as executor,
                p.source_url as source_url,
                p.publish_time as publish_time,
                p.time_category as time_category
            ORDER BY 
                CASE 
                    WHEN p.publish_time = $dateStr THEN 1
                    WHEN p.publish_time = $cleanDateStr THEN 2
                    ELSE 3
                END,
                p.publish_time DESC
            LIMIT $limit
        `, {
            dateStr: dateStr,
            cleanDateStr: cleanDateStr,
            yearMonth: dateStr.substring(0, 7) || cleanDateStr.substring(0, 7),
            dayPart: dateStr.split('-')[2] || cleanDateStr.split('-')[2] || '',
            limit: neo4j.int(limit)
        });

        console.log(`严格查询结果: ${result.records.length} 条记录`);

        const validRecords = [];
        const invalidRecords = [];

        result.records.forEach((record, i) => {
            const foundDate = record.get('publish_time');
            const title = record.get('title');
            const projectId = record.get('projectId');

            const isDateMatch = isDateStrictlyMatch(foundDate, dateStr, cleanDateStr);

            if (isDateMatch) {
                validRecords.push(record);
                console.log(`  ✅ ${i + 1}. ID:${projectId} 日期: ${foundDate}, 标题: ${title?.substring(0, 30)}...`);
            } else {
                invalidRecords.push({
                    record: record,
                    foundDate: foundDate,
                    title: title,
                    projectId: projectId
                });
                console.log(`  ❌ ${i + 1}. ID:${projectId} 日期: ${foundDate} (不匹配), 标题: ${title?.substring(0, 30)}...`);
            }
        });

        if (validRecords.length === 0) {
            console.log(`⚠️ 严格查询无结果，执行宽松查询用于调试...`);

            const debugResult = await session.run(`
                MATCH (p:Project)
                WHERE p.publish_time CONTAINS $yearPart
                OR p.publish_time CONTAINS $monthPart
                OR p.time_category CONTAINS $yearPart
                RETURN 
                    id(p) as id,
                    p.id as projectId,
                    p.title as title,
                    p.publish_time as publish_time,
                    p.time_category as time_category
                ORDER BY p.publish_time
                LIMIT 20
            `, {
                yearPart: dateStr.substring(0, 4),
                monthPart: dateStr.substring(5, 7)
            });

            console.log(`宽松查询找到 ${debugResult.records.length} 条相关记录:`);
            debugResult.records.forEach((record, i) => {
                console.log(`  ${i + 1}. ${record.get('publish_time')} (${record.get('time_category')}): ${record.get('title')?.substring(0, 40)}...`);
            });
        }

        const projects = validRecords.map(record => {
            const idRecord = record.get('id');
            const id = idRecord && typeof idRecord.toNumber === 'function' ?
                idRecord.toNumber().toString() : idRecord.toString();

            const pollutionSource = tryParseJSON(record.get('pollution_source')) || [];
            const measure = tryParseJSON(record.get('measure')) || [];
            const effectData = tryParseJSON(record.get('effect_data')) || [];
            const executor = tryParseJSON(record.get('executor')) || [];

            return {
                id: id,
                projectId: record.get('projectId'),
                name: record.get('name') || `项目${record.get('projectId') || id}`,
                title: record.get('title') || '无标题',
                category: 'News',
                type: 'news',
                properties: {
                    id: record.get('projectId'),
                    title: record.get('title'),
                    theme: record.get('theme'),
                    location: record.get('location'),
                    pollution_source: pollutionSource,
                    measure: measure,
                    effect_data: effectData,
                    executor: executor,
                    source_url: record.get('source_url'),
                    publish_time: record.get('publish_time'),
                    time_category: record.get('time_category'),
                    isStrictMatch: true
                }
            };
        });

        res.json({
            success: true,
            data: projects,
            query: {
                original: dateStr,
                cleaned: cleanDateStr,
                foundDates: validRecords.map(r => r.get('publish_time')),
                limit: limit,
                returned: projects.length,
                invalidMatches: invalidRecords.length,
                strictMode: true
            },
            count: projects.length,
            message: projects.length > 0 ?
                `找到 ${projects.length} 篇严格匹配 ${dateStr} 的新闻` :
                `没有找到严格匹配 ${dateStr} 的新闻`
        });

    } catch (error) {
        console.error('❌ 严格日期查询失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: [],
            query: req.params.dateStr,
            strictMode: true
        });
    } finally {
        if (session) await session.close();
    }
});

// 调试API：检查分类连接
app.get('/api/debug/category-connections/:categoryName', async (req, res) => {
    let session;
    try {
        const categoryName = decodeURIComponent(req.params.categoryName);
        console.log(`🔍 调试分类连接: "${categoryName}"`);

        session = driver.session();

        const categoryCheck = await session.run(`
            MATCH (cat {name: $name})
            RETURN labels(cat)[0] as label, 
                   cat.isWordCloud as isWordCloud,
                   cat.category as dbCategory,
                   properties(cat) as props
            LIMIT 5
        `, { name: categoryName });

        console.log('分类节点检查结果:', categoryCheck.records.length);
        categoryCheck.records.forEach((record, i) => {
            console.log(`  节点 ${i + 1}:`, {
                label: record.get('label'),
                isWordCloud: record.get('isWordCloud'),
                dbCategory: record.get('dbCategory')
            });
        });

        const categoryTypes = await session.run(`
            MATCH (cat)
            WHERE toLower(cat.name) CONTAINS toLower($keyword)
            AND NOT cat.isWordCloud
            RETURN labels(cat)[0] as type, cat.name as name
            ORDER BY type
            LIMIT 10
        `, { keyword: categoryName.substring(0, 20) });

        console.log('可能的分类节点:');
        categoryTypes.records.forEach(record => {
            console.log(`  ${record.get('type')}: "${record.get('name')}"`);
        });

        const connections = await session.run(`
            MATCH (p:Project)-[r]->(cat)
            WHERE toLower(cat.name) CONTAINS toLower($keyword)
            RETURN labels(cat)[0] as catType, 
                   cat.name as catName,
                   type(r) as relationship,
                   p.id as projectId,
                   p.title as projectTitle
            LIMIT 10
        `, { keyword: categoryName.substring(0, 20) });

        console.log('项目连接检查:');
        connections.records.forEach(record => {
            console.log(`  项目 ${record.get('projectId')}: "${record.get('projectTitle')?.substring(0, 30)}..."`);
            console.log(`    -> ${record.get('relationship')} -> ${record.get('catType')}: "${record.get('catName')}"`);
        });

        res.json({
            success: true,
            categoryCheck: categoryCheck.records.map(r => ({
                label: r.get('label'),
                isWordCloud: r.get('isWordCloud'),
                dbCategory: r.get('dbCategory')
            })),
            possibleCategories: categoryTypes.records.map(r => ({
                type: r.get('type'),
                name: r.get('name')
            })),
            connections: connections.records.map(r => ({
                projectId: r.get('projectId'),
                projectTitle: r.get('projectTitle'),
                relationship: r.get('relationship'),
                categoryType: r.get('catType'),
                categoryName: r.get('catName')
            }))
        });

    } catch (error) {
        console.error('调试失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (session) await session.close();
    }
});

// ============ 新增新闻知识图谱API端点 ============

// 构建新闻知识图谱
app.post('/api/knowledge-graph/build-news', async (req, res) => {
    try {
        console.log('🚀 开始构建新闻知识图谱...');

        const newsData = require('./news_data.json');
        
        const builder = new MaritimeNewsKnowledgeGraphBuilder(
            'bolt://localhost:7687',
            'neo4j',
            'ocean123',
            { database: 'maritimekg' }
        );

        const success = await builder.buildKnowledgeGraphFromNews(newsData);

        if (success) {
            res.json({
                success: true,
                message: '新闻知识图谱构建成功',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: '新闻知识图谱构建失败'
            });
        }
    } catch (error) {
        console.error('构建新闻知识图谱失败:', error);
        res.status(500).json({
            success: false,
            error: '构建新闻知识图谱失败: ' + error.message
        });
    }
});

// 获取新闻知识图谱
app.get('/api/knowledge-graph/news-graph', async (req, res) => {
    let session;
    try {
        const { limit = 100, showAll = false } = req.query;

        console.log('🔍 获取新闻知识图谱数据...');

        session = driver.session();

        let query;
        if (showAll === 'true') {
            query = `
                MATCH (news:News)
                OPTIONAL MATCH (news)-[r]-(related)
                RETURN news, r, related
                LIMIT $limit
            `;
        } else {
            query = `
                MATCH (news:News)
                WITH news
                LIMIT 50
                MATCH (news)-[r1:HAS_LOCATION|HAS_POLLUTION_SOURCE|HAS_EXECUTOR|HAS_EFFECT|HAS_THEME|HAS_TIME|HAS_MEASURE]->(detail)
                OPTIONAL MATCH (news)-[r2:HAS_LOCATION_CATEGORY]->(lc:LocationCategory)
                WHERE size((lc)<-[:HAS_LOCATION_CATEGORY]-()) <= 30
                OPTIONAL MATCH (news)-[r3:HAS_THEME_CATEGORY]->(tc:ThemeCategory)
                WHERE size((tc)<-[:HAS_THEME_CATEGORY]-()) <= 30
                OPTIONAL MATCH (news)-[r4:HAS_TIME_CATEGORY]->(timec:TimeCategory)
                WHERE size((timec)<-[:HAS_TIME_CATEGORY]-()) <= 30
                RETURN news, 
                       collect(DISTINCT {type: type(r1), node: detail}) as details,
                       collect(DISTINCT {type: 'HAS_LOCATION_CATEGORY', node: lc}) as locationCategories,
                       collect(DISTINCT {type: 'HAS_THEME_CATEGORY', node: tc}) as themeCategories,
                       collect(DISTINCT {type: 'HAS_TIME_CATEGORY', node: timec}) as timeCategories
            `;
        }

        const result = await session.run(query, { limit: neo4j.int(parseInt(limit)) });

        const nodes = [];
        const links = [];
        const nodeMap = new Map();

        if (showAll === 'true') {
            result.records.forEach((record) => {
                const news = record.get('news');
                const related = record.get('related');
                const relationship = record.get('r');

                [news, related].forEach(node => {
                    if (node && !nodeMap.has(node.identity.toString())) {
                        const nodeData = createNodeData(node);
                        nodes.push(nodeData);
                        nodeMap.set(node.identity.toString(), nodeData);
                    }
                });

                if (news && related && relationship) {
                    links.push({
                        source: news.identity.toString(),
                        target: related.identity.toString(),
                        relationship: relationship.type
                    });
                }
            });
        } else {
            result.records.forEach((record) => {
                const news = record.get('news');
                
                if (news && !nodeMap.has(news.identity.toString())) {
                    const newsData = createNodeData(news);
                    nodes.push(newsData);
                    nodeMap.set(news.identity.toString(), newsData);
                }

                const details = record.get('details');
                details.forEach(detail => {
                    if (detail.node && !nodeMap.has(detail.node.identity.toString())) {
                        const detailData = createNodeData(detail.node);
                        nodes.push(detailData);
                        nodeMap.set(detail.node.identity.toString(), detailData);
                        
                        links.push({
                            source: news.identity.toString(),
                            target: detail.node.identity.toString(),
                            relationship: detail.type
                        });
                    }
                });

                const categories = [
                    { list: record.get('locationCategories'), type: 'HAS_LOCATION_CATEGORY' },
                    { list: record.get('themeCategories'), type: 'HAS_THEME_CATEGORY' },
                    { list: record.get('timeCategories'), type: 'HAS_TIME_CATEGORY' }
                ];

                categories.forEach(category => {
                    category.list.forEach(item => {
                        if (item.node && !nodeMap.has(item.node.identity.toString())) {
                            const categoryData = createNodeData(item.node);
                            nodes.push(categoryData);
                            nodeMap.set(item.node.identity.toString(), categoryData);
                            
                            links.push({
                                source: news.identity.toString(),
                                target: item.node.identity.toString(),
                                relationship: category.type
                            });
                        }
                    });
                });
            });
        }

        console.log(`✅ 新闻知识图谱获取完成: ${nodes.length} 个节点, ${links.length} 条关系`);

        res.json({
            success: true,
            data: {
                nodes: nodes,
                links: links
            },
            stats: {
                totalNodes: nodes.length,
                totalLinks: links.length
            }
        });

    } catch (error) {
        console.error('❌ 获取新闻知识图谱失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            data: {
                nodes: [],
                links: []
            }
        });
    } finally {
        if (session) await session.close();
    }
});

// 构建新闻关联关系
app.post('/api/news/build-relationships', async (req, res) => {
    try {
        console.log('🔗 开始构建新闻关联关系...');

        const builder = new NewsRelationshipBuilder(
            'bolt://localhost:7687',
            'neo4j',
            'ocean123',
            { database: 'maritimekg' }
        );

        const success = await builder.buildNewsRelationships();

        if (success) {
            res.json({
                success: true,
                message: '新闻关联关系构建成功',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: '新闻关联关系构建失败'
            });
        }
    } catch (error) {
        console.error('构建新闻关联关系失败:', error);
        res.status(500).json({
            success: false,
            error: '构建新闻关联关系失败: ' + error.message
        });
    }
});

// 统一搜索接口：支持 time / theme / keyword / newsId
app.get('/api/knowledge-graph/search', async (req, res) => {
    let session;
    try {
        const { keyword, newsId, time, theme } = req.query;

        if (!keyword && !newsId && !time && !theme) {
            return res.status(400).json({
                success: false,
                error: '至少提供一个搜索条件：keyword / newsId / time / theme'
            });
        }

        session = driver.session();

        let result;
        let nodes = [];
        let relationships = [];

        // 1. 按新闻 ID 精确搜索（优先级最高）
        if (newsId) {
            console.log(`🔍 按 newsId 搜索: ${newsId}`);

            // 如果你用的是 Neo4j 内置 id(n)，需要把 newsId 转成整数
            const neoId = parseInt(newsId, 10);

            result = await session.run(`
                MATCH (n:News)
                WHERE id(n) = $neoId OR n.newsId = $newsId
                OPTIONAL MATCH (n)-[r]-(m)
                RETURN n, collect(DISTINCT r) as rels, collect(DISTINCT m) as neighbors
            `, {
                neoId: neo4j.int(isNaN(neoId) ? -1 : neoId),
                newsId: newsId
            });

            if (result.records.length > 0) {
                const record = result.records[0];
                const n = record.get('n');
                const neighbors = record.get('neighbors') || [];
                const rels = record.get('rels') || [];

                nodes.push(n, ...neighbors);
                relationships.push(...rels);
            }
        }

        // 2. 按关键词搜索（标题 / 摘要 / 标签到处模糊匹配）
        if (keyword && !newsId) {
            console.log(`🔍 按关键词搜索: ${keyword}`);

            result = await session.run(`
                MATCH (n:News)
                WHERE toLower(n.title) CONTAINS toLower($kw)
                   OR toLower(n.summary) CONTAINS toLower($kw)
                   OR any(tag IN coalesce(n.tags, []) WHERE toLower(tag) CONTAINS toLower($kw))
                OPTIONAL MATCH (n)-[r]-(m)
                RETURN collect(DISTINCT n) as news,
                       collect(DISTINCT m) as neighbors,
                       collect(DISTINCT r) as rels
            `, { kw: keyword });

            if (result.records.length > 0) {
                const record = result.records[0];
                const newsNodes = record.get('news') || [];
                const neighbors = record.get('neighbors') || [];
                const rels = record.get('rels') || [];

                nodes.push(...newsNodes, ...neighbors);
                relationships.push(...rels);
            }
        }

        // 3. 按时间搜索：先找时间词云，再经时间 → 新闻
        if (time) {
            console.log(`🔍 按时间搜索: ${time}`);

            // 例如 Time 或 TimeWordCloud，根据你建图时用的 label 自行调整
            result = await session.run(`
                MATCH (t:Time)
                WHERE toLower(t.name) CONTAINS toLower($time)
                OPTIONAL MATCH (t)<-[rt:HAS_TIME]-(n:News)
                OPTIONAL MATCH (n)-[r]-(m)
                RETURN collect(DISTINCT t) as times,
                       collect(DISTINCT n) as news,
                       collect(DISTINCT m) as neighbors,
                       collect(DISTINCT rt) + collect(DISTINCT r) as rels
            `, { time });

            if (result.records.length > 0) {
                const record = result.records[0];
                const times = record.get('times') || [];
                const newsNodes = record.get('news') || [];
                const neighbors = record.get('neighbors') || [];
                const rels = record.get('rels') || [];

                nodes.push(...times, ...newsNodes, ...neighbors);
                relationships.push(...rels);
            }
        }

        // 4. 按主题搜索：先找主题词云，再经主题 → 新闻
        if (theme) {
            console.log(`🔍 按主题搜索: ${theme}`);

            result = await session.run(`
                MATCH (th:Theme)
                WHERE toLower(th.name) CONTAINS toLower($theme)
                OPTIONAL MATCH (th)<-[rt:HAS_THEME]-(n:News)
                OPTIONAL MATCH (n)-[r]-(m)
                RETURN collect(DISTINCT th) as themes,
                       collect(DISTINCT n) as news,
                       collect(DISTINCT m) as neighbors,
                       collect(DISTINCT rt) + collect(DISTINCT r) as rels
            `, { theme });

            if (result.records.length > 0) {
                const record = result.records[0];
                const themes = record.get('themes') || [];
                const newsNodes = record.get('news') || [];
                const neighbors = record.get('neighbors') || [];
                const rels = record.get('rels') || [];

                nodes.push(...themes, ...newsNodes, ...neighbors);
                relationships.push(...rels);
            }
        }

        // 5. 去重节点 / 关系，并转成前端图谱格式
        const nodeMap = new Map();
        const linkMap = new Map();

        function mapNode(n) {
            if (!n) return null;
            const idRecord = n.identity;
            const id = typeof idRecord?.toNumber === 'function'
                ? idRecord.toNumber().toString()
                : String(idRecord);
            if (nodeMap.has(id)) return nodeMap.get(id);

            const labels = n.labels || [];
            const props = n.properties || {};
            const primaryLabel = labels[0] || 'Unknown';

            const node = {
                id,
                name: props.name || props.title || `节点 ${id}`,
                category: primaryLabel,
                symbolSize: 40,
                properties: props
            };
            nodeMap.set(id, node);
            return node;
        }

        function mapRel(r) {
            if (!r) return null;
            const idRecord = r.identity;
            const id = typeof idRecord?.toNumber === 'function'
                ? idRecord.toNumber().toString()
                : String(idRecord);

            const key = id;
            if (linkMap.has(key)) return linkMap.get(key);

            const rel = {
                id,
                source: typeof r.start?.toNumber === 'function'
                    ? r.start.toNumber().toString()
                    : String(r.start),
                target: typeof r.end?.toNumber === 'function'
                    ? r.end.toNumber().toString()
                    : String(r.end),
                type: r.type || 'RELATED'
            };
            linkMap.set(key, rel);
            return rel;
        }

        nodes.forEach(mapNode);
        relationships.forEach(mapRel);

        const resultNodes = Array.from(nodeMap.values());
        const resultLinks = Array.from(linkMap.values());

        console.log(`✅ 搜索结果：${resultNodes.length} 个节点，${resultLinks.length} 条关系`);

        return res.json({
            success: true,
            data: {
                nodes: resultNodes,
                links: resultLinks
            },
            count: {
                nodes: resultNodes.length,
                links: resultLinks.length
            }
        });
    } catch (err) {
        console.error('❌ 搜索失败:', err);
        return res.status(500).json({
            success: false,
            error: err.message,
            data: { nodes: [], links: [] }
        });
    } finally {
        if (session) await session.close();
    }
});


// 获取新闻关联图谱
app.get('/api/news/relationship-graph', async (req, res) => {
    let session;
    try {
        const { limit = 100, minConnections = 2 } = req.query;

        console.log('🔗 获取新闻关联图谱数据...');

        session = driver.session();

        const query = `
            MATCH (news:News)
            WHERE EXISTS((news)-[:SHARES_]->()) 
            WITH news
            LIMIT $limit
            MATCH (news)-[r:SHARES_]->(relatedNews:News)
            WHERE EXISTS((relatedNews)-[:SHARES_]->())
            OPTIONAL MATCH (news)-[:HAS_LOCATION_CATEGORY]->(lc:LocationCategory)
            OPTIONAL MATCH (news)-[:HAS_THEME_CATEGORY]->(tc:ThemeCategory)
            OPTIONAL MATCH (news)-[:HAS_TIME_CATEGORY]->(timec:TimeCategory)
            RETURN 
                news.id as newsId,
                news.title as newsTitle,
                collect(DISTINCT {node: relatedNews, relationship: r}) as connections,
                collect(DISTINCT lc.name) as locationCategories,
                collect(DISTINCT tc.name) as themeCategories,
                collect(DISTINCT timec.name) as timeCategories
            ORDER BY size(connections) DESC
        `;

        const result = await session.run(query, { 
            limit: neo4j.int(parseInt(limit)),
            minConnections: neo4j.int(parseInt(minConnections))
        });

        const nodes = [];
        const links = [];
        const nodeMap = new Map();

        result.records.forEach((record) => {
            const newsId = record.get('newsId');
            const newsTitle = record.get('newsTitle');
            
            if (!nodeMap.has(newsId)) {
                const newsData = {
                    id: newsId,
                    name: `新闻 ${newsId}`,
                    category: 'News',
                    symbolSize: 35,
                    itemStyle: { color: '#ff6b6b' },
                    properties: {
                        id: newsId,
                        title: newsTitle,
                        locationCategories: record.get('locationCategories') || [],
                        themeCategories: record.get('themeCategories') || [],
                        timeCategories: record.get('timeCategories') || []
                    }
                };
                nodes.push(newsData);
                nodeMap.set(newsId, newsData);
            }
            
            const connections = record.get('connections');
            connections.forEach(conn => {
                if (conn.node) {
                    const relatedNewsId = conn.node.properties.id;
                    
                    if (!nodeMap.has(relatedNewsId)) {
                        const relatedNewsData = {
                            id: relatedNewsId,
                            name: `新闻 ${relatedNewsId}`,
                            category: 'News',
                            symbolSize: 30,
                            itemStyle: { color: '#ff6b6b' },
                            properties: {
                                id: relatedNewsId,
                                title: conn.node.properties.title
                            }
                        };
                        nodes.push(relatedNewsData);
                        nodeMap.set(relatedNewsId, relatedNewsData);
                    }
                    
                    links.push({
                        source: newsId,
                        target: relatedNewsId,
                        relationship: conn.relationship.type,
                        category: conn.relationship.properties?.category || '未知',
                        weight: conn.relationship.properties?.weight || 1.0
                    });
                }
            });
        });

        console.log(`✅ 新闻关联图谱获取完成: ${nodes.length} 个节点, ${links.length} 条连接`);

        const uniqueLinks = Array.from(
            new Map(links.map(link => [
                `${link.source}-${link.target}-${link.relationship}`,
                link
            ])).values()
        );

        res.json({
            success: true,
            data: {
                nodes: nodes,
                links: uniqueLinks
            },
            stats: {
                newsCount: nodes.length,
                connectionCount: uniqueLinks.length
            }
        });

    } catch (error) {
        console.error('❌ 获取新闻关联图谱失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            data: {
                nodes: [],
                links: []
            }
        });
    } finally {
        if (session) await session.close();
    }
});

// ============ 原有API端点 ============

// 健康检查端点
app.get('/health', async (req, res) => {
    try {
        let neo4jStatus = 'unknown';
        let qdrantStatus = 'unknown';
        let neo4jCount = 0;
        let vectorCount = 0;

        try {
            const session = driver.session();
            const neo4jResult = await session.run('MATCH (n) RETURN count(n) as count');
            const countRecord = neo4jResult.records[0].get('count');

            if (countRecord && typeof countRecord.toNumber === 'function') {
                neo4jCount = countRecord.toNumber();
            } else if (typeof countRecord === 'number') {
                neo4jCount = countRecord;
            } else {
                neo4jCount = parseInt(countRecord) || 0;
            }

            await session.close();
            neo4jStatus = 'connected';
        } catch (error) {
            neo4jStatus = 'disconnected';
        }

        try {
            const collections = await qdrantConfig.client.getCollections();
            qdrantStatus = 'connected';
            const collectionInfo = await qdrantConfig.client.getCollection(qdrantConfig.collectionName);
            vectorCount = collectionInfo.points_count || 0;
        } catch (error) {
            qdrantStatus = 'disconnected';
        }

        res.json({
            status: 'ok',
            message: '海洋新闻系统服务运行正常',
            databases: {
                neo4j: {
                    status: neo4jStatus,
                    node_count: neo4jCount
                },
                qdrant: {
                    status: qdrantStatus,
                    vector_count: vectorCount
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            status: 'error',
            message: '服务运行异常',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 新闻数据API
app.get('/api/news', async (req, res) => {
    let session;
    try {
        const { page, limit, keyword, theme, location } = req.query;

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const skip = Math.floor((pageNum - 1) * limitNum);

        console.log(`📡 查询新闻数据: page=${pageNum}, limit=${limitNum}, skip=${skip}`);

        session = driver.session();

        let whereClause = '';
        const params = {
            skip: neo4j.int(skip),
            limit: neo4j.int(limitNum)
        };

        if (keyword) {
            whereClause += '(toLower(n.title) CONTAINS toLower($keyword) OR toLower(n.theme) CONTAINS toLower($keyword))';
            params.keyword = keyword;
        }

        if (theme) {
            if (whereClause) whereClause += ' AND ';
            whereClause += 'n.theme = $theme';
            params.theme = theme;
        }

        if (location) {
            if (whereClause) whereClause += ' AND ';
            whereClause += 'toLower(n.raw_location) CONTAINS toLower($location)';
            params.location = location;
        }

        const where = whereClause ? `WHERE ${whereClause}` : '';

        const result = await session.run(`
            MATCH (n:News)
            ${where}
            RETURN n.id as id, 
                   n.title as title,
                   n.theme as theme,
                   n.pollution_source as pollution_source,
                   n.measure as measure,
                   n.executor as executor,
                   n.effect_data as effect_data,
                   n.source_url as source_url,
                   n.publish_time as publish_time,
                   n.raw_location as location,
                   n.keywords as keywords,
                   n.time_category as time_category,
                   n.theme_categories as theme_categories,
                   n.location_categories as location_categories,
                   n.pollution_categories as pollution_categories
            ORDER BY n.publish_time DESC
            SKIP $skip
            LIMIT $limit
        `, params);

        const countResult = await session.run(`
            MATCH (n:News)
            ${where}
            RETURN count(n) as total
        `, params);

        const totalRecord = countResult.records[0].get('total');
        let total;
        if (totalRecord && typeof totalRecord.toNumber === 'function') {
            total = totalRecord.toNumber();
        } else if (typeof totalRecord === 'number') {
            total = totalRecord;
        } else {
            total = parseInt(totalRecord) || 0;
        }

        const news = result.records.map(record => normalizeNewsData(record));

        console.log(`✅ 从Neo4j提供新闻数据API: 返回 ${news.length} 条数据，总计 ${total} 条`);

        res.json({
            success: true,
            news: news,
            total: total,
            page: pageNum,
            limit: limitNum,
            hasMore: (skip + news.length) < total,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ 新闻数据API错误:', error);
        res.status(500).json({
            success: false,
            error: '获取新闻数据失败',
            message: error.message
        });
    } finally {
        if (session) {
            await session.close();
        }
    }
});

// 获取所有主题
app.get('/api/themes', async (req, res) => {
    let session;
    try {
        session = driver.session();
        const result = await session.run(`
            MATCH (t:Theme)
            RETURN t.name as theme
            ORDER BY t.name
        `);

        const themes = result.records.map(record => record.get('theme')).filter(Boolean);

        console.log(`✅ 从Neo4j获取主题列表: ${themes.length} 个主题`);

        res.json({
            success: true,
            themes: themes,
            count: themes.length
        });
    } catch (error) {
        console.error('获取主题列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取主题列表失败'
        });
    } finally {
        if (session) {
            await session.close();
        }
    }
});

// 获取所有位置
app.get('/api/locations', async (req, res) => {
    let session;
    try {
        session = driver.session();
        const result = await session.run(`
            MATCH (l:Location)
            RETURN l.name as location
            ORDER BY l.name
        `);

        const locations = result.records.map(record => record.get('location')).filter(Boolean);

        console.log(`✅ 从Neo4j获取位置列表: ${locations.length} 个位置`);

        res.json({
            success: true,
            locations: locations,
            count: locations.length
        });
    } catch (error) {
        console.error('获取位置列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取位置列表失败'
        });
    } finally {
        if (session) {
            await session.close();
        }
    }
});

// RAG问答API端点
app.post('/api/qa/ask', async (req, res) => {
    try {
        const { question, filters = {}, sessionId = 'default', searchStrategy = 'auto' } = req.body;

        console.log(`🤖 RAG问答请求: "${question}"`, { 
            filters, 
            sessionId, 
            searchStrategy 
        });

        if (!question || question.trim() === '') {
            return res.status(400).json({
                success: false,
                error: '问题不能为空'
            });
        }

        let result;
        
        if (searchStrategy === 'category_only') {
            console.log('🔍 使用分类搜索策略');
            const relevantNews = await categoryRetriever.searchByCategories(question, filters);
            result = await ragQAService.generateAnswer(question, relevantNews, 
                ragQAService.getConversationHistory(sessionId));
        } else if (searchStrategy === 'vector_only') {
            console.log('🔍 使用向量搜索策略');
            const relevantNews = await require('./vector-rag/retriever').hybridSearch(question, filters);
            result = await ragQAService.generateAnswer(question, relevantNews, 
                ragQAService.getConversationHistory(sessionId));
        } else {
            console.log('🔍 使用增强混合搜索策略');
            result = await ragQAService.askQuestion(question.trim(), filters, sessionId);
        }

        console.log(`✅ RAG问答处理完成，返回 ${result.sources ? result.sources.length : 0} 个相关新闻`);
        
        if (!result.searchStrategy) {
            result.searchStrategy = enhancedRetriever.getSearchStrategyAnalysis(question);
        }
        
        res.json(result);

    } catch (error) {
        console.error('RAG问答API错误:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误',
            message: error.message
        });
    }
});

// 向量化相关API端点
app.post('/api/vectorize/init', async (req, res) => {
    try {
        console.log('🚀 初始化向量数据库...');
        
        const newsData = await loadNewsDataFromNeo4j();
        
        if (newsData.length === 0) {
            return res.status(400).json({
                success: false,
                error: '没有找到新闻数据'
            });
        }
        
        await newsVectorizer.vectorizeAllNews(newsData);
        
        const stats = await newsVectorizer.getCollectionStats();
        
        res.json({
            success: true,
            message: '向量数据库初始化成功',
            stats: stats,
            news_count: newsData.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 向量数据库初始化失败:', error);
        res.status(500).json({
            success: false,
            error: '向量数据库初始化失败: ' + error.message
        });
    }
});

// 获取向量数据库状态
app.get('/api/vectorize/status', async (req, res) => {
    try {
        const stats = await newsVectorizer.getCollectionStats();
        
        res.json({
            success: true,
            status: stats ? 'initialized' : 'empty',
            stats: stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('获取向量数据库状态失败:', error);
        res.json({
            success: false,
            status: 'error',
            error: error.message
        });
    }
});

// 测试向量搜索
app.get('/api/vectorize/test-search', async (req, res) => {
    try {
        const { query = "LNG动力船舶减排技术" } = req.query;
        
        console.log(`🔍 测试向量搜索: "${query}"`);
        
        const vectorResults = await require('./vector-rag/retriever').search(query);
        const categoryResults = await categoryRetriever.searchByCategories(query);
        const enhancedResults = await enhancedRetriever.enhancedHybridSearch(query);
        
        res.json({
            success: true,
            query: query,
            results: {
                vector_search: {
                    count: vectorResults.length,
                    samples: vectorResults.slice(0, 3).map(r => ({
                        title: r.payload.title,
                        score: r.score.toFixed(3),
                        theme_categories: r.payload.theme_categories
                    }))
                },
                category_search: {
                    count: categoryResults.length,
                    samples: categoryResults.slice(0, 3).map(r => ({
                        title: r.payload.title,
                        score: r.score.toFixed(3),
                        theme_categories: r.payload.theme_categories,
                        category_match: r.categoryMatch
                    }))
                },
                enhanced_search: {
                    count: enhancedResults.length,
                    samples: enhancedResults.slice(0, 3).map(r => ({
                        title: r.payload.title,
                        score: r.score.toFixed(3),
                        search_type: r.searchType,
                        theme_categories: r.payload.theme_categories,
                        category_match: r.categoryMatch
                    }))
                }
            },
            strategy_analysis: enhancedRetriever.getSearchStrategyAnalysis(query)
        });
        
    } catch (error) {
        console.error('测试向量搜索失败:', error);
        res.status(500).json({
            success: false,
            error: '测试失败: ' + error.message
        });
    }
});

// 搜索策略比较API
app.get('/api/qa/compare-strategies', async (req, res) => {
    try {
        const { question = "LNG动力船舶减排技术" } = req.query;
        
        console.log(`🔬 比较搜索策略: "${question}"`);
        
        const comparison = await ragQAService.compareSearchStrategies(question);
        
        res.json({
            success: true,
            question: question,
            ...comparison,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('比较搜索策略失败:', error);
        res.status(500).json({
            success: false,
            error: '比较失败: ' + error.message
        });
    }
});

// 获取热门问题
app.get('/api/qa/popular-questions', (req, res) => {
    try {
        const questions = ragQAService.getPopularQuestions();
        res.json({
            success: true,
            questions,
            count: questions.length
        });
    } catch (error) {
        console.error('获取热门问题失败:', error);
        res.status(500).json({
            success: false,
            error: '获取热门问题失败'
        });
    }
});

// Qdrant状态检查
app.get('/api/qdrant/status', async (req, res) => {
    try {
        const collections = await qdrantConfig.client.getCollections();
        const collectionInfo = await qdrantConfig.client.getCollection(qdrantConfig.collectionName);

        res.json({
            success: true,
            status: 'connected',
            collections: collections.collections.map(c => c.name),
            current_collection: {
                name: collectionInfo.name,
                points_count: collectionInfo.points_count,
                status: collectionInfo.status,
                vectors_count: collectionInfo.points_count
            },
            rag_enabled: true
        });
    } catch (error) {
        res.json({
            success: false,
            status: 'disconnected',
            error: error.message
        });
    }
});

// 基础知识图谱数据
app.get('/api/knowledge-graph/base', async (req, res) => {
    let session;
    try {
        session = driver.session();

        const result = await session.run(`
            MATCH (wc) 
            WHERE wc.isWordCloud = true
            AND wc.category IN ['Theme', 'Location', 'Pollution', 'Time']
            WITH wc
            LIMIT 50
            OPTIONAL MATCH (p:Project)-[r]->(wc)
            RETURN p, r, wc
            ORDER BY p.id
            LIMIT 100
        `);

        const nodes = [];
        const links = [];
        const nodeMap = new Map();

        result.records.forEach(record => {
            try {
                const project = record.get('p');
                const wordcloud = record.get('wc');
                const relationship = record.get('r');

                if (project && !nodeMap.has(project.identity.toString())) {
                    const projectData = createNodeData(project);
                    if (project.properties && project.properties.id) {
                        projectData.name = `新闻${project.properties.id}`;
                    }
                    projectData.showLabel = false;
                    nodes.push(projectData);
                    nodeMap.set(project.identity.toString(), projectData);
                }

                if (wordcloud && !nodeMap.has(wordcloud.identity.toString())) {
                    const wcData = createNodeData(wordcloud);
                    wcData.showLabel = true;
                    nodes.push(wcData);
                    nodeMap.set(wordcloud.identity.toString(), wcData);
                }

                if (project && wordcloud && relationship) {
                    links.push({
                        source: project.identity.toString(),
                        target: wordcloud.identity.toString(),
                        relationship: relationship.type
                    });
                }
            } catch (error) {
                console.error('❌ 处理记录时出错:', error);
            }
        });

        res.json({
            success: true,
            data: { nodes, links },
            message: '基础图谱数据（词云+项目）'
        });

    } catch (error) {
        console.error('获取基础图谱失败:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (session) await session.close();
    }
});

// 完整图谱API
app.get('/api/knowledge-graph/all', async (req, res) => {
    let session;
    try {
        console.log('🌐 正在获取完整知识图谱数据...');

        session = driver.session();

        const result = await session.run(`
            MATCH (wc) 
            WHERE wc.isWordCloud = true
            AND wc.category IN ['Theme', 'Location', 'Pollution', 'Time']
            WITH wc
            LIMIT 50
            OPTIONAL MATCH (p:Project)-[r]->(wc)
            RETURN p, r, wc
            ORDER BY p.id
            LIMIT 100
        `);

        const nodes = [];
        const links = [];
        const nodeMap = new Map();

        result.records.forEach(record => {
            try {
                const project = record.get('p');
                const wordcloud = record.get('wc');
                const relationship = record.get('r');

                if (project && !nodeMap.has(project.identity.toString())) {
                    const projectData = createNodeData(project);
                    if (project.properties && project.properties.id) {
                        projectData.name = `新闻${project.properties.id}`;
                    }
                    projectData.showLabel = false;
                    nodes.push(projectData);
                    nodeMap.set(project.identity.toString(), projectData);
                }

                if (wordcloud && !nodeMap.has(wordcloud.identity.toString())) {
                    const wcData = createNodeData(wordcloud);
                    wcData.showLabel = true;
                    nodes.push(wcData);
                    nodeMap.set(wordcloud.identity.toString(), wcData);
                }

                if (project && wordcloud && relationship) {
                    links.push({
                        source: project.identity.toString(),
                        target: wordcloud.identity.toString(),
                        relationship: relationship.type
                    });
                }
            } catch (error) {
                console.error('❌ 处理记录时出错:', error);
            }
        });

        res.json({
            success: true,
            data: { nodes, links },
            message: '基础图谱数据（词云+项目）'
        });

    } catch (error) {
        console.error('❌ 获取知识图谱数据失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            data: { nodes: [], links: [] }
        });
    } finally {
        if (session) {
            await session.close();
        }
    }
});

// 获取项目详情
app.get('/api/knowledge-graph/project-details/:id', async (req, res) => {
    let session;
    try {
        const projectId = req.params.id;
        console.log('🔍 获取项目详情:', projectId);

        session = driver.session();

        const result = await session.run(`
            MATCH (p:Project) WHERE id(p) = $id
            OPTIONAL MATCH (p)-[]->(measure:Measure)
            OPTIONAL MATCH (p)-[]->(effect:Effect)
            RETURN 
                collect(DISTINCT measure.name) as measures,
                collect(DISTINCT effect.name) as effects
        `, { id: neo4j.int(parseInt(projectId)) });

        if (result.records.length === 0) {
            return res.status(404).json({ success: false, error: '项目不存在' });
        }

        const record = result.records[0];
        const measures = record.get('measures') || [];
        const effects = record.get('effects') || [];

        const validMeasures = measures.filter(m => m && m !== '未知');
        const validEffects = effects.filter(e => e && e !== '未知');

        res.json({
            success: true,
            measures: validMeasures,
            effects: validEffects
        });

    } catch (error) {
        console.error('❌ 获取项目详情失败:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (session) await session.close();
    }
});

// 获取节点详情
app.get('/api/knowledge-graph/node/:id', async (req, res) => {
    let session;
    try {
        const nodeId = req.params.id;

        console.log(`🔍 获取节点详情: ${nodeId}`);

        session = driver.session();

        const nodeResult = await session.run(`
            MATCH (n) WHERE id(n) = $id
            RETURN n.name as name, labels(n) as labels, properties(n) as properties
        `, { id: neo4j.int(parseInt(nodeId)) });

        if (nodeResult.records.length === 0) {
            await session.close();
            return res.status(404).json({
                success: false,
                error: '节点不存在'
            });
        }

        const nodeRecord = nodeResult.records[0];
        const node = {
            id: nodeId,
            name: nodeRecord.get('name'),
            labels: nodeRecord.get('labels'),
            properties: nodeRecord.get('properties')
        };

        const relationsResult = await session.run(`
            MATCH (n)-[r]-(m) WHERE id(n) = $id
            RETURN 
                type(r) as relationship,
                id(m) as relatedNodeId,
                m.name as relatedNodeName,
                labels(m)[0] as relatedNodeType,
                startNode(r) = n as isOutgoing
        `, { id: neo4j.int(parseInt(nodeId)) });

        const relations = relationsResult.records.map(record => {
            const relatedNodeIdRecord = record.get('relatedNodeId');
            let relatedNodeId;

            if (relatedNodeIdRecord && typeof relatedNodeIdRecord.toNumber === 'function') {
                relatedNodeId = relatedNodeIdRecord.toNumber().toString();
            } else if (typeof relatedNodeIdRecord === 'number') {
                relatedNodeId = relatedNodeIdRecord.toString();
            } else {
                relatedNodeId = relatedNodeIdRecord.toString();
            }

            return {
                relationship: record.get('relationship'),
                relatedNode: {
                    id: relatedNodeId,
                    name: record.get('relatedNodeName'),
                    type: record.get('relatedNodeType')
                },
                direction: record.get('isOutgoing') ? 'outgoing' : 'incoming'
            };
        });

        await session.close();

        console.log(`✅ 返回节点详情和 ${relations.length} 条关系`);

        res.json({
            success: true,
            node: node,
            relations: relations
        });

    } catch (error) {
        console.error('获取节点详情失败:', error);
        res.status(500).json({
            success: false,
            error: '获取节点详情失败: ' + error.message
        });
    } finally {
        if (session) {
            await session.close();
        }
    }
});

// 构建知识图谱API
app.post('/api/knowledge-graph/build', async (req, res) => {
    try {
        console.log('🚀 开始构建知识图谱...');

        const builder = new MaritimeKnowledgeGraphBuilder(
            'bolt://localhost:7687',
            'neo4j',
            'ocean123',
            { database: 'maritimekg' }
        );

        const success = await builder.buildKnowledgeGraph('output.csv');

        if (success) {
            res.json({
                success: true,
                message: '知识图谱构建成功',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: '知识图谱构建失败'
            });
        }
    } catch (error) {
        console.error('构建知识图谱失败:', error);
        res.status(500).json({
            success: false,
            error: '构建知识图谱失败: ' + error.message
        });
    }
});

// 查询知识图谱数据
app.get('/api/knowledge-graph/data', async (req, res) => {
    let session;
    try {
        const { type, search, limit = 100 } = req.query;

        console.log('🔍 查询知识图谱数据:', { type, search, limit });

        session = driver.session();

        let query = '';
        let params = { limit: neo4j.int(parseInt(limit)) };

        const checkResult = await session.run('MATCH (n) RETURN count(n) as count');
        const countRecord = checkResult.records[0].get('count');

        let nodeCount;
        if (countRecord && typeof countRecord.toNumber === 'function') {
            nodeCount = countRecord.toNumber();
        } else if (typeof countRecord === 'number') {
            nodeCount = countRecord;
        } else {
            nodeCount = parseInt(countRecord) || 0;
        }

        if (nodeCount === 0) {
            await session.close();
            return res.json({
                success: true,
                data: {
                    nodes: [],
                    links: []
                },
                count: 0,
                message: '知识图谱为空，请先构建图谱'
            });
        }

        if (type && search) {
            query = `
                MATCH (n:${type})
                WHERE toLower(n.name) CONTAINS toLower($search)
                RETURN 
                    n.name as name, 
                    labels(n)[0] as type, 
                    id(n) as id,
                    n.isWordCloud as isWordCloud,
                    n.category as category,
                    n.showLabel as showLabel,
                    n.symbolSize as symbolSize,
                    n.nodeType as nodeType,
                    properties(n) as properties
                LIMIT $limit
            `;
            params.search = search;
        } else if (type) {
            query = `
                MATCH (n:${type})
                RETURN 
                    n.name as name, 
                    labels(n)[0] as type, 
                    id(n) as id,
                    n.isWordCloud as isWordCloud,
                    n.category as category,
                    n.showLabel as showLabel,
                    n.symbolSize as symbolSize,
                    n.nodeType as nodeType,
                    properties(n) as properties
                LIMIT $limit
            `;
        } else {
            query = `
                MATCH (n)-[r]->(m)
                WHERE labels(n)[0] IN ['Theme', 'Location', 'Pollution', 'Time', 
                                      'ThemeCategory', 'LocationRegion', 'PollutionSource', 'TimePeriod',
                                      'Project']
                RETURN 
                    n.name as sourceName, 
                    labels(n)[0] as sourceType,
                    n.isWordCloud as sourceIsWordCloud,
                    n.category as sourceCategory,
                    n.showLabel as sourceShowLabel,
                    n.symbolSize as sourceSymbolSize,
                    m.name as targetName,
                    labels(m)[0] as targetType,
                    m.isWordCloud as targetIsWordCloud,
                    m.category as targetCategory,
                    m.showLabel as targetShowLabel,
                    m.symbolSize as targetSymbolSize,
                    type(r) as relationship,
                    id(n) as sourceId,
                    id(m) as targetId
                ORDER BY n.isWordCloud DESC, m.isWordCloud DESC
                LIMIT $limit
            `;
        }

        console.log('执行Cypher查询:', query);
        const result = await session.run(query, params);

        if (type && !search) {
            const nodes = result.records.map(record => {
                const idRecord = record.get('id');
                let id;
                if (idRecord && typeof idRecord.toNumber === 'function') {
                    id = idRecord.toNumber().toString();
                } else if (typeof idRecord === 'number') {
                    id = idRecord.toString();
                } else {
                    id = idRecord.toString();
                }

                const nodeType = record.get('type');
                const category = record.get('category') || nodeType;
                const isWordCloud = record.get('isWordCloud') || false;
                const showLabel = record.get('showLabel') !== undefined ? record.get('showLabel') : isWordCloud;
                const symbolSize = record.get('symbolSize') || (isWordCloud ? 35 : 20);
                const properties = record.get('properties') || {};

                return {
                    id: id,
                    name: record.get('name') || properties.name || '未知节点',
                    type: nodeType,
                    category: category,
                    isWordCloud: isWordCloud,
                    showLabel: showLabel,
                    symbolSize: symbolSize,
                    nodeType: record.get('nodeType') || 'unknown',
                    itemStyle: {
                        color: getNodeColor(category),
                        borderColor: '#fff',
                        borderWidth: isWordCloud ? 3 : 2
                    },
                    properties: properties
                };
            });

            console.log(`✅ 返回 ${nodes.length} 个节点`);

            res.json({
                success: true,
                data: nodes,
                count: nodes.length
            });
        } else {
            const nodesMap = new Map();
            const links = [];

            result.records.forEach(record => {
                const sourceIdRecord = record.get('sourceId');
                let sourceId;
                if (sourceIdRecord && typeof sourceIdRecord.toNumber === 'function') {
                    sourceId = sourceIdRecord.toNumber().toString();
                } else if (typeof sourceIdRecord === 'number') {
                    sourceId = sourceIdRecord.toString();
                } else {
                    sourceId = sourceIdRecord.toString();
                }

                const targetIdRecord = record.get('targetId');
                let targetId;
                if (targetIdRecord && typeof targetIdRecord.toNumber === 'function') {
                    targetId = targetIdRecord.toNumber().toString();
                } else if (typeof targetIdRecord === 'number') {
                    targetId = targetIdRecord.toString();
                } else {
                    targetId = targetIdRecord.toString();
                }

                const sourceName = record.get('sourceName');
                const sourceType = record.get('sourceType');
                const sourceCategory = record.get('sourceCategory') || sourceType;
                const sourceIsWordCloud = record.get('sourceIsWordCloud') || false;
                const sourceShowLabel = record.get('sourceShowLabel') !== undefined ?
                    record.get('sourceShowLabel') : sourceIsWordCloud;
                const sourceSymbolSize = record.get('sourceSymbolSize') || (sourceIsWordCloud ? 35 : 20);

                if (!nodesMap.has(sourceId)) {
                    nodesMap.set(sourceId, {
                        id: sourceId,
                        name: sourceName,
                        type: sourceType,
                        category: sourceCategory,
                        isWordCloud: sourceIsWordCloud,
                        showLabel: sourceShowLabel,
                        symbolSize: sourceSymbolSize,
                        nodeType: 'unknown',
                        itemStyle: {
                            color: getNodeColor(sourceCategory),
                            borderColor: '#fff',
                            borderWidth: sourceIsWordCloud ? 3 : 2
                        },
                        properties: {}
                    });
                }

                const targetName = record.get('targetName');
                const targetType = record.get('targetType');
                const targetCategory = record.get('targetCategory') || targetType;
                const targetIsWordCloud = record.get('targetIsWordCloud') || false;
                const targetShowLabel = record.get('targetShowLabel') !== undefined ?
                    record.get('targetShowLabel') : targetIsWordCloud;
                const targetSymbolSize = record.get('targetSymbolSize') || (targetIsWordCloud ? 35 : 20);

                if (!nodesMap.has(targetId)) {
                    nodesMap.set(targetId, {
                        id: targetId,
                        name: targetName,
                        type: targetType,
                        category: targetCategory,
                        isWordCloud: targetIsWordCloud,
                        showLabel: targetShowLabel,
                        symbolSize: targetSymbolSize,
                        nodeType: 'unknown',
                        itemStyle: {
                            color: getNodeColor(targetCategory),
                            borderColor: '#fff',
                            borderWidth: targetIsWordCloud ? 3 : 2
                        },
                        properties: {}
                    });
                }

                links.push({
                    source: sourceId,
                    target: targetId,
                    relationship: record.get('relationship')
                });
            });

            console.log(`✅ 返回 ${nodesMap.size} 个节点, ${links.length} 条关系`);

            res.json({
                success: true,
                data: {
                    nodes: Array.from(nodesMap.values()),
                    links: links
                },
                count: nodesMap.size
            });
        }

    } catch (error) {
        console.error('查询知识图谱数据失败:', error);
        res.status(500).json({
            success: false,
            error: '查询知识图谱数据失败: ' + error.message
        });
    } finally {
        if (session) {
            await session.close();
        }
    }
});

// 获取新闻详情
app.get('/api/news/:id/details', async (req, res) => {
    let session;
    try {
        const newsId = req.params.id;
        
        console.log(`🔍 获取新闻详情: ${newsId}`);
        
        session = driver.session();
        
        const result = await session.run(`
            MATCH (news:News {id: $newsId})
            RETURN news.id as id, 
                   news.title as title,
                   news.theme as theme,
                   news.pollution_source as pollution_source,
                   news.measure as measure,
                   news.executor as executor,
                   news.effect_data as effect_data,
                   news.source_url as source_url,
                   news.publish_time as publish_time,
                   news.raw_location as raw_location,
                   news.time_category as time_category,
                   news.theme_categories as theme_categories,
                   news.location_categories as location_categories
        `, { newsId: newsId });
        
        if (result.records.length === 0) {
            return res.status(404).json({
                success: false,
                error: '新闻未找到'
            });
        }
        
        const record = result.records[0];
        const details = {
            id: record.get('id'),
            title: record.get('title'),
            theme: record.get('theme'),
            pollution_source: record.get('pollution_source'),
            measure: record.get('measure'),
            executor: record.get('executor'),
            effect_data: record.get('effect_data'),
            source_url: record.get('source_url'),
            publish_time: record.get('publish_time'),
            raw_location: record.get('raw_location'),
            time_category: record.get('time_category'),
            theme_categories: convertToArray(record.get('theme_categories')),
            location_categories: convertToArray(record.get('location_categories'))
        };
        
        console.log(`✅ 新闻详情获取成功: ${newsId}`);
        
        res.json({
            success: true,
            details: details
        });
        
    } catch (error) {
        console.error('❌ 获取新闻详情失败:', error);
        res.status(500).json({
            success: false,
            error: '获取新闻详情失败: ' + error.message
        });
    } finally {
        if (session) {
            await session.close();
        }
    }
});

// 数据格式调试端点
app.get('/api/debug/data-format', async (req, res) => {
    let session;
    try {
        session = driver.session();
        const result = await session.run(`
            MATCH (n:News) 
            RETURN n.id as id, n.title as title, n.raw_location as location
            LIMIT 1
        `);

        if (result.records.length > 0) {
            const rawData = result.records[0];
            const normalizedData = normalizeNewsData(rawData);

            res.json({
                success: true,
                raw_data: {
                    id: rawData.get('id'),
                    title: rawData.get('title'),
                    location: rawData.get('location')
                },
                normalized_data: normalizedData,
                message: '数据格式转换示例'
            });
        } else {
            res.json({
                success: false,
                error: '没有找到数据'
            });
        }

    } catch (error) {
        console.error('调试端点错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (session) {
            await session.close();
        }
    }
});

// 前端路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/knowledge-graph', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/knowledge-graph.html'));
});

// 通配路由
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({
            success: false,
            error: 'API端点不存在'
        });
    } else {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    }
});

const PORT = process.env.PORT || 3000;

// 从Neo4j加载新闻数据
async function loadNewsDataFromNeo4j() {
    let session;
    try {
        console.log('📡 从Neo4j数据库加载新闻数据...');
        session = driver.session();

        const result = await session.run(`
            MATCH (n:News)
            RETURN n.id as id, 
                   n.title as title,
                   n.theme as theme,
                   n.pollution_source as pollution_source,
                   n.measure as measure,
                   n.executor as executor,
                   n.effect_data as effect_data,
                   n.source_url as source_url,
                   n.publish_time as publish_time,
                   n.raw_location as location,
                   n.keywords as keywords,
                   n.theme_categories as theme_categories,
                   n.location_categories as location_categories,
                   n.pollution_categories as pollution_categories,
                   n.time_category as time_category
            ORDER BY n.publish_time DESC
            LIMIT 1000
        `);

        const newsData = result.records.map(record => {
            const news = {
                id: record.get('id'),
                title: record.get('title') || '无标题',
                theme: record.get('theme') || '',
                pollution_source: record.get('pollution_source') || '',
                measure: record.get('measure') || '',
                executor: record.get('executor') || '',
                effect_data: record.get('effect_data') || '',
                source_url: record.get('source_url') || '',
                publish_time: record.get('publish_time') || '',
                locations: [],
                keywords: record.get('keywords') || [],
                theme_categories: record.get('theme_categories') || [],
                location_categories: record.get('location_categories') || [],
                pollution_categories: record.get('pollution_categories') || [],
                time_category: record.get('time_category') || ''
            };

            const location = record.get('location');
            if (location) {
                if (typeof location === 'string') {
                    news.locations = [location];
                } else if (Array.isArray(location)) {
                    news.locations = location;
                }
            }

            return news;
        });

        console.log(`✅ 从Neo4j成功加载 ${newsData.length} 条新闻数据`);
        
        const validData = newsData.filter(item => 
            item.theme_categories && item.theme_categories.length > 0
        );
        console.log(`📊 包含主题分类的数据: ${validData.length}/${newsData.length}`);
        
        return newsData;

    } catch (error) {
        console.error('❌ 从Neo4j加载数据失败:', error);
        return loadNewsDataFromFile();
    } finally {
        if (session) {
            await session.close();
        }
    }
}

// 从文件加载数据（备用方案）
function loadNewsDataFromFile() {
    try {
        const dataPath = path.join(__dirname, '../data/news_metadata.json');

        if (!fs.existsSync(dataPath)) {
            console.warn('⚠️ 没有找到新闻数据文件');
            return getExampleData();
        }

        const rawData = fs.readFileSync(dataPath, 'utf8');
        const data = JSON.parse(rawData);

        const newsData = data.map(item => ({
            id: item.id || item.news_id,
            title: item.title,
            theme: item.theme,
            content: item.content || item.summary,
            locations: Array.isArray(item.locations) ? item.locations : [item.locations].filter(Boolean),
            publish_time: item.publish_time || item.date,
            executor: item.executor || item.organization,
            keywords: item.keywords || [],
            source_url: item.source_url || item.url,
            pollution_source: item.pollution_source,
            measure: item.measure,
            effect_data: item.effect_data
        })).filter(item => item.title);

        console.log(`✅ 从文件成功加载 ${newsData.length} 条新闻数据`);
        return newsData;
    } catch (error) {
        console.error('❌ 从文件加载数据失败:', error);
        return getExampleData();
    }
}

// 内置示例数据（备用）
function getExampleData() {
    return [
        {
            id: 1,
            title: "国际海事组织通过新的船舶排放标准",
            theme: "环保减排",
            pollution_source: "船舶排放",
            measure: "使用低硫燃料，安装废气净化系统",
            executor: "国际海事组织",
            effect_data: "全球硫氧化物排放减少85%",
            source_url: "https://example.com/news/1",
            publish_time: "2024-01-15",
            locations: ["北大西洋", "地中海"],
            keywords: ["排放", "环保", "标准", "IMO"],
            entities: ["国际海事组织"]
        }
    ];
}

// 初始化Qdrant
async function initializeQdrant() {
    try {
        console.log('\n🚀 初始化Qdrant向量数据库...');

        const isConnected = await qdrantConfig.testConnection();
        if (!isConnected) {
            console.warn('⚠️ Qdrant连接失败，RAG功能将不可用');
            return false;
        }

        const isInitialized = await qdrantConfig.initCollection();
        if (!isInitialized) {
            console.warn('⚠️ Qdrant集合初始化失败，RAG功能将不可用');
            return false;
        }

        const collectionInfo = await qdrantConfig.getCollectionInfo();
        if (collectionInfo && collectionInfo.points_count > 0) {
            console.log(`✅ Qdrant向量数据库连接成功，包含 ${collectionInfo.points_count} 条向量数据`);
            return true;
        } else {
            console.warn('⚠️ Qdrant集合为空，RAG功能将受限');
            return false;
        }

    } catch (error) {
        console.error('❌ Qdrant初始化失败:', error);
        return false;
    }
}

// 启动服务器
async function startServer() {
    try {
        console.log('🚀 启动海洋新闻RAG系统...\n');

        // 测试Neo4j连接
        console.log('🔌 测试Neo4j连接...');
        try {
            const session = driver.session();
            const neo4jResult = await session.run('MATCH (n) RETURN count(n) as count');
            const countRecord = neo4jResult.records[0].get('count');

            let nodeCount;
            if (countRecord && typeof countRecord.toNumber === 'function') {
                nodeCount = countRecord.toNumber();
            } else if (typeof countRecord === 'number') {
                nodeCount = countRecord;
            } else {
                nodeCount = parseInt(countRecord) || 0;
            }

            await session.close();
            console.log(`✅ Neo4j连接成功，包含 ${nodeCount} 个节点`);

            if (nodeCount > 0) {
                console.log('📊 知识图谱状态: 已构建');
            } else {
                console.log('📊 知识图谱状态: 未构建 (运行 /api/knowledge-graph/build 构建图谱)');
            }
        } catch (error) {
            console.error('❌ Neo4j连接失败:', error.message);
            console.log('请确保Neo4j服务正在运行: docker ps | grep neo4j');
        }

        // 初始化Qdrant向量数据库
        const qdrantInitialized = await initializeQdrant();

        // 启动HTTP服务器
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🎉 海洋新闻RAG系统运行在 http://0.0.0.0:${PORT}`);
            console.log(`📊 数据来源: Neo4j数据库`);
            console.log(`🔍 RAG状态: ${qdrantInitialized ? '✅ 已启用' : '❌ 未启用'}`);
            console.log(`\n📚 主要端点:`);
            console.log(`   GET  /health - 健康检查`);
            console.log(`   GET  /api/news - 新闻数据`);
            console.log(`   GET  /api/knowledge-graph/latest-news - 最新新闻`);
            console.log(`   GET  /api/knowledge-graph/wordclouds - 词云节点`);
            console.log(`   GET  /api/knowledge-graph/time-wordclouds - 时间词云`);
            console.log(`   GET  /api/knowledge-graph/news-graph - 新闻知识图谱`);
            console.log(`   POST /api/knowledge-graph/build-news - 构建新闻知识图谱`);
            console.log(`   POST /api/qa/ask - RAG智能问答`);
            console.log(`\n💡 提示: 请通过 http://localhost:${PORT} 访问应用`);

            if (!qdrantInitialized) {
                console.log(`\n⚠️  注意: Qdrant连接失败，但系统仍可运行`);
            } else {
                console.log(`\n✅ 系统就绪，RAG问答功能可用`);
            }
        });

    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n🛑 正在关闭服务器...');
    await driver.close();
    process.exit(0);
});

startServer();