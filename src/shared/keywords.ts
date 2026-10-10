import { UNCATEGORIZED_ID } from './types';

export type ClassifiableCategoryId =
  | 'work' | 'dev' | 'fun' | 'design' | 'tool' | 'system';

export const CATEGORY_KEYWORDS: Record<ClassifiableCategoryId, string[]> = {
  work: ['office', 'word', 'excel', 'ppt', 'outlook', 'teams', 'wps', '钉钉', '飞书', 'slack', 'zoom', '会议', '文档'],
  dev: ['vscode', 'visual studio code', 'idea', 'pycharm', 'webstorm', 'android studio', 'eclipse', 'sublime', 'git', 'docker', 'terminal', 'bash', '终端', 'node', 'npm'],
  fun: ['steam', 'epic games', 'mpv', 'vlc', 'spotify', '网易云', 'bilibili', '哔哩哔哩', 'youku', '视频', '音乐', '游戏', '播放'],
  design: ['photoshop', 'figma', 'sketch', 'illustrator', 'blender', 'after effects', 'premiere', '剪映', '设计', '绘画', 'ps'],
  tool: ['chrome', 'edge', 'firefox', 'browser', '浏览器', 'winrar', '7-zip', '压缩', 'everything', 'snipaste', '截图', 'clash', 'v2ray', '迅雷', '下载', '输入法'],
  system: ['settings', '设置', 'control panel', 'task manager', '任务管理器', 'explorer', '文件资源管理器', 'regedit', 'powershell', '计算器', 'calculator', 'notepad', '记事本'],
};

export const UNCATEGORIZED = UNCATEGORIZED_ID;