'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronRight, RotateCcw, Save, History, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetDescription,
} from "@/components/ui/sheet";
import { Label } from '@/components/ui/label';
import { Textarea } from "@/components/ui/textarea";

interface Topic {
    id: string;
    title: string;
}

interface Node {
    id: string;
    type: string;
    content: string;
    data: any;
}

interface Edge {
    id: string;
    source: string;
    target: string;
    label: string;
}

interface HistoryItem {
    type: 'topic' | 'option';
    label: string;
    id: string;
}

interface Customer {
    name: string;
    phone: string;
    email: string;
}

interface SessionRecord {
    id: string;
    created_at: string;
    customer: Customer;
    session_data: HistoryItem[];
    memo?: string;
}

export default function CounselingPage() {
    const [topics, setTopics] = useState<Topic[]>([]);
    const [filterText, setFilterText] = useState('');
    const [loading, setLoading] = useState(true);

    // Customer State
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [isIntakeOpen, setIsIntakeOpen] = useState(false);
    const [tempCustomer, setTempCustomer] = useState<Customer>({ name: '', phone: '', email: '' });

    // Session State
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [currentNode, setCurrentNode] = useState<Node | null>(null);
    const [memo, setMemo] = useState('');

    // Visual History Stack (Current Session Data)
    const [historyStack, setHistoryStack] = useState<HistoryItem[]>([]);

    // Overall Session Log (Accumulated from multiple topics for one customer)
    // Actually, the user requirement says "save all the counseling session... save all topics and answers"
    // So we might want to let them explore multiple topics and 'Finish' them, accumulating a larger log?
    // Or just save the current stack?
    // "save all the topics and answers, that we used in that customer" -> implies persistent session across topics.
    // For simplicity, we will accumulate historyStack into a master list when they "Reset" or switch topics?
    // Let's keep it simple: We just save the CURRENT `historyStack`. If they want to save multiple flows, they do it one by one or we explicitly support multi-session.
    // Re-reading: "after the counseling when all the customer is done. we have a save button where we can save all the topics and answers"
    // This implies we should APPEND current flow to a master list.
    const [fullSessionLog, setFullSessionLog] = useState<HistoryItem[]>([]);

    // History Sidebar State
    const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    useEffect(() => {
        fetchTopics();
    }, []);

    useEffect(() => {
        // Check if customer is set, if not open intake
        if (!customer) {
            setIsIntakeOpen(true);
        }
    }, [customer]);

    const fetchTopics = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('counseling_topics')
            .select('id, title')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching topics:', error);
        } else {
            setTopics(data || []);
        }
        setLoading(false);
    };

    const handleIntakeSubmit = () => {
        if (!tempCustomer.name.trim()) {
            alert("Name is required.");
            return;
        }
        setCustomer(tempCustomer);
        setIsIntakeOpen(false);
    };

    const handleTopicClick = async (topic: Topic) => {
        setLoading(true);
        try {
            // Fetch flow data
            const { data: dbNodes, error: nodesError } = await supabase
                .from('counseling_nodes')
                .select('*')
                .eq('topic_id', topic.id);
            if (nodesError) throw nodesError;

            const { data: dbEdges, error: edgesError } = await supabase
                .from('counseling_edges')
                .select('*')
                .eq('topic_id', topic.id);
            if (edgesError) throw edgesError;

            setNodes(dbNodes || []);
            setEdges(dbEdges || []);

            // Find start node
            const targetIds = new Set((dbEdges || []).map((e: any) => e.target));
            const startNode = (dbNodes || []).find((n: any) => !targetIds.has(n.id)) || (dbNodes || [])[0];

            if (startNode) {
                setSelectedTopic(topic);
                setCurrentNode(startNode);
                // Start tracking this flow
                setHistoryStack([{ type: 'topic', label: topic.title, id: topic.id }]);
            } else {
                alert('This topic has no content.');
            }
        } catch (error) {
            console.error('Error loading topic:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOptionClick = (edge: Edge, label: string) => {
        const targetNode = nodes.find(n => n.id === edge.target);
        if (targetNode) {
            setHistoryStack(prev => [...prev, { type: 'option', label: label, id: edge.id }]);
            setCurrentNode(targetNode);
        }
    };

    // "Finish Topic" or just appending to log
    // We'll treat the current historyStack as the "active" session part.
    // We can just add it to fullSessionLog when they reset or save.
    // But the UI shows historyStack. Let's make fullSessionLog ONLY update on Save?
    // Actually, if they navigate multiple topics, the historyStack resets.
    // So we need to PERSIST historyStack to fullSessionLog before resetting.
    const finishCurrentTopic = () => {
        if (historyStack.length > 0) {
            setFullSessionLog(prev => [...prev, ...historyStack]);
        }
        // Reset local state
        setSelectedTopic(null);
        setCurrentNode(null);
        setHistoryStack([]);
        setNodes([]);
        setEdges([]);
        // We DON'T reset customer or fullSessionLog
    };

    const handleSaveSession = async () => {
        if (!customer) {
            alert("No customer data found.");
            return;
        }

        // Combine any active history with the log
        const sessionDataToSave = [...fullSessionLog, ...historyStack];

        if (sessionDataToSave.length === 0) {
            alert("No session data to save.");
            return;
        }

        setLoading(true);
        try {
            // 1. Insert Customer
            const { data: customerData, error: customerError } = await supabase
                .from('counseling_customers')
                .insert([customer])
                .select()
                .single();

            if (customerError) throw customerError;

            // 2. Insert Session
            const { error: sessionError } = await supabase
                .from('counseling_sessions')
                .insert([{
                    customer_id: customerData.id,
                    session_data: sessionDataToSave,
                    memo: memo
                }]);

            if (sessionError) throw sessionError;

            toast.success("Session saved successfully!");

            // 3. Reset Everything
            setTempCustomer({ name: '', phone: '', email: '' });
            setFullSessionLog([]);
            setHistoryStack([]);
            setSelectedTopic(null);
            setCurrentNode(null);
            setCustomer(null); // This will trigger the useEffect to open intake
            setMemo(''); // Reset memo

        } catch (error: any) {
            console.error('Error saving session:', error);
            toast.error(`Failed to save session: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        const { data, error } = await supabase
            .from('counseling_sessions')
            .select(`
                id,
                created_at,
                session_data,
                memo,
                customer:counseling_customers (name, email, phone)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching history:", error);
        } else {
            // Transform data to match interface if needed, relying on Supabase join
            setSessionHistory(data as any || []);
        }
    };

    const handleUndo = () => {
        if (historyStack.length === 0) return;

        const newStack = historyStack.slice(0, -1);
        setHistoryStack(newStack);

        if (newStack.length === 0) {
            // Back to topic list
            setSelectedTopic(null);
            setCurrentNode(null);
            setNodes([]);
            setEdges([]);
            return;
        }

        const lastItem = newStack[newStack.length - 1];
        if (lastItem.type === 'topic') {
            // We are back at the start of the topic
            // We need to re-find the start node.
            const targetIds = new Set(edges.map((e) => e.target));
            const startNode = nodes.find((n) => !targetIds.has(n.id)) || nodes[0];
            setCurrentNode(startNode);
        } else {
            // It was an option.
            const edge = edges.find(e => e.id === lastItem.id);
            if (edge) {
                const targetNode = nodes.find(n => n.id === edge.target);
                setCurrentNode(targetNode || null);
            } else {
                // Fallback
                const targetIds = new Set(edges.map((e) => e.target));
                const startNode = nodes.find((n) => !targetIds.has(n.id)) || nodes[0];
                setCurrentNode(startNode);
            }
        }
    };

    // Render Logic
    const renderCurrentOptions = () => {
        if (loading) {
            return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>;
        }

        if (!selectedTopic) {
            const filteredTopics = topics.filter(topic =>
                topic.title.toLowerCase().includes(filterText.toLowerCase())
            );

            return (
                <div className="space-y-6">
                    <Input
                        placeholder="Filter topics..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="max-w-md"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {filteredTopics.map(topic => (
                            <Button
                                key={topic.id}
                                variant="outline"
                                className="h-auto py-6 text-lg font-medium justify-start px-6 border-2 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                                onClick={() => handleTopicClick(topic)}
                            >
                                {topic.title}
                            </Button>
                        ))}
                    </div>
                </div>
            );
        }

        // 2. Topic Selected -> Show Current Node Options
        if (!currentNode) return null;

        const data = currentNode.data || {};
        const branches = data.branches || [];

        // If we have explicit branches (New BranchNode system), use them
        if (branches.length > 0) {
            return (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {currentNode.content && (
                        <div className="text-xl font-semibold text-gray-800 mb-6">
                            {currentNode.content}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {branches.map((branchLabel: string, index: number) => {
                            const edge = edges.find(e => e.source === currentNode.id && e.label === `branch-${index}`);

                            return (
                                <Button
                                    key={index}
                                    variant="outline"
                                    className="h-auto py-4 text-lg justify-start px-6 border-2 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                                    onClick={() => {
                                        if (edge) {
                                            handleOptionClick(edge, branchLabel);
                                        } else {
                                            toast.error("This option is not connected to a next step.");
                                        }
                                    }}
                                >
                                    {branchLabel}
                                </Button>
                            );
                        })}
                    </div>
                    {/* Allow abandoning topic or finishing if stuck */}
                    <div className="mt-8 pt-4 border-t">
                        <Button variant="ghost" onClick={finishCurrentTopic} className="text-gray-500 hover:text-gray-700">
                            Back to Topics (Keep Progress)
                        </Button>
                    </div>
                </div>
            );
        }

        // Fallback for legacy nodes
        const currentOptions = edges.filter(e => e.source === currentNode.id);
        const isDropdown = currentNode.type === 'answer' && data.type === 'select';

        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {currentNode.content && (
                    <div className="text-xl font-semibold text-gray-800 mb-6">
                        {currentNode.content}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentOptions.map(edge => {
                        let label = edge.label;
                        if (isDropdown && edge.label && edge.label.startsWith('option-')) {
                            const index = parseInt(edge.label.split('-')[1]);
                            if (!isNaN(index) && data.options && data.options[index]) {
                                label = data.options[index];
                            }
                        }
                        if (!label) label = "Continue";

                        return (
                            <Button
                                key={edge.id}
                                variant="outline"
                                className="h-auto py-4 text-lg justify-start px-6 border-2 hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                                onClick={() => handleOptionClick(edge, label)}
                            >
                                {label}
                            </Button>
                        );
                    })}

                    {currentOptions.length === 0 && (
                        <div className="col-span-full">
                            <div className="text-gray-500 italic mb-4">End of path.</div>
                            <Button onClick={finishCurrentTopic}>
                                Finish Topic
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-white p-8 md:p-12 max-w-4xl mx-auto relative">

            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Counseling Guide</h1>
                    {customer && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <User size={14} />
                            <span>{customer.name}</span>
                            {customer.phone && <span>• {customer.phone}</span>}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {historyStack.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleUndo} className="text-gray-500 hover:text-gray-800">
                            <RotateCcw size={16} className="mr-2" />
                            Undo
                        </Button>
                    )}
                    <Sheet open={isHistoryOpen} onOpenChange={(open) => {
                        setIsHistoryOpen(open);
                        if (open) fetchHistory();
                    }}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <History size={16} className="mr-2" />
                                History
                            </Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle>Session History</SheetTitle>
                                <SheetDescription>
                                    Past counseling sessions.
                                </SheetDescription>
                            </SheetHeader>
                            <div className="mt-8 space-y-4 overflow-y-auto max-h-[80vh]">
                                {sessionHistory.map(session => (
                                    <div key={session.id} className="p-4 border rounded-lg space-y-2">
                                        <div className="font-semibold">{session.customer?.name || 'Unknown'}</div>
                                        <div className="text-xs text-gray-400">
                                            {new Date(session.created_at).toLocaleString()}
                                        </div>
                                        <div className="text-sm text-gray-600 pl-2 border-l-2">
                                            {session.session_data && Array.isArray(session.session_data)
                                                ? (session.session_data as HistoryItem[]).map((item, i) => (
                                                    <div key={i}>{item.label}</div>
                                                ))
                                                : 'No data'}
                                        </div>
                                        {session.memo && (
                                            <div className="mt-2 text-sm bg-yellow-50 p-2 rounded border border-yellow-100 italic text-gray-600">
                                                Memo: {session.memo}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>

                    <Link href="/admin/counseling/counseling-builder">
                        <Button variant="outline" size="sm">
                            Go to Builder
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="space-y-6 pb-24">
                {/* Full Session Log (Previous Topics) */}
                {fullSessionLog.length > 0 && (
                    <div className="flex flex-col gap-2 opacity-60">
                        {fullSessionLog.map((item, index) => (
                            <div key={`log-${index}`} className="text-lg font-bold text-gray-500 pl-4 border-l-4 border-gray-300">
                                {item.label}
                            </div>
                        ))}
                        <div className="border-b border-gray-200 my-4" />
                    </div>
                )}

                {/* Current History Stack */}
                <div className="flex flex-col gap-2 relative group">
                    <AnimatePresence>
                        {historyStack.map((item, index) => (
                            <motion.div
                                key={`curr-${index}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex items-center group/item"
                            >
                                <div className="text-2xl font-bold text-gray-900 pl-4 border-l-4 border-blue-500 flex-1">
                                    {item.label}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* Floating Undo near current stack if prefered, but header approach is cleaner. 
                        Let's also add a small inline undo capability or just rely on the header button?
                        User asked: "can we have an undo button to go back i step."
                        I put it in the header. That should be visible enough. 
                        Actually, let's also put one right below the stack for better UX?
                        "when picked the topics will stacked in the top... can we have an undo button to go back i step"
                        
                        I'll stick to the header button I added above, plus maybe a small one near the stack if needed.
                        Let's review the code I added in the ReplacementContent.
                        Yes, I added it in the Header area:
                        
                        ```tsx
                        {historyStack.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={handleUndo} className="text-gray-500 hover:text-gray-800">
                                <RotateCcw size={16} className="mr-2" />
                                Undo
                            </Button>
                        )}
                        ```
                        
                        This is good.
                    */}
                </div>

                {/* Current Selection Area */}
                <div className="pt-4">
                    {renderCurrentOptions()}
                </div>
            </div>

            {/* Floating Save Button */}
            {(customer && (fullSessionLog.length > 0 || historyStack.length > 0)) && (
                <div className="fixed bottom-8 right-8">
                    <Button
                        size="lg"
                        onClick={handleSaveSession}
                        disabled={loading}
                        className="shadow-xl bg-green-600 hover:bg-green-700 text-white rounded-full px-8 py-6 text-lg font-semibold"
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                        Save Session
                    </Button>
                </div>
            )}

            {/* Memo Area */}
            {customer && (
                <div className="fixed bottom-8 left-8 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-40 transition-all hover:w-96 focus-within:w-96">
                    <Label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Counselor Memo</Label>
                    <Textarea
                        placeholder="Type notes here..."
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        className="min-h-[100px] resize-none border-0 bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                </div>
            )}

            {/* Intake Modal */}
            <Dialog open={isIntakeOpen} onOpenChange={setIsIntakeOpen}>
                <DialogContent className="sm:max-w-md" showCloseButton={!!customer}>
                    <DialogHeader>
                        <DialogTitle>New Counseling Session</DialogTitle>
                        <DialogDescription>
                            Please enter customer details to begin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                value={tempCustomer.name}
                                onChange={(e) => setTempCustomer({ ...tempCustomer, name: e.target.value })}
                                placeholder="Customer Name"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone">Phone (Optional)</Label>
                            <Input
                                id="phone"
                                value={tempCustomer.phone}
                                onChange={(e) => setTempCustomer({ ...tempCustomer, phone: e.target.value })}
                                placeholder="090-1234-5678"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email (Optional)</Label>
                            <Input
                                id="email"
                                value={tempCustomer.email}
                                onChange={(e) => setTempCustomer({ ...tempCustomer, email: e.target.value })}
                                placeholder="customer@example.com"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleIntakeSubmit}>Start Session</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
