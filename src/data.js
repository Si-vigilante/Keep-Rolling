export const asset = (name) => `./Assets/${name}`;

export const navItems = [
  { id: "ai", label: "AI任务拆解" },
  { id: "tasks", label: "任务选择" },
  { id: "todo", label: "待办管理" },
  { id: "review", label: "任务回顾" },
  { id: "cards", label: "卡片收藏" },
];

export const beetles = {
  king: asset("透明螂王.png"),
  worker: asset("透明小二螂.png"),
  board: asset("透明看板螂.png"),
  reader: asset("透明读书螂.png"),
  ice: asset("透明冰螂.png"),
  cleaner: asset("透明保洁螂.png"),
};

export const tasks = [
  {
    id: 1,
    name: "沙漠小屋的秘密",
    owner: "任务A",
    time: "01:23:46",
    status: "running",
    detail: ["整理补给清单", "找到发光的金球", "把路径标记在地图上", "记录发现的花朵"],
    reward: "金色沙漠卡",
  },
  {
    id: 2,
    name: "绿洲小径巡查",
    owner: "任务B",
    time: "暂停中",
    status: "paused",
    detail: ["检查小桥木板", "清点叶片标记", "向看板螂汇报"],
    reward: "勇气叶片",
  },
  {
    id: 3,
    name: "树屋资料整理",
    owner: "任务C",
    time: "待开始",
    status: "pending",
    detail: ["归档任务记录", "补全卡牌说明", "生成回顾报告"],
    reward: "读书螂贴纸",
  },
  {
    id: 4,
    name: "花园清扫",
    owner: "任务D",
    time: "待开始",
    status: "pending",
    detail: ["清理落叶", "擦亮任务牌", "确认完成签名"],
    reward: "保洁勋章",
  },
];

export const todos = [
  { id: 1, name: "任务名：晨间收集", done: false },
  { id: 2, name: "任务名：整理背包", done: true },
  { id: 3, name: "任务名：地图标注", done: false },
  { id: 4, name: "任务名：提交记录", done: false },
];

export const cards = [
  {
    id: 9,
    date: "2026.05.25 21:26",
    title: "初援有功",
    character: beetles.king,
    note: "这是造物主第一次成功完成任务后获得的纪念卡。微小的努力化作第一份馈赠，唤醒了事克郎部落的希望。虽然王国仍被干旱笼罩，但从这一刻起，昆虫们知道：援助已经抵达，复苏并非遥不可及。",
    place: "事克郎部落 · 初始营地",
    rarity: 5,
    love: "99%",
  },
  {
    id: 10,
    date: "2026.05.25 21:42",
    title: "粪球满仓",
    character: beetles.worker,
    note: "完成任务后，事克郎部落终于迎来了一次丰厚补给。圆滚滚的粪球被整齐堆进仓库，原本空荡的储备间重新变得充实起来。小小的完成，也能变成王国赖以生存的大大能量。",
    place: "金色沙漠 · 事克郎物资库",
    rarity: 4,
    love: "96%",
  },
  {
    id: 1,
    date: "2026.5.1",
    title: "沙漠小屋的秘密",
    character: beetles.reader,
    note: "在金色沙漠中发现的隐秘小屋，树下有温暖的灯光和花朵。",
    place: "金色沙漠 · 绿洲小径",
    rarity: 5,
    love: "98%",
  },
  {
    id: 2,
    date: "2026.5.1",
    title: "守护树屋",
    character: beetles.king,
    note: "螂王在树屋前完成了今日巡查。",
    place: "王国树屋",
    rarity: 4,
    love: "92%",
  },
  {
    id: 3,
    date: "2026.5.1",
    title: "冰晶任务",
    character: beetles.ice,
    note: "冰螂带回了一枚清澈的蓝色圆石。",
    place: "冰蓝山谷",
    rarity: 5,
    love: "96%",
  },
  {
    id: 4,
    date: "2026.5.1",
    title: "清扫完成",
    character: beetles.cleaner,
    note: "保洁螂把任务板擦得亮闪闪。",
    place: "任务大厅",
    rarity: 3,
    love: "88%",
  },
  {
    id: 5,
    date: "2026.5.1",
    title: "看板更新",
    character: beetles.board,
    note: "看板螂给大家更新了今日任务。",
    place: "公告木台",
    rarity: 4,
    love: "93%",
  },
  {
    id: 6,
    date: "2026.5.1",
    title: "小路启程",
    character: beetles.worker,
    note: "小二螂推着泥球，沿着小径开始新旅程。",
    place: "沙地小路",
    rarity: 4,
    love: "90%",
  },
  {
    id: 7,
    date: "2026.5.1",
    title: "金球闪耀",
    character: asset("Golden Dung Ball.jpg"),
    note: "奖励球在阳光下发光。",
    place: "沙漠中心",
    rarity: 5,
    love: "99%",
  },
  {
    id: 8,
    date: "2026.5.1",
    title: "任务手札",
    character: beetles.reader,
    note: "一本写满计划和回顾的小册子。",
    place: "读书角",
    rarity: 3,
    love: "86%",
  },
];

export const achievements = [
  { title: "坚持就是胜利", desc: "连续签到100天", progress: "已完成58/100" },
  { title: "收集爱好者", desc: "收集稀有物品", progress: "已完成58/100" },
  { title: "成长之路", desc: "角色等级达到50级", progress: "已完成58/100" },
  { title: "友谊使者", desc: "结识20位好友", progress: "已完成58/100" },
];

export const profileRows = [
  ["昵称", "金角大螂"],
  ["IP属地", "广东"],
  ["生日", "2006-01-01"],
  ["头像", "点击更换"],
  ["用户ID", "V123456"],
];
