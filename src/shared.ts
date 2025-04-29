export type ChatMessage = {
  id: string;
  content: string;
  user: string;
  role: "user" | "assistant";
  timestamp: number; // 消息时间戳，毫秒
};

export type Message =
  | {
      type: "add";
      id: string;
      content: string;
      user: string;
      role: "user" | "assistant";
      timestamp: number;
    }
  | {
      type: "update";
      id: string;
      content: string;
      user: string;
      role: "user" | "assistant";
      timestamp: number;
    }
  | {
      type: "all";
      messages: ChatMessage[];
    };

export const names = [
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Eve",
  "Frank",
  "Grace",
  "Heidi",
  "Ivan",
  "Judy",
  "Kevin",
  "Linda",
  "Mallory",
  "Nancy",
  "Oscar",
  "Peggy",
  "Quentin",
  "Randy",
  "Steve",
  "Trent",
  "Ursula",
  "Victor",
  "Walter",
  "Xavier",
  "Yvonne",
  "Zoe",
];

export const simpleWords = [
  "apple", "book", "cat", "dog", "egg", "fish", "go", "hat", "ice", "jam",
  "kite", "leaf", "moon", "nest", "owl", "pen", "queen", "rain", "sun", "tree",
  "umbrella", "van", "wolf", "xray", "yarn", "zebra", "star", "cloud", "river", "rock",
  "sand", "mouse", "lamp", "door", "car", "bus", "train", "plane", "ship", "shoe",
  "sock", "ring", "bell", "cake", "milk", "corn", "frog", "duck", "rose", "seed"
];

export function generateRoomId(): string {
  // 随机抽取5个单词，顺序随机，用-连接
  const arr = [...simpleWords];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 5).join("-");
}
