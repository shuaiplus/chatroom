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

import { names, type ChatMessage, type Message } from "../shared";

function App() {
  const [name] = useState(names[Math.floor(Math.random() * names.length)]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { room } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        setMessages(message.messages);
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

  return (
    <div className="chat container">
      <div className="chat-messages-list">
        {messages.map((message) => (
          <div key={message.id} className="row message">
            <div className="two columns user">{message.user}</div>
            <div className="ten columns message-content">
              <span>{message.content}</span>
              {renderTime(message.timestamp)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const content = e.currentTarget.elements.namedItem(
            "content",
          ) as HTMLInputElement;
          const chatMessage: ChatMessage = {
            id: nanoid(8),
            content: content.value,
            user: name,
            role: "user",
            timestamp: Date.now(),
          };
          setMessages((messages) => [...messages, chatMessage]);
          // we could broadcast the message here

          socket.send(
            JSON.stringify({
              type: "add",
              ...chatMessage,
            } satisfies Message),
          );

          content.value = "";
        }}
      >
        <input
          type="text"
          name="content"
          className="ten columns my-input-text"
          placeholder={`Hello ${name}! Type a message...`}
          autoComplete="off"
        />
        <button type="submit" className="send-message two columns">
          Send
        </button>
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
