import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MessageSquare, Plus, X, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const CommentNode = ({ id, data }: NodeProps<any>) => {
    const handleChange = (field: string, value: any) => {
        data.onChange(id, { ...data, [field]: value });
    };

    return (
        <Card className={`w-80 border-gray-200 shadow-xl hover:shadow-2xl hover:border-gray-300 transition-all ${data.collapsed ? 'opacity-75' : ''}`}>
            <CardHeader className="p-3 bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2 text-gray-600">
                    <MessageSquare size={16} />
                    <span className="font-bold text-sm">Comment</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-gray-600 hover:bg-transparent"
                        onClick={() => data.onCollapse?.(id, !data.collapsed)}
                        title={data.collapsed ? "Expand Branch" : "Collapse Branch"}
                    >
                        {data.collapsed ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                    <Badge variant="secondary" className="text-xs font-medium bg-gray-200 text-gray-500 hover:bg-gray-200">
                        Statement
                    </Badge>
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
                        Message Text
                    </Label>
                    <Textarea
                        className="min-h-[80px] text-sm bg-gray-50 focus:bg-white resize-none"
                        value={data.content}
                        onChange={(e) => handleChange('content', e.target.value)}
                        placeholder="Say something..."
                    />
                </div>
            </CardContent>

            {/* Handles */}
            <Handle type="target" position={Position.Left} className="!w-4 !h-4 !bg-gray-600 !border-4 !border-white shadow-sm" />

            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center group">
                <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-gray-600 !border-4 !border-white shadow-sm" />
                <Button
                    size="icon"
                    className="mt-2 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transform -translate-y-2 group-hover:translate-y-0 transition-all bg-gray-600 hover:bg-gray-700"
                    onClick={() => data.onAddNext?.(id, undefined)}
                >
                    <Plus size={18} />
                </Button>
            </div>
        </Card>
    );
};

export default memo(CommentNode);
