// backend/services/text-processor.js
class TextProcessor {
    constructor() {
        // 简单的中文分词函数（基础版本）
        this.dictionary = this.loadBasicDictionary();
    }

    loadBasicDictionary() {
        // 基础中文词典
        return new Set([
            '海洋', '新闻', '污染', '减排', '环保', '能源', '技术', '航运', 
            '船舶', '港口', '物流', '政策', '法规', '创新', '安全', '经济',
            '发展', '制造', '保护', '塑料', '垃圾', '排放', '气候', '环境',
            '可持续', '绿色', 'LNG', '燃料', '电力', '电动', '混合', '电池'
            // 可以根据需要扩展更多词汇
        ]);
    }

    /**
     * 简单中文分词
     */
    segment(text) {
        if (!text || typeof text !== 'string') return [];
        
        const words = [];
        let currentWord = '';
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            // 如果是中文字符或数字字母
            if (this.isChineseChar(char) || /[a-zA-Z0-9]/.test(char)) {
                currentWord += char;
                
                // 检查当前词是否在词典中
                if (this.dictionary.has(currentWord)) {
                    words.push(currentWord);
                    currentWord = '';
                }
            } else {
                // 非中文字符，结束当前词
                if (currentWord.length > 0) {
                    words.push(currentWord);
                    currentWord = '';
                }
            }
        }
        
        // 处理最后一个词
        if (currentWord.length > 0) {
            words.push(currentWord);
        }
        
        return words.length > 0 ? words : this.fallbackSegment(text);
    }

    /**
     * 降级分词方案：按字符分割
     */
    fallbackSegment(text) {
        return text.split('').filter(char => 
            this.isChineseChar(char) || /[a-zA-Z0-9]/.test(char)
        );
    }

    /**
     * 判断是否为中文字符
     */
    isChineseChar(char) {
        const charCode = char.charCodeAt(0);
        return (charCode >= 0x4E00 && charCode <= 0x9FFF) || 
               (charCode >= 0x3400 && charCode <= 0x4DBF) ||
               (charCode >= 0x20000 && charCode <= 0x2A6DF) ||
               (charCode >= 0x2A700 && charCode <= 0x2B73F) ||
               (charCode >= 0x2B740 && charCode <= 0x2B81F) ||
               (charCode >= 0x2B820 && charCode <= 0x2CEAF) ||
               (charCode >= 0xF900 && charCode <= 0xFAFF) ||
               (charCode >= 0x2F800 && charCode <= 0x2FA1F);
    }

    /**
     * 文本预处理
     */
    preprocessText(text) {
        if (!text) return '';
        
        return text
            .toLowerCase()
            .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ') // 移除标点符号
            .replace(/\s+/g, ' ') // 合并多个空格
            .trim();
    }

    /**
     * 提取关键词
     */
    extractKeywords(text, maxKeywords = 10) {
        const processedText = this.preprocessText(text);
        const words = this.segment(processedText);
        
        // 简单的词频统计
        const wordFreq = {};
        words.forEach(word => {
            if (word.length > 1) { // 只保留长度大于1的词
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
        
        // 按频率排序并返回前N个
        return Object.entries(wordFreq)
            .sort(([,a], [,b]) => b - a)
            .slice(0, maxKeywords)
            .map(([word]) => word);
    }
}

module.exports = new TextProcessor();