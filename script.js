// 全局变量
let players = [];
let teams = [];
let matchHistory = JSON.parse(localStorage.getItem('matchHistory')) || [];
let currentMatches = [];
let currentEditingPlayer = null;
let currentEditingTeam = null;
let selectedPlayersForTeam = [];

// 主页队伍选择相关变量
let selectedRedTeam = null;
let selectedBlueTeam = null;
let redTeamOrder = [];
let blueTeamOrder = [];

// 当前tab轮次
let currentMatchTab = 1;

// 历史记录分页参数
let historyPage = 1;
const HISTORY_PAGE_SIZE = 5;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，开始初始化...');
    
    // 加载数据
    players = JSON.parse(localStorage.getItem('players')) || [];
    teams = JSON.parse(localStorage.getItem('teams')) || [];
    
    // 确保所有人员都有唯一ID
    players.forEach((player, index) => {
        if (!player.id) {
            player.id = 'player_' + Date.now() + '_' + index;
        }
    });
    
    // 保存修复后的数据
    if (players.length > 0) {
        localStorage.setItem('players', JSON.stringify(players));
    }
    
    // 清理队伍中的无效队员引用
    updateTeamsAfterPlayerEdit();
    
    loadHistory();
    
    // 初始化队伍选择下拉框
    loadTeamSelects();
    
    console.log('初始化完成，已加载', players.length, '名人员，', teams.length, '支队伍');
});

// 添加选手函数
function addPlayer(teamId) {
    console.log('=== 添加选手函数开始 ===');
    console.log('目标队伍ID:', teamId);
    
    // 直接通过ID查找选手输入容器
    const playerInputs = document.getElementById(teamId);
    console.log('选手输入容器:', playerInputs);
    
    if (!playerInputs) {
        console.error('❌ 找不到选手输入容器:', teamId);
        showNotification('找不到选手输入容器！', 'error');
        return;
    }
    
    // 创建新的选手输入行
    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-input';
    
    const playerCount = playerInputs.children.length + 1;
    console.log('当前选手数量:', playerCount);
    
    playerDiv.innerHTML = `
        <span class="player-number">${playerCount}</span>
        <input type="text" placeholder="选手${playerCount}姓名" class="player-name">
        <input type="number" placeholder="实力评分" class="player-score" min="1" max="10">
        <button class="remove-player-btn" onclick="removePlayer(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    // 添加到容器
    playerInputs.appendChild(playerDiv);
    console.log('✅ 成功添加选手，当前选手数量:', playerInputs.children.length);
    console.log('=== 添加选手函数结束 ===');
}

// 删除选手函数
function removePlayer(button) {
    const playerInput = button.parentElement;
    if (!playerInput) {
        console.error('找不到选手输入元素');
        return;
    }
    
    const teamContainer = playerInput.parentElement;
    if (!teamContainer) {
        console.error('找不到队伍容器');
        return;
    }
    
    // 确保至少保留一个选手输入框
    if (teamContainer.children.length > 1) {
        playerInput.remove();
        updatePlayerNumbers(teamContainer);
    } else {
        showNotification('每支队伍至少需要一名选手！', 'warning');
    }
}

// 更新选手编号
function updatePlayerNumbers(teamContainer) {
    const playerInputs = teamContainer.querySelectorAll('.player-input');
    playerInputs.forEach((input, index) => {
        const nameInput = input.querySelector('.player-name');
        const numberSpan = input.querySelector('.player-number');
        
        if (nameInput) {
            nameInput.placeholder = `选手${index + 1}姓名`;
        }
        
        if (numberSpan) {
            numberSpan.textContent = index + 1;
        }
    });
}

// 生成对战名单
function generateMatches() {
    // 验证队伍选择
    if (!selectedRedTeam || !selectedBlueTeam) {
        showNotification('请选择红方和蓝方队伍！', 'error');
        return;
    }
    
    if (redTeamOrder.length < 5 || blueTeamOrder.length < 5) {
        showNotification('每支队伍至少需要5名选手！', 'error');
        return;
    }
    
    if (redTeamOrder.length > 7 || blueTeamOrder.length > 7) {
        showNotification('每支队伍最多只能有7名选手！', 'error');
        return;
    }
    
    // 构建选手数据 - 只使用前5名队员进行轮转
    const redTeam = redTeamOrder.slice(0, 5).map(playerId => {
        const player = players.find(p => p.id === playerId);
        return {
            name: player.name,
            score: player.rating
        };
    });
    
    const blueTeam = blueTeamOrder.slice(0, 5).map(playerId => {
        const player = players.find(p => p.id === playerId);
        return {
            name: player.name,
            score: player.rating
        };
    });
    
    // 生成轮转对战安排
    currentMatches = generateRotationMatches(redTeam, blueTeam);
    
    // 显示对战名单
    displayMatches(currentMatches);
    
    // 计算并显示初始分数
    calculateAndDisplayScores();
    
    showNotification('轮转对战安排生成成功！点击"保存到历史记录"按钮可保存比赛数据。', 'success');
}

// 生成轮转对战安排
function generateRotationMatches(redTeam, blueTeam) {
    const matches = [];
    const maxRounds = 5; // 最多5轮，每轮10分
    const rotationSize = 5; // 固定5人轮转
    
    for (let round = 1; round <= maxRounds; round++) {
        // 计算当前轮次的双打组合
        // 第1轮：1号+2号，第2轮：2号+3号，第3轮：3号+4号，第4轮：4号+5号，第5轮：5号+1号
        const redPlayer1Index = (round - 1) % rotationSize;
        const redPlayer2Index = round % rotationSize;
        const bluePlayer1Index = (round - 1) % rotationSize;
        const bluePlayer2Index = round % rotationSize;
        
        // 确保选手索引在有效范围内（只使用前5名队员）
        const redPlayer1 = redTeam[redPlayer1Index] || redTeam[0];
        const redPlayer2 = redTeam[redPlayer2Index] || redTeam[1] || redTeam[0];
        const bluePlayer1 = blueTeam[bluePlayer1Index] || blueTeam[0];
        const bluePlayer2 = blueTeam[bluePlayer2Index] || blueTeam[1] || blueTeam[0];
        
        matches.push({
            round: round,
            redPlayers: [redPlayer1, redPlayer2],
            bluePlayers: [bluePlayer1, bluePlayer2],
            redPlayerNumbers: [redPlayer1Index + 1, redPlayer2Index + 1],
            bluePlayerNumbers: [bluePlayer1Index + 1, bluePlayer2Index + 1],
            targetScore: round * 10, // 目标分数：第1轮10分，第2轮20分，...，第5轮50分
            redScore: 0, // 当前轮次红方得分
            blueScore: 0, // 当前轮次蓝方得分
            description: `第${round}轮：红方${redPlayer1Index + 1}号+${redPlayer2Index + 1}号 VS 蓝方${bluePlayer1Index + 1}号+${bluePlayer2Index + 1}号`
        });
    }
    
    return matches;
}

// 显示对战名单
function displayMatches(matches) {
    const matchesSection = document.getElementById('matchesSection');
    const matchesContainer = document.getElementById('matchesContainer');
    const tabs = document.querySelectorAll('.match-tab');
    if (!matchesSection || !matchesContainer) {
        console.error('找不到对战显示区域');
        return;
    }
    matchesContainer.innerHTML = '';
    // 高亮当前tab
    tabs.forEach(tab => {
        if (parseInt(tab.getAttribute('data-round')) === currentMatchTab) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    // 只渲染当前tab对应的那一轮
    const match = matches[currentMatchTab - 1];
    if (!match) return;
    const matchCard = document.createElement('div');
    matchCard.className = 'match-card';
    matchCard.setAttribute('data-match-index', currentMatchTab - 1);
    matchCard.innerHTML = `
        <div class="match-header">
            <span class="match-number">第 ${match.round} 轮</span>
            <span class="target-score">目标分数: ${match.targetScore}分</span>
        </div>
        <div class="match-description">
            <p>${match.description}</p>
        </div>
        <div class="match-players">
            <div class="team-info red">
                <div class="team-players">
                    <div class="player-row">
                        <div class="player-info">
                            <div class="player-number-badge">${match.redPlayerNumbers[0]}号</div>
                            <div class="player-name">${match.redPlayers[0].name}</div>
                            <div class="player-score">实力: ${match.redPlayers[0].score}/10</div>
                        </div>
                        <div class="player-info">
                            <div class="player-number-badge">${match.redPlayerNumbers[1]}号</div>
                            <div class="player-name">${match.redPlayers[1].name}</div>
                            <div class="player-score">实力: ${match.redPlayers[1].score}/10</div>
                        </div>
                    </div>
                </div>
                <div class="team-score-input">
                    <label>红方得分:</label>
                    <input type="number" class="score-input red-score-input" min="0" value="${match.redScore}" 
                           onchange="updateMatchScore(${currentMatchTab - 1}, 'red', this.value)" data-match-index="${currentMatchTab - 1}" data-team="red">
                </div>
            </div>
            <div class="vs-badge">VS</div>
            <div class="team-info blue">
                <div class="team-players">
                    <div class="player-row">
                        <div class="player-info">
                            <div class="player-number-badge">${match.bluePlayerNumbers[0]}号</div>
                            <div class="player-name">${match.bluePlayers[0].name}</div>
                            <div class="player-score">实力: ${match.bluePlayers[0].score}/10</div>
                        </div>
                        <div class="player-info">
                            <div class="player-number-badge">${match.bluePlayerNumbers[1]}号</div>
                            <div class="player-name">${match.bluePlayers[1].name}</div>
                            <div class="player-score">实力: ${match.bluePlayers[1].score}/10</div>
                        </div>
                    </div>
                </div>
                <div class="team-score-input">
                    <label>蓝方得分:</label>
                    <input type="number" class="score-input blue-score-input" min="0" value="${match.blueScore}" 
                           onchange="updateMatchScore(${currentMatchTab - 1}, 'blue', this.value)" data-match-index="${currentMatchTab - 1}" data-team="blue">
                </div>
            </div>
        </div>
        <div class="match-result">
            <div class="score-row">
                <span class="round-score">本轮比分: <span class="red-score">${match.redScore}</span> - <span class="blue-score">${match.blueScore}</span></span>
                <span class="total-score">当前总分: <span class="red-total">${getCurrentTotalScore('red', currentMatchTab-1)}</span> - <span class="blue-total">${getCurrentTotalScore('blue', currentMatchTab-1)}</span></span>
            </div>
        </div>
    `;
    matchesContainer.appendChild(matchCard);
    matchesSection.style.display = 'block';
    updateAllScoreInputsMax();
}

function switchMatchTab(tabIndex) {
    currentMatchTab = tabIndex;
    displayMatches(currentMatches);
}

// 更新比赛比分
// 计算当前轮次的最大允许分数
function getMaxAllowedScore(matchIndex, team) {
    if (!currentMatches || matchIndex < 0) return 0;
    
    const match = currentMatches[matchIndex];
    if (!match) return 0;
    
    // 计算到当前轮次为止的总分
    let previousTotal = 0;
    for (let i = 0; i < matchIndex; i++) {
        if (currentMatches[i]) {
            if (team === 'red') {
                previousTotal += currentMatches[i].redScore;
            } else if (team === 'blue') {
                previousTotal += currentMatches[i].blueScore;
            }
        }
    }
    
    // 目标分数减去之前的总分
    const maxAllowed = match.targetScore - previousTotal;
    return Math.max(0, maxAllowed);
}

function updateMatchScore(matchIndex, team, score) {
    if (!currentMatches[matchIndex]) {
        console.error('找不到比赛数据');
        return;
    }
    
    const match = currentMatches[matchIndex];
    const newScore = parseInt(score) || 0;
    
    // 检查分数限制
    const maxAllowed = getMaxAllowedScore(matchIndex, team);
    if (newScore > maxAllowed) {
        showNotification(`${team === 'red' ? '红方' : '蓝方'}第${matchIndex + 1}轮得分不能超过${maxAllowed}分！`, 'error');
        return;
    }
    
    if (team === 'red') {
        match.redScore = newScore;
    } else if (team === 'blue') {
        match.blueScore = newScore;
    }
    
    // 更新显示
    updateMatchDisplay(matchIndex);
    
    // 重新计算总分
    calculateAndDisplayScores();
    
    console.log(`更新第${matchIndex + 1}轮${team === 'red' ? '红方' : '蓝方'}得分: ${newScore}`);
}

// 获取当前总得分
function getCurrentTotalScore(team, currentMatchIndex) {
    if (!currentMatches || currentMatchIndex < 0) return 0;
    
    let total = 0;
    for (let i = 0; i <= currentMatchIndex; i++) {
        if (currentMatches[i]) {
            if (team === 'red') {
                total += currentMatches[i].redScore;
            } else if (team === 'blue') {
                total += currentMatches[i].blueScore;
            }
        }
    }
    return total;
}

// 更新所有输入框的最大值
function updateAllScoreInputsMax() {
    const redInputs = document.querySelectorAll('.red-score-input');
    const blueInputs = document.querySelectorAll('.blue-score-input');
    
    redInputs.forEach(input => {
        const matchIndex = parseInt(input.getAttribute('data-match-index'));
        const maxAllowed = getMaxAllowedScore(matchIndex, 'red');
        input.max = maxAllowed;
        input.placeholder = `最大${maxAllowed}分`;
    });
    
    blueInputs.forEach(input => {
        const matchIndex = parseInt(input.getAttribute('data-match-index'));
        const maxAllowed = getMaxAllowedScore(matchIndex, 'blue');
        input.max = maxAllowed;
        input.placeholder = `最大${maxAllowed}分`;
    });
}

// 更新比赛显示
function updateMatchDisplay(matchIndex) {
    const match = currentMatches[matchIndex];
    if (!match) return;
    
    const matchCard = document.querySelector(`[data-match-index="${matchIndex}"]`);
    if (matchCard) {
        const redScoreSpan = matchCard.querySelector('.red-score');
        const blueScoreSpan = matchCard.querySelector('.blue-score');
        const redTotalSpan = matchCard.querySelector('.red-total');
        const blueTotalSpan = matchCard.querySelector('.blue-total');
        
        if (redScoreSpan) redScoreSpan.textContent = match.redScore;
        if (blueScoreSpan) blueScoreSpan.textContent = match.blueScore;
        if (redTotalSpan) redTotalSpan.textContent = getCurrentTotalScore('red', matchIndex);
        if (blueTotalSpan) blueTotalSpan.textContent = getCurrentTotalScore('blue', matchIndex);
    }
    
    // 更新输入框的最大值
    updateAllScoreInputsMax();
}

// 计算并显示分数
function calculateAndDisplayScores() {
    if (currentMatches.length === 0) return;
    
    const redTotal = currentMatches.reduce((sum, match) => sum + match.redScore, 0);
    const blueTotal = currentMatches.reduce((sum, match) => sum + match.blueScore, 0);
    
    document.getElementById('redTotalScore').textContent = redTotal;
    document.getElementById('blueTotalScore').textContent = blueTotal;
    
    // 显示获胜预测
    const winnerPrediction = document.getElementById('winnerPrediction');
    
    if (redTotal > blueTotal) {
        winnerPrediction.textContent = `🏆 当前领先：红方 (${redTotal} vs ${blueTotal})`;
        winnerPrediction.className = 'winner-prediction red';
    } else if (blueTotal > redTotal) {
        winnerPrediction.textContent = `🏆 当前领先：蓝方 (${blueTotal} vs ${redTotal})`;
        winnerPrediction.className = 'winner-prediction blue';
    } else {
        winnerPrediction.textContent = `🤝 当前比分：平局 (${redTotal} vs ${blueTotal})`;
        winnerPrediction.className = 'winner-prediction tie';
    }
}

// 通过队员ID匹配正式队伍名称
function getRealTeamName(teamMembers) {
    // 尝试通过成员ID匹配正式队伍
    for (const t of teams) {
        if (t.isTemp || /历史记录|导入|示例/.test(t.name)) continue;
        if (t.members.length === teamMembers.length && t.members.every(id => teamMembers.includes(id))) {
            return t.name;
        }
    }
    return '临时队伍';
}

// 保存到历史记录
function saveToHistory(redTeam, blueTeam, matches) {
    // 获取队伍名称
    let redTeamName = '';
    let blueTeamName = '';
    // 优先用正式队伍名
    const redTeamObj = teams.find(t => t.id === selectedRedTeam);
    const blueTeamObj = teams.find(t => t.id === selectedBlueTeam);
    
    if (redTeamObj && !redTeamObj.isTemp) {
        redTeamName = redTeamObj.name;
    } else {
        redTeamName = getRealTeamName(redTeam.map(p => p.id).filter(Boolean));
    }
    if (blueTeamObj && !blueTeamObj.isTemp) {
        blueTeamName = blueTeamObj.name;
    } else {
        blueTeamName = getRealTeamName(blueTeam.map(p => p.id).filter(Boolean));
    }
    
    const historyItem = {
        date: new Date().toLocaleString('zh-CN'),
        redTeam: redTeam,
        blueTeam: blueTeam,
        matches: matches,
        redTotal: matches.reduce((sum, m) => sum + m.redScore, 0),
        blueTotal: matches.reduce((sum, m) => sum + m.blueScore, 0),
        redTeamName: redTeamName,
        blueTeamName: blueTeamName
    };
    matchHistory.unshift(historyItem);
    localStorage.setItem('matchHistory', JSON.stringify(matchHistory));
    loadHistory();
}

// 删除单条历史记录
function deleteHistoryItem(index) {
    if (confirm('确定要删除这条历史记录吗？')) {
        matchHistory.splice(index, 1);
        localStorage.setItem('matchHistory', JSON.stringify(matchHistory));
        loadHistory();
        showNotification('历史记录已删除！', 'success');
    }
}

// 加载历史记录
function loadHistory() {
    const historyContainer = document.getElementById('historyContainer');
    const pagination = document.getElementById('historyPagination');
    if (!historyContainer) return;
    if (!matchHistory || matchHistory.length === 0) {
        historyContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">暂无历史记录</p>';
        if (pagination) pagination.innerHTML = '';
        return;
    }
    // 计算分页
    const total = matchHistory.length;
    const totalPages = Math.ceil(total / HISTORY_PAGE_SIZE);
    if (historyPage > totalPages) historyPage = totalPages;
    if (historyPage < 1) historyPage = 1;
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    const end = Math.min(start + HISTORY_PAGE_SIZE, total);
    // 渲染当前页
    historyContainer.innerHTML = '';
    for (let i = start; i < end; i++) {
        const item = matchHistory[i];
        // 展示时也优先用正式队伍名
        let redName = item.redTeamName;
        let blueName = item.blueTeamName;
        if (!redName || redName === '临时队伍') {
            redName = getRealTeamName((item.redTeam||[]).map(p=>p.id).filter(Boolean));
        }
        if (!blueName || blueName === '临时队伍') {
            blueName = getRealTeamName((item.blueTeam||[]).map(p=>p.id).filter(Boolean));
        }
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        const winner = item.redTotal > item.blueTotal ? '红方' : item.blueTotal > item.redTotal ? '蓝方' : '平局';
        historyItem.innerHTML = `
            <div class="history-header">
                <span class="history-date">${item.date}</span>
                <span class="history-winner">获胜方: ${winner}</span>
                <button class="remove-history-btn" title="删除" onclick="deleteHistoryItem(${i})"><i class='fas fa-trash'></i></button>
            </div>
            <div class="history-teams">
                <span style="color: #e74c3c; font-weight:600;">${redName}</span>
                <span style="margin:0 8px;">VS</span>
                <span style="color: #3498db; font-weight:600;">${blueName}</span>
            </div>
            <div class="history-scores">
                <span style="color: #e74c3c;">${redName}: ${item.redTotal}</span>
                <span style="color: #3498db;">${blueName}: ${item.blueTotal}</span>
            </div>
            <div style="text-align:right;font-size:13px;color:#888;">对战场次: ${item.matches.length} 场</div>
        `;
        historyContainer.appendChild(historyItem);
    }
    // 渲染分页
    if (pagination) {
        pagination.innerHTML = '';
        for (let p = 1; p <= totalPages; p++) {
            const btn = document.createElement('button');
            btn.className = 'history-page-btn' + (p === historyPage ? ' active' : '');
            btn.textContent = p;
            btn.onclick = () => { historyPage = p; loadHistory(); };
            pagination.appendChild(btn);
        }
    }
}

// 获取当前时间
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 设置样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 10px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    `;
    
    // 根据类型设置背景色
    switch(type) {
        case 'success':
            notification.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
            break;
        case 'error':
            notification.style.background = 'linear-gradient(135deg, #f44336 0%, #da190b 100%)';
            break;
        case 'warning':
            notification.style.background = 'linear-gradient(135deg, #ff9800 0%, #e68900 100%)';
            break;
        default:
            notification.style.background = 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)';
    }
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 清空历史记录
function clearHistory() {
    if (confirm('确定要清空所有历史记录吗？')) {
        matchHistory = [];
        localStorage.removeItem('matchHistory');
        loadHistory();
        showNotification('历史记录已清空', 'success');
    }
}

// 导出对战名单
function exportMatches() {
    const matchesSection = document.getElementById('matchesSection');
    if (!matchesSection || matchesSection.style.display === 'none') {
        showNotification('请先生成轮转对战安排！', 'warning');
        return;
    }
    
    // 验证队伍选择
    if (!selectedRedTeam || !selectedBlueTeam) {
        showNotification('请选择红方和蓝方队伍！', 'error');
        return;
    }
    
    // 构建队伍数据
    const redTeam = redTeamOrder.slice(0, 5).map(playerId => {
        const player = players.find(p => p.id === playerId);
        return {
            name: player.name,
            score: player.rating
        };
    });
    
    const blueTeam = blueTeamOrder.slice(0, 5).map(playerId => {
        const player = players.find(p => p.id === playerId);
        return {
            name: player.name,
            score: player.rating
        };
    });
    
    const redTotal = redTeam.reduce((sum, player) => sum + player.score, 0);
    const blueTotal = blueTeam.reduce((sum, player) => sum + player.score, 0);
    
    // 导出文本格式
    let exportText = '五羽轮比 - 轮转对战安排\n';
    exportText += '='.repeat(40) + '\n\n';
    exportText += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
    exportText += `比赛规则: 田忌赛马赛制，每轮10分，先到50分获胜\n\n`;
    
    exportText += '红方队伍 (按出场顺序):\n';
    exportText += '-'.repeat(30) + '\n';
    redTeam.forEach((player, index) => {
        exportText += `${index + 1}号: ${player.name} (实力评分: ${player.score}/10)\n`;
    });
    exportText += `红方平均实力: ${(redTotal / redTeam.length).toFixed(1)}/10\n\n`;
    
    exportText += '蓝方队伍 (按出场顺序):\n';
    exportText += '-'.repeat(30) + '\n';
    blueTeam.forEach((player, index) => {
        exportText += `${index + 1}号: ${player.name} (实力评分: ${player.score}/10)\n`;
    });
    exportText += `蓝方平均实力: ${(blueTotal / blueTeam.length).toFixed(1)}/10\n\n`;
    
    exportText += '轮转对战安排:\n';
    exportText += '='.repeat(30) + '\n';
    
    if (currentMatches.length > 0) {
        currentMatches.forEach((match, index) => {
            exportText += `第${match.round}轮 (目标分数: ${match.targetScore}分)\n`;
            exportText += `红方${match.redPlayerNumbers[0]}号+${match.redPlayerNumbers[1]}号: ${match.redPlayers[0].name} + ${match.redPlayers[1].name}\n`;
            exportText += `蓝方${match.bluePlayerNumbers[0]}号+${match.bluePlayerNumbers[1]}号: ${match.bluePlayers[0].name} + ${match.bluePlayers[1].name}\n`;
            exportText += `本轮比分: ${match.redScore} - ${match.blueScore}\n`;
            exportText += `当前总分: ${getCurrentTotalScore('red', index)} - ${getCurrentTotalScore('blue', index)}\n\n`;
        });
        
        const redTotal = currentMatches.reduce((sum, match) => sum + match.redScore, 0);
        const blueTotal = currentMatches.reduce((sum, match) => sum + match.blueScore, 0);
        const winner = redTotal > blueTotal ? '红方' : blueTotal > redTotal ? '蓝方' : '平局';
        
        exportText += `最终比分: 红方${redTotal} - 蓝方${blueTotal}\n`;
        exportText += `获胜方: ${winner}`;
    } else {
        // 如果没有实际比分，显示预测
        for (let round = 1; round <= 5; round++) {
            const redPlayer1Index = (round - 1) % 5;
            const redPlayer2Index = round % 5;
            const bluePlayer1Index = (round - 1) % 5;
            const bluePlayer2Index = round % 5;
            
            const redPlayer1 = redTeam[redPlayer1Index] || redTeam[0];
            const redPlayer2 = redTeam[redPlayer2Index] || redTeam[1] || redTeam[0];
            const bluePlayer1 = blueTeam[bluePlayer1Index] || blueTeam[0];
            const bluePlayer2 = blueTeam[bluePlayer2Index] || blueTeam[1] || blueTeam[0];
            
            exportText += `第${round}轮 (目标分数: ${round * 10}分)\n`;
            exportText += `红方${redPlayer1Index + 1}号+${redPlayer2Index + 1}号: ${redPlayer1.name} + ${redPlayer2.name}\n`;
            exportText += `蓝方${bluePlayer1Index + 1}号+${bluePlayer2Index + 1}号: ${bluePlayer1.name} + ${bluePlayer2.name}\n\n`;
        }
        
        const winner = redTotal > blueTotal ? '红方' : blueTotal > redTotal ? '蓝方' : '平局';
        exportText += `预测获胜方: ${winner}\n`;
        exportText += `实力对比: 红方${(redTotal / redTeam.length).toFixed(1)} - 蓝方${(blueTotal / blueTeam.length).toFixed(1)}`;
    }
    
    // 创建下载链接
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `五羽轮比_对战安排_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // 同时导出JSON格式用于导入
    const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        redTeam: redTeam,
        blueTeam: blueTeam,
        matches: currentMatches.length > 0 ? currentMatches : null,
        metadata: {
            redTotal: redTotal,
            blueTotal: blueTotal,
            redAverage: (redTotal / redTeam.length).toFixed(1),
            blueAverage: (blueTotal / blueTeam.length).toFixed(1)
        }
    };
    
    const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonA = document.createElement('a');
    jsonA.href = jsonUrl;
    jsonA.download = `五羽轮比_数据_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(jsonA);
    jsonA.click();
    document.body.removeChild(jsonA);
    URL.revokeObjectURL(jsonUrl);
    
    showNotification('轮转对战安排已导出（文本+JSON格式）！', 'success');
}

// 键盘快捷键
document.addEventListener('keydown', function(e) {
    // Ctrl + Enter 生成对战名单
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        generateMatches();
    }
    
    // Ctrl + S 导出对战名单
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        exportMatches();
    }
});

// 添加一些示例数据（可选）
function loadSampleData() {
    if (confirm('是否加载示例数据？')) {
        // 清空现有数据
        clearTeamInputs();
        
        // 创建示例队伍
        const sampleRedTeam = {
            id: 'sample_red_' + Date.now(),
            name: '示例红方队伍',
            color: 'red',
            members: [],
            isTemp: true
        };
        
        const sampleBlueTeam = {
            id: 'sample_blue_' + Date.now(),
            name: '示例蓝方队伍',
            color: 'blue',
            members: [],
            isTemp: true
        };
        
        // 添加红方示例数据（6人）
        const redTeam = ['张三', '李四', '王五', '赵六', '钱七', '孙八'];
        const redScores = [8, 9, 7, 8, 9, 6];
        
        redTeam.forEach((name, index) => {
            const samplePlayer = {
                id: 'sample_red_player_' + Date.now() + '_' + index,
                name: name,
                rating: redScores[index],
                notes: '示例队员'
            };
            players.push(samplePlayer);
            sampleRedTeam.members.push(samplePlayer.id);
        });
        
        // 添加蓝方示例数据（6人）
        const blueTeam = ['周九', '吴十', '郑十一', '王十二', '冯十三', '陈十四'];
        const blueScores = [7, 8, 9, 8, 7, 9];
        
        blueTeam.forEach((name, index) => {
            const samplePlayer = {
                id: 'sample_blue_player_' + Date.now() + '_' + index,
                name: name,
                rating: blueScores[index],
                notes: '示例队员'
            };
            players.push(samplePlayer);
            sampleBlueTeam.members.push(samplePlayer.id);
        });
        
        // 添加示例队伍
        teams.push(sampleRedTeam, sampleBlueTeam);
        
        // 保存数据
        localStorage.setItem('players', JSON.stringify(players));
        localStorage.setItem('teams', JSON.stringify(teams));
        
        // 重新加载数据
        loadPlayers();
        loadTeams();
        loadTeamSelects();
        
        // 自动选择示例队伍
        const redSelect = document.getElementById('redTeamSelect');
        const blueSelect = document.getElementById('blueTeamSelect');
        
        if (redSelect && blueSelect) {
            redSelect.value = teams.length - 2; // 倒数第二个队伍（红方）
            blueSelect.value = teams.length - 1; // 最后一个队伍（蓝方）
            
            // 触发队伍选择事件
            loadTeamPlayers('red');
            loadTeamPlayers('blue');
        }
        
        showNotification('示例数据加载完成！', 'success');
    }
}

// 导入功能相关函数
function showImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.style.display = 'block';
        // 隐藏所有导入区域
        hideAllImportSections();
    }
}

function closeImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.style.display = 'none';
        // 清空输入
        document.getElementById('importText').value = '';
        document.getElementById('importFile').value = '';
    }
}

function hideAllImportSections() {
    document.getElementById('fileImportSection').style.display = 'none';
    document.getElementById('textImportSection').style.display = 'none';
    document.getElementById('historyImportSection').style.display = 'none';
}

function importFromFile() {
    hideAllImportSections();
    document.getElementById('fileImportSection').style.display = 'block';
}

function importFromText() {
    hideAllImportSections();
    document.getElementById('textImportSection').style.display = 'block';
}

function importFromHistory() {
    hideAllImportSections();
    document.getElementById('historyImportSection').style.display = 'block';
    loadHistoryImportList();
}

function loadHistoryImportList() {
    const container = document.getElementById('historyImportList');
    if (!container) return;
    
    if (matchHistory.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">暂无历史记录</p>';
        return;
    }
    
    container.innerHTML = '';
    matchHistory.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-import-item';
        historyItem.onclick = () => importFromHistoryItem(index);
        
        const winner = item.redTotal > item.blueTotal ? '红方' : 
                      item.blueTotal > item.redTotal ? '蓝方' : '平局';
        
        historyItem.innerHTML = `
            <h5>${item.date}</h5>
            <p>红方: ${item.redTotal}分 | 蓝方: ${item.blueTotal}分 | 获胜: ${winner}</p>
            <p>红方${item.redTeam.length}人 | 蓝方${item.blueTeam.length}人</p>
        `;
        
        container.appendChild(historyItem);
    });
}

function importFromHistoryItem(index) {
    const item = matchHistory[index];
    if (!item) {
        showNotification('历史记录不存在！', 'error');
        return;
    }
    
    // 清空现有数据
    clearTeamInputs();
    
    // 创建临时队伍并导入数据
    const tempRedTeam = {
        id: 'history_red_' + Date.now(),
        name: '历史记录红方队伍',
        color: 'red',
        members: [],
        isTemp: true
    };
    
    const tempBlueTeam = {
        id: 'history_blue_' + Date.now(),
        name: '历史记录蓝方队伍',
        color: 'blue',
        members: [],
        isTemp: true
    };
    
    // 为导入的队员创建临时人员记录
    item.redTeam.forEach((player, index) => {
        if (player.name && typeof player.score === 'number') {
            const tempPlayer = {
                id: 'history_red_player_' + Date.now() + '_' + index,
                name: player.name,
                rating: player.score,
                notes: '历史记录队员'
            };
            players.push(tempPlayer);
            tempRedTeam.members.push(tempPlayer.id);
        }
    });
    
    item.blueTeam.forEach((player, index) => {
        if (player.name && typeof player.score === 'number') {
            const tempPlayer = {
                id: 'history_blue_player_' + Date.now() + '_' + index,
                name: player.name,
                rating: player.score,
                notes: '历史记录队员'
            };
            players.push(tempPlayer);
            tempBlueTeam.members.push(tempPlayer.id);
        }
    });
    
    // 添加临时队伍
    teams.push(tempRedTeam, tempBlueTeam);
    
    // 保存数据
    localStorage.setItem('players', JSON.stringify(players));
    localStorage.setItem('teams', JSON.stringify(teams));
    
    // 重新加载数据
    loadPlayers();
    loadTeams();
    loadTeamSelects();
    
    // 自动选择导入的队伍
    const redSelect = document.getElementById('redTeamSelect');
    const blueSelect = document.getElementById('blueTeamSelect');
    
    if (redSelect && blueSelect) {
        redSelect.value = teams.length - 2; // 倒数第二个队伍（红方）
        blueSelect.value = teams.length - 1; // 最后一个队伍（蓝方）
        
        // 触发队伍选择事件
        loadTeamPlayers('red');
        loadTeamPlayers('blue');
    }
    
    // 如果有比赛数据，也导入
    if (item.matches && item.matches.length > 0) {
        currentMatches = [...item.matches];
        displayMatches(currentMatches);
        calculateAndDisplayScores();
    }
    
    closeImportModal();
    showNotification('历史记录导入成功！已创建临时队伍。', 'success');
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            importData(data);
        } catch (error) {
            showNotification('文件格式错误！请选择正确的JSON文件。', 'error');
        }
    };
    reader.readAsText(file);
}

function handleTextImport() {
    const text = document.getElementById('importText').value.trim();
    if (!text) {
        showNotification('请输入要导入的数据！', 'warning');
        return;
    }
    
    try {
        const data = JSON.parse(text);
        importData(data);
    } catch (error) {
        showNotification('JSON格式错误！请检查输入的数据格式。', 'error');
    }
}

function importData(data) {
    // 验证数据格式
    if (!data.redTeam || !data.blueTeam || !Array.isArray(data.redTeam) || !Array.isArray(data.blueTeam)) {
        showNotification('数据格式错误！缺少队伍信息。', 'error');
        return;
    }
    
    // 验证队伍人数
    if (data.redTeam.length < 5 || data.redTeam.length > 7 || 
        data.blueTeam.length < 5 || data.blueTeam.length > 7) {
        showNotification('队伍人数不符合要求！每支队伍需要5-7人。', 'error');
        return;
    }
    
    // 清空现有数据
    clearTeamInputs();
    
    // 创建临时队伍并导入数据
    const tempRedTeam = {
        id: 'temp_red_' + Date.now(),
        name: '导入红方队伍',
        color: 'red',
        members: [],
        isTemp: true
    };
    
    const tempBlueTeam = {
        id: 'temp_blue_' + Date.now(),
        name: '导入蓝方队伍',
        color: 'blue',
        members: [],
        isTemp: true
    };
    
    // 为导入的队员创建临时人员记录
    data.redTeam.forEach((player, index) => {
        if (player.name && typeof player.score === 'number') {
            const tempPlayer = {
                id: 'temp_red_player_' + Date.now() + '_' + index,
                name: player.name,
                rating: player.score,
                notes: '导入的队员'
            };
            players.push(tempPlayer);
            tempRedTeam.members.push(tempPlayer.id);
        }
    });
    
    data.blueTeam.forEach((player, index) => {
        if (player.name && typeof player.score === 'number') {
            const tempPlayer = {
                id: 'temp_blue_player_' + Date.now() + '_' + index,
                name: player.name,
                rating: player.score,
                notes: '导入的队员'
            };
            players.push(tempPlayer);
            tempBlueTeam.members.push(tempPlayer.id);
        }
    });
    
    // 添加临时队伍
    teams.push(tempRedTeam, tempBlueTeam);
    
    // 保存数据
    localStorage.setItem('players', JSON.stringify(players));
    localStorage.setItem('teams', JSON.stringify(teams));
    
    // 重新加载数据
    loadPlayers();
    loadTeams();
    loadTeamSelects();
    
    // 自动选择导入的队伍
    const redSelect = document.getElementById('redTeamSelect');
    const blueSelect = document.getElementById('blueTeamSelect');
    
    if (redSelect && blueSelect) {
        redSelect.value = teams.length - 2; // 倒数第二个队伍（红方）
        blueSelect.value = teams.length - 1; // 最后一个队伍（蓝方）
        
        // 触发队伍选择事件
        loadTeamPlayers('red');
        loadTeamPlayers('blue');
    }
    
    // 如果有比赛数据，也导入
    if (data.matches && Array.isArray(data.matches) && data.matches.length > 0) {
        currentMatches = [...data.matches];
        displayMatches(currentMatches);
        calculateAndDisplayScores();
    }
    
    closeImportModal();
    showNotification('数据导入成功！已创建临时队伍。', 'success');
}

function clearTeamInputs() {
    // 清空队伍选择
    const redSelect = document.getElementById('redTeamSelect');
    const blueSelect = document.getElementById('blueTeamSelect');
    
    if (redSelect) redSelect.value = '';
    if (blueSelect) blueSelect.value = '';
    
    // 隐藏出场顺序区域
    const redOrderSection = document.getElementById('redPlayerOrderSection');
    const blueOrderSection = document.getElementById('bluePlayerOrderSection');
    
    if (redOrderSection) redOrderSection.style.display = 'none';
    if (blueOrderSection) blueOrderSection.style.display = 'none';
    
    // 清空出场顺序
    redTeamOrder = [];
    blueTeamOrder = [];
    selectedRedTeam = null;
    selectedBlueTeam = null;
    
    // 隐藏比赛区域
    const matchesSection = document.getElementById('matchesSection');
    if (matchesSection) matchesSection.style.display = 'none';
    
    // 清空当前比赛数据
    currentMatches = [];
}

// 点击模态框外部关闭
window.onclick = function(event) {
    const modal = document.getElementById('importModal');
    if (event.target === modal) {
        closeImportModal();
    }
    
    const playerModal = document.getElementById('playerModal');
    if (event.target === playerModal) {
        closePlayerModal();
    }
    
    const teamModal = document.getElementById('teamModal');
    if (event.target === teamModal) {
        closeTeamModal();
    }
}

// ==================== 页面导航功能 ====================
function showPage(pageName) {
    // 隐藏所有页面
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => page.classList.remove('active'));
    
    // 移除所有导航按钮的active状态
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));
    
    // 显示目标页面
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // 激活对应的导航按钮
    const targetBtn = document.querySelector(`[onclick="showPage('${pageName}')"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    // 根据页面加载相应数据
    if (pageName === 'main') {
        loadTeamSelects();
    } else if (pageName === 'players') {
        loadPlayers();
    } else if (pageName === 'teams') {
        loadTeams();
    }
}

// ==================== 人员管理功能 ====================

// 加载人员列表
function loadPlayers() {
    const container = document.getElementById('playersContainer');
    if (!container) return;
    
    if (players.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; font-style: italic; grid-column: 1 / -1;">暂无人员信息，请添加人员</p>';
        return;
    }
    
    container.innerHTML = '';
    players.forEach((player, index) => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        
        const ratingText = getRatingText(player.rating);
        
        playerCard.innerHTML = `
            <div class="player-header">
                <h3 class="player-name">${player.name}</h3>
                <span class="player-rating">${ratingText}</span>
            </div>
            ${player.notes ? `<div class="player-notes">${player.notes}</div>` : ''}
            <div class="player-actions">
                <button class="btn-edit" onclick="editPlayer(${index})">
                    <i class="fas fa-edit"></i> 编辑
                </button>
                <button class="btn-delete" onclick="deletePlayer(${index})">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
        `;
        
        container.appendChild(playerCard);
    });
}

// 获取评级文本
function getRatingText(rating) {
    const ratingMap = {
        1: '1级 - 初学者',
        2: '2级 - 入门',
        3: '3级 - 基础',
        4: '4级 - 进阶',
        5: '5级 - 熟练',
        6: '6级 - 良好',
        7: '7级 - 优秀',
        8: '8级 - 专业',
        9: '9级 - 大师',
        10: '10级 - 传奇'
    };
    return ratingMap[rating] || '未知';
}

// 添加新人员
function addNewPlayer() {
    currentEditingPlayer = null;
    document.getElementById('playerName').value = '';
    document.getElementById('playerRating').value = '5';
    document.getElementById('playerNotes').value = '';
    document.getElementById('playerModal').style.display = 'block';
}

// 编辑人员
function editPlayer(index) {
    currentEditingPlayer = index;
    const player = players[index];
    
    document.getElementById('playerName').value = player.name;
    document.getElementById('playerRating').value = player.rating;
    document.getElementById('playerNotes').value = player.notes || '';
    document.getElementById('playerModal').style.display = 'block';
}

// 保存人员
function savePlayer() {
    const name = document.getElementById('playerName').value.trim();
    const rating = parseInt(document.getElementById('playerRating').value);
    const notes = document.getElementById('playerNotes').value.trim();
    
    if (!name) {
        showNotification('请输入人员姓名！', 'error');
        return;
    }
    
    if (currentEditingPlayer !== null) {
        // 编辑现有人员
        players[currentEditingPlayer] = { 
            id: players[currentEditingPlayer].id || 'player_' + Date.now() + '_' + currentEditingPlayer,
            name, 
            rating, 
            notes 
        };
    } else {
        // 添加新人员
        players.push({ 
            id: 'player_' + Date.now() + '_' + players.length,
            name, 
            rating, 
            notes 
        });
    }
    
    // 保存到本地存储
    localStorage.setItem('players', JSON.stringify(players));
    
    // 重新加载人员列表
    loadPlayers();
    
    // 如果是在编辑队员，需要更新相关队伍
    if (currentEditingPlayer !== null) {
        updateTeamsAfterPlayerEdit();
    }
    
    // 关闭模态框
    closePlayerModal();
    
    showNotification(currentEditingPlayer !== null ? '人员信息已更新！' : '人员添加成功！', 'success');
}

// 更新队伍中的队员引用（当队员信息修改后）
function updateTeamsAfterPlayerEdit() {
    let hasChanges = false;
    
    teams.forEach(team => {
        // 检查队伍中的每个队员ID是否仍然有效
        const validMembers = team.members.filter(memberId => {
            const player = players.find(p => p.id === memberId);
            return player !== undefined;
        });
        
        // 如果队员数量有变化，说明有无效的队员ID
        if (validMembers.length !== team.members.length) {
            team.members = validMembers;
            hasChanges = true;
        }
    });
    
    // 如果有变化，保存更新后的队伍数据
    if (hasChanges) {
        localStorage.setItem('teams', JSON.stringify(teams));
        loadTeams();
        
        // 更新主页的队伍选择下拉框
        loadTeamSelects();
        
        showNotification('已自动清理无效的队员引用！', 'info');
    }
}

// 删除人员
function deletePlayer(index) {
    if (confirm('确定要删除这个人员吗？')) {
        const deletedPlayerId = players[index].id;
        
        // 从所有队伍中移除这个队员
        teams.forEach(team => {
            const memberIndex = team.members.indexOf(deletedPlayerId);
            if (memberIndex > -1) {
                team.members.splice(memberIndex, 1);
            }
        });
        
        // 删除队员
        players.splice(index, 1);
        
        // 保存更新后的数据
        localStorage.setItem('players', JSON.stringify(players));
        localStorage.setItem('teams', JSON.stringify(teams));
        
        // 重新加载数据
        loadPlayers();
        loadTeams();
        
        // 更新主页的队伍选择下拉框
        loadTeamSelects();
        
        showNotification('人员已删除，并已从所有队伍中移除！', 'success');
    }
}

// 关闭人员编辑模态框
function closePlayerModal() {
    document.getElementById('playerModal').style.display = 'none';
    currentEditingPlayer = null;
}

// 导出人员数据
function exportPlayers() {
    if (players.length === 0) {
        showNotification('暂无人员数据可导出！', 'warning');
        return;
    }
    
    const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        players: players
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `人员数据_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('人员数据已导出！', 'success');
}

// 导入人员数据
function importPlayers() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (data.players && Array.isArray(data.players)) {
                    players = data.players;
                    localStorage.setItem('players', JSON.stringify(players));
                    
                    // 清理队伍中的无效队员引用
                    updateTeamsAfterPlayerEdit();
                    
                    loadPlayers();
                    showNotification('人员数据导入成功！', 'success');
                } else {
                    showNotification('文件格式错误！', 'error');
                }
            } catch (error) {
                showNotification('文件解析失败！', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ==================== 队伍管理功能 ====================
// 加载队伍列表
function loadTeams() {
    const container = document.getElementById('teamsContainer');
    if (!container) return;
    
    // 只统计正式队伍
    const formalTeams = teams.filter(team => !team.isTemp && !/历史记录|导入|示例/.test(team.name));
    if (formalTeams.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; font-style: italic; grid-column: 1 / -1;">暂无队伍信息，请创建队伍</p>';
        return;
    }
    
    container.innerHTML = '';
    formalTeams.forEach((team, index) => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';
        const memberTags = team.members.map(memberId => {
            const player = players.find(p => p.id === memberId);
            return player ? `<span class="member-tag">${player.name}</span>` : `<span class="member-tag" style="background: #e74c3c; color: white;">未知队员</span>`;
        }).join('');
        teamCard.innerHTML = `
            <div class="team-header">
                <h3 class="team-name" style="color: ${getTeamColor(team.color)}">${team.name}</h3>
                <span class="team-color" style="background: ${getTeamColor(team.color)}; width: 20px; height: 20px; border-radius: 50%;"></span>
            </div>
            <div class="team-members">
                <h4>队员 (${team.members.length}人)</h4>
                <div class="member-list">
                    ${memberTags || '<span style="color: #999;">暂无队员</span>'}
                </div>
            </div>
            <div class="team-actions">
                <button class="btn-edit" onclick="editTeamById('${team.id}')">
                    <i class="fas fa-edit"></i> 编辑
                </button>
                <button class="btn-delete" onclick="deleteTeamById('${team.id}')">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
        `;
        container.appendChild(teamCard);
    });
}

// 辅助函数：通过id编辑/删除队伍
function editTeamById(teamId) {
    const idx = teams.findIndex(t => t.id === teamId);
    if (idx !== -1) editTeam(idx);
}
function deleteTeamById(teamId) {
    const idx = teams.findIndex(t => t.id === teamId);
    if (idx !== -1) deleteTeam(idx);
}

// 获取队伍颜色
function getTeamColor(colorName) {
    const colorMap = {
        red: '#e74c3c',
        blue: '#3498db',
        green: '#2ecc71',
        yellow: '#f1c40f',
        purple: '#9b59b6',
        orange: '#e67e22'
    };
    return colorMap[colorName] || '#95a5a6';
}

// 创建新队伍
function createNewTeam() {
    currentEditingTeam = null;
    selectedPlayersForTeam = [];
    document.getElementById('teamName').value = '';
    document.getElementById('teamColor').value = 'red';
    loadAvailablePlayers();
    document.getElementById('teamModal').style.display = 'block';
}

// 编辑队伍
function editTeam(index) {
    currentEditingTeam = index;
    const team = teams[index];
    
    document.getElementById('teamName').value = team.name;
    document.getElementById('teamColor').value = team.color;
    selectedPlayersForTeam = [...team.members];
    
    loadAvailablePlayers();
    document.getElementById('teamModal').style.display = 'block';
}

// 加载可用人员列表
function loadAvailablePlayers() {
    const availableList = document.getElementById('availablePlayersList');
    const selectedList = document.getElementById('selectedPlayersList');
    
    if (!availableList || !selectedList) return;
    
    // 清空列表
    availableList.innerHTML = '';
    selectedList.innerHTML = '';
    
    // 为每个人员生成唯一ID（如果还没有的话）
    players.forEach((player, index) => {
        if (!player.id) {
            player.id = 'player_' + Date.now() + '_' + index;
        }
    });
    
    // 显示可用人员
    players.forEach(player => {
        if (!selectedPlayersForTeam.includes(player.id)) {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            playerItem.setAttribute('data-player-id', player.id);
            playerItem.onclick = () => selectPlayer(player.id);
            
            playerItem.innerHTML = `
                <div class="player-item-info">
                    <div class="player-item-name">${player.name}</div>
                    <div class="player-item-rating">${getRatingText(player.rating)}</div>
                </div>
            `;
            
            availableList.appendChild(playerItem);
        }
    });
    
    // 显示已选人员，并清理无效的队员ID
    const validSelectedPlayers = [];
    selectedPlayersForTeam.forEach(playerId => {
        const player = players.find(p => p.id === playerId);
        if (player) {
            validSelectedPlayers.push(playerId);
            
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item selected';
            playerItem.setAttribute('data-player-id', player.id);
            playerItem.onclick = () => deselectPlayer(player.id);
            
            playerItem.innerHTML = `
                <div class="player-item-info">
                    <div class="player-item-name">${player.name}</div>
                    <div class="player-item-rating">${getRatingText(player.rating)}</div>
                </div>
            `;
            
            selectedList.appendChild(playerItem);
        }
    });
    
    // 更新选中的队员列表，移除无效的ID
    if (validSelectedPlayers.length !== selectedPlayersForTeam.length) {
        selectedPlayersForTeam.length = 0;
        selectedPlayersForTeam.push(...validSelectedPlayers);
    }
}

// 选择人员到队伍
function selectPlayer(playerId) {
    if (!selectedPlayersForTeam.includes(playerId)) {
        selectedPlayersForTeam.push(playerId);
        loadAvailablePlayers();
    }
}

// 从队伍中移除人员
function deselectPlayer(playerId) {
    const index = selectedPlayersForTeam.indexOf(playerId);
    if (index > -1) {
        selectedPlayersForTeam.splice(index, 1);
        loadAvailablePlayers();
    }
}

// 添加人员到队伍（按钮点击）
function addPlayerToTeam() {
    const availableItems = document.querySelectorAll('#availablePlayersList .player-item');
    if (availableItems.length > 0) {
        const firstItem = availableItems[0];
        const playerId = firstItem.getAttribute('data-player-id');
        selectPlayer(playerId);
    }
}

// 从队伍中移除人员（按钮点击）
function removePlayerFromTeam() {
    const selectedItems = document.querySelectorAll('#selectedPlayersList .player-item');
    if (selectedItems.length > 0) {
        const firstItem = selectedItems[0];
        const playerId = firstItem.getAttribute('data-player-id');
        deselectPlayer(playerId);
    }
}

// 保存队伍
function saveTeam() {
    const name = document.getElementById('teamName').value.trim();
    const color = document.getElementById('teamColor').value;
    
    if (!name) {
        showNotification('请输入队伍名称！', 'error');
        return;
    }
    
    if (selectedPlayersForTeam.length === 0) {
        showNotification('请至少选择一名队员！', 'error');
        return;
    }
    
    const teamData = {
        id: currentEditingTeam !== null ? teams[currentEditingTeam].id : 'team_' + Date.now(),
        name,
        color,
        members: selectedPlayersForTeam
    };
    
    if (currentEditingTeam !== null) {
        // 编辑现有队伍
        teams[currentEditingTeam] = teamData;
    } else {
        // 创建新队伍
        teams.push(teamData);
    }
    
    // 保存到本地存储
    localStorage.setItem('teams', JSON.stringify(teams));
    
    // 重新加载队伍列表
    loadTeams();
    
    // 更新主页的队伍选择下拉框
    loadTeamSelects();
    
    // 关闭模态框
    closeTeamModal();
    
    showNotification(currentEditingTeam !== null ? '队伍信息已更新！' : '队伍创建成功！', 'success');
}

// 删除队伍
function deleteTeam(index) {
    if (confirm('确定要删除这个队伍吗？')) {
        teams.splice(index, 1);
        localStorage.setItem('teams', JSON.stringify(teams));
        loadTeams();
        
        // 更新主页的队伍选择下拉框
        loadTeamSelects();
        
        showNotification('队伍已删除！', 'success');
    }
}

// 关闭队伍编辑模态框
function closeTeamModal() {
    document.getElementById('teamModal').style.display = 'none';
    currentEditingTeam = null;
    selectedPlayersForTeam = [];
}

// 导出队伍数据
function exportTeams() {
    if (teams.length === 0) {
        showNotification('暂无队伍数据可导出！', 'warning');
        return;
    }
    
    const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        teams: teams,
        players: players
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `队伍数据_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('队伍数据已导出！', 'success');
}

// 导入队伍数据
function importTeams() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (data.teams && Array.isArray(data.teams)) {
                    teams = data.teams;
                    localStorage.setItem('teams', JSON.stringify(teams));
                    
                    // 如果同时包含人员数据，也导入
                    if (data.players && Array.isArray(data.players)) {
                        players = data.players;
                        localStorage.setItem('players', JSON.stringify(players));
                    }
                    
                    loadTeams();
                    
                    // 更新主页的队伍选择下拉框
                    loadTeamSelects();
                    
                    showNotification('队伍数据导入成功！', 'success');
                } else {
                    showNotification('文件格式错误！', 'error');
                }
            } catch (error) {
                showNotification('文件解析失败！', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ==================== 主页队伍选择功能 ====================

// 加载队伍选择下拉框
function loadTeamSelects() {
    const redSelect = document.getElementById('redTeamSelect');
    const blueSelect = document.getElementById('blueTeamSelect');
    
    if (!redSelect || !blueSelect) return;
    
    // 清空现有选项
    redSelect.innerHTML = '<option value="">请选择队伍</option>';
    blueSelect.innerHTML = '<option value="">请选择队伍</option>';
    
    // 添加队伍选项（只显示正式队伍）
    teams.forEach((team, index) => {
        // 跳过临时队伍
        if (team.isTemp || /历史记录|导入|示例/.test(team.name)) {
            return;
        }
        
        const option = document.createElement('option');
        option.value = index;
        option.textContent = team.name;
        
        redSelect.appendChild(option.cloneNode(true));
        blueSelect.appendChild(option);
    });
}

// 加载队伍队员到出场顺序
function loadTeamPlayers(teamType) {
    const selectElement = document.getElementById(teamType + 'TeamSelect');
    const orderSection = document.getElementById(teamType + 'PlayerOrderSection');
    const orderList = document.getElementById(teamType + 'PlayerOrderList');
    
    if (!selectElement || !orderSection || !orderList) return;
    
    const selectedIndex = parseInt(selectElement.value);
    
    if (selectedIndex === '' || isNaN(selectedIndex)) {
        orderSection.style.display = 'none';
        if (teamType === 'red') {
            selectedRedTeam = null;
            redTeamOrder = [];
        } else {
            selectedBlueTeam = null;
            blueTeamOrder = [];
        }
        return;
    }
    
    const team = teams[selectedIndex];
    if (!team) return;
    
    // 保存选中的队伍
    if (teamType === 'red') {
        selectedRedTeam = team.id;
        redTeamOrder = [...team.members];
    } else {
        selectedBlueTeam = team.id;
        blueTeamOrder = [...team.members];
    }
    
    // 显示出场顺序区域
    orderSection.style.display = 'block';
    
    // 生成出场顺序列表
    renderPlayerOrder(teamType);
}

// 渲染出场顺序列表
function renderPlayerOrder(teamType) {
    const orderList = document.getElementById(teamType + 'PlayerOrderList');
    const orderArray = teamType === 'red' ? redTeamOrder : blueTeamOrder;
    
    if (!orderList) return;
    
    orderList.innerHTML = '';
    
    // 过滤掉无效的队员ID
    const validOrderArray = orderArray.filter(playerId => {
        const player = players.find(p => p.id === playerId);
        return player !== undefined;
    });
    
    // 更新全局变量
    if (teamType === 'red') {
        redTeamOrder = validOrderArray;
    } else {
        blueTeamOrder = validOrderArray;
    }
    
    validOrderArray.forEach((playerId, index) => {
        const player = players.find(p => p.id === playerId);
        if (!player) return;
        
        const orderItem = document.createElement('div');
        orderItem.className = 'player-order-item';
        
        orderItem.innerHTML = `
            <div class="order-number">${index + 1}</div>
            <div class="player-order-info">
                <div class="player-order-name">${player.name}</div>
                <div class="player-order-rating">${getRatingText(player.rating)}</div>
            </div>
            <div class="order-actions">
                <button class="btn-move-up" onclick="movePlayerUp('${teamType}', ${index})" ${index === 0 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-up"></i>
                </button>
                <button class="btn-move-down" onclick="movePlayerDown('${teamType}', ${index})" ${index === validOrderArray.length - 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        `;
        
        orderList.appendChild(orderItem);
    });
}

// 向上移动选手
function movePlayerUp(teamType, index) {
    const orderArray = teamType === 'red' ? redTeamOrder : blueTeamOrder;
    
    if (index > 0) {
        // 交换位置
        [orderArray[index], orderArray[index - 1]] = [orderArray[index - 1], orderArray[index]];
        
        // 更新对应的全局变量
        if (teamType === 'red') {
            redTeamOrder = [...orderArray];
        } else {
            blueTeamOrder = [...orderArray];
        }
        
        // 重新渲染
        renderPlayerOrder(teamType);
    }
}

// 向下移动选手
function movePlayerDown(teamType, index) {
    const orderArray = teamType === 'red' ? redTeamOrder : blueTeamOrder;
    
    if (index < orderArray.length - 1) {
        // 交换位置
        [orderArray[index], orderArray[index + 1]] = [orderArray[index + 1], orderArray[index]];
        
        // 更新对应的全局变量
        if (teamType === 'red') {
            redTeamOrder = [...orderArray];
        } else {
            blueTeamOrder = [...orderArray];
        }
        
        // 重新渲染
        renderPlayerOrder(teamType);
    }
}

// 手动保存当前比赛到历史记录
function saveCurrentMatch() {
    // 检查是否有比赛数据
    if (!currentMatches || currentMatches.length === 0) {
        showNotification('请先生成轮转对战安排！', 'warning');
        return;
    }
    
    // 检查是否有队伍选择
    if (!selectedRedTeam || !selectedBlueTeam) {
        showNotification('请选择红方和蓝方队伍！', 'error');
        return;
    }
    
    // 检查队伍是否存在
    const redTeamObj = teams.find(t => t.id === selectedRedTeam);
    const blueTeamObj = teams.find(t => t.id === selectedBlueTeam);
    
    if (!redTeamObj || !blueTeamObj) {
        showNotification('选择的队伍不存在！', 'error');
        return;
    }
    
    // 构建队伍数据
    const redTeam = redTeamOrder.slice(0, 5).map(playerId => {
        const player = players.find(p => p.id === playerId);
        return {
            name: player.name,
            score: player.rating,
            id: player.id
        };
    });
    
    const blueTeam = blueTeamOrder.slice(0, 5).map(playerId => {
        const player = players.find(p => p.id === playerId);
        return {
            name: player.name,
            score: player.rating,
            id: player.id
        };
    });
    
    // 保存到历史记录
    saveToHistory(redTeam, blueTeam, currentMatches);
    
    showNotification('比赛数据已保存到历史记录！', 'success');
}

// 保存人员到json文件
function savePlayersToFile() {
    if (!players || players.length === 0) {
        showNotification('暂无人员数据可保存！', 'warning');
        return;
    }
    const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        players: players
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `人员数据_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('人员数据已保存为JSON文件！', 'success');
}

// 保存队伍到json文件
function saveTeamsToFile() {
    if (!teams || teams.length === 0) {
        showNotification('暂无队伍数据可保存！', 'warning');
        return;
    }
    const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        teams: teams,
        players: players
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `队伍数据_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('队伍数据已保存为JSON文件！', 'success');
}

// 导出历史记录
function exportHistory() {
    if (!matchHistory || matchHistory.length === 0) {
        showNotification('暂无历史记录可导出！', 'warning');
        return;
    }
    const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        matchHistory: matchHistory
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `历史记录_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('历史记录已导出为JSON文件！', 'success');
}
// 导入历史记录
function importHistoryFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (data.matchHistory && Array.isArray(data.matchHistory)) {
                    matchHistory = data.matchHistory;
                    localStorage.setItem('matchHistory', JSON.stringify(matchHistory));
                    historyPage = 1;
                    loadHistory();
                    showNotification('历史记录导入成功！', 'success');
                } else {
                    showNotification('文件格式错误！', 'error');
                }
            } catch (error) {
                showNotification('文件解析失败！', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}
// 分页展示历史记录
function loadHistory() {
    const historyContainer = document.getElementById('historyContainer');
    const pagination = document.getElementById('historyPagination');
    if (!historyContainer) return;
    if (!matchHistory || matchHistory.length === 0) {
        historyContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">暂无历史记录</p>';
        if (pagination) pagination.innerHTML = '';
        return;
    }
    // 计算分页
    const total = matchHistory.length;
    const totalPages = Math.ceil(total / HISTORY_PAGE_SIZE);
    if (historyPage > totalPages) historyPage = totalPages;
    if (historyPage < 1) historyPage = 1;
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    const end = Math.min(start + HISTORY_PAGE_SIZE, total);
    // 渲染当前页
    historyContainer.innerHTML = '';
    for (let i = start; i < end; i++) {
        const item = matchHistory[i];
        // 展示时也优先用正式队伍名
        let redName = item.redTeamName;
        let blueName = item.blueTeamName;
        if (!redName || redName === '临时队伍') {
            redName = getRealTeamName((item.redTeam||[]).map(p=>p.id).filter(Boolean));
        }
        if (!blueName || blueName === '临时队伍') {
            blueName = getRealTeamName((item.blueTeam||[]).map(p=>p.id).filter(Boolean));
        }
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        const winner = item.redTotal > item.blueTotal ? '红方' : item.blueTotal > item.redTotal ? '蓝方' : '平局';
        historyItem.innerHTML = `
            <div class="history-header">
                <span class="history-date">${item.date}</span>
                <span class="history-winner">获胜方: ${winner}</span>
                <button class="remove-history-btn" title="删除" onclick="deleteHistoryItem(${i})"><i class='fas fa-trash'></i></button>
            </div>
            <div class="history-teams">
                <span style="color: #e74c3c; font-weight:600;">${redName}</span>
                <span style="margin:0 8px;">VS</span>
                <span style="color: #3498db; font-weight:600;">${blueName}</span>
            </div>
            <div class="history-scores">
                <span style="color: #e74c3c;">${redName}: ${item.redTotal}</span>
                <span style="color: #3498db;">${blueName}: ${item.blueTotal}</span>
            </div>
            <div style="text-align:right;font-size:13px;color:#888;">对战场次: ${item.matches.length} 场</div>
        `;
        historyContainer.appendChild(historyItem);
    }
    // 渲染分页
    if (pagination) {
        pagination.innerHTML = '';
        for (let p = 1; p <= totalPages; p++) {
            const btn = document.createElement('button');
            btn.className = 'history-page-btn' + (p === historyPage ? ' active' : '');
            btn.textContent = p;
            btn.onclick = () => { historyPage = p; loadHistory(); };
            pagination.appendChild(btn);
        }
    }
}