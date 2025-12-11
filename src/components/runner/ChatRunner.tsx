'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Send, ChevronLeft, Menu, Plus, Camera, Image as ImageIcon, Smile, Mic } from 'lucide-react';
import clsx from 'clsx';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Message = {
    id: string;
    sender: 'bot' | 'user';
    content: string;
    type?: 'text' | 'select' | 'date' | 'email' | 'statement';
    options?: string[];
    placeholder?: string;
    time: string;
};

type Node = {
    id: string;
    type: string;
    content: string;
    options: any;
    placeholder?: string;
};

type Edge = {
    source_node: string;
    target_node: string;
    condition: string | null;
};

export default function ChatRunner() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentNode, setCurrentNode] = useState<Node | null>(null);
    const [inputNode, setInputNode] = useState<Node | null>(null);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const answersRef = useRef<Record<string, any>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch Flow Data
    useEffect(() => {
        const fetchFlow = async () => {
            const { data: flows } = await supabase
                .from('flows')
                .select('id')
                .order('created_at', { ascending: false })
                .limit(1);
            if (!flows || flows.length === 0) return;

            const flowId = flows[0].id;

            const { data: nodesData } = await supabase.from('nodes').select('*').eq('flow_id', flowId);
            const { data: edgesData } = await supabase.from('edges').select('*').eq('flow_id', flowId);

            if (nodesData && edgesData) {
                const parsedNodes = nodesData.map(n => ({
                    ...n,
                    options: typeof n.options === 'string' ? JSON.parse(n.options) : n.options,
                }));

                setNodes(parsedNodes);
                setEdges(edgesData);

                const targetIds = new Set(edgesData.map(e => e.target_node));
                const startNode = parsedNodes.find(n => !targetIds.has(n.id)) || parsedNodes[0];

                if (startNode) {
                    processNode(startNode, parsedNodes, edgesData);
                }
            }
        };

        fetchFlow();

        // Preload bot avatar
        const img = new Image();
        img.src = "/kaeru_profile.png";
    }, []);

    const getCurrentTime = () => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const processNode = (node: Node, allNodes: Node[], allEdges: Edge[]) => {
        setCurrentNode(node);

        let nextInputNode = node;
        let isStatement = node.type === 'statement';

        if (node.type !== 'select') {
            const nextEdge = allEdges.find(e => e.source_node === node.id);
            if (nextEdge) {
                const nextNode = allNodes.find(n => n.id === nextEdge.target_node);
                if (nextNode && (nextNode.type === 'select' || (['text', 'email', 'phone', 'date'].includes(nextNode.type) && !nextNode.content))) {
                    nextInputNode = nextNode;
                    isStatement = false;
                }
            }
        }

        setInputNode(nextInputNode);
        addBotMessage(node, nextInputNode);

        if (isStatement && nextInputNode === node) {
            setTimeout(() => {
                const nextEdge = allEdges.find(e => e.source_node === node.id);
                if (nextEdge) {
                    const nextNode = allNodes.find(n => n.id === nextEdge.target_node);
                    if (nextNode) {
                        processNode(nextNode, allNodes, allEdges);
                    } else {
                        finishFlow();
                    }
                } else {
                    finishFlow();
                }
            }, 2000);
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const addBotMessage = (node: Node, inputNode: Node) => {
        setIsTyping(true);
        setTimeout(() => {
            setIsTyping(false);

            const opts = inputNode.options || {};
            const placeholder = opts.placeholder || inputNode.placeholder;
            const optionsList = Array.isArray(opts) ? opts : opts.items;

            setMessages(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    sender: 'bot',
                    content: node.content === "Answer Options" ? "以下の選択肢から選んでください" : node.content,
                    type: inputNode.type as any,
                    options: optionsList,
                    placeholder: placeholder,
                    time: getCurrentTime()
                },
            ]);
        }, 1000);
    };

    const handleAnswer = async (answer: string, optionIndex?: number) => {
        if (!inputNode) return;

        setMessages(prev => [
            ...prev,
            { id: Date.now().toString(), sender: 'user', content: answer, time: getCurrentTime() },
        ]);

        const newAnswers = { ...answersRef.current, [inputNode.id]: answer };
        setAnswers(newAnswers);
        answersRef.current = newAnswers;

        let nextEdge: Edge | undefined;

        if (inputNode.type === 'select' && optionIndex !== undefined) {
            const condition = `option-${optionIndex}`;
            nextEdge = edges.find(e => e.source_node === inputNode.id && e.condition === condition);
        }

        if (!nextEdge) {
            nextEdge = edges.find(e => e.source_node === inputNode.id && !e.condition);
        }

        if (nextEdge) {
            const nextNode = nodes.find(n => n.id === nextEdge.target_node);
            if (nextNode) {
                processNode(nextNode, nodes, edges);
            } else {
                finishFlow(newAnswers);
            }
        } else {
            finishFlow(newAnswers);
        }
    };

    const finishFlow = async (finalAnswers?: any) => {
        setIsTyping(true);
        const answersToSave = finalAnswers || answersRef.current;

        if (nodes.length > 0) {
            const { data: flows } = await supabase
                .from('flows')
                .select('id')
                .order('created_at', { ascending: false })
                .limit(1);

            if (flows && flows[0]) {
                await supabase.from('submissions').insert({
                    flow_id: flows[0].id,
                    answers: answersToSave
                });
            }
        }

        setTimeout(() => {
            setIsTyping(false);
            setInputNode(null); // Clear input node to hide input area
            setMessages(prev => [
                ...prev,
                { id: 'end', sender: 'bot', content: '回答が完了しました。ご協力ありがとうございました。', time: getCurrentTime() },
            ]);
        }, 1000);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        handleAnswer(inputText);
        setInputText('');
    };

    const renderInlineInput = () => {
        if (isTyping || !inputNode) return null;
        if (currentNode?.type === 'statement' && inputNode.id === currentNode.id) return null;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.sender === 'user') return null;

        if (inputNode.type === 'select') {
            let items: string[] = [];
            let placeholder = "選択してください...";

            if (Array.isArray(inputNode.options)) {
                items = inputNode.options;
            } else if (inputNode.options && inputNode.options.items) {
                items = inputNode.options.items;
                placeholder = inputNode.options.placeholder || placeholder;
            }

            return (
                <div className="w-full max-w-[85%] ml-12 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex flex-col gap-2">
                        <span className="text-xs text-white/80 ml-1">選択してください:</span>
                        <Select onValueChange={(value) => {
                            const idx = items.indexOf(value);
                            handleAnswer(value, idx);
                        }}>
                            <SelectTrigger className="w-full bg-white border-none rounded-xl h-12 text-black">
                                <SelectValue placeholder={placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                                {items.map((opt, i) => (
                                    <SelectItem key={i} value={opt}>{opt}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            );
        }
        return null;
    };

    const renderFixedInput = () => {
        if (isTyping || !inputNode) return null;
        if (currentNode?.type === 'statement' && inputNode.id === currentNode.id) return null;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.sender === 'user') return null;
        if (inputNode.type === 'select') return null;

        let placeholder = "メッセージを入力";
        if (inputNode.options && !Array.isArray(inputNode.options) && inputNode.options.placeholder) {
            placeholder = inputNode.options.placeholder;
        }

        if (inputNode.type === 'date') {
            return (
                <div className="flex gap-2 w-full items-center">
                    <Button variant="ghost" size="icon" className="text-gray-500">
                        <Plus size={24} />
                    </Button>
                    <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center">
                        <Input
                            type="date"
                            onChange={(e) => handleAnswer(e.target.value)}
                            className="bg-transparent border-none shadow-none focus-visible:ring-0 w-full p-0 h-auto text-black"
                        />
                    </div>
                </div>
            );
        }

        return (
            <form onSubmit={handleSubmit} className="flex gap-2 w-full items-center">
                <Button type="button" variant="ghost" size="icon" className="text-gray-500 shrink-0 hover:bg-transparent">
                    <Plus size={24} />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="text-gray-500 shrink-0 hidden sm:flex hover:bg-transparent">
                    <Camera size={24} />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="text-gray-500 shrink-0 hidden sm:flex hover:bg-transparent">
                    <ImageIcon size={24} />
                </Button>

                <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center min-h-[44px]">
                    <Input
                        type={inputNode.type === 'email' ? 'email' : 'text'}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={placeholder}
                        className="bg-transparent border-none shadow-none focus-visible:ring-0 w-full p-0 h-auto text-base text-black placeholder:text-gray-400"
                        autoFocus
                    />
                    <Button type="button" variant="ghost" size="icon" className="text-gray-400 h-6 w-6 ml-1 hover:bg-transparent">
                        <Smile size={20} />
                    </Button>
                </div>

                {inputText && (
                    <Button
                        type="submit"
                        size="icon"
                        className="bg-[#5AC463] hover:bg-[#4db055] text-white rounded-full h-10 w-10 shrink-0 transition-all duration-200"
                    >
                        <Send size={18} className="ml-0.5" />
                    </Button>
                )}
                {!inputText && (
                    <Button type="button" variant="ghost" size="icon" className="text-gray-500 shrink-0 hover:bg-transparent">
                        <Mic size={24} />
                    </Button>
                )}
            </form>
        );
    };

    const showFixedInput = inputNode && inputNode.type !== 'select' && !isTyping && !(currentNode?.type === 'statement' && inputNode.id === currentNode.id) && messages[messages.length - 1]?.sender !== 'user';

    return (
        <div className="flex justify-center bg-gray-100 min-h-[100dvh]">
            <div className="flex flex-col h-[100dvh] bg-[#7293C3] w-full max-w-[480px] shadow-2xl overflow-hidden font-sans border-x border-gray-200 relative">
                {/* LINE-style Header */}
                <div className="flex-none bg-[#111111]/90 text-white px-4 py-3 sm:py-4 flex items-center justify-between shadow-sm z-10 sticky top-0 backdrop-blur-md supports-[padding-top:env(safe-area-inset-top)]:pt-[env(safe-area-inset-top,20px)]">
                    <div className="flex items-center gap-3">
                        <ChevronLeft className="text-white cursor-pointer hover:opacity-80 transition-opacity" size={26} />
                        <h1 className="font-semibold text-lg tracking-wide">Kaeru Assistant</h1>
                    </div>
                    <div className="flex items-center gap-6">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cursor-pointer hover:opacity-80 transition-opacity"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        <Menu className="text-white cursor-pointer hover:opacity-80 transition-opacity" size={26} />
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-hide overscroll-contain" style={{ scrollbarWidth: 'none' }}>
                    <div className="space-y-4 pb-4">
                        {/* Date Divider Mock */}
                        <div className="flex justify-center my-6">
                            <span className="bg-[rgba(0,0,0,0.2)] text-white text-[11px] px-3 py-1 rounded-full font-medium">今日</span>
                        </div>

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={clsx(
                                    "flex w-full animate-in fade-in slide-in-from-bottom-1 duration-300",
                                    msg.sender === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                <div className={clsx("flex gap-2 max-w-[85%]", msg.sender === 'user' ? "flex-row-reverse" : "flex-row items-start")}>
                                    {/* Avatar for Bot */}
                                    {msg.sender === 'bot' && (
                                        <div className="h-[42px] w-[42px] flex-shrink-0 cursor-pointer hover:opacity-90 transition mt-0 rounded-full overflow-hidden border border-gray-100 bg-white">
                                            <img src="/kaeru_profile.png" alt="Kaeru" className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    <div className={clsx("flex flex-col", msg.sender === 'user' ? "items-end" : "items-start")}>
                                        {/* Name for Bot */}
                                        {msg.sender === 'bot' && (
                                            <span className="text-[11px] text-white/90 mb-1 ml-1 opacity-90 hidden">Kaeru</span>
                                        )}

                                        <div className="flex items-end gap-1.5">
                                            {/* Timestamp Left for User */}
                                            {msg.sender === 'user' && (
                                                <span className="text-[10px] text-white self-end mb-1 opacity-80 whitespace-nowrap mr-0.5">{msg.time}</span>
                                            )}

                                            {/* Bubble */}
                                            <div className={clsx(
                                                "relative px-4 py-2.5 text-[15px] shadow-sm break-words leading-relaxed",
                                                msg.sender === 'user'
                                                    ? "bg-[#8DE055] text-black rounded-[20px] rounded-tr-none"
                                                    : "bg-white text-black rounded-[20px] rounded-tl-none pr-5 pl-4"
                                            )}>
                                                {/* Tail CSS would be handled here in proper CSS but using simple rounded trick for now */}
                                                {/* Left Tail (Bot) */}
                                                {msg.sender === 'bot' && (
                                                    <svg className="absolute top-[5px] -left-[9px] w-5 h-5 text-white fill-current" viewBox="0 0 20 20">
                                                        <path d="M20 0 C 20 0 0 0 8 12 L 20 18 Z" transform="rotate(-15 10 10)" />
                                                        <path d="M8.5,0.7 C8.5,0.7 0.9,1.1 0.4,9.6 C-0.1,16.8 6.5,13.9 6.5,13.9" fill="none" />
                                                    </svg>
                                                )}
                                                {/* Right Tail (User) */}
                                                {msg.sender === 'user' && (
                                                    <svg className="absolute top-[5px] -right-[9px] w-5 h-5 text-[#8DE055] fill-current" viewBox="0 0 20 20" style={{ transform: 'scaleX(-1)' }}>
                                                        <path d="M20 0 C 20 0 0 0 8 12 L 20 18 Z" transform="rotate(-15 10 10)" />
                                                    </svg>
                                                )}

                                                {msg.content}
                                            </div>

                                            {/* Timestamp Right for Bot */}
                                            {msg.sender === 'bot' && (
                                                <span className="text-[10px] text-white self-end mb-1 opacity-80 whitespace-nowrap ml-0.5">{msg.time}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex w-full justify-start animate-in fade-in duration-300">
                                <div className="flex gap-2 max-w-[85%] items-start">
                                    <div className="h-[42px] w-[42px] flex-shrink-0 mt-0 rounded-full overflow-hidden border border-gray-100 bg-white">
                                        <img src="/kaeru_profile.png" alt="Kaeru" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <div className="relative bg-white text-black rounded-[20px] rounded-tl-none px-4 py-3 shadow-sm flex gap-1 items-center h-[42px]">
                                            <svg className="absolute top-[5px] -left-[9px] w-5 h-5 text-white fill-current" viewBox="0 0 20 20">
                                                <path d="M20 0 C 20 0 0 0 8 12 L 20 18 Z" transform="rotate(-15 10 10)" />
                                            </svg>
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {renderInlineInput()}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Fixed Input Area */}
                {showFixedInput && (
                    <div className="flex-none bg-white border-t border-gray-200 p-2 pb-8 sm:pb-3 px-3 animate-in slide-in-from-bottom-10 fade-in duration-300">
                        {renderFixedInput()}
                    </div>
                )}

                {/* Fallback space if no input, just to keep clean look */}
                {!showFixedInput && (
                    <div className="flex-none bg-[#7293C3] h-2"></div>
                )}
            </div>
        </div>
    );
}
