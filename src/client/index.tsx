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

  const socket = usePartySocket({
    party: "chat",
    room,
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      if (message.type === "add") {
        const foundIndex = messages.findIndex((m) => m.id === message.id);
        if (foundIndex === -1) {
          // probably someone else who added a message
          setMessages((messages) => [
            ...messages,
            {
              id: message.id,
              content: message.content,
              user: message.user,
              role: message.role,
              timestamp: message.timestamp,
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
                id: message.id,
                content: message.content,
                user: message.user,
                role: message.role,
                timestamp: message.timestamp,
              })
              .concat(messages.slice(foundIndex + 1));
          });
        }
      } else if (message.type === "update") {
        setMessages((messages) =>
          messages.map((m) =>
            m.id === message.id
              ? {
                  id: message.id,
                  content: message.content,
                  user: message.user,
                  role: message.role,
                  timestamp: message.timestamp,
                }
              : m,
          ),
        );
      } else {
        // 历史消息，修正 timestamp 类型
        setMessages(message.messages.map(m => ({
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

  return (
    <div className="chat container">
      <div className="chat-messages-list">
        {messages.map((message) => (
          <div key={message.id} className="row message">
            <div className="two columns user">{message.user}</div>
            <div className="ten columns message-content">
              <span>{message.content}</span>
            </div>
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
