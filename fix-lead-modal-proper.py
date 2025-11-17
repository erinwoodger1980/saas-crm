#!/usr/bin/env python3
"""
Fix LeadModal.tsx by removing orphaned code and fixing type issues
"""

input_file = "/Users/Erin/saas-crm/web/src/app/leads/LeadModal.tsx"
output_file = "/Users/Erin/saas-crm/web/src/app/leads/LeadModal.tsx"

# Read the file
with open(input_file, 'r') as f:
    lines = f.readlines()

# Fix 1: Replace undefined types in all lines
for i, line in enumerate(lines):
    lines[i] = line.replace('WorkshopProcessDef', 'ProcDef').replace('WorkshopProcessAssignment', 'ProcAssignment')

# Fix 2: Remove duplicate tasks/order tabs (keep only first occurrence of each)
# Tasks appears at ~2868 and ~3463 (remove second)
# Order appears at ~2994 and ~3753 (remove second)

# Find all currentStage checks and track them
tasks_blocks = []
order_blocks = []

for i, line in enumerate(lines):
    if "{currentStage === 'tasks'" in line:
        tasks_blocks.append(i)
    elif "{currentStage === 'order'" in line:
        order_blocks.append(i)

print(f"Found {len(tasks_blocks)} tasks blocks at lines: {[x+1 for x in tasks_blocks]}")
print(f"Found {len(order_blocks)} order blocks at lines: {[x+1 for x in order_blocks]}")

# Now we need to find where the SECOND tasks block ends
# It should end before the second order block starts
# So remove from tasks_blocks[1] to just before order_blocks[1]

remove_ranges = []

if len(tasks_blocks) > 1:
    # Find the end of the second tasks block
    # It ends with ")}%" right before the next major block
    start = tasks_blocks[1]
    # Search forward for the closing of this block
    depth = 0
    for i in range(start, len(lines)):
        if '{' in lines[i]:
            depth += lines[i].count('{')
        if '}' in lines[i]:
            depth -= lines[i].count('}')
        
        # When we return to depth 0 or negative and see )}, that's the end
        if depth <= 0 and i > start and ')' in lines[i-1] and '}' in lines[i]:
            remove_ranges.append((start, i+1))
            print(f"Removing duplicate tasks block: lines {start+1} to {i+1}")
            break

if len(order_blocks) > 1:
    # Find the end of the second order block
    start = order_blocks[1]
    depth = 0
    for i in range(start, len(lines)):
        if '{' in lines[i]:
            depth += lines[i].count('{')
        if '}' in lines[i]:
            depth -= lines[i].count('}')
        
        if depth <= 0 and i > start and ')' in lines[i-1] and '}' in lines[i]:
            remove_ranges.append((start, i+1))
            print(f"Removing duplicate order block: lines {start+1} to {i+1}")
            break

# Build new content by skipping removed ranges
new_lines = []
for i, line in enumerate(lines):
    should_skip = False
    for start, end in remove_ranges:
        if start <= i < end:
            should_skip = True
            break
    if not should_skip:
        new_lines.append(line)

# Write the fixed content
with open(output_file, 'w') as f:
    f.writelines(new_lines)

print(f"\n✅ Fixed file written")
print(f"   Original lines: {len(lines)}")
print(f"   New lines: {len(new_lines)}")
print(f"   Removed: {len(lines) - len(new_lines)} lines")
