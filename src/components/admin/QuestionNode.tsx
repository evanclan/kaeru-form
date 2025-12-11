import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitBranch, Plus, X, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const QuestionNode = ({ id, data }: NodeProps<any>) => {
    const handleChange = (field: string, value: any) => {
        data.onChange(id, { ...data, [field]: value });
    };

    return (
        <Card className={`w-80 border-blue-200 shadow-xl hover:shadow-2xl hover:border-blue-300 transition-all ${data.collapsed ? 'opacity-75' : ''}`}>
            <CardHeader className="p-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2 text-blue-800">
                    <GitBranch size={16} />
                    <span className="font-bold text-sm">Question</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-blue-400 hover:text-blue-600 hover:bg-transparent"
                        onClick={() => data.onCollapse?.(id, !data.collapsed)}
                        title={data.collapsed ? "Expand Branch" : "Collapse Branch"}
                    >
                        {data.collapsed ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                    <Select
                        value={data.type}
                        onValueChange={(value) => handleChange('type', value)}
                    >
                        <SelectTrigger className="h-7 w-[110px] text-xs bg-white border-blue-200 focus:ring-blue-100">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="text">Text Input</SelectItem>
                            <SelectItem value="email">Email Input</SelectItem>
                            <SelectItem value="date">Date Picker</SelectItem>
                        </SelectContent>
                    </Select>
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
                        Question Text
                    </Label>
                    <Textarea
                        className="min-h-[80px] text-sm bg-gray-50 focus:bg-white resize-none"
                        value={data.content}
                        onChange={(e) => handleChange('content', e.target.value)}
                        placeholder="What would you like to ask?"
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Input Placeholder
                    </Label>
                    <Input
                        type="text"
                        className="h-9 text-sm"
                        value={data.placeholder || ''}
                        onChange={(e) => handleChange('placeholder', e.target.value)}
                        placeholder="e.g., Type your answer..."
                    />
                </div>
            </CardContent>

            {/* Handles */}
            <Handle type="target" position={Position.Left} className="!w-4 !h-4 !bg-blue-600 !border-4 !border-white shadow-sm" />

            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center group">
                <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-blue-600 !border-4 !border-white shadow-sm" />
                <Button
                    size="icon"
                    className="mt-2 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transform -translate-y-2 group-hover:translate-y-0 transition-all bg-blue-600 hover:bg-blue-700"
                    onClick={() => data.onAddNext?.(id, undefined)}
                >
                    <Plus size={18} />
                </Button>
            </div>
        </Card>
    );
};

export default memo(QuestionNode);
