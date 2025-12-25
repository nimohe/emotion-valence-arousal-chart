// 颜色映射
const colorMap = {
    "快乐": "#FF6B6B",
    "关心": "#4ECDC4",
    "自信": "#45B7D1",
    "高能量": "#96CEB4",
    "低能量": "#FFEAA7",
    "脆弱": "#DDA0DD",
    "冷漠": "#A9A9A9",
    "害怕": "#FFA726",
    "悲伤": "#6A5ACD",
    "愤怒": "#FF5252",
    "困惑": "#26C6DA"
};

// 初始化变量
let emotionData = null;
let selectedCategory = "all";
let selectedLevel = "all";
let allDataPoints = [];
let isLoading = false;

// 全局变量（用于图表）
let svg, xScale, yScale, tooltip;

// 加载状态显示函数
function showLoadingState(show) {
    isLoading = show;
    const loadingIndicator = document.getElementById('loadingIndicator');
    const chartContainer = document.querySelector('.chart-container');
    const controlsSection = document.querySelector('.controls-section');

    // 安全检查DOM元素是否存在
    if (!loadingIndicator || !chartContainer || !controlsSection) {
        console.warn('加载状态相关的DOM元素未找到');
        return;
    }

    if (show) {
        loadingIndicator.style.display = 'flex';
        chartContainer.style.opacity = '0.3';
        controlsSection.style.opacity = '0.3';
    } else {
        loadingIndicator.style.display = 'none';
        chartContainer.style.opacity = '1';
        controlsSection.style.opacity = '1';
    }
}

// 错误显示函数
function showError(message) {
    const errorContainer = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    // 安全检查DOM元素是否存在
    if (!errorContainer || !errorText) {
        console.warn('错误显示相关的DOM元素未找到，输出到控制台:', message);
        console.error(message);
        return;
    }

    errorText.textContent = message;
    errorContainer.style.display = 'block';
    errorContainer.classList.add('error-shake');

    setTimeout(() => {
        if (errorContainer) {
            errorContainer.classList.remove('error-shake');
        }
    }, 500);

    // 5秒后自动隐藏错误信息
    setTimeout(() => {
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }
    }, 5000);
}

// 数据加载函数
async function loadEmotionData() {
    if (isLoading) return;

    try {
        showLoadingState(true);

        // 尝试从外部JSON文件加载数据
        const response = await fetch('assets/json/data.json');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // 验证数据格式
        if (!Array.isArray(data)) {
            throw new Error('数据格式错误：期望数组格式');
        }

        // 验证数据结构
        const isValid = data.every(item =>
            item.category &&
            item.level &&
            Array.isArray(item.words) &&
            item.words.every(word => word.word && Array.isArray(word.coord) && word.coord.length === 2)
        );

        if (!isValid) {
            throw new Error('数据结构验证失败');
        }

        emotionData = data;
        console.log('成功加载外部JSON数据，共', data.length, '个类别');

        // 更新统计信息
        updateDataStats();

    } catch (error) {
        console.error('加载外部数据失败:', error);
        showError(`数据加载失败: ${error.message}。请检查data.json文件是否存在或网络连接是否正常。`);

        // 使用备用数据（如果存在的话）
        loadFallbackData();

    } finally {
        showLoadingState(false);
    }
}

// 备用数据加载函数（当外部数据加载失败时使用）
function loadFallbackData() {
    console.warn('使用备用数据模式');
    showError('正在使用备用数据模式，功能可能受限');

    // 创建简化的备用数据
    emotionData = [
        {
            "category": "示例",
            "level": "中等 (Medium)",
            "words": [
                { "word": "示例词汇", "coord": [0.0, 0.0] },
                { "word": "数据加载失败", "coord": [-0.5, -0.5] }
            ]
        }
    ];
}

// 数据验证函数
function validateDataStructure(data) {
    if (!Array.isArray(data)) {
        throw new Error('数据必须是数组格式');
    }

    if (data.length === 0) {
        throw new Error('数据不能为空');
    }

    data.forEach((item, index) => {
        if (!item.category || !item.level || !Array.isArray(item.words)) {
            throw new Error(`第${index + 1}项数据结构不完整`);
        }

        item.words.forEach((word, wordIndex) => {
            if (!word.word || !Array.isArray(word.coord) || word.coord.length !== 2) {
                throw new Error(`第${index + 1}项第${wordIndex + 1}个词汇数据不完整`);
            }

            const [x, y] = word.coord;
            if (typeof x !== 'number' || typeof y !== 'number' ||
                x < -1 || x > 1 || y < -1 || y > 1) {
                throw new Error(`词汇"${word.word}"的坐标值超出有效范围[-1, 1]`);
            }
        });
    });

    return true;
}

// 数据统计更新函数
function updateDataStats() {
    if (!emotionData || !Array.isArray(emotionData)) return;

    let totalWords = 0;
    const categories = new Set();
    const levels = new Set();

    emotionData.forEach(category => {
        categories.add(category.category);
        levels.add(category.level);
        totalWords += category.words.length;
    });

    // 更新页面上的统计信息（如果需要的话）
    const statsElement = document.getElementById('dataStats');
    if (statsElement) {
        statsElement.innerHTML = `
                    数据统计：${categories.size}个类别，${levels.size}个等级，${totalWords}个词汇
                `;
    }
}

// 数据重试加载函数
async function retryLoadData() {
    const retryButton = document.getElementById('retryButton');
    if (retryButton) {
        retryButton.disabled = true;
        retryButton.textContent = '重试中...';
    }

    await loadEmotionData();

    if (retryButton) {
        retryButton.disabled = false;
        retryButton.textContent = '重新加载数据';
    }
}

// 图表初始化函数
function initChart() {
    if (!emotionData) {
        console.error('无法初始化图表：数据未加载');
        return;
    }

    // 清除现有图表（如果存在）
    d3.select("#chart").selectAll("*").remove();

    // 设置SVG尺寸和边距
    const margin = { top: 60, right: 20, bottom: 60, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    // 创建SVG容器
    svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // 创建缩放比例尺
    xScale = d3.scaleLinear()
        .domain([-1.2, 1.2])
        .range([0, width]);

    yScale = d3.scaleLinear()
        .domain([-1.2, 1.2])
        .range([height, 0]);

    // 添加坐标轴
    const xAxis = d3.axisBottom(xScale).ticks(10);
    const yAxis = d3.axisLeft(yScale).ticks(10);

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${height / 2})`)
        .call(xAxis);

    svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${width / 2}, 0)`)
        .call(yAxis);

    // 添加坐标轴标签
    svg.append("text")
        .attr("class", "x-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("愉悦度 (Valence)");

    svg.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -40)
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("唤醒度 (Arousal)");

    // 添加象限标签
    const quadrantLabels = [
        { text: "高愉悦/高唤醒", x: width * 0.75, y: height * 0.25, color: "#2E7D32" },
        { text: "低愉悦/高唤醒", x: width * 0.25, y: height * 0.25, color: "#C62828" },
        { text: "低愉悦/低唤醒", x: width * 0.25, y: height * 0.75, color: "#6A1B9A" },
        { text: "高愉悦/低唤醒", x: width * 0.75, y: height * 0.75, color: "#1565C0" }
    ];

    quadrantLabels.forEach(label => {
        svg.append("text")
            .attr("class", "quadrant-label")
            .attr("x", label.x)
            .attr("y", label.y)
            .attr("fill", label.color)
            .attr("text-anchor", "middle")
            .text(label.text);
    });

    // 添加坐标轴中心线
    svg.append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", height / 2)
        .attr("y2", height / 2)
        .attr("stroke", "#999")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "5,5");

    svg.append("line")
        .attr("x1", width / 2)
        .attr("x2", width / 2)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#999")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "5,5");

    // 添加原点标签
    svg.append("text")
        .attr("x", width / 2 + 5)
        .attr("y", height / 2 - 5)
        .attr("fill", "#666")
        .style("font-size", "12px")
        .text("(0,0)");

    // 创建工具提示
    if (!tooltip) {
        tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);
    }
}

// 绘制数据点
function updateChart() {
    // 检查SVG是否已初始化
    if (d3.select("#chart svg").empty()) {
        console.log('SVG未初始化，正在初始化图表...');
        initChart();
    }

    // 检查数据是否可用
    if (!allDataPoints || allDataPoints.length === 0) {
        console.warn('无数据点可用，跳过图表更新');
        return;
    }

    // 筛选数据
    let filteredData = allDataPoints;

    if (selectedCategory !== "all") {
        filteredData = filteredData.filter(d => d.category === selectedCategory);
    }

    if (selectedLevel !== "all") {
        filteredData = filteredData.filter(d => d.level === selectedLevel);
    }

    // 更新数据点计数
    const totalPointsElement = document.getElementById("totalPoints");
    const visiblePointsElement = document.getElementById("visiblePoints");

    if (totalPointsElement) {
        totalPointsElement.textContent = allDataPoints.length;
    }
    if (visiblePointsElement) {
        visiblePointsElement.textContent = filteredData.length;
    }

    // 绑定数据
    const points = svg.selectAll(".emotion-point")
        .data(filteredData, d => d.word + d.category + d.level);

    // 移除旧的点
    points.exit().remove();

    // 添加新的点
    const newPoints = points.enter()
        .append("circle")
        .attr("class", "emotion-point")
        .attr("r", 6)
        .attr("cx", d => xScale(d.coord[0]))
        .attr("cy", d => yScale(d.coord[1]))
        .attr("fill", d => colorMap[d.category])
        .attr("opacity", 0.8)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer");

    // 合并新旧点
    const allPoints = newPoints.merge(points);

    // 添加交互效果
    allPoints
        .on("mouseover", function (event, d) {
            // 高亮当前点
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 10)
                .attr("opacity", 1);

            // 显示工具提示
            if (tooltip) {
                tooltip
                    .style("opacity", 0.9)
                    .html(`
                            <strong>${d.word}</strong><br/>
                            类别: ${d.category}<br/>
                            强度: ${d.level}<br/>
                            坐标: [${d.coord[0].toFixed(2)}, ${d.coord[1].toFixed(2)}]<br/>
                            愉悦度: ${d.coord[0] > 0 ? "正面" : "负面"}<br/>
                            唤醒度: ${d.coord[1] > 0 ? "高唤醒" : "低唤醒"}
                        `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            }

            // 更新选中点信息
            const selectedPointElement = document.getElementById("selectedPoint");
            if (selectedPointElement) {
                selectedPointElement.textContent = `${d.word} (${d.category})`;
            }
        })
        .on("mouseout", function () {
            // 恢复点大小
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 6)
                .attr("opacity", 0.8);

            // 隐藏工具提示
            if (tooltip) {
                tooltip
                    .style("opacity", 0);
            }
        });
}

// 初始化类别筛选器
function initCategoryFilter() {
    const categoryFilter = document.getElementById("categoryFilter");

    // 检查DOM元素是否存在
    if (!categoryFilter) {
        console.error('找不到categoryFilter元素');
        return;
    }

    const categories = ["all", ...Object.keys(colorMap)];
    const categoryNames = {
        "all": "全部",
        "快乐": "快乐",
        "关心": "关心",
        "自信": "自信",
        "高能量": "高能量",
        "低能量": "低能量",
        "脆弱": "脆弱",
        "冷漠": "冷漠",
        "害怕": "害怕",
        "悲伤": "悲伤",
        "愤怒": "愤怒",
        "困惑": "困惑"
    };

    categories.forEach(category => {
        const button = document.createElement("button");
        button.className = `category-btn ${category === "all" ? "active" : ""}`;
        button.textContent = categoryNames[category];
        button.dataset.category = category;
        button.style.borderColor = category === "all" ? "#4a6fa5" : colorMap[category] || "#ddd";

        button.addEventListener("click", function () {
            // 更新选中状态
            document.querySelectorAll(".category-btn").forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");

            // 更新筛选
            selectedCategory = this.dataset.category;
            updateChart();
        });

        categoryFilter.appendChild(button);
    });
}

// 初始化强度筛选器
function initLevelFilter() {
    const levelButtons = document.querySelectorAll(".level-btn");

    // 检查DOM元素是否存在
    if (!levelButtons || levelButtons.length === 0) {
        console.error('找不到.level-btn元素');
        return;
    }

    levelButtons.forEach(button => {
        button.addEventListener("click", function () {
            // 更新选中状态
            document.querySelectorAll(".level-btn").forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");

            // 更新筛选
            selectedLevel = this.dataset.level;
            updateChart();
        });
    });
}

// 初始化图例
function initLegend() {
    const legend = document.getElementById("legend");

    // 检查DOM元素是否存在
    if (!legend) {
        console.error('找不到legend元素');
        return;
    }

    // 清空现有图例内容
    legend.innerHTML = '';

    Object.entries(colorMap).forEach(([category, color]) => {
        const legendItem = document.createElement("div");
        legendItem.className = "legend-item";
        legendItem.innerHTML = `
                    <div class="legend-color" style="background-color: ${color};"></div>
                    <span>${category}</span>
                `;
        legend.appendChild(legendItem);
    });
}



// 修改后的数据提取和初始化函数
function processEmotionData() {
    // 检查数据是否已加载
    if (!emotionData || !Array.isArray(emotionData)) {
        console.error('情绪数据未加载或格式错误');
        showError('数据未正确加载，请重新尝试');
        return;
    }

    // 重置数据点数组
    allDataPoints = [];

    // 提取所有数据点并扁平化处理
    emotionData.forEach(categoryData => {
        categoryData.words.forEach(wordData => {
            allDataPoints.push({
                ...wordData,
                category: categoryData.category,
                level: categoryData.level
            });
        });
    });

    // 现在初始化图表
    initChart();
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", async function () {
    // 首先加载数据
    await loadEmotionData();

    // 数据加载完成后再初始化其他组件
    if (emotionData) {
        processEmotionData();
        initCategoryFilter();
        initLevelFilter();
        initLegend();
        updateChart();
    }
});