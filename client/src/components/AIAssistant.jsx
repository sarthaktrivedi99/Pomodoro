import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './AIAssistant.css'; // We'll create this next

import clippyImg from '../assets/clippy.png';

export default function AIAssistant() {
    const { token } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'Hi! I\'m Clippy! I can help you manage tasks and check your efficiency. What do you need?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setLoading(true);

        try {
            // Using fetch to hit our main server proxy (/api/chat)
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: userMsg })
            });

            if (!res.ok) throw new Error('Failed to get response');

            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', text: data.response }]);

            // Dispatch event to refresh tasks/calendar after AI action
            // This triggers refresh in Tasks.jsx which listens for 'tasksUpdated'
            window.dispatchEvent(new CustomEvent('tasksUpdated'));

        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I encountered an error. Please try again." }]);
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Need to handle direct URL if not proxied. 
    // Vite proxy usually handles /api -> localhost:3001.
    // We can add /mcp -> localhost:3002 in vite.config.js?
    // Or just fetch('http://localhost:3002/chat') directly (CORS is enabled there).

    // Let's try direct first.
    // UPDATED FETCH URL ABOVE TO ABSOLUTE FOR NOW to avoid Proxy complexity

    // Actually, I'll update the fetch inside the component to use absolute URL 
    // to match local dev setup: http://localhost:3002/chat

    return (
        <div className={`ai-assistant ${isOpen ? 'open' : ''}`}>
            {!isOpen && (
                <button
                    className="ai-fab"
                    onClick={() => setIsOpen(true)}
                    title="Ask AI Assistant"
                >
                    <img src={clippyImg} alt="Clippy" style={{ width: '40px', height: 'auto' }} />
                </button>
            )}

            {isOpen && (
                <div className="ai-window">
                    <div className="ai-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img src={clippyImg} alt="Clippy" style={{ width: '24px', height: 'auto' }} />
                            <span>Clippy</span>
                        </div>
                        <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
                    </div>

                    <div className="ai-messages">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`ai-message ${msg.role}`}>
                                <div className="msg-content">{msg.text}</div>
                            </div>
                        ))}
                        {loading && <div className="ai-message assistant typing">...</div>}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="ai-input-area" onSubmit={handleSend}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask to create tasks..."
                            disabled={loading}
                            autoFocus
                        />
                        <button type="submit" disabled={loading || !input.trim()}>
                            ➤
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

// Updating fetch to be absolute for now
// In real prod, this should be env var.
