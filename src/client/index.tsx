import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";
import { generateRoomId } from "../shared";

import { type ChatMessage, type Message } from "../shared";

function App() {
  const [userName, setUserName] = useState(() => localStorage.getItem("chat_username") || ""); // 用户名
  const [input, setInput] = useState(""); // 输入框内容
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState(""); // 错误提示
  const [renaming, setRenaming] = useState(false); // 是否重命名中
  const [users, setUsers] = useState<string[]>([]); // 在线用户列表
  const { room } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSetUserName = (name: string) => {
    setUserName(name);
    localStorage.setItem("chat_username", name);
  };

  // 新消息自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (userName && !renaming) {
      // 每次设置用户名或重命名后，通知服务端
      socket.send(JSON.stringify({ type: "setName", name: userName }));
    }
  }, [userName, renaming]);

  const socket = usePartySocket({
    party: "chat",
    room,
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string);
      if (message.type === "users") {
        setUsers(message.users || []);
        return;
      }
      if (message.type === "system") {
        // 系统事件作为特殊聊天消息插入
        setMessages((messages) => [
          ...messages,
          {
            id: `${message.event}-${message.user}-${Date.now()}`,
            content: `<sys>${message.event === "join" ? "<b>" + message.user + "</b> joined the chatroom" : "<b>" + message.user + "</b> left the chatroom"}</sys>`,
            user: "",
            role: "system",
            timestamp: Date.now(),
          },
        ]);
        return;
      }
      const parsedMessage = message as Message;
      if (parsedMessage.type === "add") {
        const foundIndex = messages.findIndex((m) => m.id === parsedMessage.id);
        if (foundIndex === -1) {
          // probably someone else who added a message
          setMessages((messages) => [
            ...messages,
            {
              id: parsedMessage.id,
              content: parsedMessage.content,
              user: parsedMessage.user,
              role: parsedMessage.role,
              timestamp: parsedMessage.timestamp,
            },
          ]);
        } else {
          // this usually means we ourselves added a message
          // and it was broadcasted back
          // so let's replace the message with the new message
          setMessages((messages) => {
            return messages
              .slice(0, foundIndex)
              .concat({
                id: parsedMessage.id,
                content: parsedMessage.content,
                user: parsedMessage.user,
                role: parsedMessage.role,
                timestamp: parsedMessage.timestamp,
              })
              .concat(messages.slice(foundIndex + 1));
          });
        }
      } else if (parsedMessage.type === "update") {
        setMessages((messages) =>
          messages.map((m) =>
            m.id === parsedMessage.id
              ? {
                  id: parsedMessage.id,
                  content: parsedMessage.content,
                  user: parsedMessage.user,
                  role: parsedMessage.role,
                  timestamp: parsedMessage.timestamp,
                }
              : m,
          ),
        );
      } else {
        // 历史消息，修正 timestamp 类型
        setMessages(parsedMessage.messages.map(m => ({
          ...m,
          timestamp: typeof m.timestamp === "string" ? Number(m.timestamp) : m.timestamp
        })));
      }
    },
  });

  const renderTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return (
      <span className="timestamp">
        {date.getHours().toString().padStart(2, "0")}:
        {date.getMinutes().toString().padStart(2, "0")}
      </span>
    );
  };

  // 检查用户名是否重复
  const isNameDuplicate = (name: string) => {
    return messages.some((m) => m.user === name);
  };

  // 用户列表排序：自己在最上，后面是最新进来的
  const sortedUsers = users.length
    ? [userName, ...users.filter(u => u !== userName)]
    : [userName];

  return (
    <div className="chat container" style={{ display: "flex", flexDirection: "row" }}>
      <div style={{ flex: 1 }}>
        <div className="chat-messages-list">
          {/* 聊天消息 */}
          {messages.map((message) => (
            <div key={message.id} className="row message">
              {message.role === "system" ? (
                <div className="twelve columns" style={{ textAlign: "center", color: "#e74c3c", fontWeight: 500, margin: "6px 0" }}>
                  <span dangerouslySetInnerHTML={{ __html: message.content }} />
                </div>
              ) : (
                <>
                  <div className="two columns user">{message.user}</div>
                  <div className="ten columns message-content">
                    <span>{message.content}</span>
                  </div>
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!userName || renaming) {
              // 用户名输入或重命名
              const name = input.trim();
              if (name.length < 2 || name.length > 12) {
                setError("用户名需2-12字符");
                return;
              }
              if (isNameDuplicate(name)) {
                setError("用户名已存在");
                return;
              }
              handleSetUserName(name);
              setRenaming(false);
              setInput("");
              setError("");
              return;
            }
            // 聊天消息发送
            if (!input.trim()) return;
            const chatMessage: ChatMessage = {
              id: nanoid(8),
              content: input,
              user: userName,
              role: "user",
              timestamp: Date.now(),
            };
            setMessages((messages) => [...messages, chatMessage]);
            socket.send(
              JSON.stringify({
                type: "add",
                ...chatMessage,
              } satisfies Message),
            );
            setInput("");
          }}
        >
          {(!userName || renaming) ? (
            <input
              type="text"
              name="content"
              className="ten columns my-input-text"
              placeholder="请输入用户名"
              autoComplete="off"
              value={input}
              maxLength={12}
              onChange={e => {
                setInput(e.target.value);
                setError("");
              }}
              style={{ maxWidth: 220 }}
            />
          ) : (
            <input
              type="text"
              name="content"
              className="ten columns my-input-text"
              placeholder={`Hello ${userName}! Type a message...`}
              autoComplete="off"
              value={input}
              onChange={e => {
                setInput(e.target.value);
                setError("");
              }}
              style={{ maxWidth: 220, overflowX: "auto", whiteSpace: "nowrap" }}
            />
          )}
          <button type="submit" className="send-message two columns">
            {userName && !renaming ? "发送" : "确定"}
          </button>
          <button
            type="button"
            className="send-message two columns"
            style={{ marginLeft: 8 }}
            onClick={() => {
              setRenaming(true);
              setInput("");
            }}
            disabled={!userName || renaming}
          >
            重命名
          </button>
          {error && <div style={{ color: "red", marginTop: 4 }}>{error}</div>}
        </form>
      </div>
      <div style={{ width: 160, marginLeft: 12, overflowY: "auto", maxHeight: "70vh", paddingLeft: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>在线用户</div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {sortedUsers.map((u, i) => (
            <li key={u} style={{
              fontWeight: u === userName ? 700 : 400,
              color: u === userName ? "#007aff" : undefined,
              marginBottom: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>{u}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${generateRoomId()}`} replace />} />
      <Route path="/:room" element={<App />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>,
);
