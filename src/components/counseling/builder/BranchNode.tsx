import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitBranch, Plus, X, Workflow } from 'lucide-react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const BranchNode = ({ id, data }: NodeProps<any>) => {
    const handleChange = (field: string, value: any) => {
        data.onChange(id, { ...data, [field]: value });
    };

    const addBranch = () => {
        const newBranches = [...(data.branches || []), `Branch ${(data.branches?.length || 0) + 1}`];
        handleChange('branches', newBranches);
    };

    const updateBranch = (index: number, value: string) => {
        const newBranches = [...(data.branches || [])];
        newBranches[index] = value;
        handleChange('branches', newBranches);
    };

    const removeBranch = (index: number) => {
        const newBranches = (data.branches || []).filter((_: any, i: number) => i !== index);
        handleChange('branches', newBranches);
    };

    // If no branches defined, we treat it as a single output node (linear)
    // OR we can force at least one branch.
    // Let's allow 0 branches to mean "End" or "Leaf", but maybe provide a way to add one easily.
    // Actually, to "connect to anything", we need handles.
    // Let's default to one "Next" branch if empty? Or just let user add them.
    // I'll stick to: User adds branches. If list is empty, no output handles (leaf node).

    return (
        <Card className="w-80 border-purple-200 shadow-xl hover:shadow-2xl hover:border-purple-300 transition-all">
            <CardHeader className="p-3 bg-purple-50 border-b border-purple-100 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2 text-purple-800">
                    <GitBranch size={16} />
                    <span className="font-bold text-sm">Branch</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-transparent"
                        onClick={() => data.onDelete?.(id)}
                        title="Delete Node"
                    >
                        <X size={16} />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        対応・行動・脚本
                    </Label>
                    <Textarea
                        className="min-h-[80px] text-sm bg-gray-50 focus:bg-white resize-none"
                        value={data.content || ''}
                        onChange={(e) => handleChange('content', e.target.value)}
                        placeholder="Enter content or question..."
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        お客さんの答え・行動
                    </Label>
                    <div className="space-y-3">
                        {data.branches?.map((branch: string, index: number) => (
                            <div key={index} className="relative flex items-center gap-2 group">
                                {/* Branch Input */}
                                <div className="flex-1 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold shrink-0">
                                        {index + 1}
                                    </div>
                                    <Input
                                        type="text"
                                        className="h-8 text-sm"
                                        value={branch}
                                        onChange={(e) => updateBranch(index, e.target.value)}
                                        placeholder={`Branch ${index + 1}`}
                                    />
                                </div>

                                {/* Actions */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-gray-300 hover:text-red-500 hover:bg-transparent"
                                    onClick={() => removeBranch(index)}
                                >
                                    <X size={14} />
                                </Button>

                                {/* Branch Handle */}
                                <div className="absolute -right-6 top-1/2 -translate-y-1/2 flex items-center">
                                    <div className="relative">
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id={`branch-${index}`}
                                            className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
                                            style={{ right: -6 }}
                                        />
                                    </div>
                                    {/* Quick Add Button */}
                                    <Button
                                        size="icon"
                                        className="ml-4 h-6 w-6 rounded-full shadow-sm border border-purple-200 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all bg-purple-50 text-purple-600 hover:bg-purple-100"
                                        onClick={() => data.onAddNext?.(id, `branch-${index}`)}
                                        title="Add connected branch"
                                    >
                                        <Plus size={14} />
                                    </Button>
                                    <Button
                                        size="icon"
                                        className="ml-1 h-6 w-6 rounded-full shadow-sm border border-blue-200 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all bg-blue-50 text-blue-600 hover:bg-blue-100"
                                        onClick={() => data.onRequestImport?.(id, `branch-${index}`)}
                                        title="Import Topic Flow"
                                    >
                                        <Workflow size={14} />
                                    </Button>
                                </div>
                            </div>
                        ))}

                        <Button
                            variant="outline"
                            className="w-full border-dashed border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600"
                            onClick={addBranch}
                        >
                            <Plus size={14} className="mr-1" /> Add Branch
                        </Button>
                    </div>
                </div>
            </CardContent>

            {/* Input Handle */}
            <Handle type="target" position={Position.Left} className="!w-4 !h-4 !bg-purple-600 !border-4 !border-white shadow-sm" />
        </Card>
    );
};

export default memo(BranchNode);
