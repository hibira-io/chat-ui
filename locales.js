// Labels for the bundled components. Pass `locale` to pick one, or `labels`
// to override single strings.

const en = {
  placeholder: 'Write a message…',
  send: 'Send',
  typing: 'Typing…',
  automatic: 'Automatic reply',
  handoff: 'Passed to our team',
  suggestions: 'You might also ask',
  copy: 'Copy',
  copied: 'Copied',
  copyCode: 'Copy code',
  seen: 'Seen',
  empty: 'Ask us anything.',
  tooLong: 'Keep a message under {n} characters.',
  steps: {
    reading: 'Reading your question',
    account: 'Looking at your account',
    searching: 'Searching our docs',
    writing: 'Writing a reply',
    checking: 'Checking the reply',
  },
};

const zhTW = {
  placeholder: '輸入訊息…',
  send: '送出',
  typing: '正在輸入…',
  automatic: '自動回覆',
  handoff: '已轉交團隊',
  suggestions: '你可能還想問',
  copy: '複製',
  copied: '已複製',
  copyCode: '複製程式碼',
  seen: '已讀',
  empty: '有任何問題都可以問我們。',
  tooLong: '每則訊息請少於 {n} 個字元。',
  steps: {
    reading: '正在閱讀你的問題',
    account: '正在查看你的帳戶',
    searching: '正在搜尋文件',
    writing: '正在撰寫回覆',
    checking: '正在檢查回覆',
  },
};

const zhCN = {
  placeholder: '输入消息…',
  send: '发送',
  typing: '正在输入…',
  automatic: '自动回复',
  handoff: '已转交团队',
  suggestions: '你可能还想问',
  copy: '复制',
  copied: '已复制',
  copyCode: '复制代码',
  seen: '已读',
  empty: '有任何问题都可以问我们。',
  tooLong: '每条消息请少于 {n} 个字符。',
  steps: {
    reading: '正在阅读你的问题',
    account: '正在查看你的账户',
    searching: '正在搜索文档',
    writing: '正在撰写回复',
    checking: '正在检查回复',
  },
};

const ja = {
  placeholder: 'メッセージを入力…',
  send: '送信',
  typing: '入力中…',
  automatic: '自動応答',
  handoff: '担当チームに引き継ぎ済み',
  suggestions: 'こちらもよく聞かれます',
  copy: 'コピー',
  copied: 'コピーしました',
  copyCode: 'コードをコピー',
  seen: '既読',
  empty: 'お気軽にご質問ください。',
  tooLong: 'メッセージは {n} 文字未満にしてください。',
  steps: {
    reading: 'ご質問を確認しています',
    account: 'アカウントを確認しています',
    searching: 'ドキュメントを検索しています',
    writing: '回答を作成しています',
    checking: '回答をチェックしています',
  },
};

const ko = {
  placeholder: '메시지를 입력하세요…',
  send: '보내기',
  typing: '입력 중…',
  automatic: '자동 답변',
  handoff: '담당 팀에 전달됨',
  suggestions: '이런 질문도 있어요',
  copy: '복사',
  copied: '복사됨',
  copyCode: '코드 복사',
  seen: '읽음',
  empty: '무엇이든 물어보세요.',
  tooLong: '메시지는 {n}자 미만으로 써 주세요.',
  steps: {
    reading: '질문을 읽고 있어요',
    account: '계정을 확인하고 있어요',
    searching: '문서를 찾고 있어요',
    writing: '답변을 작성하고 있어요',
    checking: '답변을 확인하고 있어요',
  },
};

const th = {
  placeholder: 'พิมพ์ข้อความ…',
  send: 'ส่ง',
  typing: 'กำลังพิมพ์…',
  automatic: 'ตอบกลับอัตโนมัติ',
  handoff: 'ส่งต่อให้ทีมงานแล้ว',
  suggestions: 'คุณอาจอยากถามต่อ',
  copy: 'คัดลอก',
  copied: 'คัดลอกแล้ว',
  copyCode: 'คัดลอกโค้ด',
  seen: 'อ่านแล้ว',
  empty: 'ถามเราได้ทุกเรื่อง',
  tooLong: 'โปรดเขียนข้อความไม่เกิน {n} ตัวอักษร',
  steps: {
    reading: 'กำลังอ่านคำถามของคุณ',
    account: 'กำลังดูบัญชีของคุณ',
    searching: 'กำลังค้นหาในเอกสาร',
    writing: 'กำลังเขียนคำตอบ',
    checking: 'กำลังตรวจสอบคำตอบ',
  },
};

const vi = {
  placeholder: 'Nhập tin nhắn…',
  send: 'Gửi',
  typing: 'Đang nhập…',
  automatic: 'Trả lời tự động',
  handoff: 'Đã chuyển cho đội ngũ',
  suggestions: 'Bạn cũng có thể hỏi',
  copy: 'Sao chép',
  copied: 'Đã sao chép',
  copyCode: 'Sao chép mã',
  seen: 'Đã xem',
  empty: 'Hãy hỏi chúng tôi bất cứ điều gì.',
  tooLong: 'Tin nhắn cần ít hơn {n} ký tự.',
  steps: {
    reading: 'Đang đọc câu hỏi của bạn',
    account: 'Đang xem tài khoản của bạn',
    searching: 'Đang tìm trong tài liệu',
    writing: 'Đang viết câu trả lời',
    checking: 'Đang kiểm tra câu trả lời',
  },
};

export const LOCALES = { en, 'zh-TW': zhTW, 'zh-CN': zhCN, ja, ko, th, vi };

/** The labels for a locale ("ja", "zh-Hant-TW", "pt" falls back to English), with overrides. */
export function labelsFor(locale, overrides) {
  const tag = String(locale ?? 'en');
  let base = LOCALES[tag];
  if (!base) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('zh')) base = /hant|tw|hk|mo/.test(lower) ? zhTW : zhCN;
    else base = LOCALES[lower.split('-')[0]] ?? en;
  }
  return { ...base, ...overrides, steps: { ...base.steps, ...overrides?.steps } };
}

/** Fills {name} placeholders. */
export const format = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
