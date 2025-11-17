#!/usr/bin/env python3
"""
Script to remove orphaned tabs from LeadModal.tsx
Removes lines 3464-4230 (all orphaned quest

ionnaire/tasks/order/follow-up tabs)
"""

input_file = "/Users/Erin/saas-crm/web/src/app/leads/LeadModal.tsx"
output_file = "/Users/Erin/saas-crm/web/src/app/leads/LeadModal.tsx.fixed"

with open(input_file, 'r') as f:
    lines = f.readlines()

# Keep lines 1-3463 and 4231+
# Remove lines 3464-4230 (orphaned code)
kept_lines = lines[:3463] + lines[4230:]

with open(output_file, 'w') as f:
    f.writelines(kept_lines)

print(f"Fixed file written to {output_file}")
print(f"Original lines: {len(lines)}")
print(f"New lines: {len(kept_lines)}")
print(f"Removed: {len(lines) - len(kept_lines)} lines")
