// knowledge-graph.js - 完全重新实现
// 干净的知识图谱界面，遵循：词云 → 分类节点 → 新闻 → 详细信息 的层级结构

// ============ 全局变量 ============
let echartsChart = null;           // ECharts图表实例
let graphData = {                  // 当前显示的图谱数据
    nodes: [],
    links: []
};

let detailPanel = null;            // 详情面板
let expandedNodes = new Set();     // 记录已展开的节点
let assistantMultiNewsMode = false;  // 是否处于“助手多新闻模式”（从助手一次性查看多篇新闻）

// 在 knowledge-graph.js 中修改颜色映射
let nodeColors = {
    // ===== 词云（第一层）=====
    'Theme': '#9B59B6',          // 紫 - 主题词云
    'Location': '#E67E22',       // 橙 - 位置词云
    'Pollution': '#E74C3C',      // 红 - 污染源词云
    'Time': '#3498DB',           // 蓝 - 时间词云（季度/时间范围）
    'TimeWordCloud': '#3498DB',  // 兼容旧key

    // ===== 聚合/分类（第二层）=====
    'ThemeCategory': '#8E44AD',      // 深紫 - 主题聚合
    'ThemeAggregate': '#8E44AD',     // 兼容
    'LocationRegion': '#D35400',     // 深橙 - 位置聚合
    'LocationAggregate': '#D35400',  // 兼容
    'PollutionSource': '#C0392B',    // 深红 - 污染源聚合
    'PollutionAggregate': '#C0392B', // 兼容
    'TimePeriod': '#2980B9',         // 深蓝 - 时间聚合（季度/周期）
    'TimeAggregate': '#2980B9',      // 兼容

    // ===== 具体节点（第三层）=====
    'TimeNode': '#5DADE2',        // 浅蓝 - 具体日期节点
    'News': '#F1C40F',            // 金黄 - 新闻节点（强对比，便于识别）
    'Project': '#F39C12',         // 兼容旧项目节点（更深一点的金黄）
    'Executor': '#1ABC9C',        // 青绿 - 执行组织
    'CombinedContent': '#2ECC71', // 绿 - 措施效果合并节点

    // ===== 其他（如果未来会出现）=====
    'Measure': '#27AE60',
    'Effect': '#16A085'
};

// 修改 generateLegend 函数
function generateLegend() {
    const legendContainer = document.getElementById('legend');
    if (!legendContainer) return;

    // 创建带标题和关闭按钮的图例
    legendContainer.innerHTML = `
        <div class="legend-title">
            <span>图例 Legend</span>
            <span class="legend-close" onclick="toggleLegend()">×</span>
        </div>
        <div class="legend-items" id="legend-items"></div>
    `;

    const itemsContainer = document.getElementById('legend-items');

    // 按“层级结构”分组展示：核心节点 → 词云 → 聚合 → 时间
    const legendItems = [
        { type: 'section', label: '核心节点 Core' },
        { key: 'News', label: '新闻 News' },
        { key: 'Executor', label: '执行组织 Executor' },
        { key: 'CombinedContent', label: '措施效果 Combined' },

        { type: 'divider' },

        { type: 'section', label: '词云 WordCloud' },
        { key: 'Theme', label: '主题词云 Theme' },
        { key: 'Location', label: '位置词云 Location' },
        { key: 'Pollution', label: '污染源词云 Pollution' },
        { key: 'Time', label: '时间词云 Time' },

        { type: 'divider' },

        { type: 'section', label: '聚合 Aggregation' },
        { key: 'ThemeCategory', label: '主题聚合 ThemeCategory' },
        { key: 'LocationRegion', label: '位置聚合 LocationRegion' },
        { key: 'PollutionSource', label: '污染源聚合 PollutionSource' },
        { key: 'TimePeriod', label: '时间聚合 TimePeriod' },

        { type: 'divider' },

        { type: 'section', label: '时间节点 Time' },
        { key: 'TimeNode', label: '具体日期 TimeNode' }
    ];

    legendItems.forEach(item => {
        if (item.type === 'divider') {
            const div = document.createElement('div');
            div.className = 'legend-divider';
            itemsContainer.appendChild(div);
            return;
        }

        if (item.type === 'section') {
            const row = document.createElement('div');
            row.className = 'legend-item';
            row.innerHTML = `
                <div class="legend-label" style="font-weight: 600; color: #4bcffa; letter-spacing: .5px;">
                    ${item.label}
                </div>
            `;
            itemsContainer.appendChild(row);
            return;
        }

        const color = nodeColors[item.key] || '#95a5a6';
        const row = document.createElement('div');
        row.className = 'legend-item';
        row.innerHTML = `
            <div class="legend-color" style="background-color: ${color};"></div>
            <div class="legend-label">${item.label}</div>
        `;
        itemsContainer.appendChild(row);
    });

    // 默认显示图例
    legendContainer.classList.add('active');

    // 创建图例切换按钮
    createLegendToggle();
}

// 创建图例切换按钮
function createLegendToggle() {
    // 如果已存在则移除
    const existingToggle = document.querySelector('.legend-toggle');
    if (existingToggle) existingToggle.remove();
    
    const toggle = document.createElement('div');
    toggle.className = 'legend-toggle';
    toggle.innerHTML = '📊';
    toggle.title = '显示/隐藏图例';
    toggle.onclick = toggleLegend;
    
    document.querySelector('.kg-container').appendChild(toggle);
}

// 切换图例显示/隐藏
function toggleLegend() {
    const legend = document.getElementById('legend');
    const toggle = document.querySelector('.legend-toggle');
    
    if (legend && toggle) {
        const isActive = legend.classList.contains('active');
        
        if (isActive) {
            legend.classList.remove('active');
            toggle.innerHTML = '📊';
            toggle.style.transform = 'scale(1)';
        } else {
            legend.classList.add('active');
            toggle.innerHTML = '👁️';
            toggle.style.transform = 'scale(1.1)';
        }
    }
}

// 在 initMaritimeKG 函数中调用 generateLegend
function initMaritimeKG() {
    console.log('🚀 初始化海事知识图谱系统');
    
    // 初始化索引
    nodeIndex.clear();
    relationIndex.clear();

    // 1. 初始化ECharts图表
    initECharts();

    // 2. 创建详情面板
    createDetailPanel();

    // 3. 生成图例
    generateLegend();

    // 4. 绑定所有事件
    bindAllEvents();

    // 5. 初始加载最新新闻节点
    loadLatestNews();

    console.log('✅ 系统初始化完成');
}

// 新增：节点去重索引
let nodeIndex = new Map();        // name -> node 的映射，用于去重
let relationIndex = new Map();    // source-target 关系索引，用于去重

// 高亮用索引
let graphNodeById = new Map();        // id -> 原始节点数据
let echartsNodeIndexMap = new Map();  // id -> ECharts 中的 dataIndex
let echartsLinkIndexList = [];        // [{ source, target, index }]
let adjacencyList = new Map();        // id -> [{ neighbor, linkIndex }]
let currentHoverNewsId = null;   // 当前悬停的新闻节点ID（用于避免重复触发高亮）



// knowledge-graph.js - 修改初始加载



// 新增函数：加载最新新闻
async function loadLatestNews() {
    try {
        console.log('[DEBUG] 开始加载最新新闻...');
        showLoading('加载最新新闻...');

        // 调用API获取最新新闻
        const response = await fetch('/api/knowledge-graph/latest-news?limit=15');
        const result = await response.json();

        console.log('[DEBUG] API响应:', result);

        if (result.success && result.data) {
            console.log('[DEBUG] 收到新闻数据:', result.data.length, '篇');

            // 创建新闻节点
            const newsNodes = result.data.map((news, index) => {
                const newsObj = {
                    id: `news_${news.id || news.projectId || index}`,
                    name: getNewsDisplayName(news),
                    category: 'News',
                    type: 'news',
                    symbolSize: getNewsSymbolSize(news),
                    color: nodeColors.News || '#ff6b6b',
                    showLabel: false,
                    properties: news.properties || news
                };

                console.log(`[DEBUG] 创建新闻节点: ${newsObj.name}`);
                return newsObj;
            });

            // 创建一些热门词云节点（作为背景或上下文）
            const wordcloudNodes = await createPopularWordclouds();

            // 合并节点
            const allNodes = [...newsNodes, ...wordcloudNodes];

            updateGraphData({
                nodes: allNodes,
                links: []  // 初始不显示关系
            });

            showSuccess(`加载 ${newsNodes.length} 篇最新新闻`);

            // ECharts圖表會自動布局，無需手動調用布局函數
            // ✅ 新增：自动展开 2–3 条新闻，让初始图谱就有更丰富的关系结构
            if (newsNodes.length > 0) {
                // 最多展开 3 条，避免初始图太乱
                const expandCount = Math.min(3, newsNodes.length);

                for (let i = 0; i < expandCount; i++) {
                    const newsNode = newsNodes[i];

                    try {
                        console.log('[DEBUG] 自动展开新闻节点:', newsNode.name);

                        // 标记为已展开，避免后续重复展开
                        expandedNodes.add(newsNode.id);

                        // 利用现有逻辑，从后端拉取该新闻的聚合节点/词云等，并添加关系
                        await expandNews(newsNode);
                    } catch (e) {
                        console.warn('[DEBUG] 自动展开新闻失败:', newsNode, e);
                    }
                }

                showInfo(`已自动展开 ${expandCount} 条新闻，初始展示基础关系结构，可继续双击节点探索`);
            }


        } else {
            console.error('[DEBUG] API返回失败:', result);
            // 如果失败，回退到词云
            loadWordClouds();
        }
    } catch (error) {
        console.error('[DEBUG] 加载新闻失败:', error);
        showError('加载新闻失败，回退到词云视图');
        // 失败时回退到词云
        loadWordClouds();
    } finally {
        hideLoading();
    }
}

// 新增函数：创建热门词云节点
async function createPopularWordclouds() {
    try {
        const response = await fetch('/api/knowledge-graph/popular-wordclouds?limit=8');
        const result = await response.json();

        if (result.success && result.data) {
            return result.data.map(wc => ({
                id: `wordcloud_${wc.category}_${wc.name}`,
                name: wc.name,
                category: wc.category,
                type: 'wordcloud',
                isWordCloud: true,
                symbolSize: 40,
                color: nodeColors[wc.category] || '#95a5a6',
                showLabel: true,
                properties: wc.properties || wc
            }));
        }
    } catch (error) {
        console.warn('[DEBUG] 加载热门词云失败:', error);
    }

    return [];
}

// 新增函数：新闻节点布局
function layoutNewsNodes(newsNodes) {
    // 计算布局参数
    const total = newsNodes.length;
    const radius = 150; // 布局半径

    // 如果是ECharts，可以通过设置force布局参数自动布局
    // 这里我们简单设置初始位置
    newsNodes.forEach((node, index) => {
        const angle = (index / total) * Math.PI * 2;
        node.x = radius * Math.cos(angle) + Math.random() * 50;
        node.y = radius * Math.sin(angle) + Math.random() * 50;
    });
}

function initECharts() {
    const chartDom = document.getElementById('knowledge-graph');
    if (!chartDom) {
        console.error('❌ 找不到图谱容器');
        return;
    }

    echartsChart = echarts.init(chartDom);

    // 修改图表配置，添加更详细的调试
    // 修改标题为新闻视角
    const initialOption = {
        backgroundColor: '#1a1a2e',
        title: {
            text: '海事新闻知识图谱',
            subtext: '双击新闻节点查看详细信息',
            left: 'center',
            top: 10,
            textStyle: { color: '#4bcffa', fontSize: 22 },
            subtextStyle: { color: '#ccc', fontSize: 14 }
        },
        tooltip: {
            formatter: function (params) {
                if (params.dataType === 'node') {
                    const node = params.data;
                    console.log('[DEBUG] 鼠标悬停节点:', node);
                    return `
                    <div style="color:${node.color}">${node.name}</div>
                    <div style="margin-top:5px;color:#ccc">类型: ${node.type || node.category}</div>
                    <div style="margin-top:5px;color:#ddd">点击展开详情</div>
                    `;
                }
                return '';
            }
        },
        series: [{
            type: 'graph',
            layout: 'force',
            data: [],
            links: [],
            roam: true,
            draggable: true,
            label: {
                show: true,
                position: 'right',
                fontSize: 12,
                color: '#fff',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: [4, 8],
                borderRadius: 4,
                // 添加悬停效果
                emphasis: {
                    show: true,
                    textStyle: {
                        color: '#fff',
                        fontWeight: 'bold'
                    }
                }
            },
            lineStyle: {
                color: 'source',
                width: 1.5,
                opacity: 0.6
            },
            emphasis: {
                focus: 'adjacency',
                lineStyle: { width: 2, opacity: 0.8 }
            },
            force: {
                repulsion: 150,
                edgeLength: 80,
                gravity: 0.1
            },
            // 添加节点样式配置
            itemStyle: {
                borderColor: '#fff',
                borderWidth: 1,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
                shadowBlur: 10
            },
            emphasis: {
                scale: true,
                focus: 'adjacency',
                lineStyle: {
                    width: 2,
                    opacity: 0.8
                },
                itemStyle: {
                    borderColor: '#4bcffa',
                    borderWidth: 2,
                    shadowColor: 'rgba(75, 207, 250, 0.8)',
                    shadowBlur: 15
                }
            }
        }]
    };

    echartsChart.setOption(initialOption);

    echartsChart.on('click', function (params) {
        console.log('[DEBUG] 图表单击事件触发:', params);

        if (params.dataType === 'node') {
            // 优先使用data属性（存储了原始数据），否则使用params.data本身
            const node = params.data?.data || params.data;
            console.log('[DEBUG] 单击节点详情:', {
                id: node?.id,
                name: node?.name,
                category: node?.category,
                type: node?.type,
                isWordCloud: node?.isWordCloud
            });

            if (node) {
                // 显示详情面板
                showNodeDetail(node,
                    params.event.event.clientX,
                    params.event.event.clientY
                );
            }
        }
    });
    echartsChart.on('dblclick', function (params) {
        if (params.dataType === 'node') {
            // 优先使用data属性（存储了原始数据），否则使用params.data本身
            const node = params.data?.data || params.data;

            console.log('[DEBUG] 双击节点详情:', {
                id: node?.id,
                name: node?.name,
                type: node?.type,
                category: node?.category,
                hasData: !!params.data?.data
            });

            if (!node) {
                console.warn('[DEBUG] 无法获取节点数据');
                return;
            }

            // 确保节点类型正确
            const nodeType = node.type || params.data?.data?.type || params.data?.type || node.category;

            switch (nodeType) {
                case 'wordcloud':
                    expandWordCloud(node);
                    break;
                case 'aggregate':
                    expandAggregateNode(node);
                    break;
                case 'news':
                    expandNews(node);
                    break;
                case 'time':
                    // 默认展开到新闻
                    expandTimeNode(node);
                    break;
                case 'executor':
                    // 执行方节点：显示详情
                    showNodeDetail(node);
                    break;
                case 'combined':
                    // 措施效果节点：显示详情
                    showNodeDetail(node);
                    break;
                default:
                    console.log('[DEBUG] 未知节点类型，显示详情:', nodeType, node);
                    showNodeDetail(node);
            }
        }
    });
         // 鼠标悬停：如果是新闻节点，则高亮【自身 + 关联新闻 + 关联路径】
    echartsChart.on('mouseover', function (params) {
        if (params.dataType !== 'node') return;

        // 优先使用 data 属性（我们在 renderGraphImmediate 里塞进去的）
        const node = params.data?.data || params.data;
        if (!node) return;

        const nodeId = String(node.id ?? '');
        if (!nodeId) return;

        // 仅对新闻节点生效
        const raw = graphNodeById.get(nodeId) || node;
        const isNews = (raw.type === 'news' || raw.category === 'News');
        if (!isNews) return;

        // 避免 mouseover 频繁触发导致高亮闪烁
        if (currentHoverNewsId === nodeId) return;
        currentHoverNewsId = nodeId;

        highlightNewsConnections(nodeId);
    });

    // 鼠标移出任意节点：恢复默认状态
    echartsChart.on('mouseout', function (params) {
        if (params.dataType !== 'node') return;

        // 只要从节点移出，就恢复默认高亮状态
        try {
            echartsChart.dispatchAction({
                type: 'downplay',
                seriesIndex: 0
            });
        } catch (e) {
            console.warn('[DEBUG] 鼠标移出恢复高亮失败:', e);
        } finally {
            currentHoverNewsId = null;
        }
    });

    // 拖拽结束：记录节点位置（写回 graphData），下次渲染保持位置
    // 说明：ECharts 的 force 布局会持续迭代，若不固定，下一次 setOption 可能会把节点拉回“物理布局”结果
    echartsChart.on('mouseup', function (params) {
        if (params.dataType !== 'node') return;

        const node = params.data?.data || params.data;
        const nodeId = String(node?.id || '');
        if (!nodeId) return;

        try {
            const series = echartsChart.getModel().getSeriesByIndex(0);
            const data = series.getData();
            const layout = data.getItemLayout(params.dataIndex);
            if (!layout) return;

            const rawNode = graphData.nodes.find(n => String(n.id) === nodeId);
            if (rawNode) {
                rawNode.x = layout.x;
                rawNode.y = layout.y;
                rawNode.fixed = true;
            }
        } catch (e) {
            console.warn('[DEBUG] 记录拖拽位置失败:', e);
        }
    });



}

// 新增函数：展开聚合节点（显示对应的新闻）
// 展开聚合节点为新闻
async function expandAggregateToNews(aggregateNode) {
    try {
        console.log('[DEBUG] 展开聚合节点为新闻:', aggregateNode);

        const projectId = aggregateNode.properties?.projectId;
        if (!projectId) {
            showError('聚合节点缺少项目ID');
            return;
        }

        showLoading(`加载新闻详情...`);

        // 调用获取新闻详情的API
        const response = await fetch(`/api/knowledge-graph/news-details/${projectId}`);
        const result = await response.json();

        if (result.success && result.data) {
            const newsData = result.data.project;

            // 创建新闻节点
            const newsNode = {
                id: `news_${projectId}`,
                name: `📰 ${newsData.title || '无标题'}`,
                category: 'News',
                type: 'news',
                symbolSize: 25,
                color: nodeColors.News,
                showLabel: false,
                properties: {
                    id: projectId,
                    title: newsData.title,
                    theme: newsData.theme,
                    location: newsData.location,
                    pollution_source: newsData.pollution_source || [],
                    measure: newsData.measure || [],
                    effect_data: newsData.effect_data || [],
                    executor: newsData.executor || [],
                    source_url: newsData.source_url,
                    publish_time: newsData.publish_time
                }
            };

            // 检查新闻节点是否已存在
            const existingNode = graphData.nodes.find(n =>
                n.id === newsNode.id ||
                (n.type === 'news' && n.properties?.id === projectId)
            );

            if (existingNode) {
                // 如果新闻节点已存在，使用现有的ID
                newsNode.id = existingNode.id;
                console.log('[DEBUG] 新闻节点已存在，使用现有ID:', newsNode.id);
            }

            // 创建聚合节点到新闻节点的连接
            const newLink = {
                source: aggregateNode.id,
                target: newsNode.id,
                relationship: 'CONTAINS_NEWS'
            };

            // 添加到图谱
            addToGraphData({
                nodes: [newsNode],
                links: [newLink]
            });

            expandedNodes.add(aggregateNode.id);
            showSuccess('显示对应新闻');

            // 可选：自动展开新闻节点的详细信息
            // setTimeout(() => {
            //     expandNews(newsNode);
            // }, 500);

        } else {
            showError('加载新闻失败: ' + (result.error || '未知错误'));
        }
    } catch (error) {
        console.error('[DEBUG] 展开聚合节点失败:', error);
        showError('加载新闻失败: ' + error.message);
    }
}

// 展开聚合节点为词云分类
async function expandAggregateNodeForWordclouds(aggregateNode) {
    try {
        console.log('[DEBUG] 展开聚合节点为词云分类:', aggregateNode);

        const projectId = aggregateNode.properties?.projectId;
        const aggregateType = aggregateNode.category;

        if (!projectId || !aggregateType) {
            showError('聚合节点缺少必要信息');
            return;
        }

        showLoading('加载词云分类...');

        // 调用API获取该聚合节点连接的词云节点
        const response = await fetch(
            `/api/knowledge-graph/aggregate-wordclouds/${projectId}?type=${aggregateType}`
        );
        const result = await response.json();

        if (result.success && result.data) {
            const wordcloudNodes = result.data.map(wc => {
            // 根据聚合节点的类型 + 接口返回，推断一个合理的分类
            let normalizedCategory = wc.category;

            if (!normalizedCategory) {
                if (aggregateType === 'ThemeAggregate' || aggregateType === 'Theme') {
                    normalizedCategory = 'Theme';
                } else if (aggregateType === 'LocationAggregate' || aggregateType === 'Location') {
                    normalizedCategory = 'Location';
                } else if (aggregateType === 'PollutionAggregate' || aggregateType === 'Pollution') {
                    normalizedCategory = 'Pollution';
                } else if (aggregateType === 'TimeAggregate' || aggregateType === 'Time') {
                    normalizedCategory = 'Time';
                } else {
                    // 兜底：仍然识别为词云，但用 WordCloud 分类
                    normalizedCategory = 'WordCloud';
                }
            }

            return {
                id: wc.id || `wc_${wc.name}_${projectId}`,
                name: wc.name,
                category: normalizedCategory,
                type: 'wordcloud',
                isWordCloud: true,
                symbolSize: 35,
                color: nodeColors[normalizedCategory] || '#95a5a6',
                showLabel: true,
                properties: {
                    ...wc,
                    category: normalizedCategory
                }
            };
        });



            const newLinks = wordcloudNodes.map(wcNode => ({
                source: aggregateNode.id,
                target: wcNode.id,
                relationship: 'BELONGS_TO_CATEGORY'
            }));

            if (wordcloudNodes.length > 0) {
                addToGraphData({
                    nodes: wordcloudNodes,
                    links: newLinks
                });

                expandedNodes.add(aggregateNode.id);
                showSuccess(`添加 ${wordcloudNodes.length} 个词云节点`);
            } else {
                showInfo('该聚合节点没有关联的词云分类');
            }
        } else {
            showError('加载词云分类失败: ' + (result.error || '未知错误'));
        }
    } catch (error) {
        console.error('展开聚合节点词云失败:', error);
        showError('加载词云分类失败: ' + error.message);
    }
}

// 时间节点的默认展开：显示该日期的新闻
async function expandTimeNode(timeNode) {
    try {
        console.log('[DEBUG] 展开时间节点（默认到新闻）:', timeNode);

        const timeName = timeNode.properties?.name ||
            timeNode.name.replace(/^📅\s*/, '').trim();

        if (expandedNodes.has(timeNode.id + '_news')) {
            console.log('[DEBUG] 时间节点已展开到新闻，跳过');
            // 如果已经展开过新闻，可以考虑展开到词云
            // 或者直接返回，让用户通过其他方式展开词云
            return;
        }

        showLoading(`搜索 ${timeName} 的新闻...`);

        const response = await fetch(
            `/api/knowledge-graph/date/${encodeURIComponent(timeName)}?limit=8`
        );
        const result = await response.json();

        if (result.success && result.data) {
            const newsNodes = result.data.map(node => ({
                id: node.id || `news_${node.projectId}`,
                name: `📰 ${node.properties?.title || node.name || `项目${node.projectId}`}`,
                category: 'News',
                type: 'news',
                symbolSize: 22,
                color: nodeColors.News,
                showLabel: false,
                properties: node.properties || node
            }));

            const newLinks = newsNodes.map(newsNode => ({
                source: timeNode.id,
                target: newsNode.id,
                relationship: 'PUBLISHED_ON'
            }));

            if (newsNodes.length > 0) {
                addToGraphData({
                    nodes: newsNodes,
                    links: newLinks
                });

                // 标记为已展开到新闻
                expandedNodes.add(timeNode.id + '_news');
                showSuccess(`找到 ${newsNodes.length} 篇 ${timeName} 的新闻`);
            } else {
                showInfo(`没有找到 ${timeName} 的新闻`);
                expandedNodes.add(timeNode.id + '_news');
            }
        }
    } catch (error) {
        console.error('[DEBUG] 展开时间节点到新闻失败:', error);
        showError('搜索新闻失败');
    }
}

// 时间节点的第二种展开：显示所属的时间词云
async function expandTimeNodeToWordcloud(timeNode) {
    try {
        console.log('[DEBUG] 展开时间节点到时间词云:', timeNode);

        const timeName = timeNode.properties?.name ||
            timeNode.name.replace(/^📅\s*/, '').trim();

        if (expandedNodes.has(timeNode.id + '_wordcloud')) {
            console.log('[DEBUG] 时间节点已展开到词云，跳过');
            return;
        }

        showLoading(`搜索 ${timeName} 所属的时间词云...`);

        // 先尝试直接查询时间词云关系
        let response = await fetch(`/api/knowledge-graph/time-node-wordclouds/${encodeURIComponent(timeName)}`);
        let result = await response.json();

        if (!result.success || result.data.length === 0) {
            // 如果没有直接连接，根据日期推断季度
            const quarter = inferQuarterFromDate(timeName);
            if (quarter) {
                // 查询这个季度词云
                response = await fetch(`/api/knowledge-graph/wordcloud-aggregates/${encodeURIComponent(quarter)}`);
                result = await response.json();

                if (result.success && result.wordcloud) {
                    // 创建一个虚拟的词云节点
                    const wordcloudNode = {
                        id: `time_wordcloud_${quarter}`,
                        name: `🕒 ${quarter}`,
                        category: 'Time',
                        type: 'wordcloud',
                        isWordCloud: true,
                        symbolSize: 35,
                        color: nodeColors.Time,
                        showLabel: true,
                        properties: {
                            name: quarter,
                            displayName: `🕒 ${quarter}`
                        }
                    };

                    const newLink = {
                        source: timeNode.id,
                        target: wordcloudNode.id,
                        relationship: 'BELONGS_TO_QUARTER'
                    };

                    addToGraphData({
                        nodes: [wordcloudNode],
                        links: [newLink]
                    });

                    expandedNodes.add(timeNode.id + '_wordcloud');
                    showSuccess(`推断属于 ${quarter}`);
                    return;
                }
            }
        }

        if (result.success && result.data) {
            const wordcloudNodes = result.data.map(wc => ({
                id: wc.id || `time_wordcloud_${wc.name}`,
                name: wc.name,
                category: 'Time',
                type: 'wordcloud',
                isWordCloud: true,
                symbolSize: 35,
                color: nodeColors.Time,
                showLabel: true,
                properties: wc.properties || wc
            }));

            const newLinks = wordcloudNodes.map(wcNode => ({
                source: timeNode.id,
                target: wcNode.id,
                relationship: 'BELONGS_TO_QUARTER'
            }));

            if (wordcloudNodes.length > 0) {
                addToGraphData({
                    nodes: wordcloudNodes,
                    links: newLinks
                });

                expandedNodes.add(timeNode.id + '_wordcloud');
                showSuccess(`找到 ${wordcloudNodes.length} 个时间词云`);
            } else {
                showInfo('该时间节点没有关联的时间词云');
            }
        }
    } catch (error) {
        console.error('[DEBUG] 展开时间节点到词云失败:', error);
        showError('搜索时间词云失败');
    }
}

// 显示时间节点展开选项
function showTimeNodeOptions(timeNode) {
    const timeName = timeNode.properties?.name || timeNode.name.replace(/^📅\s*/, '');

    const optionsHTML = `
        <div style="margin-top: 10px; padding: 10px; background: rgba(52, 152, 219, 0.1); border-radius: 5px;">
            <div style="font-weight: bold; margin-bottom: 8px; color: #3498db;">
                📅 ${timeName}
            </div>
            <div style="font-size: 12px; color: #ccc; margin-bottom: 10px;">
                请选择展开方式：
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <button onclick="expandTimeToProjects('${timeNode.id}', '${timeName}')" 
                        style="flex: 1; padding: 6px 10px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    📰 查看当天新闻
                </button>
                <button onclick="expandTimeToWordcloud('${timeNode.id}', '${timeName}')" 
                        style="flex: 1; padding: 6px 10px; background: #9b59b6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    🕒 查看所属季度
                </button>
            </div>
        </div>
    `;

    // 显示选项面板
    const contentDiv = document.getElementById('kg-detail-content');
    if (contentDiv) {
        const existingContent = contentDiv.innerHTML;
        contentDiv.innerHTML = existingContent + optionsHTML;
    }
}

// 展开时间节点到新闻项目
async function expandTimeToProjects(timeNodeId, timeName) {
    try {
        console.log(`[DEBUG] 展开时间节点到新闻: ${timeName}`);

        showLoading(`搜索 ${timeName} 的新闻...`);

        const response = await fetch(
            `/api/knowledge-graph/date/${encodeURIComponent(timeName)}?limit=10`
        );
        const result = await response.json();

        if (result.success && result.data) {
            const newsNodes = result.data.map(node => ({
                id: node.id || `news_${node.projectId}`,
                name: `📰 ${node.properties?.title || node.name || `项目${node.projectId}`}`,
                category: 'News',
                type: 'news',
                symbolSize: 22,
                color: nodeColors.News,
                showLabel: false,
                properties: node.properties || node
            }));

            const newLinks = newsNodes.map(newsNode => ({
                source: timeNodeId,
                target: newsNode.id,
                relationship: 'PUBLISHED_ON'
            }));

            if (newsNodes.length > 0) {
                addToGraphData({
                    nodes: newsNodes,
                    links: newLinks
                });

                expandedNodes.add(timeNodeId);
                showSuccess(`找到 ${newsNodes.length} 篇 ${timeName} 的新闻`);
            } else {
                showInfo(`没有找到 ${timeName} 的新闻`);
            }
        }
    } catch (error) {
        console.error('[DEBUG] 展开时间节点到新闻失败:', error);
        showError('搜索新闻失败: ' + error.message);
    }
}

// 展开时间节点到时间词云
async function expandTimeToWordcloud(timeNodeId, timeName) {
    try {
        console.log(`[DEBUG] 展开时间节点到时间词云: ${timeName}`);

        showLoading(`搜索 ${timeName} 所属的时间词云...`);

        // 查询时间节点所属的时间词云
        const session = driver.session(); // 需要确保driver可用

        const result = await session.run(`
            MATCH (tn:TimeNode {name: $name})-[:BELONGS_TO_QUARTER]->(tc:Time)
            RETURN 
                id(tc) as id,
                tc.name as name,
                tc.displayName as displayName
            LIMIT 5
        `, { name: timeName });

        await session.close();

        if (result.records.length > 0) {
            const timeWordclouds = result.records.map(record => {
                const idRecord = record.get('id');
                const id = idRecord && typeof idRecord.toNumber === 'function' ?
                    idRecord.toNumber().toString() : idRecord.toString();

                return {
                    id: id,
                    name: record.get('displayName') || `🕒 ${record.get('name')}`,
                    category: 'Time',
                    type: 'wordcloud',
                    isWordCloud: true,
                    symbolSize: 30,
                    color: nodeColors.Time,
                    showLabel: true,
                    properties: {
                        name: record.get('name'),
                        displayName: record.get('displayName')
                    }
                };
            });

            const newLinks = timeWordclouds.map(tcNode => ({
                source: timeNodeId,
                target: tcNode.id,
                relationship: 'BELONGS_TO_QUARTER'
            }));

            if (timeWordclouds.length > 0) {
                addToGraphData({
                    nodes: timeWordclouds,
                    links: newLinks
                });

                expandedNodes.add(timeNodeId);
                showSuccess(`找到 ${timeWordclouds.length} 个时间词云`);
            }
        } else {
            // 如果没有直接连接，尝试根据日期推断季度
            const inferredQuarter = inferQuarterFromDate(timeName);
            if (inferredQuarter) {
                showInfo(`推断属于 ${inferredQuarter}，正在查询...`);

                // 调用时间词云API
                setTimeout(() => {
                    expandWordCloud({
                        id: `inferred_${inferredQuarter}`,
                        name: inferredQuarter,
                        category: 'Time',
                        type: 'wordcloud'
                    });
                }, 300);
            } else {
                showInfo('该时间节点没有关联的时间词云');
            }
        }
    } catch (error) {
        console.error('[DEBUG] 展开时间节点到词云失败:', error);
        showError('搜索时间词云失败: ' + error.message);
    }
}
// 根据日期推断季度
function inferQuarterFromDate(dateStr) {
    try {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        let quarter;
        if (month >= 1 && month <= 3) quarter = 1;
        else if (month >= 4 && month <= 6) quarter = 2;
        else if (month >= 7 && month <= 9) quarter = 3;
        else quarter = 4;

        return `${year} Q${quarter}`;
    } catch (e) {
        return null;
    }
}
// 新增函数：获取分类图标
function getCategoryIcon(category) {
    switch (category) {
        case 'Theme': return '🎯';
        case 'Location': return '📍';
        case 'PollutionSource': return '⚠️';
        case 'TimePeriod': return '🕒';
        default: return '📁';
    }
}

// 窗口大小调整时重绘
window.addEventListener('resize', () => {
    if (echartsChart) {
        echartsChart.resize();
    }
});

function createDetailPanel() {
    detailPanel = document.createElement('div');
    detailPanel.id = 'kg-detail-panel';
    detailPanel.style.cssText = `
        position: fixed;
        top: 50px;
        right: 20px;
        width: 400px;
        max-height: 80vh;
        background: rgba(0, 0, 0, 0.95);
        border: 2px solid #4bcffa;
        border-radius: 10px;
        color: white;
        padding: 0;
        z-index: 1000;
        display: none;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
        overflow: hidden;
        font-family: 'Segoe UI', sans-serif;
    `;

    // 标题栏
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
        background: linear-gradient(135deg, #4bcffa, #0abde3);
        padding: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.2);
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-weight: bold; font-size: 18px;';
    title.textContent = '节点详情';

    // 先声明 closeBtn
    const closeBtn = document.createElement('div');
    closeBtn.style.cssText = `
        cursor: pointer;
        font-size: 24px;
        color: white;
        padding: 2px 10px;
        border-radius: 3px;
        transition: background 0.2s;
    `;
    closeBtn.innerHTML = '×';
    closeBtn.onclick = hideDetailPanel;

    // 然后声明 expandBtn，这样它可以使用 closeBtn 作为参考
    const expandBtn = document.createElement('div');
    expandBtn.id = 'kg-expand-btn';
    expandBtn.style.cssText = `
        cursor: pointer;
        background: #2ecc71;
        color: white;
        padding: 5px 12px;
        border-radius: 4px;
        font-size: 14px;
        margin-right: 10px;
        transition: background 0.2s;
    `;
    expandBtn.innerHTML = '🔽 展开';
    expandBtn.onclick = function () {
        const contentDiv = document.getElementById('kg-detail-content');
        const nodeData = contentDiv.dataset.nodeData ?
            JSON.parse(contentDiv.dataset.nodeData) : null;

        if (nodeData) {
            console.log('[DEBUG] 从详情面板展开节点:', nodeData);
            expandNodeFromDetail(nodeData);
            hideDetailPanel();
        }
    };

    // 正确添加元素到标题栏：expandBtn 在 closeBtn 前面
    titleBar.appendChild(title);
    titleBar.appendChild(expandBtn);  // 先添加展开按钮
    titleBar.appendChild(closeBtn);   // 再添加关闭按钮

    // 内容区域
    const content = document.createElement('div');
    content.id = 'kg-detail-content';
    content.style.cssText = `
        padding: 20px;
        max-height: calc(80vh - 70px);
        overflow-y: auto;
        font-size: 14px;
        line-height: 1.6;
    `;

    detailPanel.appendChild(titleBar);
    detailPanel.appendChild(content);
    document.body.appendChild(detailPanel);

    console.log('[DEBUG] 详情面板创建完成');
}
// 修改从详情面板展开节点的函数
function expandNodeFromDetail(nodeData) {
    if (!nodeData || !nodeData.id) {
        console.error('[DEBUG] 无效的节点数据');
        return;
    }

    console.log('[DEBUG] 展开节点:', nodeData.id, '类型:', nodeData.type);

    if (expandedNodes.has(nodeData.id)) {
        console.log('[DEBUG] 节点已展开，跳过');
        return;
    }

    switch (nodeData.type) {
        case 'wordcloud':
            expandWordCloud(nodeData);
            break;
        case 'time':
            // 对于时间节点，显示选项而不是直接展开
            expandTimeNode(nodeData);
            break;
        case 'news':
            expandNews(nodeData);
            break;
        default:
            console.log('[DEBUG] 未知节点类型:', nodeData.type);
    }
}
function showDetailPanel(node, content) {
    if (!detailPanel) return;

    const contentDiv = document.getElementById('kg-detail-content');
    if (contentDiv) {
        contentDiv.innerHTML = content;
    }

    detailPanel.style.display = 'block';
}

function hideDetailPanel() {
    if (detailPanel) {
        detailPanel.style.display = 'none';
    }
}
// 修改 loadWordClouds 函数
async function loadWordClouds() {
    try {
        console.log('[DEBUG] 开始加载词云...');
        showLoading('加载词云节点...');

        // 同时获取所有词云（包括时间词云）
        const response = await fetch('/api/knowledge-graph/wordclouds');
        const result = await response.json();

        console.log('[DEBUG] 普通词云API响应:', result.success, '数据条数:', result.data?.length || 0);

        let allWordclouds = [];

        if (result.success && result.data) {
            allWordclouds = [...allWordclouds, ...result.data];
        }

        // 单独获取时间词云
        try {
            const timeResponse = await fetch('/api/knowledge-graph/time-wordclouds');
            const timeResult = await timeResponse.json();

            console.log('[DEBUG] 时间词云API响应:', timeResult.success, '数据条数:', timeResult.data?.length || 0);

            if (timeResult.success && timeResult.data) {
                allWordclouds = [...allWordclouds, ...timeResult.data];
            }
        } catch (timeError) {
            console.warn('[DEBUG] 加载时间词云失败，继续使用普通词云:', timeError);
        }

        console.log('[DEBUG] 总共词云数据:', allWordclouds.length, '个');

        if (allWordclouds.length > 0) {
            const finalNodes = allWordclouds.map(node => {
                console.log(`[DEBUG] 创建词云节点: ${node.name} (${node.category})`);

                const nodeObj = {
                    id: node.id || `wordcloud_${node.category}_${node.name}`,
                    name: node.name,
                    category: node.category,
                    type: 'wordcloud',
                    isWordCloud: true,
                    symbolSize: node.symbolSize || (node.category === 'Time' ? 40 : 35),
                    color: nodeColors[node.category] || '#95a5a6',
                    showLabel: true,
                    properties: node.properties || node
                };

                return nodeObj;
            });

            updateGraphData({
                nodes: finalNodes,
                links: []
            });

            showSuccess(`加载 ${finalNodes.length} 个词云节点（包含时间词云）`);

            // 调试：显示前几个词云
            console.log('[DEBUG] 加载的词云示例:', finalNodes.slice(0, 3).map(n => `${n.category}:${n.name}`));
        } else {
            console.error('[DEBUG] 没有找到任何词云数据');
            showError('加载词云失败');
        }
    } catch (error) {
        console.error('[DEBUG] 加载词云失败:', error);
        showError('加载词云失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 新增：将英文时间格式转换为中文格式
function convertTimeToChinese(englishTime) {
    if (!englishTime) return englishTime;

    // 匹配格式：2025 Q2 -> 2025年第二季度
    const match = englishTime.match(/(\d{4})\s*Q(\d)/);
    if (match) {
        const year = match[1];
        const quarterNum = parseInt(match[2]);
        const quarterNames = ['', '第一季度', '第二季度', '第三季度', '第四季度'];
        if (quarterNum >= 1 && quarterNum <= 4) {
            return `${year}年${quarterNames[quarterNum]}`;
        }
    }

    // 如果不是英文格式，直接返回
    return englishTime;
}

// 新增：将中文时间格式转换回英文格式
function convertTimeToEnglish(chineseTime) {
    if (!chineseTime) return chineseTime;

    // 匹配格式：2025年第二季度 -> 2025 Q2
    const match = chineseTime.match(/(\d{4})年(第(.)季度)/);
    if (match) {
        const year = match[1];
        const quarterChar = match[3];
        const quarterMap = { '一': '1', '二': '2', '三': '3', '四': '4' };
        const quarterNum = quarterMap[quarterChar] || '1';
        return `${year} Q${quarterNum}`;
    }

    // 如果不是中文格式，直接返回
    return chineseTime;
}
// 在 expandWordCloud 函数中修改
async function expandWordCloud(wordCloudNode) {
    try {
        console.log('[DEBUG] 展开词云节点:', wordCloudNode);

        showLoading(`加载 "${wordCloudNode.name}" 的关联节点...`);

        const wordcloudName = wordCloudNode.properties?.name || wordCloudNode.name;

        if (!wordcloudName) {
            showError('词云节点缺少名称');
            return;
        }

        const response = await fetch(
            `/api/knowledge-graph/wordcloud-aggregates/${encodeURIComponent(wordcloudName)}`
        );

        const result = await response.json();
        console.log('[DEBUG] API响应:', result);

        if (result.success && result.data) {
            const wordcloudInfo = result.wordcloud || {};
            // 修改这里：判断逻辑
            const isTimeWordCloud = wordcloudInfo.isTimeWordCloud ||
                wordCloudNode.category === 'Time' ||
                wordcloudInfo.type === 'Time';

            console.log(`[DEBUG] 词云信息:`, {
                name: wordcloudName,
                type: wordcloudInfo.type,
                category: wordcloudInfo.category,
                isTimeWordCloud: isTimeWordCloud
            });

            const aggregateNodes = result.data.map(node => {
                // 根据返回的数据类型处理
                if (isTimeWordCloud && node.type === 'time') {
                    // 具体时间节点
                    return {
                        id: node.id,
                        name: `🕒 ${node.name}`,
                        category: 'TimeNode',
                        type: 'time',
                        symbolSize: 18,
                        color: nodeColors.TimeNode || '#3498db',
                        showLabel: true,
                        properties: {
                            ...node.properties,
                            name: node.name,
                            displayName: node.name,
                            isTimeDate: true
                        }
                    };
                } else if (isTimeWordCloud && node.type === 'news') {
                    // 项目
                    return {
                        id: node.id,
                        name: `📰 ${node.name}`,
                        category: 'News',
                        type: 'news',
                        symbolSize: 22,
                        color: nodeColors.News,
                        showLabel: false,
                        properties: node.properties || node
                    };
                } else {
                    // 其他聚合节点
                    return {
                        id: node.id,
                        name: node.name || `聚合节点 ${node.projectId}`,
                        category: node.category,
                        type: node.type,
                        symbolSize: node.itemCount ? 15 + Math.min(node.itemCount * 2, 10) : 20,
                        color: getAggregateColor(node.wordcloudCategory),
                        showLabel: true,
                        properties: node
                    };
                }
            });

            const newLinks = aggregateNodes.map(aggNode => {
                let relationship = 'CONTAINS';
                if (isTimeWordCloud && aggNode.type === 'time') {
                    relationship = 'HAS_DATE';
                } else if (isTimeWordCloud && aggNode.type === 'news') {
                    relationship = 'CONTAINS_NEWS';
                }

                return {
                    source: wordCloudNode.id,
                    target: aggNode.id,
                    relationship: relationship
                };
            });

            if (aggregateNodes.length > 0) {
                addToGraphData({
                    nodes: aggregateNodes,
                    links: newLinks
                });

                expandedNodes.add(wordCloudNode.id);
                showSuccess(`添加 ${aggregateNodes.length} 个关联节点`);
            } else {
                showInfo('该词云没有关联的节点');
            }
        }
    } catch (error) {
        console.error('[DEBUG] 展开词云失败:', error);
        showError('加载关联节点失败: ' + error.message);
    }
}
// 修复 getChineseType 函数
function getChineseType(category) {
    if (!category) return '聚合';

    const map = {
        'Theme': '主题',
        'Location': '位置',
        'Pollution': '污染源',
        'Time': '时间',
        'News': '新闻',
        'Project': '项目'
    };
    return map[category] || category;
}
// 修改现有的 expandAggregateNode 函数（如果需要的话）
async function expandAggregateNode(aggregateNode) {
    try {
        // 这里有两个选择：
        // 1. 直接显示新闻（推荐，因为用户点击聚合节点想看新闻）
        // 2. 显示词云分类（原来的逻辑）

        // 根据你的需求选择：
        const shouldShowNews = true; // 设置为 true 直接显示新闻，false 显示词云

        if (shouldShowNews) {
            await expandAggregateToNews(aggregateNode);
        } else {
            // 原来的逻辑：显示词云分类
            const projectId = aggregateNode.properties?.projectId;
            const aggregateType = aggregateNode.category;

            if (!projectId || !aggregateType) {
                showError('聚合节点缺少必要信息');
                return;
            }

            showLoading('加载聚合节点的词云分类...');

            // 调用API获取该聚合节点连接的词云节点
            const response = await fetch(
                `/api/knowledge-graph/aggregate-wordclouds/${projectId}?type=${aggregateType}`
            );
            const result = await response.json();

            if (result.success && result.data) {
                const wordcloudNodes = result.data.map(wc => ({
                    id: wc.id,
                    name: wc.name,
                    category: wc.category,
                    type: 'wordcloud',
                    isWordCloud: true,
                    symbolSize: 35,
                    color: nodeColors[wc.category] || '#95a5a6',
                    showLabel: true,
                    properties: wc
                }));

                const newLinks = wordcloudNodes.map(wcNode => ({
                    source: aggregateNode.id,
                    target: wcNode.id,
                    relationship: 'BELONGS_TO_CATEGORY'
                }));

                if (wordcloudNodes.length > 0) {
                    addToGraphData({
                        nodes: wordcloudNodes,
                        links: newLinks
                    });

                    expandedNodes.add(aggregateNode.id);
                    showSuccess(`添加 ${wordcloudNodes.length} 个词云节点`);
                } else {
                    showInfo('该聚合节点没有关联的词云分类');
                }
            }
        }
    } catch (error) {
        console.error('展开聚合节点失败:', error);
        showError('加载信息失败');
    }
}
function getAggregateColor(type) {
    if (!type) return '#95a5a6'; // 处理 undefined 情况

    const typeStr = String(type); // 确保是字符串

    if (typeStr.includes('Location')) return nodeColors.Location || '#e67e22';
    if (typeStr.includes('Theme')) return nodeColors.Theme || '#9b59b6';
    if (typeStr.includes('Pollution')) return nodeColors.Pollution || '#e74c3c';
    if (typeStr.includes('Time')) return nodeColors.Time || '#3498db';

    return '#95a5a6';
}
// ============ 时间词云展开函数 ============
async function expandTimeWordCloud(timeWordCloudNode) {
    try {
        // 直接使用节点的名称（应该是英文格式）
        const wordcloudName = timeWordCloudNode.properties?.name || timeWordCloudNode.name || '';
        const cleanWordcloudName = wordcloudName.trim();

        if (!cleanWordcloudName || cleanWordcloudName === '未知') {
            console.warn(`[DEBUG] 时间词云名称为空或未知: "${wordcloudName}"`);
            showInfo('时间词云名称无效');
            return;
        }

        console.log(`[DEBUG] 展开时间词云: "${cleanWordcloudName}"`);
        showLoading(`加载 ${cleanWordcloudName} 的具体日期...`);

        const response = await fetch(
            `/api/knowledge-graph/time-wordcloud-dates/${encodeURIComponent(cleanWordcloudName)}`
        );
        const result = await response.json();

        console.log(`[DEBUG] API响应状态:`, result.success, '数据条数:', result.data?.length || 0);

        if (result.success && result.data && result.data.length > 0) {
            const newLinks = [];
            const newNodes = [];

            // 检查是否已经有太多节点，如果是则清理一些
            if (graphData.nodes.length > 80) {
                console.log('⚠️ 节点较多，自动清理旧节点...');
                cleanupGraph();
            }

            // 限制日期节点的数量（例如最多显示10个日期）
            const maxDateNodes = 10;
            const limitedDateData = result.data.slice(0, maxDateNodes);

            // 如果有更多日期，添加提示
            const totalDates = result.data.length;
            const displayDates = limitedDateData.length;

            if (totalDates > displayDates) {
                console.log(`[限制] 日期节点较多，只显示前 ${displayDates} 个，总计 ${totalDates} 个`);
                showInfo(`显示 ${displayDates}/${totalDates} 个日期节点`);
            }

            for (const dateInfo of limitedDateData) {
                // 获取日期字符串，优先使用displayName
                const dateStr = dateInfo.displayName || dateInfo.name || '';
                const cleanDateStr = dateStr.trim();

                if (!cleanDateStr || cleanDateStr === '未知') {
                    console.warn(`[去重] 跳过无效日期: "${dateStr}"`);
                    continue;
                }

                // 格式化日期显示
                const displayDate = formatDateForDisplay(cleanDateStr);

                // 生成统一的节点ID（用于去重）
                const dateId = `timeperiod_${cleanDateStr.replace(/[^a-zA-Z0-9]/g, '_')}`;

                const dateNode = {
                    id: dateId,
                    name: `📅 ${displayDate}`,
                    category: 'TimePeriod',
                    type: 'date',
                    symbolSize: 18,
                    color: '#3498db',
                    showLabel: true,
                    properties: {
                        name: cleanDateStr,
                        displayName: displayDate,
                        originalName: cleanDateStr,
                        projectCount: dateInfo.projectCount || 0,
                        isTimeDate: true,
                        content: cleanDateStr, // 用于去重的内容字段
                        wordcloud: cleanWordcloudName // 记录所属词云
                    }
                };

                // 检查节点是否已存在
                const nodeKey = getNodeKey(dateNode);

                if (nodeIndex.has(nodeKey)) {
                    console.log(`[去重] 日期节点已存在: ${displayDate} (${nodeKey})`);
                    // 使用已存在节点的ID
                    const existingNode = nodeIndex.get(nodeKey);
                    dateNode.id = existingNode.id;

                    // 更新现有节点的属性（如果需要）
                    if (dateInfo.projectCount && dateInfo.projectCount > existingNode.properties.projectCount) {
                        existingNode.properties.projectCount = dateInfo.projectCount;
                        existingNode.properties.wordcloud = cleanWordcloudName;
                    }
                } else {
                    // 新节点，添加到待添加列表
                    newNodes.push(dateNode);
                    console.log(`[去重] 新增日期节点: ${displayDate} (${nodeKey})`);
                }

                // 检查关系是否已存在
                const relationKey = `${timeWordCloudNode.id}->${dateNode.id}`;
                if (!relationIndex.has(relationKey)) {
                    newLinks.push({
                        source: timeWordCloudNode.id,
                        target: dateNode.id,
                        relationship: 'CONTAINS_DATE',
                        label: cleanWordcloudName
                    });
                    console.log(`[去重] 添加关系: ${cleanWordcloudName} -> ${displayDate}`);
                } else {
                    console.log(`[去重] 关系已存在: ${cleanWordcloudName} -> ${displayDate}`);
                }
            }

            // 只添加新节点和新关系
            if (newNodes.length > 0 || newLinks.length > 0) {
                addToGraphData({
                    nodes: newNodes,
                    links: newLinks
                });

                expandedNodes.add(timeWordCloudNode.id);

                if (newNodes.length > 0) {
                    showSuccess(`添加 ${newNodes.length} 个日期节点`);
                } else if (newLinks.length > 0) {
                    showSuccess(`添加 ${newLinks.length} 条新关系`);
                } else {
                    showInfo('所有节点和关系均已存在');
                }

            } else {
                showInfo('所有日期节点均已存在');
            }

            // 调试信息
            console.log(`[限制统计] 时间词云展开完成:`);
            console.log(`  - 总日期: ${totalDates} 个`);
            console.log(`  - 显示日期: ${displayDates} 个`);
            console.log(`  - 新增节点: ${newNodes.length} 个`);
            console.log(`  - 新增关系: ${newLinks.length} 条`);

        } else {
            console.warn(`[DEBUG] 没有找到具体日期数据`, result);
            if (result.error) {
                showError(`加载日期数据失败: ${result.error}`);
            } else {
                showInfo('该时间段没有具体日期数据');
            }
        }

    } catch (error) {
        console.error('展开时间词云失败:', error);
        showError('加载日期数据失败: ' + error.message);
    }
}
// ============ 辅助函数：格式化日期显示 ============
function formatDateForDisplay(dateStr) {
    if (!dateStr) return '未知日期';

    try {
        // 移除所有非数字和分隔符的字符
        const cleaned = dateStr.replace(/[^0-9\/\-年月日]/g, '');

        // 尝试解析日期
        let date;

        // 处理 YYYY-MM-DD 格式
        if (cleaned.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
            const parts = cleaned.split('-');
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        // 处理 YYYY/MM/DD 格式
        else if (cleaned.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
            const parts = cleaned.split('/');
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        // 处理 YYYY年MM月DD日 格式
        else if (cleaned.match(/^\d{4}年\d{1,2}月\d{1,2}日$/)) {
            const year = cleaned.match(/\d{4}/)[0];
            const month = cleaned.match(/(?<=年)\d{1,2}(?=月)/)[0].padStart(2, '0');
            const day = cleaned.match(/(?<=月)\d{1,2}(?=日)/)[0].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        // 处理 YYYY-MM 格式
        else if (cleaned.match(/^\d{4}-\d{1,2}$/)) {
            const parts = cleaned.split('-');
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            return `${year}-${month}`;
        }
        // 处理 YYYY年 格式
        else if (cleaned.match(/^\d{4}年$/)) {
            const year = cleaned.match(/\d{4}/)[0];
            return `${year}年`;
        }
        // 其他格式直接返回
        else {
            return cleaned || dateStr;
        }
    } catch (e) {
        console.warn(`格式化日期失败: ${dateStr}`, e.message);
        return dateStr;
    }
}

function getTimeDisplayName(dateInfo) {
    const displayName = dateInfo.displayName || dateInfo.name;
    // 为时间词云添加一个更通用的图标
    return `🕒 ${displayName}`;
}
// ============ 时间日期节点展开函数 ============
async function expandTimeDate(timeDateNode) {
    try {
        // 获取日期，优先使用originalName
        const dateStr = timeDateNode.properties?.originalName ||
            timeDateNode.properties?.name ||
            timeDateNode.name || '';

        // 清理日期字符串
        let cleanDateStr = dateStr
            .replace(/^📅\s*/, '')  // 移除图标
            .replace(/[^0-9\/\-]/g, '')  // 只保留数字和分隔符
            .trim();

        console.log(`[DEBUG] 展开日期节点:`);
        console.log(`  原始名称: "${timeDateNode.name}"`);
        console.log(`  属性名称: "${timeDateNode.properties?.name}"`);
        console.log(`  清理后日期: "${cleanDateStr}"`);
        console.log(`  节点完整属性:`, timeDateNode.properties);

        if (!cleanDateStr || cleanDateStr === '未知') {
            console.warn(`[DEBUG] 日期节点名称为空或未知`);
            showInfo('日期名称无效');
            return;
        }

        // 如果已经展开过，跳过
        if (expandedNodes.has(timeDateNode.id)) {
            console.log(`[DEBUG] 日期节点已展开过: ${cleanDateStr}`);
            showInfo(`日期 ${cleanDateStr} 已展开`);
            return;
        }

        showLoading(`搜索 ${cleanDateStr} 的新闻...`);

        // 限制新闻数量（最多显示8篇新闻）
        const maxNews = 8;

        // 使用日期查询API，添加数量限制参数
        const response = await fetch(
            `/api/knowledge-graph/date/${encodeURIComponent(cleanDateStr)}?limit=${maxNews}`
        );
        const result = await response.json();

        console.log(`[DEBUG] API响应:`, {
            success: result.success,
            count: result.data?.length || 0,
            query: result.query,
            foundDates: result.data?.map(n => n.properties?.publish_time)
        });

        if (result.success && result.data && result.data.length > 0) {
            const newNodes = [];
            const newLinks = [];

            // 检查是否已经有太多节点，如果是则清理一些
            if (graphData.nodes.length > 80) {
                console.log('⚠️ 节点较多，自动清理旧节点...');
                cleanupGraph();
            }

            // 限制新闻数量
            const limitedNews = result.data.slice(0, maxNews);
            const totalNews = result.data.length;

            // 如果有更多新闻，添加提示
            if (totalNews > maxNews) {
                console.log(`[限制] 新闻较多，只显示前 ${maxNews} 篇，总计 ${totalNews} 篇`);
                showInfo(`显示 ${maxNews}/${totalNews} 篇新闻`);
            }

            for (const node of limitedNews) {
                const publishTime = node.properties?.publish_time || '';
                const projectId = node.projectId || node.properties?.id;
                const newsId = `news_${projectId}`;

                // 验证日期匹配
                const isDateMatch = publishTime.includes(cleanDateStr) ||
                    cleanDateStr.includes(publishTime.split('-')[0]);

                console.log(`[DEBUG] 新闻验证:`);
                console.log(`  查询日期: ${cleanDateStr}`);
                console.log(`  新闻日期: ${publishTime}`);
                console.log(`  是否匹配: ${isDateMatch}`);

                if (!isDateMatch) {
                    console.warn(`[DEBUG] 日期不匹配，跳过: ${publishTime} !== ${cleanDateStr}`);
                    continue;
                }

                const newsNode = {
                    id: newsId,
                    name: `📰 ${node.properties?.title || node.title || '无标题'}`,
                    category: 'News',
                    type: 'news',
                    symbolSize: 20,
                    color: nodeColors.News,
                    showLabel: false,
                    properties: node.properties || node
                };

                // 检查新闻节点是否已存在
                const nodeKey = getNodeKey(newsNode);

                if (nodeIndex.has(nodeKey)) {
                    console.log(`[去重] 新闻节点已存在: ${newsNode.name}`);
                    const existingNode = nodeIndex.get(nodeKey);
                    newsNode.id = existingNode.id;
                } else {
                    newNodes.push(newsNode);
                    console.log(`[去重] 新增新闻节点: ${newsNode.name} (${publishTime})`);
                }

                // 检查关系是否已存在
                const relationKey = `${timeDateNode.id}->${newsNode.id}`;
                if (!relationIndex.has(relationKey)) {
                    newLinks.push({
                        source: timeDateNode.id,
                        target: newsNode.id,
                        relationship: 'PUBLISHED_ON',
                        date: cleanDateStr,
                        newsDate: publishTime
                    });
                    console.log(`[去重] 添加关系: ${cleanDateStr} -> ${newsNode.name}`);
                } else {
                    console.log(`[去重] 关系已存在: ${cleanDateStr} -> ${newsNode.name}`);
                }
            }

            // 添加到图谱
            if (newNodes.length > 0 || newLinks.length > 0) {
                addToGraphData({
                    nodes: newNodes,
                    links: newLinks
                });

                expandedNodes.add(timeDateNode.id);

                if (newNodes.length > 0) {
                    showSuccess(`找到 ${newNodes.length} 篇 ${cleanDateStr} 的新闻`);
                } else {
                    showInfo('没有新新闻，但添加了关系连接');
                }

                // 调试统计
                console.log(`[限制统计] 日期节点展开完成:`);
                console.log(`  - 总新闻: ${totalNews} 篇`);
                console.log(`  - 显示新闻: ${limitedNews.length} 篇`);
                console.log(`  - 新增节点: ${newNodes.length} 个`);
                console.log(`  - 新增关系: ${newLinks.length} 条`);

            } else {
                showInfo(`没有找到 ${cleanDateStr} 的新新闻（可能已全部存在）`);
                expandedNodes.add(timeDateNode.id); // 仍然标记为已展开
            }

        } else {
            showInfo(`没有找到 ${cleanDateStr} 的相关新闻`);
            expandedNodes.add(timeDateNode.id); // 即使没有找到新闻也标记为已展开，避免重复查询
            console.log(`[DEBUG] 没有找到相关新闻:`, result);
        }

    } catch (error) {
        console.error('展开时间日期失败:', error);
        showError('搜索新闻失败: ' + error.message);
    }
}


// ============ 辅助函数：将中文时间转换为英文格式 ============
function convertTimeToEnglish(chineseTime) {
    if (!chineseTime) return chineseTime;

    // 匹配格式：2015年第二季度 -> 2015 Q2
    const match = chineseTime.match(/(\d{4})年(第(.)季度)/);
    if (match) {
        const year = match[1];
        const quarterChar = match[3];
        const quarterMap = { '一': '1', '二': '2', '三': '3', '四': '4' };
        const quarterNum = quarterMap[quarterChar] || '1';
        return `${year} Q${quarterNum}`;
    }

    // 如果不是中文格式，直接返回
    return chineseTime;
}

// 辅助函数：获取新闻显示名称
function getNewsDisplayName(node) {
    const title = node.properties?.title || node.name || '无标题';
    const prefix = getNewsPrefix(node.properties);

    // 根据新闻标题长度调整显示
    if (title.length > 40) {
        return `${prefix}${title.substring(0, 37)}...`;
    }
    return `${prefix}${title}`;
}

// 辅助函数：根据新闻内容获取前缀
function getNewsPrefix(properties) {
    if (!properties) return '📰 ';

    // 根据新闻类型添加不同图标
    if (properties.pollution_source && Array.isArray(properties.pollution_source) && properties.pollution_source.length > 0) {
        return '⚠️ ';
    } else if (properties.theme && properties.theme.includes('生态')) {
        return '🌿 ';
    } else if (properties.theme && properties.theme.includes('保护')) {
        return '🛡️ ';
    }
    return '📰 ';
}

// 辅助函数：根据新闻内容调整节点大小
function getNewsSymbolSize(node) {
    const props = node.properties || {};
    let size = 20; // 默认大小

    // 根据新闻信息丰富程度调整大小
    if (props.measure && Array.isArray(props.measure) && props.measure.length > 0) {
        size += 2;
    }
    if (props.effect_data && Array.isArray(props.effect_data) && props.effect_data.length > 0) {
        size += 2;
    }

    return Math.min(size, 26); // 限制最大大小
}

// ============ 新闻节点展开函数 ============

async function expandNews(newsNode) {
    try {
        showLoading(`加载 ${newsNode.name} 的详细信息...`);

        const projectId = newsNode.properties?.id;
        if (!projectId) {
            showError('新闻节点缺少项目ID');
            return;
        }

        // 调用API获取新闻的详细信息
        const response = await fetch(`/api/knowledge-graph/news-details/${projectId}`);
        const result = await response.json();

        if (result.success && result.data) {
            const data = result.data;
            const newNodes = [];
            const newLinks = [];


            if (data.time) {
                const timeNode = {
                    id: `time_${data.time.id || projectId}`,
                    name: data.time.displayName || `📅 ${data.time.name}`,
                    category: 'TimeNode',
                    type: 'time',
                    symbolSize: 16,
                    color: nodeColors.TimeNode || '#3498db',
                    showLabel: true,
                    properties: data.time
                };
                newNodes.push(timeNode);
                newLinks.push({
                    source: newsNode.id,
                    target: timeNode.id,
                    relationship: 'PUBLISHED_ON'
                });
            }

            // 2. 添加聚合节点
            // 位置聚合节点
            if (data.locationAggregate) {
                const locNode = createAggregateNode(data.locationAggregate, 'Location');
                newNodes.push(locNode);
                newLinks.push({
                    source: newsNode.id,
                    target: locNode.id,
                    relationship: 'HAS_LOCATION'
                });
            }

            // 主题聚合节点
            if (data.themeAggregate) {
                const themeNode = createAggregateNode(data.themeAggregate, 'Theme');
                newNodes.push(themeNode);
                newLinks.push({
                    source: newsNode.id,
                    target: themeNode.id,
                    relationship: 'HAS_THEME'
                });
            }

            // 污染源聚合节点
            if (data.pollutionAggregate) {
                const pollNode = createAggregateNode(data.pollutionAggregate, 'Pollution');
                newNodes.push(pollNode);
                newLinks.push({
                    source: newsNode.id,
                    target: pollNode.id,
                    relationship: 'HAS_POLLUTION'
                });
            }

            // 3. 添加执行方节点

            // 3. 添加执行组织节点（一个新闻只生成一个节点，items 内合并）
            if (data.executors && data.executors.length > 0) {
                const items = data.executors
                    .map(e => (typeof e === 'string' ? e : e?.name))
                    .filter(Boolean);

                if (items.length > 0) {
                    const firstItem = items[0];
                    let displayName = `👥 执行组织: ${String(firstItem).substring(0, 30)}`;
                    if (items.length > 1) {
                        displayName += ` 等${items.length}项`;
                    }

                    const execNode = {
                        id: `executor_${projectId}`,
                        name: displayName,
                        category: 'Executor',
                        type: 'executor',
                        symbolSize: 16 + Math.min(items.length * 2, 10),
                        color: nodeColors.Executor,
                        showLabel: true,
                        properties: {
                            projectId,
                            items,
                            itemCount: items.length,
                            raw: data.executors
                        }
                    };
                    newNodes.push(execNode);
                    newLinks.push({
                        source: newsNode.id,
                        target: execNode.id,
                        relationship: 'EXECUTED_BY'
                    });
                }
            }


            // 4. 添加措施效果合并节点
            if (data.combinedContent) {
                const ccNode = {
                    id: `combined_${projectId}`,
                    name: '📊 措施效果',
                    category: 'CombinedContent',
                    type: 'combined',
                    symbolSize: 16,
                    color: nodeColors.CombinedContent,
                    showLabel: true,
                    properties: data.combinedContent
                };
                newNodes.push(ccNode);
                newLinks.push({
                    source: newsNode.id,
                    target: ccNode.id,
                    relationship: 'HAS_CONTENT'
                });
            }

            // 检查并过滤已存在的节点，避免重复添加
            const existingNodeIds = new Set(graphData.nodes.map(n => n.id));
            const filteredNodes = newNodes.filter(node => !existingNodeIds.has(node.id));
            const filteredLinks = newLinks.filter(link => {
                // 检查连接是否已存在
                return !graphData.links.some(existingLink => 
                    existingLink.source === link.source && existingLink.target === link.target
                );
            });

            // 添加到图谱
            if (filteredNodes.length > 0 || filteredLinks.length > 0) {
                addToGraphData({
                    nodes: filteredNodes,
                    links: filteredLinks
                });

                expandedNodes.add(newsNode.id);
                const addedCount = filteredNodes.length + filteredLinks.length;
                showSuccess(`添加 ${filteredNodes.length} 个节点和 ${filteredLinks.length} 个关联`);
            } else {
                // 即使节点已存在，也标记为已展开，避免重复请求
                expandedNodes.add(newsNode.id);
                showInfo('该新闻的关联节点已全部显示，可继续点击其他节点探索');
            }
        }
    } catch (error) {
        console.error('展开新闻失败:', error);
        showError('加载详细信息失败');
    }
}

// 辅助函数：创建聚合节点
function createAggregateNode(aggregateData, type) {
    const items = aggregateData.items || [];
    const itemCount = aggregateData.itemCount || 0;

    let displayName = '';
    if (items.length > 0) {
        const firstItem = items[0];
        const chineseType = getChineseType(type);
        displayName = `${chineseType}: ${firstItem.substring(0, 30)}`;
        if (itemCount > 1) {
            displayName += ` 等${itemCount}项`;
        }
    } else {
        displayName = `${getChineseType(type)}聚合节点`;
    }

    // 确保ID是字符串
    const aggregateId = String(aggregateData.id || `agg_${type}_${aggregateData.projectId || 'unknown'}`);
    
    return {
        id: aggregateId,
        name: `📦 ${displayName}`,
        category: `${type}Aggregate`,
        type: 'aggregate',
        symbolSize: 18 + Math.min(itemCount * 2, 10),
        color: getAggregateColor(type),
        showLabel: true,
        properties: aggregateData
    };
}

// ============ 图表数据处理 ============
function updateGraphData(newData) {
    console.log('[DEBUG] updateGraphData 被调用，节点数:', newData.nodes?.length || 0, '连接数:', newData.links?.length || 0);
    
    if (!newData || !newData.nodes) {
        console.error('[DEBUG] updateGraphData: 无效的数据', newData);
        return;
    }
    
    graphData = newData;
    // 重建索引
    rebuildNodeIndex();
    
    console.log('[DEBUG] 索引重建完成，准备渲染图谱');
    renderGraph();
}

function rebuildNodeIndex() {
    nodeIndex.clear();
    relationIndex.clear();
    graphNodeById.clear();

    // 重建节点索引
    graphData.nodes.forEach(node => {
        const key = getNodeKey(node);
        nodeIndex.set(key, node);

        if (node && node.id !== undefined && node.id !== null) {
            graphNodeById.set(String(node.id), node);
        }
    });

    // 重建关系索引
    graphData.links.forEach(link => {
        const key = `${link.source}->${link.target}`;
        relationIndex.set(key, link);
    });
}


// ============ 辅助函数：获取节点唯一key ============
function getNodeKey(node) {
    // 生成节点的唯一标识符
    // 对于内容相同的节点，使用相同的内容作为key

    if (!node) return 'invalid_node';

    // 根据节点类型生成不同的key
    switch (node.type) {
        case 'category':
        case 'detail':
        case 'date':
            // 详细节点：使用内容和类型作为key
            const content = node.properties?.content || node.properties?.name || node.name || '';
            const cleanContent = content.replace(/^[🎯📍⚠️🕒📰🌿🛡️🏢📊]\s*/, '').trim();
            return `${node.category}:${cleanContent}`;

        case 'news':
            // 新闻节点：使用ID作为key
            const newsId = node.properties?.id || node.id;
            return `news:${newsId}`;

        case 'wordcloud':
            // 词云节点：使用名称作为key
            const wcName = node.properties?.name || node.name || '';
            const cleanWcName = wcName.replace(/^[🎯📍⚠️🕒📊]\s*/, '').trim();
            return `wordcloud:${node.category}:${cleanWcName}`;

        case 'combined':
            // 措施效果节点：每个新闻独立
            return `combined:${node.id}`;

        default:
            // 其他节点：使用ID作为key
            return `node:${node.id}`;
    }
}

function addToGraphData(additionalData) {
    const newNodes = [];
    const newLinks = [];

    // 1. 添加新节点（去重）
    additionalData.nodes.forEach(newNode => {
        const nodeKey = getNodeKey(newNode);

        // 检查是否已存在相同节点
        if (nodeIndex.has(nodeKey)) {
            console.log(`[去重] 跳过重复节点: ${newNode.name} (${nodeKey})`);

            // 记录现有节点的ID，用于关系连接
            const existingNode = nodeIndex.get(nodeKey);
            newNode.id = existingNode.id; // 使用现有节点的ID
        } else {
            // 新节点，添加到索引和图数据
            nodeIndex.set(nodeKey, newNode);
            newNodes.push(newNode);
        }
    });

    // 2. 添加新关系（去重）
    additionalData.links.forEach(newLink => {
        const relationKey = `${newLink.source}->${newLink.target}`;

        // 检查是否已存在相同关系
        if (relationIndex.has(relationKey)) {
            console.log(`[去重] 跳过重复关系: ${relationKey}`);
        } else {
            // 新关系，添加到索引和图数据
            relationIndex.set(relationKey, newLink);
            newLinks.push(newLink);
        }
    });

    // 3. 更新图数据
    graphData.nodes.push(...newNodes);
    graphData.links.push(...newLinks);

    if (newNodes.length > 0 || newLinks.length > 0) {
        console.log(`[去重] 添加了 ${newNodes.length} 个新节点, ${newLinks.length} 条新关系`);
        renderGraph();
    } else {
        console.log(`[去重] 没有新节点或关系需要添加`);
    }
}

// 防抖渲染函数，避免频繁渲染导致卡死
let renderTimer = null;
function renderGraph() {
    // 清除之前的定时器
    if (renderTimer) {
        clearTimeout(renderTimer);
    }
    
    // 延迟渲染，避免频繁更新
    renderTimer = setTimeout(() => {
        renderGraphImmediate();
    }, 100);
}

function renderGraphImmediate() {
    if (!echartsChart) {
        console.error('[DEBUG] ECharts实例不存在，无法渲染');
        return;
    }

    // 检查图表容器是否存在
    const chartDom = document.getElementById('knowledge-graph');
    if (!chartDom) {
        console.error('[DEBUG] 图表容器不存在');
        return;
    }

    // 检查数据是否有效
    if (!graphData || !Array.isArray(graphData.nodes)) {
        console.error('[DEBUG] 无效的graphData:', graphData);
        return;
    }

    console.log('[DEBUG] renderGraphImmediate: 准备渲染图谱, 节点数:', graphData.nodes.length, '连接数:', graphData.links.length);

    // 1. 过滤和规范节点数据
    const validNodes = [];
    const nodeIdSet = new Set();

    for (const node of graphData.nodes) {
        if (!node || typeof node !== 'object') {
            console.warn('[DEBUG] 跳过无效节点:', node);
            continue;
        }

        const nodeId = String(node.id ?? '');
        if (!nodeId || !node.name) {
            console.warn('[DEBUG] 跳过无效节点（缺少ID或名称）:', node);
            continue;
        }

        // 避免重复节点
        if (nodeIdSet.has(nodeId)) {
            console.warn('[DEBUG] 跳过重复节点:', nodeId);
            continue;
        }
        nodeIdSet.add(nodeId);

        // 创建符合 ECharts 格式的节点数据
        const echartsNode = {
            id: nodeId,
            name: String(node.name || ''),
            category: String(node.category || 'Unknown'),
            symbolSize: Number(node.symbolSize) || 20,
            itemStyle: {
                color: String(node.color || nodeColors[node.category] || '#95a5a6'),
                borderColor: '#fff',
                borderWidth: (node.type === 'wordcloud') ? 3 : 1
            },
            label: {
                show: node.showLabel !== false,
                fontSize: (node.symbolSize > 30) ? 14 : 12,
                color: '#fff'
            }
        };

        // 允许节点拖拽；如用户拖拽过会记录坐标并固定（避免下一次渲染又被 force 布局拉回去）
        echartsNode.draggable = true;
        if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
            echartsNode.x = node.x;
            echartsNode.y = node.y;
        }
        if (node.fixed === true) {
            echartsNode.fixed = true;
        }

        // 使用 data 属性存储原始数据，供事件里使用
        echartsNode.data = {
            id: nodeId,
            name: String(node.name || ''),
            category: String(node.category || 'Unknown'),
            type: String(node.type || node.category || 'Unknown'),
            symbolSize: Number(node.symbolSize) || 20,
            color: String(node.color || nodeColors[node.category] || '#95a5a6'),
            showLabel: node.showLabel !== false,
            properties: node.properties || {},
            isWordCloud: node.isWordCloud || false,
            expanded: node.expanded || false,
            x: node.x,
            y: node.y,
            fixed: node.fixed === true
        };

        validNodes.push(echartsNode);
    }

    // 2. 过滤和规范连接数据
    const validLinks = [];
    const linkSet = new Set();

    if (Array.isArray(graphData.links)) {
        for (const link of graphData.links) {
            if (!link || typeof link !== 'object') {
                continue;
            }

            const source = String(link.source || '');
            const target = String(link.target || '');

            if (!source || !target) {
                continue;
            }

            // 验证连接的节点是否存在
            if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) {
                continue;
            }

            // 避免重复连接
            const linkKey = `${source}->${target}`;
            if (linkSet.has(linkKey)) {
                continue;
            }
            linkSet.add(linkKey);

            validLinks.push({
                source: source,
                target: target,
                lineStyle: {
                    color: '#4bcffa',
                    width: 1.5,
                    opacity: 0.6
                },
                label: {
                    show: true,
                    formatter: String(link.relationship || 'RELATED'),
                    fontSize: 10,
                    color: '#4bcffa'
                }
            });
        }
    }

    // 将处理后的节点和连线应用到图表
    try {
        echartsChart.setOption({
            series: [{
                type: 'graph',
                data: validNodes,
                links: validLinks
            }]
        });
    } catch (e) {
        console.error('[DEBUG] 更新图谱渲染失败:', e);
        return;
    }

    // 3. 验证数据
    if (validNodes.length === 0) {
        console.warn('[DEBUG] 没有有效节点可渲染');
        return;
    }

            // === 构建高亮用索引和邻接表 ===
        graphNodeById.clear();
        echartsNodeIndexMap.clear();
        echartsLinkIndexList = [];
        adjacencyList.clear();

        // 1）原始节点映射：id -> 原始 node（取类型等）
        if (Array.isArray(graphData.nodes)) {
            graphData.nodes.forEach(n => {
                if (n && n.id !== undefined && n.id !== null) {
                    graphNodeById.set(String(n.id), n);
                }
            });
        }

        // 2）ECharts 节点索引：id -> series[0].dataIndex
        validNodes.forEach((n, idx) => {
            if (n && n.id !== undefined && n.id !== null) {
                echartsNodeIndexMap.set(String(n.id), idx);
            }
        });

        // 3）边索引 + 邻接表（无向图看关系）
        validLinks.forEach((l, idx) => {
            const s = String(l.source);
            const t = String(l.target);

            echartsLinkIndexList.push({
                source: s,
                target: t,
                index: idx
            });

            if (!adjacencyList.has(s)) adjacencyList.set(s, []);
            if (!adjacencyList.has(t)) adjacencyList.set(t, []);

            adjacencyList.get(s).push({ neighbor: t, linkIndex: idx });
            adjacencyList.get(t).push({ neighbor: s, linkIndex: idx });
        });
        // === 索引和邻接表构建结束 ===


    console.log('[DEBUG] 图谱渲染完成，节点数:', validNodes.length, '连接数:', validLinks.length);
}


// ============ 高亮逻辑：新闻经由词云连接到的相关新闻 ============
function highlightNewsWithWordcloudConnections(newsNodeId) {
    if (!echartsChart) return;
    if (!newsNodeId) return;

    const startId = String(newsNodeId);

    // 先清除之前所有高亮
    try {
        echartsChart.dispatchAction({
            type: 'downplay',
            seriesIndex: 0
        });
    } catch (e) {
        console.warn('[DEBUG] 清除高亮状态失败:', e);
    }

    // 索引还没准备好，就退回默认邻接高亮
    if (
        !echartsNodeIndexMap ||
        echartsNodeIndexMap.size === 0 ||
        !echartsLinkDataList ||
        echartsLinkDataList.length === 0
    ) {
        return;
    }

    const highlightNodeIds = new Set();
    const highlightLinkIdxs = new Set();

    // 起点：当前新闻
    highlightNodeIds.add(startId);

    const firstHopWordcloudIds = new Set();

    // 第 1 跳：新闻 → 所有邻接节点（其中筛出词云节点）
    echartsLinkDataList.forEach(link => {
        if (link.source === startId || link.target === startId) {
            const otherId = link.source === startId ? link.target : link.source;
            highlightNodeIds.add(otherId);
            highlightLinkIdxs.add(link.index);

            const otherNode = graphNodeById.get(otherId);
            if (otherNode && otherNode.type === 'wordcloud') {
                firstHopWordcloudIds.add(otherId);
            }
        }
    });

    // 第 2 跳：词云节点 → 其他新闻节点
    firstHopWordcloudIds.forEach(wcId => {
        echartsLinkDataList.forEach(link => {
            if (link.source === wcId || link.target === wcId) {
                const otherId = link.source === wcId ? link.target : link.source;
                const otherNode = graphNodeById.get(otherId);
                if (otherNode && otherNode.type === 'news') {
                    highlightNodeIds.add(otherId);
                    highlightLinkIdxs.add(link.index);
                }
            }
        });
    });

    // 应用高亮到节点
    highlightNodeIds.forEach(id => {
        const idx = echartsNodeIndexMap.get(id);
        if (idx !== undefined) {
            echartsChart.dispatchAction({
                type: 'highlight',
                seriesIndex: 0,
                dataIndex: idx
            });
        }
    });

    // 应用高亮到边
    highlightLinkIdxs.forEach(idx => {
        echartsChart.dispatchAction({
            type: 'highlight',
            seriesIndex: 0,
            dataIndex: idx
        });
    });
}

/**
 * 从指定新闻节点出发，高亮它自身、相关新闻以及连接路径
 * @param {string|number} newsNodeId
 */
function highlightNewsConnections(newsNodeId) {
    if (!echartsChart) return;
    if (!newsNodeId) return;

    const startId = String(newsNodeId);

    // 索引尚未构建好，直接返回
    if (
        !adjacencyList ||
        adjacencyList.size === 0 ||
        !echartsNodeIndexMap ||
        echartsNodeIndexMap.size === 0
    ) {
        return;
    }

    // 判断是否为新闻节点
    const isNewsId = (id) => {
        const raw = graphNodeById.get(String(id));
        if (!raw) return false;
        return raw.type === 'news' || raw.category === 'News';
    };

    // 清除之前所有高亮（注意：我们会立刻重新高亮当前新闻与关联路径）
    try {
        echartsChart.dispatchAction({
            type: 'downplay',
            seriesIndex: 0
        });
    } catch (e) {
        console.warn('[DEBUG] 清除高亮状态失败:', e);
    }

    // 目标：高亮【当前新闻】+【与其有关联的新闻】+【连接路径】
    // “有关联”定义：从当前新闻出发，在 maxDepth 步以内能到达的“其他新闻节点”（但不允许把别的新闻当中间节点继续扩展）
    const maxDepth = 3;

    const depthMap = new Map();                 // id -> depth
    const parentMap = new Map();                // id -> { prev, edgeIndex }
    const queue = [];

    depthMap.set(startId, 0);
    parentMap.set(startId, null);
    queue.push(startId);

    const relatedNewsIds = new Set();           // 仅收集关联新闻
    const highlightNodeIds = new Set([startId]);
    const highlightLinkIdxs = new Set();

    while (queue.length > 0) {
        const id = queue.shift();
        const depth = depthMap.get(id) || 0;

        // 到达深度上限则不再扩展
        if (depth >= maxDepth) continue;

        // 除起点外，如果当前节点是新闻，则不把它当中间节点继续扩展
        if (depth > 0 && isNewsId(id)) {
            continue;
        }

        const neighbors = adjacencyList.get(id) || [];
        for (const { neighbor, linkIndex } of neighbors) {
            const nbId = String(neighbor);

            // 首次访问
            if (!depthMap.has(nbId)) {
                depthMap.set(nbId, depth + 1);
                parentMap.set(nbId, { prev: id, edgeIndex: linkIndex });
                queue.push(nbId);
            }

            // 如果发现“其他新闻”，记录并把路径上的节点/边加入高亮集合
            if (nbId !== startId && isNewsId(nbId)) {
                relatedNewsIds.add(nbId);

                // 回溯路径：nbId -> ... -> startId
                let cur = nbId;
                while (cur && cur !== startId) {
                    const p = parentMap.get(cur);
                    if (!p) break;

                    highlightNodeIds.add(cur);
                    highlightNodeIds.add(p.prev);
                    if (p.edgeIndex !== undefined && p.edgeIndex !== null) {
                        highlightLinkIdxs.add(p.edgeIndex);
                    }
                    cur = p.prev;
                }
            }
        }
    }

    // 只高亮新闻节点（起点 + 关联新闻），并同时高亮路径边
    // 节点：起点新闻一定高亮；关联新闻高亮
    const newsToHighlight = new Set([startId, ...Array.from(relatedNewsIds)]);
    newsToHighlight.forEach(nodeId => {
        const idx = echartsNodeIndexMap.get(String(nodeId));
        if (idx !== undefined) {
            echartsChart.dispatchAction({
                type: 'highlight',
                seriesIndex: 0,
                dataType: 'node',
                dataIndex: idx
            });
        }
    });

    // 路径边高亮（让你看见“怎么关联”）
    highlightLinkIdxs.forEach(edgeIdx => {
        echartsChart.dispatchAction({
            type: 'highlight',
            seriesIndex: 0,
            dataType: 'edge',
            dataIndex: edgeIdx
        });
    });
}





// ============ 事件处理 ============
function handleChartClick(params) {
    if (params.dataType === 'node') {
        const node = params.data.originalData;
        const mouseX = params.event.event.clientX;
        const mouseY = params.event.event.clientY;

        // 显示详情面板
        showNodeDetail(node, mouseX, mouseY);

        // 根据节点类型展开
        if (!expandedNodes.has(node.id)) {
            switch (node.type) {
                case 'wordcloud':
                    expandWordCloud(node);
                    break;
                case 'category':
                case 'date': // 添加日期节点的展开
                    expandCategory(node);
                    break;
                case 'news':
                    expandNews(node);
                    break;
            }
        }
    }
}

function showNodeDetail(node, x, y) {
    let detailContent = '';
    const contentDiv = document.getElementById('kg-detail-content');

    // 保存节点数据到详情面板
    if (contentDiv) {
        contentDiv.dataset.nodeData = JSON.stringify(node);
    }

    // 根据节点类型生成不同的详情内容
    switch (node.type) {
        case 'wordcloud':
            // 词云节点详情
            detailContent = `
                <div style="color:${node.color}; font-size:20px; margin-bottom:15px;">
                    🌐 ${node.name}
                </div>
                <div style="margin-bottom:10px;">
                    <strong>类型:</strong> ${node.category}词云
                </div>
                <div style="margin-bottom:10px;">
                    <strong>节点类型:</strong> 词云分类节点
                </div>
                <div style="color:#ccc; margin-top:15px; padding:10px; background:rgba(255,255,255,0.1); border-radius:5px;">
                    💡 提示: 双击查看关联的聚合节点
                </div>
            `;
            break;

        case 'aggregate':
            const items = node.properties?.items || [];
            const itemCount = node.properties?.itemCount || 0;
            const projectId = node.properties?.projectId || '未知';
            const aggregateType = node.category || '聚合节点';
            const typeName = getAggregateTypeName(aggregateType);

            detailContent = `
                <div style="color:${node.color}; font-size:18px; margin-bottom:15px;">
                    📦 ${node.name}
                </div>
                <div style="margin-bottom:8px;">
                    <strong>节点类型:</strong> ${typeName}聚合节点
                </div>
                <div style="margin-bottom:8px;">
                    <strong>所属项目ID:</strong> ${projectId}
                </div>
                <div style="margin-bottom:8px;">
                    <strong>包含项数:</strong> ${itemCount} 项
                </div>
                ${items.length > 0 ? `
                    <div style="margin-top:15px; margin-bottom:10px;">
                        <strong>具体内容:</strong>
                    </div>
                    <div style="margin-top:5px; max-height:150px; overflow-y:auto; padding:10px; background:rgba(0,0,0,0.3); border-radius:5px;">
                        ${items.slice(0, 10).map((item, index) =>
                `<div style="padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
                                ${index + 1}. ${item}
                            </div>`
            ).join('')}
                        ${items.length > 10 ?
                        `<div style="color:#ccc; padding:5px 0; text-align:center;">
                                ... 还有 ${items.length - 10} 项未显示
                            </div>` : ''
                    }
                    </div>
                ` : ''}
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button id="view-news-btn" class="kg-detail-btn" data-action="view-news" style="
                        padding:8px 16px;
                        background:#3498db;
                        color:white;
                        border:none;
                        border-radius:4px;
                        cursor:pointer;
                        font-size:14px;
                        flex:1;
                    ">
                        📰 查看对应新闻
                    </button>
                    <button id="view-wordclouds-btn" class="kg-detail-btn" data-action="view-wordclouds" style="
                        padding:8px 16px;
                        background:#9b59b6;
                        color:white;
                        border:none;
                        border-radius:4px;
                        cursor:pointer;
                        font-size:14px;
                        flex:1;
                    ">
                        🌐 查看词云分类
                    </button>
                </div>
                <div style="color:#ccc; margin-top:10px; font-size:12px; text-align:center;">
                    提示：双击聚合节点可直接查看对应新闻
                </div>
            `;
            break;
        case 'news':
            // 新闻节点详情
            const props = node.properties || {};
            const theme = props.theme || '未分类';
            const location = props.location || '未知位置';
            const publishTime = props.publish_time || '未知时间';
            const sourceUrl = props.source_url || '';

            detailContent = `
                <div style="color:${node.color}; font-size:18px; margin-bottom:15px;">
                    📰 ${props.title || node.name}
                </div>
                
                <div style="margin-bottom:8px;">
                    <strong>项目ID:</strong> ${props.id || '未知'}
                </div>
                ${publishTime !== '未知时间' ? `
                    <div style="margin-bottom:8px;">
                        <strong>发布时间:</strong> ${publishTime}
                    </div>
                ` : ''}
                ${theme !== '未分类' ? `
                    <div style="margin-bottom:8px;">
                        <strong>主题:</strong> ${theme}
                    </div>
                ` : ''}
                ${location !== '未知位置' ? `
                    <div style="margin-bottom:8px;">
                        <strong>位置:</strong> ${location}
                    </div>
                ` : ''}
                ${props.pollution_source && props.pollution_source.length > 0 ? `
                    <div style="margin-bottom:8px;">
                        <strong>污染源:</strong> ${props.pollution_source.join(', ')}
                    </div>
                ` : ''}
                ${props.executor && props.executor.length > 0 ? `
                    <div style="margin-bottom:8px;">
                        <strong>执行方:</strong> ${props.executor.join(', ')}
                    </div>
                ` : ''}
                ${sourceUrl ? `
                    <div style="margin-bottom:15px;">
                        <strong>来源:</strong> 
                        <a href="${sourceUrl}" target="_blank" style="color:#4bcffa; text-decoration:underline;">
                            查看原文链接
                        </a>
                    </div>
                ` : ''}
                <div style="color:#ccc; margin-top:15px; padding:10px; background:rgba(255,255,255,0.1); border-radius:5px;">
                    💡 提示: 双击查看详细信息（聚合节点、时间、执行方、措施效果等）
                </div>
            `;
            break;

        case 'combined':
            // 措施效果合并节点详情
            const measures = node.properties?.measures || [];
            const effects = node.properties?.effects || [];
            const totalMeasures = node.properties?.totalMeasures || measures.length;
            const totalEffects = node.properties?.totalEffects || effects.length;

            detailContent = `
                <div style="color:${node.color}; font-size:18px; margin-bottom:15px;">
                    📊 ${node.name || '措施效果'}
                </div>
                <div style="margin-bottom:10px;">
                    <strong>节点类型:</strong> 措施效果合并节点
                </div>
                <div style="margin-bottom:10px;">
                    <strong>所属项目:</strong> ${node.properties?.projectId || '未知'}
                </div>
                
                ${measures.length > 0 ? `
                    <div style="margin-top:15px; margin-bottom:5px;">
                        <div style="color:#feca57; margin-bottom:5px;">🛠️ 治理措施 (${totalMeasures}项):</div>
                        <div style="margin-top:5px; max-height:120px; overflow-y:auto; padding:10px; background:rgba(254,202,87,0.1); border-radius:5px;">
                            ${measures.slice(0, 8).map((measure, index) =>
                `<div style="padding:5px 0; border-bottom:1px solid rgba(254,202,87,0.2);">
                                    ${index + 1}. ${measure}
                                </div>`
            ).join('')}
                            ${measures.length > 8 ?
                        `<div style="color:#ccc; padding:5px 0; text-align:center;">
                                    ... 还有 ${measures.length - 8} 项措施未显示
                                </div>` : ''
                    }
                        </div>
                    </div>
                ` : ''}
                
                ${effects.length > 0 ? `
                    <div style="margin-top:15px;">
                        <div style="color:#1dd1a1; margin-bottom:5px;">📈 效果数据 (${totalEffects}项):</div>
                        <div style="margin-top:5px; max-height:120px; overflow-y:auto; padding:10px; background:rgba(29,209,161,0.1); border-radius:5px;">
                            ${effects.slice(0, 8).map((effect, index) =>
                        `<div style="padding:5px 0; border-bottom:1px solid rgba(29,209,161,0.2);">
                                    ${index + 1}. ${effect}
                                </div>`
                    ).join('')}
                            ${effects.length > 8 ?
                        `<div style="color:#ccc; padding:5px 0; text-align:center;">
                                    ... 还有 ${effects.length - 8} 项效果未显示
                                </div>` : ''
                    }
                        </div>
                    </div>
                ` : ''}
                
                ${measures.length === 0 && effects.length === 0 ? `
                    <div style="color:#ccc; margin-top:10px; padding:10px; background:rgba(255,255,255,0.1); border-radius:5px;">
                        该节点暂无措施效果数据
                    </div>
                ` : ''}
            `;
            break;

        case 'executor':
            // 执行方节点详情
            detailContent = `
                <div style="color:${node.color}; font-size:18px; margin-bottom:15px;">
                    🏢 ${node.name}
                </div>
                <div style="margin-bottom:10px;">
                    <strong>节点类型:</strong> 执行组织/机构
                </div>
                ${node.properties?.projectId ? `
                    <div style="margin-bottom:10px;">
                        <strong>所属项目:</strong> ${node.properties.projectId}
                    </div>
                ` : ''}
                <div style="color:#ccc; margin-top:15px; padding:10px; background:rgba(255,255,255,0.1); border-radius:5px;">
                    执行治理措施的相关组织或机构
                </div>
            `;
            break;

        case 'time':
            const timeName = node.properties?.name || node.name.replace(/^📅\s*/, '').trim();
            const displayName = node.properties?.displayName || `📅 ${timeName}`;

            detailContent = `
        <div style="color:${node.color}; font-size:18px; margin-bottom:15px;">
            ${displayName}
        </div>
        <div style="margin-bottom:8px;">
            <strong>节点类型:</strong> 时间节点
        </div>
        <div style="margin-bottom:8px;">
            <strong>具体日期:</strong> ${timeName}
        </div>
        
        <!-- 操作按钮区域 -->
        <div style="margin-top:20px; margin-bottom:15px; padding:12px; background:rgba(52, 152, 219, 0.1); border-radius:6px;">
            <div style="font-weight:bold; margin-bottom:8px; color:#3498db; font-size:14px;">
                🔍 展开方式选择
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <button onclick="handleTimeNodeAction('${node.id}', 'news', '${timeName}')" 
                        style="padding:10px; background:#2ecc71; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; gap:5px;">
                    <span style="font-size:16px;">📰</span>
                    <div>
                        <div style="font-weight:bold;">查看新闻</div>
                        <div style="font-size:11px; opacity:0.9;">当天发布的新闻</div>
                    </div>
                </button>
                <button onclick="handleTimeNodeAction('${node.id}', 'wordcloud', '${timeName}')" 
                        style="padding:10px; background:#9b59b6; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; gap:5px;">
                    <span style="font-size:16px;">🕒</span>
                    <div>
                        <div style="font-weight:bold;">查看季度</div>
                        <div style="font-size:11px; opacity:0.9;">所属时间词云</div>
                    </div>
                </button>
            </div>
            <div style="margin-top:8px; font-size:11px; color:#ccc; text-align:center;">
                双击节点默认执行第一种操作
            </div>
        </div>
        
        ${node.properties?.projectCount ? `
            <div style="margin-top:10px; padding:8px; background:rgba(46, 204, 113, 0.1); border-radius:4px; font-size:12px;">
                <strong>📊 统计:</strong> 该日期有 ${node.properties.projectCount} 篇新闻
            </div>
        ` : ''}
    `;
            break;

        default:
            // 默认节点详情
            detailContent = `
                <div style="color:${node.color}; font-size:18px; margin-bottom:15px;">
                    ${node.name}
                </div>
                <div style="margin-bottom:8px;">
                    <strong>节点ID:</strong> ${node.id}
                </div>
                <div style="margin-bottom:8px;">
                    <strong>节点类型:</strong> ${node.type || '未知'}
                </div>
                <div style="margin-bottom:8px;">
                    <strong>节点分类:</strong> ${node.category || '未知'}
                </div>
                ${node.properties ? `
                    <div style="margin-top:15px; margin-bottom:5px;">
                        <strong>节点属性:</strong>
                    </div>
                    <div style="max-height:200px; overflow-y:auto; padding:10px; background:rgba(0,0,0,0.3); border-radius:5px; font-size:12px;">
                        ${JSON.stringify(node.properties, null, 2)}
                    </div>
                ` : ''}
            `;
    }

    // 显示详情面板
    showDetailPanel(node, detailContent);
    // 添加按钮事件监听
    setupDetailPanelButtons();
}
// 全局时间节点操作处理函数
window.handleTimeNodeAction = function (nodeId, actionType, timeName) {
    console.log(`[DEBUG] 时间节点操作: ${actionType}, 节点ID: ${nodeId}, 时间: ${timeName}`);

    // 找到节点
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (!node) {
        console.error(`[DEBUG] 找不到节点: ${nodeId}`);
        showError('找不到节点');
        return;
    }

    // 关闭详情面板
    hideDetailPanel();

    // 根据操作类型执行不同展开
    switch (actionType) {
        case 'news':
            expandTimeNode(node);
            break;
        case 'wordcloud':
            expandTimeNodeToWordcloud(node);
            break;
        default:
            console.error(`[DEBUG] 未知操作类型: ${actionType}`);
    }
};
// 设置详情面板按钮事件
function setupDetailPanelButtons() {
    // 移除旧的监听器
    const detailPanel = document.getElementById('kg-detail-panel');
    if (detailPanel) {
        detailPanel.removeEventListener('click', handleDetailButtonClick);
        detailPanel.addEventListener('click', handleDetailButtonClick);
    }
}

// 处理详情面板按钮点击
function handleDetailButtonClick(event) {
    // 检查点击的是否是按钮
    if (event.target.classList.contains('kg-detail-btn') ||
        event.target.closest('.kg-detail-btn')) {

        const button = event.target.classList.contains('kg-detail-btn')
            ? event.target
            : event.target.closest('.kg-detail-btn');

        const action = button.getAttribute('data-action');
        const contentDiv = document.getElementById('kg-detail-content');
        const nodeData = contentDiv?.dataset.nodeData
            ? JSON.parse(contentDiv.dataset.nodeData)
            : null;

        if (!nodeData) {
            console.error('没有找到节点数据');
            return;
        }

        console.log('[DEBUG] 详情面板按钮点击:', action, nodeData);

        switch (action) {
            case 'view-news':
                // 查看对应新闻
                expandAggregateToNews(nodeData);
                hideDetailPanel();
                break;

            case 'view-wordclouds':
                // 查看词云分类
                expandAggregateNodeForWordclouds(nodeData);
                hideDetailPanel();
                break;
        }

        // 阻止事件冒泡
        event.stopPropagation();
    }
}

// 确保在页面加载时设置一次事件监听
document.addEventListener('DOMContentLoaded', function () {
    // 延迟执行，确保详情面板已创建
    setTimeout(() => {
        setupDetailPanelButtons();
    }, 1000);
});

// 辅助函数：获取聚合节点类型名称
function getAggregateTypeName(aggregateType) {
    const typeMap = {
        'LocationAggregate': '位置',
        'ThemeAggregate': '主题',
        'PollutionAggregate': '污染源',
        'TimeAggregate': '时间'
    };
    return typeMap[aggregateType] || aggregateType.replace('Aggregate', '');
}

function getCategoryName(category) {
    const names = {
        'ThemeCategory': '主题分类',
        'LocationRegion': '区域位置',
        'PollutionSource': '污染源',
        'TimePeriod': '时间段'
    };
    return names[category] || category;
}

// ============ UI辅助函数 ============
function showLoading(message) {
    // 可以在这里添加加载提示
    console.log(`⏳ ${message}`);
}

function hideLoading() {
    // 移除加载提示
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function showError(message) {
    showMessage(message, 'error');
}

function showInfo(message) {
    showMessage(message, 'info');
}

function showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: all 0.3s ease;
    `;

    if (type === 'error') {
        messageEl.style.backgroundColor = '#e74c3c';
    } else if (type === 'success') {
        messageEl.style.backgroundColor = '#27ae60';
    } else {
        messageEl.style.backgroundColor = '#3498db';
    }

    messageEl.textContent = message;
    document.body.appendChild(messageEl);

    setTimeout(() => {
        messageEl.style.opacity = '0';
        messageEl.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => messageEl.remove(), 300);
    }, 3000);
}

// ============ 清理和优化函数 ============

function cleanupGraph() {
    console.log('🧹 清理图谱节点...');
    // 清理后重建索引
    rebuildNodeIndex();
    // 保留词云节点和最近展开的分类节点
    const nodesToKeep = new Set();
    const linksToKeep = [];

    // 1. 保留所有词云节点
    graphData.nodes.forEach(node => {
        if (node.type === 'wordcloud') {
            nodesToKeep.add(node.id);
        }
    });

    // 2. 保留最近活动的节点（根据展开时间）
    const recentNodes = Array.from(expandedNodes).slice(-20);
    recentNodes.forEach(nodeId => {
        nodesToKeep.add(nodeId);

        // 找到相关的子节点
        const childLinks = graphData.links.filter(link => link.source === nodeId);
        childLinks.forEach(link => {
            nodesToKeep.add(link.target);
            linksToKeep.push(link);
        });
    });

    // 3. 保留最近的新闻节点及其详细信息
    const recentNews = graphData.nodes
        .filter(node => node.type === 'news')
        .slice(-10);

    recentNews.forEach(newsNode => {
        nodesToKeep.add(newsNode.id);

        // 保留新闻的子节点
        const childLinks = graphData.links.filter(link => link.source === newsNode.id);
        childLinks.forEach(link => {
            nodesToKeep.add(link.target);
            linksToKeep.push(link);
        });
    });

    // 4. 应用清理
    const newNodes = graphData.nodes.filter(node => nodesToKeep.has(node.id));
    const newLinks = graphData.links.filter(link =>
        nodesToKeep.has(link.source) && nodesToKeep.has(link.target)
    );

    // 5. 保留词云到分类的关系
    graphData.links.forEach(link => {
        if (link.relationship === 'CONTAINS' &&
            nodesToKeep.has(link.source) &&
            nodesToKeep.has(link.target)) {
            if (!linksToKeep.some(l => l.source === link.source && l.target === link.target)) {
                linksToKeep.push(link);
            }
        }
    });

    // 合并所有要保留的关系
    const allLinks = [...linksToKeep];
    graphData.links.forEach(link => {
        const exists = allLinks.some(l =>
            l.source === link.source && l.target === link.target && l.relationship === link.relationship
        );
        if (!exists && nodesToKeep.has(link.source) && nodesToKeep.has(link.target)) {
            allLinks.push(link);
        }
    });

    updateGraphData({
        nodes: newNodes,
        links: allLinks
    });

    console.log(`清理后: ${newNodes.length} 个节点, ${allLinks.length} 条关系`);
}

// 更新图谱统计
function updateGraphStats() {
    const nodeCount = graphData.nodes.length;
    const relationshipCount = graphData.links.length;

    // 按类型统计
    const stats = {
        wordclouds: graphData.nodes.filter(n => n.type === 'wordcloud').length,
        categories: graphData.nodes.filter(n => n.type === 'category' || n.type === 'date').length,
        news: graphData.nodes.filter(n => n.type === 'news').length,
        details: graphData.nodes.filter(n => n.type === 'detail' || n.type === 'combined').length
    };

    // 更新UI显示
    const nodeCountEl = document.getElementById('node-count');
    const relationshipCountEl = document.getElementById('relationship-count');

    if (nodeCountEl) nodeCountEl.textContent = nodeCount;
    if (relationshipCountEl) relationshipCountEl.textContent = relationshipCount;

    console.log('📊 图谱统计:', stats);
    return stats;
}

// ============ 搜索功能 ============
async function searchGraph() {
    try {
        const keyword = document.getElementById('search-keyword')?.value.trim();
        if (!keyword) return;

        showLoading(`搜索: ${keyword}`);

        const params = new URLSearchParams();
        params.append('keyword', keyword);

        const response = await fetch(`/api/knowledge-graph/advanced-search?${params}`);
        const result = await response.json();

        if (result.success && result.data) {
            // 转换数据格式
            const searchNodes = result.data.nodes.map(node => ({
                id: node.id || `search_${node.name}`,
                name: node.name,
                category: node.category,
                type: getNodeType(node.category, node.isWordCloud),
                symbolSize: node.isWordCloud ? 40 :
                    node.category === 'Project' || node.category === 'News' ? 25 : 30,
                color: nodeColors[node.category] || '#95a5a6',
                showLabel: !(node.category === 'Project' || node.category === 'News'),
                properties: node.properties || node
            }));

            const searchLinks = result.data.links || [];

            // 更新图表
            updateGraphData({
                nodes: searchNodes,
                links: searchLinks
            });

            showSuccess(`找到 ${searchNodes.length} 个相关节点`);
        }
    } catch (error) {
        console.error('搜索失败:', error);
        showError('搜索失败');
    } finally {
        hideLoading();
    }
}

function getNodeType(category, isWordCloud) {
    if (isWordCloud) return 'wordcloud';

    const typeMap = {
        'Theme': 'category',
        'Location': 'category',
        'Pollution': 'category',
        'Time': 'category',
        'Project': 'news',
        'News': 'news',
        'CombinedContent': 'combined'
    };

    return typeMap[category] || 'detail';
}

// ============ 重置功能 ============
function resetGraph() {
    expandedNodes.clear();
    nodeIndex.clear();      // 清除节点索引
    relationIndex.clear();  // 清除关系索引
    loadWordClouds();
    showSuccess('已重置到初始词云视图');
}

// ============ 事件绑定 ============
function bindAllEvents() {
    // 搜索按钮
    const searchBtn = document.querySelector('.search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchGraph);
    }

    // 重置按钮
    const resetBtn = document.querySelector('.reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetGraph);
    }

    // 搜索框回车
    const searchInput = document.getElementById('search-keyword');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchGraph();
            }
        });
    }

    console.log('✅ 所有事件绑定完成');
}

// ============ 返回主屏幕 ============
// 提供给 knowledge-graph.html 中的 onclick 使用
function handleBackToDashboard() {
    // 如果是通过主大屏跳转过来的，可以尝试先返回上一页
    if (document.referrer && document.referrer.indexOf('/knowledge-graph') === -1) {
        history.back();
    } else {
        // 否则直接跳到主大屏路由
        window.location.href = '/';
        // 如果你的主屏路径不是根路径，而是 index.html 或其它，请改成实际路由，比如：
        // window.location.href = '/index.html';
        // 或 window.location.href = '/dashboard';
    }
}


// ============ 根据新闻ID列表加载新闻节点 ============
/**
 * 根据新闻ID列表加载新闻节点及其关联
 * @param {Array<string>} newsIds - 新闻ID列表
 */
async function loadNewsByIds(newsIds) {
    try {
        if (!newsIds || newsIds.length === 0) {
            console.warn('没有提供新闻ID列表');
            return;
        }

        console.log(`[DEBUG] 开始加载新闻节点，ID列表: ${newsIds.join(', ')}`);
        showLoading(`加载 ${newsIds.length} 篇新闻的知识图谱关联...`);

        const allNodes = [];
        const allLinks = [];
        const loadedNewsIds = new Set();
        const failedIds = [];

        // 辅助函数：处理单个新闻数据
        const processNewsData = (data, projectId) => {
            // 确保projectId是字符串
            const cleanProjectId = String(projectId || '');
            if (!cleanProjectId) {
                console.warn('[DEBUG] 无效的projectId:', projectId);
                return;
            }
            
            // 创建新闻节点
            const newsNode = {
                id: `news_${cleanProjectId}`,
                name: `📰 ${data.project?.title || '无标题'}`,
                category: 'News',
                type: 'news',
                symbolSize: 30,
                color: nodeColors.News,
                showLabel: true,
                properties: {
                    id: cleanProjectId,
                    title: data.project?.title,
                    theme: data.project?.theme,
                    location: data.project?.location,

                    // 统一转成数组：如果后端给的是字符串，包装成单元素数组
                    pollution_source: Array.isArray(data.project?.pollution_source)
                        ? data.project.pollution_source
                        : (data.project?.pollution_source ? [data.project.pollution_source] : []),

                    measure: Array.isArray(data.project?.measure)
                        ? data.project.measure
                        : (data.project?.measure ? [data.project.measure] : []),

                    effect_data: Array.isArray(data.project?.effect_data)
                        ? data.project.effect_data
                        : (data.project?.effect_data ? [data.project.effect_data] : []),

                    executor: Array.isArray(data.project?.executor)
                        ? data.project.executor
                        : (data.project?.executor ? [data.project.executor] : []),

                    source_url: data.project?.source_url,
                    publish_time: data.project?.publish_time
                }

            };

            allNodes.push(newsNode);
            loadedNewsIds.add(cleanProjectId);

            // 添加时间节点
            if (data.time) {
                const timeId = String(data.time.id || cleanProjectId);
                const timeNode = {
                    id: `time_${timeId}`,
                    name: data.time.displayName || `📅 ${data.time.name}`,
                    category: 'TimeNode',
                    type: 'time',
                    symbolSize: 18,
                    color: nodeColors.TimeNode || '#3498db',
                    showLabel: true,
                    properties: data.time
                };
                allNodes.push(timeNode);
                allLinks.push({
                    source: String(newsNode.id),
                    target: String(timeNode.id),
                    relationship: 'PUBLISHED_ON'
                });
            }

            // 添加位置聚合节点
            if (data.locationAggregate) {
                const locNode = createAggregateNode(data.locationAggregate, 'Location');
                allNodes.push(locNode);
                allLinks.push({
                    source: String(newsNode.id),
                    target: String(locNode.id),
                    relationship: 'HAS_LOCATION'
                });
            }

            // 添加主题聚合节点
            if (data.themeAggregate) {
                const themeNode = createAggregateNode(data.themeAggregate, 'Theme');
                allNodes.push(themeNode);
                allLinks.push({
                    source: String(newsNode.id),
                    target: String(themeNode.id),
                    relationship: 'HAS_THEME'
                });
            }

            // 添加污染源聚合节点
            if (data.pollutionAggregate) {
                const pollutionNode = createAggregateNode(data.pollutionAggregate, 'Pollution');
                allNodes.push(pollutionNode);
                allLinks.push({
                    source: String(newsNode.id),
                    target: String(pollutionNode.id),
                    relationship: 'HAS_POLLUTION_SOURCE'
                });
            }

            // 添加执行组织节点
            // 添加执行组织节点（助手多新闻模式下默认不自动展开，避免图太乱）

            if (!assistantMultiNewsMode && data.executors && data.executors.length > 0) {
                const items = data.executors
                    .map(e => (typeof e === 'string' ? e : e?.name))
                    .filter(Boolean);

                if (items.length > 0) {
                    const firstItem = items[0];
                    let displayName = `👥 执行组织: ${String(firstItem).substring(0, 30)}`;
                    if (items.length > 1) {
                        displayName += ` 等${items.length}项`;
                    }

                    const execNode = {
                        id: `executor_${cleanProjectId}`,
                        name: displayName,
                        category: 'Executor',
                        type: 'executor',
                        symbolSize: 16 + Math.min(items.length * 2, 10),
                        color: nodeColors.Executor,
                        showLabel: true,
                        properties: {
                            projectId: cleanProjectId,
                            items,
                            itemCount: items.length,
                            raw: data.executors
                        }
                    };
                    allNodes.push(execNode);
                    allLinks.push({
                        source: String(newsNode.id),
                        target: String(execNode.id),
                        relationship: 'HAS_EXECUTOR'
                    });
                }
            }


            // 添加措施效果合并节点（助手多新闻模式下默认不自动展开，用户需要时再手动展开）
            const measures = data.combinedContent?.measures || data.project?.measure || [];
            const effects = data.combinedContent?.effects || data.project?.effect_data || [];

            if (!assistantMultiNewsMode && (measures.length > 0 || effects.length > 0)) {
                const combinedNode = {
                    id: `combined_${cleanProjectId}`,
                    name: `🔧 措施效果`,
                    category: 'CombinedContent',
                    type: 'combined',
                    symbolSize: 22,
                    color: nodeColors.CombinedContent,
                    showLabel: true,
                    properties: {
                        measure: measures,
                        effect_data: effects
                    }
                };
                allNodes.push(combinedNode);
                allLinks.push({
                    source: String(newsNode.id),
                    target: String(combinedNode.id),
                    relationship: 'HAS_MEASURE_EFFECT'
                });
            }

            

           
        };

        // 遍历每个新闻ID，加载其详细信息
        for (const newsId of newsIds) {
            try {
                // 清理和标准化新闻ID
                const cleanNewsId = String(newsId).trim();
                console.log(`[DEBUG] 尝试加载新闻: ${cleanNewsId}`);
                
                // 调用API获取新闻详情
                let response = await fetch(`/api/knowledge-graph/news-details/${encodeURIComponent(cleanNewsId)}`);
                let result;
                
                if (!response.ok && response.status === 404) {
                    console.warn(`[DEBUG] API请求失败 (404): 可能是Qdrant向量ID，尝试查找对应的news_id`);
                    
                    // 尝试将ID转换为数字（可能是Qdrant向量ID）
                    const numericId = parseInt(cleanNewsId, 10);
                    if (!isNaN(numericId) && numericId > 0) {
                        console.log(`[DEBUG] 尝试通过向量ID查找对应的Project节点: ${numericId}`);
                        
                        // 先尝试通过向量ID查找对应的news_id
                        try {
                            const vectorLookupResponse = await fetch(`/api/knowledge-graph/find-project-by-vector-id/${numericId}`);
                            if (vectorLookupResponse.ok) {
                                const vectorLookupResult = await vectorLookupResponse.json();
                                if (vectorLookupResult.success && vectorLookupResult.newsId) {
                                    console.log(`[DEBUG] 找到对应的news_id: ${vectorLookupResult.newsId}`);
                                    // 使用找到的news_id重新请求
                                    response = await fetch(`/api/knowledge-graph/news-details/${encodeURIComponent(vectorLookupResult.newsId)}`);
                                }
                            }
                        } catch (vectorError) {
                            console.warn(`[DEBUG] 向量ID查找失败:`, vectorError);
                        }
                        
                        // 如果向量查找也失败，尝试直接使用数字ID
                        if (!response.ok) {
                            console.log(`[DEBUG] 尝试直接使用数字ID: ${numericId}`);
                            response = await fetch(`/api/knowledge-graph/news-details/${numericId}`);
                        }
                    }
                }
                
                if (!response.ok) {
                    failedIds.push(cleanNewsId);
                    console.warn(`[DEBUG] 无法加载新闻 ${cleanNewsId}: HTTP ${response.status}`);
                    continue;
                }
                
                result = await response.json();
                console.log(`[DEBUG] API响应:`, { success: result.success, hasData: !!result.data, error: result.error });

                if (result.success && result.data) {
                    const data = result.data;
                    const projectId = data.project?.id || cleanNewsId;
                    processNewsData(data, projectId);
                } else {
                    failedIds.push(cleanNewsId);
                    console.warn(`[DEBUG] 无法加载新闻 ${cleanNewsId}:`, result.error || '未知错误');
                }
            } catch (error) {
                failedIds.push(String(newsId).trim());
                console.error(`[DEBUG] 加载新闻 ${newsId} 失败:`, error);
            }
        }

        console.log(`[DEBUG] 加载完成: 成功 ${loadedNewsIds.size} 个, 失败 ${failedIds.length} 个, 总节点 ${allNodes.length} 个`);

        if (allNodes.length > 0) {
            // 调试：检查节点数据结构
            console.log('[DEBUG] 准备更新图谱数据，节点示例:', allNodes.slice(0, 2).map(n => ({
                id: n.id,
                name: n.name,
                type: n.type,
                category: n.category,
                hasProperties: !!n.properties
            })));
            
            // 更新图谱数据
            updateGraphData({
                nodes: allNodes,
                links: allLinks
            });

            // ⭐ 在助手多新闻模式下：自动为位置 / 主题 / 污染聚合节点展开词云分类
            if (assistantMultiNewsMode) {
                try {
                    const aggregateNodesToExpand = allNodes.filter(node =>
                        node.type === 'aggregate' &&
                        ['LocationAggregate', 'ThemeAggregate', 'PollutionAggregate'].includes(node.category)
                    );

                    console.log('[DEBUG] 助手多新闻模式：自动展开词云分类，聚合节点数:', aggregateNodesToExpand.length);

                    for (const aggNode of aggregateNodesToExpand) {
                        await expandAggregateNodeForWordclouds(aggNode);
                    }
                } catch (e) {
                    console.warn('[DEBUG] 自动展开聚合节点的词云分类失败:', e);
                }
            }

            const successMsg = `成功加载 ${loadedNewsIds.size} 篇新闻的知识图谱关联`;
            const failMsg = failedIds.length > 0
                ? ` (${failedIds.length} 个ID加载失败: ${failedIds.slice(0, 3).join(', ')}${failedIds.length > 3 ? '...' : ''})`
                : '';
            showSuccess(successMsg + failMsg);

            // 重要：不要将节点标记为已展开，这样用户可以点击节点继续展开更多关联
            // 节点已经包含了基础关联（时间、位置、主题等），但点击时仍可以展开更多详细信息
            console.log(
                '[DEBUG] 图谱数据已更新，节点可双击展开。节点类型包括:',
                [...new Set(allNodes.map(n => n.type))].join(', ')
            );

        } else {
            const errorMsg = `未能加载任何新闻节点。已尝试加载 ${newsIds.length} 个新闻ID: ${newsIds.join(', ')}。\n可能原因：\n1. Neo4j中不存在对应的Project节点\n2. 新闻ID格式不匹配\n3. API调用失败\n\n请检查浏览器控制台的详细错误信息。`;
            console.error('[DEBUG]', errorMsg);
            console.error('[DEBUG] 失败的ID列表:', failedIds);
            showError(errorMsg);
        }
    } catch (error) {
        console.error('[DEBUG] 加载新闻节点失败:', error);
        showError('加载新闻节点失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// ============ 页面加载 ============
document.addEventListener('DOMContentLoaded', function () {
    console.log('📄 DOM加载完成，初始化知识图谱');

    // 检查ECharts是否加载
    if (typeof echarts === 'undefined') {
        console.error('❌ ECharts未加载，请先引入ECharts库');
        return;
    }

    // 初始化系统
    initMaritimeKG();

    // 检查URL参数中是否有新闻ID列表
    const urlParams = new URLSearchParams(window.location.search);
    const newsIdsParam = urlParams.get('newsIds');
    const viewModeParam = urlParams.get('viewMode') || urlParams.get('source');

    // ⭐ 如果是助手多新闻模式，标记一下
    if (viewModeParam === 'assistant_multi') {
        assistantMultiNewsMode = true;
        console.log('[DEBUG] 启用助手多新闻模式：仅自动展开词云节点，新闻细节节点由用户手动展开');
    }
    
    if (newsIdsParam) {
        // 解析新闻ID列表（支持逗号分隔）
        const newsIds = newsIdsParam.split(',').map(id => id.trim()).filter(id => id);
        
        if (newsIds.length > 0) {
            console.log(`[DEBUG] 检测到URL参数中的新闻ID列表: ${newsIds.join(', ')}`);
            
            // 确保ECharts图表已初始化
            const checkChartReady = () => {
                if (echartsChart) {
                    console.log('[DEBUG] ECharts图表已就绪，开始加载新闻节点');
                    loadNewsByIds(newsIds);
                } else {
                    console.log('[DEBUG] 等待ECharts图表初始化...');
                    setTimeout(checkChartReady, 100);
                }
            };
            
            // 延迟加载，确保系统初始化完成
            setTimeout(() => {
                checkChartReady();
            }, 500);
        }
    } else {
        console.log('[DEBUG] 未检测到URL参数，加载最新新闻');
    }

    // 暴露函数到全局，便于调试
    window.kgSystem = {
        loadWordClouds,
        searchGraph,
        resetGraph,
        updateGraphData,
        renderGraph,
        loadNewsByIds
    };
});

// ============ 键盘快捷键 ============
document.addEventListener('keydown', function (e) {
    // ESC键关闭详情面板
    if (e.key === 'Escape') {
        hideDetailPanel();
    }

    // Ctrl+R重置图谱
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        resetGraph();
    }

    // Ctrl+F聚焦搜索框
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('search-keyword');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
});