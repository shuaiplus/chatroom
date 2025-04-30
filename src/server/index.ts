import {
  type Connection,
  Server,
  type WSMessage,
  routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message } from "../shared";

// 新增：系统事件消息类型
type SystemEvent = { type: "system", event: "join" | "leave"; user: string };

export class Chat extends Server<Env> {
  static options = { hibernate: true };

  messages = [] as ChatMessage[];
  users: { [connId: string]: { name: string; joined: number } } = {};

  broadcastMessage(message: Message, exclude?: string[]) {
    this.broadcast(JSON.stringify(message), exclude);
  }

  broadcastUsers() {
    // 在线用户排序：自己优先，后面按加入时间（最新在下）
    const userList = Object.values(this.users)
      .sort((a, b) => a.joined - b.joined)
      .map(u => u.name);
    this.broadcast(
      JSON.stringify({ type: "users", users: userList })
    );
  }

  onStart() {
    // this is where you can initialize things that need to be done before the server starts
    // for example, load previous messages from a database or a service

    // create the messages table if it doesn't exist
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT)`,
    );

    // load the messages from the database
    this.messages = this.ctx.storage.sql
      .exec(`SELECT * FROM messages`)
      .toArray() as ChatMessage[];
  }

  onConnect(connection: Connection) {
    connection.send(
      JSON.stringify({
        type: "all",
        messages: this.messages,
      } satisfies Message),
    );
    // 等待客户端发送用户名
  }

  saveMessage(message: ChatMessage) {
    // check if the message already exists
    const existingMessage = this.messages.find((m) => m.id === message.id);
    if (existingMessage) {
      this.messages = this.messages.map((m) => {
        if (m.id === message.id) {
          return message;
        }
        return m;
      });
    } else {
      this.messages.push(message);
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO messages (id, user, role, content) VALUES ('${
        message.id
      }', '${message.user}', '${message.role}', ${JSON.stringify(
        message.content,
      )}) ON CONFLICT (id) DO UPDATE SET content = ${JSON.stringify(
        message.content,
      )}`,
    );
  }

  onMessage(connection: Connection, message: WSMessage) {
    const parsed = JSON.parse(message as string);
    if (parsed.type === "setName") {
      const prevName = this.users[connection.id]?.name;
      const isFirstJoin = !Object.values(this.users).some(u => u.name === parsed.name);
      if (!this.users[connection.id]) {
        this.users[connection.id] = { name: parsed.name, joined: Date.now() };
        if (isFirstJoin) {
          this.broadcast(
            JSON.stringify({ type: "system", event: "join", user: parsed.name })
          );
        }
      } else if (prevName !== parsed.name) {
        // 重命名，先判断新旧名字
        const isNewNameFirstJoin = !Object.values(this.users).some(u => u.name === parsed.name);
        const isOldNameLastLeave = Object.values(this.users).filter(u => u.name === prevName).length === 1;
        if (isOldNameLastLeave) {
          this.broadcast(
            JSON.stringify({ type: "system", event: "leave", user: prevName })
          );
        }
        if (isNewNameFirstJoin) {
          this.broadcast(
            JSON.stringify({ type: "system", event: "join", user: parsed.name })
          );
        }
        this.users[connection.id].name = parsed.name;
        this.broadcastUsers();
        return;
      }
      this.users[connection.id].name = parsed.name;
      this.broadcastUsers();
      return;
    }
    if (parsed.type === "add" || parsed.type === "update") {
      this.saveMessage(parsed);
    }
    this.broadcast(message);
  }

  onClose(connection: Connection) {
    const user = this.users[connection.id]?.name;
    if (user) {
      // 只在最后一个同名连接断开时才广播离开
      const isLastLeave = Object.values(this.users).filter(u => u.name === user).length === 1;
      if (isLastLeave) {
        this.broadcast(
          JSON.stringify({ type: "system", event: "leave", user })
        );
      }
    }
    delete this.users[connection.id];
    this.broadcastUsers();
  }
}

export default {
  async fetch(request, env) {
    return (
      (await routePartykitRequest(request, { ...env })) ||
      env.ASSETS.fetch(request)
    );
  },
} satisfies ExportedHandler<Env>;
