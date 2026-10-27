
import os

file_path = r"c:/Users/Jorge/Desktop/SAE 2/pages/CoursePages.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Locate Large Fields section
section_marker = '{/* Large Fields'
start_idx = content.find(section_marker)

if start_idx == -1:
    print("Large Fields section not found")
    exit(1)

# Find rows={6} after this marker
target_str = 'rows={6}'
replace_str = 'rows={header.match(/Documentos|Ementa|Link e-MEC/i) ? 4 : 6}'

found_idx = content.find(target_str, start_idx)

if found_idx == -1:
    print("rows={6} not found in Large Fields section")
    # Check if it was already changed or different formatting
    exit(1)

# Apply replacement
new_content = content[:found_idx] + replace_str + content[found_idx + len(target_str):]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Successfully updated rows in CoursePages.tsx")
