export interface EntryTemplate {
  name: string;
  applicableCategories: readonly string[];
  fieldHints: {
    core: string;
    wrongPoint: string;
    analysis: string;
    mnemonic: string;
    extension: string;
  };
  recommendedTags: readonly string[];
}

export const entryTemplates: readonly EntryTemplate[] = [
  {
    name: '言语理解',
    applicableCategories: ['逻辑填空', '主旨概括', '意图判断', '细节理解', '语句排序', '语句填空', '下文推断'],
    fieldHints: {
      core: '填写文段、设空句或待辨析成语',
      wrongPoint: '填写误选词语、望文生义、感情色彩或语境搭配问题',
      analysis: '写明正确词语及语境、侧重点、搭配对象',
      mnemonic: '记录词义抓手或语境判断口诀',
      extension: '补充近义词、反义词、常见搭配和易混成语',
    },
    recommendedTags: ['高频成语', '近义辨析', '语境陷阱', '主旨干扰项'],
  },
  {
    name: '政治理论',
    applicableCategories: ['马原', '毛中特', '新时代中国特色社会主义思想', '时政会议', '政策金句', '党内法规'],
    fieldHints: {
      core: '填写会议、理论、政策表述或判断命题',
      wrongPoint: '填写主体、时间、首次提出、根本保证等混淆项',
      analysis: '保留原文中的规范结论、主体、时间和层级关系',
      mnemonic: '记录关键词顺序或对照口诀',
      extension: '补充用户输入中已有的相关会议或相近表述',
    },
    recommendedTags: ['时政会议', '政策表述', '党内法规', '时间线'],
  },
  {
    name: '常识判断',
    applicableCategories: ['法律', '党史', '文史', '科技', '地理', '经济', '生活常识'],
    fieldHints: {
      core: '填写人物、地名、制度、法律规则或事实对应关系',
      wrongPoint: '填写混淆对象、条件遗漏或概念张冠李戴',
      analysis: '写明原文明确给出的正确对应或规则',
      mnemonic: '记录对照关系或关键词',
      extension: '补充用户已经输入的相关常识',
    },
    recommendedTags: ['古今地名', '法律条件', '文史对应', '科技原理'],
  },
  {
    name: '图形推理',
    applicableCategories: ['位置规律', '样式规律', '数量规律', '属性规律', '空间重构', '特殊图形特征'],
    fieldHints: {
      core: '插入图形截图并写明需要判断的规律',
      wrongPoint: '记录误判规律、漏数对象或观察顺序错误',
      analysis: '按观察对象、变化方式、验证结果分段记录',
      mnemonic: '记录位置—样式—数量—属性的检查顺序',
      extension: '补充同类图形特征和识别条件',
    },
    recommendedTags: ['移动旋转', '叠加运算', '元素计数', '空间重构'],
  },
  {
    name: '逻辑判断',
    applicableCategories: ['定义判断', '类比推理', '翻译推理', '真假推理', '削弱加强', '前提假设', '排列组合'],
    fieldHints: {
      core: '填写定义、论证、条件关系或类比词组',
      wrongPoint: '填写偷换概念、强度不匹配、条件方向错误等陷阱',
      analysis: '写明关键词、论点论据、翻译式或排除过程',
      mnemonic: '记录充分必要条件、削弱加强或定义匹配口诀',
      extension: '补充用户已有的摩根定律、逆否命题或关系辨析',
    },
    recommendedTags: ['翻译推理', '削弱加强', '关键词抓取', '二级辨析'],
  },
  {
    name: '资料分析',
    applicableCategories: ['基础公式', '速算技巧', '同比环比', '比重', '平均数', '倍数', '单位陷阱', '时间陷阱', '计算易错点'],
    fieldHints: {
      core: '填写材料、数据、问题和待求指标，可附图表截图',
      wrongPoint: '记录误用公式、单位遗漏、基期现期混淆和时间口径错误',
      analysis: '按公式、代入、计算和单位写出过程',
      mnemonic: '记录公式关键词或速算判断',
      extension: '补充关联公式和同类陷阱',
    },
    recommendedTags: ['基期现期', '比重变化', '平均数', '单位陷阱', '时间陷阱'],
  },
  {
    name: '申论素材',
    applicableCategories: ['规范词', '人物素材', '政策金句', '作文分论点'],
    fieldHints: {
      core: '填写口语表达、材料原句、人物事例或主题观点',
      wrongPoint: '填写不规范表达、空泛表述或适用场景误判',
      analysis: '写明规范词、可用场景和表达重点',
      mnemonic: '记录主题—主体—动作—效果结构',
      extension: '补充用户已有的同主题规范词或分论点',
    },
    recommendedTags: ['规范词', '人物素材', '政策金句', '作文分论点'],
  },
] as const;
