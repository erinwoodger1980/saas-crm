import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ColoredSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string; className?: string }>;
  placeholder?: string;
  className?: string;
}

export function ColoredSelect({ value, onValueChange, options, placeholder, className = "" }: ColoredSelectProps) {
  const selectedOption = options.find(opt => opt.value === value);
  const selectedClassName = selectedOption?.className || "";
  
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={`h-9 ${className} ${selectedClassName}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            className={option.className}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
