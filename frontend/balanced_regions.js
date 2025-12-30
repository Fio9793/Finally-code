// 平衡的锚点区域数据 - 包含高频、中频和低频重要区域
const BalancedRegions = {
  "Singapore": {
    "aliases": [
      "新加坡",
      "Republic of Singapore",
      "狮城"
    ],
    "coords": {
      "lat": 1.3521,
      "lng": 103.8198
    },
    "type": "country",
    "frequency": "high"
  },
  "Baltic Sea": {
    "aliases": [
      "波罗的海",
      "Baltiyskoye More",
      "Östersjön"
    ],
    "coords": {
      "lat": 58.0,
      "lng": 20.0
    },
    "type": "ocean",
    "frequency": "high"
  },
  "North Sea": {
    "aliases": [
      "北海",
      "Nordsee",
      "Mer du Nord"
    ],
    "coords": {
      "lat": 56.0,
      "lng": 3.0
    },
    "type": "ocean",
    "frequency": "high"
  },
  "Norway": {
    "aliases": [
      "挪威",
      "Kingdom of Norway",
      "Norge"
    ],
    "coords": {
      "lat": 60.472,
      "lng": 8.4689
    },
    "type": "country",
    "frequency": "high"
  },
  "China": {
    "aliases": [
      "中国",
      "People's Republic of China",
      "中华"
    ],
    "coords": {
      "lat": 35.8617,
      "lng": 104.1954
    },
    "type": "country",
    "frequency": "high"
  },
  "Gulf of Mexico": {
    "aliases": [
      "墨西哥湾",
      "Golfo de México",
      "湾海"
    ],
    "coords": {
      "lat": 25.0,
      "lng": -90.0
    },
    "type": "ocean",
    "frequency": "high"
  },
  "Japan": {
    "aliases": [
      "日本",
      "State of Japan",
      "日本国"
    ],
    "coords": {
      "lat": 36.2048,
      "lng": 138.2529
    },
    "type": "country",
    "frequency": "high"
  },
  "Arctic Ocean": {
    "aliases": [
      "北冰洋",
      "Arctic Sea",
      "北极海"
    ],
    "coords": {
      "lat": 82.0,
      "lng": 0.0
    },
    "type": "ocean",
    "frequency": "high"
  },
  "Netherlands": {
    "aliases": [
      "荷兰",
      "Kingdom of the Netherlands",
      "Holland"
    ],
    "coords": {
      "lat": 52.1326,
      "lng": 5.2913
    },
    "type": "country",
    "frequency": "high"
  },
  "United States": {
    "aliases": [
      "美国",
      "USA",
      "美利坚合众国"
    ],
    "coords": {
      "lat": 37.0902,
      "lng": -95.7129
    },
    "type": "country",
    "frequency": "high"
  },
  "India": {
    "aliases": [
      "印度",
      "Republic of India",
      "Bharat"
    ],
    "coords": {
      "lat": 20.5937,
      "lng": 78.9629
    },
    "type": "country",
    "frequency": "high"
  },
  "Canada": {
    "aliases": [
      "加拿大",
      "Dominion of Canada",
      "枫叶之国"
    ],
    "coords": {
      "lat": 56.1304,
      "lng": -106.3468
    },
    "type": "country",
    "frequency": "high"
  },
  "Germany": {
    "aliases": [
      "德国",
      "Federal Republic of Germany",
      "Deutschland"
    ],
    "coords": {
      "lat": 51.1657,
      "lng": 10.4515
    },
    "type": "country",
    "frequency": "high"
  },
  "South Korea": {
    "aliases": [
      "韩国",
      "Republic of Korea",
      "大韩民国"
    ],
    "coords": {
      "lat": 35.9078,
      "lng": 127.7669
    },
    "type": "country",
    "frequency": "high"
  },
  "Denmark": {
    "aliases": [
      "丹麦",
      "Kingdom of Denmark",
      "Danmark"
    ],
    "coords": {
      "lat": 56.2639,
      "lng": 9.5018
    },
    "type": "country",
    "frequency": "high"
  },
  "Mediterranean Sea": {
    "aliases": [
      "地中海",
      "Mediterranean",
      "Mare Nostrum"
    ],
    "coords": {
      "lat": 35.0,
      "lng": 18.0
    },
    "type": "ocean",
    "frequency": "high"
  },
  "Australia": {
    "aliases": [
      "澳大利亚",
      "Commonwealth of Australia",
      "澳洲"
    ],
    "coords": {
      "lat": -25.2744,
      "lng": 133.7751
    },
    "type": "country",
    "frequency": "high"
  },
  "Turkey": {
    "aliases": [
      "土耳其",
      "Republic of Turkey",
      "Türkiye"
    ],
    "coords": {
      "lat": 38.9637,
      "lng": 35.2433
    },
    "type": "country",
    "frequency": "high"
  },
  "Atlantic Ocean": {
    "aliases": [
      "大西洋",
      "Atlantic",
      "Atlantik"
    ],
    "coords": {
      "lat": 15.0,
      "lng": -30.0
    },
    "type": "ocean",
    "frequency": "high"
  },
  "Finland": {
    "aliases": [
      "芬兰",
      "Republic of Finland",
      "Suomi"
    ],
    "coords": {
      "lat": 61.9241,
      "lng": 25.7482
    },
    "type": "country",
    "frequency": "high"
  },
  "Indian Ocean": {
    "aliases": [
      "印度洋",
      "Indischer Ozean",
      "Océan Indien"
    ],
    "coords": {
      "lat": -20.0,
      "lng": 80.0
    },
    "type": "ocean",
    "frequency": "high"
  },
  "Italy": {
    "aliases": [
      "意大利",
      "Italian Republic",
      "Italia"
    ],
    "coords": {
      "lat": 41.8719,
      "lng": 12.5674
    },
    "type": "country",
    "frequency": "high"
  },
  "Pakistan": {
    "aliases": [
      "巴基斯坦",
      "Islamic Republic of Pakistan",
      "پاکستان"
    ],
    "coords": {
      "lat": 30.3753,
      "lng": 69.3451
    },
    "type": "country",
    "frequency": "high"
  },
  "United Kingdom": {
    "aliases": [
      "英国",
      "UK",
      "大不列颠"
    ],
    "coords": {
      "lat": 55.3781,
      "lng": -3.436
    },
    "type": "country",
    "frequency": "high"
  },
  "Philippines": {
    "aliases": [
      "菲律宾",
      "Republic of the Philippines",
      "Pilipinas"
    ],
    "coords": {
      "lat": 12.8797,
      "lng": 121.774
    },
    "type": "country",
    "frequency": "medium"
  },
  "Malaysia": {
    "aliases": [
      "马来西亚",
      "Federation of Malaysia",
      "马来亚"
    ],
    "coords": {
      "lat": 4.2105,
      "lng": 101.9758
    },
    "type": "country",
    "frequency": "medium"
  },
  "Greece": {
    "aliases": [
      "希腊",
      "Hellenic Republic",
      "Ελλάδα"
    ],
    "coords": {
      "lat": 39.0742,
      "lng": 21.8243
    },
    "type": "country",
    "frequency": "medium"
  },
  "Antarctica": {
    "aliases": [
      "南极洲",
      "Antarctic",
      "南極"
    ],
    "coords": {
      "lat": -75.0,
      "lng": 0.0
    },
    "type": "ocean",
    "frequency": "medium"
  },
  "Greenland": {
    "aliases": [
      "格陵兰",
      "Kalaallit Nunaat",
      "Grønland"
    ],
    "coords": {
      "lat": 71.7069,
      "lng": -42.6043
    },
    "type": "country",
    "frequency": "medium"
  },
  "Spain": {
    "aliases": [
      "西班牙",
      "Kingdom of Spain",
      "España"
    ],
    "coords": {
      "lat": 40.4637,
      "lng": -3.7492
    },
    "type": "country",
    "frequency": "medium"
  },
  "Belgium": {
    "aliases": [
      "比利时",
      "Kingdom of Belgium",
      "België"
    ],
    "coords": {
      "lat": 50.5039,
      "lng": 4.4699
    },
    "type": "country",
    "frequency": "medium"
  },
  "Caribbean Sea": {
    "aliases": [
      "加勒比海",
      "Caribbean",
      "Mar Caribe"
    ],
    "coords": {
      "lat": 15.0,
      "lng": -75.0
    },
    "type": "ocean",
    "frequency": "medium"
  },
  "Hong Kong": {
    "aliases": [
      "香港",
      "Hong Kong SAR",
      "香港特别行政区"
    ],
    "coords": {
      "lat": 22.3193,
      "lng": 114.1694
    },
    "type": "country",
    "frequency": "medium"
  },
  "Indonesia": {
    "aliases": [
      "印度尼西亚",
      "Republic of Indonesia",
      "印尼"
    ],
    "coords": {
      "lat": -0.7893,
      "lng": 113.9213
    },
    "type": "country",
    "frequency": "medium"
  },
  "North Atlantic Ocean": {
    "aliases": [
      "北大西洋",
      "North Atlantic",
      "Atlantique Nord"
    ],
    "coords": {
      "lat": 40.0,
      "lng": -40.0
    },
    "type": "ocean",
    "frequency": "medium"
  },
  "Brazil": {
    "aliases": [
      "巴西",
      "Federative Republic of Brazil",
      "Brasil"
    ],
    "coords": {
      "lat": -14.235,
      "lng": -51.9253
    },
    "type": "country",
    "frequency": "medium"
  },
  "France": {
    "aliases": [
      "法国",
      "French Republic",
      "France"
    ],
    "coords": {
      "lat": 46.6034,
      "lng": 1.8883
    },
    "type": "country",
    "frequency": "medium"
  },
  "Panama Canal": {
    "aliases": [
      "巴拿马运河",
      "Canal de Panamá",
      "Panama Waterway"
    ],
    "coords": {
      "lat": 9.0,
      "lng": -79.5
    },
    "type": "ocean",
    "frequency": "medium"
  },
  "Black Sea": {
    "aliases": [
      "黑海",
      "Karadeniz",
      "Чёрное море"
    ],
    "coords": {
      "lat": 43.0,
      "lng": 34.0
    },
    "type": "ocean",
    "frequency": "medium"
  },
  "English Channel": {
    "aliases": [
      "英吉利海峡",
      "La Manche",
      "Ärmelkanal"
    ],
    "coords": {
      "lat": 50.2,
      "lng": -0.5
    },
    "type": "ocean",
    "frequency": "medium"
  },
  "South Africa": {
    "aliases": [
      "南非",
      "Republic of South Africa",
      "RSA"
    ],
    "coords": {
      "lat": -30.5595,
      "lng": 22.9375
    },
    "type": "country",
    "frequency": "medium"
  },
  "Southeast Asia": {
    "aliases": [
      "东南亚",
      "SE Asia",
      "亚洲东南部"
    ],
    "coords": {
      "lat": 10.0,
      "lng": 105.0
    },
    "type": "ocean",
    "frequency": "medium"
  },
  "Ashgabat": {
    "aliases": [
      "阿什哈巴德",
      "Aşgabat",
      "土库曼斯坦首都"
    ],
    "coords": {
      "lat": 37.9601,
      "lng": 58.3261
    },
    "type": "country",
    "frequency": "low"
  },
  "Vanuatu": {
    "aliases": [
      "瓦努阿图",
      "Republic of Vanuatu",
      "Vanuatu"
    ],
    "coords": {
      "lat": -15.3767,
      "lng": 166.9592
    },
    "type": "country",
    "frequency": "low"
  },
  "Pacific Ocean (Hawaiian Islands)": {
    "aliases": [
      "太平洋（夏威夷群岛）",
      "Pacific near Hawaii",
      "ハワイ諸島近海"
    ],
    "coords": {
      "lat": 20.0,
      "lng": -157.0
    },
    "type": "ocean",
    "frequency": "low"
  },
  "Baltic Sea Region": {
    "aliases": [
      "波罗的海区域",
      "Baltics",
      "波罗的海地区"
    ],
    "coords": {
      "lat": 57.0,
      "lng": 22.0
    },
    "type": "ocean",
    "frequency": "low"
  },
  "Bergen": {
    "aliases": [
      "卑尔根",
      "Bergen city",
      "挪威港口城市"
    ],
    "coords": {
      "lat": 60.3913,
      "lng": 5.3221
    },
    "type": "country",
    "frequency": "low"
  },
  "Yokohama Port": {
    "aliases": [
      "横滨港",
      "Port of Yokohama",
      "横浜港"
    ],
    "coords": {
      "lat": 35.4437,
      "lng": 139.638
    },
    "type": "ocean",
    "frequency": "low"
  },
  "Djibouti City": {
    "aliases": [
      "吉布提市",
      "Ville de Djibouti",
      "جيبوتي"
    ],
    "coords": {
      "lat": 11.588,
      "lng": 43.145
    },
    "type": "country",
    "frequency": "low"
  },
  "Liverpool City Region": {
    "aliases": [
      "利物浦城市区域",
      "Liverpool Metro",
      "利物浦地区"
    ],
    "coords": {
      "lat": 53.4084,
      "lng": -2.9916
    },
    "type": "country",
    "frequency": "low"
  },
  "Gulf of Mexico Region": {
    "aliases": [
      "墨西哥湾区域",
      "Gulf Coast",
      "湾海地区"
    ],
    "coords": {
      "lat": 28.0,
      "lng": -89.0
    },
    "type": "ocean",
    "frequency": "low"
  },
  "Federated States of Micronesia": {
    "aliases": [
      "密克罗尼西亚联邦",
      "FSM",
      "ミクロネシア連邦"
    ],
    "coords": {
      "lat": 6.8874,
      "lng": 158.215
    },
    "type": "country",
    "frequency": "low"
  },
  "West Timor Sea": {
    "aliases": [
      "西帝汶海",
      "Timor Sea West",
      "西ティモール海"
    ],
    "coords": {
      "lat": -10.0,
      "lng": 125.0
    },
    "type": "ocean",
    "frequency": "low"
  },
  "Norwegian Shelf": {
    "aliases": [
      "挪威大陆架",
      "Norsk sokkel",
      "挪威架"
    ],
    "coords": {
      "lat": 62.0,
      "lng": 3.0
    },
    "type": "ocean",
    "frequency": "low"
  },
  "Port of Świnoujście": {
    "aliases": [
      "希维诺乌伊希切港",
      "Port Świnoujście",
      "波兰港口"
    ],
    "coords": {
      "lat": 53.9105,
      "lng": 14.2479
    },
    "type": "ocean",
    "frequency": "low"
  },
  "Oregon Coast": {
    "aliases": [
      "俄勒冈海岸",
      "Oregon shoreline",
      "オレゴン海岸"
    ],
    "coords": {
      "lat": 44.0,
      "lng": -124.0
    },
    "type": "ocean",
    "frequency": "low"
  },
  "Coastal British Columbia": {
    "aliases": [
      "不列颠哥伦比亚海岸",
      "BC Coast",
      "BC沿岸"
    ],
    "coords": {
      "lat": 52.0,
      "lng": -128.0
    },
    "type": "ocean",
    "frequency": "low"
  },
  "South Pacific Ocean": {
    "aliases": [
      "南太平洋",
      "South Pacific",
      "南太平洋海"
    ],
    "coords": {
      "lat": -25.0,
      "lng": -130.0
    },
    "type": "ocean",
    "frequency": "low"
  }
};



// 创建别名到英文名称的映射表
const AliasToEnglishMap = {};
Object.keys(BalancedRegions).forEach(englishName => {
  const region = BalancedRegions[englishName];
  // 将英文名称映射到自身
  AliasToEnglishMap[englishName.toLowerCase()] = englishName;
  // 将所有别名映射到英文名称
  region.aliases.forEach(alias => {
    AliasToEnglishMap[alias.toLowerCase()] = englishName;
  });
});

// 在 AliasToEnglishMap 定义后添加缺失的映射
// 添加缺失的中文到英文映射
const additionalMappings = {
    '俄罗斯': 'Russia',
    '北太平洋': 'North Pacific Ocean', 
    '东海': 'East China Sea',
    '南海': 'South China Sea',
    '南大西洋': 'South Atlantic Ocean'
};

// 将缺失的映射添加到主映射表
Object.entries(additionalMappings).forEach(([chinese, english]) => {
    AliasToEnglishMap[chinese.toLowerCase()] = english;
    // 同时确保英文名称也映射到自身
    AliasToEnglishMap[english.toLowerCase()] = english;
});

// 同时需要确保这些区域在 BalancedRegions 中存在，如果不存在需要添加
const missingRegions = {
    "Russia": {
        "aliases": ["俄罗斯", "Russian Federation", "俄国"],
        "coords": { "lat": 61.524, "lng": 105.3188 },
        "type": "country",
        "frequency": "high"
    },
    "North Pacific Ocean": {
        "aliases": ["北太平洋", "North Pacific", "北大平洋"],
        "coords": { "lat": 30.0, "lng": -160.0 },
        "type": "ocean", 
        "frequency": "medium"
    },
    "East China Sea": {
        "aliases": ["东海", "East China Sea", "東海"],
        "coords": { "lat": 30.0, "lng": 125.0 },
        "type": "ocean",
        "frequency": "medium"
    },
    "South China Sea": {
        "aliases": ["南海", "South China Sea", "南中国海"],
        "coords": { "lat": 15.0, "lng": 115.0 },
        "type": "ocean",
        "frequency": "medium"
    },
    "South Atlantic Ocean": {
        "aliases": ["南大西洋", "South Atlantic", "南大西洋海"],
        "coords": { "lat": -30.0, "lng": -20.0 },
        "type": "ocean",
        "frequency": "medium"
    }
};

// 合并缺失的区域到 BalancedRegions
Object.assign(BalancedRegions, missingRegions);

// 统一区域名称函数
function normalizeRegionName(regionName) {
  if (!regionName) return null;
  const normalized = regionName.trim().toLowerCase();
  return AliasToEnglishMap[normalized] || regionName;
}

// 合并到现有的RegionMatcher中
function mergeBalancedRegions() {
    if (typeof RegionMatcher !== 'undefined' && RegionMatcher.regions) {
        // 先备份原始区域
        if (!RegionMatcher.originalRegions) {
            RegionMatcher.originalRegions = {...RegionMatcher.regions};
        }

        // 合并新区域
        Object.assign(RegionMatcher.regions, BalancedRegions);
        
        // 添加统一名称函数到RegionMatcher
        RegionMatcher.normalizeRegionName = normalizeRegionName;
        RegionMatcher.aliasToEnglishMap = AliasToEnglishMap;
        
        console.log(`🎯 成功合并 ${Object.keys(BalancedRegions).length} 个平衡锚点区域`);
        console.log(`📊 频率分布: 高频-${Object.values(BalancedRegions).filter(r => r.frequency === 'high').length}个, 中频-${Object.values(BalancedRegions).filter(r => r.frequency === 'medium').length}个, 低频-${Object.values(BalancedRegions).filter(r => r.frequency === 'low').length}个`);
        console.log(`🔄 创建了 ${Object.keys(AliasToEnglishMap).length} 个别名映射`);

        // 触发地图更新（如果地图已初始化）
        if (typeof updateMapMarkers === 'function') {
            setTimeout(updateMapMarkers, 500);
        }
    } else {
        console.warn('RegionMatcher未定义，等待页面加载...');
        // 如果RegionMatcher还未加载，等待一下再尝试
        setTimeout(mergeBalancedRegions, 1000);
    }
}

// 页面加载完成后自动合并
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mergeBalancedRegions);
} else {
    mergeBalancedRegions();
}

// 提供手动合并函数
window.mergeBalancedRegions = mergeBalancedRegions;

// 调试函数：显示区域频率分布
window.showRegionFrequency = function() {
    if (typeof BalancedRegions !== 'undefined') {
        const highFreq = Object.values(BalancedRegions).filter(r => r.frequency === 'high').length;
        const mediumFreq = Object.values(BalancedRegions).filter(r => r.frequency === 'medium').length;
        const lowFreq = Object.values(BalancedRegions).filter(r => r.frequency === 'low').length;
        console.log(`📊 平衡区域频率分布: 高频${highFreq}个, 中频${mediumFreq}个, 低频${lowFreq}个`);
    }
};