import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { X, Plus, List, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AnswerNode = ({ id, data }: NodeProps<any>) => {
    const handleChange = (field: string, value: any) => {
        data.onChange(id, { ...data, [field]: value });
    };

    const addOption = () => {
        const newOptions = [...(data.options || []), `Option ${(data.options?.length || 0) + 1}`];
        handleChange('options', newOptions);
    };

    const updateOption = (index: number, value: string) => {
        const newOptions = [...(data.options || [])];
        newOptions[index] = value;
        handleChange('options', newOptions);
    };

    const removeOption = (index: number) => {
        const newOptions = (data.options || []).filter((_: any, i: number) => i !== index);
        handleChange('options', newOptions);
    };

    const isDropdown = data.type === 'select';

    return (
        <Card className={`w-80 border-green-200 shadow-xl hover:shadow-2xl hover:border-green-300 transition-all ${data.collapsed ? 'opacity-75' : ''}`}>
            <CardHeader className="p-3 bg-green-50 border-b border-green-100 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2 text-green-800">
                    <List size={16} />
                    <span className="font-bold text-sm">Answer</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-green-600 hover:text-green-800 hover:bg-transparent"
                        onClick={() => data.onCollapse?.(id, !data.collapsed)}
                        title={data.collapsed ? "Expand Branch" : "Collapse Branch"}
                    >
                        {data.collapsed ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                    <Select
                        value={data.type || 'select'}
                        onValueChange={(value) => handleChange('type', value)}
                    >
                        <SelectTrigger className="h-7 w-[110px] text-xs bg-white border-green-200 text-green-700 focus:ring-green-100">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="select">Dropdown</SelectItem>
                            <SelectItem value="text">Text Input</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
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
                {isDropdown ? (
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Dropdown Options
                        </Label>
                        <div className="space-y-3">
                            {data.options?.map((option: string, index: number) => (
                                <div key={index} className="relative flex items-center gap-2 group">
                                    {/* Option Input */}
                                    <div className="flex-1 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold shrink-0">
                                            {index + 1}
                                        </div>
                                        <Input
                                            type="text"
                                            className="h-8 text-sm"
                                            value={option}
                                            onChange={(e) => updateOption(index, e.target.value)}
                                            placeholder={`Option ${index + 1}`}
                                        />
                                    </div>

                                    {/* Actions */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-gray-300 hover:text-red-500 hover:bg-transparent"
                                        onClick={() => removeOption(index)}
                                    >
                                        <X size={14} />
                                    </Button>

                                    {/* Branch Handle */}
                                    <div className="absolute -right-6 top-1/2 -translate-y-1/2 flex items-center">
                                        <div className="relative">
                                            <Handle
                                                type="source"
                                                position={Position.Right}
                                                id={`option-${index}`}
                                                className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
                                                style={{ right: -6 }}
                                            />
                                        </div>
                                        {/* Quick Add Button */}
                                        <Button
                                            size="icon"
                                            className="ml-4 h-6 w-6 rounded-full shadow-sm border border-green-200 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all bg-green-50 text-green-600 hover:bg-green-100"
                                            onClick={() => data.onAddNext?.(id, `option-${index}`)}
                                            title="Add connected step"
                                        >
                                            <Plus size={14} />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <Button
                                variant="outline"
                                className="w-full border-dashed border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600"
                                onClick={addOption}
                            >
                                <Plus size={14} className="mr-1" /> Add Option
                            </Button>
                        </div>
                    </div>
                ) : (
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
                )}
            </CardContent>

            {/* Input Handle */}
            <Handle type="target" position={Position.Left} className="!w-4 !h-4 !bg-green-600 !border-4 !border-white shadow-sm" />

            {/* Single Output Handle for Non-Dropdown types */}
            {!isDropdown && (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center group">
                    <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-green-600 !border-4 !border-white shadow-sm" />
                    <Button
                        size="icon"
                        className="mt-2 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transform -translate-y-2 group-hover:translate-y-0 transition-all bg-green-600 hover:bg-green-700"
                        onClick={() => data.onAddNext?.(id, undefined)}
                    >
                        <Plus size={18} />
                    </Button>
                </div>
            )}
        </Card>
    );
};

export default memo(AnswerNode);
