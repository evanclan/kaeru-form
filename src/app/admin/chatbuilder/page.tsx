'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
    ReactFlow,
    addEdge,
    Background,
    Controls,
    Connection,
    Edge,
    Node,
    useNodesState,
    useEdgesState,
    ReactFlowProvider,
    Panel,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/lib/supabaseClient';
import QuestionNode from '@/components/admin/QuestionNode';
import AnswerNode from '@/components/admin/AnswerNode';
import CommentNode from '@/components/admin/CommentNode';
import { Plus, Save, Loader2, Trash2, MessageSquare, GitBranch, List, Clock, X, MoreVertical } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const nodeTypes = {
    question: QuestionNode as any,
    answer: AnswerNode as any,
    comment: CommentNode as any,
};

const AdminBuilder = () => {
    // Initialize with a unique ID to prevent collisions
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([
        {
            id: crypto.randomUUID(),
            type: 'comment',
            position: { x: 250, y: 50 },
            data: { content: 'Welcome to our service!', type: 'statement' },
        },
    ]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [saving, setSaving] = useState(false);
    const [flowId, setFlowId] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

    // Fetch Submissions
    const fetchSubmissions = useCallback(async () => {
        if (!flowId) return;
        try {
            const { data, error } = await supabase
                .from('submissions')
                .select('*')
                .eq('flow_id', flowId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSubmissions(data || []);
        } catch (error) {
            console.error('Error fetching submissions:', error);
        }
    }, [flowId]);

    useEffect(() => {
        if (showHistory) {
            fetchSubmissions();
        }
    }, [showHistory, fetchSubmissions]);

    // Helper to update node data
    const onNodeDataChange = useCallback((id: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return { ...node, data: newData };
                }
                return node;
            })
        );
    }, [setNodes]);

    // Delete node handler
    const onDeleteNode = useCallback((id: string) => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    }, [setNodes, setEdges]);

    // Auto-add next node logic
    const onAddNextNode = useCallback((sourceId: string, sourceHandle?: string) => {
        setNodes((nds) => {
            const sourceNode = nds.find((n) => n.id === sourceId);
            if (!sourceNode) return nds;

            const newId = crypto.randomUUID();
            // Calculate position
            const isSide = !!sourceHandle;
            const newPos = {
                x: sourceNode.position.x + (isSide ? 400 : 0),
                y: sourceNode.position.y + (isSide ? 0 : 200),
            };

            // Determine next node type based on source
            let nextType = 'question';
            let nextData: any = { type: 'text', content: '' };

            if (sourceNode.type === 'question') {
                // If question, usually followed by Answer (if it needs options) or another Question/Comment
                // Let's default to Answer for now as it's a common pattern requested
                nextType = 'answer';
                nextData = { type: 'select', options: ['Yes', 'No'] };
            } else if (sourceNode.type === 'answer') {
                // Answer usually leads to a new Question or Comment
                nextType = 'comment';
                nextData = { type: 'statement', content: '' };
            } else if (sourceNode.type === 'comment') {
                // Comment usually leads to a Question
                nextType = 'question';
                nextData = { type: 'text', content: '' };
            }

            const newNode: Node = {
                id: newId,
                type: nextType,
                position: newPos,
                data: {
                    ...nextData,
                    collapsed: false,
                    onCollapse: onCollapseNode,
                    onChange: onNodeDataChange,
                    onAddNext: onAddNextNode,
                    onDelete: onDeleteNode
                },
            };

            // Add Edge
            const newEdge: Edge = {
                id: crypto.randomUUID(),
                source: sourceId,
                target: newId,
                sourceHandle: sourceHandle,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                data: { condition: sourceHandle }
            };

            setEdges((eds) => addEdge(newEdge, eds));

            return [...nds, newNode];
        });
    }, [onNodeDataChange, onDeleteNode, setEdges, setNodes]);

    // Visibility Logic
    useEffect(() => {
        // 1. Identify roots (nodes with no incoming edges)
        // Note: We scan *all* edges to find incoming.
        // A node is a root if no edge targets it.
        const targetIds = new Set(edges.map(e => e.target));
        const roots = nodes.filter(n => !targetIds.has(n.id));

        // 2. BFS/Traversal
        // We need to determine which nodes are "reachable" from roots
        // NOT passing through a "collapsed" node.
        // HOWEVER, a collapsed node ITSELF is visible. Its children are hidden.

        const visibleNodes = new Set<string>();
        const queue: string[] = [];

        // Add all roots to start
        roots.forEach(r => {
            visibleNodes.add(r.id);
            queue.push(r.id);
        });

        // Also add any node that is already visible (e.g. if we have disconnected islands that user wants to see?
        // Actually, typically in a flow builder, disconnected nodes should probably be visible or we might lose them.
        // Let's assume all nodes default to visible unless hidden by a parent collapse.
        // Better strategy: "Accessibility" from roots or being a root/orphan.
        // If a node is an orphan (no incoming), it's a root.

        // Let's do a slightly different approach:
        // We iterate and mark nodes as hidden if ALL their incoming paths come from collapsed nodes.
        // BUT, we have cycles potentially.
        // Simplest robust way: 
        // Forward propagation of "energy".
        // Roots have energy.
        // Energy passes through non-collapsed nodes.
        // Nodes with energy are visible.

        // Wait, what if I drag a new node and it's not connected yet? It must be visible.
        // So Orphans are roots.

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const currentNode = nodes.find(n => n.id === currentId);
            if (!currentNode) continue;

            // If current node is NOT collapsed, it propagates visibility to children
            if (!currentNode.data.collapsed) {
                const childrenEdges = edges.filter(e => e.source === currentId);
                childrenEdges.forEach(edge => {
                    if (!visibleNodes.has(edge.target)) {
                        visibleNodes.add(edge.target);
                        queue.push(edge.target);
                    }
                });
            }
        }

        // 3. Update nodes visibility
        // We use setNodes with a functional update to avoid dependency cycles if possible, 
        // but here we are in an effect dependent on nodes/edges structure. 
        // We must be careful not to trigger infinite loop.
        // We only update if 'hidden' status changes.

        let changed = false;
        const newNodes = nodes.map(n => {
            const shouldBeHidden = !visibleNodes.has(n.id);
            if (n.hidden !== shouldBeHidden) {
                changed = true;
                return { ...n, hidden: shouldBeHidden };
            }
            return n;
        });

        if (changed) {
            setNodes(newNodes);

            // Also update edges visibility
            // An edge is hidden if its source or target is hidden
            const validNodeParams = new Set(visibleNodes); // visibleNodes contains IDs that ARE visible
            const newEdges = edges.map(e => {
                const isSourceVisible = validNodeParams.has(e.source);
                const isTargetVisible = validNodeParams.has(e.target);
                const shouldBeHidden = !isSourceVisible || !isTargetVisible;

                if (e.hidden !== shouldBeHidden) {
                    return { ...e, hidden: shouldBeHidden };
                }
                return e;
            });

            // Only set edges if there's a change to avoid loops
            const edgesChanged = newEdges.some((e, i) => e.hidden !== edges[i].hidden);
            if (edgesChanged) {
                setEdges(newEdges);
            }
        }

    }, [nodes.map(n => n.data.collapsed).join(','), edges.length, edges.map(e => e.target + e.source).join(',')]);
    // Note: The dependency array above is a heuristic to avoid deep object comparison on every render,
    // but ensures we re-run when topology or collapse state changes.

    const onCollapseNode = useCallback((id: string, collapsed: boolean) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, collapsed } };
                }
                return node;
            })
        );
    }, [setNodes]);

    // Inject handlers into nodes
    useEffect(() => {
        setNodes((nds) =>
            nds.map((node) => ({
                ...node,
                data: {
                    ...node.data,
                    onCollapse: onCollapseNode,
                    onChange: onNodeDataChange,
                    onAddNext: onAddNextNode,
                    onDelete: onDeleteNode
                },
            }))
        );
    }, [onNodeDataChange, onAddNextNode, onDeleteNode, onCollapseNode, setNodes]);

    const onConnect = useCallback(
        (params: Connection) => {
            const edgeData = params.sourceHandle ? { condition: params.sourceHandle } : undefined;
            const newEdge = { ...params, id: crypto.randomUUID(), type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed }, data: edgeData };
            setEdges((eds) => addEdge(newEdge as Edge, eds));
        },
        [setEdges]
    );

    const addNode = (type: 'question' | 'comment' | 'answer') => {
        const id = crypto.randomUUID();
        let data: any = { content: '', type: 'text' };

        if (type === 'comment') data = { content: 'New Statement', type: 'statement' };
        if (type === 'answer') data = { type: 'select', options: ['Option 1'] };
        if (type === 'question') data = { content: 'New Question', type: 'text' };

        const newNode: Node = {
            id,
            type,
            position: { x: 100 + nodes.length * 20, y: 100 + nodes.length * 20 },
            data: {
                ...data,
                collapsed: false,
                onCollapse: onCollapseNode,
                onChange: onNodeDataChange,
                onAddNext: onAddNextNode,
                onDelete: onDeleteNode
            },
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const clearCanvas = () => {
        if (confirm('Are you sure you want to clear the canvas?')) {
            setNodes([]);
            setEdges([]);
        }
    };

    const resetDatabase = async () => {
        if (!confirm('WARNING: This will delete ALL flows, nodes, and edges from the database. Are you sure?')) return;

        setSaving(true);
        try {
            // Delete all flows (cascades to nodes/edges/submissions)
            const { error } = await supabase.from('flows').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
            if (error) throw error;

            alert('Database reset successfully!');
            setFlowId(null);
            // Reset local state too
            setNodes([{
                id: crypto.randomUUID(),
                type: 'comment',
                position: { x: 250, y: 50 },
                data: {
                    content: 'Welcome to our service!',
                    type: 'statement',
                    collapsed: false,
                    onCollapse: onCollapseNode,
                    onChange: onNodeDataChange,
                    onAddNext: onAddNextNode,
                    onDelete: onDeleteNode
                },
            }]);
            setEdges([]);
        } catch (error: any) {
            console.error('Error resetting DB:', error);
            alert(`Error resetting DB: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const fetchFlow = useCallback(async () => {
        try {
            // Get the most recent flow
            const { data: flows, error: flowError } = await supabase
                .from('flows')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1);

            if (flowError) throw flowError;

            if (flows && flows.length > 0) {
                const flow = flows[0];
                setFlowId(flow.id);

                // Fetch nodes
                const { data: dbNodes, error: nodesError } = await supabase
                    .from('nodes')
                    .select('*')
                    .eq('flow_id', flow.id);

                if (nodesError) throw nodesError;

                // Fetch edges
                const { data: dbEdges, error: edgesError } = await supabase
                    .from('edges')
                    .select('*')
                    .eq('flow_id', flow.id);

                if (edgesError) throw edgesError;

                // Transform Nodes
                const newNodes: Node[] = (dbNodes || []).map((node: any) => {
                    let type = 'question';
                    let options = [];
                    let placeholder = '';
                    let componentType = 'question'; // Default

                    try {
                        const parsed = JSON.parse(node.options);
                        options = parsed.items || [];
                        placeholder = parsed.placeholder || '';
                        componentType = parsed.component || '';
                    } catch (e) {
                        // Fallback if options is not valid JSON
                    }

                    // Determine ReactFlow Node Type
                    if (componentType === 'answer') {
                        type = 'answer';
                    } else if (componentType === 'comment' || node.type === 'statement') {
                        type = 'comment';
                    } else if (node.type === 'select') {
                        // Legacy support for old nodes
                        type = 'answer';
                    } else {
                        // Default to question for text/email/date/etc if not explicitly marked as answer
                        type = 'question';
                    }

                    return {
                        id: node.id,
                        type,
                        position: { x: node.position_x, y: node.position_y },
                        data: {
                            type: node.type,
                            content: node.content,
                            options,
                            placeholder,
                            collapsed: false, // Default to expanded on load
                            onCollapse: onCollapseNode,
                            onChange: onNodeDataChange,
                            onAddNext: onAddNextNode,
                            onDelete: onDeleteNode
                        }
                    };
                });

                // Transform Edges
                const newEdges: Edge[] = (dbEdges || []).map((edge: any) => ({
                    id: edge.id,
                    source: edge.source_node,
                    target: edge.target_node,
                    sourceHandle: edge.condition,
                    type: 'smoothstep',
                    markerEnd: { type: MarkerType.ArrowClosed },
                    data: { condition: edge.condition }
                }));

                setNodes(newNodes);
                setEdges(newEdges);
            }
        } catch (error) {
            console.error('Error fetching flow:', error);
        }
    }, [onNodeDataChange, onAddNextNode, onDeleteNode, setNodes, setEdges]);

    // Initial fetch
    useEffect(() => {
        fetchFlow();
    }, [fetchFlow]);

    const saveFlow = async () => {
        setSaving(true);
        try {
            let currentFlowId = flowId;
            if (!currentFlowId) {
                const { data: flow, error: flowError } = await supabase
                    .from('flows')
                    .insert({ title: 'My New Flow', status: 'published' })
                    .select()
                    .single();

                if (flowError) throw flowError;
                currentFlowId = flow.id;
                setFlowId(flow.id);
            }

            await supabase.from('nodes').delete().eq('flow_id', currentFlowId);
            await supabase.from('edges').delete().eq('flow_id', currentFlowId);

            const dbNodes = nodes.map((node) => {
                const data = node.data as any;

                // Determine DB Type
                let dbType = data.type;

                // Ensure consistency for legacy or default cases
                if (node.type === 'answer' && !dbType) dbType = 'select';
                if (node.type === 'comment') dbType = 'statement';
                if (node.type === 'question' && !dbType) dbType = 'text';

                // Default content
                let content = data.content || '';
                if (node.type === 'answer' && dbType === 'select' && !content) content = 'Answer Options';

                return {
                    id: node.id,
                    flow_id: currentFlowId,
                    type: dbType,
                    content: content,
                    options: JSON.stringify({
                        items: data.options || [],
                        placeholder: data.placeholder,
                        component: node.type // Save the ReactFlow node type as metadata
                    }),
                    position_x: node.position.x,
                    position_y: node.position.y,
                };
            });

            const { error: nodesError } = await supabase.from('nodes').insert(dbNodes);
            if (nodesError) throw nodesError;

            // Filter out edges that point to non-existent nodes (phantom edges)
            const validNodeIds = new Set(nodes.map(n => n.id));
            const validEdges = edges.filter(edge =>
                validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
            );

            const dbEdges = validEdges.map((edge) => ({
                id: edge.id,
                flow_id: currentFlowId,
                source_node: edge.source,
                target_node: edge.target,
                condition: edge.data?.condition as string || null
            }));

            const { error: edgesError } = await supabase.from('edges').insert(dbEdges);
            if (edgesError) throw edgesError;

            alert('Flow saved successfully!');
        } catch (error: any) {
            console.error('Error saving flow:', error);
            alert(`Error saving flow: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const deleteSubmission = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this session?')) return;

        try {
            const { error } = await supabase.from('submissions').delete().eq('id', id);
            if (error) throw error;

            setSubmissions(prev => prev.filter(s => s.id !== id));
            if (selectedSubmission?.id === id) setSelectedSubmission(null);
        } catch (error) {
            console.error('Error deleting submission:', error);
            alert('Failed to delete session');
        }
    };

    return (
        <div className="h-[calc(100vh-70px)] w-full bg-gray-50 relative overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
                maxZoom={4}
            >
                <Background gap={20} color="#e5e7eb" />
                <Controls />
                <Panel position="top-right" className="flex gap-2">
                    <Button
                        variant="destructive"
                        onClick={resetDatabase}
                        className="gap-2"
                        title="Delete ALL data"
                    >
                        <Trash2 size={16} />
                        Reset DB
                    </Button>
                    <Button
                        variant="outline"
                        onClick={clearCanvas}
                        className="gap-2 bg-white"
                    >
                        <Trash2 size={16} />
                        Clear Canvas
                    </Button>

                    <div className="flex bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
                        <Button
                            variant="ghost"
                            onClick={() => addNode('comment')}
                            className="rounded-none border-r border-gray-100 hover:bg-gray-50 px-3"
                            title="Add Comment"
                        >
                            <MessageSquare size={18} className="text-gray-700" />
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => addNode('question')}
                            className="rounded-none border-r border-gray-100 hover:bg-gray-50 px-3"
                            title="Add Question"
                        >
                            <GitBranch size={18} className="text-gray-700" />
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => addNode('answer')}
                            className="rounded-none hover:bg-gray-50 px-3"
                            title="Add Answer Options"
                        >
                            <List size={18} className="text-gray-700" />
                        </Button>
                    </div>

                    <Sheet open={showHistory} onOpenChange={setShowHistory}>
                        <SheetTrigger asChild>
                            <Button
                                variant={showHistory ? "secondary" : "outline"}
                                className={`gap-2 ${showHistory ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-white'}`}
                            >
                                <Clock size={16} />
                                History
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full">
                            <SheetHeader>
                                <SheetTitle className="flex items-center gap-2">
                                    <Clock size={18} className="text-blue-500" />
                                    Session History
                                </SheetTitle>
                                <SheetDescription>
                                    View past chat sessions and submissions.
                                </SheetDescription>
                            </SheetHeader>
                            <Separator className="my-4" />
                            <ScrollArea className="flex-1 -mx-6 px-6">
                                <div className="space-y-3 pb-4">
                                    {submissions.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 text-sm">
                                            No sessions recorded yet.
                                        </div>
                                    ) : (
                                        submissions.map((sub) => (
                                            <Card
                                                key={sub.id}
                                                onClick={() => setSelectedSubmission(sub)}
                                                className="cursor-pointer hover:bg-blue-50/50 hover:border-blue-200 transition-all group"
                                            >
                                                <CardContent className="p-4">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                                                            Session
                                                        </Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 -mr-2 -mt-2 text-gray-300 hover:text-destructive hover:bg-transparent"
                                                            onClick={(e) => deleteSubmission(sub.id, e)}
                                                            title="Delete Session"
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </div>
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-xs text-muted-foreground group-hover:text-blue-600 transition-colors">
                                                            {new Date(sub.created_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 truncate mt-2 font-medium">
                                                        {Object.keys(sub.answers || {}).length} answers recorded
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </SheetContent>
                    </Sheet>

                    <Button
                        onClick={saveFlow}
                        disabled={saving}
                        className="gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Save Flow
                    </Button>
                </Panel>
            </ReactFlow>

            {/* Submission Details Modal */}
            <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Session Details</DialogTitle>
                        <DialogDescription>
                            {selectedSubmission && new Date(selectedSubmission.created_at).toLocaleString()}
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 -mx-6 px-6 border-y bg-gray-50/50">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Question ID</TableHead>
                                    <TableHead>Answer</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedSubmission && Object.entries(selectedSubmission.answers || {}).map(([key, value]: [string, any]) => (
                                    <TableRow key={key}>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {key.slice(0, 8)}...
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {String(value)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {selectedSubmission && Object.keys(selectedSubmission.answers || {}).length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                                            No answers in this session.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>

                    <DialogFooter>
                        <Button onClick={() => setSelectedSubmission(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default function AdminPage() {
    return (
        <ReactFlowProvider>
            <AdminBuilder />
        </ReactFlowProvider>
    );
}
