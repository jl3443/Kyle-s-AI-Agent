// React组件 - 使用CDN引入React或使用React-like实现
// 为Chrome扩展提供组件化UI

/**
 * 简单的React-like实现（如果不想引入完整React）
 * 或者使用CDN: <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
 */

// 如果使用CDN React，这些函数就不需要了
// 这里提供一个轻量级的React-like实现

class ReactLike {
    static createElement(type, props, ...children) {
        if (typeof type === 'function') {
            return type(props || {});
        }
        
        const element = document.createElement(type);
        
        // 设置属性
        if (props) {
            Object.keys(props).forEach(key => {
                if (key === 'className') {
                    element.className = props[key];
                } else if (key === 'style' && typeof props[key] === 'object') {
                    Object.assign(element.style, props[key]);
                } else if (key.startsWith('on') && typeof props[key] === 'function') {
                    const eventName = key.substring(2).toLowerCase();
                    element.addEventListener(eventName, props[key]);
                } else if (key !== 'children') {
                    element.setAttribute(key, props[key]);
                }
            });
        }
        
        // 添加子元素
        children.forEach(child => {
            if (typeof child === 'string' || typeof child === 'number') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            } else if (Array.isArray(child)) {
                child.forEach(c => {
                    if (typeof c === 'string' || typeof c === 'number') {
                        element.appendChild(document.createTextNode(c));
                    } else if (c instanceof Node) {
                        element.appendChild(c);
                    }
                });
            }
        });
        
        return element;
    }
    
    static useState(initialValue) {
        // 简化版useState - 返回当前值和setter
        // 注意：这个实现不支持组件重新渲染，需要手动更新DOM
        let state = initialValue;
        const setState = (newValue) => {
            state = typeof newValue === 'function' ? newValue(state) : newValue;
        };
        
        return [state, setState];
    }
    
    static useRef(initialValue) {
        return { current: initialValue };
    }
    
    static useEffect(callback, deps) {
        // 简化版useEffect实现
        callback();
    }
}

// 使用CDN React或ReactLike
const React = window.React || ReactLike;
const createElement = React.createElement || ReactLike.createElement.bind(ReactLike);

// 如果使用ReactLike，需要手动实现hooks
let useState, useEffect, useRef;
if (window.React && window.React.useState) {
    useState = React.useState;
    useEffect = React.useEffect;
    useRef = React.useRef;
} else {
    // ReactLike的简化hooks实现
    useState = ReactLike.useState.bind(ReactLike);
    useEffect = ReactLike.useEffect.bind(ReactLike);
    useRef = ReactLike.useRef.bind(ReactLike);
}

/**
 * 消息组件
 */
function Message({ role, content, timestamp }) {
    const className = role === 'user' ? 'ds-message ds-user' : 'ds-message ds-assistant';
    
    // 处理TSV格式的显示
    const renderContent = () => {
        if (typeof content === 'object' && content.type === 'tsv') {
            return createElement('div', { className: 'tsv-content' },
                createElement('pre', { style: { 
                    background: '#f5f5f5', 
                    padding: '12px', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                }}, content.data)
            );
        }
        
        // 处理普通文本（支持换行）
        const lines = String(content).split('\n');
        return lines.map((line, index) => 
            createElement('p', { key: index }, line || '\u00A0')
        );
    };
    
    return createElement('div', { className, 'data-timestamp': timestamp },
        renderContent()
    );
}

/**
 * 消息列表组件
 */
function MessageList({ messages, onScroll }) {
    const containerRef = useRef(null);
    
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages]);
    
    return createElement('div', { 
        className: 'ds-messages',
        ref: containerRef,
        onScroll: onScroll
    },
        messages.map((msg, index) => 
            createElement(Message, {
                key: index,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp
            })
        )
    );
}

/**
 * 输入区域组件
 */
function InputArea({ onSend, disabled, placeholder = '输入消息...' }) {
    const [input, setInput] = useState('');
    const inputRef = useRef(null);
    
    const handleSend = () => {
        if (input.trim() && !disabled) {
            onSend(input.trim());
            setInput('');
        }
    };
    
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    
    return createElement('div', { className: 'ds-input-area' },
        createElement('textarea', {
            ref: inputRef,
            id: 'ds-input',
            value: input,
            onChange: (e) => setInput(e.target.value),
            onKeyDown: handleKeyDown,
            placeholder: placeholder,
            rows: 3,
            disabled: disabled
        }),
        createElement('button', {
            id: 'ds-send',
            onClick: handleSend,
            disabled: disabled || !input.trim()
        }, '发送')
    );
}

/**
 * 思考指示器组件
 */
function ThinkingIndicator({ visible }) {
    if (!visible) return null;
    
    return createElement('div', { className: 'ds-thinking', style: { display: 'flex' } },
        createElement('span', { className: 'ds-dot' }),
        createElement('span', { className: 'ds-dot' }),
        createElement('span', { className: 'ds-dot' }),
        createElement('span', null, '思考中...')
    );
}

/**
 * 侧边栏头部组件
 */
function SidebarHeader({ onClose, title = "🤖 Kyle's AI Agent" }) {
    return createElement('div', { className: 'ds-header' },
        createElement('h3', null, title),
        createElement('button', {
            id: 'ds-close',
            onClick: onClose,
            title: '关闭 (Command+K)'
        }, '×')
    );
}

/**
 * 主侧边栏组件
 */
function AISidebar({ langChainAdapter, onClose }) {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: '👋 你好！我是Kyle\'s AI Agent\n有什么可以帮你的吗？',
            timestamp: Date.now()
        }
    ]);
    const [isThinking, setIsThinking] = useState(false);
    const [error, setError] = useState(null);
    
    const handleSend = async (userMessage) => {
        // 添加用户消息
        setMessages(prev => [...prev, {
            role: 'user',
            content: userMessage,
            timestamp: Date.now()
        }]);
        
        setIsThinking(true);
        setError(null);
        
        try {
            // 使用LangChain路由链处理
            const response = await langChainAdapter.route(userMessage);
            
            // 添加AI回复
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            }]);
        } catch (err) {
            setError(err.message);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `抱歉，AI服务暂时不可用：${err.message}`,
                timestamp: Date.now()
            }]);
        } finally {
            setIsThinking(false);
        }
    };
    
    return createElement('div', { id: 'deepseek-ai-sidebar', className: 'ds-sidebar' },
        createElement(SidebarHeader, { onClose }),
        createElement(MessageList, { messages }),
        createElement(ThinkingIndicator, { visible: isThinking }),
        createElement(InputArea, { 
            onSend: handleSend, 
            disabled: isThinking 
        }),
        error && createElement('div', { className: 'ds-error' }, error)
    );
}

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AISidebar,
        Message,
        MessageList,
        InputArea,
        ThinkingIndicator,
        SidebarHeader,
        ReactLike
    };
} else {
    window.AISidebar = AISidebar;
    window.Message = Message;
    window.MessageList = MessageList;
    window.InputArea = InputArea;
    window.ThinkingIndicator = ThinkingIndicator;
    window.SidebarHeader = SidebarHeader;
    window.ReactLike = ReactLike;
}

