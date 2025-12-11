import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ColoredSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string; className?: string }>;
  placeholder?: string;
  className?: string;
  customColors?: Record<string, {bg: string, text: string}>;
}

export function ColoredSelect({ value, onValueChange, options, placeholder, className = "", customColors = {} }: ColoredSelectProps) {
  const selectedOption = options.find(opt => opt.value === value);
  const selectedClassName = selectedOption?.className || "";
  
  // Check if we have a custom color for this value
  const customColor = value && customColors[value];
  const triggerStyle = customColor ? {
    backgroundColor: customColor.bg,
    color: customColor.text,
    borderColor: customColor.bg
  } : undefined;
  
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger 
        className={`h-9 ${className} ${customColor ? '' : selectedClassName}`}
        style={triggerStyle}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => {
          const optionCustomColor = customColors[option.value];
          const optionStyle = optionCustomColor ? {
            backgroundColor: optionCustomColor.bg,
            color: optionCustomColor.text
          } : undefined;
          
          return (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className={optionCustomColor ? '' : option.className}
              style={optionStyle}
            >
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
