
import os

file_path = r"c:/Users/Jorge/Desktop/SAE 2/pages/CoursePages.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Target block to replace (from previous view_file)
# I will use a larger identifiable chunk to be sure, or just the grid div start
target_start = 'div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">'

if target_start not in content:
    print("Target start not found!")
    exit(1)

# Find start index
start_idx = content.find(target_start)
# Find the closing match for this div... actually it's easier to verify the block end.
# Based on view_file, the block ends with </div> and then some space and then {/* Action Footer */}
# But finding the matching closing tag is hard with simple string search if nested.
# Let's try to match the exact block string I saw in view_file if possible.
# Or, I will use regex or just count braces if I were smarter, but let's try to just find the string.

# I will reconstruct the known block from previous tool output to ensure it matches.
# If I can't match it exactly, I'll fail.

# Alternative: I know the context.
# start: <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
# end: {/* Action Footer */} (which is just after)

end_marker = '{/* Action Footer */}'
end_idx = content.find(end_marker)

if end_idx == -1:
    print("End marker not found!")
    exit(1)

# The block to replace is from start_idx (minus indentation?) to end_idx (minus indentation?)
# Let's check the content between them.
# The grid div starts at start_idx.
# It ends before end_idx.
# We need to find the last </div> before end_idx.

pre_footer_content = content[start_idx:end_idx]
last_div_idx = pre_footer_content.rfind('</div>')
real_end_idx = start_idx + last_div_idx + 6 # include </div>

print(f"Replacing from {start_idx} to {real_end_idx}")

new_content_block = '''{/* Small Fields (Grid) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                     {headers.map((header, index) => {
                        if (!header) return null;
                        const value = selectedCourse[index] || '';
                        if (value.length > 60) return null; // Skip large fields here

                        return (
                          <div key={index}>
                            <label className="block text-xs font-bold text-sae-accentAlt mb-1 uppercase tracking-wide opacity-80">
                              {header}
                            </label>
                            <input 
                                type="text" 
                                readOnly 
                                value={value} 
                                className="w-full bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sae-accent/50 h-10 text-sm shadow-inner"
                            />
                          </div>
                        );
                     })}
                  </div>

                  {/* Large Fields (Full Width) */}
                  <div className="space-y-6">
                     {headers.map((header, index) => {
                        if (!header) return null;
                        const value = selectedCourse[index] || '';
                        if (value.length <= 60) return null; // Skip small fields here

                        return (
                          <div key={index}>
                            <label className="block text-sm font-bold text-sae-accentAlt mb-2 uppercase tracking-wide">
                              {header}
                            </label>
                            <textarea 
                                readOnly 
                                value={value} 
                                rows={6}
                                className="w-full bg-sae-darker border border-sae-border/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sae-accent/50 resize-none shadow-inner leading-relaxed"
                            />
                          </div>
                        );
                     })}
                  </div>'''

# Inject the new content (with <div className start tag included in the new block? no, I replaced the old div entirely)
# Wait, my new content has two divs. The old content was one div.
# So I should remove the old <div className="grid...> ... </div> and put my new stuff.
# My `target_start` captured `div className="grid...`. 
# My replacement code DOES NOT start with `div className="grid...` exactly, it starts with comments.
# So I need to splice correctly.

final_content = content[:start_idx-1] + new_content_block + content[real_end_idx:] 
# start_idx-1 to remove the '<' ? No.
# target_start is 'div className...'. The '<' is before it?
# Let's adjust target_start to include '<'.
target_start_full = '<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">'
start_idx = content.find(target_start_full)

if start_idx == -1:
    print("Full start tag not found")
    exit(1)
    
pre_footer_content = content[start_idx:end_idx]
last_div_idx = pre_footer_content.rfind('</div>')
real_end_idx = start_idx + last_div_idx + 6

final_content = content[:start_idx] + new_content_block + content[real_end_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(final_content)

print("Successfully updated CoursePages.tsx")
