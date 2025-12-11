'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
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
import BranchNode from '@/components/counseling/builder/BranchNode';
import { Save, Loader2, Trash2, GitBranch, ArrowLeft, Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const nodeTypes = {
    branch: BranchNode as any,
};

const CounselingBuilderContent = () => {
    const searchParams = useSearchParams();
    const topicId = searchParams.get('topicId');
    const router = useRouter();

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [topicTitle, setTopicTitle] = useState('');

    // Import Topic State
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importTarget, setImportTarget] = useState<{ nodeId: string, handleId: string } | null>(null);
    const [topics, setTopics] = useState<any[]>([]);
    const [dashboardLoading, setDashboardLoading] = useState(true);

    // Fetch Topics Helper
    const fetchTopics = useCallback(async () => {
        setDashboardLoading(true);
        const { data, error } = await supabase
            .from('counseling_topics')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching topics:', error);
        else setTopics(data || []);
        setDashboardLoading(false);
    }, []);

    // Import Handlers
    const onRequestImport = useCallback((nodeId: string, handleId: string) => {
        setImportTarget({ nodeId, handleId });
        setIsImportDialogOpen(true);
        // Ensure topics are loaded
        if (topics.length === 0) fetchTopics();
    }, [topics, fetchTopics]);

    const handleImportTopic = async (targetTopicId: string) => {
        if (!importTarget || !topicId) return;
        setLoading(true);
        setIsImportDialogOpen(false);

        try {
            // 1. Fetch nodes and edges of the target topic
            const { data: dbNodes, error: nodesError } = await supabase
                .from('counseling_nodes')
                .select('*')
                .eq('topic_id', targetTopicId);
            if (nodesError) throw nodesError;

            const { data: dbEdges, error: edgesError } = await supabase
                .from('counseling_edges')
                .select('*')
                .eq('topic_id', targetTopicId);
            if (edgesError) throw edgesError;

            if (!dbNodes || dbNodes.length === 0) {
                toast.error("The selected topic has no flow to import.");
                setLoading(false);
                return;
            }

            // 2. Map old IDs to new IDs to prevent collisions
            const idMap = new Map<string, string>();
            dbNodes.forEach((node: any) => {
                idMap.set(node.id, crypto.randomUUID());
            });

            // 3. Find the "Root" node(s) of the imported flow (nodes with no incoming edges within the set)
            const targetNodeIds = new Set(dbEdges?.map((e: any) => e.target));
            const rootNodes = dbNodes.filter((n: any) => !targetNodeIds.has(n.id));

            // Let's pick the first one found as the "entry point".
            const entryNode = rootNodes.length > 0 ? rootNodes[0] : dbNodes[0];
            const entryNodeNewId = idMap.get(entryNode.id)!;

            // 4. Calculate Position Offset
            // We want to place the entry node to the right of the source node.
            const sourceNode = nodes.find(n => n.id === importTarget.nodeId);
            const startX = sourceNode ? sourceNode.position.x + 400 : 0;
            const startY = sourceNode ? sourceNode.position.y : 0;

            // Calculate offset based on entry node's original position
            const offsetX = startX - entryNode.position_x;
            const offsetY = startY - entryNode.position_y;

            // 5. Create New Nodes
            const newImportedNodes: Node[] = dbNodes.map((node: any) => {
                const newId = idMap.get(node.id)!;
                const data = node.data || {};

                // Ensure branch structure
                let branches = data.branches || [];
                if (!branches.length && data.options) branches = data.options;
                if (!branches.length && node.type === 'answer') branches = ['Yes', 'No'];

                return {
                    id: newId,
                    type: 'branch',
                    position: {
                        x: node.position_x + offsetX,
                        y: node.position_y + offsetY
                    },
                    data: {
                        ...data,
                        content: node.content,
                        branches: branches,
                        onChange: onNodeDataChange,
                        onAddNext: onAddNextNode,
                        onDelete: onDeleteNode,
                        onRequestImport: onRequestImport
                    }
                };
            });

            // 6. Create New Edges (Internal to imported flow)
            const newImportedEdges: Edge[] = (dbEdges || []).map((edge: any) => ({
                id: crypto.randomUUID(),
                source: idMap.get(edge.source)!,
                target: idMap.get(edge.target)!,
                sourceHandle: edge.label,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                data: { label: edge.label }
            }));

            // 7. Create Connection Edge (Source -> Entry Node)
            const connectionEdge: Edge = {
                id: crypto.randomUUID(),
                source: importTarget.nodeId,
                target: entryNodeNewId,
                sourceHandle: importTarget.handleId,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                data: { label: importTarget.handleId }
            };

            // 8. Update State
            setNodes((nds) => [...nds, ...newImportedNodes]);
            setEdges((eds) => [...eds, ...newImportedEdges, connectionEdge]);

            toast.success(`Successfully imported flow from topic.`);

        } catch (error: any) {
            console.error('Error importing topic:', error);
            toast.error(`Failed to import topic: ${error.message}`);
        } finally {
            setLoading(false);
            setImportTarget(null);
        }
    };

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
            const isSide = !!sourceHandle;
            const newPos = {
                x: sourceNode.position.x + (isSide ? 400 : 0),
                y: sourceNode.position.y + (isSide ? 0 : 300),
            };

            const newNode: Node = {
                id: newId,
                type: 'branch',
                position: newPos,
                data: {
                    content: '',
                    branches: ['Next'],
                    onChange: onNodeDataChange,
                    onAddNext: onAddNextNode,
                    onDelete: onDeleteNode,
                    onRequestImport: onRequestImport
                },
            };

            const newEdge: Edge = {
                id: crypto.randomUUID(),
                source: sourceId,
                target: newId,
                sourceHandle: sourceHandle,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                data: { label: sourceHandle }
            };

            setEdges((eds) => addEdge(newEdge, eds));

            return [...nds, newNode];
        });
    }, [onNodeDataChange, onDeleteNode, setEdges, setNodes, onRequestImport]);

    // Fetch Flow Data
    const fetchFlow = useCallback(async () => {
        if (!topicId) return;
        setLoading(true);
        try {
            // Fetch Topic Info
            const { data: topic } = await supabase
                .from('counseling_topics')
                .select('title')
                .eq('id', topicId)
                .single();

            if (topic) setTopicTitle(topic.title);

            // Fetch Nodes
            const { data: dbNodes, error: nodesError } = await supabase
                .from('counseling_nodes')
                .select('*')
                .eq('topic_id', topicId);

            if (nodesError) throw nodesError;

            // Fetch Edges
            const { data: dbEdges, error: edgesError } = await supabase
                .from('counseling_edges')
                .select('*')
                .eq('topic_id', topicId);

            if (edgesError) throw edgesError;

            // Transform Nodes
            const newNodes: Node[] = (dbNodes || []).map((node: any) => {
                const data = node.data || {};

                // Map old types to branch structure if needed
                let branches = data.branches || [];
                if (!branches.length && data.options) {
                    branches = data.options;
                }
                if (!branches.length && node.type === 'answer') {
                    branches = ['Yes', 'No']; // Default for old answer nodes
                }
                if (!branches.length) {
                    // For linear nodes, maybe add a default branch?
                    // Or leave empty. Let's leave empty and let user add.
                }

                return {
                    id: node.id,
                    type: 'branch', // Force type to branch
                    position: { x: node.position_x, y: node.position_y },
                    data: {
                        ...data,
                        content: node.content,
                        branches: branches,
                        onChange: onNodeDataChange,
                        onAddNext: onAddNextNode,
                        onDelete: onDeleteNode,
                        onRequestImport: onRequestImport
                    }
                };
            });

            // Transform Edges
            const newEdges: Edge[] = (dbEdges || []).map((edge: any) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.label,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed },
                data: { label: edge.label }
            }));

            if (newNodes.length === 0) {
                // Initialize with a default node if empty
                setNodes([{
                    id: crypto.randomUUID(),
                    type: 'branch',
                    position: { x: 250, y: 50 },
                    data: {
                        content: `Start of ${topic?.title || 'Counseling'}`,
                        branches: ['Start'],
                        onChange: onNodeDataChange,
                        onAddNext: onAddNextNode,
                        onDelete: onDeleteNode,
                        onRequestImport: onRequestImport
                    },
                }]);
            } else {
                setNodes(newNodes);
                setEdges(newEdges);
            }

        } catch (error) {
            console.error('Error fetching flow:', error);
        } finally {
            setLoading(false);
        }
    }, [topicId, onNodeDataChange, onAddNextNode, onDeleteNode, setNodes, setEdges, onRequestImport]);

    useEffect(() => {
        fetchFlow();
    }, [fetchFlow]);

    const onConnect = useCallback(
        (params: Connection) => {
            const edgeData = params.sourceHandle ? { label: params.sourceHandle } : undefined;
            const newEdge = { ...params, id: crypto.randomUUID(), type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed }, data: edgeData };
            setEdges((eds) => addEdge(newEdge as Edge, eds));
        },
        [setEdges]
    );

    const addNode = () => {
        const id = crypto.randomUUID();
        const newNode: Node = {
            id,
            type: 'branch',
            position: { x: 100 + nodes.length * 20, y: 100 + nodes.length * 20 },
            data: {
                content: 'New Branch Node',
                branches: ['Next'],
                onChange: onNodeDataChange,
                onAddNext: onAddNextNode,
                onDelete: onDeleteNode,
                onRequestImport: onRequestImport
            },
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const saveFlow = async () => {
        if (!topicId) return;
        setSaving(true);
        try {
            await supabase.from('counseling_edges').delete().eq('topic_id', topicId);
            await supabase.from('counseling_nodes').delete().eq('topic_id', topicId);

            const dbNodes = nodes.map((node) => {
                const { onChange, onAddNext, onDelete, onRequestImport, ...nodeData } = node.data as any;
                return {
                    id: node.id,
                    topic_id: topicId,
                    type: 'branch', // Always save as branch
                    content: nodeData.content || '',
                    position_x: node.position.x,
                    position_y: node.position.y,
                    data: nodeData
                };
            });

            const { error: nodesError } = await supabase.from('counseling_nodes').insert(dbNodes);
            if (nodesError) throw nodesError;

            const dbEdges = edges.map((edge) => ({
                id: edge.id,
                topic_id: topicId,
                source: edge.source,
                target: edge.target,
                label: edge.data?.label as string || edge.sourceHandle || null
            }));

            const { error: edgesError } = await supabase.from('counseling_edges').insert(dbEdges);
            if (edgesError) throw edgesError;

            toast.success('Flow saved successfully!');
        } catch (error: any) {
            console.error('Error saving flow:', error);
            toast.error(`Error saving flow: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!topicId) {
            fetchTopics();
        }
    }, [topicId, fetchTopics]);

    const createTopic = async () => {
        if (!topicTitle.trim()) return;
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('counseling_topics')
                .insert({ title: topicTitle, description: 'Created via Builder' })
                .select()
                .single();

            if (error) throw error;

            router.push(`/admin/counseling/counseling-builder?topicId=${data.id}`);
        } catch (error: any) {
            console.error('Error creating topic:', error);
            toast.error('Failed to create topic');
        } finally {
            setSaving(false);
        }
    };

    const deleteTopic = async (id: string, e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Confirmation is now handled by AlertDialog in UI

        setDashboardLoading(true);
        try {
            // Delete related data first
            await supabase.from('counseling_edges').delete().eq('topic_id', id);
            await supabase.from('counseling_nodes').delete().eq('topic_id', id);

            // Delete the topic
            const { error } = await supabase
                .from('counseling_topics')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success("Topic deleted successfully.");
            fetchTopics();
        } catch (error: any) {
            console.error('Error deleting topic:', error);
            toast.error('Failed to delete topic');
            setDashboardLoading(false);
        }
    };

    if (!topicId) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Counseling Builder</h1>
                            <p className="text-gray-500 mt-2">Manage and build counseling guides.</p>
                        </div>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                                    <Plus size={16} />
                                    New Topic
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create New Topic</DialogTitle>
                                    <DialogDescription>
                                        Start a new counseling guide.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Topic Title</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g. Working Holiday"
                                            value={topicTitle}
                                            onChange={(e) => setTopicTitle(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={createTopic} disabled={saving || !topicTitle.trim()}>
                                        {saving ? <Loader2 className="animate-spin" size={16} /> : 'Create'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {dashboardLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-gray-400" size={32} />
                        </div>
                    ) : topics.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
                            <GitBranch className="mx-auto h-12 w-12 text-gray-300" />
                            <h3 className="mt-4 text-lg font-medium text-gray-900">No topics yet</h3>
                            <p className="mt-2 text-gray-500">Create your first topic to get started.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {topics.map((topic) => (
                                <div key={topic.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all p-6 flex flex-col justify-between h-full group relative">
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg text-gray-900 pr-8">{topic.title}</h3>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Delete Topic"
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete the topic
                                                            "{topic.title}" and all its associated flow data.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            className="bg-red-600 hover:bg-red-700"
                                                            onClick={(e) => deleteTopic(topic.id, e)}
                                                        >
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                        <p className="text-sm text-gray-500 line-clamp-2">
                                            {topic.description || 'No description'}
                                        </p>
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                                        <span className="text-xs text-gray-400">
                                            {new Date(topic.created_at).toLocaleDateString()}
                                        </span>
                                        <Link href={`/admin/counseling/counseling-builder?topicId=${topic.id}`}>
                                            <Button variant="outline" size="sm" className="gap-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200">
                                                <GitBranch size={14} />
                                                Open Builder
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (loading) {
        return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="h-screen w-full bg-gray-50 relative overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background gap={20} color="#e5e7eb" />
                <Controls />
                <Panel position="top-left" className="flex gap-2">
                    <Link href="/admin/counseling">
                        <Button variant="outline" className="bg-white gap-2">
                            <ArrowLeft size={16} />
                            Back to Topics
                        </Button>
                    </Link>
                    <div className="bg-white px-4 py-2 rounded-md shadow-sm border border-gray-200 font-semibold flex items-center">
                        {topicTitle}
                    </div>
                </Panel>
                <Panel position="top-right" className="flex gap-2">
                    <div className="flex bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
                        <Button
                            variant="ghost"
                            onClick={addNode}
                            className="rounded-none hover:bg-gray-50 px-3 gap-2"
                            title="Add Branch"
                        >
                            <GitBranch size={18} className="text-gray-700" />
                            <span>Add Branch</span>
                        </Button>
                    </div>

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

            {/* Import Topic Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Import Topic Flow</DialogTitle>
                        <DialogDescription>
                            Select a topic to import its entire flow as a branch. The flow will be copied into this builder.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto">
                        {topics.filter(t => t.id !== topicId).length === 0 ? (
                            <p className="text-center text-gray-500 py-4">No other topics available to import.</p>
                        ) : (
                            topics.filter(t => t.id !== topicId).map(topic => (
                                <div
                                    key={topic.id}
                                    className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer flex justify-between items-center group"
                                    onClick={() => handleImportTopic(topic.id)}
                                >
                                    <span className="font-medium text-gray-700">{topic.title}</span>
                                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100">
                                        Import
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default function CounselingBuilderPage() {
    return (
        <ReactFlowProvider>
            <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
                <CounselingBuilderContent />
            </Suspense>
        </ReactFlowProvider>
    );
}
